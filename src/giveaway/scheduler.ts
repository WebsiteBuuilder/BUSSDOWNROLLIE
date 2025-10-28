import { GiveawayService } from './service.js';
import { getDailySchedule, updateDailySchedule } from './db.js';
import { logger } from '../logger.js';

/**
 * STABILITY OPTIMIZATION: Scheduler with heartbeat recovery and graceful shutdown
 */
export class GiveawayScheduler {
  private timers = new Map<string, NodeJS.Timeout>();
  private heartbeat: NodeJS.Timeout | null = null;
  private dailyCheckInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(private readonly service: GiveawayService) {}

  /**
   * Start the scheduler
   */
  start(): void {
    logger.info('Starting giveaway scheduler');

    // Recover active giveaways
    this.recover();

    // STABILITY OPTIMIZATION: Heartbeat every 30 seconds to check for orphaned timers
    this.heartbeat = setInterval(() => {
      if (!this.isShuttingDown) {
        this.recover();
      }
    }, 30_000);

    // Check for daily giveaway every hour
    this.scheduleDailyCheck();
    this.dailyCheckInterval = setInterval(() => {
      if (!this.isShuttingDown) {
        this.checkDailyTrigger();
      }
    }, 3600_000); // Check every hour
  }

  /**
   * STABILITY OPTIMIZATION: Graceful shutdown
   */
  async stop(): Promise<void> {
    this.isShuttingDown = true;
    logger.info('Stopping giveaway scheduler');

    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }

    if (this.dailyCheckInterval) {
      clearInterval(this.dailyCheckInterval);
      this.dailyCheckInterval = null;
    }
  }

  /**
   * STABILITY OPTIMIZATION: Recover and reschedule all active giveaways
   */
  private recover(): void {
    const activeGiveaways = this.service.getAllActiveGiveaways();
    const now = Date.now();

    for (const giveaway of activeGiveaways) {
      // Check if already scheduled
      if (this.timers.has(giveaway.id)) {
        continue;
      }

      // Check if should end now
      if (now >= giveaway.endAt) {
        // End immediately
        this.service.endGiveaway(giveaway.id).catch(error => {
          logger.error('Failed to end giveaway during recovery', {
            err: error,
            giveawayId: giveaway.id,
          });
        });
        continue;
      }

      // Schedule for later
      this.scheduleGiveawayEnd(giveaway.id, giveaway.endAt);
    }
  }

  /**
   * Schedule a giveaway to end at a specific time
   */
  scheduleGiveawayEnd(giveawayId: string, endAt: number): void {
    const now = Date.now();
    const delay = Math.max(0, endAt - now);

    // Clear existing timer if any
    const existingTimer = this.timers.get(giveawayId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new timer
    const timer = setTimeout(() => {
      this.timers.delete(giveawayId);
      this.service.endGiveaway(giveawayId).catch(error => {
        logger.error('Failed to end giveaway', {
          err: error,
          giveawayId,
        });
      });
    }, delay);

    this.timers.set(giveawayId, timer);

    logger.info('Scheduled giveaway end', {
      giveawayId,
      delay: Math.floor(delay / 1000),
    });
  }

  /**
   * Cancel a scheduled giveaway
   */
  cancelSchedule(giveawayId: string): void {
    const timer = this.timers.get(giveawayId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(giveawayId);
    }
  }

  /**
   * Schedule a new giveaway (called when creating)
   */
  scheduleNew(giveawayId: string, endAt: number): void {
    this.scheduleGiveawayEnd(giveawayId, endAt);
  }

  /**
   * Check if daily giveaway should trigger
   */
  private scheduleDailyCheck(): void {
    this.checkDailyTrigger();
  }

  /**
   * Check if it's time for the daily giveaway (9AM EST)
   */
  private checkDailyTrigger(): void {
    // This will be implemented in daily-scheduler integration
    // For now, just log that we checked
    logger.debug('Checked daily giveaway trigger');
  }

  /**
   * Get current timer count (for monitoring)
   */
  getActiveTimerCount(): number {
    return this.timers.size;
  }
}

