import { SlashCommandBuilder } from 'discord.js';
import { getGiveawayService } from '../giveaway/router.js';

export const data = new SlashCommandBuilder()
  .setName('glist')
  .setDescription('📋 View all active giveaways in this server');

export async function execute(interaction) {
  const service = getGiveawayService();

  await interaction.deferReply({ ephemeral: true });

  try {
    const embed = await service.listActiveGiveaways(interaction.guildId);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error listing giveaways:', error);
    await interaction.editReply({
      content: '❌ Failed to list giveaways.',
    });
  }
}

