import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Building2 } from 'lucide-react';

export default async function EntitiesPage() {
  const supabase = await createClient();
  const { data: entities } = await supabase.from('entities').select('*').order('type');

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Entities</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Legal entities in the Bonthuys structure
        </p>
      </div>

      <div className="grid gap-4">
        {(entities ?? []).map((e) => (
          <Card key={e.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      <Link href={`/dashboard/entities/${e.id}`} className="hover:underline">
                        {e.name}
                      </Link>
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={e.type === 'trust' ? 'secondary' : 'outline'} className="capitalize text-xs">
                        {e.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {e.type === 'trust' ? 'IT12T filer' : 'IT14 / IRP6 filer'}
                      </span>
                    </div>
                  </div>
                </div>
                <Badge variant={e.is_active ? 'default' : 'secondary'}>
                  {e.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Tax Number</p>
                  <p className="font-medium">{e.tax_number ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Registration</p>
                  <p className="font-medium">{e.registration_number ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Financial Year End</p>
                  <p className="font-medium">
                    28 {new Date(2000, e.financial_year_end - 1).toLocaleString('en-ZA', { month: 'long' })}
                  </p>
                </div>
              </div>
              {e.notes && (
                <p className="mt-3 text-xs text-muted-foreground border-t pt-3">{e.notes}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
