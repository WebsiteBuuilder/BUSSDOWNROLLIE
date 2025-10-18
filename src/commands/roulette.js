import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { startRoulette, handleRouletteButton } from '../roulette/manager.js';
import { safeReply } from '../utils/interaction.js';

export const data = new SlashCommandBuilder()
  .setName('roulette')
  .setDescription('Spin the cinematic roulette wheel for points.')
  .addIntegerOption((option) =>
    option.setName('amount').setDescription('Points to wager').setRequired(true).setMinValue(1)
  );

export async function execute(interaction) {
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
