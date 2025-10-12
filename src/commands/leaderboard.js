import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getLeaderboard } from '../db/index.js';
import { formatVP, getMedalEmoji } from '../lib/utils.js';

// Cache for leaderboard (60 second TTL)
const cache = {
  data: null,
  timestamp: 0,
  ttl: 60000
};

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('View top VP holders')
  .addIntegerOption(option =>
    option
      .setName('page')
      .setDescription('Page number to view')
      .setRequired(false)
      .setMinValue(1)
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const page = interaction.options.getInteger('page') || 1;
    const now = Date.now();

    // Check cache
    let leaderboardData;
    if (cache.data && cache.data.page === page && (now - cache.timestamp) < cache.ttl) {
      leaderboardData = cache.data;
    } else {
      leaderboardData = await getLeaderboard(page, 10);
      cache.data = leaderboardData;
      cache.timestamp = now;
    }

    if (leaderboardData.users.length === 0) {
      return interaction.editReply({
        content: '📊 No users found on this page.'
      });
    }

    // Build leaderboard display
    const startRank = (page - 1) * 10;
    let description = '';

    for (let i = 0; i < leaderboardData.users.length; i++) {
      const user = leaderboardData.users[i];
      const rank = startRank + i + 1;
      const medal = getMedalEmoji(rank);
      
      try {
        const discordUser = await interaction.client.users.fetch(user.discordId);
        description += `${medal} **${rank}.** ${discordUser.username} — ${formatVP(user.vp)}\n`;
      } catch (error) {
        description += `${medal} **${rank}.** Unknown User — ${formatVP(user.vp)}\n`;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🏆 VP Leaderboard')
      .setDescription(description)
      .setFooter({ 
        text: `Page ${page}/${leaderboardData.totalPages} • ${leaderboardData.totalUsers} total users` 
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error in leaderboard command:', error);
    await interaction.editReply({
      content: '❌ Failed to load leaderboard. Please try again.'
    });
  }
}

