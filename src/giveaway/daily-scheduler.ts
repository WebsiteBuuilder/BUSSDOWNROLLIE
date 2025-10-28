import { Client } from 'discord.js';
import { GiveawayService } from './service.js';
import { GiveawayScheduler } from './scheduler.js';
import { getDailySchedule, updateDailySchedule, getDailyModifiers } from './db.js';
import { logger } from '../logger.js';

const BASE_DAILY_POT = 50;
const DAILY_TIME_HOUR = 9; // 9 AM
const DAILY_TIME_MINUTE = 0;

/**
 * Get current EST time
 */
function getESTDate(): Date {
  const now = new Date();
  const utcOffset = now.getTimezoneOffset();
  const estOffset = -300; // EST is UTC-5
  const estTime = new Date(now.getTime() + (utcOffset - estOffset) * 60000);
  return estTime;
}

/**
 * Get today's date string in EST
 */
function getTodayDateStringEST(): string {
  const est = getESTDate();
  return est.toISOString().split('T')[0];
}

/**
 * Calculate next 9AM EST timestamp
 */
function getNext9AMEST(): number {
  const now = new Date();
  const est = getESTDate();
  
  // Set to 9 AM EST today
  est.setHours(DAILY_TIME_HOUR, DAILY_TIME_MINUTE, 0, 0);
  
  // If we've passed 9 AM today, set to 9 AM tomorrow
  if (est.getTime() <= now.getTime()) {
    est.setDate(est.getDate() + 1);
  }
  
  return est.getTime();
}

/**
 * Daily giveaway auto-scheduler
 */
export class DailyGiveawayScheduler {
  private checkInterval: NodeJS.Timeout | null = null;
  private defaultChannelId: string | null = null;
  private defaultGuildId: string | null = null;

  constructor(
    private readonly client: Client,
    private readonly service: GiveawayService,
    private readonly scheduler: GiveawayScheduler
  ) {}

  /**
   * Start the daily scheduler
   */
  start(guildId?: string, channelId?: string): void {
    this.defaultGuildId = guildId || null;
    this.defaultChannelId = channelId || null;

    logger.info('Starting daily giveaway scheduler');

    // Check immediately
    this.checkAndTrigger();

    // Check every hour
    this.checkInterval = setInterval(() => {
      this.checkAndTrigger();
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check if it's time to trigger daily giveaway
   */
  private async checkAndTrigger(): Promise<void> {
    try {
      const schedule = getDailySchedule();
      const today = getTodayDateStringEST();

      // Check if already ran today
      if (schedule.lastRunDate === today) {
        logger.debug('Daily giveaway already ran today');
        return;
      }

      const now = Date.now();
      const next9AM = getNext9AMEST();

      // Update next run time if not set
      if (schedule.nextRunTime === 0 || schedule.nextRunTime < now) {
        updateDailySchedule(schedule.lastRunDate, next9AM);
      }

      // Check if it's time to run (within 5 minutes of 9 AM EST)
      const est = getESTDate();
      const currentHour = est.getHours();
      const currentMinute = est.getMinutes();

      if (
        currentHour === DAILY_TIME_HOUR &&
        currentMinute >= 0 &&
        currentMinute < 5
      ) {
        logger.info('Triggering daily giveaway');
        await this.triggerDailyGiveaway();
        updateDailySchedule(today, getNext9AMEST());
      }
    } catch (error) {
      logger.error('Error in daily giveaway check', { err: error });
    }
  }

  /**
   * Trigger the daily giveaway
   */
  private async triggerDailyGiveaway(): Promise<void> {
    if (!this.defaultGuildId || !this.defaultChannelId) {
      logger.warn('Daily giveaway: No default channel configured');
      return;
    }

    try {
      // Check if there's already an active giveaway in the channel
      if (this.service.hasActiveInChannel(this.defaultChannelId)) {
        logger.warn('Daily giveaway: Channel already has active giveaway');
        return;
      }

      const today = getTodayDateStringEST();
      const modifiers = getDailyModifiers(today);

      let basePot = BASE_DAILY_POT;
      let multiplier = 1;

      for (const mod of modifiers) {
        if (mod.modifierType === 'pot_boost') {
          basePot += mod.value;
        } else if (mod.modifierType === 'multiplier') {
          multiplier = Math.max(multiplier, mod.value);
        }
      }

      const finalPot = Math.floor(basePot * multiplier);

      let description =
        `🌅 **Automatic Daily Giveaway**\n\n` +
        `Base pot: ${BASE_DAILY_POT} VP\n`;

      if (modifiers.length > 0) {
        description += `\n⚡ **Active Boosts:**\n`;
        for (const mod of modifiers) {
          if (mod.modifierType === 'pot_boost') {
            description += `• +${mod.value} VP bonus\n`;
          } else if (mod.modifierType === 'multiplier') {
            description += `• ${mod.value}x multiplier\n`;
          }
        }
      }

      description += `\n💰 **Final Pot: ${finalPot} VP**`;

      const giveaway = await this.service.createGiveaway({
        guildId: this.defaultGuildId,
        channelId: this.defaultChannelId,
        hostId: this.client.user!.id,
        title: '📅 DAILY GIVEAWAY',
        description,
        buyInCost: 1,
        hostCut: 0,
        maxEntriesPerUser: 5,
        durationMs: 60 * 60 * 1000, // 1 hour
        type: 'daily',
      });

      // Schedule the end
      this.scheduler.scheduleNew(giveaway.id, giveaway.endAt);

      logger.info('Daily giveaway started automatically', {
        giveawayId: giveaway.id,
        pot: finalPot,
      });
    } catch (error) {
      logger.error('Failed to trigger daily giveaway', { err: error });
    }
  }

  /**
   * Set the default channel for daily giveaways
   */
  setDefaultChannel(guildId: string, channelId: string): void {
    this.defaultGuildId = guildId;
    this.defaultChannelId = channelId;
    logger.info('Set daily giveaway channel', { guildId, channelId });
  }
}

