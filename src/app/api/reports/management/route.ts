import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  buildIncomeStatement, buildBalanceSheet, buildCashFlow,
  zar,
  type IncomeStatement, type BalanceSheet, type CashFlow, type LineItem,
} from '@/lib/management-reports';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' });
}
function fmtShort(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
}
function paren(n: number) {
  if (n < 0) return `(${zar(Math.abs(n))})`;
  return zar(n);
}

const CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; color:#1a1a1a; background:#fff; }
  .page { max-width:800px; margin:0 auto; padding:52px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:36px; padding-bottom:20px; border-bottom:3px solid #1a1a1a; }
  .company-name { font-size:18px; font-weight:700; }
  .company-sub { font-size:11px; color:#666; margin-top:4px; }
  .doc-label { text-align:right; }
  .doc-label h1 { font-size:16px; font-weight:700; text-transform:uppercase; letter-spacing:1px; }
  .doc-label .period { font-size:17px; font-weight:700; margin-top:4px; }
  .doc-label .ref { font-size:11px; color:#888; margin-top:4px; }
  .badge { display:inline-block; background:#dcfce7; color:#166534; border:1px solid #86efac; border-radius:4px; font-size:10px; font-weight:700; padding:2px 8px; margin-left:8px; vertical-align:middle; text-transform:uppercase; }
  .section { margin-bottom:28px; }
  .section-title { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#888; margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid #e8e8e8; }
  table { width:100%; border-collapse:collapse; }
  table th { font-size:11px; font-weight:600; color:#888; text-align:left; padding:6px 10px; border-bottom:1px solid #e8e8e8; }
  table td { padding:7px 10px; border-bottom:1px solid #f0f0f0; font-size:13px; }
  table td.num { text-align:right; font-variant-numeric:tabular-nums; }
  table td.indent { padding-left:24px; }
  .group-header td { font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:.8px; color:#555; background:#f8f8f8; padding:9px 10px 6px; border-bottom:1px solid #e8e8e8; }
  .subtotal-row td { font-weight:600; border-top:1px solid #ccc; background:#f9f9f9; }
  .total-row td { font-weight:700; border-top:2px solid #1a1a1a; border-bottom:none; padding-top:10px; font-size:14px; }
  .double-line td { border-top:3px double #1a1a1a; border-bottom:none; font-weight:700; font-size:14px; padding-top:10px; }
  .profit { color:#166534; }
  .loss { color:#991b1b; }
  .sig-section { margin-top:48px; display:grid; grid-template-columns:1fr 1fr; gap:40px; }
  .sig-block { padding-top:32px; border-top:1px solid #1a1a1a; }
  .sig-label { font-size:11px; color:#888; }
  .sig-name { font-size:12px; margin-top:4px; }
  .ifrs-note { margin-top:32px; padding:12px 16px; background:#f8fafc; border-left:3px solid #94a3b8; font-size:11px; color:#64748b; line-height:1.6; }
  .nil { color:#bbb; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } .page { padding:36px; max-width:100%; } }
`;

function htmlShell(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>${CSS}</style>
</head>
<body><div class="page">${body}</div></body>
</html>`;
}

function header(entityName: string, docTitle: string, period: string, ref: string) {
  return `
  <div class="header">
    <div>
      <div class="company-name">${entityName}</div>
      <div class="company-sub">Management Accounts — Internal Use Only</div>
    </div>
    <div class="doc-label">
      <h1>${docTitle} <span class="badge">IFRS</span></h1>
      <div class="period">${period}</div>
      <div class="ref">${ref}</div>
    </div>
  </div>`;
}

function sigBlock() {
  return `
  <div class="sig-section">
    <div class="sig-block">
      <div class="sig-label">Prepared by</div>
      <div class="sig-name">Marius Bonthuys</div>
      <div class="sig-label" style="margin-top:4px;">Date: _______________</div>
    </div>
    <div class="sig-block">
      <div class="sig-label">Reviewed &amp; Approved</div>
      <div class="sig-name">___________________________</div>
      <div class="sig-label" style="margin-top:4px;">Date: _______________</div>
    </div>
  </div>`;
}

function lineRows(items: LineItem[], cls = 'indent') {
  if (!items.length) return `<tr><td class="${cls} nil" colspan="2">—</td></tr>`;
  return items.map(l => `
    <tr>
      <td class="${cls}">${l.name}</td>
      <td class="num">${l.amount === 0 ? '<span class="nil">—</span>' : paren(l.amount < 0 ? l.amount : -l.amount)}</td>
    </tr>`).join('');
}

// ── Income Statement HTML ──────────────────────────────────────────────────

function renderIncomeStatement(is: IncomeStatement): string {
  const { entity, period, operatingIncome, otherIncome,
    adminExpenses, propertyExpenses, financeExpenses, nonCashExpenses, taxExpenses,
    totalRevenue, ebit, financeNet, profitBeforeTax, taxCharge, netProfit } = is;

  const periodLabel = `${fmtShort(period.from)} – ${fmtShort(period.to)}`;
  const ref = `Period ${fmtDate(period.from)} to ${fmtDate(period.to)}`;

  const allOtherExp = [...adminExpenses, ...propertyExpenses, ...nonCashExpenses];

  const profitClass = netProfit >= 0 ? 'profit' : 'loss';

  const body = `
  ${header(entity.name, 'Income Statement', periodLabel, ref)}

  <div class="section">
    <div class="section-title">Statement of Comprehensive Income (IAS 1)</div>
    <table>
      <thead><tr><th>Description</th><th style="text-align:right">ZAR</th></tr></thead>
      <tbody>
        <tr class="group-header"><td colspan="2">Revenue</td></tr>
        ${operatingIncome.map(l => `<tr><td class="indent">${l.name}</td><td class="num">${zar(l.amount)}</td></tr>`).join('')}
        ${otherIncome.map(l => `<tr><td class="indent">${l.name}</td><td class="num">${zar(l.amount)}</td></tr>`).join('')}
        <tr class="subtotal-row"><td>Total Revenue</td><td class="num">${zar(totalRevenue)}</td></tr>

        <tr class="group-header"><td colspan="2">Operating Expenses</td></tr>
        ${allOtherExp.map(l => `<tr><td class="indent">${l.name}</td><td class="num">${paren(-l.amount)}</td></tr>`).join('') || '<tr><td class="indent nil" colspan="2">—</td></tr>'}
        ${propertyExpenses.length ? '' : ''}

        <tr class="subtotal-row"><td>Operating Profit (EBIT)</td><td class="num ${ebit >= 0 ? 'profit' : 'loss'}">${paren(ebit < 0 ? ebit : ebit)}</td></tr>

        <tr class="group-header"><td colspan="2">Finance Costs / Income</td></tr>
        ${financeExpenses.map(l => `<tr><td class="indent">${l.name}</td><td class="num">${paren(-l.amount)}</td></tr>`).join('') || '<tr><td class="indent nil" colspan="2">—</td></tr>'}

        <tr class="subtotal-row"><td>Profit Before Tax</td><td class="num ${profitBeforeTax >= 0 ? 'profit' : 'loss'}">${zar(profitBeforeTax)}</td></tr>

        <tr class="group-header"><td colspan="2">Income Tax</td></tr>
        ${taxExpenses.map(l => `<tr><td class="indent">${l.name}</td><td class="num">${paren(-l.amount)}</td></tr>`).join('') || '<tr><td class="indent nil" colspan="2">—</td></tr>'}

        <tr class="double-line">
          <td>Profit / (Loss) for the Period</td>
          <td class="num ${profitClass}">${zar(netProfit)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="ifrs-note">
    <strong>IFRS basis:</strong> Revenue recognised per IFRS 15. Expenses recognised on accrual basis per IAS 1. Finance costs presented separately per IAS 1.82. Tax charge per IAS 12.
  </div>
  ${sigBlock()}`;

  return htmlShell(`Income Statement — ${entity.name} — ${periodLabel}`, body);
}

// ── Balance Sheet HTML ─────────────────────────────────────────────────────

function renderBalanceSheet(bs: BalanceSheet): string {
  const { entity, asAt, cashAssets, currentAssets, nonCurrentAssets,
    currentLiabilities, nonCurrentLiabilities, equity,
    totalAssets, totalLiabilities, totalEquity, retainedEarningsAdj } = bs;

  const bsClass = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 ? 'profit' : 'loss';

  function bsRows(items: { code: string; name: string; balance: number }[]) {
    if (!items.length) return `<tr><td class="indent nil" colspan="2">—</td></tr>`;
    return items.map(l => `<tr><td class="indent">${l.name}</td><td class="num">${l.balance === 0 ? '<span class="nil">—</span>' : zar(l.balance)}</td></tr>`).join('');
  }

  const body = `
  ${header(entity.name, 'Balance Sheet', `As at ${fmtDate(asAt)}`, `Statement of Financial Position — ${fmtDate(asAt)}`)}

  <div class="section">
    <div class="section-title">Statement of Financial Position (IAS 1)</div>
    <table>
      <thead><tr><th>Description</th><th style="text-align:right">ZAR</th></tr></thead>
      <tbody>
        <tr class="group-header"><td colspan="2">Assets</td></tr>
        <tr class="group-header" style="background:#f0f4ff;"><td colspan="2" style="padding-left:14px;">Non-Current Assets</td></tr>
        ${bsRows(nonCurrentAssets)}

        <tr class="group-header" style="background:#f0f4ff;"><td colspan="2" style="padding-left:14px;">Current Assets</td></tr>
        ${bsRows(currentAssets)}
        ${bsRows(cashAssets)}

        <tr class="subtotal-row"><td>Total Assets</td><td class="num">${zar(totalAssets)}</td></tr>

        <tr class="group-header"><td colspan="2">Liabilities</td></tr>
        <tr class="group-header" style="background:#fff0f0;"><td colspan="2" style="padding-left:14px;">Non-Current Liabilities</td></tr>
        ${bsRows(nonCurrentLiabilities)}

        <tr class="group-header" style="background:#fff0f0;"><td colspan="2" style="padding-left:14px;">Current Liabilities</td></tr>
        ${bsRows(currentLiabilities)}

        <tr class="subtotal-row"><td>Total Liabilities</td><td class="num">${zar(totalLiabilities)}</td></tr>

        <tr class="group-header"><td colspan="2">Equity</td></tr>
        ${bsRows(equity)}
        ${retainedEarningsAdj !== 0 ? `<tr><td class="indent">Current Period Earnings</td><td class="num ${retainedEarningsAdj >= 0 ? 'profit' : 'loss'}">${zar(retainedEarningsAdj)}</td></tr>` : ''}

        <tr class="subtotal-row"><td>Total Equity</td><td class="num">${zar(totalEquity)}</td></tr>

        <tr class="double-line">
          <td>Total Liabilities + Equity</td>
          <td class="num ${bsClass}">${zar(totalLiabilities + totalEquity)}</td>
        </tr>
      </tbody>
    </table>
    ${Math.abs(totalAssets - (totalLiabilities + totalEquity)) >= 0.01
      ? `<p style="color:#991b1b;font-size:11px;margin-top:8px;">⚠ Balance sheet does not balance — check for unposted closing entries.</p>`
      : `<p style="color:#166534;font-size:11px;margin-top:8px;">✓ Balance sheet balances.</p>`}
  </div>

  <div class="ifrs-note">
    <strong>IFRS basis:</strong> Assets and liabilities classified per IAS 1 liquidity basis. Equity includes current period earnings not yet closed to retained earnings.
  </div>
  ${sigBlock()}`;

  return htmlShell(`Balance Sheet — ${entity.name} — ${fmtDate(asAt)}`, body);
}

// ── Cash Flow HTML ─────────────────────────────────────────────────────────

function renderCashFlow(cf: CashFlow): string {
  const { entity, period, netProfit, nonCashAdjustments, workingCapitalChanges,
    operatingCashFlow, investingItems, investingCashFlow,
    financingItems, financingCashFlow, netMovement, openingCash, closingCash } = cf;

  const periodLabel = `${fmtShort(period.from)} – ${fmtShort(period.to)}`;
  const body = `
  ${header(entity.name, 'Cash Flow Statement', periodLabel, `Period ${fmtDate(period.from)} to ${fmtDate(period.to)}`)}

  <div class="section">
    <div class="section-title">Statement of Cash Flows — Indirect Method (IAS 7)</div>
    <table>
      <thead><tr><th>Description</th><th style="text-align:right">ZAR</th></tr></thead>
      <tbody>
        <tr class="group-header"><td colspan="2">Operating Activities</td></tr>
        <tr><td class="indent">Profit / (Loss) for the period</td><td class="num ${netProfit >= 0 ? 'profit' : 'loss'}">${zar(netProfit)}</td></tr>

        ${nonCashAdjustments.length ? `<tr><td class="indent" style="color:#555;font-size:12px;">Adjustments for non-cash items:</td><td></td></tr>` : ''}
        ${nonCashAdjustments.map(l => `<tr><td class="indent" style="padding-left:36px;">${l.name}</td><td class="num">${zar(l.amount)}</td></tr>`).join('')}

        ${workingCapitalChanges.length ? `<tr><td class="indent" style="color:#555;font-size:12px;">Working capital changes:</td><td></td></tr>` : ''}
        ${workingCapitalChanges.map(l => `<tr><td class="indent" style="padding-left:36px;">${l.name}</td><td class="num">${paren(l.amount < 0 ? l.amount : l.amount)}</td></tr>`).join('')}

        <tr class="subtotal-row"><td>Net Cash from Operating Activities</td><td class="num ${operatingCashFlow >= 0 ? 'profit' : 'loss'}">${zar(operatingCashFlow)}</td></tr>

        <tr class="group-header"><td colspan="2">Investing Activities</td></tr>
        ${investingItems.length
          ? investingItems.map(l => `<tr><td class="indent">${l.name}</td><td class="num">${paren(l.amount < 0 ? l.amount : l.amount)}</td></tr>`).join('')
          : `<tr><td class="indent nil" colspan="2">—</td></tr>`}
        <tr class="subtotal-row"><td>Net Cash from Investing Activities</td><td class="num ${investingCashFlow >= 0 ? 'profit' : 'loss'}">${zar(investingCashFlow)}</td></tr>

        <tr class="group-header"><td colspan="2">Financing Activities</td></tr>
        ${financingItems.length
          ? financingItems.map(l => `<tr><td class="indent">${l.name}</td><td class="num">${paren(l.amount < 0 ? l.amount : l.amount)}</td></tr>`).join('')
          : `<tr><td class="indent nil" colspan="2">—</td></tr>`}
        <tr class="subtotal-row"><td>Net Cash from Financing Activities</td><td class="num ${financingCashFlow >= 0 ? 'profit' : 'loss'}">${zar(financingCashFlow)}</td></tr>

        <tr><td style="padding-top:14px;font-weight:600;">Net Increase / (Decrease) in Cash</td><td class="num ${netMovement >= 0 ? 'profit' : 'loss'}" style="padding-top:14px;">${zar(netMovement)}</td></tr>
        <tr><td class="indent">Opening Cash Balance</td><td class="num">${zar(openingCash)}</td></tr>
        <tr class="double-line"><td>Closing Cash Balance</td><td class="num ${closingCash >= 0 ? 'profit' : 'loss'}">${zar(closingCash)}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="ifrs-note">
    <strong>IFRS basis:</strong> Cash flows classified per IAS 7 using indirect method. Operating activities derived from profit adjusted for non-cash charges and working capital movements. Finance costs paid classified as operating (IAS 7.33).
  </div>
  ${sigBlock()}`;

  return htmlShell(`Cash Flow — ${entity.name} — ${periodLabel}`, body);
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type     = searchParams.get('type') ?? 'income';
  const entityId = searchParams.get('entity') ?? '';
  const from     = searchParams.get('from') ?? '';
  const to       = searchParams.get('to') ?? '';

  if (!entityId || !from || !to) {
    return NextResponse.json({ error: 'Missing entity, from, or to params' }, { status: 400 });
  }

  const supabase = await createClient();
  let html = '';

  if (type === 'income') {
    const data = await buildIncomeStatement(supabase, entityId, from, to);
    html = renderIncomeStatement(data);
  } else if (type === 'balance') {
    const data = await buildBalanceSheet(supabase, entityId, to, from);
    html = renderBalanceSheet(data);
  } else if (type === 'cashflow') {
    const data = await buildCashFlow(supabase, entityId, from, to);
    html = renderCashFlow(data);
  } else {
    return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
  }

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
