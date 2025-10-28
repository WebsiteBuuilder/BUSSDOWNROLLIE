import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';

// Types
export type GiveawayState = 'ACTIVE' | 'REVEALING' | 'COMPLETE' | 'CANCELLED';
export type GiveawayType = 'regular' | 'jackpot' | 'daily';
export type ModifierType = 'pot_boost' | 'multiplier' | 'bonus_entries';

export interface GiveawayRecord {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string | null;
  hostId: string;
  title: string;
  description: string | null;
  buyInCost: number;
  hostCut: number;
  maxEntriesPerUser: number;
  startAt: number;
  endAt: number;
  state: GiveawayState;
  seed: string | null;
  winnerUserId: string | null;
  type: GiveawayType;
  createdAt: number;
  updatedAt: number;
}

export interface GiveawayEntry {
  id: number;
  giveawayId: string;
  userId: string;
  createdAt: number;
}

export interface GiveawayHistory {
  id: number;
  giveawayId: string;
  winnerUserId: string;
  pot: number;
  payoutAmount: number;
  hostAmount: number;
  type: GiveawayType;
  seed: string;
  completedAt: number;
}

export interface GlobalJackpot {
  id: number;
  totalVPSpent: number;
  lastUpdated: number;
}

export interface DailySchedule {
  id: number;
  lastRunDate: string;
  nextRunTime: number;
}

export interface DailyModifier {
  id: number;
  date: string;
  modifierType: ModifierType;
  value: number;
  addedBy: string;
  createdAt: number;
}

// Database setup
const DATA_DIR = join(process.cwd(), 'data');
const DB_PATH = join(DATA_DIR, 'giveaways.db');

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// PERFORMANCE OPTIMIZATION: Single WAL-mode connection with prepared statement reuse
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000'); // 64MB cache

// PERFORMANCE OPTIMIZATION: Batch jackpot updates
let pendingJackpotAmount = 0;
let jackpotFlushTimer: NodeJS.Timeout | null = null;

