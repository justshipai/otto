import StatusPill from '@/components/surface-views/StatusPill';
import StatusSelect from '@/components/interactive/StatusSelect';
import { formatFieldValue, primaryField, statusField } from '@/lib/format';
import type { Surface, SurfaceRecord } from '@/lib/core/types';
import TableView from '@/components/surface-views/TableView';

/**
 * Columns come from the surface's first status/select field, in option
 * order. A board without such a field falls back to the table view rather
 * than inventing columns.
 */
export default function BoardView({ surface, records }: { surface: Surface; records: SurfaceRecord[] }) {
  const groupField = statusField(surface.fields);
  if (!groupField?.options?.length) {
    return <TableView surface={surface} records={records} />;
  }

  const nameField = primaryField(surface.fields);
  const detailFields = surface.fields
    .filter((f) => f.key !== nameField.key && f.key !== groupField.key)
    .slice(0, 2);

  const columns = groupField.options.map((option) => ({
    option,
    records: records.filter((r) => r.values[groupField.key] === option),
  }));
  const unassigned = records.filter(
    (r) => !groupField.options?.includes(String(r.values[groupField.key] ?? '')),
  );

  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <div className="flex items-start gap-3">
        {[...columns, ...(unassigned.length ? [{ option: 'No status', records: unassigned }] : [])].map(
          (column) => (
            <div key={column.option} className="w-52 shrink-0 rounded-2xl bg-line/40 p-2">
              <p className="flex items-center justify-between px-2 py-1.5">
                <StatusPill label={column.option} />
                <span className="text-xs text-faint">{column.records.length}</span>
              </p>
              <div className="flex flex-col gap-2">
                {column.records.map((record) => (
                  <div key={record.id} className="rounded-xl border border-line bg-card px-3 py-2.5">
                    <p className="text-sm font-medium">
                      {formatFieldValue(nameField, record.values[nameField.key] ?? null)}
                    </p>
                    {detailFields.map((field) => {
                      const value = record.values[field.key] ?? null;
                      return value === null ? null : (
                        <p key={field.key} className="mt-1 text-xs text-faint">
                          {formatFieldValue(field, value)}
                        </p>
                      );
                    })}
                    {/* tap to move the card to another column */}
                    <div className="mt-2">
                      <StatusSelect
                        recordId={record.id}
                        fieldKey={groupField.key}
                        value={
                          record.values[groupField.key] === null ||
                          record.values[groupField.key] === undefined
                            ? null
                            : String(record.values[groupField.key])
                        }
                        options={groupField.options ?? []}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
