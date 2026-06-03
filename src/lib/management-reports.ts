import type { SupabaseClient } from '@supabase/supabase-js';

export interface LineItem { code: string; name: string; category: string; amount: number }

export interface IncomeStatement {
  entity: { id: string; name: string; type: string };
  period: { from: string; to: string };
  operatingIncome: LineItem[];
  otherIncome: LineItem[];
  adminExpenses: LineItem[];
  propertyExpenses: LineItem[];
  financeExpenses: LineItem[];
  nonCashExpenses: LineItem[];
  taxExpenses: LineItem[];
  otherExpenses: LineItem[];
  totalRevenue: number;
  totalExpenses: number;
  ebit: number;
  financeNet: number;
  profitBeforeTax: number;
  taxCharge: number;
  netProfit: number;
}

export interface BalanceSheetLine { code: string; name: string; category: string; balance: number }

export interface BalanceSheet {
  entity: { id: string; name: string; type: string };
  asAt: string;
  // Assets
  cashAssets: BalanceSheetLine[];
  currentAssets: BalanceSheetLine[];
  nonCurrentAssets: BalanceSheetLine[];
  // Liabilities
  currentLiabilities: BalanceSheetLine[];
  nonCurrentLiabilities: BalanceSheetLine[];
  // Equity
  equity: BalanceSheetLine[];
  // Totals
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  retainedEarningsAdj: number; // net profit for period added to retained earnings
}

export interface CashFlow {
  entity: { id: string; name: string; type: string };
  period: { from: string; to: string };
  netProfit: number;
  nonCashAdjustments: LineItem[];
  workingCapitalChanges: LineItem[];
  operatingCashFlow: number;
  investingItems: LineItem[];
  investingCashFlow: number;
  financingItems: LineItem[];
  financingCashFlow: number;
  netMovement: number;
  openingCash: number;
  closingCash: number;
}

function zar(n: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 }).format(n);
}

export { zar };

// ── helpers ──────────────────────────────────────────────────────────────────

function accountBalance(
  lines: { account_id: string; debit: number; credit: number }[],
  accountId: string,
  normalBalance: 'debit' | 'credit',
): number {
  let dr = 0, cr = 0;
  for (const l of lines) {
    if (l.account_id !== accountId) continue;
    dr += Number(l.debit);
    cr += Number(l.credit);
  }
  return normalBalance === 'debit' ? dr - cr : cr - dr;
}

// Income/expense: positive net activity for the period
// Income accs: credit = revenue (positive), debit = contra (negative)
// Expense accs: debit = cost (positive), credit = reversal (negative)
function periodNetActivity(
  lines: { account_id: string; debit: number; credit: number }[],
  accountId: string,
  normalBalance: 'debit' | 'credit',
): number {
  return accountBalance(lines, accountId, normalBalance);
}

// ── Income Statement ─────────────────────────────────────────────────────────

