import type { DraftActionOp } from '@/lib/core/operations';
import { getSender } from '@/lib/outbound';
import type { Store } from '@/lib/store/store';

/**
 * Applies a draftAction the user explicitly approved. This is the ONLY
 * code path that performs destructive or outbound work, and it runs only
 * after the approve button — never directly from a model response. The
 * draft is re-validated against the operation schema at the API boundary
 * before it reaches here, and every applied draft is logged with an
 * inverse like any other change (outbound sends get inverse 'none': you
 * can't unsend, which is exactly why they're approval-gated).
 */

export interface AppliedDraft {
  reply: string;
  batchId: string;
  appliedCount: number;
}

function payloadString(draft: DraftActionOp, key: string): string | undefined {
  const value = draft.payload[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export async function applyDraft(store: Store, draft: DraftActionOp): Promise<AppliedDraft> {
  const batchId = crypto.randomUUID();
  const now = new Date().toISOString();

  switch (draft.kind) {
    case 'deleteRecord': {
      const recordId = payloadString(draft, 'recordId');
      const record = recordId ? await store.getRecord(recordId) : undefined;
      if (!record) {
        throw new Error("That item doesn't exist any more.");
      }
      const surface = await store.getSurface(record.surfaceId);
      await store.deleteRecord(record.id);
      await store.appendChange({
        id: crypto.randomUUID(),
        batchId,
        createdAt: now,
        summary: `Removed an item from "${surface?.title ?? 'a surface'}" (approved)`,
        operation: draft,
        inverse: { op: 'restoreRecord', record },
      });
      return { reply: 'Removed it.', batchId, appliedCount: 1 };
    }

    case 'deleteSurface': {
      const ref = payloadString(draft, 'surface');
      const surfaces = await store.listSurfaces();
      const surface = ref
        ? (surfaces.find((s) => s.id === ref) ??
          surfaces.find((s) => s.title.toLowerCase() === ref.trim().toLowerCase()))
        : undefined;
      if (!surface) {
        throw new Error("That surface doesn't exist any more.");
      }
      const records = await store.listRecords(surface.id);
      const automations = await store.listAutomations(surface.id);
      await store.deleteSurface(surface.id);
      await store.appendChange({
        id: crypto.randomUUID(),
        batchId,
        createdAt: now,
        summary: `Deleted "${surface.title}" and its ${records.length} items (approved)`,
        operation: draft,
        inverse: { op: 'restoreSurface', surface, records, automations },
      });
      return { reply: `Deleted "${surface.title}". Undo will bring it back whole.`, batchId, appliedCount: 1 };
    }

    case 'sendMessage': {
      const to = payloadString(draft, 'to');
      const body = payloadString(draft, 'body');
      if (!to || !body) {
        throw new Error('The draft message was missing a recipient or body — ask Otto to redo it.');
      }
      const sender = getSender();
      await sender.send({ to, subject: payloadString(draft, 'subject'), body });
      await store.appendChange({
        id: crypto.randomUUID(),
        batchId,
        createdAt: now,
        summary: `Sent a message to ${to} (no real delivery yet — Otto ships without outbound)`,
        operation: draft,
        inverse: { op: 'none' },
      });
      return {
        reply: `Marked as sent to ${to}. Heads-up: Otto doesn't actually deliver messages yet — a contributor can add a real sender.`,
        batchId,
        appliedCount: 1,
      };
    }
  }
}
