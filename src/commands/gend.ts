import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { getGiveawayScheduler, getGiveawayService } from '../features/giveaways/router.js';

export const data = new SlashCommandBuilder()
  .setName('gend')
  .setDescription('Force a giveaway to enter the reveal window now')
  .addStringOption((option) =>
    option.setName('giveaway_id').setDescription('Giveaway ID (optional if one is active here)')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const service = getGiveawayService();
  const scheduler = getGiveawayScheduler();

  const giveawayId = interaction.options.getString('giveaway_id');
  const targetId =
    giveawayId ??
    (interaction.channelId ? service.getActiveGiveaway(interaction.channelId)?.id ?? null : null);

  if (!targetId) {
    await interaction.reply({ content: 'Giveaway not found.', ephemeral: true });
    return;
  }

  const status = await service.getStatus(targetId);
  if (!status) {
    await interaction.reply({ content: 'Giveaway not found.', ephemeral: true });
    return;
  }

  if (
    interaction.user.id !== status.giveaway.hostId &&
    !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
  ) {
    await interaction.reply({ content: 'You do not have permission to end this giveaway.', ephemeral: true });
    return;
  }

  const success = await service.forceReveal(targetId, interaction.user.id);
  if (!success) {
    await interaction.reply({ content: 'Unable to force reveal. Is the giveaway still active?', ephemeral: true });
    return;
  }

  await scheduler.refreshGiveaway(targetId);
  await interaction.reply({ content: 'Reveal window started. Spinning soon!', ephemeral: true });
}
