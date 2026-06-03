import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GenerateButtons } from './generate-buttons';

export default async function ManagementReportsPage() {
  const supabase = await createClient();
  const { data: entities } = await supabase.from('entities').select('id, name, type').eq('is_active', true).order('type') as {
    data: { id: string; name: string; type: string }[] | null;
  };

  const list = entities ?? [];
  const defaultEntity = list.find(e => e.type === 'company') ?? list[0];

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Management Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">
          IFRS-basis financial statements — select entity and period, then generate
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate Report</CardTitle>
        </CardHeader>
        <CardContent>
          <GenerateButtons
            entities={list.map(e => ({ id: e.id, name: e.name }))}
            defaultEntityId={defaultEntity?.id ?? ''}
          />
        </CardContent>
      </Card>

      <Card className="mt-6 bg-muted/30">
        <CardContent className="pt-5 pb-5 text-sm space-y-2">
          <p className="font-semibold text-sm">IFRS standards applied</p>
          <ul className="space-y-1 text-muted-foreground text-xs">
            <li><strong>Income Statement</strong> — IAS 1 Statement of Comprehensive Income, expenses classified by nature. Revenue per IFRS 15. Finance costs separately per IAS 1.82. Tax per IAS 12.</li>
            <li><strong>Balance Sheet</strong> — IAS 1 Statement of Financial Position, current / non-current classification. Equity includes unposted period earnings.</li>
            <li><strong>Cash Flow</strong> — IAS 7 indirect method. Non-cash adjustments (depreciation, S13 allowance) added back. Working capital movements from receivables and payables.</li>
          </ul>
          <p className="text-xs text-muted-foreground pt-1">
            File naming convention: <code className="bg-muted px-1 rounded">Income-Statement-{'{entity}'}-{'{period}'}.html</code>, etc.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
