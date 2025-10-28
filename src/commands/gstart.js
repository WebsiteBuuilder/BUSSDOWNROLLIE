import { SlashCommandBuilder } from 'discord.js';
import { getGiveawayService, getGiveawayScheduler } from '../giveaway/router.js';

/**
 * Parse duration string like "30m", "1h30m", "2h"
 */
function parseDuration(str) {
  const hourMatch = str.match(/(\d+)h/);
  const minMatch = str.match(/(\d+)m/);
  
  const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
  const minutes = minMatch ? parseInt(minMatch[1]) : 0;
  
  return (hours * 60 + minutes) * 60 * 1000;
}

export const data = new SlashCommandBuilder()
  .setName('gstart')
  .setDescription('🎟️ Start a community giveaway (costs 1+ VP to create)')
  .addStringOption((option) =>
    option
      .setName('title')
      .setDescription('Giveaway title')
      .setRequired(true)
      .setMaxLength(100)
  )
  .addStringOption((option) =>
    option
      .setName('duration')
      .setDescription('Duration (e.g., 30m, 1h30m, 2h)')
      .setRequired(true)
  )
  .addIntegerOption((option) =>
    option
      .setName('buyin_cost')
      .setDescription('VP required to enter')
      .setRequired(true)
      .setMinValue(1)
  )
  .addIntegerOption((option) =>
    option
      .setName('host_cut')
      .setDescription('Percentage of pot you keep as host (0-50%)')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(50)
  )
  .addIntegerOption((option) =>
    option
      .setName('max_entries')
      .setDescription('Maximum entries per user')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100)
  )
  .addStringOption((option) =>
    option
      .setName('description')
      .setDescription('Optional description')
      .setMaxLength(500)
  );

export async function execute(interaction) {
  const service = getGiveawayService();
  const scheduler = getGiveawayScheduler();

  const title = interaction.options.getString('title', true);
  const durationStr = interaction.options.getString('duration', true);
  const buyInCost = interaction.options.getInteger('buyin_cost', true);
  const hostCut = interaction.options.getInteger('host_cut', true);
  const maxEntriesPerUser = interaction.options.getInteger('max_entries', true);
  const description = interaction.options.getString('description');

  // Parse duration
  const durationMs = parseDuration(durationStr);
  if (!durationMs || durationMs < 120_000) {
    await interaction.reply({
      content: '❌ Invalid duration. Minimum is 2 minutes (2m).',
      ephemeral: true,
    });
    return;
  }

  if (durationMs > 24 * 60 * 60 * 1000) {
    await interaction.reply({
      content: '❌ Duration cannot exceed 24 hours.',
      ephemeral: true,
    });
    return;
  }

  // Check if there's already an active giveaway in this channel
  if (service.hasActiveInChannel(interaction.channelId)) {
    await interaction.reply({
      content: '❌ There is already an active giveaway in this channel.',
      ephemeral: true,
    });
    return;
  }

  try {
    await interaction.deferReply({ ephemeral: true });

    const giveaway = await service.createGiveaway({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      hostId: interaction.user.id,
      title,
      description,
      buyInCost,
      hostCut,
      maxEntriesPerUser,
      durationMs,
    });

    // Schedule the end
    scheduler.scheduleNew(giveaway.id, giveaway.endAt);

    const messageLink = giveaway.messageId
      ? `https://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}/${giveaway.messageId}`
      : null;

    await interaction.editReply({
      content:
        `✅ **Giveaway created!**\n\n` +
        `🎟️ Title: **${title}**\n` +
        `💰 Entry cost: **${buyInCost} VP**\n` +
        `🏦 Your cut: **${hostCut}%**\n` +
        `⏰ Duration: **${durationStr}**\n\n` +
        (messageLink ? `[Jump to giveaway](${messageLink})` : 'Check the channel above!'),
    });
  } catch (error) {
    console.error('Error creating giveaway:', error);
    
    const errorMessage = error.message || 'Failed to create giveaway';
    
    if (interaction.deferred) {
      await interaction.editReply({
        content: `❌ ${errorMessage}`,
      });
    } else {
      await interaction.reply({
        content: `❌ ${errorMessage}`,
        ephemeral: true,
      });
    }
  }
}

