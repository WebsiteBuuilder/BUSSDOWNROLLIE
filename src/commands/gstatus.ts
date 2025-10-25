import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getGiveawayService } from '../features/giveaways/router.js';
import { buildStatusEmbed } from '../features/giveaways/ui.js';

export const data = new SlashCommandBuilder()
  .setName('gstatus')
  .setDescription('Check the status of a giveaway')
  .addStringOption((option) =>
    option.setName('giveaway_id').setDescription('Specific giveaway ID (optional)')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const service = getGiveawayService();

  const giveawayId = interaction.options.getString('giveaway_id');
  const targetId =
    giveawayId ??
    (interaction.channelId ? service.getActiveGiveaway(interaction.channelId)?.id ?? null : null);

  if (!targetId) {
    await interaction.reply({ content: 'No active giveaway found here.', ephemeral: true });
    return;
  }

  const status = await service.getStatus(targetId);
  if (!status) {
    await interaction.reply({ content: 'Giveaway not found.', ephemeral: true });
    return;
  }

  await interaction.reply({
    embeds: [buildStatusEmbed(status.giveaway, status.stats)],
    ephemeral: true,
  });
}
