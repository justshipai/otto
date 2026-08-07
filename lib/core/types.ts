import { z } from 'zod';

/**
 * Otto's entire data model. Five generic entities, nothing else.
 *
 * A "job search board" and a "money owed tracker" are both just Surfaces
 * with different fields and view types. Never add per-vertical tables or
 * per-vertical types — genericity is a core design constraint.
 *
 * zod schemas are the source of truth; the exported types are inferred from
 * them so the runtime validation and the static types can never drift apart.
 */

// 'doc' renders records as titled sections — long-form deliverables (a prep
// document, a briefing) are still just surfaces with records, fully editable
// and undoable like everything else
export const viewTypeSchema = z.enum(['table', 'board', 'list', 'doc']);
export type ViewType = z.infer<typeof viewTypeSchema>;

// 'longtext' is multi-paragraph prose (doc section bodies, notes)
export const fieldTypeSchema = z.enum(['text', 'longtext', 'number', 'money', 'date', 'status', 'select']);
export type FieldType = z.infer<typeof fieldTypeSchema>;

/**
 * One column/attribute of a surface. `key` is the stable identifier records
 * store values under; `label` is what the user sees and can be renamed freely.
 */
export const fieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9_]*$/, 'field keys are camelCase identifiers'),
  label: z.string().min(1),
  type: fieldTypeSchema,
  // for 'status' and 'select' fields: the allowed choices, in display order
  options: z.array(z.string().min(1)).optional(),
});
export type Field = z.infer<typeof fieldSchema>;

export const surfaceSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  // a single emoji used as the surface's icon in Home and Library
  icon: z.string().min(1),
  viewType: viewTypeSchema,
  fields: z.array(fieldSchema).min(1),
  pinned: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Surface = z.infer<typeof surfaceSchema>;

/**
 * A cell value. Kept deliberately primitive so every Store adapter and every
 * LLM provider can round-trip values without special cases:
 * - text/status/select → string
 * - number/money → number (money is a plain amount in the user's currency)
 * - date → ISO date string, e.g. "2026-08-07"
 * - missing/cleared → null
 */
export const fieldValueSchema = z.union([z.string(), z.number(), z.null()]);
export type FieldValue = z.infer<typeof fieldValueSchema>;

export const recordValuesSchema = z.record(z.string(), fieldValueSchema);
export type RecordValues = z.infer<typeof recordValuesSchema>;

/**
 * One row/card/item on a surface. Named SurfaceRecord (not Record) only to
 * avoid clashing with TypeScript's built-in Record<K, V> utility type — in
 * the product and docs these are just called records.
 */
export const surfaceRecordSchema = z.object({
  id: z.string(),
  surfaceId: z.string(),
  // keyed by field key; keys not present in the surface's fields are ignored
  values: recordValuesSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type SurfaceRecord = z.infer<typeof surfaceRecordSchema>;

export const automationKindSchema = z.enum(['reminder', 'watch']);
export type AutomationKind = z.infer<typeof automationKindSchema>;

/**
 * When an automation fires: a condition over one field of the surface's
 * records, e.g. { fieldKey: 'due', condition: 'past' } → "a due date passed".
 */
export const automationTriggerSchema = z.object({
  fieldKey: z.string(),
  condition: z.enum(['past', 'today', 'withinDays', 'equals']),
  // days for 'withinDays', the value to match for 'equals'
  value: z.union([z.string(), z.number()]).optional(),
});
export type AutomationTrigger = z.infer<typeof automationTriggerSchema>;

/**
 * What happens when the trigger fires. 'notify' surfaces the item in Home's
 * "Needs attention" section with this message. Outbound actions (email, SMS)
 * are deliberately NOT automation actions — anything leaving the machine goes
 * through draftAction and explicit user approval instead.
 */
export const automationActionSchema = z.object({
  kind: z.literal('notify'),
  message: z.string().min(1),
});
export type AutomationAction = z.infer<typeof automationActionSchema>;

export const automationSchema = z.object({
  id: z.string(),
  surfaceId: z.string(),
  kind: automationKindSchema,
  trigger: automationTriggerSchema,
  action: automationActionSchema,
  enabled: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Automation = z.infer<typeof automationSchema>;

// ChangeLogEntry lives in lib/core/operations.ts, next to the Operation and
// InverseOperation types it records
