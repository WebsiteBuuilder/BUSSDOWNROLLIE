// [AI FIX]: Comprehensive Prisma environment + DATABASE_URL validation BEFORE any imports
// Prisma reads configuration at import-time, so everything must be prepared up-front.
// Import Node.js built-ins (safe before Prisma/logger).
import { existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

/**
 * Force Prisma to use local binary engines instead of the Data Proxy.
 * Some environments (Railway) inject PRISMA_* env vars that flip it to `prisma://`.
 * 
 * [CRITICAL FIX]: This MUST run BEFORE importing @prisma/client because
 * the client reads these env vars at import time. If the client was generated
 * with Data Proxy enabled, we need to ensure runtime doesn't try to use it.
 */
function enforcePrismaBinaryEngines() {
  const overrides = {
    PRISMA_CLIENT_ENGINE_TYPE: 'binary',
    PRISMA_GENERATE_DATAPROXY: 'false',
    PRISMA_QUERY_ENGINE_TYPE: 'binary',
    PRISMA_CLI_QUERY_ENGINE_TYPE: 'binary',
    // Additional flags to ensure Data Proxy is disabled
    PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: '1',
  };

  for (const [key, value] of Object.entries(overrides)) {
    const existing = process.env[key];
    if (existing !== value) {
      console.log(`[DB] Forcing ${key}=${value} (was ${existing ?? 'unset'})`);
      process.env[key] = value;
    }
  }
  
  // [CRITICAL]: Also ensure DATABASE_URL is NOT a prisma:// URL
  // If it somehow got set to prisma://, that's the root cause
  if (process.env.DATABASE_URL?.startsWith('prisma://')) {
    console.error('[DB] ERROR: DATABASE_URL is set to prisma:// but we need file:// for SQLite!');
    console.error('[DB] Current DATABASE_URL:', process.env.DATABASE_URL);
    console.error('[DB] This will cause P6001 errors. Please check Railway environment variables.');
  }
}

enforcePrismaBinaryEngines();

/**
 * Validates and normalizes DATABASE_URL for SQLite
 * Ensures the URL is in the correct format and the directory exists
 */
function validateAndSetDatabaseUrl() {
  let dbUrl = process.env.DATABASE_URL;
  const originalUrl = dbUrl;
  
  // Step 1: Handle empty or whitespace-only URLs
  if (!dbUrl || (typeof dbUrl === 'string' && dbUrl.trim() === '')) {
    // Default to SQLite database based on environment
    const defaultDbPath = process.env.NODE_ENV === 'production' 
      ? 'file:/data/guhdeats.db' 
      : 'file:./prisma/dev.db';
    dbUrl = defaultDbPath;
    console.log(`[DB] DATABASE_URL not set or empty, using default: ${defaultDbPath}`);
  }
  
  // Step 2: Normalize the URL format
  // Remove any whitespace
  dbUrl = dbUrl.trim();
  
  // Step 3: Ensure it starts with 'file:' protocol for SQLite
  // [CRITICAL]: Reject prisma:// URLs - they indicate Data Proxy mode which we don't use
  if (dbUrl.startsWith('prisma://')) {
    throw new Error(`DATABASE_URL cannot be prisma:// (Data Proxy). This project uses direct SQLite connection. Current value: ${dbUrl}`);
  }
  
  if (!dbUrl.startsWith('file:')) {
    // If it's an absolute path starting with /
    if (dbUrl.startsWith('/')) {
      dbUrl = `file:${dbUrl}`;
    } else {
      // Relative path - ensure it's properly formatted
      dbUrl = `file:./${dbUrl.replace(/^\.\//, '')}`;
    }
    console.log(`[DB] DATABASE_URL missing file: protocol, auto-correcting: ${originalUrl} -> ${dbUrl}`);
  }
  
  // Step 4: Extract file path and ensure directory exists
  if (dbUrl.startsWith('file:')) {
    const filePath = dbUrl.replace(/^file:/, '');
    let absolutePath;
    
    // Resolve to absolute path
    if (filePath.startsWith('/')) {
      absolutePath = filePath;
    } else {
      // Relative path - resolve from current working directory
      absolutePath = resolve(process.cwd(), filePath);
    }
    
    // Ensure the directory exists
    const dbDir = dirname(absolutePath);
    if (!existsSync(dbDir)) {
      try {
        mkdirSync(dbDir, { recursive: true });
        console.log(`[DB] Created database directory: ${dbDir}`);
      } catch (error) {
        console.error(`[DB] Failed to create database directory: ${dbDir}`, error);
        // Continue anyway - Prisma might create it
      }
    }
    
    // Reconstruct URL with absolute path for consistency
    dbUrl = `file:${absolutePath}`;
  }
  
  // Step 5: Set the validated URL
  process.env.DATABASE_URL = dbUrl;
  
  // Step 6: Log final URL (safe for logging)
  const logUrl = dbUrl.startsWith('file:') ? dbUrl : '[REDACTED]';
  console.log(`[DB] Using DATABASE_URL: ${logUrl}`);
  
  return dbUrl;
}

// Execute validation immediately
const validatedDbUrl = validateAndSetDatabaseUrl();

// Now import logger after DATABASE_URL is set
import { logger } from '../logger.js';

let PrismaClientConstructor = null;
let prismaInitializationError = null;

// [AI FIX]: Import Prisma client with error handling
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

// [CRITICAL FIX]: Create Prisma client - simple instantiation, no overrides
// PrismaClient reads DATABASE_URL from process.env automatically
// We've already validated and set DATABASE_URL above, so no constructor args needed
let prisma;
let connectionPromise = null;

try {
  if (PrismaClientConstructor) {
    // Simple instantiation - PrismaClient will use DATABASE_URL from process.env
    // No datasources override, no custom config - just plain PrismaClient
    prisma = new PrismaClientConstructor();
    
    // [CRITICAL FIX]: Test connection with a simple query to verify Prisma is configured correctly
    // This will catch P6001 errors immediately if client was generated for Data Proxy
    connectionPromise = prisma.$connect()
      .then(async () => {
        // Test with a simple query to ensure Prisma accepts file:// URLs
        try {
          await prisma.$queryRaw`SELECT 1`;
          logger.info('Prisma database connection established successfully', {
            dbUrl: validatedDbUrl.startsWith('file:') ? validatedDbUrl : '[REDACTED]'
          });
          return true;
        } catch (queryError) {
          // If query fails with P6001, the client was generated for Data Proxy
          if (queryError.code === 'P6001' || (queryError.message && queryError.message.includes('prisma://'))) {
            console.error('═══════════════════════════════════════════════════');
            console.error('CRITICAL: Prisma client was generated for Data Proxy!');
            console.error('═══════════════════════════════════════════════════');
            console.error('The Prisma client expects prisma:// URLs but DATABASE_URL is file://');
            console.error('This means prisma generate was run with Data Proxy enabled.');
            console.error('');
            console.error('SOLUTION: Regenerate Prisma client WITHOUT Data Proxy:');
            console.error('   npm run prisma:generate');
            console.error('   OR on Railway, ensure PRISMA_GENERATE_DATAPROXY=false');
            console.error('═══════════════════════════════════════════════════');
            throw queryError;
          }
          throw queryError;
        }
      })
      .catch((error) => {
        // Log error but don't throw - connection will be retried on first query
        // However, if it's P6001, we've already logged detailed diagnostics above
        if (error.code !== 'P6001') {
          logger.error('Prisma database connection failed (will retry on first query)', { 
            err: error,
            dbUrl: validatedDbUrl.startsWith('file:') ? validatedDbUrl : '[REDACTED]',
            message: error.message
          });
        }
        return false;
      });
  } else {
    prisma = createPrismaFallback();
  }
} catch (error) {
  logger.error('Failed to initialize Prisma client', { err: error });
  prisma = createPrismaFallback();
}

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

  try {
    // [CRITICAL]: Test connection first to catch P6001 errors early
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (testError) {
      if (testError.code === 'P6001' || (testError.message && testError.message.includes('prisma://'))) {
        console.error('═══════════════════════════════════════════════════');
        console.error('CRITICAL: Cannot initialize database - Prisma Data Proxy misconfiguration');
        console.error('═══════════════════════════════════════════════════');
        console.error('Error:', testError.message);
        console.error('DATABASE_URL:', process.env.DATABASE_URL);
        console.error('');
        console.error('The Prisma client was generated for Data Proxy but DATABASE_URL is file://');
        console.error('Regenerate the client: npm run prisma:generate');
        console.error('═══════════════════════════════════════════════════');
        throw testError;
      }
      // Other connection errors - log but continue
      logger.warn('Database connection test failed, but continuing initialization', { err: testError });
    }

    for (const [key, value] of Object.entries(defaultConfig)) {
      const existing = await prisma.config.findUnique({ where: { key } });
      if (!existing) {
        await prisma.config.create({
          data: { key, value },
        });
      }
    }
    console.log('✅ Database initialized with default config');
  } catch (error) {
    // [CRITICAL]: Check for P6001 specifically
    if (error.code === 'P6001' || (error.message && error.message.includes('prisma://'))) {
      console.error('═══════════════════════════════════════════════════');
      console.error('PRISMA DATA PROXY ERROR in initializeDatabase');
      console.error('═══════════════════════════════════════════════════');
      console.error('Error Code:', error.code);
      console.error('Error Message:', error.message);
      console.error('DATABASE_URL:', process.env.DATABASE_URL);
      console.error('═══════════════════════════════════════════════════');
    }
    logger.error('Failed to initialize database config', { 
      err: error,
      errorCode: error.code,
      clientVersion: error.clientVersion
    });
    throw error;
  }
}

