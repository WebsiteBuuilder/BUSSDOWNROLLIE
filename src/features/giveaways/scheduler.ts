import { GiveawayRecord } from './model.ts';
import { GiveawayService } from './service.ts';
import { logger } from '../../logger.js';

export class GiveawayScheduler {
  private revealTimers = new Map<string, NodeJS.Timeout>();
  private completionTimers = new Map<string, NodeJS.Timeout>();
  private heartbeat: NodeJS.Timeout | null = null;

  constructor(private readonly service: GiveawayService) {}

  start(): void {
    void this.recover();
    this.heartbeat = setInterval(() => {
      void this.recover();
    }, 30_000);
  }

  stop(): void {
    for (const timer of this.revealTimers.values()) {
      clearTimeout(timer);
    }
    for (const timer of this.completionTimers.values()) {
      clearTimeout(timer);
    }
    this.revealTimers.clear();
    this.completionTimers.clear();
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }

  async recover(): Promise<void> {
    const giveaways = this.service.listActiveGiveaways();
    const now = Date.now();
    for (const giveaway of giveaways) {
      if (giveaway.state === 'ACTIVE') {
        const revealAt = giveaway.endAt - giveaway.revealWindowSeconds * 1000;
        if (now >= revealAt) {
          await this.service.beginReveal(giveaway.id);
          await this.refreshGiveaway(giveaway.id);
          continue;
        }
        this.scheduleReveal(giveaway, revealAt - now);
      }

      if (giveaway.state === 'REVEALING') {
        if (now >= giveaway.endAt) {
          await this.service.completeGiveaway(giveaway.id);
          continue;
        }
        this.scheduleCompletion(giveaway, giveaway.endAt - now);
      }
    }
  }

  async refreshGiveaway(giveawayId: string): Promise<void> {
    const status = await this.service.getStatus(giveawayId);
    if (!status) {
      return;
    }
    this.clearTimers(giveawayId);
    const giveaway = status.giveaway;
    const now = Date.now();
    if (giveaway.state === 'ACTIVE') {
      const revealAt = giveaway.endAt - giveaway.revealWindowSeconds * 1000;
      const delay = Math.max(revealAt - now, 0);
      this.scheduleReveal(giveaway, delay);
    } else if (giveaway.state === 'REVEALING') {
      const delay = Math.max(giveaway.endAt - now, 0);
      this.scheduleCompletion(giveaway, delay);
    }
  }

  scheduleNewGiveaway(giveaway: GiveawayRecord): void {
    this.clearTimers(giveaway.id);
    const now = Date.now();
    const revealAt = giveaway.endAt - giveaway.revealWindowSeconds * 1000;
    const revealDelay = Math.max(revealAt - now, 0);
    this.scheduleReveal(giveaway, revealDelay);
  }

  private scheduleReveal(giveaway: GiveawayRecord, delay: number): void {
    if (delay <= 0) {
      void this.service.beginReveal(giveaway.id).then(() => this.refreshGiveaway(giveaway.id));
      return;
    }

    const timer = setTimeout(() => {
      this.revealTimers.delete(giveaway.id);
      void this.service
        .beginReveal(giveaway.id)
        .then(() => this.refreshGiveaway(giveaway.id))
        .catch((error) => {
          logger.error('Failed to begin giveaway reveal', { err: error, giveawayId: giveaway.id });
        });
    }, delay);

    this.revealTimers.set(giveaway.id, timer);
  }

  private scheduleCompletion(giveaway: GiveawayRecord, delay: number): void {
    if (delay <= 0) {
      void this.service.completeGiveaway(giveaway.id);
      return;
    }

    const timer = setTimeout(() => {
      this.completionTimers.delete(giveaway.id);
      void this.service.completeGiveaway(giveaway.id).catch((error) => {
        logger.error('Failed to complete giveaway', { err: error, giveawayId: giveaway.id });
      });
    }, delay);

    this.completionTimers.set(giveaway.id, timer);
  }

  private clearTimers(giveawayId: string): void {
    const revealTimer = this.revealTimers.get(giveawayId);
    if (revealTimer) {
      clearTimeout(revealTimer);
      this.revealTimers.delete(giveawayId);
    }
    const completionTimer = this.completionTimers.get(giveawayId);
    if (completionTimer) {
      clearTimeout(completionTimer);
      this.completionTimers.delete(giveawayId);
    }
  }
}
