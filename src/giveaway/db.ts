import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import { logger } from '../logger.js';

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
let db: DatabaseType | null = null;
let statementsInitialized = false;
let schemaReady = false;
let schemaVerificationStmt: Database.Statement | null = null;

// PERFORMANCE OPTIMIZATION: Batch jackpot updates
let pendingJackpotAmount = 0;
let jackpotFlushTimer: NodeJS.Timeout | null = null;

function getDb(): DatabaseType {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000'); // 64MB cache
  }
  return db;
}

// Initialize database schema
function initializeGiveawaySchema(): void {
  const database = getDb();
  database.exec(`
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

  // Initialize prepared statements after tables are created
  initStatements();
}

export function ensureGiveawayDb(): void {
  if (schemaReady) {
    return;
  }

  try {
    initializeGiveawaySchema();

    const database = getDb();
    if (!schemaVerificationStmt) {
      schemaVerificationStmt = database.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='giveaways'"
      );
    }

    const row = schemaVerificationStmt.get() as { name?: string } | undefined;
    if (!row?.name) {
      throw new Error('Giveaway database schema missing expected `giveaways` table.');
    }

    schemaReady = true;
  } catch (rawError) {
    schemaReady = false;
    statementsInitialized = false;
    schemaVerificationStmt = null;

    const error = rawError instanceof Error ? rawError : new Error(String(rawError));
    logger.error('failed to initialize giveaway database schema', {
      err: error,
      dbPath: DB_PATH,
    });

    throw new Error(
      `Giveaway database schema is unavailable. If the file at ${DB_PATH} is corrupted, delete it and restart to rebuild.`,
      { cause: error }
    );
  }
}

export function initGiveawayDb(): void {
  ensureGiveawayDb();
}

function ensureGiveawayDbReady(): void {
  ensureGiveawayDb();

  if (!statementsInitialized) {
    initStatements();
  }
}

// Prepared statement variables
let insertGiveawayStmt: any;
let selectGiveawayStmt: any;
let selectAllActiveStmt: any;
let selectActiveInChannelStmt: any;
let updateGiveawayStmt: any;
let insertEntryStmt: any;
let selectEntriesStmt: any;
let countUserEntriesStmt: any;
let countAllEntriesStmt: any;
let deleteEntriesStmt: any;
let insertHistoryStmt: any;
let selectHistoryStmt: any;
let countHistoryStmt: any;
let selectJackpotStmt: any;
let updateJackpotStmt: any;
let insertModifierStmt: any;
let selectModifiersStmt: any;
let selectDailyScheduleStmt: any;
let updateDailyScheduleStmt: any;

// Initialize prepared statements (called after tables are created)
function initStatements(): void {
  if (statementsInitialized) return;
  
  const database = getDb();
  
  insertGiveawayStmt = database.prepare(`
  INSERT INTO giveaways (
    id, guildId, channelId, messageId, hostId, title, description,
    buyInCost, hostCut, maxEntriesPerUser, startAt, endAt, state,
    seed, winnerUserId, type, createdAt, updatedAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  selectGiveawayStmt = database.prepare('SELECT * FROM giveaways WHERE id = ?');

  selectAllActiveStmt = database.prepare(
    `SELECT * FROM giveaways WHERE state IN ('ACTIVE', 'REVEALING')`
  );

  selectActiveInChannelStmt = database.prepare(
    `SELECT * FROM giveaways WHERE channelId = ? AND state IN ('ACTIVE', 'REVEALING') LIMIT 1`
  );

  updateGiveawayStmt = database.prepare(`
    UPDATE giveaways
    SET messageId = COALESCE(?, messageId),
        state = COALESCE(?, state),
        seed = COALESCE(?, seed),
        winnerUserId = COALESCE(?, winnerUserId),
        endAt = COALESCE(?, endAt),
        updatedAt = ?
    WHERE id = ?
  `);

  insertEntryStmt = database.prepare(
    'INSERT INTO giveaway_entries (giveawayId, userId, createdAt) VALUES (?, ?, ?)'
  );

  selectEntriesStmt = database.prepare(
    'SELECT * FROM giveaway_entries WHERE giveawayId = ? ORDER BY id ASC'
  );

  countUserEntriesStmt = database.prepare(
    'SELECT COUNT(*) as count FROM giveaway_entries WHERE giveawayId = ? AND userId = ?'
  );

  countAllEntriesStmt = database.prepare(
    'SELECT COUNT(*) as count FROM giveaway_entries WHERE giveawayId = ?'
  );

  deleteEntriesStmt = database.prepare('DELETE FROM giveaway_entries WHERE giveawayId = ?');

  insertHistoryStmt = database.prepare(`
    INSERT INTO giveaway_history (
      giveawayId, winnerUserId, pot, payoutAmount, hostAmount, type, seed, completedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  selectHistoryStmt = database.prepare(
    'SELECT * FROM giveaway_history ORDER BY completedAt DESC LIMIT ? OFFSET ?'
  );

  countHistoryStmt = database.prepare('SELECT COUNT(*) as count FROM giveaway_history');

  selectJackpotStmt = database.prepare('SELECT * FROM global_jackpot WHERE id = 1');

  updateJackpotStmt = database.prepare(
    'UPDATE global_jackpot SET totalVPSpent = totalVPSpent + ?, lastUpdated = ? WHERE id = 1'
  );

  insertModifierStmt = database.prepare(`
    INSERT INTO daily_modifiers (date, modifierType, value, addedBy, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `);

  selectModifiersStmt = database.prepare('SELECT * FROM daily_modifiers WHERE date = ?');

  selectDailyScheduleStmt = database.prepare('SELECT * FROM daily_schedule WHERE id = 1');

  updateDailyScheduleStmt = database.prepare(
    'UPDATE daily_schedule SET lastRunDate = ?, nextRunTime = ? WHERE id = 1'
  );
  
  statementsInitialized = true;
}

// Database operations
export function createGiveaway(record: GiveawayRecord): GiveawayRecord {
  ensureGiveawayDbReady();
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
  ensureGiveawayDbReady();
  const row = selectGiveawayStmt.get(id) as GiveawayRecord | undefined;
  return row ?? null;
}

export function getAllActive(): GiveawayRecord[] {
  ensureGiveawayDbReady();
  return selectAllActiveStmt.all() as GiveawayRecord[];
}

export function getActiveInChannel(channelId: string): GiveawayRecord | null {
  ensureGiveawayDbReady();
  const row = selectActiveInChannelStmt.get(channelId) as GiveawayRecord | undefined;
  return row ?? null;
}

export function updateGiveaway(
  id: string,
  updates: Partial<Pick<GiveawayRecord, 'messageId' | 'state' | 'seed' | 'winnerUserId' | 'endAt'>>
): void {
  ensureGiveawayDbReady();
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
  ensureGiveawayDbReady();
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
  ensureGiveawayDbReady();
  return selectEntriesStmt.all(giveawayId) as GiveawayEntry[];
}

export function countUserEntries(giveawayId: string, userId: string): number {
  ensureGiveawayDbReady();
  const row = countUserEntriesStmt.get(giveawayId, userId) as { count: number };
  return row.count;
}

export function countAllEntries(giveawayId: string): number {
  ensureGiveawayDbReady();
  const row = countAllEntriesStmt.get(giveawayId) as { count: number };
  return row.count;
}

export function deleteEntries(giveawayId: string): void {
  ensureGiveawayDbReady();
  deleteEntriesStmt.run(giveawayId);
}

export function saveHistory(history: Omit<GiveawayHistory, 'id'>): number {
  ensureGiveawayDbReady();
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
  ensureGiveawayDbReady();
  return selectHistoryStmt.all(limit, offset) as GiveawayHistory[];
}

export function getHistoryCount(): number {
  ensureGiveawayDbReady();
  const row = countHistoryStmt.get() as { count: number };
  return row.count;
}

// PERFORMANCE OPTIMIZATION: Batch jackpot updates
export function queueJackpotUpdate(amount: number): void {
  ensureGiveawayDbReady();
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
  if (pendingJackpotAmount === 0) {
    return;
  }

  ensureGiveawayDbReady();

  const now = Date.now();
  updateJackpotStmt.run(pendingJackpotAmount, now);
  pendingJackpotAmount = 0;
  
  if (jackpotFlushTimer) {
    clearTimeout(jackpotFlushTimer);
    jackpotFlushTimer = null;
  }
}

export function getJackpotTotal(): number {
  ensureGiveawayDbReady();
  const row = selectJackpotStmt.get() as GlobalJackpot | undefined;
  return row?.totalVPSpent ?? 0;
}

export function addDailyModifier(
  date: string,
  modifierType: ModifierType,
  value: number,
  addedBy: string
): number {
  ensureGiveawayDbReady();
  const now = Date.now();
  const info = insertModifierStmt.run(date, modifierType, value, addedBy, now);
  return Number(info.lastInsertRowid);
}

export function getDailyModifiers(date: string): DailyModifier[] {
  ensureGiveawayDbReady();
  return selectModifiersStmt.all(date) as DailyModifier[];
}

export function getDailySchedule(): DailySchedule {
  ensureGiveawayDbReady();
  const row = selectDailyScheduleStmt.get() as DailySchedule;
  return row;
}

export function updateDailySchedule(lastRunDate: string, nextRunTime: number): void {
  ensureGiveawayDbReady();
  updateDailyScheduleStmt.run(lastRunDate, nextRunTime);
}

// STABILITY OPTIMIZATION: Graceful shutdown with pending flushes
export function closeGiveawayDb(): void {
  try {
    flushJackpotUpdates();
  } catch (error) {
    logger.warn('failed to flush jackpot updates during shutdown', { err: error });
  }

  if (db) {
    db.close();
    db = null;
  }

  if (jackpotFlushTimer) {
    clearTimeout(jackpotFlushTimer);
    jackpotFlushTimer = null;
  }
  pendingJackpotAmount = 0;

  statementsInitialized = false;
  schemaReady = false;
  schemaVerificationStmt = null;
}

