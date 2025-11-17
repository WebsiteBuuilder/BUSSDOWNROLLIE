// [AI FIX]: Ensure DATABASE_URL is set correctly for SQLite BEFORE any imports
// This must happen before importing logger or Prisma client, as Prisma reads DATABASE_URL at instantiation
// Prisma SQLite requires DATABASE_URL to start with 'file:' protocol
const originalDbUrl = process.env.DATABASE_URL;
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
  // Default to SQLite database in project root for development, or /data for production
  const defaultDbPath = process.env.NODE_ENV === 'production' 
    ? 'file:/data/guhdeats.db' 
    : 'file:./prisma/dev.db';
  process.env.DATABASE_URL = defaultDbPath;
  console.log(`[DB] DATABASE_URL not set or empty, using default SQLite database: ${defaultDbPath}`);
} else if (!process.env.DATABASE_URL.startsWith('file:') && !process.env.DATABASE_URL.startsWith('prisma://')) {
  // If DATABASE_URL is set but doesn't start with file: or prisma://, assume it's a file path
  const originalUrl = process.env.DATABASE_URL;
  const dbPath = process.env.DATABASE_URL.startsWith('/') 
    ? `file:${process.env.DATABASE_URL}` 
    : `file:./${process.env.DATABASE_URL}`;
  process.env.DATABASE_URL = dbPath;
  console.log(`[DB] DATABASE_URL missing file: protocol, auto-correcting: ${originalUrl} -> ${dbPath}`);
}

// [AI FIX]: Log final DATABASE_URL for debugging (without exposing sensitive data)
const finalDbUrl = process.env.DATABASE_URL;
console.log(`[DB] Using DATABASE_URL: ${finalDbUrl.startsWith('file:') ? finalDbUrl : '[REDACTED]'}`);

import { logger } from '../logger.js';

let PrismaClientConstructor = null;
let prismaInitializationError = null;

try {
  const pkg = await import('@prisma/client');
  PrismaClientConstructor = pkg?.PrismaClient ?? pkg?.default?.PrismaClient ?? null;

  if (!PrismaClientConstructor) {
    throw new Error('PrismaClient export is missing from @prisma/client.');
  }
} catch (error) {
  prismaInitializationError = error;
  logger.warn('Prisma client unavailable; database features are disabled until the client is generated.', { err: error });
}

function createUnavailableError(method) {
  const baseMessage =
    'Prisma client is unavailable. Run `npx prisma generate` to create the client before starting the bot.';
  const details = prismaInitializationError ? ` Original error: ${prismaInitializationError.message}` : '';
  const error = new Error(`${baseMessage}${details}`);
  error.code = 'PRISMA_UNAVAILABLE';
  if (method) {
    error.meta = { method };
  }
  return error;
}

function createUnavailableModelProxy() {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          return undefined;
        }
        return async () => {
          throw createUnavailableError(String(prop));
        };
      },
    },
  );
}

function createPrismaFallback() {
  const modelProxy = createUnavailableModelProxy();
  return new Proxy(
    {
      $disconnect: async () => {},
      $connect: async () => {
        throw createUnavailableError('$connect');
      },
      $transaction: async () => {
        throw createUnavailableError('$transaction');
      },
    },
    {
      get(target, prop) {
        if (prop in target) {
          return target[prop];
        }
        return modelProxy;
      },
    },
  );
}

// [AI FIX]: Pass DATABASE_URL directly to PrismaClient constructor to ensure it's used correctly
// This ensures the validated DATABASE_URL is used even if environment variable was set incorrectly
const prisma = PrismaClientConstructor 
  ? new PrismaClientConstructor({ 
      datasources: { 
        db: { url: process.env.DATABASE_URL } 
      } 
    }) 
  : createPrismaFallback();

export const prismaStatus = {
  available: Boolean(PrismaClientConstructor),
  error: prismaInitializationError,
};

export default prisma;

/**
 * Initialize database with default config values
 */
