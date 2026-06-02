import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { Entity, Account } from '@/types/database';

const TYPE_COLORS: Record<string, string> = {
  asset:     'bg-blue-50 text-blue-700',
  liability: 'bg-red-50 text-red-700',
  equity:    'bg-purple-50 text-purple-700',
  income:    'bg-green-50 text-green-700',
  expense:   'bg-orange-50 text-orange-700',
};

export default async function EntityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: entity } = await supabase.from('entities').select('*').eq('id', id).single() as { data: Entity | null };
  const { data: accounts } = await supabase.from('accounts').select('*').eq('entity_id', id).eq('is_active', true).order('code') as { data: Account[] | null };

  if (!entity) notFound();

  const grouped = (accounts ?? []).reduce<Record<string, Account[]>>((acc, a) => {
    (acc[a.type] = acc[a.type] ?? []).push(a);
    return acc;
  }, {});

  const order = ['asset', 'liability', 'equity', 'income', 'expense'];

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/dashboard/entities" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ChevronLeft className="h-4 w-4" /> Entities
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{entity.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={entity.type === 'trust' ? 'secondary' : 'outline'} className="capitalize">
              {entity.type}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {entity.type === 'trust' ? 'IT12T filer' : 'IT14 / IRP6 filer'}
            </span>
            <span className="text-sm text-muted-foreground">· Year end: 28 Feb</span>
          </div>
        </div>
      </div>

      {entity.notes && (
        <Card className="mb-6 bg-muted/40">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">{entity.notes}</p>
          </CardContent>
        </Card>
      )}

      <h2 className="text-lg font-semibold mb-4">Chart of Accounts</h2>

      <div className="space-y-4">
        {order.map((type) => {
          const typeAccounts = grouped[type];
          if (!typeAccounts?.length) return null;
          return (
            <Card key={type}>
              <CardHeader className="pb-0 pt-4">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {type}s
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-2">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30">
                    <tr>
                      <th className="px-6 py-2 text-left font-medium text-muted-foreground w-20">Code</th>
                      <th className="px-6 py-2 text-left font-medium text-muted-foreground">Name</th>
                      <th className="px-6 py-2 text-left font-medium text-muted-foreground">Category</th>
                      <th className="px-6 py-2 text-left font-medium text-muted-foreground">Normal Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {typeAccounts.map((a) => (
                      <tr key={a.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-6 py-2.5 font-mono text-xs text-muted-foreground">{a.code}</td>
                        <td className="px-6 py-2.5 font-medium">{a.name}</td>
                        <td className="px-6 py-2.5">
                          {a.category && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[a.type]}`}>
                              {a.category}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-2.5 capitalize text-muted-foreground text-xs">{a.normal_balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
