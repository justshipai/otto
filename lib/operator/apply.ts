import type { DraftActionOp, InverseOperation, Operation } from '@/lib/core/operations';
import type { Automation, Surface, SurfaceRecord } from '@/lib/core/types';
import type { Store } from '@/lib/store/store';

/**
 * Applies a validated operation list to the store, in order. Every applied
 * mutation gets an append-only change-log entry with its pre-computed
 * inverse (the undo). draftAction is deliberately NOT applied — destructive
 * and outbound actions wait for the approval flow (milestone 6).
 *
 * Ops reference surfaces by id or exact title, including surfaces created
 * earlier in the same batch — models can't know ids we haven't generated.
 */

export interface ApplyResult {
  /** plain-language lines shown to the user, in order */
  replyParts: string[];
  createdSurfaceIds: string[];
  appliedCount: number;
  /** proposed destructive/outbound actions awaiting the user's approval */
  drafts: DraftActionOp[];
  /** ops we understood but couldn't target */
  skipped: string[];
}

function resolveSurface(
  ref: string,
  surfaces: Surface[],
  createdThisBatch: Map<string, Surface>,
): Surface | undefined {
  const byTitle = ref.trim().toLowerCase();
  return (
    surfaces.find((s) => s.id === ref) ??
    createdThisBatch.get(byTitle) ??
    surfaces.find((s) => s.title.toLowerCase() === byTitle)
  );
}