export async function initializeDatabase() {
  const defaultConfig = {
    cooldown_hours: '0',
    require_provider_approval: 'true',
    daily_rng_chance: '0.10',
    five_cost: '25',
    free_cost: '60',
    transfer_fee_percent: '5',
    battle_rake_percent: '2',
    bj_min: '1',
    daily_amount: '1',
  };

  for (const [key, value] of Object.entries(defaultConfig)) {
    const existing = await prisma.config.findUnique({ where: { key } });
    if (!existing) {
      await prisma.config.create({
        data: { key, value },
      });
    }
  }

  console.log('✅ Database initialized with default config');
}

/**
 * Get or create a user by Discord ID
 */
export async function getOrCreateUser(discordId) {
  let user = await prisma.user.findUnique({
    where: { discordId },
  });

  if (!user) {
    user = await prisma.user.create({
      data: { discordId },
    });
  }

  return user;
}

/**
 * Get config value with fallback
 */
export async function getConfig(key, defaultValue = null) {
  const config = await prisma.config.findUnique({ where: { key } });
  return config ? config.value : defaultValue;
}

/**
 * Set config value
 */
export async function setConfig(key, value) {
  await prisma.config.upsert({
    where: { key },
    update: { value: value.toString() },
    create: { key, value: value.toString() },
  });
}

/**
 * Add VP to user with transaction safety
 */
export async function addVP(discordId, amount, _reason = 'Unknown') {
  const user = await getOrCreateUser(discordId);

  if (user.blacklisted) {
    throw new Error('User is blacklisted');
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      vp: {
        increment: amount,
      },
    },
  });

  return updated;
}

/**
 * Remove VP from user with validation
 */
export async function removeVP(discordId, amount) {
  const user = await getOrCreateUser(discordId);

  if (user.vp < amount) {
    throw new Error('Insufficient VP balance');
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      vp: {
        decrement: amount,
      },
    },
  });

  return updated;
}

/**
 * Transfer VP between users
 */
export async function transferVP(fromDiscordId, toDiscordId, amount, fee) {
  const fromUser = await getOrCreateUser(fromDiscordId);
  const toUser = await getOrCreateUser(toDiscordId);

  if (fromUser.blacklisted) {
    throw new Error('Sender is blacklisted');
  }

  const totalCost = amount + fee;
  if (fromUser.vp < totalCost) {
    throw new Error('Insufficient VP balance');
  }

  // Use transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Deduct from sender
    const updatedFrom = await tx.user.update({
      where: { id: fromUser.id },
      data: { vp: { decrement: totalCost } },
    });

    // Add to recipient
    const updatedTo = await tx.user.update({
      where: { id: toUser.id },
      data: { vp: { increment: amount } },
    });

    // Create transfer record
    const transfer = await tx.transfer.create({
      data: {
        fromUserId: fromUser.id,
        toUserId: toUser.id,
        amount,
        fee,
      },
    });

    return { updatedFrom, updatedTo, transfer };
  });

  return result;
}

/**
 * Check if user has active battle
 */
export async function hasActiveBattle(discordId) {
  const user = await getOrCreateUser(discordId);

  const activeBattle = await prisma.battle.findFirst({
    where: {
      OR: [{ challengerId: user.id }, { opponentId: user.id }],
      status: {
        in: ['open', 'accepted'],
      },
    },
  });

  return activeBattle !== null;
}

/**
 * Check if user has active blackjack round
 */
export async function hasActiveBlackjack(discordId) {
  const user = await getOrCreateUser(discordId);

  const activeRound = await prisma.blackjackRound.findFirst({
    where: {
      userId: user.id,
      result: null,
    },
  });

  return activeRound !== null;
}

/**
 * Get leaderboard page
 */
export async function getLeaderboard(page = 1, perPage = 10) {
  const skip = (page - 1) * perPage;

  const users = await prisma.user.findMany({
    orderBy: {
      vp: 'desc',
    },
    skip,
    take: perPage,
    where: {
      vp: {
        gt: 0,
      },
    },
  });

  const totalUsers = await prisma.user.count({
    where: {
      vp: {
        gt: 0,
      },
    },
  });

  return {
    users,
    page,
    perPage,
    totalPages: Math.ceil(totalUsers / perPage),
    totalUsers,
  };
}
