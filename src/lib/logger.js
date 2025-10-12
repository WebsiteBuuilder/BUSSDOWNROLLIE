import { EmbedBuilder } from 'discord.js';

let logChannel = null;

/**
 * Initialize logger with Discord channel
 */
export function initLogger(channel) {
  logChannel = channel;
}

/**
 * Log VP transaction to audit channel
 */
export async function logTransaction(type, data) {
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('💰 VP Transaction')
    .setColor(0x00FF00)
    .setTimestamp();

  switch (type) {
    case 'vouch':
      embed.addFields(
        { name: 'Type', value: 'Vouch', inline: true },
        { name: 'User', value: `<@${data.userId}>`, inline: true },
        { name: 'Amount', value: `+${data.amount} VP`, inline: true },
        { name: 'Status', value: data.status, inline: true },
        { name: 'Message', value: data.messageLink || 'N/A', inline: false }
      );
      break;

    case 'transfer':
      embed.addFields(
        { name: 'Type', value: 'Transfer', inline: true },
        { name: 'From', value: `<@${data.fromUserId}>`, inline: true },
        { name: 'To', value: `<@${data.toUserId}>`, inline: true },
        { name: 'Amount', value: `${data.amount} VP`, inline: true },
        { name: 'Fee', value: `${data.fee} VP`, inline: true }
      );
      break;

    case 'redemption':
      embed.addFields(
        { name: 'Type', value: 'Redemption', inline: true },
        { name: 'User', value: `<@${data.userId}>`, inline: true },
        { name: 'Reward', value: data.type, inline: true },
        { name: 'Cost', value: `${data.cost} VP`, inline: true },
        { name: 'Status', value: data.status, inline: true }
      );
      break;

    case 'battle':
      embed.addFields(
        { name: 'Type', value: 'Battle', inline: true },
        { name: 'Game', value: data.game, inline: true },
        { name: 'Challenger', value: `<@${data.challengerId}>`, inline: true },
        { name: 'Opponent', value: `<@${data.opponentId}>`, inline: true },
        { name: 'Amount', value: `${data.amount} VP`, inline: true },
        { name: 'Winner', value: data.winnerId ? `<@${data.winnerId}>` : 'N/A', inline: true }
      );
      break;

    case 'blackjack':
      embed.addFields(
        { name: 'Type', value: 'Blackjack', inline: true },
        { name: 'User', value: `<@${data.userId}>`, inline: true },
        { name: 'Bet', value: `${data.amount} VP`, inline: true },
        { name: 'Result', value: data.result, inline: true },
        { name: 'Payout', value: data.payout ? `${data.payout} VP` : '0 VP', inline: true }
      );
      break;

    case 'daily':
      embed.addFields(
        { name: 'Type', value: 'Daily Claim', inline: true },
        { name: 'User', value: `<@${data.userId}>`, inline: true },
        { name: 'Amount', value: `+${data.amount} VP`, inline: true },
        { name: 'Success', value: data.success ? 'Yes' : 'No', inline: true }
      );
      break;

    case 'admin':
      embed.setColor(0xFF9900);
      embed.addFields(
        { name: 'Type', value: 'Admin Action', inline: true },
        { name: 'Admin', value: `<@${data.adminId}>`, inline: true },
        { name: 'Action', value: data.action, inline: true },
        { name: 'Target', value: `<@${data.targetUserId}>`, inline: true },
        { name: 'Amount', value: data.amount ? `${data.amount} VP` : 'N/A', inline: true }
      );
      break;
  }

  try {
    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Failed to send log:', error);
  }
}

/**
 * Log error to console and optionally to Discord
 */
export async function logError(error, context = '') {
  console.error(`[ERROR] ${context}:`, error);
  
  if (logChannel) {
    const embed = new EmbedBuilder()
      .setTitle('❌ Error')
      .setColor(0xFF0000)
      .setDescription(`\`\`\`${error.message || error}\`\`\``)
      .addFields({ name: 'Context', value: context || 'Unknown' })
      .setTimestamp();

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (e) {
      console.error('Failed to send error log:', e);
    }
  }
}

