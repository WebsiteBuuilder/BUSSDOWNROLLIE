import { addVP, getOrCreateUser, removeVP } from '../db/index.js';
import { queueJackpotUpdate } from './db.js';
import { shouldCountForJackpot } from './provider-filter.js';

/**
 * Check user's VP balance
 */
export async function checkBalance(userId: string): Promise<number> {
  const user = await getOrCreateUser(userId);
  return user.vp;
}

/**
 * STABILITY OPTIMIZATION: Atomic transaction with automatic rollback
 * Charge VP for giveaway entry and track for jackpot if not provider
 */
export async function chargeEntry(
  userId: string,
  cost: number,
  reason: string,
  guildId?: string
): Promise<void> {
  try {
    await removeVP(userId, cost);
    
    // Track for global jackpot if not a provider
    if (await shouldCountForJackpot(userId, guildId)) {
      queueJackpotUpdate(cost);
    }
  } catch (error) {
    // If deduction fails, throw to caller for handling
    throw error;
  }
}

/**
 * Payout VP to winner
 */
export async function payoutWinner(
  userId: string,
  amount: number,
  reason: string
): Promise<void> {
  if (amount <= 0) return;
  await addVP(userId, amount, reason);
}

/**
 * Refund VP for cancelled entry
 */
export async function refundEntry(
  userId: string,
  amount: number,
  reason: string
): Promise<void> {
  if (amount <= 0) return;
  await addVP(userId, amount, reason);
}

/**
 * Payout to giveaway host
 */
export async function payoutHost(
  userId: string,
  amount: number,
  reason: string
): Promise<void> {
  if (amount <= 0) return;
  await addVP(userId, amount, reason);
}

