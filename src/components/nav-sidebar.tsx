'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, BookOpen, AlertTriangle, TrendingUp, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const nav = [
  { label: 'Dashboard',       href: '/dashboard',          icon: LayoutDashboard },
  { label: 'Entities',        href: '/dashboard/entities', icon: Building2 },
  { label: 'Chart of Accounts', href: '/dashboard/accounts', icon: BookOpen },
  { label: 'Section 7C Loans', href: '/dashboard/loans',  icon: AlertTriangle },
  // Phase 2+
  { label: 'Transactions',    href: '/dashboard/transactions', icon: TrendingUp,  soon: true },
  { label: 'Tax Reports',     href: '/dashboard/reports',     icon: FileText,     soon: true },
];

export function NavSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r bg-white flex flex-col min-h-screen">
      {/* Logo */}
      <div className="px-6 py-5 border-b">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tenbucks</p>
        <p className="text-lg font-bold text-foreground leading-tight">Accounting</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ label, href, icon: Icon, soon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={soon ? '#' : href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                soon && 'opacity-40 cursor-not-allowed pointer-events-none',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
              {soon && (
                <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide bg-muted px-1.5 py-0.5 rounded">
                  Soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-6 py-4 border-t">
        <p className="text-xs text-muted-foreground">SA tax year: 1 Mar – 28 Feb</p>
        <p className="text-xs text-muted-foreground">CIT rate: 27% &nbsp;|&nbsp; Trust: 45%</p>
      </div>
    </aside>
  );
}
