'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { PlusCircle } from 'lucide-react';

interface Props {
  loanId: string;
  taxYear: number;
  loanDescription: string;
}

export function AddPaymentButton({ loanId, taxYear, loanDescription }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const router = useRouter();

  const handleSave = async () => {
    if (!amount || !date) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from('section7c_payments').insert({
      loan_id: loanId,
      payment_date: date,
      amount: parseFloat(amount),
      tax_year: taxYear,
      notes: notes || null,
    });
    setSaving(false);
    setOpen(false);
    setAmount('');
    setNotes('');
    router.refresh();
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
        <PlusCircle className="h-4 w-4" />
        Record Interest Payment
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Interest Payment</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground mb-4">{loanDescription}</div>
          <div className="space-y-4">
            <div>
              <Label>Payment Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Amount (ZAR)</Label>
              <Input
                type="number"
                placeholder="e.g. 31913.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="e.g. EFT ref 12345 — S7C interest payment"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Tax year {taxYear - 1}/{taxYear}. Ensure payment is made to the lender before <strong>28 Feb {taxYear}</strong>.
              Declare the interest as income in the lender's personal IT return.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !amount}>
              {saving ? 'Saving…' : 'Save Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