/**
 * Get or create a user by Discord ID
 * [AI FIX]: Added error handling for database operations
 */
export async function getOrCreateUser(discordId) {
  try {
    let user = await prisma.user.findUnique({
      where: { discordId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { discordId },
      });
    }

    return user;
  } catch (error) {
    // [CRITICAL]: Check if this is the P6001 Data Proxy error
    if (error.code === 'P6001' || (error.message && error.message.includes('prisma://'))) {
      console.error('═══════════════════════════════════════════════════');
      console.error('PRISMA DATA PROXY MISCONFIGURATION DETECTED');
      console.error('═══════════════════════════════════════════════════');
      console.error('Error Code:', error.code);
      console.error('Error Message:', error.message);
      console.error('Current DATABASE_URL:', process.env.DATABASE_URL);
      console.error('Prisma Client Version:', error.clientVersion);
      console.error('');
      console.error('SOLUTION:');
      console.error('1. Ensure Prisma client is regenerated WITHOUT Data Proxy:');
      console.error('   Run: npm run prisma:generate');
      console.error('2. Check Railway environment variables - ensure DATABASE_URL is file://');
      console.error('3. Verify no PRISMA_* env vars are forcing Data Proxy mode');
      console.error('═══════════════════════════════════════════════════');
    }
    
    logger.error('Failed to get or create user', { 
      discordId, 
      err: error,
      errorCode: error.code,
      clientVersion: error.clientVersion,
      dbUrl: process.env.DATABASE_URL?.startsWith('file:') ? process.env.DATABASE_URL : '[REDACTED]'
    });
    throw error;
  }
}

