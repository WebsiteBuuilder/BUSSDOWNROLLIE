import { hasImageAttachment, getFirstImageUrl, mentionsRole } from '../lib/utils.js';
import prisma, { getOrCreateUser } from '../db/index.js';
import { logTransaction } from '../lib/logger.js';

export const name = 'messageCreate';
export const once = false;

export async function execute(message) {
  // Ignore bots
  if (message.author.bot) return;

  // Check if message is in vouch channel
  if (message.channel.id !== process.env.VOUCH_CHANNEL_ID) return;

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
        ephemeral: true
      });
      return;
    }

    // Check for duplicate vouch
    const existingVouch = await prisma.vouch.findUnique({
      where: { messageId: message.id }
    });

    if (existingVouch) {
      return; // Silently ignore duplicate
    }

    // Check if provider was mentioned
    const providerMentioned = mentionsRole(message, process.env.PROVIDER_ROLE_ID);
    const imageUrl = getFirstImageUrl(message);

    if (providerMentioned) {
      // Auto-approve and credit VP
      const updatedUser = await prisma.$transaction(async (tx) => {
        const incrementedUser = await tx.user.update({
          where: { id: user.id },
          data: { vp: { increment: 1 } }
        });

        await tx.vouch.create({
          data: {
            messageId: message.id,
            userId: user.id,
            imageUrl,
            providerMentioned: true,
            status: 'auto'
          }
        });

        return incrementedUser;
      });

      // DM user confirmation
      try {
        await message.author.send({
          embeds: [{
            color: 0x00FF00,
            title: '✅ Vouch Approved!',
            description: 'Thanks for the vouch! +1 VP',
            fields: [
              { name: 'New Balance', value: `${updatedUser.vp} VP 💰`, inline: true }
            ],
            timestamp: new Date().toISOString()
          }]
        });
      } catch (error) {
        console.log('Could not DM user:', error.message);
      }

      // Send confirmation in channel
      await message.react('✅');

      // Log transaction
      await logTransaction('vouch', {
        userId: message.author.id,
        amount: 1,
        status: 'auto',
        messageLink: message.url
      });

    } else {
      // Create pending vouch
      await prisma.vouch.create({
        data: {
          messageId: message.id,
          userId: user.id,
          imageUrl,
          providerMentioned: false,
          status: 'pending'
        }
      });

      try {
        await message.react('⏳');
      } catch (error) {
        console.log('Could not react to pending vouch:', error.message);
      }

      // Reply with instruction
      await message.reply({
        content: '⏳ Please @ a provider to validate your vouch, or wait for manual approval with `/approvevouch`.',
        allowedMentions: { repliedUser: true }
      });
    }
  } catch (error) {
    console.error('Error processing vouch:', error);
    await message.reply({
      content: '❌ An error occurred processing your vouch. Please try again later.',
      allowedMentions: { repliedUser: true }
    });
  }
}

