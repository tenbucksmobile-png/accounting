'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, PlusCircle } from 'lucide-react';

interface Props {
  beneficiaryId: string;
  beneficiaryName: string;
  taxYear: number;
  isMinor: boolean;
}

export function AddDistributionButton({ beneficiaryId, beneficiaryName, taxYear, isMinor }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [character, setCharacter] = useState('other');
  const [notes, setNotes] = useState('');
  const router = useRouter();

  const handleSave = async () => {
    if (!amount || !date) return;
    setSaving(true);
    await createClient().from('trust_distribution_resolutions').insert({
      beneficiary_id: beneficiaryId,
      tax_year: taxYear,
      resolution_date: date,
      amount: parseFloat(amount),
      income_character: character,
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
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2 w-full">
        <PlusCircle className="h-4 w-4" />
        Record Distribution Resolution
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Distribution Resolution — {beneficiaryName}</DialogTitle>
          </DialogHeader>

          {isMinor && (
            <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                <strong>Section 7(3):</strong> This distribution will be attributed to Marius and taxed
                at his marginal rate — not in {beneficiaryName.split(' ')[0]}&apos;s hands. Ensure this is intentional.
              </span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label>Resolution Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Amount (ZAR)</Label>
              <Input
                type="number"
                placeholder="e.g. 80000"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Income Character (Section 25B)</Label>
              <Select value={character} onValueChange={(v: string | null) => setCharacter(v ?? 'other')}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interest">Interest</SelectItem>
                  <SelectItem value="dividend">Dividend (DWT already withheld)</SelectItem>
                  <SelectItem value="rental">Rental</SelectItem>
                  <SelectItem value="capital_gain">Capital Gain</SelectItem>
                  <SelectItem value="other">Other / General income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="e.g. Trustee resolution TR-2027-001 — signed by all trustees"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Resolution must be passed before <strong>28 Feb {taxYear}</strong> to count for tax year {taxYear - 1}/{taxYear}.
              Ensure actual payment follows within a reasonable period and is supported by a signed resolution.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !amount || !date}>
              {saving ? 'Saving…' : 'Record Resolution'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
