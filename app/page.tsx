import Link from 'next/link';
import { getStore } from '@/lib/store';
import type { Field, FieldValue } from '@/lib/core/types';

// always read the local database live — nothing in Otto is prerendered
export const dynamic = 'force-dynamic';

/**
 * TEMPORARY milestone-1 proof page: reads the seeded surface through the
 * Store interface and renders it as a plain table, verifying the whole
 * chain (SQLite file → adapter → interface → UI). Milestone 3 replaces
 * this with the real Home / Library / renderer.
 */

function formatValue(field: Field, value: FieldValue): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (field.type === 'money' && typeof value === 'number') {
    return `$${value.toLocaleString()}`;
  }
  return String(value);
}

export default async function Home() {
  const store = await getStore();
  const surfaces = await store.listSurfaces();
  const surface = surfaces[0];
  const records = surface ? await store.listRecords(surface.id) : [];

  if (!surface) {
    return <main className="p-10 text-neutral-500">No surfaces yet.</main>;
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <p className="mb-8 flex items-center justify-between text-sm text-neutral-400">
        <span>
          Otto · milestone 2 — temporary proof page (data read from data/otto.db via the Store
          interface)
        </span>
        <Link href="/settings" className="hover:text-neutral-600">
          Settings →
        </Link>
      </p>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        <span className="mr-2">{surface.icon}</span>
        {surface.title}
      </h1>
      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
              {surface.fields.map((field) => (
                <th key={field.key} className="px-4 py-2.5 font-medium text-neutral-500">
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-b border-neutral-100 last:border-0">
                {surface.fields.map((field) => (
                  <td key={field.key} className="px-4 py-2.5">
                    {formatValue(field, record.values[field.key] ?? null)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-neutral-400">
        {records.length} records · view type: {surface.viewType}
        {surface.pinned ? ' · pinned' : ''}
      </p>
    </main>
  );
}
