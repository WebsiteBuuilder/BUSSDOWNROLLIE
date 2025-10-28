import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getLeaderboard } from '../db/index.js';
import { formatVP, getMedalEmoji, getProviderRoleIds } from '../lib/utils.js';

// Cache for leaderboard (60 second TTL)
const cache = {
  data: null,
  timestamp: 0,
  ttl: 60000,
};

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('View top VP holders')
  .addIntegerOption((option) =>
    option.setName('page').setDescription('Page number to view').setRequired(false).setMinValue(1)
  );

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const page = interaction.options.getInteger('page') || 1;
    const now = Date.now();

    // Check cache
    let leaderboardData;
    if (cache.data && cache.data.page === page && now - cache.timestamp < cache.ttl) {
      leaderboardData = cache.data;
    } else {
      leaderboardData = await getLeaderboard(page, 10);
      cache.data = leaderboardData;
      cache.timestamp = now;
    }

    if (leaderboardData.users.length === 0) {
      return interaction.editReply({
        content: '📊 No users found on this page.',
      });
    }

    // Build leaderboard display (filter out providers)
    const providerRoleIds = getProviderRoleIds();
    const guild = interaction.guild;
    
    const startRank = (page - 1) * 10;
    let description = '';
    let displayedCount = 0;

    for (let i = 0; i < leaderboardData.users.length; i++) {
      const user = leaderboardData.users[i];
      
      // Filter out providers
      if (guild && providerRoleIds.length > 0) {
        try {
          const member = await guild.members.fetch(user.discordId);
          const isProvider = providerRoleIds.some(roleId => member.roles.cache.has(roleId));
          if (isProvider) {
            continue; // Skip providers
          }
        } catch {
          // User not in guild or error, skip role check
        }
      }
      
      const rank = startRank + displayedCount + 1;
      const medal = getMedalEmoji(rank);

      try {
        const discordUser = await interaction.client.users.fetch(user.discordId);
        description += `${medal} **${rank}.** ${discordUser.username} — ${formatVP(user.vp)}\n`;
      } catch {
        description += `${medal} **${rank}.** Unknown User — ${formatVP(user.vp)}\n`;
      }
      
      displayedCount++;
    }

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle('🏆 VP Leaderboard')
      .setDescription(description)
      .setFooter({
        text: `Page ${page}/${leaderboardData.totalPages} • ${leaderboardData.totalUsers} total users`,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in leaderboard command:', error);
    await interaction.editReply({
      content: '❌ Failed to load leaderboard. Please try again.',
    });
  }
}