/**
 * Get config value with fallback
 */
export async function getConfig(key, defaultValue = null) {
  try {
    const config = await prisma.config.findUnique({ where: { key } });
    return config ? config.value : defaultValue;
  } catch (error) {
    logger.error('Failed to get config', { key, err: error });
    return defaultValue;
  }
}

/**
 * Set config value
 */
export async function setConfig(key, value) {
  try {
    await prisma.config.upsert({
      where: { key },
      update: { value: value.toString() },
      create: { key, value: value.toString() },
    });
  } catch (error) {
    logger.error('Failed to set config', { key, value, err: error });
    throw error;
  }
}

/**
 * Add VP to user with transaction safety
 */
export async function addVP(discordId, amount, _reason = 'Unknown') {
  try {
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
  } catch (error) {
    logger.error('Failed to add VP', { discordId, amount, err: error });
    throw error;
  }
}

/**
 * Remove VP from user with validation
 */
export async function removeVP(discordId, amount) {
  try {
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
  } catch (error) {
    logger.error('Failed to remove VP', { discordId, amount, err: error });
    throw error;
  }
}

/**
 * Transfer VP between users
 */
export async function transferVP(fromDiscordId, toDiscordId, amount, fee) {
  try {
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
  } catch (error) {
    logger.error('Failed to transfer VP', { fromDiscordId, toDiscordId, amount, fee, err: error });
    throw error;
  }
}

/**
 * Check if user has active battle
 */
export async function hasActiveBattle(discordId) {
  try {
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
  } catch (error) {
    logger.error('Failed to check active battle', { discordId, err: error });
    return false;
  }
}

/**
 * Check if user has active blackjack round
 */
export async function hasActiveBlackjack(discordId) {
  try {
    const user = await getOrCreateUser(discordId);

    const activeRound = await prisma.blackjackRound.findFirst({
      where: {
        userId: user.id,
        result: null,
      },
    });

    return activeRound !== null;
  } catch (error) {
    logger.error('Failed to check active blackjack', { discordId, err: error });
    return false;
  }
}

/**
 * Get leaderboard page
 */
export async function getLeaderboard(page = 1, perPage = 10) {
  try {
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
  } catch (error) {
    logger.error('Failed to get leaderboard', { page, perPage, err: error });
    return {
      users: [],
      page,
      perPage,
      totalPages: 0,
      totalUsers: 0,
    };
  }
}
