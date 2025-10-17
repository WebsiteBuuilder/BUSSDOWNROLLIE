import { SlashCommandBuilder } from 'discord.js';
import prisma from '../db/index.js';
import { parseMessageLink, formatVP } from '../lib/utils.js';
import { logTransaction } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('approvevouch')
  .setDescription('Manually approve a vouch (Provider only)')
  .addStringOption((option) =>
    option.setName('message_link').setDescription('Link to the vouch message').setRequired(true)
  );

export async function execute(interaction) {
  // Check if user has provider role
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!member.roles.cache.has(process.env.PROVIDER_ROLE_ID)) {
    return interaction.reply({
      content: '❌ Only providers can approve vouches.',
      ephemeral: true,
    });
  }

  const messageLink = interaction.options.getString('message_link');

  try {
    await interaction.deferReply();

    // Parse message link
    const parsed = parseMessageLink(messageLink);
    if (!parsed) {
      return interaction.editReply({
        content: '❌ Invalid message link. Please provide a valid Discord message link.',
      });
    }

    // Fetch message
    const channel = await interaction.client.channels.fetch(parsed.channelId);
    const message = await channel.messages.fetch(parsed.messageId);

    if (!message) {
      return interaction.editReply({
        content: '❌ Could not find message. Please check the link.',
      });
    }

    // Check if vouch exists
    const vouch = await prisma.vouch.findUnique({
      where: { messageId: message.id },
      include: { user: true },
    });

    if (!vouch) {
      return interaction.editReply({
        content: '❌ This message is not a registered vouch.',
      });
    }

    if (vouch.status === 'approved' || vouch.status === 'auto') {
      return interaction.editReply({
        content: '❌ This vouch has already been approved.',
      });
    }

    if (vouch.status === 'rejected') {
      return interaction.editReply({
        content: '❌ This vouch has been rejected and cannot be approved.',
      });
    }

    // Check if user is blacklisted
    if (vouch.user.blacklisted) {
      return interaction.editReply({
        content: '❌ This user is blacklisted and cannot earn VP.',
      });
    }

    // Approve vouch and credit VP
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
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
    });

    const updatedUser = await prisma.user.findUnique({
      where: { id: vouch.userId },
    });

    // React to message
    try {
      await message.react('✅');
    } catch (error) {
      console.log('Could not react to message:', error.message);
    }

    await interaction.editReply({
      content: `✅ Vouch approved! <@${vouch.user.discordId}> has been credited +1 VP. New balance: ${formatVP(updatedUser.vp)}`,
    });

    // Log transaction
    await logTransaction('vouch', {
      userId: vouch.user.discordId,
      amount: 1,
      status: 'approved',
      messageLink,
    });
  } catch (error) {
    console.error('Error in approvevouch command:', error);
    await interaction.editReply({
      content: '❌ Failed to approve vouch. Please try again.',
    });
  }
}
