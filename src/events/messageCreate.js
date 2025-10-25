import { hasImageAttachment, getFirstImageUrl, getProviderRoleIds, formatVP } from '../lib/utils.js';
import prisma, { getOrCreateUser } from '../db/index.js';
import { logTransaction } from '../lib/logger.js';

export const name = 'messageCreate';
export const once = false;

export async function execute(message) {
  // Ignore bots
  if (message.author.bot) return;

  // Check if message is in the configured vouch channel (fallback to channel name)
  const vouchChannelId = process.env.VOUCH_CHANNEL_ID;
  const isVouchChannel = vouchChannelId
    ? message.channel.id === vouchChannelId
    : message.channel.name?.toLowerCase().includes('vouch');

  if (!isVouchChannel) return;

  // Validate message has image attachment
  if (!hasImageAttachment(message)) {
    return;
  }

  try {
    // Get or create user
    const user = await getOrCreateUser(message.author.id);

    // Check if user is blacklisted
    if (user.blacklisted) {
      await message.reply({
        content: '❌ You are blacklisted and cannot earn VP.',
      });
      return;
    }

    // Check for duplicate vouch
    const existingVouch = await prisma.vouch.findUnique({
      where: { messageId: message.id },
    });

    if (existingVouch) {
      return; // Silently ignore duplicate
    }

    const providerRoleIds = getProviderRoleIds();

    const mentions = message.mentions ?? {};

    const hasAnyMention =
      (mentions.users?.size ?? 0) > 0 ||
      (mentions.roles?.size ?? 0) > 0 ||
      Boolean(mentions.everyone);

    let providerRoleMentioned = false;
    if (providerRoleIds.length > 0) {
      const memberHasRole =
        typeof mentions.members?.some === 'function'
          ? mentions.members.some((member) =>
              providerRoleIds.some((roleId) => member?.roles?.cache?.has?.(roleId))
            )
          : false;
      const roleCollectionHasRole =
        typeof mentions.roles?.has === 'function'
          ? providerRoleIds.some((roleId) => mentions.roles.has(roleId))
          : false;

      providerRoleMentioned = memberHasRole || roleCollectionHasRole;
    }

    const providerMentioned = hasAnyMention || providerRoleMentioned;
    const imageUrl = getFirstImageUrl(message);

    if (providerMentioned) {
      // Auto-approve and credit VP
      const updatedUser = await prisma.$transaction(async (tx) => {
        const incrementedUser = await tx.user.update({
          where: { id: user.id },
          data: { vp: { increment: 1 } },
        });

        await tx.vouch.create({
          data: {
            messageId: message.id,
            userId: user.id,
            imageUrl,
            providerMentioned: true,
            status: 'auto',
            channelId: message.channel.id,
            guildId: message.guildId,
          },
        });

        return incrementedUser;
      });

      // Send confirmation in channel
      await message.react('✅');

      const acknowledgementLines = [
        `✅ Vouch verified! Added +1 point to <@${message.author.id}>'s balance.`,
      ];

      if (typeof updatedUser?.vp === 'number') {
        acknowledgementLines.push(`Current balance: ${formatVP(updatedUser.vp)}.`);
      }

      const sendAcknowledgement = message.channel?.send;

      if (typeof sendAcknowledgement === 'function') {
        try {
          await sendAcknowledgement.call(message.channel, {
            content: acknowledgementLines.join('\n'),
            allowedMentions: { users: [message.author.id] },
          });
        } catch (sendError) {
          console.warn('Failed to send vouch acknowledgement message', sendError);
        }
      } else {
        console.warn('Failed to send vouch acknowledgement message: channel.send is not available');
      }

      // Log transaction
      await logTransaction('vouch', {
        userId: message.author.id,
        amount: 1,
        status: 'auto',
        messageLink: message.url,
      });
    } else {
      // Create pending vouch
      await prisma.vouch.create({
        data: {
          messageId: message.id,
          userId: user.id,
          imageUrl,
          providerMentioned: false,
          status: 'pending',
          channelId: message.channel.id,
          guildId: message.guildId,
        },
      });

      try {
        await message.react('⏳');
      } catch (error) {
        console.log('Could not react to pending vouch:', error.message);
      }

      // Reply with instruction
      await message.reply({
        content:
          '⏳ Please @ a provider you ordered from, or wait for manual approval with `/approvevouch`.',
        allowedMentions: { repliedUser: true },
      });
    }
  } catch (error) {
    console.error('Error processing vouch:', error);
    await message.reply({
      content: '❌ An error occurred processing your vouch. Please try again later.',
      allowedMentions: { repliedUser: true },
    });
  }
}
