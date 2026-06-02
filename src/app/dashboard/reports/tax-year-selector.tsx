'use client';
import { useRouter, usePathname } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function TaxYearSelector({ currentYear }: { currentYear: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const years = [2025, 2026, 2027, 2028];

  return (
    <Select
      value={String(currentYear)}
      onValueChange={(v: string | null) => router.push(`${pathname}?year=${v ?? currentYear}`)}
    >
      <SelectTrigger className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map(y => (
          <SelectItem key={y} value={String(y)}>
            {y - 1}/{String(y).slice(2)} tax year
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
