import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { Automation, Surface, SurfaceRecord } from '@/lib/core/types';
import type { ChangeLogEntry } from '@/lib/core/operations';
import type { Store } from '@/lib/store/store';

/**
 * The default Store adapter: one local SQLite file, zero cloud. This is the
 * only file in the app that contains SQL or knows data lives in a file.
 *
 * Structured values (fields, record values, triggers, operations) are stored
 * as JSON text columns rather than normalized tables. That is deliberate:
 * surfaces are small, single-user, and schema-flexible by design, and JSON
 * columns keep this adapter trivially portable to other backends.
 */

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS surfaces (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    icon TEXT NOT NULL,
    view_type TEXT NOT NULL,
    fields_json TEXT NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    surface_id TEXT NOT NULL REFERENCES surfaces(id) ON DELETE CASCADE,
    values_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_records_surface ON records(surface_id);

  CREATE TABLE IF NOT EXISTS automations (
    id TEXT PRIMARY KEY,
    surface_id TEXT NOT NULL REFERENCES surfaces(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    trigger_json TEXT NOT NULL,
    action_json TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_automations_surface ON automations(surface_id);

  CREATE TABLE IF NOT EXISTS change_log (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    summary TEXT NOT NULL,
    operation_json TEXT NOT NULL,
    inverse_json TEXT NOT NULL
  );
`;

interface SurfaceRow {
  id: string;
  title: string;
  icon: string;
  view_type: Surface['viewType'];
  fields_json: string;
  pinned: number;
  created_at: string;
  updated_at: string;
}

interface RecordRow {
  id: string;
  surface_id: string;
  values_json: string;
  created_at: string;
  updated_at: string;
}

interface AutomationRow {
  id: string;
  surface_id: string;
  kind: Automation['kind'];
  trigger_json: string;
  action_json: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

interface ChangeLogRow {
  id: string;
  batch_id: string;
  created_at: string;
  summary: string;
  operation_json: string;
  inverse_json: string;
}

function rowToSurface(row: SurfaceRow): Surface {
  return {
    id: row.id,
    title: row.title,
    icon: row.icon,
    viewType: row.view_type,
    fields: JSON.parse(row.fields_json),
    pinned: row.pinned === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToRecord(row: RecordRow): SurfaceRecord {
  return {
    id: row.id,
    surfaceId: row.surface_id,
    values: JSON.parse(row.values_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToAutomation(row: AutomationRow): Automation {
  return {
    id: row.id,
    surfaceId: row.surface_id,
    kind: row.kind,
    trigger: JSON.parse(row.trigger_json),
    action: JSON.parse(row.action_json),
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToChange(row: ChangeLogRow): ChangeLogEntry {
  return {
    id: row.id,
    batchId: row.batch_id,
    createdAt: row.created_at,
    summary: row.summary,
    operation: JSON.parse(row.operation_json),
    inverse: JSON.parse(row.inverse_json),
  };
}

export class SqliteStore implements Store {
  #db: Database.Database;

  constructor(filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.#db = new Database(filePath);
    this.#db.pragma('journal_mode = WAL');
    this.#db.pragma('foreign_keys = ON');
    this.#db.exec(SCHEMA);
    this.#addColumnIfMissing('change_log', 'batch_id', "TEXT NOT NULL DEFAULT ''");
    // entries from before batches existed each become their own batch —
    // NEVER one shared batch, or a single undo would replay all of history
    this.#db.exec("UPDATE change_log SET batch_id = id WHERE batch_id = ''");
    // created here, after the migration, so it works on pre-batch databases
    this.#db.exec('CREATE INDEX IF NOT EXISTS idx_change_log_batch ON change_log(batch_id)');
  }

  // minimal forward-migration for databases created before a column existed
  #addColumnIfMissing(table: string, column: string, definition: string) {
    const columns = this.#db.pragma(`table_info(${table})`) as { name: string }[];
    if (!columns.some((c) => c.name === column)) {
      this.#db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  async listSurfaces(): Promise<Surface[]> {
    const rows = this.#db
      .prepare('SELECT * FROM surfaces ORDER BY created_at ASC')
      .all() as SurfaceRow[];
    return rows.map(rowToSurface);
  }

  async getSurface(id: string): Promise<Surface | undefined> {
    const row = this.#db.prepare('SELECT * FROM surfaces WHERE id = ?').get(id) as
      | SurfaceRow
      | undefined;
    return row ? rowToSurface(row) : undefined;
  }

  async createSurface(surface: Surface): Promise<void> {
    this.#db
      .prepare(
        `INSERT INTO surfaces (id, title, icon, view_type, fields_json, pinned, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        surface.id,
        surface.title,
        surface.icon,
        surface.viewType,
        JSON.stringify(surface.fields),
        surface.pinned ? 1 : 0,
        surface.createdAt,
        surface.updatedAt,
      );
  }

  async updateSurface(
    id: string,
    changes: Partial<Omit<Surface, 'id' | 'createdAt'>>,
  ): Promise<void> {
    const existing = await this.getSurface(id);
    if (!existing) {
      throw new Error(`surface not found: ${id}`);
    }
    const next = { ...existing, ...changes };
    this.#db
      .prepare(
        `UPDATE surfaces
         SET title = ?, icon = ?, view_type = ?, fields_json = ?, pinned = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        next.title,
        next.icon,
        next.viewType,
        JSON.stringify(next.fields),
        next.pinned ? 1 : 0,
        next.updatedAt,
        id,
      );
  }

  async deleteSurface(id: string): Promise<void> {
    // records and automations cascade via foreign keys
    this.#db.prepare('DELETE FROM surfaces WHERE id = ?').run(id);
  }

  async listRecords(surfaceId: string): Promise<SurfaceRecord[]> {
    const rows = this.#db
      .prepare('SELECT * FROM records WHERE surface_id = ? ORDER BY created_at ASC')
      .all(surfaceId) as RecordRow[];
    return rows.map(rowToRecord);
  }

  async getRecord(id: string): Promise<SurfaceRecord | undefined> {
    const row = this.#db.prepare('SELECT * FROM records WHERE id = ?').get(id) as
      | RecordRow
      | undefined;
    return row ? rowToRecord(row) : undefined;
  }

  async createRecord(record: SurfaceRecord): Promise<void> {
    this.#db
      .prepare(
        `INSERT INTO records (id, surface_id, values_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.surfaceId,
        JSON.stringify(record.values),
        record.createdAt,
        record.updatedAt,
      );
  }

  async updateRecord(
    id: string,
    changes: Partial<Omit<SurfaceRecord, 'id' | 'surfaceId' | 'createdAt'>>,
  ): Promise<void> {
    const existing = await this.getRecord(id);
    if (!existing) {
      throw new Error(`record not found: ${id}`);
    }
    const next = { ...existing, ...changes };
    this.#db
      .prepare('UPDATE records SET values_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(next.values), next.updatedAt, id);
  }

  async deleteRecord(id: string): Promise<void> {
    this.#db.prepare('DELETE FROM records WHERE id = ?').run(id);
  }

  async listAutomations(surfaceId?: string): Promise<Automation[]> {
    const rows = (
      surfaceId
        ? this.#db
            .prepare('SELECT * FROM automations WHERE surface_id = ? ORDER BY created_at ASC')
            .all(surfaceId)
        : this.#db.prepare('SELECT * FROM automations ORDER BY created_at ASC').all()
    ) as AutomationRow[];
    return rows.map(rowToAutomation);
  }

  async getAutomation(id: string): Promise<Automation | undefined> {
    const row = this.#db.prepare('SELECT * FROM automations WHERE id = ?').get(id) as
      | AutomationRow
      | undefined;
    return row ? rowToAutomation(row) : undefined;
  }

  async createAutomation(automation: Automation): Promise<void> {
    this.#db
      .prepare(
        `INSERT INTO automations (id, surface_id, kind, trigger_json, action_json, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        automation.id,
        automation.surfaceId,
        automation.kind,
        JSON.stringify(automation.trigger),
        JSON.stringify(automation.action),
        automation.enabled ? 1 : 0,
        automation.createdAt,
        automation.updatedAt,
      );
  }

  async updateAutomation(
    id: string,
    changes: Partial<Omit<Automation, 'id' | 'surfaceId' | 'createdAt'>>,
  ): Promise<void> {
    const existing = await this.getAutomation(id);
    if (!existing) {
      throw new Error(`automation not found: ${id}`);
    }
    const next = { ...existing, ...changes };
    this.#db
      .prepare(
        `UPDATE automations
         SET kind = ?, trigger_json = ?, action_json = ?, enabled = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        next.kind,
        JSON.stringify(next.trigger),
        JSON.stringify(next.action),
        next.enabled ? 1 : 0,
        next.updatedAt,
        id,
      );
  }

  async deleteAutomation(id: string): Promise<void> {
    this.#db.prepare('DELETE FROM automations WHERE id = ?').run(id);
  }

  async appendChange(entry: ChangeLogEntry): Promise<void> {
    this.#db
      .prepare(
        `INSERT INTO change_log (id, batch_id, created_at, summary, operation_json, inverse_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        entry.batchId,
        entry.createdAt,
        entry.summary,
        JSON.stringify(entry.operation),
        JSON.stringify(entry.inverse),
      );
  }

  async listChanges(limit = 50): Promise<ChangeLogEntry[]> {
    // rowid, not created_at: entries in one batch can share a timestamp
    const rows = this.#db
      .prepare('SELECT * FROM change_log ORDER BY rowid DESC LIMIT ?')
      .all(limit) as ChangeLogRow[];
    return rows.map(rowToChange);
  }

  async listBatchChanges(batchId: string): Promise<ChangeLogEntry[]> {
    const rows = this.#db
      .prepare('SELECT * FROM change_log WHERE batch_id = ? ORDER BY rowid ASC')
      .all(batchId) as ChangeLogRow[];
    return rows.map(rowToChange);
  }
}
