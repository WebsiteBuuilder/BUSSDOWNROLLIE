import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { startRoulette, handleRouletteButton, showRouletteRules } from '../roulette/enhanced-manager.js';
import { safeReply } from '../utils/interaction.js';

export const data = new SlashCommandBuilder()
  .setName('roulette')
  .setDescription('Play European roulette with enhanced betting options')
  .addIntegerOption((option) =>
    option.setName('amount').setDescription('Initial VP amount to start with').setRequired(true).setMinValue(1)
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('rules')
      .setDescription('View roulette rules and betting options')
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand(false);
  
  if (subcommand === 'rules') {
    return showRouletteRules(interaction);
  }

  const amount = interaction.options.getInteger('amount', true);

  try {
    await startRoulette(interaction, amount);
  } catch (error) {
    await safeReply(interaction, {
      content: '❌ Failed to start roulette. Please try again soon.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

export { handleRouletteButton };
