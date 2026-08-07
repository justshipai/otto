import EditableCell from '@/components/interactive/EditableCell';
import StatusSelect from '@/components/interactive/StatusSelect';
import type { Surface, SurfaceRecord } from '@/lib/core/types';

/**
 * Every cell is directly editable — status/select values via a tap-to-pick
 * pill, everything else via click-to-edit. Edits are the same validated,
 * undoable operations the model emits.
 */
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
                if ((field.type === 'status' || field.type === 'select') && field.options?.length) {
                  return (
                    <td key={field.key} className="px-4 py-2.5">
                      <StatusSelect
                        recordId={record.id}
                        fieldKey={field.key}
                        value={value === null ? null : String(value)}
                        options={field.options}
                      />
                    </td>
                  );
                }
                return (
                  <td key={field.key} className="px-3.5 py-2">
                    <EditableCell recordId={record.id} field={field} value={value} />
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
