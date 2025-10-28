import { SlashCommandBuilder } from 'discord.js';
import { getGiveawayService } from '../giveaway/router.js';

export const data = new SlashCommandBuilder()
  .setName('gjoin')
  .setDescription('🎟️ Join an active giveaway (or use the button!)');

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

  // Join the giveaway
  const result = await service.joinGiveaway(giveaway.id, interaction.user.id);
  await interaction.reply(result.message);
}

