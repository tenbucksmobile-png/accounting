'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useEffect } from 'react';

export default function NewAssetPage() {
  const router = useRouter();
  const [entities, setEntities] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const [entityId, setEntityId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('property');
  const [description, setDescription] = useState('');
  const [acquisitionDate, setAcquisitionDate] = useState(new Date().toISOString().slice(0, 10));
  const [costBase, setCostBase] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [notes, setNotes] = useState('');

  // Property fields
  const [address, setAddress] = useState('');
  const [erfNumber, setErfNumber] = useState('');
  const [propertyType, setPropertyType] = useState('residential');
  const [transferDuty, setTransferDuty] = useState('0');
  const [conveyancing, setConveyancing] = useState('0');
  const [buildingCost, setBuildingCost] = useState('0');
  const [s13Rate, setS13Rate] = useState('2');
  const [s13StartDate, setS13StartDate] = useState('');

  useEffect(() => {
    createClient().from('entities').select('id, name').eq('is_active', true).then(({ data }) => setEntities(data ?? []));
  }, []);

  const handleSave = async () => {
    if (!entityId || !name || !costBase) return;
    setSaving(true);
    const supabase = createClient();

    const { data: asset } = await supabase.from('assets').insert({
      entity_id: entityId, name, type,
      description: description || null,
      acquisition_date: acquisitionDate,
      cost_base_zar: parseFloat(costBase),
      current_value_zar: currentValue ? parseFloat(currentValue) : null,
      current_value_date: currentValue ? acquisitionDate : null,
      notes: notes || null,
    }).select().single();

    if (asset && type === 'property') {
      await supabase.from('asset_property_details').insert({
        asset_id: asset.id,
        address: address || null,
        erf_number: erfNumber || null,
        property_type: propertyType as any,
        transfer_duty_paid: parseFloat(transferDuty || '0'),
        conveyancing_fees: parseFloat(conveyancing || '0'),
        building_cost_zar: parseFloat(buildingCost || '0'),
        s13_rate: parseFloat(s13Rate || '2'),
        s13_start_date: s13StartDate || null,
      });
    }

    setSaving(false);
    router.push(asset ? `/dashboard/assets/${asset.id}` : '/dashboard/assets');
  };

  const s13Annual = buildingCost && s13Rate
    ? (parseFloat(buildingCost) * parseFloat(s13Rate) / 100).toFixed(0) : null;

  return (
    <div className="p-8 max-w-2xl">
      <Link href="/dashboard/assets" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ChevronLeft className="h-4 w-4" /> Asset Register
      </Link>
      <h1 className="text-2xl font-bold mb-6">Add Asset</h1>

      <Card className="mb-4">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Asset Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Entity</Label>
              <Select onValueChange={(v: string | null) => setEntityId(v ?? "")}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{entities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Asset Type</Label>
              <Select value={type} onValueChange={(v: string | null) => setType(v ?? "")}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="property">Property</SelectItem>
                  <SelectItem value="shares">Shares</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Asset Name</Label><Input value={name} onChange={e => setName(e.target.value)} className="mt-1" placeholder="e.g. Vacant Land — Erf 1234" /></div>
          <div><Label>Description (optional)</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} className="mt-1" rows={2} /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><Label>Acquisition Date</Label><Input type="date" value={acquisitionDate} onChange={e => setAcquisitionDate(e.target.value)} className="mt-1" /></div>
            <div><Label>CGT Base Cost (ZAR)</Label><Input type="number" value={costBase} onChange={e => setCostBase(e.target.value)} className="mt-1" placeholder="345000" /></div>
            <div><Label>Current Value (ZAR)</Label><Input type="number" value={currentValue} onChange={e => setCurrentValue(e.target.value)} className="mt-1" placeholder="Optional" /></div>
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" rows={2} /></div>
        </CardContent>
      </Card>

      {type === 'property' && (
        <Card className="mb-4">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Property Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Address</Label><Input value={address} onChange={e => setAddress(e.target.value)} className="mt-1" /></div>
              <div><Label>ERF / Stand Number</Label><Input value={erfNumber} onChange={e => setErfNumber(e.target.value)} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Property Type</Label>
                <Select value={propertyType} onValueChange={(v: string | null) => setPropertyType(v ?? "")}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="vacant_land">Vacant Land</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Transfer Duty Paid</Label><Input type="number" value={transferDuty} onChange={e => setTransferDuty(e.target.value)} className="mt-1" /></div>
              <div><Label>Conveyancing Fees</Label><Input type="number" value={conveyancing} onChange={e => setConveyancing(e.target.value)} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Building Cost (S13)</Label>
                <Input type="number" value={buildingCost} onChange={e => setBuildingCost(e.target.value)} className="mt-1" placeholder="0 for land" />
              </div>
              <div>
                <Label>S13 Rate (%/year)</Label>
                <Select value={s13Rate} onValueChange={(v: string | null) => setS13Rate(v ?? '2')}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2% — Residential</SelectItem>
                    <SelectItem value="5">5% — Commercial</SelectItem>
                    <SelectItem value="0">0% — Land only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>S13 Start Date</Label><Input type="date" value={s13StartDate} onChange={e => setS13StartDate(e.target.value)} className="mt-1" /></div>
            </div>
            {s13Annual && parseFloat(s13Annual) > 0 && (
              <p className="text-sm text-green-700 font-medium">Annual Section 13 deduction: R{parseFloat(s13Annual).toLocaleString('en-ZA')}/year</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving || !entityId || !name || !costBase}>
          {saving ? 'Saving…' : 'Save Asset'}
        </Button>
        <Link href="/dashboard/assets" className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 h-8 text-sm font-medium hover:bg-muted transition-colors">Cancel</Link>
      </div>
    </div>
  );
}
