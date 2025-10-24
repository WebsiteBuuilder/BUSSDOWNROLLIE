import { randomBytes, createHmac } from 'crypto';
import {
  ChannelType,
  Client,
  GuildTextBasedChannel,
  InteractionReplyOptions,
} from 'discord.js';
import {
  GiveawayRecord,
  GiveawayEntry,
  GiveawayPotSnapshot,
  GiveawayState,
} from './model.ts';
import {
  addEntry,
  clearEntries,
  countEntriesForUser,
  createGiveaway,
  getAllActiveGiveaways,
  getActiveGiveawayInChannel as getActiveGiveawayInChannelDb,
  getConfig as getStoredConfig,
  getEntries,
  getGiveaway,
  getPotSnapshot,
  listEntrants,
  updateConfig as updateStoredConfig,
  updateGiveaway,
} from './db.ts';
import { GiveawayAuditService } from './audit.ts';
import { GiveawayLockManager } from './locks.ts';
import { addPoints, getBalance, subtractPoints } from './economy.ts';
import {
  buildGiveawayComponents,
  buildGiveawayEmbed,
  buildJoinConfirmation,
  buildJoinFailure,
  buildWheelAnnouncement,
  buildWinnerEmbed,
  entrantsReply,
} from './ui.ts';
import { runFallbackWheel } from './wheel.ts';
import { logger } from '../../logger.js';

export interface GiveawayConfigInput {
  buyInCost: number;
  maxEntriesPerUser: number;
  revealWindowSeconds: number;
  payoutRatio: number;
}

export interface StartGiveawayOptions {
  guildId: string;
  channelId: string;
  hostId: string;
  title: string;
  description: string | null;
  buyInCost: number;
  maxEntriesPerUser: number;
  revealWindowSeconds: number;
  payoutRatio: number;
  durationMs: number;
}

export interface BuyInResult {
  success: boolean;
  message: InteractionReplyOptions;
}

export class GiveawayService {
  constructor(
    private readonly client: Client,
    private readonly auditor: GiveawayAuditService,
    private readonly locks: GiveawayLockManager
  ) {}

  getConfig(): GiveawayConfigInput {
    const stored = getStoredConfig();
    return {
      buyInCost: stored.defaultBuyInCost,
      maxEntriesPerUser: stored.defaultMaxEntriesPerUser,
      revealWindowSeconds: stored.defaultRevealWindowSeconds,
      payoutRatio: stored.defaultPayoutRatio,
    };
  }

  updateConfig(config: Partial<GiveawayConfigInput>): GiveawayConfigInput {
    const stored = updateStoredConfig({
      defaultBuyInCost: config.buyInCost,
      defaultMaxEntriesPerUser: config.maxEntriesPerUser,
      defaultRevealWindowSeconds: config.revealWindowSeconds,
      defaultPayoutRatio: config.payoutRatio,
    });
    return {
      buyInCost: stored.defaultBuyInCost,
      maxEntriesPerUser: stored.defaultMaxEntriesPerUser,
      revealWindowSeconds: stored.defaultRevealWindowSeconds,
      payoutRatio: stored.defaultPayoutRatio,
    };
  }

  async startGiveaway(options: StartGiveawayOptions): Promise<GiveawayRecord> {
    const now = Date.now();
    const endAt = now + options.durationMs;
    const giveaway: GiveawayRecord = {
      id: randomBytes(8).toString('hex'),
      guildId: options.guildId,
      channelId: options.channelId,
      messageId: null,
      hostId: options.hostId,
      title: options.title,
      description: options.description,
      buyInCost: options.buyInCost,
      maxEntriesPerUser: options.maxEntriesPerUser,
      revealWindowSeconds: options.revealWindowSeconds,
      payoutRatio: options.payoutRatio,
      startAt: now,
      endAt,
      state: 'ACTIVE',
      seed: null,
      winnerUserId: null,
      createdAt: now,
      updatedAt: now,
    };

    createGiveaway(giveaway);

    const channel = await this.fetchChannel(options.channelId);
    const stats = getPotSnapshot(giveaway.id, giveaway.buyInCost);
    const message = await channel.send({
      embeds: [buildGiveawayEmbed(giveaway, stats)],
      components: buildGiveawayComponents(giveaway),
    });

    updateGiveaway(giveaway.id, { messageId: message.id });
    giveaway.messageId = message.id;

    await this.auditor.log(giveaway.id, options.hostId, 'START', {
      buyInCost: giveaway.buyInCost,
      durationMs: options.durationMs,
      revealWindowSeconds: giveaway.revealWindowSeconds,
      payoutRatio: giveaway.payoutRatio,
    });

    return giveaway;
  }

