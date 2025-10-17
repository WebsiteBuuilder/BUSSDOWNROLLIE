import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import prisma from '../db/index.js';
import { formatVP, formatTimestamp, buildMessageLink, memberHasProviderRole } from '../lib/utils.js';
import { logTransaction } from '../lib/logger.js';

const MAX_VOUCHES_PER_VIEW = 10;

function buildPendingVouchResponse(vouches, total) {
  if (!vouches.length) {
    return {
      content: '🎉 All caught up! There are no pending vouches.',
      embeds: [],
      components: [],
    };
  }

  const embed = {
    title: 'Pending Vouches',
    color: 0xffc107,
    description:
      total > vouches.length
        ? `Showing the oldest ${vouches.length} of ${total} pending vouches.`
        : 'All pending vouches are listed below.',
    fields: vouches.map((vouch) => {
      const messageLink = buildMessageLink(vouch.guildId, vouch.channelId, vouch.messageId);
      const details = [
        `User: <@${vouch.user.discordId}>`,
        `Submitted: ${formatTimestamp(vouch.createdAt, 'R')}`,
      ];

      if (messageLink) {
        details.push(`[View Message](${messageLink})`);
      } else {
        details.push(`Message ID: \`${vouch.messageId}\``);
      }

      if (vouch.imageUrl) {
        details.push(`[Image Preview](${vouch.imageUrl})`);
      }

      return {
        name: `#${vouch.id}`,
        value: details.join('\n'),
      };
    }),
    footer: { text: 'Use the buttons below to approve vouches.' },
    timestamp: new Date().toISOString(),
  };

  const buttons = vouches.map((vouch) =>
    new ButtonBuilder()
      .setCustomId(`approvevouch:${vouch.id}`)
      .setLabel(`Approve #${vouch.id}`)
      .setStyle(ButtonStyle.Success)
  );

  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }

  return {
    content: 'Select a pending vouch to approve:',
    embeds: [embed],
    components: rows,
  };
}

async function fetchPendingVouches(limit = MAX_VOUCHES_PER_VIEW) {
  const [vouches, total] = await Promise.all([
    prisma.vouch.findMany({
      where: { status: 'pending' },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
    }),
    prisma.vouch.count({ where: { status: 'pending' } }),
  ]);

  return { vouches, total };
}

async function refreshPendingVouchMessage(interaction) {
  try {
    const { vouches, total } = await fetchPendingVouches();
    const response = buildPendingVouchResponse(vouches, total);
    await interaction.message.edit(response);
  } catch (error) {
    console.error('Failed to refresh pending vouch list:', error);
  }
}

export const data = new SlashCommandBuilder()
  .setName('approvevouch')
  .setDescription('Review and approve pending vouches (Provider only)');

export async function execute(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!memberHasProviderRole(member)) {
    return interaction.reply({
      content: '❌ Only providers can approve vouches.',
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const { vouches, total } = await fetchPendingVouches();
    const response = buildPendingVouchResponse(vouches, total);
    await interaction.editReply(response);
  } catch (error) {
    console.error('Error fetching pending vouches:', error);
    await interaction.editReply({
      content: '❌ Failed to load pending vouches. Please try again later.',
      components: [],
      embeds: [],
    });
  }
}

export async function handleApproveVouchButton(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!memberHasProviderRole(member)) {
    return interaction.reply({
      content: '❌ Only providers can approve vouches.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const [, idPart] = interaction.customId.split(':');
  const vouchId = Number.parseInt(idPart, 10);

  if (!Number.isInteger(vouchId)) {
    return interaction.reply({
      content: '❌ Invalid vouch identifier.',
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const vouch = await prisma.vouch.findUnique({
      where: { id: vouchId },
      include: { user: true },
    });

    if (!vouch || vouch.status !== 'pending') {
      await interaction.editReply({
        content: '❌ This vouch could not be approved. It may have already been processed.',
      });
      await refreshPendingVouchMessage(interaction);
      return;
    }

    if (vouch.user.blacklisted) {
      await interaction.editReply({
        content: '❌ This user is blacklisted and cannot earn VP.',
      });
      await refreshPendingVouchMessage(interaction);
      return;
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const incrementedUser = await tx.user.update({
        where: { id: vouch.userId },
        data: { vp: { increment: 1 } },
      });

      await tx.vouch.update({
        where: { id: vouch.id },
        data: {
          status: 'approved',
          approvedByProviderId: interaction.user.id,
        },
      });

      return incrementedUser;
    });

    if (vouch.channelId) {
      try {
        const channel = await interaction.client.channels.fetch(vouch.channelId);
        if (channel?.isTextBased()) {
          const message = await channel.messages.fetch(vouch.messageId);
          await message.react('✅');
        }
      } catch (error) {
        console.warn('Could not react to approved vouch message:', error.message);
      }
    }

    const messageLink = buildMessageLink(vouch.guildId, vouch.channelId, vouch.messageId);

    await interaction.editReply({
      content: `✅ Vouch #${vouch.id} approved! <@${vouch.user.discordId}> has been credited +1 VP. New balance: ${formatVP(updatedUser.vp)}`,
    });

    await logTransaction('vouch', {
      userId: vouch.user.discordId,
      amount: 1,
      status: 'approved',
      messageLink,
    });

    await refreshPendingVouchMessage(interaction);
  } catch (error) {
    console.error('Error approving vouch from button interaction:', error);
    await interaction.editReply({
      content: '❌ Failed to approve vouch. Please try again.',
    });
  }
}
