import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import {
  startRoulette,
  handleRouletteButton as handleRouletteButtonRobust,
  showRouletteRules,
} from '../roulette/robust-manager.js';
import { handleRouletteButton as handleRouletteButtonClassic } from '../roulette/manager.js';
import { safeReply } from '../utils/interaction.js';

export const data = new SlashCommandBuilder()
  .setName('roulette')
  .setDescription('Play European roulette with VP currency')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('play')
      .setDescription('Start a roulette game')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('rules')
      .setDescription('View roulette rules and betting options')
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  
  if (subcommand === 'rules') {
    return showRouletteRules(interaction);
  }
  
  if (subcommand === 'play') {
    try {
      await startRoulette(interaction);
    } catch (error) {
      await safeReply(interaction, {
        content: '❌ Failed to start roulette. Please try again soon.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

export async function handleRouletteButton(interaction) {
  const customId = interaction.customId ?? '';

  if (customId.startsWith('roulette_')) {
    return handleRouletteButtonRobust(interaction);
  }

  if (customId.startsWith('roulette:')) {
    return handleRouletteButtonClassic(interaction);
  }

  return false;
}
