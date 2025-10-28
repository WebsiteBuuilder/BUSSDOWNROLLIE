import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getGiveawayService, getGiveawayScheduler } from '../giveaway/router.js';

export const data = new SlashCommandBuilder()
  .setName('gcancel')
  .setDescription('⛔ Cancel an active giveaway and refund all entrants');

export async function execute(interaction) {
  const service = getGiveawayService();
  const scheduler = getGiveawayScheduler();

  // Find active giveaway in this channel
  const giveaway = service.getActiveInChannel(interaction.channelId);

  if (!giveaway) {
    await interaction.reply({
      content: '❌ No active giveaway found in this channel.',
      ephemeral: true,
    });
    return;
  }

  // Check permissions
  const isHost = giveaway.hostId === interaction.user.id;
  const hasAdminPerm = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

  if (!isHost && !hasAdminPerm) {
    await interaction.reply({
      content: '❌ Only the host or server admins can cancel this giveaway.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const success = await service.cancelGiveaway(giveaway.id, interaction.user.id);

    if (success) {
      scheduler.cancelSchedule(giveaway.id);
      await interaction.editReply({
        content: '✅ Giveaway cancelled and all entries refunded.',
      });
    } else {
      await interaction.editReply({
        content: '❌ Failed to cancel giveaway.',
      });
    }
  } catch (error) {
    console.error('Error cancelling giveaway:', error);
    await interaction.editReply({
      content: '❌ An error occurred while cancelling the giveaway.',
    });
  }
}

