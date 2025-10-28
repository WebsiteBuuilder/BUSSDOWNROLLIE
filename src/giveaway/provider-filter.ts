import { getProviderRoleIds } from '../lib/utils.js';

/**
 * Check if a user has a provider role in a guild
 */
export async function isProvider(userId: string, guildId?: string): Promise<boolean> {
  if (!guildId) return false;
  
  const providerRoleIds = getProviderRoleIds();
  if (providerRoleIds.length === 0) return false;
  
  // We can't check roles directly without a guild member object
  // This will be checked at the service layer where we have access to the interaction
  return false;
}

/**
 * Check if a user's VP transactions should count toward the jackpot
 * Providers are excluded from jackpot calculations
 */
export async function shouldCountForJackpot(userId: string, guildId?: string): Promise<boolean> {
  // For now, we'll handle provider filtering at the command level
  // This is a placeholder that returns true by default
  // The actual filtering happens in the leaderboard
  return true;
}

/**
 * Filter providers from leaderboard results
 * This will be used in the leaderboard command
 */
export function filterLeaderboard<T extends { discordId: string }>(
  users: T[],
  providerIds: Set<string>
): T[] {
  return users.filter(user => !providerIds.has(user.discordId));
}

