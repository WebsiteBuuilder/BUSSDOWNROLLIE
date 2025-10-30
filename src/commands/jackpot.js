import { SlashCommandBuilder } from 'discord.js';
import {
  getGiveawayService,
  getGiveawayScheduler,
  ensureGiveawayRuntimeAvailable,
} from '../giveaway/runtime.js';
import { getJackpotTotal } from '../giveaway/db.js';
import { buildJackpotEmbed } from '../giveaway/ui.js';

export const data = new SlashCommandBuilder()
  .setName('jackpot')
  .setDescription('💎 Community jackpot giveaway')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('start')
      .setDescription('Start a jackpot giveaway with the global pot')
      .addStringOption((option) =>
        option
          .setName('name')
          .setDescription('Optional custom name for the jackpot')
          .setMaxLength(50)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('view')
      .setDescription('View current jackpot amount')
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'view') {
    const totalVP = getJackpotTotal();
    const embed = buildJackpotEmbed(totalVP);
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (subcommand === 'start') {
    const available = await ensureGiveawayRuntimeAvailable(interaction);
    if (!available) {
      return;
    }

    const service = getGiveawayService();
    const scheduler = getGiveawayScheduler();

    // Check if there's already an active giveaway in this channel
    if (service.hasActiveInChannel(interaction.channelId)) {
      await interaction.reply({
        content: '❌ There is already an active giveaway in this channel.',
        ephemeral: true,
      });
      return;
    }

    const customName = interaction.options.getString('name');
    const title = customName || '💎 COMMUNITY JACKPOT';

    await interaction.deferReply({ ephemeral: true });

    try {
      const giveaway = await service.createGiveaway({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        hostId: interaction.user.id,
        title,
        description:
          'The global jackpot grows from all VP spent in giveaways!\n' +
          'Winner takes the entire pot!',
        buyInCost: 1,
        hostCut: 0,
        maxEntriesPerUser: 10,
        durationMs: 5 * 60 * 1000, // 5 minutes
        type: 'jackpot',
      });

      // Schedule the end
      scheduler.scheduleNew(giveaway.id, giveaway.endAt);

      const messageLink = giveaway.messageId
        ? `https://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}/${giveaway.messageId}`
        : null;

      const jackpotAmount = getJackpotTotal();

      await interaction.editReply({
        content:
          `🎉 **JACKPOT STARTED!**\n\n` +
          `💎 Current pot: **${jackpotAmount} VP**\n` +
          `🎫 Entry cost: **1 VP**\n` +
          `⏰ Duration: **5 minutes**\n\n` +
          (messageLink ? `[Jump to jackpot](${messageLink})` : 'Check the channel above!'),
      });
    } catch (error) {
      console.error('Error creating jackpot:', error);
      await interaction.editReply({
        content: `❌ ${error.message || 'Failed to create jackpot'}`,
      });
    }
  }
}

