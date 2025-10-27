import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { showLobby, handleRouletteButton, showRouletteRules } from '../roulette/robust-manager.js';
import { safeReply } from '../utils/interaction.js';

export const data = new SlashCommandBuilder()
  .setName('roulette')
  .setDescription('Play European roulette with VP currency')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('play')
      .setDescription('Enter the roulette lobby')
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
      await showLobby(interaction);
    } catch (error) {
      console.error('❌ Error executing /roulette play:', error);
      await safeReply(interaction, {
        content: '❌ Failed to start roulette. Please try again soon.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

export { handleRouletteButton };
