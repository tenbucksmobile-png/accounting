import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Info, ShieldCheck, TrendingDown } from 'lucide-react';
import { AddPaymentButton } from './add-payment-button';
import { AddLoanButton } from './add-loan-button';

const ANNUAL_EXEMPTION = 100_000;

function fmt(n: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 2 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildWriteDownPlan(totalPrincipal: number, rate: number, years = 5) {
  const rows: {
    year: number; opening: number; s7cDeemedDonation: number;
    exemptionUsed: number; writeOffAvailable: number; principalWrittenOff: number;
    closing: number; donationsTax: number;
  }[] = [];

  let balance = totalPrincipal;
  for (let y = 1; y <= years; y++) {
    if (balance <= 0) break;
    const s7c = balance * (rate / 100);
    const exemptionUsed = Math.min(s7c, ANNUAL_EXEMPTION);
    const remaining = ANNUAL_EXEMPTION - exemptionUsed;
    const writeOff = Math.min(balance, remaining);
    const donationsTax = Math.max(0, s7c - ANNUAL_EXEMPTION) * 0.2;
    const closing = Math.max(0, balance - writeOff);
    rows.push({
      year: y, opening: balance, s7cDeemedDonation: s7c,
      exemptionUsed, writeOffAvailable: remaining, principalWrittenOff: writeOff,
      closing, donationsTax,
    });
    balance = closing;
  }
  return rows;
}

export default async function LoansPage() {
  const supabase = await createClient();

  const [{ data: loans }, { data: payments }, { data: rates }, { data: entities }] = await Promise.all([
    supabase.from('section7c_loans').select('*, borrower:borrower_entity_id(id, name)').order('loan_date'),
    supabase.from('section7c_payments').select('*').order('payment_date'),
    supabase.from('official_rates').select('*').order('effective_date', { ascending: false }),
    supabase.from('entities').select('id, name').eq('is_active', true),
  ]);

  const currentRate = rates?.[0]?.rate ?? 9.25;
  const today = new Date();
  const currentTaxYear = today.getMonth() >= 1 ? today.getFullYear() + 1 : today.getFullYear();
  const taxYearStart = new Date(`${currentTaxYear - 1}-03-01`);
  const daysInYear = 365;

  const loanData = (loans ?? []).map((loan) => {
    const loanStart = new Date(loan.loan_date);
    const effectiveStart = loanStart > taxYearStart ? loanStart : taxYearStart;
    const daysElapsed = Math.max(0, Math.floor((today.getTime() - effectiveStart.getTime()) / 86400000));
    const daysToYearEnd = Math.max(0, Math.floor((new Date(`${currentTaxYear}-02-28`).getTime() - today.getTime()) / 86400000));

    const interestDueToDate = (Number(loan.principal_amount) * (currentRate / 100) * daysElapsed) / daysInYear;
    const totalInterestForYear = (Number(loan.principal_amount) * (currentRate / 100) * (daysElapsed + daysToYearEnd)) / daysInYear;

    const yearPayments = (payments ?? []).filter(
      (p) => p.loan_id === loan.id && p.tax_year === currentTaxYear,
    );
    const totalPaid = yearPayments.reduce((s, p) => s + Number(p.amount), 0);
    const projectedShortfall = Math.max(0, totalInterestForYear - totalPaid);
    const amountToPayNow = projectedShortfall;

    return {
      loan, daysElapsed, interestDueToDate, totalInterestForYear,
      totalPaid, projectedShortfall, amountToPayNow, yearPayments,
    };
  });

  // ── Annual exemption calculations (aggregate across all loans) ──────────────
  const totalProjectedShortfall = loanData.reduce((s, d) => s + d.projectedShortfall, 0);
  const totalPrincipal = (loans ?? []).filter(l => l.is_active).reduce((s, l) => s + Number(l.principal_amount), 0);

  const exemptionConsumedByS7C = Math.min(totalProjectedShortfall, ANNUAL_EXEMPTION);
  const remainingExemption = ANNUAL_EXEMPTION - exemptionConsumedByS7C;
  const writeOffAvailableThisYear = remainingExemption;
  const donationsTaxActuallyPayable = Math.max(0, totalProjectedShortfall - ANNUAL_EXEMPTION) * 0.2;
  const exemptionPct = Math.min(100, Math.round((exemptionConsumedByS7C / ANNUAL_EXEMPTION) * 100));
  const fullyProtected = donationsTaxActuallyPayable === 0;

  const writeDownPlan = buildWriteDownPlan(totalPrincipal, currentRate);
  const yearsToEliminate = writeDownPlan.length;

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Section 7C — Loan Tracker</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Natural person loans to trust-connected entities. Official rate: <strong>{currentRate}%</strong> p.a.
            &nbsp;·&nbsp; Tax year {currentTaxYear - 1}/{currentTaxYear} (1 Mar – 28 Feb)
          </p>
        </div>
        <AddLoanButton entities={entities ?? []} currentRate={currentRate} />
      </div>

      {/* Info box */}
      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800 space-y-1">
              <p><strong>Section 7C rule:</strong> Loans to a trust-connected company below the SARS official rate generate a <strong>deemed donation</strong> equal to the interest shortfall, assessed on <strong>28 February</strong> each year.</p>
              <p><strong>Annual exemption (Section 56(2)(b)):</strong> The first <strong>R100,000</strong> of donations per tax year is exempt from donations tax. S7C shortfalls count against this exemption first — any remaining exemption can be used to write off loan principal, also tax-free.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Annual Exemption Tracker ─────────────────────────────────────────── */}
      <Card className={`mb-6 ${fullyProtected ? 'border-green-300' : 'border-red-300'}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`h-5 w-5 ${fullyProtected ? 'text-green-600' : 'text-red-600'}`} />
            <CardTitle className="text-base">
              Annual Donations Tax Exemption — Tax Year {currentTaxYear}
            </CardTitle>
            <Badge variant={fullyProtected ? 'default' : 'destructive'} className="ml-auto">
              {fullyProtected ? 'Fully Protected' : 'Exemption Exceeded'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Three stat boxes */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Total exemption (S56)</p>
              <p className="text-xl font-bold">{fmt(ANNUAL_EXEMPTION)}</p>
              <p className="text-xs text-muted-foreground mt-1">Per tax year, per person</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Consumed by S7C shortfall</p>
              <p className="text-xl font-bold text-amber-700">{fmt(exemptionConsumedByS7C)}</p>
              <p className="text-xs text-muted-foreground mt-1">Interest not paid</p>
            </div>
            <div className={`rounded-lg p-3 ${fullyProtected ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="text-xs text-muted-foreground mb-1">Remaining exemption</p>
              <p className={`text-xl font-bold ${fullyProtected ? 'text-green-700' : 'text-red-700'}`}>
                {fmt(remainingExemption)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Available for write-offs</p>
            </div>
          </div>

          {/* Exemption bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Exemption used: {fmt(exemptionConsumedByS7C)} of {fmt(ANNUAL_EXEMPTION)}</span>
              <span>{exemptionPct}%</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden flex">
              <div
                className="h-full bg-amber-400 transition-all"
                style={{ width: `${exemptionPct}%` }}
                title={`S7C shortfall: ${fmt(exemptionConsumedByS7C)}`}
              />
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-amber-600">S7C interest shortfall</span>
              <span className={fullyProtected ? 'text-green-600' : 'text-red-600'}>
                {fullyProtected
                  ? `${fmt(remainingExemption)} available for principal write-off`
                  : `${fmt(Math.abs(remainingExemption))} over limit — donations tax: ${fmt(donationsTaxActuallyPayable)}`}
              </span>
            </div>
          </div>

          {/* Write-off opportunity */}
          {fullyProtected && writeOffAvailableThisYear > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
              <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Zero donations tax this year — and you have {fmt(writeOffAvailableThisYear)} of exemption left.</p>
                <p className="mt-0.5">You can formally write off up to <strong>{fmt(writeOffAvailableThisYear)}</strong> of the loan principal before 28 Feb {currentTaxYear} with no donations tax. This reduces the principal (and future S7C obligations) without any cost. Instruct your attorney to document the write-off as a donation to the trust.</p>
              </div>
            </div>
          )}

          {!fullyProtected && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>Total S7C shortfall exceeds the R100,000 exemption. Donations tax of <strong>{fmt(donationsTaxActuallyPayable)}</strong> is payable. Pay enough interest before 28 Feb {currentTaxYear} to bring the shortfall within R100,000, or accept the donations tax liability.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 5-Year Write-Down Plan ───────────────────────────────────────────── */}
      {writeDownPlan.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">
                {yearsToEliminate}-Year Loan Write-Down Plan (Zero Donations Tax)
              </CardTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              If the company never pays interest — use the annual exemption to absorb the S7C shortfall each year,
              then write off the remaining exemption as a donation to the trust. Eliminates the loan in {yearsToEliminate} years
              at <strong>R0 in donations tax</strong>. Preserves the loan account as tax-free drawable capital
              until you choose to write it off.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">Year</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Opening Balance</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">S7C Deemed Donation</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Principal Write-Off Available</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Closing Balance</th>
                  <th className="px-5 py-3 text-right font-medium text-muted-foreground">Donations Tax</th>
                </tr>
              </thead>
              <tbody>
                {writeDownPlan.map((row) => (
                  <tr key={row.year} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-5 py-3 font-medium">
                      Year {row.year}
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({currentTaxYear - 1 + row.year - 1}/{currentTaxYear + row.year - 1})
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">{fmt(row.opening)}</td>
                    <td className="px-5 py-3 text-right text-amber-600">{fmt(row.s7cDeemedDonation)}</td>
                    <td className="px-5 py-3 text-right text-green-600">{fmt(row.writeOffAvailable)}</td>
                    <td className="px-5 py-3 text-right font-semibold">
                      {row.closing === 0
                        ? <span className="text-green-600">R0 — Eliminated</span>
                        : fmt(row.closing)
                      }
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-green-600">
                      {row.donationsTax === 0 ? 'R0' : fmt(row.donationsTax)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/30 font-semibold">
                  <td className="px-5 py-3" colSpan={4}>Total donations tax over {yearsToEliminate} years</td>
                  <td className="px-5 py-3 text-right text-green-600 font-bold" colSpan={2}>
                    {fmt(writeDownPlan.reduce((s, r) => s + r.donationsTax, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {loanData.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No Section 7C loans recorded. Add a loan above.
          </CardContent>
        </Card>
      )}

      {/* ── Individual Loan Cards ────────────────────────────────────────────── */}
      {loanData.map(({ loan, daysElapsed, totalInterestForYear, totalPaid, projectedShortfall, amountToPayNow, yearPayments }) => {
        // Per-loan: proportional share of whether it's covered by exemption
        const coveredByExemption = projectedShortfall <= ANNUAL_EXEMPTION;
        return (
          <Card key={loan.id} className={`mb-6 ${coveredByExemption ? 'border-green-300' : 'border-amber-300'}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{loan.description}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    <strong>{loan.lender_name}</strong> → <strong>{(loan.borrower as any)?.name}</strong>
                    &nbsp;·&nbsp; Loan date: {fmtDate(loan.loan_date)}
                    &nbsp;·&nbsp; {daysElapsed} days elapsed this tax year
                  </p>
                </div>
                <Badge variant={loan.is_active ? 'default' : 'secondary'}>
                  {loan.is_active ? 'Active' : 'Settled'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 mb-5 sm:grid-cols-4">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Principal</p>
                  <p className="text-lg font-bold">{fmt(loan.principal_amount)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Annual interest @ {currentRate}%</p>
                  <p className="text-lg font-bold">{fmt(totalInterestForYear)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Paid this year</p>
                  <p className="text-lg font-bold text-green-700">{fmt(totalPaid)}</p>
                </div>
                <div className={`rounded-lg p-3 ${coveredByExemption ? 'bg-green-50' : 'bg-amber-50'}`}>
                  <p className="text-xs text-muted-foreground mb-1">Projected shortfall</p>
                  <p className={`text-lg font-bold ${coveredByExemption ? 'text-green-700' : 'text-amber-700'}`}>
                    {fmt(projectedShortfall)}
                  </p>
                </div>
              </div>

              {/* Interest paid progress */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Interest paid: {fmt(totalPaid)} of {fmt(totalInterestForYear)} due by 28 Feb {currentTaxYear}</span>
                  <span>{totalInterestForYear > 0 ? Math.min(100, Math.round((totalPaid / totalInterestForYear) * 100)) : 0}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${totalPaid >= totalInterestForYear ? 'bg-green-500' : 'bg-amber-400'}`}
                    style={{ width: `${Math.min(100, (totalPaid / Math.max(totalInterestForYear, 1)) * 100)}%` }}
                  />
                </div>
              </div>

              {projectedShortfall > 0 && coveredByExemption ? (
                <div className="flex items-start gap-2 text-sm text-green-700 mb-4 p-2 rounded-lg bg-green-50">
                  <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Shortfall of <strong>{fmt(projectedShortfall)}</strong> is within the R100,000 annual exemption —
                    no donations tax payable. See the exemption tracker above for your write-off opportunity.
                  </span>
                </div>
              ) : projectedShortfall > 0 ? (
                <div className="flex items-center gap-2 text-sm text-amber-700 mb-4">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Pay <strong className="mx-1">{fmt(amountToPayNow)}</strong> before 28 Feb {currentTaxYear} to bring within the annual exemption.
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-green-700 mb-4">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  Interest fully paid for this tax year. No Section 7C exposure.
                </div>
              )}

              {yearPayments.length > 0 && (
                <div className="border rounded-lg overflow-hidden mb-4">
                  <p className="px-4 py-2 text-xs font-semibold bg-muted/40 text-muted-foreground uppercase tracking-wide">
                    Payments — Tax Year {currentTaxYear}
                  </p>
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/20">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Date</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Amount</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearPayments.map((p) => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="px-4 py-2">{fmtDate(p.payment_date)}</td>
                          <td className="px-4 py-2 text-right font-medium text-green-700">{fmt(p.amount)}</td>
                          <td className="px-4 py-2 text-muted-foreground text-xs">{p.notes ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <AddPaymentButton loanId={loan.id} taxYear={currentTaxYear} loanDescription={loan.description} />
            </CardContent>
          </Card>
        );
      })}

      {/* Official rate history */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">SARS Official Rate History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Effective Date</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Rate p.a.</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody>
              {(rates ?? []).map((r, i) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-6 py-3">{fmtDate(r.effective_date)}</td>
                  <td className="px-6 py-3 font-bold">
                    {r.rate}%
                    {i === 0 && <Badge className="ml-2 text-xs" variant="default">Current</Badge>}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground text-xs">{r.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
