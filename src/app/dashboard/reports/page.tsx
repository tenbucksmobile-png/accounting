import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, TrendingUp, Building2, Users, Calculator } from 'lucide-react';
import {
  calcIndividualTax, effectiveRate, marginalRate, taxYearLabel,
  taxYearRange, currentTaxYear, fmtZAR, fmtPct, calcCGT,
  type TaxRateRow, type TaxBracket,
} from '@/lib/tax';
import { WhatIfSimulator } from './what-if-simulator';
import { IrpTracker } from './irp-tracker';
import { TaxYearSelector } from './tax-year-selector';

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return ok
    ? <Badge className="text-xs bg-green-100 text-green-700 border-green-300">{label}</Badge>
    : <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-300">{label}</Badge>;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const taxYear = parseInt(params.year ?? String(currentTaxYear()));
  const { start, end } = taxYearRange(taxYear);
  const supabase = await createClient();

  // ── Fetch everything ────────────────────────────────────────

  const [
    { data: entities },
    { data: rates },
    { data: entries },
    { data: lines },
    { data: accounts },
    { data: assets },
    { data: improvements },
    { data: provTax },
    { data: adjustments },
  ] = await Promise.all([
    supabase.from('entities').select('*'),
    supabase.from('tax_rates').select('*').eq('tax_year', taxYear),
    supabase.from('journal_entries').select('id,entity_id').gte('entry_date', start).lte('entry_date', end),
    supabase.from('journal_lines').select('entry_id,account_id,debit,credit'),
    supabase.from('accounts').select('id,entity_id,type,name,code'),
    supabase.from('assets').select('*').eq('is_disposed', false),
    supabase.from('asset_improvements').select('asset_id,amount_zar'),
    supabase.from('provisional_tax').select('*').eq('tax_year', taxYear).order('period'),
    supabase.from('income_adjustments').select('*').eq('tax_year', taxYear),
  ]);

  const today = new Date();

  // ── Helper lookups ──────────────────────────────────────────

  const getRates = (type: string): TaxRateRow | null =>
    (rates ?? []).find((r: any) => r.entity_type === type) as TaxRateRow ?? null;

  const getEntity = (name: string) =>
    (entities ?? []).find((e: any) => e.name === name) as any ?? null;

  const coRate = getRates('company');
  const trRate = getRates('trust');
  const indRate = getRates('individual');

  const company = getEntity('tenbucks-mobile (Pty) Ltd');
  const trust   = getEntity('Bonthuys Family Trust');

  // PERSONAL_SALARY / RENTAL_NET = Marius's personal income figures
  // Used in the WhatIf salary-vs-retain comparison (Marius as the operating consultant)
  // and in trust/page.tsx for Section 7(3) attribution on Shone's distributions.
  // Maria J. Bonthuys is the company owner/director — update if Maria's personal income
  // figures are needed separately for a different calculation.

  // ── P&L calculation per entity ──────────────────────────────

  function entityPL(entityId: string) {
    const entityEntries = new Set((entries ?? []).filter((e: any) => e.entity_id === entityId).map((e: any) => e.id));
    const entityAccounts = new Map((accounts ?? []).filter((a: any) => a.entity_id === entityId).map((a: any) => [a.id, a]));

    let income = 0, expenses = 0;
    for (const line of (lines ?? []) as any[]) {
      if (!entityEntries.has(line.entry_id)) continue;
      const acc = entityAccounts.get(line.account_id);
      if (!acc) continue;
      if (acc.type === 'income')  income   += Number(line.credit) - Number(line.debit);
      if (acc.type === 'expense') expenses += Number(line.debit)  - Number(line.credit);
    }
    return { income, expenses, gross: income - expenses };
  }

  // ── Days elapsed in tax year ────────────────────────────────
  const yearStart = new Date(start);
  const yearEnd   = new Date(end);
  const totalDays = Math.round((yearEnd.getTime() - yearStart.getTime()) / 86400000);
  const elapsedDays = Math.max(1, Math.min(
    totalDays,
    Math.round((today.getTime() - yearStart.getTime()) / 86400000),
  ));

  // ── Company tax ─────────────────────────────────────────────

  const coPL = company ? entityPL(company.id) : { income: 0, expenses: 0, gross: 0 };

  // Add manual adjustments
  const coAdj = (adjustments ?? []).filter((a: any) => a.entity_id === company?.id);
  const coAdjTotal = coAdj.reduce((s: number, a: any) => {
    const sign = ['depreciation','s13_allowance','prior_year_loss','other_deduction','dividend_exempt','exempt_income'].includes(a.type) ? 1 : -1;
    return s + (Number(a.amount) * sign);
  }, 0);

  // S13 from assets
  const coAssets = (assets ?? []).filter((a: any) => a.entity_id === company?.id);
  const coImprovements = (improvements ?? []) as any[];
  let s13Total = 0;
  for (const asset of coAssets) {
    const propRes = await supabase.from('asset_property_details').select('*').eq('asset_id', asset.id).maybeSingle();
    const prop = propRes.data as any;
    if (prop?.building_cost_zar > 0 && prop?.s13_rate > 0) {
      s13Total += prop.building_cost_zar * (prop.s13_rate / 100);
    }
  }

  const coTaxableIncome = Math.max(0, coPL.gross + coAdjTotal - s13Total);
  const coTax = coTaxableIncome * (coRate?.flat_rate ?? 0.27);
  const coEffRate = effectiveRate(coTax, Math.max(1, coPL.income));

  // Annualised projections
  const annualisedIncome = (coPL.income / elapsedDays) * totalDays;
  const annualisedTaxable = Math.max(0, annualisedIncome - (coPL.expenses / elapsedDays) * totalDays + coAdjTotal - s13Total);
  const annualisedTax = annualisedTaxable * (coRate?.flat_rate ?? 0.27);

  // ── Provisional tax ─────────────────────────────────────────
  const p1 = (provTax ?? []).find((p: any) => p.period === 1) as any;
  const p2 = (provTax ?? []).find((p: any) => p.period === 2) as any;
  const totalProvisionalPaid = ((p1?.amount_paid ?? 0) + (p2?.amount_paid ?? 0));
  const p2TargetAmount = Math.max(0, annualisedTax - (p1?.amount_paid ?? 0));
  const safe80pct = totalProvisionalPaid >= annualisedTax * 0.8;
  const p1Due = p1 ? new Date(p1.due_date) : null;
  const p2Due = p2 ? new Date(p2.due_date) : null;
  const p1Overdue = p1Due && p1Due < today && (p1?.amount_paid ?? 0) === 0;
  const p2Overdue = p2Due && p2Due < today && (p2?.amount_paid ?? 0) === 0;

  // ── Trust tax ───────────────────────────────────────────────
  const trPL = trust ? entityPL(trust.id) : { income: 0, expenses: 0, gross: 0 };
  const trAdj = (adjustments ?? []).filter((a: any) => a.entity_id === trust?.id);
  const trAdjTotal = trAdj.reduce((s: number, a: any) => s + Number(a.amount), 0);

  // Distributions from trust expenses account "Trust Distributions"
  const trDistributions = (() => {
    const trEntries = new Set((entries ?? []).filter((e: any) => e.entity_id === trust?.id).map((e: any) => e.id));
    const trAccounts = (accounts ?? []).filter((a: any) => a.entity_id === trust?.id) as any[];
    const distAcc = trAccounts.find(a => a.name.toLowerCase().includes('distribution'));
    if (!distAcc) return 0;
    return ((lines ?? []) as any[])
      .filter(l => trEntries.has(l.entry_id) && l.account_id === distAcc.id)
      .reduce((s, l) => s + Number(l.debit), 0);
  })();

  const trUndistributed = Math.max(0, trPL.gross - trDistributions + trAdjTotal);
  const trTax = trUndistributed * (trRate?.flat_rate ?? 0.45);

  // ── Personal income tax (Marius) ───────────────────────────
  // Known: R65,000/month salary from external employment
  // Rental income (net): from personal journal if exists, else R0
  // S7C interest received: from loan tracker
  const PERSONAL_SALARY = 65000 * 12;
  const RENTAL_NET = 2200 * 12; // conservative net after deductions

  const s7cInterestReceived = (() => {
    const today2 = new Date();
    const yr2Start = new Date(`${taxYear - 1}-03-01`);
    const daysElapsed2 = Math.max(0, Math.floor((today2.getTime() - yr2Start.getTime()) / 86400000));
    return (345000 * 0.0925 * daysElapsed2) / 365;
  })();

  const personalTaxableIncome = PERSONAL_SALARY + RENTAL_NET + s7cInterestReceived;
  const brackets = indRate?.brackets as TaxBracket[] ?? [];
  const indTaxBeforeRebates = calcIndividualTax(personalTaxableIncome, brackets);
  const indTaxAfterRebates = Math.max(0, indTaxBeforeRebates - (indRate?.primary_rebate ?? 17235));
  const indEffRate = effectiveRate(indTaxAfterRebates, personalTaxableIncome);
  const indMarginal = marginalRate(personalTaxableIncome, brackets);

  // ── CGT schedule ────────────────────────────────────────────

  const cgtItems = (assets ?? []).map((asset: any) => {
    const impTotal = (improvements ?? []).filter((i: any) => i.asset_id === asset.id).reduce((s: number, i: any) => s + Number(i.amount_zar), 0);
    const costBase = Number(asset.cost_base_zar) + impTotal;
    const currentVal = Number(asset.current_value_zar ?? costBase);
    const gain = currentVal - costBase;
    const entityType = (entities ?? []).find((e: any) => e.id === asset.entity_id) as any;
    const rateForEntity = getRates(entityType?.type ?? 'company');
    const taxRate = rateForEntity?.flat_rate ?? rateForEntity ? Number(rateForEntity?.flat_rate ?? 0.27) : 0.27;
    const cgt = calcCGT(gain, rateForEntity!, taxRate);
    return { asset, costBase, currentVal, gain, cgt, entityType };
  });

  const totalUnrealisedGain = cgtItems.reduce((s, i) => s + i.gain, 0);
  const totalCGTIfSoldNow = cgtItems.reduce((s, i) => s + i.cgt, 0);

  // ── Total tax position ──────────────────────────────────────
  const totalTaxBurden = coTax + trTax + indTaxAfterRebates;

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Tax Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tax year {taxYearLabel(taxYear)} &nbsp;·&nbsp; 1 Mar {taxYear - 1} – 28 Feb {taxYear}
            &nbsp;·&nbsp; {elapsedDays} of {totalDays} days elapsed
          </p>
        </div>
        <TaxYearSelector currentYear={taxYear} />
      </div>

      {/* ── Total tax burden summary ─────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        <Card className="col-span-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
          <CardContent className="pt-5 pb-5">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">Company CIT (27%)</p>
                <p className="text-2xl font-bold text-amber-400">{fmtZAR(coTax)}</p>
                <p className="text-xs text-slate-400">On {fmtZAR(coTaxableIncome)} taxable</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Trust IT12T (45%)</p>
                <p className="text-2xl font-bold text-amber-400">{fmtZAR(trTax)}</p>
                <p className="text-xs text-slate-400">On {fmtZAR(trUndistributed)} undistributed</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Personal ITR12</p>
                <p className="text-2xl font-bold text-amber-400">{fmtZAR(indTaxAfterRebates)}</p>
                <p className="text-xs text-slate-400">On {fmtZAR(personalTaxableIncome)} income</p>
              </div>
              <div className="border-l border-slate-700 pl-4">
                <p className="text-xs text-slate-400 mb-1">Total tax burden</p>
                <p className="text-2xl font-bold text-white">{fmtZAR(totalTaxBurden)}</p>
                <p className="text-xs text-slate-400">Across all entities</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* ── Company IT14 ──────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">tenbucks-mobile — IT14 Estimate</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Gross income (from ledger)</span>
                <span className="font-medium text-green-700">{fmtZAR(coPL.income)}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Less: deductible expenses</span>
                <span className="font-medium text-red-600">({fmtZAR(coPL.expenses)})</span>
              </div>
              {s13Total > 0 && (
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Less: Section 13 allowance</span>
                  <span className="font-medium text-red-600">({fmtZAR(s13Total)})</span>
                </div>
              )}
              {coAdjTotal !== 0 && (
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Manual adjustments</span>
                  <span className="font-medium">({fmtZAR(coAdjTotal)})</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b font-semibold">
                <span>Taxable income</span>
                <span>{fmtZAR(coTaxableIncome)}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">CIT @ 27%</span>
                <span className="font-bold text-amber-700">{fmtZAR(coTax)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Effective rate</span>
                <span>{fmtPct(coEffRate)}</span>
              </div>
            </div>

            {coPL.income === 0 && (
              <div className="text-xs text-amber-700 bg-amber-50 rounded p-2 mb-3">
                No transactions in ledger for this tax year. Add journal entries or use the What-If simulator below for projections.
              </div>
            )}

            {elapsedDays < totalDays && (
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground font-semibold mb-2">Full-Year Projection ({Math.round(elapsedDays/totalDays*100)}% of year elapsed)</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Projected taxable income</span>
                  <span className="font-medium">{fmtZAR(annualisedTaxable)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Projected CIT</span>
                  <span className="font-bold text-amber-700">{fmtZAR(annualisedTax)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Personal IT ──────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Marius Bonthuys — Personal IT Estimate</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Employment income</span>
                <span className="font-medium text-green-700">{fmtZAR(PERSONAL_SALARY)}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Net rental income (est.)</span>
                <span className="font-medium text-green-700">{fmtZAR(RENTAL_NET)}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">S7C interest from company</span>
                <span className="font-medium text-green-700">{fmtZAR(s7cInterestReceived)}</span>
              </div>
              <div className="flex justify-between py-1 border-b font-semibold">
                <span>Taxable income</span>
                <span>{fmtZAR(personalTaxableIncome)}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Tax per brackets</span>
                <span>{fmtZAR(indTaxBeforeRebates)}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Less: primary rebate</span>
                <span className="text-green-600">({fmtZAR(indRate?.primary_rebate ?? 17235)})</span>
              </div>
              <div className="flex justify-between py-1 border-b font-bold">
                <span>Tax payable</span>
                <span className="text-amber-700">{fmtZAR(indTaxAfterRebates)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Effective rate</span>
                <span>{fmtPct(indEffRate)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Marginal rate</span>
                <span className="font-semibold">{fmtPct(indMarginal)}</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
              Based on R65,000/month salary + estimated net rental. Update via income_adjustments if actual differs.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── IRP6 Provisional Tax Tracker ──────────────────────── */}
      <IrpTracker
        p1={p1 as any}
        p2={p2 as any}
        annualisedTax={annualisedTax}
        totalPaid={totalProvisionalPaid}
        safe80pct={safe80pct}
        taxYear={taxYear}
        companyId={company?.id ?? ''}
        p2TargetAmount={p2TargetAmount}
      />

      {/* ── Trust IT12T ───────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Bonthuys Family Trust — IT12T Estimate</CardTitle>
            </div>
            <StatusBadge ok={trDistributions > 0} label={trDistributions > 0 ? 'Distributions recorded' : 'No distributions yet'} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground mb-1">Trust income (from ledger)</p>
              <p className="text-lg font-bold">{fmtZAR(trPL.income)}</p>
            </div>
            <div className="rounded-lg bg-green-50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Distributions to beneficiaries</p>
              <p className="text-lg font-bold text-green-700">{fmtZAR(trDistributions)}</p>
              <p className="text-xs text-muted-foreground">Taxed at beneficiary rates</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Undistributed income @ 45%</p>
              <p className="text-lg font-bold text-amber-700">{fmtZAR(trTax)}</p>
              <p className="text-xs text-muted-foreground">On {fmtZAR(trUndistributed)}</p>
            </div>
          </div>
          {trDistributions === 0 && trPL.income > 0 && (
            <div className="text-sm text-amber-800 bg-amber-50 rounded p-3">
              <strong>Action:</strong> All R{fmtZAR(trPL.income)} of trust income will be taxed at 45% flat unless distributed to beneficiaries. Record distributions as journal entries: Dr "Trust Distributions" / Cr "Bank". Distribute to lower-bracket beneficiaries first (spouse, adult child).
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── CGT Schedule ─────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">CGT Schedule — Unrealised Positions</CardTitle>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">Total unrealised gain: <strong className="text-green-700">{fmtZAR(totalUnrealisedGain)}</strong></span>
              <span className="text-muted-foreground">CGT if all sold: <strong className="text-amber-700">{fmtZAR(totalCGTIfSoldNow)}</strong></span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-5 py-2 text-left font-medium text-muted-foreground">Asset</th>
                <th className="px-5 py-2 text-left font-medium text-muted-foreground">Entity</th>
                <th className="px-5 py-2 text-right font-medium text-muted-foreground">CGT Base Cost</th>
                <th className="px-5 py-2 text-right font-medium text-muted-foreground">Current Value</th>
                <th className="px-5 py-2 text-right font-medium text-muted-foreground">Gain / (Loss)</th>
                <th className="px-5 py-2 text-right font-medium text-muted-foreground">Inclusion</th>
                <th className="px-5 py-2 text-right font-medium text-muted-foreground">CGT if Sold</th>
              </tr>
            </thead>
            <tbody>
              {cgtItems.map(({ asset, costBase, currentVal, gain, cgt, entityType }) => {
                const rateRow = getRates(entityType?.type ?? 'company');
                return (
                  <tr key={asset.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-5 py-2.5">
                      <p className="font-medium">{asset.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{asset.type}</p>
                    </td>
                    <td className="px-5 py-2.5 text-muted-foreground text-xs">{entityType?.name}</td>
                    <td className="px-5 py-2.5 text-right">{fmtZAR(costBase)}</td>
                    <td className="px-5 py-2.5 text-right">{fmtZAR(currentVal)}</td>
                    <td className={`px-5 py-2.5 text-right font-medium ${gain >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {gain >= 0 ? '+' : ''}{fmtZAR(gain)}
                    </td>
                    <td className="px-5 py-2.5 text-right text-muted-foreground">
                      {fmtPct(rateRow?.cgt_inclusion_rate ?? 0.8)} incl.
                    </td>
                    <td className="px-5 py-2.5 text-right font-bold text-amber-700">{fmtZAR(cgt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {cgtItems.length === 0 && (
            <p className="px-5 py-4 text-sm text-muted-foreground">No assets recorded. Add assets in the Asset Register.</p>
          )}
        </CardContent>
      </Card>

      {/* ── What-If Simulator ─────────────────────────────────── */}
      <WhatIfSimulator
        coRate={coRate?.flat_rate ?? 0.27}
        indBrackets={brackets}
        primaryRebate={indRate?.primary_rebate ?? 17235}
        currentPersonalIncome={personalTaxableIncome}
        currentCompanyTaxableIncome={coTaxableIncome}
        taxYear={taxYear}
      />
    </div>
  );
}
