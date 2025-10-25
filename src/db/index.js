import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
