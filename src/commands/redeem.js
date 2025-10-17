import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import prisma, { getOrCreateUser, getConfig } from '../db/index.js';
import { formatVP, getProviderRoleIds, memberHasProviderRole } from '../lib/utils.js';
import { logTransaction } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('redeem')
  .setDescription('Redeem VP for rewards')
  .addSubcommand((subcommand) =>
    subcommand.setName('five').setDescription('Redeem for $5 order (costs 25 VP)')
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('free').setDescription('Redeem for free $20 order (costs 60 VP)')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('fulfill')
      .setDescription('Mark a redemption as fulfilled (Provider only)')
      .addIntegerOption((option) =>
        option
          .setName('redemption_id')
          .setDescription('The redemption ID to fulfill')
          .setRequired(true)
      )
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'fulfill') {
    return handleFulfill(interaction);
  }

  // Handle redemptions
  const type = subcommand === 'five' ? '5USD' : 'FREE_ORDER';

  try {
    await interaction.deferReply({ ephemeral: true });

    const user = await getOrCreateUser(interaction.user.id);

    // Check if user is blacklisted
    if (user.blacklisted) {
      return interaction.editReply({
        content: '❌ You are blacklisted and cannot redeem VP.',
      });
    }

    // Get cost from config
    const costKey = subcommand === 'five' ? 'five_cost' : 'free_cost';
    const costStr = await getConfig(costKey, subcommand === 'five' ? '25' : '60');
    const cost = parseInt(costStr);

    // Check balance
    if (user.vp < cost) {
      return interaction.editReply({
        content: `❌ Insufficient balance. This redemption costs ${formatVP(cost)}, but you only have ${formatVP(user.vp)}.`,
      });
    }

    // Create private ticket channel
    const providerRoleIds = getProviderRoleIds();
    const providerPermissionOverwrites = providerRoleIds.map((roleId) => ({
      id: roleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
    }));

    const ticketChannel = await interaction.guild.channels.create({
      name: `redemption-${interaction.user.username}-${Date.now()}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
        ...providerPermissionOverwrites,
        {
          id: interaction.client.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
      ],
    });

    // Deduct VP and create redemption record
    const redemption = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { vp: { decrement: cost } },
      });

      return await tx.redemption.create({
        data: {
          userId: user.id,
          type,
          cost,
          ticketChannelId: ticketChannel.id,
          status: 'opened',
        },
      });
    });

    // Send initial message in ticket
    const rewardText = type === '5USD' ? '$5 Order' : 'Free $20 Order';
    const ticketEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('🎟️ Redemption Ticket')
      .setDescription(`**${interaction.user.username}** has redeemed **${rewardText}**!`)
      .addFields(
        { name: 'Redemption ID', value: `#${redemption.id}`, inline: true },
        { name: 'Cost', value: formatVP(cost), inline: true },
        { name: 'Remaining Balance', value: formatVP(user.vp - cost), inline: true },
        { name: 'Status', value: '⏳ Pending', inline: false }
      )
      .setFooter({ text: 'A provider will assist you shortly!' })
      .setTimestamp();

    const providerMentions = providerRoleIds.map((roleId) => `<@&${roleId}>`).join(' ');

    await ticketChannel.send({
      content: providerMentions
        ? `<@${interaction.user.id}> ${providerMentions}`
        : `<@${interaction.user.id}>`,
      embeds: [ticketEmbed],
    });

    await ticketChannel.send({
      content: `**Instructions for Provider:**\nOnce fulfilled, use \`/redeem fulfill ${redemption.id}\` to mark this redemption as complete.`,
    });

    // Confirm to user
    await interaction.editReply({
      content: `✅ Redemption successful! Your ticket has been created: <#${ticketChannel.id}>\n\nA provider will assist you shortly.`,
    });

    // DM user
    try {
      await interaction.user.send({
        embeds: [
          {
            color: 0x00ff00,
            title: '✅ Redemption Created',
            description: `Your ${rewardText} redemption ticket has been opened!`,
            fields: [
              { name: 'Redemption ID', value: `#${redemption.id}`, inline: true },
              { name: 'Ticket Channel', value: `<#${ticketChannel.id}>`, inline: true },
              { name: 'New Balance', value: formatVP(user.vp - cost), inline: true },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch (error) {
      console.log('Could not DM user:', error.message);
    }

    // Log transaction
    await logTransaction('redemption', {
      userId: interaction.user.id,
      type: rewardText,
      cost,
      status: 'opened',
    });
  } catch (error) {
    console.error('Error in redeem command:', error);
    await interaction.editReply({
      content: '❌ Failed to process redemption. Please try again.',
    });
  }
}

async function handleFulfill(interaction) {
  // Check if user has provider role
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!memberHasProviderRole(member)) {
    return interaction.reply({
      content: '❌ Only providers can fulfill redemptions.',
      ephemeral: true,
    });
  }

  const redemptionId = interaction.options.getInteger('redemption_id');

  try {
    await interaction.deferReply();

    // Get redemption
    const redemption = await prisma.redemption.findUnique({
      where: { id: redemptionId },
      include: { user: true },
    });

    if (!redemption) {
      return interaction.editReply({
        content: `❌ Redemption #${redemptionId} not found.`,
      });
    }

    if (redemption.status === 'fulfilled') {
      return interaction.editReply({
        content: `❌ Redemption #${redemptionId} has already been fulfilled.`,
      });
    }

    if (redemption.status === 'canceled') {
      return interaction.editReply({
        content: `❌ Redemption #${redemptionId} was canceled.`,
      });
    }

    // Update status
    await prisma.redemption.update({
      where: { id: redemptionId },
      data: { status: 'fulfilled' },
    });

    // Update ticket channel
    if (redemption.ticketChannelId) {
      try {
        const ticketChannel = await interaction.guild.channels.fetch(redemption.ticketChannelId);

        const fulfillEmbed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('✅ Redemption Fulfilled')
          .setDescription(
            `This redemption has been marked as fulfilled by <@${interaction.user.id}>.`
          )
          .setTimestamp();

        await ticketChannel.send({ embeds: [fulfillEmbed] });
      } catch (error) {
        console.log('Could not update ticket channel:', error.message);
      }
    }

    // DM user
    try {
      const discordUser = await interaction.client.users.fetch(redemption.user.discordId);
      await discordUser.send({
        embeds: [
          {
            color: 0x00ff00,
            title: '✅ Redemption Fulfilled',
            description: `Your redemption #${redemptionId} has been fulfilled!`,
            fields: [{ name: 'Fulfilled By', value: `${interaction.user.username}`, inline: true }],
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch (error) {
      console.log('Could not DM user:', error.message);
    }

    await interaction.editReply({
      content: `✅ Successfully marked redemption #${redemptionId} as fulfilled.`,
    });

    // Log transaction
    await logTransaction('redemption', {
      userId: redemption.user.discordId,
      type: redemption.type,
      cost: redemption.cost,
      status: 'fulfilled',
    });
  } catch (error) {
    console.error('Error in fulfill command:', error);
    await interaction.editReply({
      content: '❌ Failed to fulfill redemption. Please try again.',
    });
  }
}
