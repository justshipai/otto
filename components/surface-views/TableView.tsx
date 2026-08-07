import StatusPill from '@/components/surface-views/StatusPill';
import { formatFieldValue } from '@/lib/format';
import type { Surface, SurfaceRecord } from '@/lib/core/types';

export default function TableView({ surface, records }: { surface: Surface; records: SurfaceRecord[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            {surface.fields.map((field) => (
              <th
                key={field.key}
                className={`px-4 py-2.5 text-xs font-semibold text-faint ${field.type === 'money' || field.type === 'number' ? 'text-right' : ''}`}
              >
                {field.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className="border-b border-line/60 last:border-0">
              {surface.fields.map((field) => {
                const value = record.values[field.key] ?? null;
                if ((field.type === 'status' || field.type === 'select') && value !== null) {
                  return (
                    <td key={field.key} className="px-4 py-3">
                      <StatusPill label={String(value)} />
                    </td>
                  );
                }
                return (
                  <td
                    key={field.key}
                    className={`px-4 py-3 ${field.type === 'money' || field.type === 'number' ? 'text-right tabular-nums' : ''}`}
                  >
                    {formatFieldValue(field, value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {records.length === 0 && <p className="px-4 py-6 text-sm text-faint">Nothing here yet.</p>}
    </div>
  );
}
