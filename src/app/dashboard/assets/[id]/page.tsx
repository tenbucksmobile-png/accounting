import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { UpdateValueButton } from './update-value-button';
import { AddImprovementButton } from './add-improvement-button';
import { AddShareLotButton } from './add-share-lot-button';
import type { Asset, AssetImprovement, AssetShareLot } from '@/types/database';

function fmt(n: number | null) {
  if (n === null) return '—';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 2 }).format(n);
}
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: asset } = await supabase
    .from('assets')
    .select(`*, entity:entity_id(id,name,type), property_details:asset_property_details(*), improvements:asset_improvements(*), share_lots:asset_share_lots(*)`)
    .eq('id', id)
    .single() as { data: Asset | null };

  if (!asset) notFound();

  const entity = asset.entity as any;
  const propDetails = asset.property_details as any;
  const improvements = (asset.improvements ?? []) as AssetImprovement[];
  const shareLots = (asset.share_lots ?? []) as AssetShareLot[];

  const improvementTotal = improvements.reduce((s, i) => s + i.amount_zar, 0);
  const totalCostBase = asset.cost_base_zar + improvementTotal;
  const currentValue = asset.current_value_zar ?? totalCostBase;
  const gain = currentValue - totalCostBase;

  // Section 13
  const s13Annual = propDetails?.building_cost_zar > 0 && propDetails?.s13_rate > 0
    ? propDetails.building_cost_zar * (propDetails.s13_rate / 100) : 0;

  // Share lots totals
  const totalShareCostBase = shareLots.reduce((s, l) => s + (l.quantity * l.cost_per_unit_zar) + l.broker_fees_zar, 0);
  const activeShareLots = shareLots.filter(l => !l.is_fully_disposed);

  // CGT
  const rateKey = entity?.type === 'company' ? 0.216 : 0.156;
  const cgtIfSoldNow = gain > 0 ? gain * rateKey : 0;

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/dashboard/assets" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ChevronLeft className="h-4 w-4" /> Asset Register
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{asset.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="capitalize">{asset.type}</Badge>
            <span className="text-sm text-muted-foreground">{entity?.name}</span>
            <span className="text-sm text-muted-foreground">· Acquired {fmtDate(asset.acquisition_date)}</span>
          </div>
        </div>
        <UpdateValueButton assetId={asset.id} currentValue={asset.current_value_zar} />
      </div>

      {asset.description && (
        <Card className="mb-6 bg-muted/30"><CardContent className="pt-4 pb-4">
          <p className="text-sm text-muted-foreground">{asset.description}</p>
        </CardContent></Card>
      )}

      {/* Key numbers */}
      <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground mb-1">Purchase Cost</p>
          <p className="text-lg font-bold">{fmt(asset.cost_base_zar)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground mb-1">Total CGT Base Cost</p>
          <p className="text-lg font-bold">{fmt(totalCostBase)}</p>
          {improvementTotal > 0 && <p className="text-xs text-muted-foreground">+{fmt(improvementTotal)} improvements</p>}
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground mb-1">Current Value</p>
          <p className="text-lg font-bold">{fmt(currentValue)}</p>
          {asset.current_value_date && <p className="text-xs text-muted-foreground">{fmtDate(asset.current_value_date)}</p>}
        </div>
        <div className={`rounded-lg p-3 ${gain >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className="text-xs text-muted-foreground mb-1">Unrealised Gain</p>
          <p className={`text-lg font-bold ${gain >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {gain >= 0 ? '+' : ''}{fmt(gain)}
          </p>
          <p className="text-xs text-muted-foreground">CGT if sold: {fmt(cgtIfSoldNow)}</p>
        </div>
      </div>

      {/* Property details */}
      {asset.type === 'property' && propDetails && (
        <Card className="mb-6">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Property Details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div><p className="text-muted-foreground text-xs">Property Type</p><p className="font-medium capitalize">{propDetails.property_type?.replace('_', ' ') ?? '—'}</p></div>
              <div><p className="text-muted-foreground text-xs">Address</p><p className="font-medium">{propDetails.address ?? '—'}</p></div>
              <div><p className="text-muted-foreground text-xs">ERF Number</p><p className="font-medium">{propDetails.erf_number ?? '—'}</p></div>
              <div><p className="text-muted-foreground text-xs">Transfer Duty Paid</p><p className="font-medium">{fmt(propDetails.transfer_duty_paid)}</p></div>
              <div><p className="text-muted-foreground text-xs">Conveyancing Fees</p><p className="font-medium">{fmt(propDetails.conveyancing_fees)}</p></div>
              <div><p className="text-muted-foreground text-xs">Building Cost (S13)</p><p className="font-medium">{fmt(propDetails.building_cost_zar)}</p></div>
            </div>
            {s13Annual > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
                <strong>Section 13 Building Allowance: {fmt(s13Annual)}/year</strong> ({propDetails.s13_rate}% × {fmt(propDetails.building_cost_zar)})
                — deductible against company income from {fmtDate(propDetails.s13_start_date)}.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Capital improvements */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Capital Improvements</CardTitle>
          <div className="flex items-center gap-3">
            {improvementTotal > 0 && <span className="text-sm font-semibold text-green-700">+{fmt(improvementTotal)} to base cost</span>}
            <AddImprovementButton assetId={asset.id} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {improvements.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">No improvements recorded.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="px-5 py-2 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-5 py-2 text-left font-medium text-muted-foreground">Description</th>
                  <th className="px-5 py-2 text-right font-medium text-muted-foreground">Amount</th>
                </tr>
              </thead>
              <tbody>
                {improvements.map((imp) => (
                  <tr key={imp.id} className="border-b last:border-0">
                    <td className="px-5 py-2.5">{fmtDate(imp.date)}</td>
                    <td className="px-5 py-2.5">{imp.description}</td>
                    <td className="px-5 py-2.5 text-right font-medium text-green-700">{fmt(imp.amount_zar)}</td>
                  </tr>
                ))}
                <tr className="bg-muted/20 font-semibold">
                  <td className="px-5 py-2 text-muted-foreground" colSpan={2}>Total added to CGT base cost</td>
                  <td className="px-5 py-2 text-right text-green-700">{fmt(improvementTotal)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Share lots */}
      {asset.type === 'shares' && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm">Share Lots — CGT Base Cost (FIFO)</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Each lot tracks ZAR cost base at purchase date. Foreign shares use ZAR/currency rate at acquisition.</p>
            </div>
            <AddShareLotButton assetId={asset.id} />
          </CardHeader>
          <CardContent className="p-0">
            {shareLots.length === 0 ? (
              <p className="px-6 py-4 text-sm text-muted-foreground">No share lots recorded. Add individual purchase lots for accurate CGT tracking.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Qty</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Price/Unit</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Rate</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Cost Base (ZAR)</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Fees</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Total</th>
                    <th className="px-4 py-2 text-center font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shareLots.map((lot) => {
                    const lotCost = (lot.quantity * lot.cost_per_unit_zar) + lot.broker_fees_zar;
                    const remaining = lot.quantity - lot.disposed_quantity;
                    return (
                      <tr key={lot.id} className={`border-b last:border-0 ${lot.is_fully_disposed ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-2">{fmtDate(lot.purchase_date)}</td>
                        <td className="px-4 py-2 text-right">{lot.quantity.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">
                          {lot.currency !== 'ZAR' && lot.cost_per_unit_foreign
                            ? <span>{lot.currency} {lot.cost_per_unit_foreign.toFixed(4)}</span>
                            : <span>R{lot.cost_per_unit_zar.toFixed(4)}</span>
                          }
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground text-xs">
                          {lot.currency !== 'ZAR' ? `R${lot.exchange_rate_at_buy}/${lot.currency}` : '—'}
                        </td>
                        <td className="px-4 py-2 text-right">R{lot.cost_per_unit_zar.toFixed(4)}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{fmt(lot.broker_fees_zar)}</td>
                        <td className="px-4 py-2 text-right font-semibold">{fmt(lotCost)}</td>
                        <td className="px-4 py-2 text-center">
                          {lot.is_fully_disposed
                            ? <Badge variant="secondary" className="text-xs">Disposed</Badge>
                            : lot.disposed_quantity > 0
                              ? <Badge variant="outline" className="text-xs">{remaining.toLocaleString()} remain</Badge>
                              : <Badge variant="default" className="text-xs">Active</Badge>
                          }
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-muted/20 font-semibold">
                    <td className="px-4 py-2 text-muted-foreground" colSpan={6}>Total ZAR cost base ({activeShareLots.length} active lots)</td>
                    <td className="px-4 py-2 text-right">{fmt(totalShareCostBase)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {asset.notes && (
        <Card className="bg-muted/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{asset.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
