import { SlashCommandBuilder } from 'discord.js';
import { getGiveawayService, ensureGiveawayRuntimeAvailable } from '../giveaway/runtime.js';

export const data = new SlashCommandBuilder()
  .setName('ghistory')
  .setDescription('📜 View past giveaway winners')
  .addIntegerOption((option) =>
    option
      .setName('page')
      .setDescription('Page number')
      .setMinValue(1)
  );

export async function execute(interaction) {
  const available = await ensureGiveawayRuntimeAvailable(interaction);
  if (!available) {
    return;
  }

  const service = getGiveawayService();
  const page = interaction.options.getInteger('page') || 1;

  await interaction.deferReply({ ephemeral: true });

  try {
    const embed = await service.getGiveawayHistory(page);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error fetching giveaway history:', error);
    await interaction.editReply({
      content: '❌ Failed to fetch giveaway history.',
    });
  }
}