  async buyIn(giveawayId: string, userId: string): Promise<BuyInResult> {
    const giveaway = getGiveaway(giveawayId);
    if (!giveaway) {
      return { success: false, message: buildJoinFailure('Giveaway not found.') };
    }

    if (giveaway.state !== 'ACTIVE') {
      return { success: false, message: buildJoinFailure('Giveaway is not accepting entries right now.') };
    }

    if (Date.now() >= giveaway.endAt) {
      return { success: false, message: buildJoinFailure('This giveaway has already closed.') };
    }

    return this.locks.withLock<BuyInResult>(giveaway.id, async () => {
      const refreshed = getGiveaway(giveaway.id);
      if (!refreshed || refreshed.state !== 'ACTIVE') {
        return { success: false, message: buildJoinFailure('Giveaway is closed.') };
      }

      const userEntries = countEntriesForUser(giveaway.id, userId);
      if (userEntries >= refreshed.maxEntriesPerUser) {
        return {
          success: false,
          message: buildJoinFailure('You have reached the maximum number of entries.'),
        };
      }

      const balance = await getBalance(userId);
      if (balance < refreshed.buyInCost) {
        return {
          success: false,
          message: buildJoinFailure('Insufficient VP balance.'),
        };
      }

      try {
        await subtractPoints(userId, refreshed.buyInCost, `Giveaway ${refreshed.id} buy-in`);
      } catch (error) {
        logger.error('Failed to deduct points for giveaway', { err: error, giveawayId: refreshed.id });
        return {
          success: false,
          message: buildJoinFailure('Could not deduct VP for buy-in.'),
        };
      }

      try {
        addEntry(refreshed.id, userId);
      } catch (error) {
        await addPoints(userId, refreshed.buyInCost, `Giveaway ${refreshed.id} refund`);
        logger.error('Failed to record giveaway entry', { err: error, giveawayId: refreshed.id });
        return {
          success: false,
          message: buildJoinFailure('Could not record your entry. You have been refunded.'),
        };
      }

      const stats = getPotSnapshot(refreshed.id, refreshed.buyInCost);
      await this.updateMainMessage(refreshed.id, stats);
      await this.auditor.log(refreshed.id, userId, 'BUY_IN', {
        balanceBefore: balance,
        balanceAfter: balance - refreshed.buyInCost,
      });

      return {
        success: true,
        message: buildJoinConfirmation(refreshed, balance - refreshed.buyInCost),
      };
    });
  }

  async getStatus(giveawayId: string): Promise<{ giveaway: GiveawayRecord; stats: GiveawayPotSnapshot } | null> {
    const giveaway = getGiveaway(giveawayId);
    if (!giveaway) {
      return null;
    }
    const stats = getPotSnapshot(giveaway.id, giveaway.buyInCost);
    return { giveaway, stats };
  }

  async cancelGiveaway(giveawayId: string, actorId: string): Promise<boolean> {
    return this.locks.withLock<boolean>(giveawayId, async () => {
      const giveaway = getGiveaway(giveawayId);
      if (!giveaway || (giveaway.state !== 'ACTIVE' && giveaway.state !== 'REVEALING')) {
        return false;
      }

      updateGiveaway(giveaway.id, { state: 'CANCELLED' });
      const entries = getEntries(giveaway.id);
      for (const entry of entries) {
        await addPoints(entry.userId, giveaway.buyInCost, `Giveaway ${giveaway.id} refund`);
      }
      clearEntries(giveaway.id);

      const stats = getPotSnapshot(giveaway.id, giveaway.buyInCost);
      await this.updateMainMessage(giveaway.id, stats);
      await this.auditor.log(giveaway.id, actorId, 'CANCEL', {
        refunds: entries.length,
      });
      return true;
    });
  }

  async forceReveal(giveawayId: string, actorId: string): Promise<boolean> {
    return this.locks.withLock<boolean>(giveawayId, async () => {
      const giveaway = getGiveaway(giveawayId);
      if (!giveaway || giveaway.state !== 'ACTIVE') {
        return false;
      }

      const now = Date.now();
      const seed = randomBytes(16).toString('hex');
      updateGiveaway(giveaway.id, {
        state: 'REVEALING',
        seed,
        endAt: now + 30_000,
        revealWindowSeconds: 30,
      });

      const stats = getPotSnapshot(giveaway.id, giveaway.buyInCost);
      await this.updateMainMessage(giveaway.id, stats);
      const channel = await this.fetchChannel(giveaway.channelId);
      await channel.send({ embeds: [buildWheelAnnouncement(seed)] });
      await this.auditor.log(giveaway.id, actorId, 'FORCE_REVEAL', { seed });
      return true;
    });
  }

