import { z } from 'zod';
import {
  automationActionSchema,
  automationKindSchema,
  automationTriggerSchema,
  fieldSchema,
  fieldTypeSchema,
  recordValuesSchema,
  viewTypeSchema,
} from '@/lib/core/types';
import type { Automation, Surface, SurfaceRecord } from '@/lib/core/types';

/**
 * The complete set of operations an LLM may emit. This is Otto's safety
 * boundary: models never produce code, only values validated against these
 * schemas, so the blast radius of any model — good or bad — is bounded by
 * what this file allows. Do not widen it casually, and never add an
 * operation that executes model-provided logic.
 *
 * Every op that targets a surface uses a `surface` string that may be either
 * an existing surface id, or the exact title of a surface — including one
 * created earlier in the same response. That lets a model say "create the
 * surface, then add these five records to it" without knowing generated ids.
 */

export const createSurfaceOpSchema = z.object({
  op: z.literal('createSurface'),
  title: z.string().min(1),
  icon: z.string().min(1).describe('a single emoji representing the surface'),
  viewType: viewTypeSchema,
  fields: z.array(fieldSchema).min(1),
  narration: z
    .string()
    .min(1)
    .describe('one plain-language line shown to the user explaining what was set up and why'),
});

export const addFieldOpSchema = z.object({
  op: z.literal('addField'),
  surface: z.string().min(1),
  field: fieldSchema,
});

export const updateFieldOpSchema = z.object({
  op: z.literal('updateField'),
  surface: z.string().min(1),
  key: z.string().min(1),
  changes: z
    .object({
      label: z.string().min(1).optional(),
      type: fieldTypeSchema.optional(),
      options: z.array(z.string().min(1)).optional(),
    })
    .refine((c) => Object.keys(c).length > 0, 'changes must not be empty'),
});

export const addRecordOpSchema = z.object({
  op: z.literal('addRecord'),
  surface: z.string().min(1),
  values: recordValuesSchema,
});

export const updateRecordOpSchema = z.object({
  op: z.literal('updateRecord'),
  recordId: z.string().min(1),
  // partial: only the listed keys change, everything else is kept
  values: recordValuesSchema,
});

export const pinSurfaceOpSchema = z.object({
  op: z.literal('pinSurface'),
  surface: z.string().min(1),
  pinned: z.boolean(),
});

export const createAutomationOpSchema = z.object({
  op: z.literal('createAutomation'),
  surface: z.string().min(1),
  kind: automationKindSchema,
  trigger: automationTriggerSchema,
  action: automationActionSchema,
});

/**
 * Research request operations: the model asking Otto to look something up.
 * They NEVER touch the store — the operator executes them (when research is
 * enabled in Settings), feeds the results back as data, and the model
 * continues. The model itself can't fetch anything. See lib/operator/research.ts.
 */
export const webSearchOpSchema = z.object({
  op: z.literal('webSearch'),
  query: z.string().min(1).max(400),
});

export const readPageOpSchema = z.object({
  op: z.literal('readPage'),
  url: z.string().min(1).max(2000),
});

/**
 * Anything destructive or outbound is never applied directly — the model
 * proposes it as a draft and the user approves or dismisses it in the UI.
 */
export const draftActionOpSchema = z.object({
  op: z.literal('draftAction'),
  kind: z.enum(['sendMessage', 'deleteRecord', 'deleteSurface']),
  description: z
    .string()
    .min(1)
    .describe('plain-language description of exactly what will happen, shown for approval'),
  // sendMessage: { to, subject?, body } — deleteRecord: { recordId } — deleteSurface: { surface }
  payload: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
});

/** A plain conversational reply when no change to the workspace is needed. */
export const answerOpSchema = z.object({
  op: z.literal('answer'),
  text: z.string().min(1),
});

export type DraftActionOp = z.infer<typeof draftActionOpSchema>;

export const operationSchema = z.discriminatedUnion('op', [
  createSurfaceOpSchema,
  addFieldOpSchema,
  updateFieldOpSchema,
  addRecordOpSchema,
  updateRecordOpSchema,
  pinSurfaceOpSchema,
  createAutomationOpSchema,
  webSearchOpSchema,
  readPageOpSchema,
  draftActionOpSchema,
  answerOpSchema,
]);
export type Operation = z.infer<typeof operationSchema>;

/** What the operator expects back from every LLM call: a list of operations. */
export const operationListSchema = z.array(operationSchema).min(1);
export type OperationList = z.infer<typeof operationListSchema>;

/**
 * JSON Schema version of the operation list, for providers without native
 * structured output (plain-text local models get this embedded in the prompt;
 * tool-calling providers get it as a tool definition).
 */
export function operationListJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(operationListSchema) as Record<string, unknown>;
}

/**
 * The internal reversal of an applied operation, pre-computed at apply time
 * while the previous state is still known. These are NOT part of the model
 * vocabulary — only the operator constructs them, and only undo replays them.
 */
export type InverseOperation =
  | { op: 'deleteSurface'; surfaceId: string }
  | { op: 'restoreSurface'; surface: Surface; records: SurfaceRecord[]; automations: Automation[] }
  | { op: 'deleteRecord'; recordId: string }
  | { op: 'restoreRecord'; record: SurfaceRecord }
  | { op: 'restoreRecordValues'; recordId: string; values: z.infer<typeof recordValuesSchema> }
  | { op: 'restoreSurfaceFields'; surfaceId: string; fields: Surface['fields'] }
  | { op: 'restorePinned'; surfaceId: string; pinned: boolean }
  | { op: 'deleteAutomation'; automationId: string }
  // for answer/draftAction entries: nothing to undo
  | { op: 'none' };

/**
 * One entry in the append-only change log. Every mutation Otto applies is
 * recorded here with its inverse, which is what makes "trust through
 * visibility and undo" possible. Entries are never updated or deleted;
 * undo appends a new batch of entries that apply the inverses — so an
 * undo is itself undoable.
 *
 * `operation` is a model Operation for normal entries; for undo entries it
 * is the InverseOperation that was replayed.
 */
export interface ChangeLogEntry {
  id: string;
  // one batch per operator run / approved draft / undo; Undo acts on whole batches
  batchId: string;
  createdAt: string;
  // plain-language, user-facing, e.g. "Added Acme Co to Clients who owe me money"
  summary: string;
  operation: Operation | InverseOperation;
  inverse: InverseOperation;
}