export async function buildIncomeStatement(
  supabase: SupabaseClient,
  entityId: string,
  from: string,
  to: string,
): Promise<IncomeStatement> {
  const [
    { data: entityRow },
    { data: accounts },
    { data: entries },
    { data: lines },
  ] = await Promise.all([
    supabase.from('entities').select('id,name,type').eq('id', entityId).single(),
    supabase.from('accounts').select('id,code,name,type,category,normal_balance').eq('entity_id', entityId).eq('is_active', true),
    supabase.from('journal_entries').select('id').eq('entity_id', entityId).gte('entry_date', from).lte('entry_date', to),
    supabase.from('journal_lines').select('entry_id,account_id,debit,credit'),
  ]);

  const entryIds = new Set((entries ?? []).map((e: any) => e.id));
  const periodLines = (lines ?? []).filter((l: any) => entryIds.has(l.entry_id));

  const incomeAccs = (accounts ?? []).filter((a: any) => a.type === 'income');
  const expenseAccs = (accounts ?? []).filter((a: any) => a.type === 'expense');

  function toLineItem(a: any): LineItem {
    return {
      code: a.code,
      name: a.name,
      category: a.category ?? '',
      amount: periodNetActivity(periodLines, a.id, a.normal_balance),
    };
  }

  // Income grouped
  const operatingIncome = incomeAccs.filter((a: any) => a.category === 'Operating Income').map(toLineItem).filter(l => l.amount !== 0);
  const otherIncome     = incomeAccs.filter((a: any) => a.category !== 'Operating Income').map(toLineItem).filter(l => l.amount !== 0);

  // Expenses grouped by category
  const adminExpenses    = expenseAccs.filter((a: any) => ['Admin', 'Professional'].includes(a.category ?? '')).map(toLineItem).filter(l => l.amount !== 0);
  const propertyExpenses = expenseAccs.filter((a: any) => a.category === 'Property').map(toLineItem).filter(l => l.amount !== 0);
  const financeExpenses  = expenseAccs.filter((a: any) => a.category === 'Finance').map(toLineItem).filter(l => l.amount !== 0);
  const nonCashExpenses  = expenseAccs.filter((a: any) => a.category === 'Non-cash').map(toLineItem).filter(l => l.amount !== 0);
  const taxExpenses      = expenseAccs.filter((a: any) => a.category === 'Tax').map(toLineItem).filter(l => l.amount !== 0);
  const otherExpenses    = expenseAccs.filter((a: any) =>
    !['Admin','Professional','Property','Finance','Non-cash','Tax','Distributions'].includes(a.category ?? '')
  ).map(toLineItem).filter(l => l.amount !== 0);

  const totalRevenue  = [...operatingIncome, ...otherIncome].reduce((s, l) => s + l.amount, 0);
  const financeNet    = financeExpenses.reduce((s, l) => s + l.amount, 0);
  const taxCharge     = taxExpenses.reduce((s, l) => s + l.amount, 0);
  const totalExpenses = [...adminExpenses, ...propertyExpenses, ...financeExpenses, ...nonCashExpenses, ...taxExpenses, ...otherExpenses].reduce((s, l) => s + l.amount, 0);
  const ebit          = totalRevenue - [...adminExpenses, ...propertyExpenses, ...nonCashExpenses, ...otherExpenses].reduce((s, l) => s + l.amount, 0);
  const profitBeforeTax = ebit - financeNet;
  const netProfit       = profitBeforeTax - taxCharge;

  return {
    entity: entityRow as any,
    period: { from, to },
    operatingIncome, otherIncome,
    adminExpenses, propertyExpenses, financeExpenses, nonCashExpenses, taxExpenses, otherExpenses,
    totalRevenue, totalExpenses, ebit, financeNet, profitBeforeTax, taxCharge, netProfit,
  };
}

// ── Balance Sheet ─────────────────────────────────────────────────────────────

