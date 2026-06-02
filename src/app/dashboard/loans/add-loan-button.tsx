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
import { Plus, Info } from 'lucide-react';

interface Entity { id: string; name: string }
interface Props { entities: Entity[]; currentRate: number }

export function AddLoanButton({ entities, currentRate }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lenderName, setLenderName] = useState('Marius Bonthuys');
  const [entityId, setEntityId] = useState('');
  const [description, setDescription] = useState('');
  const [principal, setPrincipal] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const router = useRouter();

  const annualInterest = principal ? (parseFloat(principal) * (currentRate / 100)).toFixed(2) : null;

  const handleSave = async () => {
    if (!lenderName || !entityId || !description || !principal || !date) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from('section7c_loans').insert({
      lender_name: lenderName,
      borrower_entity_id: entityId,
      description,
      principal_amount: parseFloat(principal),
      loan_date: date,
      notes: notes || null,
      is_active: true,
    });
    setSaving(false);
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        Add Loan
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Section 7C Loan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-800">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              Current SARS official rate: <strong className="ml-1">{currentRate}% p.a.</strong>&nbsp;
              Charge this rate annually on all loans to avoid donations tax.
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Lender (Natural Person)</Label>
                <Input value={lenderName} onChange={(e) => setLenderName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Borrower Entity</Label>
                <Select onValueChange={(v: string | null) => setEntityId(v ?? '')}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select entity…" />
                  </SelectTrigger>
                  <SelectContent>
                    {entities.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                placeholder="e.g. Vacant land transferred to company at R345,000"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Principal Amount (ZAR)</Label>
                <Input
                  type="number"
                  placeholder="345000"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value)}
                  className="mt-1"
                />
                {annualInterest && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Annual interest: R {parseFloat(annualInterest).toLocaleString('en-ZA')}
                  </p>
                )}
              </div>
              <div>
                <Label>Loan Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Context, asset description, SARS reference…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !entityId || !description || !principal}>
              {saving ? 'Saving…' : 'Add Loan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
