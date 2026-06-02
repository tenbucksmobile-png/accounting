'use client';

import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { taxYearLabel } from '@/lib/tax';

export function TrustYearSelector({ currentYear }: { currentYear: number }) {
  const router = useRouter();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  return (
    <Select
      value={String(currentYear)}
      onValueChange={(v: string | null) => router.push(`?year=${v ?? currentYear}`)}
    >
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map(y => (
          <SelectItem key={y} value={String(y)}>
            {taxYearLabel(y)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
