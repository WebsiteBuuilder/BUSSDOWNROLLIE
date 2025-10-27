import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { startRoulette, handleRouletteButton, showRouletteRules } from '../roulette/simple-manager.js';
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

export { handleRouletteButton };