// Initialize database schema
export function initGiveawayDb(): void {
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
      hostCut INTEGER NOT NULL,
      maxEntriesPerUser INTEGER NOT NULL,
      startAt INTEGER NOT NULL,
      endAt INTEGER NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('ACTIVE','REVEALING','COMPLETE','CANCELLED')),
      seed TEXT,
      winnerUserId TEXT,
      type TEXT NOT NULL CHECK(type IN ('regular','jackpot','daily')) DEFAULT 'regular',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_giveaways_state ON giveaways(state);
    CREATE INDEX IF NOT EXISTS idx_giveaways_channel ON giveaways(channelId);
    CREATE INDEX IF NOT EXISTS idx_giveaways_guild ON giveaways(guildId);

    CREATE TABLE IF NOT EXISTS giveaway_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      giveawayId TEXT NOT NULL,
      userId TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY(giveawayId) REFERENCES giveaways(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_entries_giveaway ON giveaway_entries(giveawayId);
    CREATE INDEX IF NOT EXISTS idx_entries_user ON giveaway_entries(giveawayId, userId);

    CREATE TABLE IF NOT EXISTS giveaway_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      giveawayId TEXT NOT NULL,
      winnerUserId TEXT NOT NULL,
      pot INTEGER NOT NULL,
      payoutAmount INTEGER NOT NULL,
      hostAmount INTEGER NOT NULL,
      type TEXT NOT NULL,
      seed TEXT NOT NULL,
      completedAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_history_completed ON giveaway_history(completedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_history_winner ON giveaway_history(winnerUserId);

    CREATE TABLE IF NOT EXISTS global_jackpot (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      totalVPSpent INTEGER NOT NULL DEFAULT 0,
      lastUpdated INTEGER NOT NULL
    );

    INSERT OR IGNORE INTO global_jackpot (id, totalVPSpent, lastUpdated)
    VALUES (1, 0, ${Date.now()});

    CREATE TABLE IF NOT EXISTS daily_schedule (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      lastRunDate TEXT NOT NULL,
      nextRunTime INTEGER NOT NULL
    );

    INSERT OR IGNORE INTO daily_schedule (id, lastRunDate, nextRunTime)
    VALUES (1, '1970-01-01', 0);

    CREATE TABLE IF NOT EXISTS daily_modifiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      modifierType TEXT NOT NULL CHECK(modifierType IN ('pot_boost','multiplier','bonus_entries')),
      value REAL NOT NULL,
      addedBy TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_modifiers_date ON daily_modifiers(date);
  `);
}

// Prepared statements
const insertGiveawayStmt = db.prepare(`
  INSERT INTO giveaways (
    id, guildId, channelId, messageId, hostId, title, description,
    buyInCost, hostCut, maxEntriesPerUser, startAt, endAt, state,
    seed, winnerUserId, type, createdAt, updatedAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const selectGiveawayStmt = db.prepare('SELECT * FROM giveaways WHERE id = ?');

const selectAllActiveStmt = db.prepare(
  "SELECT * FROM giveaways WHERE state IN ('ACTIVE', 'REVEALING')"
);

const selectActiveInChannelStmt = db.prepare(
  "SELECT * FROM giveaways WHERE channelId = ? AND state IN ('ACTIVE', 'REVEALING') LIMIT 1"
);

const updateGiveawayStmt = db.prepare(`
  UPDATE giveaways
  SET messageId = COALESCE(?, messageId),
      state = COALESCE(?, state),
      seed = COALESCE(?, seed),
      winnerUserId = COALESCE(?, winnerUserId),
      endAt = COALESCE(?, endAt),
      updatedAt = ?
  WHERE id = ?
`);

const insertEntryStmt = db.prepare(
  'INSERT INTO giveaway_entries (giveawayId, userId, createdAt) VALUES (?, ?, ?)'
);

const selectEntriesStmt = db.prepare(
  'SELECT * FROM giveaway_entries WHERE giveawayId = ? ORDER BY id ASC'
);

const countUserEntriesStmt = db.prepare(
  'SELECT COUNT(*) as count FROM giveaway_entries WHERE giveawayId = ? AND userId = ?'
);

const countAllEntriesStmt = db.prepare(
  'SELECT COUNT(*) as count FROM giveaway_entries WHERE giveawayId = ?'
);

const deleteEntriesStmt = db.prepare('DELETE FROM giveaway_entries WHERE giveawayId = ?');

const insertHistoryStmt = db.prepare(`
  INSERT INTO giveaway_history (
    giveawayId, winnerUserId, pot, payoutAmount, hostAmount, type, seed, completedAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const selectHistoryStmt = db.prepare(
  'SELECT * FROM giveaway_history ORDER BY completedAt DESC LIMIT ? OFFSET ?'
);

const countHistoryStmt = db.prepare('SELECT COUNT(*) as count FROM giveaway_history');

const selectJackpotStmt = db.prepare('SELECT * FROM global_jackpot WHERE id = 1');

const updateJackpotStmt = db.prepare(
  'UPDATE global_jackpot SET totalVPSpent = totalVPSpent + ?, lastUpdated = ? WHERE id = 1'
);

const insertModifierStmt = db.prepare(`
  INSERT INTO daily_modifiers (date, modifierType, value, addedBy, createdAt)
  VALUES (?, ?, ?, ?, ?)
`);

const selectModifiersStmt = db.prepare('SELECT * FROM daily_modifiers WHERE date = ?');

const selectDailyScheduleStmt = db.prepare('SELECT * FROM daily_schedule WHERE id = 1');

const updateDailyScheduleStmt = db.prepare(
  'UPDATE daily_schedule SET lastRunDate = ?, nextRunTime = ? WHERE id = 1'
);

// Database operations
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
    record.hostCut,
    record.maxEntriesPerUser,
    record.startAt,
    record.endAt,
    record.state,
    record.seed,
    record.winnerUserId,
    record.type,
    record.createdAt,
    record.updatedAt
  );
  return record;
}

export function getGiveaway(id: string): GiveawayRecord | null {
  const row = selectGiveawayStmt.get(id) as GiveawayRecord | undefined;
  return row ?? null;
}

export function getAllActive(): GiveawayRecord[] {
  return selectAllActiveStmt.all() as GiveawayRecord[];
}

export function getActiveInChannel(channelId: string): GiveawayRecord | null {
  const row = selectActiveInChannelStmt.get(channelId) as GiveawayRecord | undefined;
  return row ?? null;
}

export function updateGiveaway(
  id: string,
  updates: Partial<Pick<GiveawayRecord, 'messageId' | 'state' | 'seed' | 'winnerUserId' | 'endAt'>>
): void {
  const now = Date.now();
  updateGiveawayStmt.run(
    updates.messageId ?? null,
    updates.state ?? null,
    updates.seed ?? null,
    updates.winnerUserId ?? null,
    updates.endAt ?? null,
    now,
    id
  );
}

export function addEntry(giveawayId: string, userId: string): GiveawayEntry {
  const now = Date.now();
  const info = insertEntryStmt.run(giveawayId, userId, now);
  return {
    id: Number(info.lastInsertRowid),
    giveawayId,
    userId,
    createdAt: now,
  };
}

export function getEntries(giveawayId: string): GiveawayEntry[] {
  return selectEntriesStmt.all(giveawayId) as GiveawayEntry[];
}

export function countUserEntries(giveawayId: string, userId: string): number {
  const row = countUserEntriesStmt.get(giveawayId, userId) as { count: number };
  return row.count;
}

export function countAllEntries(giveawayId: string): number {
  const row = countAllEntriesStmt.get(giveawayId) as { count: number };
  return row.count;
}

export function deleteEntries(giveawayId: string): void {
  deleteEntriesStmt.run(giveawayId);
}

export function saveHistory(history: Omit<GiveawayHistory, 'id'>): number {
  const info = insertHistoryStmt.run(
    history.giveawayId,
    history.winnerUserId,
    history.pot,
    history.payoutAmount,
    history.hostAmount,
    history.type,
    history.seed,
    history.completedAt
  );
  return Number(info.lastInsertRowid);
}

export function getHistory(limit: number, offset: number): GiveawayHistory[] {
  return selectHistoryStmt.all(limit, offset) as GiveawayHistory[];
}

export function getHistoryCount(): number {
  const row = countHistoryStmt.get() as { count: number };
  return row.count;
}

// PERFORMANCE OPTIMIZATION: Batch jackpot updates
export function queueJackpotUpdate(amount: number): void {
  pendingJackpotAmount += amount;
  
  if (jackpotFlushTimer) {
    clearTimeout(jackpotFlushTimer);
  }
  
  // Flush after 5 seconds or if 10+ entries accumulated (roughly)
  if (pendingJackpotAmount >= 10) {
    flushJackpotUpdates();
  } else {
    jackpotFlushTimer = setTimeout(() => {
      flushJackpotUpdates();
    }, 5000);
  }
}

export function flushJackpotUpdates(): void {
  if (pendingJackpotAmount === 0) return;
  
  const now = Date.now();
  updateJackpotStmt.run(pendingJackpotAmount, now);
  pendingJackpotAmount = 0;
  
  if (jackpotFlushTimer) {
    clearTimeout(jackpotFlushTimer);
    jackpotFlushTimer = null;
  }
}

export function getJackpotTotal(): number {
  const row = selectJackpotStmt.get() as GlobalJackpot | undefined;
  return row?.totalVPSpent ?? 0;
}

export function addDailyModifier(
  date: string,
  modifierType: ModifierType,
  value: number,
  addedBy: string
): number {
  const now = Date.now();
  const info = insertModifierStmt.run(date, modifierType, value, addedBy, now);
  return Number(info.lastInsertRowid);
}

export function getDailyModifiers(date: string): DailyModifier[] {
  return selectModifiersStmt.all(date) as DailyModifier[];
}

export function getDailySchedule(): DailySchedule {
  const row = selectDailyScheduleStmt.get() as DailySchedule;
  return row;
}

export function updateDailySchedule(lastRunDate: string, nextRunTime: number): void {
  updateDailyScheduleStmt.run(lastRunDate, nextRunTime);
}

// STABILITY OPTIMIZATION: Graceful shutdown with pending flushes
export function closeGiveawayDb(): void {
  flushJackpotUpdates();
  db.close();
}

