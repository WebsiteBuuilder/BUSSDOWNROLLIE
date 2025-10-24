import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';
import {
  EntrantSummary,
  GiveawayAuditLog,
  GiveawayConfig,
  GiveawayEntry,
  GiveawayPotSnapshot,
  GiveawayRecord,
  GiveawayState,
} from './model.ts';

const DATA_DIR = join(process.cwd(), 'data');
const DB_PATH = join(DATA_DIR, 'giveaways.sqlite');

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS giveaways (
  id TEXT PRIMARY KEY,
  guildId TEXT NOT NULL,
  channelId TEXT NOT NULL,
  messageId TEXT,
  hostId TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  buyInCost INTEGER NOT NULL,
  maxEntriesPerUser INTEGER NOT NULL,
  revealWindowSeconds INTEGER NOT NULL,
  payoutRatio INTEGER NOT NULL,
  startAt INTEGER NOT NULL,
  endAt INTEGER NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('DRAFT','ACTIVE','REVEALING','COMPLETE','CANCELLED')),
  seed TEXT,
  winnerUserId TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS giveaway_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  giveawayId TEXT NOT NULL,
  userId TEXT NOT NULL,
  entryIndex INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  FOREIGN KEY(giveawayId) REFERENCES giveaways(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS giveaway_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  giveawayId TEXT NOT NULL,
  actorId TEXT,
  action TEXT NOT NULL,
  meta TEXT NOT NULL,
  at INTEGER NOT NULL,
  FOREIGN KEY(giveawayId) REFERENCES giveaways(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS giveaway_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  defaultBuyInCost INTEGER NOT NULL,
  defaultMaxEntriesPerUser INTEGER NOT NULL,
  defaultRevealWindowSeconds INTEGER NOT NULL,
  defaultPayoutRatio INTEGER NOT NULL
);

INSERT INTO giveaway_settings (id, defaultBuyInCost, defaultMaxEntriesPerUser, defaultRevealWindowSeconds, defaultPayoutRatio)
  SELECT 1, 25, 1, 60, 100
  WHERE NOT EXISTS (SELECT 1 FROM giveaway_settings WHERE id = 1);
`);

const selectGiveawayStmt = db.prepare<[string], GiveawayRecord>(
  'SELECT * FROM giveaways WHERE id = ?'
);

const selectGiveawaysByStateStmt = db.prepare<[string], GiveawayRecord>(
  'SELECT * FROM giveaways WHERE state = ?'
);

const selectActiveByChannelStmt = db.prepare<[string], GiveawayRecord>(
  "SELECT * FROM giveaways WHERE channelId = ? AND state IN ('ACTIVE','REVEALING') LIMIT 1"
);

const insertGiveawayStmt = db.prepare<[
  string,
  string,
  string,
  string | null,
  string,
  string,
  string | null,
  number,
  number,
  number,
  number,
  number,
  number,
  GiveawayState,
  string | null,
  string | null,
  number,
  number
], { changes: number; lastInsertRowid: number }>(
  `INSERT INTO giveaways (
    id,
    guildId,
    channelId,
    messageId,
    hostId,
    title,
    description,
    buyInCost,
    maxEntriesPerUser,
    revealWindowSeconds,
    payoutRatio,
    startAt,
    endAt,
    state,
    seed,
    winnerUserId,
    createdAt,
    updatedAt
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
);

const updateGiveawayStmt = db.prepare<[
  string,
  string | null,
  number | null,
  number | null,
  number | null,
  GiveawayState | null,
  string | null,
  string | null,
  number,
  string
]>(
  `UPDATE giveaways
   SET messageId = COALESCE(?, messageId),
       endAt = COALESCE(?, endAt),
       revealWindowSeconds = COALESCE(?, revealWindowSeconds),
       payoutRatio = COALESCE(?, payoutRatio),
       state = COALESCE(?, state),
       seed = COALESCE(?, seed),
       winnerUserId = COALESCE(?, winnerUserId),
       updatedAt = ?
   WHERE id = ?`
);

const insertEntryStmt = db.prepare<[
  string,
  string,
  number,
  number
], { lastInsertRowid: number }>(
  'INSERT INTO giveaway_entries (giveawayId, userId, entryIndex, createdAt) VALUES (?,?,?,?)'
);

const countEntriesStmt = db.prepare<[string], { count: number }>(
  'SELECT COUNT(*) as count FROM giveaway_entries WHERE giveawayId = ?'
);

const countEntriesByUserStmt = db.prepare<[
  string,
  string
], { count: number }>(
  'SELECT COUNT(*) as count FROM giveaway_entries WHERE giveawayId = ? AND userId = ?'
);

const selectEntriesStmt = db.prepare<[string], GiveawayEntry>(
  'SELECT * FROM giveaway_entries WHERE giveawayId = ? ORDER BY id ASC'
);

const deleteEntriesStmt = db.prepare<[string], unknown>(
  'DELETE FROM giveaway_entries WHERE giveawayId = ?'
);

const insertAuditStmt = db.prepare<[
  string,
  string | null,
  string,
  string,
  number
], { lastInsertRowid: number }>(
  'INSERT INTO giveaway_audit (giveawayId, actorId, action, meta, at) VALUES (?,?,?,?,?)'
);

const selectEntrantSummaryStmt = db.prepare<[string], EntrantSummary>(
  `SELECT userId, COUNT(*) as entries
   FROM giveaway_entries
   WHERE giveawayId = ?
   GROUP BY userId
   ORDER BY entries DESC, userId ASC`
);

const selectSettingsStmt = db.prepare<[], GiveawayConfig>(
  'SELECT defaultBuyInCost, defaultMaxEntriesPerUser, defaultRevealWindowSeconds, defaultPayoutRatio FROM giveaway_settings WHERE id = 1'
);

const updateSettingsStmt = db.prepare<[
  number,
  number,
  number,
  number
]>(
  `UPDATE giveaway_settings
   SET defaultBuyInCost = ?,
       defaultMaxEntriesPerUser = ?,
       defaultRevealWindowSeconds = ?,
       defaultPayoutRatio = ?
   WHERE id = 1`
);

export function createGiveaway(record: GiveawayRecord): GiveawayRecord {
  insertGiveawayStmt.run(
    record.id,
    record.guildId,
    record.channelId,
    record.messageId,
    record.hostId,
    record.title,
    record.description,
    record.buyInCost,
    record.maxEntriesPerUser,
    record.revealWindowSeconds,
    record.payoutRatio,
    record.startAt,
    record.endAt,
    record.state,
    record.seed,
    record.winnerUserId,
    record.createdAt,
    record.updatedAt
  );
  return record;
}

export function getGiveaway(id: string): GiveawayRecord | null {
  const row = selectGiveawayStmt.get(id);
  return row ?? null;
}

export function updateGiveaway(
  id: string,
  updates: Partial<Pick<GiveawayRecord, 'messageId' | 'endAt' | 'revealWindowSeconds' | 'payoutRatio' | 'state' | 'seed' | 'winnerUserId'>>
): void {
  const now = Date.now();
  updateGiveawayStmt.run(
    updates.messageId ?? null,
    updates.endAt ?? null,
    updates.revealWindowSeconds ?? null,
    updates.payoutRatio ?? null,
    updates.state ?? null,
    updates.seed ?? null,
    updates.winnerUserId ?? null,
    now,
    id
  );
}

export function addEntry(giveawayId: string, userId: string): GiveawayEntry {
  const now = Date.now();
  const entryIndex = countEntriesByUserStmt.get(giveawayId, userId).count;
  const info = insertEntryStmt.run(giveawayId, userId, entryIndex, now);
  return {
    id: Number(info.lastInsertRowid),
    giveawayId,
    userId,
    entryIndex,
    createdAt: now,
  };
}

export function countEntries(giveawayId: string): number {
  return countEntriesStmt.get(giveawayId).count;
}

export function countEntriesForUser(giveawayId: string, userId: string): number {
  return countEntriesByUserStmt.get(giveawayId, userId).count;
}

export function getEntries(giveawayId: string): GiveawayEntry[] {
  return selectEntriesStmt.all(giveawayId);
}

export function getPotSnapshot(giveawayId: string, buyInCost: number): GiveawayPotSnapshot {
  const entrantCount = countEntries(giveawayId);
  return {
    entrantCount,
    pot: entrantCount * buyInCost,
  };
}

export function clearEntries(giveawayId: string): void {
  deleteEntriesStmt.run(giveawayId);
}

export function logAudit(
  giveawayId: string,
  actorId: string | null,
  action: string,
  meta: Record<string, unknown>
): GiveawayAuditLog {
  const at = Date.now();
  const info = insertAuditStmt.run(giveawayId, actorId, action, JSON.stringify(meta), at);
  return {
    id: Number(info.lastInsertRowid),
    giveawayId,
    actorId,
    action,
    meta: JSON.stringify(meta),
    at,
  };
}

export function listEntrants(giveawayId: string): EntrantSummary[] {
  return selectEntrantSummaryStmt.all(giveawayId);
}

export function getGiveawaysByState(state: GiveawayState): GiveawayRecord[] {
  return selectGiveawaysByStateStmt.all(state);
}

export function getAllActiveGiveaways(): GiveawayRecord[] {
  return db
    .prepare<[], GiveawayRecord>(
      `SELECT * FROM giveaways WHERE state IN ('ACTIVE','REVEALING')`
    )
    .all();
}

export function getActiveGiveawayInChannel(channelId: string): GiveawayRecord | null {
  const row = selectActiveByChannelStmt.get(channelId);
  return row ?? null;
}

export function getConfig(): GiveawayConfig {
  return selectSettingsStmt.get();
}

export function updateConfig(config: Partial<GiveawayConfig>): GiveawayConfig {
  const current = getConfig();
  const next: GiveawayConfig = {
    defaultBuyInCost: config.defaultBuyInCost ?? current.defaultBuyInCost,
    defaultMaxEntriesPerUser:
      config.defaultMaxEntriesPerUser ?? current.defaultMaxEntriesPerUser,
    defaultRevealWindowSeconds:
      config.defaultRevealWindowSeconds ?? current.defaultRevealWindowSeconds,
    defaultPayoutRatio: config.defaultPayoutRatio ?? current.defaultPayoutRatio,
  };
  updateSettingsStmt.run(
    next.defaultBuyInCost,
    next.defaultMaxEntriesPerUser,
    next.defaultRevealWindowSeconds,
    next.defaultPayoutRatio
  );
  return next;
}

export function closeGiveawayDb(): void {
  db.close();
}
