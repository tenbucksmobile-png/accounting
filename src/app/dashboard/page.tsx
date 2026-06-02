import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, BookOpen, AlertTriangle, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: entities }, { data: loans }, { data: rate }, { data: payments }] = await Promise.all([
    supabase.from('entities').select('*').eq('is_active', true),
    supabase.from('section7c_loans').select('*, borrower:borrower_entity_id(name)').eq('is_active', true),
    supabase.from('official_rates').select('*').order('effective_date', { ascending: false }).limit(1).single(),
    supabase.from('section7c_payments').select('*'),
  ]);

  const currentRate = rate?.rate ?? 9.25;
  const today = new Date();
  const currentTaxYear = today.getMonth() >= 1 ? today.getFullYear() + 1 : today.getFullYear();

  // Calculate Section 7C exposure across all active loans
  const loanExposures = (loans ?? []).map((loan) => {
    const loanPayments = (payments ?? []).filter(
      (p) => p.loan_id === loan.id && p.tax_year === currentTaxYear,
    );
    const totalPaid = loanPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const start = new Date(loan.loan_date);
    const yearStart = new Date(`${currentTaxYear - 1}-03-01`);
    const effectiveStart = start > yearStart ? start : yearStart;
    const daysElapsed = Math.max(0, Math.floor((today.getTime() - effectiveStart.getTime()) / 86400000));
    const interestDue = (Number(loan.principal_amount) * (currentRate / 100) * daysElapsed) / 365;
    const shortfall = Math.max(0, interestDue - totalPaid);
    const donationsTax = shortfall * 0.2;
    return { loan, interestDue, totalPaid, shortfall, donationsTax };
  });

  const totalExposure = loanExposures.reduce((s, e) => s + e.donationsTax, 0);
  const totalPrincipal = (loans ?? []).reduce((s, l) => s + Number(l.principal_amount), 0);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tax year {currentTaxYear - 1}/{currentTaxYear} &nbsp;·&nbsp; 1 Mar {currentTaxYear - 1} – 28 Feb {currentTaxYear}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Entities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{entities?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> S7C Loans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(totalPrincipal)}</p>
            <p className="text-xs text-muted-foreground mt-1">Total principal</p>
          </CardContent>
        </Card>

        <Card className={totalExposure > 0 ? 'border-amber-400' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Donations Tax Exposure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalExposure > 0 ? 'text-amber-600' : 'text-green-600'}`}>
              {fmt(totalExposure)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">If no interest paid by 28 Feb</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Official Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{currentRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">SARS S7C rate p.a.</p>
          </CardContent>
        </Card>
      </div>

      {/* Entities */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Entities</CardTitle>
          <Link href="/dashboard/entities" className="text-xs text-primary hover:underline">View all →</Link>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Tax Return</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Year End</th>
              </tr>
            </thead>
            <tbody>
              {(entities ?? []).map((e) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-6 py-3 font-medium">
                    <Link href={`/dashboard/entities/${e.id}`} className="hover:underline text-primary">
                      {e.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3">
                    <Badge variant={e.type === 'trust' ? 'secondary' : 'outline'} className="capitalize">
                      {e.type}
                    </Badge>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {e.type === 'trust' ? 'IT12T' : e.type === 'company' ? 'IT14 / IRP6' : 'ITR12'}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {new Date(2000, e.financial_year_end - 1).toLocaleString('en-ZA', { month: 'long' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Section 7C Quick Summary */}
      {loanExposures.length > 0 && (
        <Card className={totalExposure > 0 ? 'border-amber-400' : ''}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Section 7C — Interest Exposure (Tax Year {currentTaxYear})</CardTitle>
            <Link href="/dashboard/loans" className="text-xs text-primary hover:underline">Manage →</Link>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Loan</th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">Principal</th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">Interest Due</th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">Paid</th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">Shortfall</th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">Donations Tax Risk</th>
                </tr>
              </thead>
              <tbody>
                {loanExposures.map(({ loan, interestDue, totalPaid, shortfall, donationsTax }) => (
                  <tr key={loan.id} className="border-b last:border-0">
                    <td className="px-6 py-3">
                      <p className="font-medium">{loan.description}</p>
                      <p className="text-xs text-muted-foreground">{loan.lender_name} → {(loan.borrower as any)?.name}</p>
                    </td>
                    <td className="px-6 py-3 text-right">{fmt(loan.principal_amount)}</td>
                    <td className="px-6 py-3 text-right">{fmt(interestDue)}</td>
                    <td className="px-6 py-3 text-right text-green-600">{fmt(totalPaid)}</td>
                    <td className="px-6 py-3 text-right text-amber-600 font-medium">{fmt(shortfall)}</td>
                    <td className={`px-6 py-3 text-right font-bold ${donationsTax > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {fmt(donationsTax)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
