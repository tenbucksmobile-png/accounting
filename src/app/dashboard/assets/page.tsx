import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Building, TrendingUp, Plus, Landmark, BarChart3 } from 'lucide-react';
import type { Asset, AssetImprovement } from '@/types/database';

const TYPE_ICON: Record<string, React.ElementType> = {
  property: Building,
  shares:   TrendingUp,
  cash:     Landmark,
  other:    BarChart3,
};

const TYPE_COLOR: Record<string, string> = {
  property: 'bg-blue-50 text-blue-700 border-blue-200',
  shares:   'bg-green-50 text-green-700 border-green-200',
  cash:     'bg-purple-50 text-purple-700 border-purple-200',
  other:    'bg-gray-50 text-gray-700 border-gray-200',
};

function fmt(n: number | null) {
  if (n === null) return '—';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);
}

// Effective CGT rates
const CGT_RATES = {
  company: { inclusion: 0.8, tax: 0.27, label: 'Company (27% CIT)' },
  trust:   { inclusion: 0.8, tax: 0.45, label: 'Trust undistributed (45%)' },
  trust_beneficiary: { inclusion: 0.4, tax: 0.39, label: 'Personal (39% marginal)' },
};

export default async function AssetsPage() {
  const supabase = await createClient();

  const { data: rawAssets } = await supabase
    .from('assets')
    .select(`
      *,
      entity:entity_id(id, name, type),
      property_details:asset_property_details(*),
      improvements:asset_improvements(*),
      share_lots:asset_share_lots(*)
    `)
    .eq('is_disposed', false)
    .order('type')
    .order('name') as { data: Asset[] | null };

  const assets = rawAssets ?? [];

  const totalCostBase = assets.reduce((s, a) => s + a.cost_base_zar, 0);
  const totalCurrentValue = assets.reduce((s, a) => s + (a.current_value_zar ?? a.cost_base_zar), 0);
  const totalUnrealisedGain = totalCurrentValue - totalCostBase;

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Asset Register</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Cost base tracking for CGT — property, shares, and other capital assets
          </p>
        </div>
        <Link href="/dashboard/assets/new" className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-2.5 h-8 text-sm font-medium hover:bg-primary/80 transition-colors">
          <Plus className="h-4 w-4 mr-2" />Add Asset
        </Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Total CGT Base Cost</p>
            <p className="text-2xl font-bold">{fmt(totalCostBase)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Current Value (estimated)</p>
            <p className="text-2xl font-bold">{fmt(totalCurrentValue)}</p>
          </CardContent>
        </Card>
        <Card className={totalUnrealisedGain >= 0 ? 'border-green-300' : 'border-red-300'}>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Unrealised Gain / (Loss)</p>
            <p className={`text-2xl font-bold ${totalUnrealisedGain >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {totalUnrealisedGain >= 0 ? '+' : ''}{fmt(totalUnrealisedGain)}
            </p>
          </CardContent>
        </Card>
      </div>

      {assets.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No assets recorded. Add your first asset above.
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {assets.map((asset) => {
          const Icon = TYPE_ICON[asset.type] ?? BarChart3;
          const improvementTotal = (asset.improvements ?? []).reduce((s, i: AssetImprovement) => s + i.amount_zar, 0);
          const totalCostBase = asset.cost_base_zar + improvementTotal;
          const currentValue = asset.current_value_zar ?? totalCostBase;
          const gain = currentValue - totalCostBase;
          const entity = asset.entity as any;

          // CGT calculation (use entity type to pick rate)
          const rateKey = entity?.type === 'company' ? 'company' : 'trust_beneficiary';
          const rate = CGT_RATES[rateKey];
          const cgtIfSoldNow = gain > 0 ? gain * rate.inclusion * rate.tax : 0;
          const netProceeds = currentValue - cgtIfSoldNow;

          // Section 13 annual allowance (property only)
          let s13Annual = 0;
          const propDetails = asset.property_details as any;
          if (asset.type === 'property' && propDetails?.building_cost_zar > 0 && propDetails?.s13_rate > 0) {
            s13Annual = propDetails.building_cost_zar * (propDetails.s13_rate / 100);
          }

          return (
            <Card key={asset.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center border ${TYPE_COLOR[asset.type]}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <Link href={`/dashboard/assets/${asset.id}`} className="hover:underline">
                        <CardTitle className="text-base">{asset.name}</CardTitle>
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={`text-xs border ${TYPE_COLOR[asset.type]}`}>
                          {asset.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{entity?.name}</span>
                        {asset.current_value_date && (
                          <span className="text-xs text-muted-foreground">
                            · Valued {new Date(asset.current_value_date).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Link href={`/dashboard/assets/${asset.id}`}>
                    <Button variant="outline" size="sm">Detail →</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">CGT Base Cost</p>
                    <p className="font-bold">{fmt(totalCostBase)}</p>
                    {improvementTotal > 0 && (
                      <p className="text-xs text-muted-foreground">incl. {fmt(improvementTotal)} improvements</p>
                    )}
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Current Value</p>
                    <p className="font-bold">{fmt(currentValue)}</p>
                    {!asset.current_value_zar && (
                      <p className="text-xs text-amber-600">Est. — update value</p>
                    )}
                  </div>
                  <div className={`rounded-lg p-3 ${gain >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <p className="text-xs text-muted-foreground mb-1">Unrealised Gain</p>
                    <p className={`font-bold ${gain >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {gain >= 0 ? '+' : ''}{fmt(gain)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">CGT if Sold Now</p>
                    <p className="font-bold text-amber-700">{fmt(cgtIfSoldNow)}</p>
                    <p className="text-xs text-muted-foreground">{rate.label}</p>
                  </div>
                </div>

                {s13Annual > 0 && (
                  <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded px-3 py-2">
                    <span>Section 13 building allowance: <strong>{fmt(s13Annual)}/year</strong> deductible in {entity?.name}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* CGT Rate Reference */}
      <Card className="mt-8 bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">CGT Effective Rates — Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {Object.entries(CGT_RATES).map(([key, r]) => (
              <div key={key} className="rounded-lg bg-white border p-3">
                <p className="font-medium">{r.label}</p>
                <p className="text-muted-foreground text-xs mt-1">
                  {(r.inclusion * 100).toFixed(0)}% inclusion × {(r.tax * 100).toFixed(0)}% rate
                  = <strong>{(r.inclusion * r.tax * 100).toFixed(1)}% effective</strong>
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
