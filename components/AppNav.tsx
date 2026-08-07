'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Home' },
  { href: '/library', label: 'Library' },
] as const;

export default function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 pb-4">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              active
                ? 'rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-cream'
                : 'rounded-full px-4 py-1.5 text-sm font-semibold text-faint hover:text-ink'
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
