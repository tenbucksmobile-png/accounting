'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, BarChart3, TrendingUp } from 'lucide-react';

interface Props {
  entities: { id: string; name: string }[];
  defaultEntityId: string;
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Default to current SA tax year: 1 Mar prev year → last day of prev month
function defaultPeriod() {
  const today = new Date();
  const taxYearStart = today.getMonth() >= 2 // March = month 2
    ? new Date(today.getFullYear(), 2, 1)
    : new Date(today.getFullYear() - 1, 2, 1);
  // Default 'to' = end of previous month
  const to = new Date(today.getFullYear(), today.getMonth(), 0);
  return { from: toISO(taxYearStart), to: toISO(to) };
}

export function GenerateButtons({ entities, defaultEntityId }: Props) {
  const def = defaultPeriod();
  const [entityId, setEntityId] = useState(defaultEntityId);
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);

  function open(type: 'income' | 'balance' | 'cashflow') {
    const url = `/api/reports/management?type=${type}&entity=${entityId}&from=${from}&to=${to}`;
    window.open(url, '_blank');
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Entity</label>
          <select
            value={entityId}
            onChange={e => setEntityId(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {entities.map(en => (
              <option key={en.id} value={en.id}>{en.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">From</label>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">To</label>
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Report buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => open('income')}
          className="group flex flex-col gap-3 rounded-xl border border-border bg-white p-5 text-left hover:border-primary hover:shadow-md transition-all"
        >
          <div className="h-10 w-10 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-green-700" />
          </div>
          <div>
            <p className="font-semibold text-sm">Income Statement</p>
            <p className="text-xs text-muted-foreground mt-0.5">Revenue, expenses, profit / loss for period</p>
          </div>
          <p className="text-xs text-primary font-medium mt-auto">Generate →</p>
        </button>

        <button
          onClick={() => open('balance')}
          className="group flex flex-col gap-3 rounded-xl border border-border bg-white p-5 text-left hover:border-primary hover:shadow-md transition-all"
        >
          <div className="h-10 w-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-blue-700" />
          </div>
          <div>
            <p className="font-semibold text-sm">Balance Sheet</p>
            <p className="text-xs text-muted-foreground mt-0.5">Assets, liabilities, equity as at end date</p>
          </div>
          <p className="text-xs text-primary font-medium mt-auto">Generate →</p>
        </button>

        <button
          onClick={() => open('cashflow')}
          className="group flex flex-col gap-3 rounded-xl border border-border bg-white p-5 text-left hover:border-primary hover:shadow-md transition-all"
        >
          <div className="h-10 w-10 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center">
            <FileText className="h-5 w-5 text-purple-700" />
          </div>
          <div>
            <p className="font-semibold text-sm">Cash Flow</p>
            <p className="text-xs text-muted-foreground mt-0.5">Operating, investing, financing — indirect method</p>
          </div>
          <p className="text-xs text-primary font-medium mt-auto">Generate →</p>
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Each report opens in a new tab. Use Chrome → Print → Save as PDF, then file in <code className="bg-muted px-1 rounded">Accounts/</code>.
      </p>
    </div>
  );
}
