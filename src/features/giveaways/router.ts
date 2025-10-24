import { ButtonInteraction, Client } from 'discord.js';
import { GiveawayAuditService } from './audit.ts';
import { GiveawayLockManager } from './locks.ts';
import { GiveawayService } from './service.ts';
import { GiveawayScheduler } from './scheduler.ts';
import { logger } from '../../logger.js';

interface GiveawayContext {
  service: GiveawayService;
  scheduler: GiveawayScheduler;
}

let context: GiveawayContext | null = null;

export function initGiveaways(client: Client): GiveawayContext {
  if (context) {
    return context;
  }
  const auditor = new GiveawayAuditService(client);
  const locks = new GiveawayLockManager();
  const service = new GiveawayService(client, auditor, locks);
  const scheduler = new GiveawayScheduler(service);
  scheduler.start();
  context = { service, scheduler };
  return context;
}

export function getGiveawayService(): GiveawayService {
  if (!context) {
    throw new Error('Giveaway service not initialized');
  }
  return context.service;
}

export function getGiveawayScheduler(): GiveawayScheduler {
  if (!context) {
    throw new Error('Giveaway scheduler not initialized');
  }
  return context.scheduler;
}

export function isGiveawayButton(customId: string): boolean {
  return customId.startsWith('giveaway:');
}

export async function handleGiveawayButton(interaction: ButtonInteraction): Promise<void> {
  if (!context) {
    logger.warn('Giveaway button interaction before initialization', {
      customId: interaction.customId,
    });
    await interaction.reply({
      content: 'Giveaway system is not ready yet.',
      ephemeral: true,
    });
    return;
  }

  const parts = interaction.customId.split(':');
  if (parts.length < 3) {
    await interaction.reply({ content: 'Invalid button.', ephemeral: true });
    return;
  }

  const [, action, giveawayId] = parts;
  if (action === 'join') {
    const result = await context.service.buyIn(giveawayId, interaction.user.id);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(result.message);
    } else {
      await interaction.reply(result.message);
    }
    return;
  }

  if (action === 'entrants') {
    const reply = await context.service.showEntrants(giveawayId);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
    return;
  }

  await interaction.reply({ content: 'Unknown giveaway action.', ephemeral: true });
}
