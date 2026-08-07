import path from 'node:path';
import { SqliteStore } from '@/lib/store/sqlite';
import type { Store } from '@/lib/store/store';

/**
 * The one place a concrete Store adapter is chosen. Everything else in the
 * app calls getStore() and sees only the Store interface.
 *
 * To use a different backend, construct your adapter here (ideally switched
 * on config/env) — no other file needs to change.
 */

const DB_PATH = process.env.OTTO_DB_PATH ?? path.join(process.cwd(), 'data', 'otto.db');

// cached on globalThis so Next.js dev-mode hot reloads reuse one connection
const globalCache = globalThis as typeof globalThis & { __ottoStore?: Promise<Store> };

export function getStore(): Promise<Store> {
  // a fresh database starts EMPTY on purpose: Home shows the first-run
  // question with starter chips (lib/store/starters.ts) instead of seed data
  globalCache.__ottoStore ??= Promise.resolve(new SqliteStore(DB_PATH));
  return globalCache.__ottoStore;
}