export async function buildBalanceSheet(
  supabase: SupabaseClient,
  entityId: string,
  asAt: string,
  periodFrom: string, // for net profit injection into retained earnings
): Promise<BalanceSheet> {
  const [
    { data: entityRow },
    { data: accounts },
    { data: entries },
    { data: lines },
    { data: allEntries },
    { data: allLines },
  ] = await Promise.all([
    supabase.from('entities').select('id,name,type').eq('id', entityId).single(),
    supabase.from('accounts').select('id,code,name,type,category,normal_balance').eq('entity_id', entityId).eq('is_active', true),
    // period entries (for net profit)
    supabase.from('journal_entries').select('id').eq('entity_id', entityId).gte('entry_date', periodFrom).lte('entry_date', asAt),
    supabase.from('journal_lines').select('entry_id,account_id,debit,credit'),
    // all-time entries up to asAt (balance sheet is cumulative)
    supabase.from('journal_entries').select('id').eq('entity_id', entityId).lte('entry_date', asAt),
    supabase.from('journal_lines').select('entry_id,account_id,debit,credit'),
  ]);

  const allEntryIds = new Set((allEntries ?? []).map((e: any) => e.id));
  const cumulativeLines = (allLines ?? []).filter((l: any) => allEntryIds.has(l.entry_id));

  const periodEntryIds = new Set((entries ?? []).map((e: any) => e.id));
  const periodLines = (lines ?? []).filter((l: any) => periodEntryIds.has(l.entry_id));

  function toBS(a: any): BalanceSheetLine {
    return { code: a.code, name: a.name, category: a.category ?? '', balance: accountBalance(cumulativeLines, a.id, a.normal_balance) };
  }

  const assetAccs    = (accounts ?? []).filter((a: any) => a.type === 'asset');
  const liabAccs     = (accounts ?? []).filter((a: any) => a.type === 'liability');
  const equityAccs   = (accounts ?? []).filter((a: any) => a.type === 'equity');
  const incomeAccs   = (accounts ?? []).filter((a: any) => a.type === 'income');
  const expenseAccs  = (accounts ?? []).filter((a: any) => a.type === 'expense');

  const cashAssets       = assetAccs.filter((a: any) => a.category === 'Cash').map(toBS);
  const currentAssets    = assetAccs.filter((a: any) => ['Receivables','Tax Assets','Loan Accounts'].includes(a.category ?? '')).map(toBS);
  const nonCurrentAssets = assetAccs.filter((a: any) => ['Investments','Fixed Assets'].includes(a.category ?? '')).map(toBS);

  const currentLiabilities    = liabAccs.filter((a: any) => ['Payables','Tax Liabilities'].includes(a.category ?? '')).map(toBS);
  const nonCurrentLiabilities = liabAccs.filter((a: any) => !['Payables','Tax Liabilities'].includes(a.category ?? '')).map(toBS);

  const equityLines = equityAccs.map(toBS);

  // Net profit for the period — inject into equity as undistributed earnings
  const periodIncome  = incomeAccs.reduce((s, a: any) => s + periodNetActivity(periodLines, a.id, a.normal_balance), 0);
  const periodExpense = expenseAccs.reduce((s, a: any) => s + periodNetActivity(periodLines, a.id, a.normal_balance), 0);
  const retainedEarningsAdj = periodIncome - periodExpense;

  const totalAssets      = [...cashAssets, ...currentAssets, ...nonCurrentAssets].reduce((s, l) => s + l.balance, 0);
  const totalLiabilities = [...currentLiabilities, ...nonCurrentLiabilities].reduce((s, l) => s + l.balance, 0);
  const totalEquity      = equityLines.reduce((s, l) => s + l.balance, 0) + retainedEarningsAdj;

  return {
    entity: entityRow as any,
    asAt,
    cashAssets, currentAssets, nonCurrentAssets,
    currentLiabilities, nonCurrentLiabilities,
    equity: equityLines,
    totalAssets, totalLiabilities, totalEquity,
    retainedEarningsAdj,
  };
}

// ── Cash Flow Statement (Indirect Method) ────────────────────────────────────

