import Link from 'next/link';
import AppNav from '@/components/AppNav';
import Composer from '@/components/Composer';

export default function ShellLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5">
      <header className="flex items-center justify-between pt-8 pb-5">
        <Link href="/" className="flex items-baseline gap-2.5">
          <span className="flex size-9 translate-y-1.5 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white">
            O
          </span>
          <span className="text-xl font-bold tracking-tight">Otto</span>
          <span className="text-lg text-faint">your operator</span>
        </Link>
        <Link href="/settings" className="text-sm text-faint hover:text-ink">
          Settings
        </Link>
      </header>
      <AppNav />
      <div className="flex-1 border-t border-line py-6">{children}</div>
      <Composer />
    </div>
  );
}
