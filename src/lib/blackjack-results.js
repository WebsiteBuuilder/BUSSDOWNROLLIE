import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbDirectory = join(__dirname, '../../data');
fs.mkdirSync(dbDirectory, { recursive: true });

const databasePath = join(dbDirectory, 'blackjack-results.json');

function readStore() {
  try {
    const raw = fs.readFileSync(databasePath, 'utf8');
    const parsed = JSON.parse(raw);

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      Array.isArray(parsed.results) &&
      Number.isSafeInteger(parsed.nextId)
    ) {
      return { results: parsed.results, nextId: parsed.nextId };
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to read blackjack results store:', error);
    }
  }

  return { results: [], nextId: 1 };
}

function writeStore({ results, nextId }) {
  const payload = JSON.stringify({ results, nextId }, null, 2);
  fs.writeFileSync(databasePath, payload);
}

const store = readStore();

function persist() {
  writeStore(store);
}

export function recordBlackjackResult({ guildId, userId, delta }) {
  if (!guildId || !userId || typeof delta !== 'number' || Number.isNaN(delta)) {
    return;
  }

  const createdAt = Date.now();
  const normalizedDelta = Math.trunc(delta);

  store.results.push({
    id: store.nextId++,
    guildId,
    userId,
    delta: normalizedDelta,
    createdAt,
  });

  try {
    persist();
  } catch (error) {
    console.error('Failed to persist blackjack result:', error);
  }
}

export function getTopWinner24h(guildId) {
  if (!guildId) {
    return null;
  }

  const sinceMs = Date.now() - 24 * 60 * 60 * 1000;

  const aggregates = new Map();

  for (const result of store.results) {
    if (result.guildId !== guildId || result.createdAt < sinceMs) {
      continue;
    }

    const current = aggregates.get(result.userId) ?? 0;
    aggregates.set(result.userId, current + result.delta);
  }

  let topUserId = null;
  let topNet = 0;

  for (const [userId, net] of aggregates.entries()) {
    if (net > 0 && (topUserId === null || net > topNet)) {
      topUserId = userId;
      topNet = net;
    }
  }

  if (topUserId === null) {
    return null;
  }

  return { userId: topUserId, net: topNet };
}
