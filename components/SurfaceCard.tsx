import Link from 'next/link';
import StatusPill from '@/components/surface-views/StatusPill';
import { formatFieldValue, primaryField, statusField } from '@/lib/format';
import type { Surface, SurfaceRecord } from '@/lib/core/types';

/**
 * A surface summary card. With `preview` records it renders a few rows
 * inline (Home); without, it's a compact gallery tile (Library).
 */
export default function SurfaceCard({
  surface,
  recordCount,
  preview,
}: {
  surface: Surface;
  recordCount: number;
  preview?: SurfaceRecord[];
}) {
  const nameField = primaryField(surface.fields);
  const pillField = statusField(surface.fields);
  const shown = preview?.slice(0, 3) ?? [];

  return (
    <Link
      href={`/surface/${surface.id}`}
      className="block rounded-2xl border border-line bg-card transition-shadow hover:shadow-sm"
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cream text-lg">
          {surface.icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{surface.title}</p>
          <p className="text-xs text-faint">
            {recordCount} {recordCount === 1 ? 'item' : 'items'}
          </p>
        </div>
        {surface.pinned && (
          <span className="ml-auto text-faint" title="Pinned" aria-label="Pinned">
            ★
          </span>
        )}
      </div>
      {shown.length > 0 && (
        <div className="border-t border-line/60 px-4">
          {shown.map((record) => {
            const pillValue = pillField ? record.values[pillField.key] : null;
            return (
              <div
                key={record.id}
                className="flex items-center justify-between gap-3 border-b border-line/40 py-2.5 last:border-0"
              >
                <p className="truncate text-sm">
                  {formatFieldValue(nameField, record.values[nameField.key] ?? null)}
                </p>
                {pillValue !== null && pillValue !== undefined && (
                  <StatusPill label={String(pillValue)} />
                )}
              </div>
            );
          })}
          {recordCount > shown.length && (
            <p className="py-2 text-xs text-faint">+{recordCount - shown.length} more</p>
          )}
        </div>
      )}
    </Link>
  );
}
