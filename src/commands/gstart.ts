import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import {
  getGiveawayScheduler,
  getGiveawayService,
} from '../features/giveaways/router.ts';
import { parseDuration } from '../features/giveaways/utils.ts';
import { buildStatusEmbed } from '../features/giveaways/ui.ts';

export const data = new SlashCommandBuilder()
  .setName('gstart')
  .setDescription('Start a Vouch Point buy-in giveaway')
  .addStringOption((option) =>
    option.setName('title').setDescription('Giveaway title').setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('duration')
      .setDescription('Duration (e.g. 10m, 1h30m)')
      .setRequired(true)
  )
  .addIntegerOption((option) =>
    option
      .setName('buyin_cost')
      .setDescription('Vouch Points required to enter')
      .setRequired(true)
      .setMinValue(1)
  )
  .addIntegerOption((option) =>
    option
      .setName('max_entries_per_user')
      .setDescription('Maximum entries each user can purchase')
      .setMinValue(1)
  )
  .addIntegerOption((option) =>
    option
      .setName('reveal_window_seconds')
      .setDescription('Reveal window duration in seconds (30-300)')
      .setMinValue(30)
      .setMaxValue(300)
  )
  .addIntegerOption((option) =>
    option
      .setName('payout_ratio_percent')
      .setDescription('Percent of pot paid to winner (1-100)')
      .setMinValue(1)
      .setMaxValue(100)
  )
  .addStringOption((option) =>
    option
      .setName('description')
      .setDescription('Optional giveaway description / rules')
      .setMaxLength(1024)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  const service = getGiveawayService();
  const scheduler = getGiveawayScheduler();
  const config = service.getConfig();

  const title = interaction.options.getString('title', true);
  const durationInput = interaction.options.getString('duration', true);
  const durationMs = parseDuration(durationInput);

  if (!durationMs) {
    await interaction.reply({
      content: 'Invalid duration format. Use combinations like 10m, 1h30m, or 2h.',
      ephemeral: true,
    });
    return;
  }

  if (durationMs < 120_000) {
    await interaction.reply({
      content: 'Duration must be at least 2 minutes.',
      ephemeral: true,
    });
    return;
  }

  const buyInCost = interaction.options.getInteger('buyin_cost', true);
  if (buyInCost <= 0) {
    await interaction.reply({ content: 'Buy-in cost must be greater than 0.', ephemeral: true });
    return;
  }

  const maxEntries = interaction.options.getInteger('max_entries_per_user') ?? config.maxEntriesPerUser;
  const revealWindowSeconds =
    interaction.options.getInteger('reveal_window_seconds') ?? config.revealWindowSeconds;
  const payoutRatio = interaction.options.getInteger('payout_ratio_percent') ?? config.payoutRatio;
  const description = interaction.options.getString('description');

  if (revealWindowSeconds < 30 || revealWindowSeconds > 300) {
    await interaction.reply({
      content: 'Reveal window must be between 30 and 300 seconds.',
      ephemeral: true,
    });
    return;
  }

  if (revealWindowSeconds * 1000 >= durationMs) {
    await interaction.reply({
      content: 'Reveal window must be shorter than the total duration.',
      ephemeral: true,
    });
    return;
  }

  if (interaction.channel?.isTextBased() !== true || !interaction.guildId) {
    await interaction.reply({ content: 'Giveaways must be started in a guild channel.', ephemeral: true });
    return;
  }

  if (service.hasActiveGiveawayInChannel(interaction.channelId)) {
    await interaction.reply({
      content: 'There is already an active giveaway in this channel.',
      ephemeral: true,
    });
    return;
  }

  const giveaway = await service.startGiveaway({
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    hostId: interaction.user.id,
    title,
    description,
    buyInCost,
    maxEntriesPerUser: maxEntries,
    revealWindowSeconds,
    payoutRatio,
    durationMs,
  });

  scheduler.scheduleNewGiveaway(giveaway);

  const status = await service.getStatus(giveaway.id);
  const embed = status ? buildStatusEmbed(status.giveaway, status.stats) : undefined;
  const messageLink = `https://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}/${giveaway.messageId}`;

  await interaction.reply({
    content: `Giveaway created! [Jump to message](${messageLink})`,
    embeds: embed ? [embed] : undefined,
    ephemeral: true,
  });
}
