import Link from 'next/link';
import SettingsForm from '@/app/settings/SettingsForm';

export const metadata = { title: 'Settings · Otto' };

export default function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
      <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-600">
        ← Otto
      </Link>
      <h1 className="mt-4 mb-2 text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mb-8 text-sm leading-relaxed text-neutral-500">
        Otto works with any model: pick a provider, paste your own key. Everything — your data,
        your key, this config — stays on your machine.
      </p>
      <SettingsForm />
    </main>
  );
}
