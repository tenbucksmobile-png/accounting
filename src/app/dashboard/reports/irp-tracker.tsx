'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { Calculator, AlertTriangle, CheckCircle } from 'lucide-react';
import { fmtZAR } from '@/lib/tax';

interface Period { id: string; period: number; due_date: string; amount_paid: number; estimated_tax: number | null; notes: string | null }

interface Props {
  p1: Period | null; p2: Period | null;
  annualisedTax: number; totalPaid: number; safe80pct: boolean;
  taxYear: number; companyId: string; p2TargetAmount: number;
}

export function IrpTracker({ p1, p2, annualisedTax, totalPaid, safe80pct, taxYear, companyId, p2TargetAmount }: Props) {
  const [editPeriod, setEditPeriod] = useState<Period | null>(null);
  const [amount, setAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const today = new Date();

  const periodStatus = (p: Period | null) => {
    if (!p) return 'missing';
    const due = new Date(p.due_date);
    if ((p.amount_paid ?? 0) > 0) return 'paid';
    if (due < today) return 'overdue';
    return 'pending';
  };

  const p1Status = periodStatus(p1);
  const p2Status = periodStatus(p2);

  const StatusIcon = ({ status }: { status: string }) =>
    status === 'paid' ? <CheckCircle className="h-4 w-4 text-green-500" /> :
    status === 'overdue' ? <AlertTriangle className="h-4 w-4 text-red-500" /> :
    <Calculator className="h-4 w-4 text-amber-500" />;

  const openEdit = (p: Period) => {
    setEditPeriod(p);
    setAmount((p.amount_paid ?? 0) > 0 ? String(p.amount_paid) : '');
    setPayDate(new Date().toISOString().slice(0, 10));
  };

  const handleSave = async () => {
    if (!editPeriod) return;
    setSaving(true);
    await createClient().from('provisional_tax').update({
      amount_paid: parseFloat(amount) || 0,
      payment_date: payDate,
      estimated_tax: annualisedTax,
    }).eq('id', editPeriod.id);
    setSaving(false);
    setEditPeriod(null);
    router.refresh();
  };

  const p1Recommended = annualisedTax * 0.5;
  const p2Recommended = p2TargetAmount;

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">IRP6 — Provisional Tax Tracker (Tax Year {taxYear - 1}/{String(taxYear).slice(2)})</CardTitle>
            </div>
            <Badge variant={safe80pct ? 'default' : 'destructive'} className="text-xs">
              {safe80pct ? '✓ Safe harbour met (≥80%)' : '⚠ Safe harbour at risk'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground mb-1">Projected annual CIT</p>
              <p className="text-xl font-bold">{fmtZAR(annualisedTax)}</p>
            </div>
            <div className="rounded-lg bg-green-50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Total paid to date</p>
              <p className="text-xl font-bold text-green-700">{fmtZAR(totalPaid)}</p>
            </div>
            <div className={`rounded-lg p-3 ${safe80pct ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="text-xs text-muted-foreground mb-1">80% safe harbour requires</p>
              <p className="text-xl font-bold">{fmtZAR(annualisedTax * 0.8)}</p>
              <p className="text-xs text-muted-foreground">{safe80pct ? 'Met ✓' : `Still need ${fmtZAR(annualisedTax * 0.8 - totalPaid)}`}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { period: p1, num: 1, status: p1Status, recommended: p1Recommended, label: 'P1' },
              { period: p2, num: 2, status: p2Status, recommended: p2Recommended, label: 'P2' },
            ].map(({ period, num, status, recommended, label }) => (
              <div key={num} className={`border rounded-lg p-4 ${status === 'overdue' ? 'border-red-300 bg-red-50/30' : status === 'paid' ? 'border-green-300 bg-green-50/30' : 'border-amber-200 bg-amber-50/20'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={status} />
                    <span className="font-semibold">{label} — Period {num}</span>
                  </div>
                  <Badge variant={status === 'paid' ? 'default' : status === 'overdue' ? 'destructive' : 'outline'} className="text-xs capitalize">
                    {status}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm mb-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due date</span>
                    <span className="font-medium">{period ? new Date(period.due_date).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recommended payment</span>
                    <span className="font-bold text-amber-700">{fmtZAR(recommended)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount paid</span>
                    <span className={`font-bold ${(period?.amount_paid ?? 0) > 0 ? 'text-green-700' : 'text-muted-foreground'}`}>
                      {fmtZAR(period?.amount_paid ?? 0)}
                    </span>
                  </div>
                </div>
                {period && (
                  <button onClick={() => openEdit(period)} className="text-xs text-primary hover:underline">
                    {(period.amount_paid ?? 0) > 0 ? 'Update payment →' : 'Record payment →'}
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
            <strong>IRP6 rules:</strong> P1 must be paid by 31 Aug (50% of estimated annual tax). P2 by 28 Feb (year end).
            Total P1+P2 must be ≥80% of actual annual tax assessed to avoid a 20% underpayment penalty.
            No penalty if paying at least the basic amount (last year's assessed tax).
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editPeriod} onOpenChange={(o) => !o && setEditPeriod(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record P{editPeriod?.period} Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted/30 rounded text-sm">
              <p>Recommended: <strong>{fmtZAR(editPeriod?.period === 1 ? p1Recommended : p2Recommended)}</strong></p>
              <p className="text-xs text-muted-foreground mt-1">Pay to SARS via eFiling. Ref: company tax reference number.</p>
            </div>
            <div><Label>Amount Paid (ZAR)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1" placeholder={String(Math.round(editPeriod?.period === 1 ? p1Recommended : p2Recommended))} /></div>
            <div><Label>Payment Date</Label><Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPeriod(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !amount}>{saving ? 'Saving…' : 'Record Payment'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
