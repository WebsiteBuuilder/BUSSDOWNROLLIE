import { Client, ButtonInteraction } from 'discord.js';
import { GiveawayService } from './service.js';
import { GiveawayScheduler } from './scheduler.js';
import { DailyGiveawayScheduler } from './daily-scheduler.js';
import { initGiveawayDb, closeGiveawayDb, flushJackpotUpdates } from './db.js';
import { logger } from '../logger.js';

interface GiveawayContext {
  service: GiveawayService;
  scheduler: GiveawayScheduler;
  dailyScheduler: DailyGiveawayScheduler;
}

let context: GiveawayContext | null = null;

/**
 * Initialize the giveaway system
 */
export function initGiveawaySystem(client: Client): GiveawayContext {
  if (context) {
    return context;
  }

  logger.info('Initializing giveaway system');

  // Initialize database
  initGiveawayDb();

  // Create service and scheduler
  const service = new GiveawayService(client);
  const scheduler = new GiveawayScheduler(service);
  const dailyScheduler = new DailyGiveawayScheduler(client, service, scheduler);

  // Start schedulers
  scheduler.start();
  dailyScheduler.start();

  // Setup graceful shutdown handlers
  setupShutdownHandlers(scheduler, dailyScheduler);

  context = { service, scheduler, dailyScheduler };

  logger.info('Giveaway system initialized');
  return context;
}

/**
 * STABILITY OPTIMIZATION: Graceful shutdown handler
 */
function setupShutdownHandlers(
  scheduler: GiveawayScheduler,
  dailyScheduler: DailyGiveawayScheduler
): void {
  const shutdown = async () => {
    logger.info('Gracefully shutting down giveaway system');
    
    // Stop schedulers
    await scheduler.stop();
    dailyScheduler.stop();
    
    // Flush pending jackpot updates
    flushJackpotUpdates();
    
    // Close database
    closeGiveawayDb();
    
    logger.info('Giveaway system shut down');
  };

  // Register shutdown handlers
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

/**
 * Get the giveaway service instance
 */
export function getGiveawayService(): GiveawayService {
  if (!context) {
    throw new Error('Giveaway system not initialized');
  }
  return context.service;
}

/**
 * Get the giveaway scheduler instance
 */
export function getGiveawayScheduler(): GiveawayScheduler {
  if (!context) {
    throw new Error('Giveaway system not initialized');
  }
  return context.scheduler;
}

/**
 * Get the daily giveaway scheduler instance
 */
export function getDailyScheduler(): DailyGiveawayScheduler {
  if (!context) {
    throw new Error('Giveaway system not initialized');
  }
  return context.dailyScheduler;
}

/**
 * Check if a button interaction is for the giveaway system
 */
export function isGiveawayButton(customId: string): boolean {
  return customId.startsWith('giveaway:');
}

/**
 * Handle giveaway button interactions
 */
export async function handleGiveawayButton(interaction: ButtonInteraction): Promise<void> {
  if (!context) {
    logger.warn('Giveaway button interaction before initialization', {
      customId: interaction.customId,
    });
    await interaction.reply({
      content: 'Giveaway system is not ready yet. Please try again in a moment.',
      ephemeral: true,
    });
    return;
  }

  const parts = interaction.customId.split(':');
  if (parts.length < 3) {
    await interaction.reply({
      content: 'Invalid button interaction.',
      ephemeral: true,
    });
    return;
  }

  const [, action, giveawayId] = parts;

  try {
    if (action === 'join') {
      const result = await context.service.joinGiveaway(giveawayId, interaction.user.id);
      await interaction.reply(result.message);
      return;
    }

    if (action === 'entrants') {
      const reply = await context.service.getEntrants(giveawayId);
      await interaction.reply(reply);
      return;
    }

    await interaction.reply({
      content: 'Unknown action.',
      ephemeral: true,
    });
  } catch (error) {
    logger.error('Error handling giveaway button', {
      err: error,
      customId: interaction.customId,
      userId: interaction.user.id,
    });

    const errorMessage = {
      content: 'An error occurred. Please try again.',
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
}

