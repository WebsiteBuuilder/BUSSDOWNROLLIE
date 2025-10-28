import { randomBytes, createHmac } from 'crypto';
import { Client, GuildTextBasedChannel, ChannelType } from 'discord.js';
import {
  GiveawayRecord,
  GiveawayEntry,
  GiveawayType,
  createGiveaway as createGiveawayDb,
  getGiveaway,
  getAllActive,
  getActiveInChannel,
  updateGiveaway,
  addEntry,
  getEntries,
  countUserEntries,
  countAllEntries,
  deleteEntries,
  saveHistory,
  getHistory as getHistoryDb,
  getHistoryCount,
  getJackpotTotal,
  getDailyModifiers,
  flushJackpotUpdates,
} from './db.js';
import {
  checkBalance,
  chargeEntry,
  payoutWinner,
  payoutHost,
  refundEntry,
} from './economy.js';
import {
  createGiveawayEmbed,
  buildGiveawayButtons,
  buildWinnerEmbed,
  buildJoinConfirmation,
  buildJoinFailure,
  buildHistoryEmbed,
  buildGiveawayListEmbed,
  buildEntrantsEmbed,
} from './ui.js';
import { runWinnerWheel } from './wheel.js';
import { logger } from '../logger.js';

// PERFORMANCE OPTIMIZATION: In-memory cache for active giveaways
const activeGiveawayCache = new Map<string, GiveawayRecord>();

export interface CreateGiveawayOptions {
  guildId: string;
  channelId: string;
  hostId: string;
  title: string;
  description: string | null;
  buyInCost: number;
  hostCut: number;
  maxEntriesPerUser: number;
  durationMs: number;
  type?: GiveawayType;
}

export class GiveawayService {
  constructor(private readonly client: Client) {}

  /**
   * Create a new giveaway
   */
  async createGiveaway(options: CreateGiveawayOptions): Promise<GiveawayRecord> {
    // Validate balance
    const balance = await checkBalance(options.hostId);
    if (balance < 1) {
      throw new Error('You need at least 1 VP to create a giveaway');
    }

    // Validate hostCut
    if (options.hostCut < 0 || options.hostCut > 50) {
      throw new Error('Host cut must be between 0 and 50%');
    }

    // Generate unique ID
    const id = randomBytes(8).toString('hex');
    const now = Date.now();
    const endAt = now + options.durationMs;

    const giveaway: GiveawayRecord = {
      id,
      guildId: options.guildId,
      channelId: options.channelId,
      messageId: null,
      hostId: options.hostId,
      title: options.title,
      description: options.description,
      buyInCost: options.buyInCost,
      hostCut: options.hostCut,
      maxEntriesPerUser: options.maxEntriesPerUser,
      startAt: now,
      endAt,
      state: 'ACTIVE',
      seed: null,
      winnerUserId: null,
      type: options.type || 'regular',
      createdAt: now,
      updatedAt: now,
    };

    // Create in database
    createGiveawayDb(giveaway);

    // Cache it
    activeGiveawayCache.set(id, giveaway);

    // Post to channel
    try {
      const channel = await this.fetchChannel(options.channelId);
      const stats = this.getStats(id);
      const message = await channel.send({
        embeds: [createGiveawayEmbed(giveaway, stats)],
        components: buildGiveawayButtons(giveaway),
      });

      updateGiveaway(id, { messageId: message.id });
      giveaway.messageId = message.id;
      activeGiveawayCache.set(id, giveaway);
    } catch (error) {
      logger.error('Failed to post giveaway message', { err: error, giveawayId: id });
    }

    return giveaway;
  }

  /**
   * STABILITY OPTIMIZATION: Join giveaway with atomic transaction and automatic rollback
   */
  async joinGiveaway(giveawayId: string, userId: string): Promise<{
    success: boolean;
    message: any;
  }> {
    const giveaway = this.getGiveawayFromCache(giveawayId);
    
    if (!giveaway) {
      return {
        success: false,
        message: buildJoinFailure('Giveaway not found'),
      };
    }

    if (giveaway.state !== 'ACTIVE') {
      return {
        success: false,
        message: buildJoinFailure('This giveaway is no longer accepting entries'),
      };
    }

    if (Date.now() >= giveaway.endAt) {
      return {
        success: false,
        message: buildJoinFailure('This giveaway has ended'),
      };
    }

    // Check entry limit
    const userEntryCount = countUserEntries(giveawayId, userId);
    if (userEntryCount >= giveaway.maxEntriesPerUser) {
      return {
        success: false,
        message: buildJoinFailure(
          `You've reached the maximum of ${giveaway.maxEntriesPerUser} entries`
        ),
      };
    }

    // Check balance
    const balance = await checkBalance(userId);
    if (balance < giveaway.buyInCost) {
      return {
        success: false,
        message: buildJoinFailure(`Insufficient balance. You need ${giveaway.buyInCost} VP`),
      };
    }

    // ATOMIC TRANSACTION: Charge VP and add entry with automatic rollback on failure
    try {
      await chargeEntry(userId, giveaway.buyInCost, `Giveaway ${giveawayId} entry`, giveaway.guildId);
      
      try {
        addEntry(giveawayId, userId);
      } catch (entryError) {
        // Rollback: refund the VP
        await refundEntry(userId, giveaway.buyInCost, `Giveaway ${giveawayId} entry rollback`);
        throw entryError;
      }
    } catch (error) {
      logger.error('Failed to process giveaway entry', { err: error, giveawayId, userId });
      return {
        success: false,
        message: buildJoinFailure('Failed to process your entry. Please try again.'),
      };
    }

    // Update the embed
    await this.updateGiveawayMessage(giveawayId);

    const newBalance = await checkBalance(userId);
    const newEntryCount = countUserEntries(giveawayId, userId);

    return {
      success: true,
      message: buildJoinConfirmation(giveaway, newBalance, newEntryCount),
    };
  }

