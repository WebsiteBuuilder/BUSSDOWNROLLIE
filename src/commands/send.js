import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { getOrCreateUser, transferVP, getConfig } from '../db/index.js';
import { calculateTransferFee, formatVP } from '../lib/utils.js';
import { logTransaction } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('send')
  .setDescription('Transfer VP to another user')
  .addUserOption((option) =>
    option.setName('user').setDescription('User to send VP to').setRequired(true)
  )
  .addIntegerOption((option) =>
    option.setName('amount').setDescription('Amount of VP to send').setRequired(true).setMinValue(1)
  );

export async function execute(interaction) {
  const sender = interaction.user;
  const recipient = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');

  // Validation checks
  if (recipient.bot) {
    return interaction.reply({
      content: '❌ You cannot send VP to bots.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (recipient.id === sender.id) {
    return interaction.reply({
      content: '❌ You cannot send VP to yourself.',
      flags: MessageFlags.Ephemeral,
    });
  }

  try {
    await interaction.deferReply();

    // Get fee percentage from config
    const feePercentStr = await getConfig('transfer_fee_percent', '5');
    const feePercent = parseInt(feePercentStr);
    const fee = calculateTransferFee(amount, feePercent);
    const totalCost = amount + fee;

    // Get sender user data
    const senderUser = await getOrCreateUser(sender.id);

    // Check if sender is blacklisted
    if (senderUser.blacklisted) {
      return interaction.editReply({
        content: '❌ You are blacklisted and cannot transfer VP.',
      });
    }

    // Check balance
    if (senderUser.vp < totalCost) {
      return interaction.editReply({
        content: `❌ Insufficient balance. You need ${formatVP(totalCost)} (${formatVP(amount)} + ${formatVP(fee)} fee), but you only have ${formatVP(senderUser.vp)}.`,
      });
    }

    // Execute transfer
    const result = await transferVP(sender.id, recipient.id, amount, fee);

    // Create success embed
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Transfer Complete')
      .addFields(
        { name: 'From', value: `<@${sender.id}>`, inline: true },
        { name: 'To', value: `<@${recipient.id}>`, inline: true },
        { name: 'Amount', value: formatVP(amount), inline: true },
        { name: 'Fee', value: formatVP(fee), inline: true },
        { name: 'Total Deducted', value: formatVP(totalCost), inline: true },
        { name: 'Your New Balance', value: formatVP(result.updatedFrom.vp), inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // DM recipient
    try {
      await recipient.send({
        embeds: [
          {
            color: 0x00ff00,
            title: '💰 VP Received!',
            description: `**${sender.username}** sent you ${formatVP(amount)}!`,
            fields: [
              { name: 'Your New Balance', value: formatVP(result.updatedTo.vp), inline: true },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch (error) {
      console.log('Could not DM recipient:', error.message);
    }

    // Log transaction
    await logTransaction('transfer', {
      fromUserId: sender.id,
      toUserId: recipient.id,
      amount,
      fee,
    });
  } catch (error) {
    console.error('Error in send command:', error);
    await interaction.editReply({
      content: `❌ Transfer failed: ${error.message}`,
    });
  }
}
