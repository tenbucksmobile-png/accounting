'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ChevronLeft, Upload, CheckCircle, AlertCircle } from 'lucide-react';

interface Account { id: string; code: string; name: string; type: string }
interface Entity { id: string; name: string }
interface CsvRow { date: string; description: string; amount: number; reference: string; accountId: string }

// Parse common SA bank CSV formats (FNB, Standard Bank, ABSA, Nedbank)
function parseCsv(text: string): { date: string; description: string; amount: number; reference: string }[] {
  const lines = text.trim().split('\n').map(l => l.replace(/\r/g, ''));
  const rows: { date: string; description: string; amount: number; reference: string }[] = [];

  for (const line of lines) {
    if (!line.trim() || line.startsWith('#')) continue;
    // Handle quoted CSV
    const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g)?.map(c => c.replace(/^"|"$/g, '').trim()) ?? line.split(',').map(c => c.trim());
    if (cols.length < 3) continue;

    // Try to detect date in first column
    const dateStr = cols[0];
    const dateMatch = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (!dateMatch) continue;

    let [, d, m, y] = dateMatch;
    if (y.length === 2) y = '20' + y;
    // Handle DD/MM/YYYY
    const date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;

    const description = cols[1] ?? '';
    const reference = cols.length > 3 ? (cols[2] ?? '') : '';
    const amountStr = cols[cols.length - 1].replace(/[R\s,]/g, '');
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) continue;

    rows.push({ date, description, amount, reference });
  }
  return rows;
}

export default function ImportPage() {
  const router = useRouter();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entityId, setEntityId] = useState('');
  const [bankAccountId, setBankAccountId] = useState(''); // the bank account to debit/credit
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    createClient().from('entities').select('id,name').eq('is_active', true).then(({ data }) => setEntities(data ?? []));
  }, []);

  useEffect(() => {
    if (!entityId) return;
    createClient().from('accounts').select('id,code,name,type').eq('entity_id', entityId).eq('is_active', true).order('code')
      .then(({ data }) => setAccounts(data ?? []));
  }, [entityId]);

  const bankAccounts = accounts.filter(a => a.name.toLowerCase().includes('bank'));

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      // Default: no account assigned — user must assign
      setRows(parsed.map(r => ({ ...r, accountId: '' })));
    };
    reader.readAsText(file);
  };

  const updateRowAccount = (i: number, accountId: string) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, accountId } : r));
  };

  const validRows = rows.filter(r => r.accountId && bankAccountId);
  const totalIn = rows.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const totalOut = rows.filter(r => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0);

  const handleImport = async () => {
    if (!validRows.length || !entityId || !bankAccountId) return;
    setImporting(true);
    const supabase = createClient();

    for (const row of validRows) {
      const { data: entry } = await supabase.from('journal_entries').insert({
        entity_id: entityId, entry_date: row.date, description: row.description,
        reference: row.reference || null, source: 'import',
      }).select().single();

      if (entry) {
        const isIncome = row.amount > 0;
        await supabase.from('journal_lines').insert([
          { entry_id: entry.id, account_id: bankAccountId, debit: isIncome ? row.amount : 0, credit: isIncome ? 0 : Math.abs(row.amount) },
          { entry_id: entry.id, account_id: row.accountId, debit: isIncome ? 0 : Math.abs(row.amount), credit: isIncome ? row.amount : 0 },
        ]);
      }
    }

    setImporting(false);
    setDone(true);
    setTimeout(() => router.push('/dashboard/transactions'), 1500);
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 2 }).format(n);

  if (done) return (
    <div className="p-8 flex flex-col items-center justify-center min-h-96 gap-4">
      <CheckCircle className="h-16 w-16 text-green-500" />
      <p className="text-xl font-semibold">Import complete — {validRows.length} entries posted</p>
    </div>
  );

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/dashboard/transactions" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ChevronLeft className="h-4 w-4" /> Transactions
      </Link>
      <h1 className="text-2xl font-bold mb-2">Import Bank Statement</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Supports FNB, Standard Bank, ABSA, Nedbank CSV exports.
        Format: Date, Description, [Reference], Amount — one transaction per row.
      </p>

      {/* Step 1: Entity + Bank account */}
      <Card className="mb-4">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Step 1 — Select Entity & Bank Account</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Entity</Label>
            <Select onValueChange={(v: string | null) => setEntityId(v ?? "")}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select entity…" /></SelectTrigger>
              <SelectContent>{entities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Bank Account (in Chart of Accounts)</Label>
            <Select onValueChange={(v: string | null) => setBankAccountId(v ?? "")} disabled={!entityId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder={entityId ? 'Select…' : 'Select entity first'} /></SelectTrigger>
              <SelectContent>
                {bankAccounts.map(a => <SelectItem key={a.id} value={a.id}><span className="font-mono text-xs mr-1">{a.code}</span>{a.name}</SelectItem>)}
                {accounts.filter(a => !bankAccounts.includes(a)).map(a => (
                  <SelectItem key={a.id} value={a.id}><span className="font-mono text-xs mr-1">{a.code}</span>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Upload */}
      <Card className="mb-4">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Step 2 — Upload CSV File</CardTitle></CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Click to upload CSV — or drag and drop</p>
            <p className="text-xs text-muted-foreground mt-1">Export from internet banking as CSV/Excel (save as CSV)</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
          {rows.length > 0 && (
            <div className="mt-3 flex items-center gap-4 text-sm">
              <Badge variant="default">{rows.length} rows parsed</Badge>
              <span className="text-green-600">In: {fmt(totalIn)}</span>
              <span className="text-red-600">Out: {fmt(totalOut)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 3: Assign accounts */}
      {rows.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Step 3 — Assign Offset Accounts</CardTitle>
              <p className="text-xs text-muted-foreground">{validRows.length} of {rows.length} assigned</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Description</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Offset Account</th>
                  <th className="px-4 py-2 text-center font-medium text-muted-foreground">OK</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={`border-b last:border-0 ${row.accountId ? '' : 'bg-amber-50/30'}`}>
                    <td className="px-4 py-2 whitespace-nowrap text-xs">{row.date}</td>
                    <td className="px-4 py-2 text-xs max-w-xs truncate">{row.description}</td>
                    <td className={`px-4 py-2 text-right font-medium text-xs ${row.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmt(row.amount)}
                    </td>
                    <td className="px-4 py-2">
                      <Select value={row.accountId} onValueChange={(v: string | null) => updateRowAccount(i, v ?? '')} disabled={!entityId}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Assign…" /></SelectTrigger>
                        <SelectContent>
                          {accounts.filter(a => a.id !== bankAccountId).map(a => (
                            <SelectItem key={a.id} value={a.id}><span className="font-mono text-xs mr-1">{a.code}</span>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2 text-center">
                      {row.accountId
                        ? <CheckCircle className="h-4 w-4 text-green-500 inline" />
                        : <AlertCircle className="h-4 w-4 text-amber-400 inline" />
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <div className="flex gap-3">
          <Button onClick={handleImport} disabled={importing || validRows.length === 0 || !bankAccountId}>
            {importing ? 'Importing…' : `Import ${validRows.length} Entries`}
          </Button>
          <Button variant="outline" onClick={() => setRows([])}>Clear</Button>
          <Link href="/dashboard/transactions" className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 h-8 text-sm font-medium hover:bg-muted transition-colors">Cancel</Link>
        </div>
      )}
    </div>
  );
}
