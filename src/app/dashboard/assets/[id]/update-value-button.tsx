'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';

export function UpdateValueButton({ assetId, currentValue }: { assetId: string; currentValue: number | null }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentValue?.toString() ?? '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const handleSave = async () => {
    if (!value) return;
    setSaving(true);
    await createClient().from('assets').update({ current_value_zar: parseFloat(value), current_value_date: date, updated_at: new Date().toISOString() }).eq('id', assetId);
    setSaving(false);
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Update Value</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Current Value</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Current Market Value (ZAR)</Label><Input type="number" value={value} onChange={e => setValue(e.target.value)} className="mt-1" placeholder="e.g. 380000" /></div>
            <div><Label>Valuation Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1" /></div>
            <p className="text-xs text-muted-foreground">For USD shares: multiply current USD portfolio value by today's ZAR/USD rate.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !value}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
