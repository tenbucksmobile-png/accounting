import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Info, ShieldCheck, TrendingDown, Users, FileText } from 'lucide-react';
import {
  calcIndividualTax, marginalRate, taxYearRange, taxYearLabel,
  currentTaxYear, fmtZAR, fmtPct,
  type TaxBracket, type TaxRateRow,
} from '@/lib/tax';
import type { TrustBeneficiary } from '@/types/database';
import { AddDistributionButton } from './add-distribution-button';
import { AddPolicyButton } from './add-policy-button';
import { TrustYearSelector } from './trust-year-selector';

// Marius's estimated income (matches hard-coded values in reports/page.tsx)
const MARIUS_SALARY = 65_000 * 12;
const MARIUS_RENTAL = 2_200 * 12;

export default async function TrustPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const taxYear = parseInt(params.year ?? String(currentTaxYear()));
  const { start, end } = taxYearRange(taxYear);
  const supabase = await createClient();

  const [
    { data: trustees },
    { data: beneficiaries },
    { data: policies },
    { data: resolutions },
    { data: entities },
    { data: rates },
    { data: entries },
    { data: lines },
    { data: accounts },
  ] = await Promise.all([
    supabase.from('trust_trustees').select('*').eq('is_active', true).order('created_at'),
    supabase.from('trust_beneficiaries').select('*').eq('is_active', true).order('name'),
    supabase.from('trust_life_policies').select('*').order('insurer'),
    supabase.from('trust_distribution_resolutions')
      .select('*, beneficiary:beneficiary_id(id,name)')
      .eq('tax_year', taxYear)
      .order('resolution_date'),
    supabase.from('entities').select('*'),
    supabase.from('tax_rates').select('*').eq('tax_year', taxYear),
    supabase.from('journal_entries').select('id,entity_id').gte('entry_date', start).lte('entry_date', end),
    supabase.from('journal_lines').select('entry_id,account_id,debit,credit'),
    supabase.from('accounts').select('id,entity_id,type,name'),
  ]);

  const trust = (entities ?? []).find((e: any) => e.name === 'Bonthuys Family Trust') as any;
  const indRate = (rates ?? []).find((r: any) => r.entity_type === 'individual') as TaxRateRow | null;
  const trustRateRow = (rates ?? []).find((r: any) => r.entity_type === 'trust') as any;

  // ── Trust P&L from journal ───────────────────────────────────────────────
  const trustEntryIds = new Set(
    (entries ?? []).filter((e: any) => e.entity_id === trust?.id).map((e: any) => e.id),
  );
  const trustAccMap = new Map(
    (accounts ?? []).filter((a: any) => a.entity_id === trust?.id).map((a: any) => [a.id, a]),
  );
  let income = 0, expenses = 0;
  for (const line of (lines ?? []) as any[]) {
    if (!trustEntryIds.has(line.entry_id)) continue;
    const acc = trustAccMap.get(line.account_id);
    if (!acc) continue;
    if (acc.type === 'income')  income   += Number(line.credit) - Number(line.debit);
    if (acc.type === 'expense') expenses += Number(line.debit)  - Number(line.credit);
  }
  const gross = income - expenses;

  const totalDistributed = (resolutions ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0);
  const undistributed = Math.max(0, gross - totalDistributed);
  const trustTax = undistributed * (trustRateRow?.flat_rate ?? 0.45);

  // ── Tax calculation helpers ──────────────────────────────────────────────
  const brackets = (indRate?.brackets ?? []) as TaxBracket[];
  const primaryRebate = indRate?.primary_rebate ?? 17_235;
  const taxThreshold  = indRate?.tax_threshold  ?? 95_750;

  // Tax a beneficiary pays on a given distribution, given their other income
  function distTax(distribution: number, otherIncome: number): number {
    const withDist = Math.max(0, calcIndividualTax(otherIncome + distribution, brackets) - primaryRebate);
    const base     = Math.max(0, calcIndividualTax(otherIncome, brackets) - primaryRebate);
    return withDist - base;
  }

  // Marius's marginal rate — used for Section 7(3) attribution on Shone distributions
  const mariusIncome       = MARIUS_SALARY + MARIUS_RENTAL;
  const mariusMarginalRate = marginalRate(mariusIncome, brackets) || 0.41;

  // ── Beneficiary helpers ──────────────────────────────────────────────────
  function ageAtYearEnd(dob: string): number {
    const d       = new Date(dob);
    const yearEnd = new Date(`${taxYear}-02-28`);
    let age = yearEnd.getFullYear() - d.getFullYear();
    const m = yearEnd.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && yearEnd.getDate() < d.getDate())) age--;
    return age;
  }

  const resolutionsByBeneficiary = (resolutions ?? []).reduce((acc: Record<string, number>, r: any) => {
    acc[r.beneficiary_id] = (acc[r.beneficiary_id] ?? 0) + Number(r.amount);
    return acc;
  }, {});

  // ── Life insurance summary ───────────────────────────────────────────────
  const allPolicies    = (policies ?? []) as any[];
  const exposedPolicies = allPolicies.filter(p => !p.trust_owns_policy);
  const totalSumAssured  = allPolicies.reduce((s, p) => s + Number(p.sum_assured_zar), 0);
  const exposedSumAssured = exposedPolicies.reduce((s: number, p: any) => s + Number(p.sum_assured_zar), 0);

  // ── Shone's "turns 18" year ──────────────────────────────────────────────
  const shone = (beneficiaries ?? []).find((b: any) => b.name.includes('Shone')) as TrustBeneficiary | undefined;
  const shoneTurns18Year = shone ? new Date(shone.date_of_birth).getFullYear() + 18 : 0;

  // ── Planner: optimal amount to distribute to Dajahn ─────────────────────
  const dajahn = (beneficiaries ?? []).find((b: any) => b.name.includes('Dajahn')) as TrustBeneficiary | undefined;
  const dajahnDistributed = dajahn ? (resolutionsByBeneficiary[dajahn.id] ?? 0) : 0;
  const dajahnRemainingCapacity = Math.max(0, taxThreshold - dajahnDistributed);
  const plannerDistribution = Math.min(undistributed, taxThreshold);
  const plannerSaving = plannerDistribution * 0.45 - distTax(plannerDistribution, 0);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="p-8 max-w-6xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Bonthuys Family Trust</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Inter vivos discretionary trust &nbsp;·&nbsp; IT12T filer &nbsp;·&nbsp; Tax year {taxYearLabel(taxYear)}
          </p>
        </div>
        <TrustYearSelector currentYear={taxYear} />
      </div>

      {/* ── Trustees ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {(trustees ?? []).map((t: any) => (
          <Card key={t.id} className={t.is_independent ? 'border-blue-200 bg-blue-50/40' : ''}>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
                {t.is_independent && (
                  <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">Independent</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Trust income summary ────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Trust income</p>
            <p className="text-xl font-bold text-green-700">{fmtZAR(income)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Expenses</p>
            <p className="text-xl font-bold text-red-600">{fmtZAR(expenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Distributed</p>
            <p className="text-xl font-bold text-green-600">{fmtZAR(totalDistributed)}</p>
          </CardContent>
        </Card>
        <Card className={undistributed > 0 ? 'border-amber-200 bg-amber-50' : ''}>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Undistributed @ 45%</p>
            <p className={`text-xl font-bold ${undistributed > 0 ? 'text-amber-700' : ''}`}>{fmtZAR(trustTax)}</p>
            <p className="text-xs text-muted-foreground">On {fmtZAR(undistributed)}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Planner + Life insurance ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-6 mb-6">

        {/* Distribution planner */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Optimal Distribution Plan</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Distribute to Dajahn first — he has no other income, so his effective rate is well below the trust&apos;s flat 45%.
            </p>

            {/* Bracket table */}
            <table className="w-full text-xs mb-4">
              <thead className="border-b">
                <tr>
                  <th className="pb-1.5 text-left font-medium text-muted-foreground">Dajahn&apos;s income band</th>
                  <th className="pb-1.5 text-right font-medium text-muted-foreground">His rate</th>
                  <th className="pb-1.5 text-right font-medium text-muted-foreground">Saving vs 45%</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-1.5 text-green-700 font-medium">R0 – {fmtZAR(taxThreshold)}</td>
                  <td className="py-1.5 text-right font-bold text-green-700">0% effective</td>
                  <td className="py-1.5 text-right font-bold text-green-700">+45%</td>
                </tr>
                {brackets.filter(b => {
                  const bracketTop = b.to ?? Infinity;
                  return bracketTop >= taxThreshold && b.rate < 0.45;
                }).map((b, i) => {
                  const displayFrom = Math.max(b.from, taxThreshold + 1);
                  const saving = 0.45 - b.rate;
                  return (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5 text-muted-foreground">
                        {fmtZAR(displayFrom)} – {b.to ? fmtZAR(b.to) : 'above'}
                      </td>
                      <td className="py-1.5 text-right">{fmtPct(b.rate)}</td>
                      <td className={`py-1.5 text-right font-medium ${saving > 0 ? 'text-green-700' : 'text-muted-foreground'}`}>
                        {saving > 0 ? `+${fmtPct(saving)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Recommendation */}
            {undistributed > 0 ? (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-800 mb-3">
                <p className="font-semibold mb-1">Recommended action for {taxYearLabel(taxYear)}:</p>
                <p>
                  Distribute <strong>{fmtZAR(plannerDistribution)}</strong> to Dajahn →
                  saves <strong>{fmtZAR(plannerSaving)}</strong> vs keeping in trust.
                  {undistributed > taxThreshold && (
                    <> Remaining <strong>{fmtZAR(undistributed - taxThreshold)}</strong> can continue at 18–26% brackets — still well below 45%.</>
                  )}
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground mb-3">
                No undistributed trust income for {taxYearLabel(taxYear)}. The planner activates once journal entries are recorded.
              </div>
            )}

            {/* Shone warning */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div>
                <strong>Shone (minor until {shoneTurns18Year}) — S7(3) attribution:</strong> Distributions
                are taxed at Marius&apos;s marginal rate ({fmtPct(mariusMarginalRate)}) — only a {fmtPct(0.45 - mariusMarginalRate)} saving
                vs trust, with SARS scrutiny. Distribute to Dajahn first.
                From {shoneTurns18Year} Shone&apos;s distributions are in her own hands at 0% up to {fmtZAR(taxThreshold)}.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Life insurance register */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Life Insurance Register</CardTitle>
              </div>
              <AddPolicyButton />
            </div>
          </CardHeader>
          <CardContent>
            {exposedPolicies.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 mb-3">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <div>
                  <strong>{exposedPolicies.length} {exposedPolicies.length === 1 ? 'policy' : 'policies'} ({fmtZAR(exposedSumAssured)}) are estate-duty exposed.</strong>{' '}
                  Trust is named beneficiary but Marius owns the policy — proceeds are included in his estate.
                  Have Tanja arrange <strong>cession to trust</strong> to exclude from estate.
                </div>
              </div>
            )}

            {allPolicies.length === 0 && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded p-3 mb-3">
                No policies recorded. Add life insurance policies where the trust is the beneficiary or owner.
              </div>
            )}

            <div className="space-y-2 mb-3">
              {allPolicies.map((p: any) => (
                <div
                  key={p.id}
                  className={`rounded-lg border p-3 ${p.trust_owns_policy ? 'border-green-200 bg-green-50/60' : 'border-amber-200 bg-amber-50/40'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{p.insurer}</p>
                      <p className="text-xs text-muted-foreground">
                        Insured: {p.insured_person}
                        {p.policy_number ? ` · ${p.policy_number}` : ''}
                        {p.annual_premium_zar ? ` · ${fmtZAR(p.annual_premium_zar)} p.a.` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm">{fmtZAR(p.sum_assured_zar)}</p>
                      <Badge
                        variant="outline"
                        className={`text-xs mt-1 ${p.trust_owns_policy ? 'border-green-400 text-green-700' : 'border-amber-400 text-amber-700'}`}
                      >
                        {p.trust_owns_policy ? '✓ Outside estate' : '⚠ In estate'}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-100 rounded p-2.5">
              <strong>Estate duty:</strong> Total cover {fmtZAR(totalSumAssured)}.
              SA abatement: R3.5m · Rate: 20% on first R30m, 25% above.
              Policies ceded to trust (trust = owner) fall <em>outside</em> the estate entirely.
              Policies where trust is merely beneficiary are included in Marius&apos;s estate at death.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Beneficiary breakdown ───────────────────────────────────────────── */}
      <h2 className="text-base font-semibold mb-3">Beneficiary Distribution Analysis</h2>
      <div className="grid grid-cols-2 gap-6 mb-6">
        {(beneficiaries ?? []).map((ben: TrustBeneficiary) => {
          const age     = ageAtYearEnd(ben.date_of_birth);
          const isMinor = age < 18;
          const turnsAdultYear = new Date(ben.date_of_birth).getFullYear() + 18;
          const distributed = resolutionsByBeneficiary[ben.id] ?? 0;
          const taxOnDist   = isMinor
            ? distributed * mariusMarginalRate
            : distTax(distributed, Number(ben.annual_other_income));
          const trustWouldHavePaid = distributed * 0.45;
          const taxSaving          = trustWouldHavePaid - taxOnDist;
          const remainingTaxFree   = isMinor ? 0 : Math.max(0, taxThreshold - Number(ben.annual_other_income) - distributed);

          return (
            <Card key={ben.id} className={isMinor ? 'border-amber-200' : 'border-green-200'}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">{ben.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{age} yrs</Badge>
                    <Badge variant={isMinor ? 'destructive' : 'default'} className="text-xs">
                      {isMinor ? 'Minor' : 'Major'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isMinor && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 mb-4">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <div>
                      <strong>Section 7(3) attribution:</strong> Trust income distributed to {ben.name.split(' ')[0]} is
                      taxed in Marius&apos;s hands at {fmtPct(mariusMarginalRate)} marginal rate while she is under 18.
                      Restriction lifts in <strong>{turnsAdultYear}</strong> — from then, distributions are in her own
                      hands at 0% up to {fmtZAR(taxThreshold)}.
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Distributed this year</p>
                    <p className="text-lg font-bold">{fmtZAR(distributed)}</p>
                  </div>
                  {isMinor ? (
                    <div className="rounded-lg bg-amber-50 p-3">
                      <p className="text-xs text-muted-foreground mb-1">Attributed at Marius&apos;s rate</p>
                      <p className="text-lg font-bold text-amber-700">{fmtPct(mariusMarginalRate)}</p>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-green-50 p-3">
                      <p className="text-xs text-muted-foreground mb-1">Remaining tax-free capacity</p>
                      <p className="text-lg font-bold text-green-700">{fmtZAR(remainingTaxFree)}</p>
                      <p className="text-xs text-muted-foreground">Before paying any tax</p>
                    </div>
                  )}
                </div>

                {distributed > 0 && (
                  <div className="rounded-lg bg-muted/30 p-3 text-xs mb-4 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Tax on {fmtZAR(distributed)}{isMinor ? ' (attributed to Marius)' : ''}
                      </span>
                      <span className="font-medium">{fmtZAR(taxOnDist)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Trust would have paid @ 45%</span>
                      <span className="font-medium">{fmtZAR(trustWouldHavePaid)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Tax saving</span>
                      <span className={taxSaving > 0 ? 'text-green-700' : 'text-red-600'}>
                        {fmtZAR(taxSaving)}
                      </span>
                    </div>
                  </div>
                )}

                {!isMinor && distributed === 0 && dajahnRemainingCapacity > 0 && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800 mb-4">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      Can receive up to <strong>{fmtZAR(dajahnRemainingCapacity)}</strong> this year with zero tax
                      (within primary rebate threshold).
                    </span>
                  </div>
                )}

                <AddDistributionButton
                  beneficiaryId={ben.id}
                  beneficiaryName={ben.name}
                  taxYear={taxYear}
                  isMinor={isMinor}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Resolution history ──────────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">
              Distribution Resolutions — {taxYearLabel(taxYear)}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {(resolutions ?? []).length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">
              No resolutions recorded for {taxYearLabel(taxYear)}. Use the buttons above to record trustee resolutions.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="px-5 py-2 text-left font-medium text-muted-foreground">Resolution Date</th>
                  <th className="px-5 py-2 text-left font-medium text-muted-foreground">Beneficiary</th>
                  <th className="px-5 py-2 text-left font-medium text-muted-foreground">Character (S25B)</th>
                  <th className="px-5 py-2 text-right font-medium text-muted-foreground">Amount</th>
                  <th className="px-5 py-2 text-left font-medium text-muted-foreground">Notes</th>
                </tr>
              </thead>
              <tbody>
                {(resolutions ?? []).map((r: any) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-5 py-2.5">{fmtDate(r.resolution_date)}</td>
                    <td className="px-5 py-2.5 font-medium">{(r.beneficiary as any)?.name}</td>
                    <td className="px-5 py-2.5">
                      <Badge variant="outline" className="text-xs capitalize">
                        {(r.income_character as string).replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-5 py-2.5 text-right font-bold text-green-700">
                      {fmtZAR(Number(r.amount))}
                    </td>
                    <td className="px-5 py-2.5 text-xs text-muted-foreground">{r.notes ?? '—'}</td>
                  </tr>
                ))}
                <tr className="bg-muted/30 font-semibold text-sm">
                  <td className="px-5 py-2" colSpan={3}>Total distributed</td>
                  <td className="px-5 py-2 text-right">{fmtZAR(totalDistributed)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* ── Tax law reference box ───────────────────────────────────────────── */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800 space-y-2">
              <p>
                <strong>Section 25B — Income character:</strong> Distributions retain their character in the
                beneficiary&apos;s hands. Interest stays interest (taxable), dividends stay dividends (DWT already
                withheld, generally exempt), rental stays rental. Record the correct character in each resolution.
              </p>
              <p>
                <strong>Section 7(3) — Minor child attribution:</strong> Income distributed to a minor child of
                the founder (Marius) is attributed back to Marius and taxed at his marginal rate. This applies until
                {shone ? ` Shone turns 18 in ${shoneTurns18Year}` : ' the child turns 18'}.
                From that year, Shone&apos;s distributions are taxed in her own hands — she can receive up
                to {fmtZAR(taxThreshold)} tax-free (2026/27 threshold), making distributions highly efficient.
              </p>
              <p>
                <strong>Estate duty on life insurance:</strong> Policies where Marius is the owner (trust merely
                named as beneficiary) are included in his estate. To exclude them, the policies must be <em>ceded</em> to
                the trust — the trust becomes the owner and ideally pays the premiums.
                Contact Tanja Van Holdt to arrange cession.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