export async function buildCashFlow(
  supabase: SupabaseClient,
  entityId: string,
  from: string,
  to: string,
): Promise<CashFlow> {
  const [
    { data: entityRow },
    { data: accounts },
    { data: entries },
    { data: lines },
    { data: priorEntries },
    { data: priorLines },
  ] = await Promise.all([
    supabase.from('entities').select('id,name,type').eq('id', entityId).single(),
    supabase.from('accounts').select('id,code,name,type,category,normal_balance').eq('entity_id', entityId).eq('is_active', true),
    supabase.from('journal_entries').select('id').eq('entity_id', entityId).gte('entry_date', from).lte('entry_date', to),
    supabase.from('journal_lines').select('entry_id,account_id,debit,credit'),
    // prior period (for opening cash balance)
    supabase.from('journal_entries').select('id').eq('entity_id', entityId).lt('entry_date', from),
    supabase.from('journal_lines').select('entry_id,account_id,debit,credit'),
  ]);

  const entryIds      = new Set((entries ?? []).map((e: any) => e.id));
  const periodLines   = (lines ?? []).filter((l: any) => entryIds.has(l.entry_id));

  const priorEntryIds  = new Set((priorEntries ?? []).map((e: any) => e.id));
  const priorPeriodLines = (priorLines ?? []).filter((l: any) => priorEntryIds.has(l.entry_id));

  const cashAccs     = (accounts ?? []).filter((a: any) => a.category === 'Cash');
  const incomeAccs   = (accounts ?? []).filter((a: any) => a.type === 'income');
  const expenseAccs  = (accounts ?? []).filter((a: any) => a.type === 'expense');

  const periodIncome  = incomeAccs.reduce((s, a: any) => s + periodNetActivity(periodLines, a.id, a.normal_balance), 0);
  const periodExpense = expenseAccs.reduce((s, a: any) => s + periodNetActivity(periodLines, a.id, a.normal_balance), 0);
  const netProfit     = periodIncome - periodExpense;

  // Non-cash adjustments (add back)
  const nonCashAccs = (accounts ?? []).filter((a: any) => a.type === 'expense' && a.category === 'Non-cash');
  const nonCashAdjustments: LineItem[] = nonCashAccs.map((a: any) => ({
    code: a.code, name: a.name, category: a.category,
    amount: periodNetActivity(periodLines, a.id, a.normal_balance),
  })).filter(l => l.amount !== 0);

  // Working capital changes: receivables and payables movements
  const receivableAccs = (accounts ?? []).filter((a: any) => a.category === 'Receivables');
  const payableAccs    = (accounts ?? []).filter((a: any) => a.category === 'Payables');

  const workingCapitalChanges: LineItem[] = [];
  for (const a of receivableAccs) {
    const mv = periodNetActivity(periodLines, (a as any).id, (a as any).normal_balance);
    if (mv !== 0) workingCapitalChanges.push({ code: (a as any).code, name: `Change in ${(a as any).name}`, category: 'working_capital', amount: -mv });
  }
  for (const a of payableAccs) {
    const mv = periodNetActivity(periodLines, (a as any).id, (a as any).normal_balance);
    if (mv !== 0) workingCapitalChanges.push({ code: (a as any).code, name: `Change in ${(a as any).name}`, category: 'working_capital', amount: mv });
  }

  const operatingCashFlow = netProfit
    + nonCashAdjustments.reduce((s, l) => s + l.amount, 0)
    + workingCapitalChanges.reduce((s, l) => s + l.amount, 0);

  // Investing: fixed asset movements (net debit = cash out)
  const fixedAssetAccs = (accounts ?? []).filter((a: any) => a.category === 'Fixed Assets' && a.type === 'asset');
  const investingItems: LineItem[] = fixedAssetAccs.map((a: any) => {
    const mv = periodNetActivity(periodLines, a.id, a.normal_balance);
    return { code: a.code, name: a.name, category: 'investing', amount: -mv };
  }).filter(l => l.amount !== 0);
  const investingCashFlow = investingItems.reduce((s, l) => s + l.amount, 0);

  // Financing: debt and shareholder loan movements
  const financingLiabAccs = (accounts ?? []).filter((a: any) => ['Debt','Shareholder Loans','Founder Loans'].includes(a.category ?? '') && a.type === 'liability');
  const financingItems: LineItem[] = financingLiabAccs.map((a: any) => {
    const mv = periodNetActivity(periodLines, a.id, a.normal_balance);
    return { code: a.code, name: a.name, category: 'financing', amount: mv };
  }).filter(l => l.amount !== 0);
  const financingCashFlow = financingItems.reduce((s, l) => s + l.amount, 0);

  const netMovement = operatingCashFlow + investingCashFlow + financingCashFlow;

  // Cash balances
  const openingCash = cashAccs.reduce((s, a: any) => s + accountBalance(priorPeriodLines, a.id, a.normal_balance), 0);
  const closingCash = openingCash + cashAccs.reduce((s, a: any) => s + periodNetActivity(periodLines, a.id, a.normal_balance), 0);

  return {
    entity: entityRow as any,
    period: { from, to },
    netProfit, nonCashAdjustments, workingCapitalChanges, operatingCashFlow,
    investingItems, investingCashFlow,
    financingItems, financingCashFlow,
    netMovement, openingCash, closingCash,
  };
}
