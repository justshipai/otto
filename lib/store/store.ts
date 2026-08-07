import type { Automation, Surface, SurfaceRecord } from '@/lib/core/types';
import type { ChangeLogEntry } from '@/lib/core/operations';

/**
 * Store is Otto's persistence seam and one of its two primary extension
 * points (the other is LLMProvider in lib/llm/provider.ts).
 *
 * The rest of the app talks ONLY to this interface — no SQL, no database
 * client, no file paths anywhere else. To add a new backend (Postgres,
 * a sync server, anything), implement this interface in one new file under
 * lib/store/ and wire it up in lib/store/index.ts. Nothing else changes.
 *
 * Contract notes for implementers:
 * - Callers construct complete entities (ids, timestamps) before writing;
 *   the store persists exactly what it is given and never invents data.
 * - All methods are async even where a backend is synchronous (like the
 *   default SQLite adapter), so network-backed adapters fit the same shape.
 * - Deleting a surface deletes its records and automations with it.
 * - The change log is append-only: there is deliberately no update or
 *   delete for entries. Undo works by appending a compensating entry.
 */
export interface Store {
  // surfaces
  listSurfaces(): Promise<Surface[]>;
  getSurface(id: string): Promise<Surface | undefined>;
  createSurface(surface: Surface): Promise<void>;
  updateSurface(id: string, changes: Partial<Omit<Surface, 'id' | 'createdAt'>>): Promise<void>;
  deleteSurface(id: string): Promise<void>;

  // records
  listRecords(surfaceId: string): Promise<SurfaceRecord[]>;
  getRecord(id: string): Promise<SurfaceRecord | undefined>;
  createRecord(record: SurfaceRecord): Promise<void>;
  updateRecord(id: string, changes: Partial<Omit<SurfaceRecord, 'id' | 'surfaceId' | 'createdAt'>>): Promise<void>;
  deleteRecord(id: string): Promise<void>;

  // automations
  listAutomations(surfaceId?: string): Promise<Automation[]>;
  getAutomation(id: string): Promise<Automation | undefined>;
  createAutomation(automation: Automation): Promise<void>;
  updateAutomation(id: string, changes: Partial<Omit<Automation, 'id' | 'surfaceId' | 'createdAt'>>): Promise<void>;
  deleteAutomation(id: string): Promise<void>;

  // change log (append-only)
  appendChange(entry: ChangeLogEntry): Promise<void>;
  listChanges(limit?: number): Promise<ChangeLogEntry[]>;
}