  /**
   * End a giveaway and select winner
   */
  async endGiveaway(giveawayId: string): Promise<void> {
    const giveaway = this.getGiveawayFromCache(giveawayId);
    
    if (!giveaway || giveaway.state !== 'ACTIVE') {
      return;
    }

    // Enter revealing state
    const seed = randomBytes(16).toString('hex');
    updateGiveaway(giveawayId, { state: 'REVEALING', seed });
    giveaway.state = 'REVEALING';
    giveaway.seed = seed;
    activeGiveawayCache.set(giveawayId, giveaway);

    await this.updateGiveawayMessage(giveawayId);

    // Get entries
    const entries = getEntries(giveawayId);

    if (entries.length === 0) {
      // No entries, cancel
      updateGiveaway(giveawayId, { state: 'CANCELLED' });
      giveaway.state = 'CANCELLED';
      activeGiveawayCache.delete(giveawayId);
      await this.updateGiveawayMessage(giveawayId);
      return;
    }

    // Pick winner
    const winnerIndex = this.pickWeightedWinner(entries, seed);
    const winner = entries[winnerIndex];

    // Calculate payouts
    const pot = entries.length * giveaway.buyInCost;
    const hostAmount = Math.floor((pot * giveaway.hostCut) / 100);
    const payoutAmount = pot - hostAmount;

    // Payout
    if (payoutAmount > 0) {
      await payoutWinner(winner.userId, payoutAmount, `Giveaway ${giveawayId} win`);
    }
    if (hostAmount > 0) {
      await payoutHost(giveaway.hostId, hostAmount, `Giveaway ${giveawayId} host cut`);
    }

    // Update giveaway
    updateGiveaway(giveawayId, { state: 'COMPLETE', winnerUserId: winner.userId });
    giveaway.state = 'COMPLETE';
    giveaway.winnerUserId = winner.userId;
    activeGiveawayCache.delete(giveawayId);

    // Save to history
    saveHistory({
      giveawayId,
      winnerUserId: winner.userId,
      pot,
      payoutAmount,
      hostAmount,
      type: giveaway.type,
      seed,
      completedAt: Date.now(),
    });

    // Run wheel animation
    try {
      const channel = await this.fetchChannel(giveaway.channelId);
      await runWinnerWheel(channel, entries, winnerIndex);

      // Post winner announcement
      const stats = { pot };
      await channel.send({
        embeds: [buildWinnerEmbed(giveaway, { userId: winner.userId, payout: payoutAmount, hostAmount }, stats)],
      });
    } catch (error) {
      logger.error('Failed to announce winner', { err: error, giveawayId });
    }

    await this.updateGiveawayMessage(giveawayId);
  }

  /**
   * Cancel a giveaway and refund all entries
   */
  async cancelGiveaway(giveawayId: string, actorId: string): Promise<boolean> {
    const giveaway = this.getGiveawayFromCache(giveawayId);
    
    if (!giveaway || (giveaway.state !== 'ACTIVE' && giveaway.state !== 'REVEALING')) {
      return false;
    }

    // Get all entries
    const entries = getEntries(giveawayId);

    // Refund all
    for (const entry of entries) {
      try {
        await refundEntry(entry.userId, giveaway.buyInCost, `Giveaway ${giveawayId} cancelled`);
      } catch (error) {
        logger.error('Failed to refund entry', { err: error, giveawayId, userId: entry.userId });
      }
    }

    // Clear entries
    deleteEntries(giveawayId);

    // Update state
    updateGiveaway(giveawayId, { state: 'CANCELLED' });
    giveaway.state = 'CANCELLED';
    activeGiveawayCache.delete(giveawayId);

    await this.updateGiveawayMessage(giveawayId);

    return true;
  }