  async beginReveal(giveawayId: string): Promise<void> {
    await this.locks.withLock(giveawayId, async () => {
      const giveaway = getGiveaway(giveawayId);
      if (!giveaway || giveaway.state !== 'ACTIVE') {
        return;
      }
      const seed = randomBytes(16).toString('hex');
      updateGiveaway(giveaway.id, { state: 'REVEALING', seed });
      const stats = getPotSnapshot(giveaway.id, giveaway.buyInCost);
      await this.updateMainMessage(giveaway.id, stats);
      const channel = await this.fetchChannel(giveaway.channelId);
      await channel.send({ embeds: [buildWheelAnnouncement(seed)] });
      await this.auditor.log(giveaway.id, null, 'REVEAL_START', { seed });
    });
  }

  async completeGiveaway(giveawayId: string): Promise<void> {
    await this.locks.withLock(giveawayId, async () => {
      const giveaway = getGiveaway(giveawayId);
      if (!giveaway || giveaway.state !== 'REVEALING') {
        return;
      }

      const entries = getEntries(giveaway.id);
      if (entries.length === 0) {
        updateGiveaway(giveaway.id, { state: 'CANCELLED' });
        await this.auditor.log(giveaway.id, null, 'NO_ENTRIES', {});
        return;
      }

      const seed = giveaway.seed ?? randomBytes(16).toString('hex');
      const digest = createHmac('sha256', seed)
        .update(JSON.stringify(entries.map((entry) => ({ userId: entry.userId, entryIndex: entry.entryIndex }))))
        .digest('hex');
      const index = Number(BigInt(`0x${digest}`) % BigInt(entries.length));
      const winner = entries[index];
      const stats = getPotSnapshot(giveaway.id, giveaway.buyInCost);
      const payout = Math.floor((stats.pot * giveaway.payoutRatio) / 100);

      if (payout > 0) {
        await addPoints(winner.userId, payout, `Giveaway ${giveaway.id} win`);
      }

      updateGiveaway(giveaway.id, {
        state: 'COMPLETE',
        winnerUserId: winner.userId,
        seed,
      });

      const channel = await this.fetchChannel(giveaway.channelId);
      await runFallbackWheel(channel, entries, index);
      await channel.send({
        embeds: [buildWinnerEmbed(giveaway, { winnerUserId: winner.userId, payout, seed, winnerIndex: index }, stats)],
      });
      await this.updateMainMessage(giveaway.id, stats);

      await this.auditor.log(giveaway.id, winner.userId, 'COMPLETE', {
        payout,
        seed,
        winnerIndex: index,
      });
    });
  }

  async updateMainMessage(giveawayId: string, stats: GiveawayPotSnapshot): Promise<void> {
    const giveaway = getGiveaway(giveawayId);
    if (!giveaway?.messageId) {
      return;
    }

    try {
      const channel = await this.fetchChannel(giveaway.channelId);
      const message = await channel.messages.fetch(giveaway.messageId);
      await message.edit({
        embeds: [buildGiveawayEmbed(giveaway, stats)],
        components: buildGiveawayComponents(giveaway),
      });
    } catch (error) {
      logger.error('Failed to update giveaway message', { err: error, giveawayId });
    }
  }

  async showEntrants(giveawayId: string): Promise<InteractionReplyOptions> {
    const entrants = listEntrants(giveawayId);
    return entrantsReply(entrants);
  }

  async fetchChannel(channelId: string): Promise<GuildTextBasedChannel> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }
    if (!channel.isTextBased() || channel.type === ChannelType.DM) {
      throw new Error(`Channel ${channelId} is not a guild text channel`);
    }
    return channel as GuildTextBasedChannel;
  }

  listActiveGiveaways(): GiveawayRecord[] {
    return getAllActiveGiveaways();
  }

  hasActiveGiveawayInChannel(channelId: string): boolean {
    return getActiveGiveawayInChannelDb(channelId) !== null;
  }

  getActiveGiveaway(channelId: string): GiveawayRecord | null {
    return getActiveGiveawayInChannelDb(channelId);
  }

  async fastForward(giveawayId: string, seconds: number): Promise<boolean> {
    return this.locks.withLock<boolean>(giveawayId, async () => {
      const giveaway = getGiveaway(giveawayId);
      if (!giveaway) {
        return false;
      }
      updateGiveaway(giveaway.id, { endAt: Date.now() + seconds * 1000 });
      return true;
    });
  }

  async addMockEntries(giveawayId: string, count: number): Promise<number> {
    return this.locks.withLock<number>(giveawayId, async () => {
      const giveaway = getGiveaway(giveawayId);
      if (!giveaway) {
        return 0;
      }
      let added = 0;
      for (let i = 0; i < count; i += 1) {
        const mockUserId = `999${randomBytes(3).toString('hex')}`;
        addEntry(giveaway.id, mockUserId);
        added += 1;
      }
      const stats = getPotSnapshot(giveaway.id, giveaway.buyInCost);
      await this.updateMainMessage(giveaway.id, stats);
      return added;
    });
  }
}