export async function applyOperations(
  store: Store,
  operations: Operation[],
  batchId: string,
): Promise<ApplyResult> {
  const surfaces = await store.listSurfaces();
  const createdThisBatch = new Map<string, Surface>();
  const result: ApplyResult = {
    replyParts: [],
    createdSurfaceIds: [],
    appliedCount: 0,
    drafts: [],
    skipped: [],
  };
  let recordsAddedTo: Surface | undefined;
  let recordsAdded = 0;

  async function log(summary: string, operation: Operation, inverse: InverseOperation) {
    await store.appendChange({
      id: crypto.randomUUID(),
      batchId,
      createdAt: new Date().toISOString(),
      summary,
      operation,
      inverse,
    });
    result.appliedCount += 1;
  }

  for (const op of operations) {
    const now = new Date().toISOString();

    switch (op.op) {
      case 'answer': {
        result.replyParts.push(op.text);
        break;
      }

      case 'createSurface': {
        const surface: Surface = {
          id: crypto.randomUUID(),
          title: op.title,
          icon: op.icon,
          viewType: op.viewType,
          fields: op.fields,
          pinned: false,
          createdAt: now,
          updatedAt: now,
        };
        await store.createSurface(surface);
        surfaces.push(surface);
        createdThisBatch.set(surface.title.toLowerCase(), surface);
        result.createdSurfaceIds.push(surface.id);
        result.replyParts.push(op.narration);
        await log(`Created "${surface.title}"`, op, { op: 'deleteSurface', surfaceId: surface.id });
        break;
      }

      case 'addRecord': {
        const surface = resolveSurface(op.surface, surfaces, createdThisBatch);
        if (!surface) {
          result.skipped.push(`couldn't find a surface called "${op.surface}"`);
          break;
        }
        const knownKeys = new Set(surface.fields.map((f) => f.key));
        const values = Object.fromEntries(
          Object.entries(op.values).filter(([key]) => knownKeys.has(key)),
        );
        const record: SurfaceRecord = {
          id: crypto.randomUUID(),
          surfaceId: surface.id,
          values,
          createdAt: now,
          updatedAt: now,
        };
        await store.createRecord(record);
        recordsAddedTo = surface;
        recordsAdded += 1;
        await log(`Added an item to "${surface.title}"`, op, { op: 'deleteRecord', recordId: record.id });
        break;
      }

      case 'updateRecord': {
        const existing = await store.getRecord(op.recordId);
        if (!existing) {
          result.skipped.push(`couldn't find that item to update`);
          break;
        }
        const surface = surfaces.find((s) => s.id === existing.surfaceId);
        const merged = { ...existing.values, ...op.values };
        await store.updateRecord(op.recordId, { values: merged, updatedAt: now });
        result.replyParts.push(`Updated ${surface ? `an item in "${surface.title}"` : 'an item'}.`);
        await log(`Updated an item in "${surface?.title ?? 'a surface'}"`, op, {
          op: 'restoreRecordValues',
          recordId: existing.id,
          values: existing.values,
        });
        break;
      }

      case 'addField': {
        const surface = resolveSurface(op.surface, surfaces, createdThisBatch);
        if (!surface) {
          result.skipped.push(`couldn't find a surface called "${op.surface}"`);
          break;
        }
        if (surface.fields.some((f) => f.key === op.field.key)) {
          result.skipped.push(`"${surface.title}" already has a ${op.field.label} field`);
          break;
        }
        const previousFields = surface.fields;
        surface.fields = [...surface.fields, op.field];
        await store.updateSurface(surface.id, { fields: surface.fields, updatedAt: now });
        result.replyParts.push(`Added a ${op.field.label} field to "${surface.title}".`);
        await log(`Added field "${op.field.label}" to "${surface.title}"`, op, {
          op: 'restoreSurfaceFields',
          surfaceId: surface.id,
          fields: previousFields,
        });
        break;
      }

      case 'updateField': {
        const surface = resolveSurface(op.surface, surfaces, createdThisBatch);
        const field = surface?.fields.find((f) => f.key === op.key);
        if (!surface || !field) {
          result.skipped.push(`couldn't find that field to change`);
          break;
        }
        const previousFields = surface.fields;
        surface.fields = surface.fields.map((f) => (f.key === op.key ? { ...f, ...op.changes } : f));
        await store.updateSurface(surface.id, { fields: surface.fields, updatedAt: now });
        result.replyParts.push(`Changed the ${field.label} field on "${surface.title}".`);
        await log(`Changed field "${field.label}" on "${surface.title}"`, op, {
          op: 'restoreSurfaceFields',
          surfaceId: surface.id,
          fields: previousFields,
        });
        break;
      }

      case 'pinSurface': {
        const surface = resolveSurface(op.surface, surfaces, createdThisBatch);
        if (!surface) {
          result.skipped.push(`couldn't find a surface called "${op.surface}"`);
          break;
        }
        const previousPinned = surface.pinned;
        if (previousPinned === op.pinned) {
          break;
        }
        surface.pinned = op.pinned;
        await store.updateSurface(surface.id, { pinned: op.pinned, updatedAt: now });
        result.replyParts.push(`${op.pinned ? 'Pinned' : 'Unpinned'} "${surface.title}".`);
        await log(`${op.pinned ? 'Pinned' : 'Unpinned'} "${surface.title}"`, op, {
          op: 'restorePinned',
          surfaceId: surface.id,
          pinned: previousPinned,
        });
        break;
      }

      case 'createAutomation': {
        const surface = resolveSurface(op.surface, surfaces, createdThisBatch);
        if (!surface) {
          result.skipped.push(`couldn't find a surface called "${op.surface}"`);
          break;
        }
        const automation: Automation = {
          id: crypto.randomUUID(),
          surfaceId: surface.id,
          kind: op.kind,
          trigger: op.trigger,
          action: op.action,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        };
        await store.createAutomation(automation);
        result.replyParts.push(`Saved a ${op.kind} on "${surface.title}" — it starts checking in an upcoming update.`);
        await log(`Saved a ${op.kind} on "${surface.title}"`, op, {
          op: 'deleteAutomation',
          automationId: automation.id,
        });
        break;
      }

      case 'webSearch':
      case 'readPage': {
        // research requests are executed by the operator loop before ops
        // reach here (lib/operator/research.ts); they never touch the store
        result.skipped.push('a research request arrived where it could not run');
        break;
      }

      case 'draftAction': {
        // never applied here — surfaced to the user for approval; the
        // approve endpoint re-validates and applies with an inverse
        result.drafts.push(op);
        break;
      }
    }
  }

  if (recordsAdded > 0 && recordsAddedTo) {
    result.replyParts.push(
      `Added ${recordsAdded} ${recordsAdded === 1 ? 'item' : 'items'} to "${recordsAddedTo.title}".`,
    );
  }

  return result;
}
