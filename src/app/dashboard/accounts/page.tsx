import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Account } from '@/types/database';

const TYPE_COLORS: Record<string, string> = {
  asset:     'bg-blue-50 text-blue-700 border-blue-200',
  liability: 'bg-red-50 text-red-700 border-red-200',
  equity:    'bg-purple-50 text-purple-700 border-purple-200',
  income:    'bg-green-50 text-green-700 border-green-200',
  expense:   'bg-orange-50 text-orange-700 border-orange-200',
};

export default async function AccountsPage() {
  const supabase = await createClient();
  const { data: entities } = await supabase.from('entities').select('id, name, type').eq('is_active', true).order('type') as { data: { id: string; name: string; type: string }[] | null };
  const { data: accounts } = await supabase.from('accounts').select('*').eq('is_active', true).order('code') as { data: Account[] | null };

  const order = ['asset', 'liability', 'equity', 'income', 'expense'];

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Chart of Accounts</h1>
        <p className="text-muted-foreground text-sm mt-1">Double-entry accounts across all entities — SA GAAP aligned</p>
      </div>

      {(entities ?? []).map((entity) => {
        const entityAccounts = (accounts ?? []).filter((a) => a.entity_id === entity.id);
        const byType = entityAccounts.reduce<Record<string, Account[]>>((acc, a) => {
          (acc[a.type] = acc[a.type] ?? []).push(a);
          return acc;
        }, {});

        return (
          <div key={entity.id} className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-semibold">{entity.name}</h2>
              <Badge variant={entity.type === 'trust' ? 'secondary' : 'outline'} className="capitalize">
                {entity.type}
              </Badge>
              <span className="text-sm text-muted-foreground">{entityAccounts.length} accounts</span>
            </div>

            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium text-muted-foreground w-24">Type</th>
                      <th className="px-5 py-3 text-left font-medium text-muted-foreground w-20">Code</th>
                      <th className="px-5 py-3 text-left font-medium text-muted-foreground">Account Name</th>
                      <th className="px-5 py-3 text-left font-medium text-muted-foreground">Category</th>
                      <th className="px-5 py-3 text-left font-medium text-muted-foreground">Dr / Cr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.flatMap((type) =>
                      (byType[type] ?? []).map((a) => (
                        <tr key={a.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-5 py-2.5">
                            <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded-full border ${TYPE_COLORS[a.type]}`}>
                              {a.type}
                            </span>
                          </td>
                          <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground">{a.code}</td>
                          <td className="px-5 py-2.5 font-medium">{a.name}</td>
                          <td className="px-5 py-2.5 text-xs text-muted-foreground">{a.category ?? '—'}</td>
                          <td className="px-5 py-2.5 text-xs capitalize text-muted-foreground">{a.normal_balance}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
