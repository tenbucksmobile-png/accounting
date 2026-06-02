'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { Plus } from 'lucide-react';

export function AddShareLotButton({ assetId }: { assetId: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [qty, setQty] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [priceLocal, setPriceLocal] = useState('');   // price in original currency
  const [exchangeRate, setExchangeRate] = useState(''); // ZAR per 1 USD
  const [fees, setFees] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const costPerUnitZar = priceLocal && exchangeRate && currency !== 'ZAR'
    ? (parseFloat(priceLocal) * parseFloat(exchangeRate)).toFixed(6)
    : priceLocal;

  const totalCost = qty && costPerUnitZar
    ? (parseFloat(qty) * parseFloat(costPerUnitZar) + parseFloat(fees || '0')).toFixed(2) : null;

  const handleSave = async () => {
    if (!qty || !priceLocal) return;
    setSaving(true);
    const zarPerUnit = currency === 'ZAR' ? parseFloat(priceLocal) : parseFloat(priceLocal) * parseFloat(exchangeRate || '1');
    await createClient().from('asset_share_lots').insert({
      asset_id: assetId,
      purchase_date: date,
      quantity: parseFloat(qty),
      cost_per_unit_zar: zarPerUnit,
      currency,
      cost_per_unit_foreign: currency !== 'ZAR' ? parseFloat(priceLocal) : null,
      exchange_rate_at_buy: currency !== 'ZAR' ? parseFloat(exchangeRate || '1') : 1,
      broker_fees_zar: parseFloat(fees || '0'),
      notes: notes || null,
    });
    setSaving(false);
    setOpen(false);
    setQty(''); setPriceLocal(''); setExchangeRate(''); setFees('0'); setNotes('');
    router.refresh();
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1"><Plus className="h-3 w-3" />Add Lot</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Share Lot</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Enter each purchase separately for accurate FIFO CGT tracking.</p>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Purchase Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1" /></div>
              <div><Label>Quantity</Label><Input type="number" value={qty} onChange={e => setQty(e.target.value)} className="mt-1" placeholder="100" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Currency</Label>
                <Select value={currency} onValueChange={(v: string | null) => setCurrency(v ?? "")}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ZAR">ZAR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Price per Unit ({currency})</Label>
                <Input type="number" value={priceLocal} onChange={e => setPriceLocal(e.target.value)} className="mt-1" placeholder={currency === 'ZAR' ? 'e.g. 5.20' : 'e.g. 1.85'} step="0.000001" />
              </div>
            </div>
            {currency !== 'ZAR' && (
              <div>
                <Label>ZAR/{currency} Exchange Rate on Purchase Date</Label>
                <Input type="number" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} className="mt-1" placeholder="e.g. 18.45" step="0.0001" />
                {costPerUnitZar && <p className="text-xs text-muted-foreground mt-1">Cost per unit in ZAR: R{parseFloat(costPerUnitZar).toFixed(4)}</p>}
              </div>
            )}
            <div>
              <Label>Broker Fees (ZAR total)</Label>
              <Input type="number" value={fees} onChange={e => setFees(e.target.value)} className="mt-1" placeholder="0" />
            </div>
            <div><Label>Notes (optional)</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" rows={2} placeholder="e.g. EasyEquities USD account — VOO ETF" /></div>
            {totalCost && <p className="text-sm font-semibold">Total lot cost base: R{parseFloat(totalCost).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !qty || !priceLocal}>{saving ? 'Saving…' : 'Add Lot'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
