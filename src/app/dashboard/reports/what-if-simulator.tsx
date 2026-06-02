'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator } from 'lucide-react';
import { calcIndividualTax, fmtZAR, fmtPct, type TaxBracket } from '@/lib/tax';

interface Props {
  coRate: number;
  indBrackets: TaxBracket[];
  primaryRebate: number;
  currentPersonalIncome: number;
  currentCompanyTaxableIncome: number;
  taxYear: number;
}

export function WhatIfSimulator({
  coRate, indBrackets, primaryRebate,
  currentPersonalIncome, currentCompanyTaxableIncome, taxYear,
}: Props) {
  const [fizzogRevenue, setFizzogRevenue] = useState('500000');
  const [fizzogExpenses, setFizzogExpenses] = useState('100000');
  const [salaryFromCompany, setSalaryFromCompany] = useState('0');
  const [dividendFromCompany, setDividendFromCompany] = useState('0');

  const rev = parseFloat(fizzogRevenue) || 0;
  const exp = parseFloat(fizzogExpenses) || 0;
  const salary = parseFloat(salaryFromCompany) || 0;
  const dividend = parseFloat(dividendFromCompany) || 0;

  // Company scenario
  const projectedCompanyTaxable = Math.max(0, currentCompanyTaxableIncome + rev - exp - salary);
  const projectedCompanyCIT = projectedCompanyTaxable * coRate;
  const additionalCompanyCIT = projectedCompanyCIT - (currentCompanyTaxableIncome * coRate);

  // DWT on dividends
  const dwt = dividend * 0.20;
  const dividendNet = dividend - dwt;

  // Personal scenario (adding salary + net dividend)
  const personalWithExtras = currentPersonalIncome + salary + dividendNet;
  const personalTaxNew = Math.max(0, calcIndividualTax(personalWithExtras, indBrackets) - primaryRebate);
  const personalTaxBase = Math.max(0, calcIndividualTax(currentPersonalIncome, indBrackets) - primaryRebate);
  const additionalPersonalTax = personalTaxNew - personalTaxBase;

  // Total additional tax
  const totalAdditionalTax = additionalCompanyCIT + additionalPersonalTax + dwt;
  const netRetainedInCompany = Math.max(0, rev - exp - projectedCompanyCIT);
  const effectiveTaxOnRevenue = rev > 0 ? totalAdditionalTax / rev : 0;

  // Comparison: retain vs distribute as salary
  const ifAllSalary = rev - exp;
  const personalTaxOnSalary = Math.max(0, calcIndividualTax(currentPersonalIncome + ifAllSalary, indBrackets) - primaryRebate) - personalTaxBase;
  const netIfSalary = ifAllSalary - personalTaxOnSalary;
  const netIfRetained = netRetainedInCompany;

  return (
    <Card className="mb-6 border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">What-If Tax Simulator — Tax Year {taxYear - 1}/{String(taxYear).slice(2)}</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Project the tax impact of Fizzog revenue and different extraction strategies.
        </p>
      </CardHeader>
      <CardContent>
        {/* Inputs */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company inputs</p>
            <div>
              <Label className="text-xs">Fizzog projected revenue (ZAR)</Label>
              <Input type="number" value={fizzogRevenue} onChange={e => setFizzogRevenue(e.target.value)}
                className="mt-1" placeholder="500000" />
            </div>
            <div>
              <Label className="text-xs">Fizzog projected expenses (ZAR)</Label>
              <Input type="number" value={fizzogExpenses} onChange={e => setFizzogExpenses(e.target.value)}
                className="mt-1" placeholder="100000" />
            </div>
          </div>
          <div className="space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Extraction strategy</p>
            <div>
              <Label className="text-xs">Salary from company to Marius (ZAR)</Label>
              <Input type="number" value={salaryFromCompany} onChange={e => setSalaryFromCompany(e.target.value)}
                className="mt-1" placeholder="0" />
              <p className="text-xs text-muted-foreground mt-1">Deductible in company, taxable to you</p>
            </div>
            <div>
              <Label className="text-xs">Dividend from company to trust (ZAR)</Label>
              <Input type="number" value={dividendFromCompany} onChange={e => setDividendFromCompany(e.target.value)}
                className="mt-1" placeholder="0" />
              <p className="text-xs text-muted-foreground mt-1">DWT 20% applies before trust receives</p>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="grid grid-cols-2 gap-6">
          {/* Company tax impact */}
          <div className="rounded-lg border p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Company tax impact</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fizzog profit (rev – exp)</span>
                <span className="font-medium">{fmtZAR(rev - exp)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Less: salary paid out</span>
                <span className="text-red-600">({fmtZAR(salary)})</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Taxable income</span>
                <span className="font-semibold">{fmtZAR(projectedCompanyTaxable)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CIT @ {(coRate * 100).toFixed(0)}%</span>
                <span className="font-bold text-amber-700">{fmtZAR(projectedCompanyCIT)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Net retained in company</span>
                <span className="font-bold text-green-700">{fmtZAR(netRetainedInCompany)}</span>
              </div>
            </div>
          </div>

          {/* Personal tax impact */}
          <div className="rounded-lg border p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Personal tax impact</p>
            <div className="space-y-2 text-sm">
              {salary > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Additional salary tax</span>
                  <span className="font-medium text-amber-700">+{fmtZAR(additionalPersonalTax)}</span>
                </div>
              )}
              {dividend > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">DWT on dividend (20%)</span>
                    <span className="font-medium text-amber-700">+{fmtZAR(dwt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Net dividend to trust</span>
                    <span className="text-green-700">{fmtZAR(dividendNet)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t pt-2 font-bold">
                <span>Total additional tax</span>
                <span className="text-amber-700">{fmtZAR(totalAdditionalTax)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Effective rate on revenue</span>
                <span className="font-semibold">{fmtPct(effectiveTaxOnRevenue)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Strategy comparison */}
        <div className="mt-5 rounded-lg bg-slate-50 border p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Strategy comparison — on Fizzog profit of {fmtZAR(rev - exp)}</p>
          <div className="grid grid-cols-2 gap-4">
            <div className={`rounded-lg p-3 border-2 ${netIfRetained >= netIfSalary ? 'border-green-400 bg-green-50' : 'border-muted'}`}>
              <p className="text-xs font-semibold mb-1">
                Retain in company @ 27% CIT
                {netIfRetained >= netIfSalary && <span className="ml-1 text-green-700">← better</span>}
              </p>
              <p className="text-lg font-bold text-green-700">{fmtZAR(netIfRetained)}</p>
              <p className="text-xs text-muted-foreground">net after {(coRate * 100).toFixed(0)}% CIT</p>
            </div>
            <div className={`rounded-lg p-3 border-2 ${netIfSalary > netIfRetained ? 'border-green-400 bg-green-50' : 'border-muted'}`}>
              <p className="text-xs font-semibold mb-1">
                Take as salary (39% marginal)
                {netIfSalary > netIfRetained && <span className="ml-1 text-green-700">← better</span>}
              </p>
              <p className="text-lg font-bold text-green-700">{fmtZAR(netIfSalary)}</p>
              <p className="text-xs text-muted-foreground">net after income tax</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            <strong>Rule of thumb:</strong> Retain in company when marginal personal rate ({'>'} {(coRate * 100).toFixed(0)}%) exceeds CIT.
            At Marius's {fmtPct(0.39)} marginal rate, retaining saves {fmtPct(0.39 - coRate)} per rand earned.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
