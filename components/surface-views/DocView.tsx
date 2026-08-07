import EditableTextBlock from '@/components/interactive/EditableTextBlock';
import { primaryField } from '@/lib/format';
import type { Surface, SurfaceRecord } from '@/lib/core/types';
import ListView from '@/components/surface-views/ListView';

/**
 * Long-form deliverables (a prep document, a briefing) as a fixed renderer:
 * each record is a section — a text heading plus a longtext body — drawn
 * as titled prose. Still just config + records: sections are editable in
 * place, reshapeable by talking, and every edit is undoable. A doc surface
 * without a longtext field falls back to the list view.
 */
export default function DocView({ surface, records }: { surface: Surface; records: SurfaceRecord[] }) {
  const headingField = primaryField(surface.fields);
  const bodyField = surface.fields.find((f) => f.type === 'longtext');
  if (!bodyField) {
    return <ListView surface={surface} records={records} />;
  }
  const hasHeading = headingField.key !== bodyField.key;

  return (
    <article className="rounded-2xl border border-line bg-card px-6 py-5">
      {records.map((record) => {
        const heading = record.values[headingField.key];
        return (
          <section key={record.id} className="border-b border-line/60 py-4 first:pt-1 last:border-0 last:pb-1">
            {hasHeading && heading !== null && heading !== undefined && (
              <h2 className="pb-2 text-base font-semibold tracking-tight">{String(heading)}</h2>
            )}
            <EditableTextBlock
              recordId={record.id}
              fieldKey={bodyField.key}
              value={record.values[bodyField.key] === null || record.values[bodyField.key] === undefined ? null : String(record.values[bodyField.key])}
              placeholder="Empty section — click to write, or ask Otto."
            />
          </section>
        );
      })}
      {records.length === 0 && <p className="py-4 text-sm text-faint">Nothing here yet.</p>}
    </article>
  );
}
