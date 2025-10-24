import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getGiveawayService } from '../features/giveaways/router.ts';

export const data = new SlashCommandBuilder()
  .setName('gbuyin')
  .setDescription('Buy into an active giveaway in this channel')
  .addStringOption((option) =>
    option.setName('giveaway_id').setDescription('Specific giveaway ID (optional)')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const service = getGiveawayService();

  if (!interaction.guildId || !interaction.channelId) {
    await interaction.reply({ content: 'This command can only be used in a guild channel.', ephemeral: true });
    return;
  }

  const giveawayId = interaction.options.getString('giveaway_id');
  const targetGiveawayId = giveawayId ?? service.getActiveGiveaway(interaction.channelId)?.id ?? null;

  if (!targetGiveawayId) {
    await interaction.reply({ content: 'No active giveaway found in this channel.', ephemeral: true });
    return;
  }

  const result = await service.buyIn(targetGiveawayId, interaction.user.id);
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(result.message);
  } else {
    await interaction.reply(result.message);
  }
}
