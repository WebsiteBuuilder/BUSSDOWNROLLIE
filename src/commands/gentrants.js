import { SlashCommandBuilder } from 'discord.js';
import { getGiveawayService } from '../giveaway/router.js';

export const data = new SlashCommandBuilder()
  .setName('gentrants')
  .setDescription('👥 View participants in the active giveaway');

export async function execute(interaction) {
  const service = getGiveawayService();

  // Find active giveaway in this channel
  const giveaway = service.getActiveInChannel(interaction.channelId);

  if (!giveaway) {
    await interaction.reply({
      content: '❌ No active giveaway found in this channel.',
      ephemeral: true,
    });
    return;
  }

  const reply = await service.getEntrants(giveaway.id);
  await interaction.reply(reply);
}

