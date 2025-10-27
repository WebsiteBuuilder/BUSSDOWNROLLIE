import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { startRoulette, handleRouletteButton, showRouletteRules } from '../roulette/robust-manager.js';
import { getAnimationStatus } from '../roulette/safe-animation.js';
import { safeReply } from '../utils/interaction.js';

export const data = new SlashCommandBuilder()
  .setName('roulette')
  .setDescription('Play European roulette with VP currency')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('play')
      .setDescription('Start playing roulette')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('rules')
      .setDescription('View roulette rules and betting options')
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  
  // Always allow rules to be viewed
  if (subcommand === 'rules') {
    return showRouletteRules(interaction);
  }
  
  // Check if cinematic animation is available before allowing play
  if (subcommand === 'play') {
    const { available } = getAnimationStatus();
    
    if (!available) {
      return interaction.reply({
        content: '❌ **Roulette is Temporarily Unavailable**\n\n' +
                 'The cinematic wheel renderer is currently offline due to missing dependencies.\n\n' +
                 '⚠️ This is a system issue. Please contact an administrator.\n\n' +
                 '_The roulette system requires canvas rendering libraries to function._',
        flags: MessageFlags.Ephemeral
      });
    }
    
    try {
      await startRoulette(interaction);
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
