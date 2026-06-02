import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, CheckCircle, Clock } from 'lucide-react';
import type { JournalEntry, JournalLine, Account } from '@/types/database';

function fmt(n: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 2 }).format(n);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function TransactionsPage() {
  const supabase = await createClient();

  const { data: rawEntries } = await supabase
    .from('journal_entries')
    .select('*, entity:entity_id(id,name,type), lines:journal_lines(*, account:account_id(id,name,code,type))')
    .order('entry_date', { ascending: false })
    .limit(100) as { data: JournalEntry[] | null };

  const entries = rawEntries ?? [];

  const totalDebits = entries.reduce((s, e) => s + (e.lines ?? []).reduce((ls, l) => ls + Number(l.debit), 0), 0);

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Double-entry journal ledger — every transaction balances debits and credits
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/import" className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 h-8 text-sm font-medium hover:bg-muted transition-colors">Import CSV</Link>
          <Link href="/dashboard/transactions/new" className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-2.5 h-8 text-sm font-medium hover:bg-primary/80 transition-colors"><Plus className="h-4 w-4 mr-2" />New Entry</Link>
        </div>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground mb-4">No journal entries yet.</p>
            <Link href="/dashboard/transactions/new" className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-2.5 h-8 text-sm font-medium hover:bg-primary/80 transition-colors">Create First Entry</Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card><CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground mb-1">Total Entries</p>
              <p className="text-2xl font-bold">{entries.length}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground mb-1">Total Value (Debits)</p>
              <p className="text-2xl font-bold">{fmt(totalDebits)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground mb-1">Unreconciled</p>
              <p className="text-2xl font-bold text-amber-600">{entries.filter(e => !e.is_reconciled).length}</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">Date</th>
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">Description</th>
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">Entity</th>
                    <th className="px-5 py-3 text-right font-medium text-muted-foreground">Debit</th>
                    <th className="px-5 py-3 text-left font-medium text-muted-foreground">Ref</th>
                    <th className="px-5 py-3 text-center font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const lines = (entry.lines ?? []) as (JournalLine & { account: Account })[];
                    const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
                    const entity = entry.entity as any;
                    const debitLines = lines.filter(l => Number(l.debit) > 0);
                    return (
                      <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/20 group">
                        <td className="px-5 py-3 whitespace-nowrap">{fmtDate(entry.entry_date)}</td>
                        <td className="px-5 py-3">
                          <p className="font-medium">{entry.description}</p>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {debitLines.slice(0, 2).map(l => (
                              <span key={l.id} className="text-xs text-muted-foreground">
                                Dr: {l.account?.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant="outline" className="text-xs capitalize">{entity?.name}</Badge>
                        </td>
                        <td className="px-5 py-3 text-right font-medium">{fmt(totalDebit)}</td>
                        <td className="px-5 py-3 text-muted-foreground text-xs">{entry.reference ?? '—'}</td>
                        <td className="px-5 py-3 text-center">
                          {entry.is_reconciled
                            ? <CheckCircle className="h-4 w-4 text-green-500 inline" />
                            : <Clock className="h-4 w-4 text-amber-400 inline" />
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
