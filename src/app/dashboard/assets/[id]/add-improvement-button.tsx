'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { Plus } from 'lucide-react';

export function AddImprovementButton({ assetId }: { assetId: string }) {
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const handleSave = async () => {
    if (!desc || !amount) return;
    setSaving(true);
    await createClient().from('asset_improvements').insert({ asset_id: assetId, description: desc, amount_zar: parseFloat(amount), date });
    setSaving(false);
    setOpen(false);
    setDesc(''); setAmount('');
    router.refresh();
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1"><Plus className="h-3 w-3" />Add Improvement</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Capital Improvement</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Capital improvements add to your CGT base cost, reducing your eventual tax on disposal.</p>
          <div className="space-y-4">
            <div><Label>Description</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} className="mt-1" placeholder="e.g. New roof — R45,000" rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Amount (ZAR)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1" placeholder="45000" /></div>
              <div><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !desc || !amount}>{saving ? 'Saving…' : 'Add Improvement'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
