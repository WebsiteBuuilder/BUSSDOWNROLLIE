import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Auto-detect and display server configuration')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;

    // Find roles by common names
    const providerRole = guild.roles.cache.find(
      (role) =>
        role.name.toLowerCase().includes('provider') || role.name.toLowerCase().includes('staff')
    );

    const adminRole = guild.roles.cache.find(
      (role) =>
        role.name.toLowerCase().includes('admin') ||
        role.permissions.has(PermissionFlagsBits.Administrator)
    );

    // Find channels by common names
    const vouchChannel = guild.channels.cache.find(
      (channel) =>
        channel.name.toLowerCase().includes('vouch') || channel.name.toLowerCase().includes('order')
    );

    const casinoChannel = guild.channels.cache.find(
      (channel) =>
        channel.name.toLowerCase().includes('casino') ||
        channel.name.toLowerCase().includes('game') ||
        channel.name.toLowerCase().includes('blackjack')
    );

    const logChannel = guild.channels.cache.find(
      (channel) =>
        channel.name.toLowerCase().includes('log') || channel.name.toLowerCase().includes('audit')
    );

    // Build setup guide embed
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('🔧 Bot Setup Configuration')
      .setDescription(
        'Here are the detected/recommended IDs for your Railway environment variables:'
      )
      .addFields({
        name: '🏠 Server Information',
        value: `**Guild ID:**\n\`${guild.id}\`\n\n**Copy this to Railway as:**\n\`GUILD_ID=${guild.id}\``,
        inline: false,
      });

    // Provider Role
    if (providerRole) {
      embed.addFields({
        name: '👔 Provider Role (Detected)',
        value: `**Role:** ${providerRole.name}\n**ID:** \`${providerRole.id}\`\n\n**Copy this to Railway as:**\n\`PROVIDER_ROLE_ID=${providerRole.id}\``,
        inline: false,
      });
    } else {
      embed.addFields({
        name: '⚠️ Provider Role (Not Found)',
        value:
          'Create a role named "Provider" or "Staff", then run `/setup` again.\n\n**Or manually add to Railway:**\n`PROVIDER_ROLE_ID=your_role_id_here`',
        inline: false,
      });
    }

    // Admin Role
    if (adminRole) {
      embed.addFields({
        name: '🛡️ Admin Role (Detected)',
        value: `**Role:** ${adminRole.name}\n**ID:** \`${adminRole.id}\`\n\n**Copy this to Railway as:**\n\`ADMIN_ROLE_ID=${adminRole.id}\``,
        inline: false,
      });
    } else {
      embed.addFields({
        name: '⚠️ Admin Role (Not Found)',
        value:
          'Create a role with Administrator permissions, then run `/setup` again.\n\n**Or manually add to Railway:**\n`ADMIN_ROLE_ID=your_role_id_here`',
        inline: false,
      });
    }

    // Vouch Channel
    if (vouchChannel) {
      embed.addFields({
        name: '📸 Vouch Channel (Detected)',
        value: `**Channel:** ${vouchChannel.name}\n**ID:** \`${vouchChannel.id}\`\n\n**Copy this to Railway as:**\n\`VOUCH_CHANNEL_ID=${vouchChannel.id}\``,
        inline: false,
      });
    } else {
      embed.addFields({
        name: '⚠️ Vouch Channel (Not Found)',
        value:
          'Create a channel named "vouch" or "orders", then run `/setup` again.\n\n**Or manually add to Railway:**\n`VOUCH_CHANNEL_ID=your_channel_id_here`',
        inline: false,
      });
    }

    // Casino Channel
    if (casinoChannel) {
      embed.addFields({
        name: '🎰 Casino Channel (Detected)',
        value: `**Channel:** ${casinoChannel.name}\n**ID:** \`${casinoChannel.id}\`\n\n**Copy this to Railway as:**\n\`CASINO_CHANNEL_ID=${casinoChannel.id}\``,
        inline: false,
      });
    } else {
      embed.addFields({
        name: '⚠️ Casino Channel (Not Found)',
        value:
          'Create a channel named "casino" or "games", then run `/setup` again.\n\n**Or manually add to Railway:**\n`CASINO_CHANNEL_ID=your_channel_id_here`',
        inline: false,
      });
    }

    // Log Channel
    if (logChannel) {
      embed.addFields({
        name: '📋 Log Channel (Detected)',
        value: `**Channel:** ${logChannel.name}\n**ID:** \`${logChannel.id}\`\n\n**Copy this to Railway as:**\n\`LOG_CHANNEL_ID=${logChannel.id}\``,
        inline: false,
      });
    } else {
      embed.addFields({
        name: '⚠️ Log Channel (Not Found)',
        value:
          'Create a channel named "logs" or "audit", then run `/setup` again.\n\n**Or manually add to Railway:**\n`LOG_CHANNEL_ID=your_channel_id_here`',
        inline: false,
      });
    }

    // Additional required variables
    embed.addFields({
      name: '💾 Database Configuration',
      value: '**Add this to Railway:**\n`DATABASE_URL=file:/data/guhdeats.db`',
      inline: false,
    });

    embed.addFields({
      name: '✅ Complete Railway Environment Variables',
      value:
        '```\n' +
        `DISCORD_TOKEN=your_bot_token\n` +
        `GUILD_ID=${guild.id}\n` +
        `PROVIDER_ROLE_ID=${providerRole?.id || 'your_provider_role_id'}\n` +
        `ADMIN_ROLE_ID=${adminRole?.id || 'your_admin_role_id'}\n` +
        `VOUCH_CHANNEL_ID=${vouchChannel?.id || 'your_vouch_channel_id'}\n` +
        `CASINO_CHANNEL_ID=${casinoChannel?.id || 'your_casino_channel_id'}\n` +
        `LOG_CHANNEL_ID=${logChannel?.id || 'your_log_channel_id'}\n` +
        `DATABASE_URL=file:/data/guhdeats.db\n` +
        `DAILY_RNG_CHANCE=0.35\n` +
        `TRANSFER_FEE_PERCENT=5\n` +
        `BATTLE_RAKE_PERCENT=2\n` +
        `BJ_MIN=1\n` +
        `BJ_MAX=50\n` +
        `FIVE_COST=25\n` +
        `FREE_COST=60\n` +
        `REQUIRE_PROVIDER_APPROVAL=true\n` +
        '```',
      inline: false,
    });

    embed.setFooter({ text: 'Copy these values to Railway → Your Service → Variables' });
    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in setup command:', error);
    await interaction.editReply({
      content: '❌ Failed to generate setup configuration. Please try again.',
    });
  }
}
