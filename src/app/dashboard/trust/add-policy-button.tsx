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

export function AddPolicyButton() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [insurer, setInsurer] = useState('');
  const [insuredPerson, setInsuredPerson] = useState('Marius Bonthuys');
  const [sumAssured, setSumAssured] = useState('');
  const [annualPremium, setAnnualPremium] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [trustOwns, setTrustOwns] = useState(false);
  const [notes, setNotes] = useState('');
  const router = useRouter();

  const handleSave = async () => {
    if (!insurer || !sumAssured) return;
    setSaving(true);
    await createClient().from('trust_life_policies').insert({
      insurer,
      insured_person: insuredPerson,
      sum_assured_zar: parseFloat(sumAssured),
      annual_premium_zar: annualPremium ? parseFloat(annualPremium) : null,
      policy_number: policyNumber || null,
      trust_owns_policy: trustOwns,
      notes: notes || null,
    });
    setSaving(false);
    setOpen(false);
    setInsurer('');
    setSumAssured('');
    setAnnualPremium('');
    setPolicyNumber('');
    setTrustOwns(false);
    setNotes('');
    router.refresh();
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
        <PlusCircle className="h-4 w-4" />
        Add Policy
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Life Insurance Policy</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Insurer</Label>
              <Input
                placeholder="e.g. Old Mutual, Sanlam, Discovery Life"
                value={insurer}
                onChange={e => setInsurer(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Insured Person</Label>
              <Input value={insuredPerson} onChange={e => setInsuredPerson(e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sum Assured (ZAR)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 2000000"
                  value={sumAssured}
                  onChange={e => setSumAssured(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Annual Premium (optional)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 24000"
                  value={annualPremium}
                  onChange={e => setAnnualPremium(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Policy Number (optional)</Label>
              <Input
                placeholder="e.g. OML-123456"
                value={policyNumber}
                onChange={e => setPolicyNumber(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer" onClick={() => setTrustOwns(v => !v)}>
              <input
                type="checkbox"
                id="trustOwns"
                checked={trustOwns}
                onChange={e => setTrustOwns(e.target.checked)}
                className="h-4 w-4 mt-0.5"
                onClick={e => e.stopPropagation()}
              />
              <div>
                <label htmlFor="trustOwns" className="text-sm font-medium cursor-pointer">
                  Policy ceded to trust (trust is the owner)
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tick if formally ceded — proceeds fall <strong>outside</strong> Marius&apos;s estate.
                  If unchecked, trust is merely named beneficiary and proceeds are included in the estate for estate duty.
                </p>
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !insurer || !sumAssured}>
              {saving ? 'Saving…' : 'Add Policy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
