'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ChevronLeft, Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react';

interface JournalLine { accountId: string; debit: string; credit: string; description: string }
interface Account { id: string; code: string; name: string; type: string; entity_id: string }
interface Entity { id: string; name: string }

const ACCOUNT_TYPE_COLOR: Record<string, string> = {
  asset: 'text-blue-600', liability: 'text-red-600',
  equity: 'text-purple-600', income: 'text-green-600', expense: 'text-orange-600',
};

// Common SA transaction templates
const TEMPLATES = [
  { label: 'License Fee Received',  lines: [{ dr: 'Bank', cr: 'License Fee — Indaba Cares' }] },
  { label: 'Rental Income',         lines: [{ dr: 'Bank', cr: 'Rental Income — Apartment' }] },
  { label: 'App Revenue (Fizzog)',   lines: [{ dr: 'Bank', cr: 'Fizzog — App Revenue' }] },
  { label: 'Bank Charges',          lines: [{ dr: 'Bank Charges', cr: 'Bank' }] },
  { label: 'Accounting Fee',        lines: [{ dr: 'Accounting & Audit Fees', cr: 'Bank' }] },
  { label: 'S7C Interest Payment',  lines: [{ dr: 'Interest Expense — S7C Loan', cr: 'Bank' }] },
];

export default function NewTransactionPage() {
  const router = useRouter();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entityId, setEntityId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<JournalLine[]>([
    { accountId: '', debit: '', credit: '', description: '' },
    { accountId: '', debit: '', credit: '', description: '' },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const sb = createClient();
    sb.from('entities').select('id, name').eq('is_active', true).then(({ data }) => setEntities(data ?? []));
  }, []);

  useEffect(() => {
    if (!entityId) return;
    createClient().from('accounts').select('id,code,name,type,entity_id').eq('entity_id', entityId).eq('is_active', true).order('code')
      .then(({ data }) => setAccounts(data ?? []));
  }, [entityId]);

  const filteredAccounts = entityId ? accounts.filter(a => a.entity_id === entityId) : [];

  const totalDebits = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredits = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01 && totalDebits > 0;

  const updateLine = (i: number, field: keyof JournalLine, val: string) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  };
  const addLine = () => setLines(prev => [...prev, { accountId: '', debit: '', credit: '', description: '' }]);
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!entityId || !description || !isBalanced) return;
    setSaving(true);
    const supabase = createClient();

    const { data: entry } = await supabase.from('journal_entries').insert({
      entity_id: entityId, entry_date: date, description, reference: reference || null, source: 'manual',
    }).select().single();

    if (entry) {
      await supabase.from('journal_lines').insert(
        lines.filter(l => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0)).map(l => ({
          entry_id: entry.id, account_id: l.accountId,
          debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0,
          description: l.description || null,
        }))
      );
    }

    setSaving(false);
    router.push('/dashboard/transactions');
  };

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/dashboard/transactions" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ChevronLeft className="h-4 w-4" /> Transactions
      </Link>
      <h1 className="text-2xl font-bold mb-6">New Journal Entry</h1>

      {/* Header */}
      <Card className="mb-4">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Entry Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Entity</Label>
              <Select onValueChange={(v: string | null) => setEntityId(v ?? "")}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select entity…" /></SelectTrigger>
                <SelectContent>{entities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1" /></div>
          </div>
          <div><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} className="mt-1" placeholder="e.g. License fee — Indaba Cares — June 2025" /></div>
          <div><Label>Reference (optional)</Label><Input value={reference} onChange={e => setReference(e.target.value)} className="mt-1" placeholder="EFT ref, invoice number…" /></div>
        </CardContent>
      </Card>

      {/* Quick templates */}
      {entityId && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Quick templates:</p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map(t => (
              <button key={t.label} onClick={() => setDescription(t.label)}
                className="text-xs px-2.5 py-1 rounded-full border hover:bg-muted transition-colors">
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Journal lines */}
      <Card className="mb-4">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Journal Lines</CardTitle>
          <div className="flex items-center gap-3">
            {isBalanced
              ? <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Balanced</span>
              : totalDebits > 0
                ? <span className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Out of balance by {new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(Math.abs(totalDebits - totalCredits))}</span>
                : null
            }
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground mb-2 px-1">
            <div className="col-span-4">Account</div>
            <div className="col-span-2 text-right">Debit (Dr)</div>
            <div className="col-span-2 text-right">Credit (Cr)</div>
            <div className="col-span-3">Line Note</div>
            <div className="col-span-1" />
          </div>

          <div className="space-y-2">
            {lines.map((line, i) => {
              const acc = accounts.find(a => a.id === line.accountId);
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <Select value={line.accountId} onValueChange={(v: string | null) => updateLine(i, 'accountId', v ?? '')} disabled={!entityId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={entityId ? 'Select account…' : 'Choose entity first'} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredAccounts.map(a => (
                          <SelectItem key={a.id} value={a.id}>
                            <span className="font-mono text-xs text-muted-foreground mr-1">{a.code}</span>
                            <span className={ACCOUNT_TYPE_COLOR[a.type]}>{a.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {acc && <p className={`text-xs mt-0.5 pl-1 ${ACCOUNT_TYPE_COLOR[acc.type]}`}>{acc.type}</p>}
                  </div>
                  <div className="col-span-2">
                    <Input type="number" value={line.debit} onChange={e => updateLine(i, 'debit', e.target.value)}
                      className="h-8 text-right text-xs" placeholder="0.00"
                      onFocus={() => { if (line.credit) updateLine(i, 'credit', ''); }} />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" value={line.credit} onChange={e => updateLine(i, 'credit', e.target.value)}
                      className="h-8 text-right text-xs" placeholder="0.00"
                      onFocus={() => { if (line.debit) updateLine(i, 'debit', ''); }} />
                  </div>
                  <div className="col-span-3">
                    <Input value={line.description} onChange={e => updateLine(i, 'description', e.target.value)}
                      className="h-8 text-xs" placeholder="Optional note" />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {lines.length > 2 && (
                      <button onClick={() => removeLine(i)} className="text-muted-foreground hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals row */}
          <div className="grid grid-cols-12 gap-2 mt-3 pt-3 border-t font-semibold text-sm">
            <div className="col-span-4 text-muted-foreground text-xs">Totals</div>
            <div className={`col-span-2 text-right ${!isBalanced && totalDebits > 0 ? 'text-red-600' : ''}`}>
              {totalDebits > 0 && new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(totalDebits)}
            </div>
            <div className={`col-span-2 text-right ${!isBalanced && totalCredits > 0 ? 'text-red-600' : ''}`}>
              {totalCredits > 0 && new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(totalCredits)}
            </div>
            <div className="col-span-4" />
          </div>

          <button onClick={addLine} className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline">
            <Plus className="h-3 w-3" /> Add line
          </button>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving || !isBalanced || !entityId || !description}>
          {saving ? 'Saving…' : 'Post Entry'}
        </Button>
        <Link href="/dashboard/transactions" className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 h-8 text-sm font-medium hover:bg-muted transition-colors">Cancel</Link>
      </div>
    </div>
  );
}
