import Database from 'better-sqlite3';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbDirectory = join(__dirname, '../../data');
fs.mkdirSync(dbDirectory, { recursive: true });

const databasePath = join(dbDirectory, 'blackjack-results.sqlite');

const db = new Database(databasePath);

db.pragma('journal_mode = WAL');

db.prepare(
  `CREATE TABLE IF NOT EXISTS blackjack_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guildId TEXT NOT NULL,
    userId TEXT NOT NULL,
    delta INTEGER NOT NULL,
    createdAt INTEGER NOT NULL
  )`
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_results_guild_time
   ON blackjack_results(guildId, createdAt)`
).run();

db.prepare(
  `CREATE INDEX IF NOT EXISTS idx_results_guild_user_time
   ON blackjack_results(guildId, userId, createdAt)`
).run();

const insertResultStatement = db.prepare(
  `INSERT INTO blackjack_results (guildId, userId, delta, createdAt)
   VALUES (@guildId, @userId, @delta, @createdAt)`
);

const topWinnerStatement = db.prepare(
  `SELECT userId, SUM(delta) AS net
   FROM blackjack_results
   WHERE guildId = @guildId
     AND createdAt >= @sinceMs
   GROUP BY userId
   HAVING net > 0
   ORDER BY net DESC
   LIMIT 1`
);

export function recordBlackjackResult({ guildId, userId, delta }) {
  if (!guildId || !userId || typeof delta !== 'number' || Number.isNaN(delta)) {
    return;
  }

  const createdAt = Date.now();
  const normalizedDelta = Math.trunc(delta);

  insertResultStatement.run({ guildId, userId, delta: normalizedDelta, createdAt });
}

export function getTopWinner24h(guildId) {
  if (!guildId) {
    return null;
  }

  const sinceMs = Date.now() - 24 * 60 * 60 * 1000;
  const row = topWinnerStatement.get({ guildId, sinceMs });

  if (!row) {
    return null;
  }

  return { userId: row.userId, net: Number(row.net) };
}
