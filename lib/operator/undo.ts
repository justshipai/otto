import type { InverseOperation } from '@/lib/core/operations';
import type { Store } from '@/lib/store/store';

/**
 * Undo = replay a batch's stored inverses, newest mutation first. Nothing
 * is computed at undo time — every inverse was captured when the original
 * change was applied, while the previous state was still known.
 *
 * The undo writes its own change-log batch (each replayed inverse gets an
 * inverse of its own), so undoing is itself undoable — that second undo is
 * effectively redo.
 */

export interface UndoResult {
  batchId: string;
  summaries: string[];
}

async function applyInverse(store: Store, inverse: InverseOperation, now: string): Promise<{ summary: string; inverse: InverseOperation } | undefined> {
  switch (inverse.op) {
    case 'deleteSurface': {
      const surface = await store.getSurface(inverse.surfaceId);
      if (!surface) return undefined;
      const records = await store.listRecords(surface.id);
      const automations = await store.listAutomations(surface.id);
      await store.deleteSurface(surface.id);
      return {
        summary: `Removed "${surface.title}"`,
        inverse: { op: 'restoreSurface', surface, records, automations },
      };
    }
    case 'restoreSurface': {
      await store.createSurface(inverse.surface);
      for (const record of inverse.records) {
        await store.createRecord(record);
      }
      for (const automation of inverse.automations) {
        await store.createAutomation(automation);
      }
      return {
        summary: `Put back "${inverse.surface.title}"`,
        inverse: { op: 'deleteSurface', surfaceId: inverse.surface.id },
      };
    }
    case 'deleteRecord': {
      const record = await store.getRecord(inverse.recordId);
      if (!record) return undefined;
      await store.deleteRecord(record.id);
      return { summary: 'Removed an item', inverse: { op: 'restoreRecord', record } };
    }
    case 'restoreRecord': {
      await store.createRecord(inverse.record);
      return { summary: 'Put back an item', inverse: { op: 'deleteRecord', recordId: inverse.record.id } };
    }
    case 'restoreRecordValues': {
      const record = await store.getRecord(inverse.recordId);
      if (!record) return undefined;
      await store.updateRecord(inverse.recordId, { values: inverse.values, updatedAt: now });
      return {
        summary: 'Reverted an item',
        inverse: { op: 'restoreRecordValues', recordId: inverse.recordId, values: record.values },
      };
    }
    case 'restoreSurfaceFields': {
      const surface = await store.getSurface(inverse.surfaceId);
      if (!surface) return undefined;
      await store.updateSurface(inverse.surfaceId, { fields: inverse.fields, updatedAt: now });
      return {
        summary: `Reverted the fields on "${surface.title}"`,
        inverse: { op: 'restoreSurfaceFields', surfaceId: inverse.surfaceId, fields: surface.fields },
      };
    }
    case 'deleteAutomation': {
      await store.deleteAutomation(inverse.automationId);
      return { summary: 'Removed an automation', inverse: { op: 'none' } };
    }
    case 'none':
      return undefined;
  }
}

export async function undoBatch(store: Store, batchId: string): Promise<UndoResult> {
  if (!batchId) {
    throw new Error('Nothing to undo.');
  }
  const entries = await store.listBatchChanges(batchId);
  if (entries.length === 0) {
    throw new Error('Nothing to undo.');
  }

  const undoBatchId = crypto.randomUUID();
  const summaries: string[] = [];

  for (const entry of [...entries].reverse()) {
    const now = new Date().toISOString();
    const applied = await applyInverse(store, entry.inverse, now);
    if (!applied) {
      continue;
    }
    summaries.push(applied.summary);
    await store.appendChange({
      id: crypto.randomUUID(),
      batchId: undoBatchId,
      createdAt: now,
      summary: `Undid: ${entry.summary}`,
      operation: entry.inverse,
      inverse: applied.inverse,
    });
  }

  if (summaries.length === 0) {
    throw new Error('That change is no longer undoable — things have moved on since.');
  }

  return { batchId: undoBatchId, summaries };
}
