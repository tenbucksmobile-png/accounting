// SA tax calculation utilities

export interface TaxBracket {
  from: number; to: number; base_tax: number; rate: number;
}

export interface TaxRateRow {
  tax_year: number;
  entity_type: string;
  flat_rate: number | null;
  brackets: TaxBracket[] | null;
  primary_rebate: number;
  secondary_rebate: number;
  tertiary_rebate: number;
  tax_threshold: number;
  cgt_inclusion_rate: number;
  cgt_annual_exclusion: number;
  donations_annual_exemption: number;
  donations_rate: number;
}

/** Calculate individual income tax before rebates */
export function calcIndividualTax(taxableIncome: number, brackets: TaxBracket[]): number {
  if (taxableIncome <= 0) return 0;
  for (const b of [...brackets].reverse()) {
    if (taxableIncome > b.from - 1) {
      return b.base_tax + (taxableIncome - (b.from - 1)) * b.rate;
    }
  }
  return 0;
}

/** Calculate effective tax rate */
export function effectiveRate(tax: number, income: number): number {
  if (income <= 0) return 0;
  return tax / income;
}

/** Marginal rate for a given income level */
export function marginalRate(income: number, brackets: TaxBracket[]): number {
  for (const b of [...brackets].reverse()) {
    if (income >= b.from) return b.rate;
  }
  return brackets[0]?.rate ?? 0;
}

/** Tax year label: 2027 → "2026/27" */
export function taxYearLabel(year: number): string {
  return `${year - 1}/${String(year).slice(2)}`;
}

/** Date range for a tax year */
export function taxYearRange(year: number): { start: string; end: string } {
  return {
    start: `${year - 1}-03-01`,
    end:   `${year}-02-28`,
  };
}

/** Current SA tax year */
export function currentTaxYear(): number {
  const now = new Date();
  // If month >= March (2), we're in the next tax year
  return now.getMonth() >= 2 ? now.getFullYear() + 1 : now.getFullYear();
}

/** Format ZAR */
export function fmtZAR(n: number, decimals = 0): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency', currency: 'ZAR',
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(n);
}

/** Format percentage */
export function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/** CGT calculation */
export function calcCGT(gain: number, rate: TaxRateRow, entityTaxRate: number): number {
  if (gain <= 0) return 0;
  const netGain = Math.max(0, gain - rate.cgt_annual_exclusion);
  return netGain * rate.cgt_inclusion_rate * entityTaxRate;
}

/** Annualise a partial-year amount */
export function annualise(amount: number, daysElapsed: number, daysInYear = 365): number {
  if (daysElapsed <= 0) return amount;
  return (amount / daysElapsed) * daysInYear;
}