  /**
   * Deterministic weighted winner selection using HMAC-SHA256
   */
  private pickWeightedWinner(entries: GiveawayEntry[], seed: string): number {
    const digest = createHmac('sha256', seed)
      .update(JSON.stringify(entries.map(e => ({ userId: e.userId, id: e.id }))))
      .digest('hex');

    const index = Number(BigInt(`0x${digest}`) % BigInt(entries.length));
    return index;
  }

  /**
   * Get giveaway statistics
   */
  getStats(giveawayId: string): { entrantCount: number; pot: number } {
    const giveaway = this.getGiveawayFromCache(giveawayId);
    if (!giveaway) {
      return { entrantCount: 0, pot: 0 };
    }

    const entrantCount = countAllEntries(giveawayId);
    const pot = entrantCount * giveaway.buyInCost;

    return { entrantCount, pot };
  }

  /**
   * Update giveaway message in Discord
   */
  async updateGiveawayMessage(giveawayId: string): Promise<void> {
    const giveaway = this.getGiveawayFromCache(giveawayId);
    if (!giveaway || !giveaway.messageId) {
      return;
    }

    try {
      const channel = await this.fetchChannel(giveaway.channelId);
      const message = await channel.messages.fetch(giveaway.messageId);
      const stats = this.getStats(giveawayId);

      await message.edit({
        embeds: [createGiveawayEmbed(giveaway, stats)],
        components: buildGiveawayButtons(giveaway),
      });
    } catch (error) {
      logger.error('Failed to update giveaway message', { err: error, giveawayId });
    }
  }

  /**
   * Get giveaway from cache or database
   */
  private getGiveawayFromCache(giveawayId: string): GiveawayRecord | null {
    const cachedGiveaway = activeGiveawayCache.get(giveawayId);
    if (cachedGiveaway) {
      return cachedGiveaway;
    }
    
    const dbGiveaway = getGiveaway(giveawayId);
    if (dbGiveaway && (dbGiveaway.state === 'ACTIVE' || dbGiveaway.state === 'REVEALING')) {
      activeGiveawayCache.set(giveawayId, dbGiveaway);
    }
    return dbGiveaway;
  }

  /**
   * List all active giveaways
   */
  async listActiveGiveaways(guildId?: string): Promise<any> {
    const allActive = getAllActive();
    const filtered = guildId ? allActive.filter(g => g.guildId === guildId) : allActive;

    const giveawaysWithStats = filtered.map(giveaway => ({
      giveaway,
      stats: this.getStats(giveaway.id),
    }));

    return buildGiveawayListEmbed(giveawaysWithStats);
  }

  /**
   * Get entrants for a giveaway
   */
  async getEntrants(giveawayId: string): Promise<any> {
    const giveaway = this.getGiveawayFromCache(giveawayId);
    if (!giveaway) {
      return {
        ephemeral: true,
        content: 'Giveaway not found',
      };
    }

    const entries = getEntries(giveawayId);
    const entrantMap = new Map<string, number>();

    for (const entry of entries) {
      entrantMap.set(entry.userId, (entrantMap.get(entry.userId) || 0) + 1);
    }

    const entrants = Array.from(entrantMap.entries())
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count);

    return buildEntrantsEmbed(giveaway, entrants);
  }

  /**
   * Get giveaway history
   */
  async getGiveawayHistory(page: number = 1): Promise<any> {
    const perPage = 20;
    const offset = (page - 1) * perPage;
    const records = getHistoryDb(perPage, offset);
    const totalCount = getHistoryCount();
    const totalPages = Math.ceil(totalCount / perPage);

    return buildHistoryEmbed(records, page, totalPages);
  }

  /**
   * Get all active giveaway records (for scheduler)
   */
  getAllActiveGiveaways(): GiveawayRecord[] {
    return getAllActive();
  }

  /**
   * Check if there's an active giveaway in a channel
   */
  hasActiveInChannel(channelId: string): boolean {
    return getActiveInChannel(channelId) !== null;
  }

  /**
   * Get active giveaway in channel
   */
  getActiveInChannel(channelId: string): GiveawayRecord | null {
    return getActiveInChannel(channelId);
  }

  /**
   * Fetch Discord channel
   */
  private async fetchChannel(channelId: string): Promise<GuildTextBasedChannel> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }
    if (!channel.isTextBased() || channel.type === ChannelType.DM) {
      throw new Error(`Channel ${channelId} is not a guild text channel`);
    }
    return channel as GuildTextBasedChannel;
  }

  /**
   * Clear cache for a giveaway
   */
  clearCache(giveawayId: string): void {
    activeGiveawayCache.delete(giveawayId);
  }

  /**
   * Reload cache from database
   */
  reloadCache(): void {
    activeGiveawayCache.clear();
    const active = getAllActive();
    for (const giveaway of active) {
      activeGiveawayCache.set(giveaway.id, giveaway);
    }
  }
}

