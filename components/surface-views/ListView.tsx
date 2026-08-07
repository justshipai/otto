import StatusPill from '@/components/surface-views/StatusPill';
import StatusSelect from '@/components/interactive/StatusSelect';
import { formatFieldValue, primaryField, statusField } from '@/lib/format';
import type { Surface, SurfaceRecord } from '@/lib/core/types';

export default function ListView({ surface, records }: { surface: Surface; records: SurfaceRecord[] }) {
  const nameField = primaryField(surface.fields);
  const pillField = statusField(surface.fields);
  const detailFields = surface.fields.filter(
    (f) => f.key !== nameField.key && f.key !== pillField?.key,
  );

  return (
    <div className="rounded-2xl border border-line bg-card px-4">
      {records.map((record) => {
        const pillValue = pillField ? record.values[pillField.key] : null;
        return (
          <div
            key={record.id}
            className="flex items-center justify-between gap-4 border-b border-line/60 py-3.5 last:border-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {formatFieldValue(nameField, record.values[nameField.key] ?? null)}
              </p>
              {detailFields.length > 0 && (
                <p className="mt-0.5 truncate text-xs text-faint">
                  {detailFields
                    .map((field) => formatFieldValue(field, record.values[field.key] ?? null))
                    .filter((text) => text !== '—')
                    .join(' · ')}
                </p>
              )}
            </div>
            {pillField?.options?.length ? (
              <StatusSelect
                recordId={record.id}
                fieldKey={pillField.key}
                value={pillValue === null || pillValue === undefined ? null : String(pillValue)}
                options={pillField.options}
              />
            ) : (
              pillValue !== null && pillValue !== undefined && <StatusPill label={String(pillValue)} />
            )}
          </div>
        );
      })}
      {records.length === 0 && <p className="py-6 text-sm text-faint">Nothing here yet.</p>}
    </div>
  );
}
