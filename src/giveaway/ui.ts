import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionReplyOptions,
} from 'discord.js';
import { GiveawayRecord, GiveawayHistory, DailyModifier } from './db.js';

// GUHD EATS Colors
const GUHD_GOLD = 0xFFD700;
const GUHD_GREEN = 0x00FF41;
const GUHD_RED = 0xFF3333;
const GUHD_BLUE = 0x5865F2;

/**
 * UI/LOOKS OPTIMIZATION: Progress bar using Unicode block characters
 */
function createProgressBar(current: number, total: number, length: number = 10): string {
  const percentage = Math.max(0, Math.min(1, current / total));
  const filled = Math.floor(percentage * length);
  const empty = length - filled;
  
  const fullBlock = '█';
  const emptyBlock = '░';
  
  return fullBlock.repeat(filled) + emptyBlock.repeat(empty);
}

/**
 * Format timestamp for Discord
 */
function formatTime(timestamp: number): string {
  return `<t:${Math.floor(timestamp / 1000)}:R>`;
}

/**
 * Calculate time remaining percentage for progress bar
 */
function getTimeProgress(startAt: number, endAt: number): number {
  const now = Date.now();
  const total = endAt - startAt;
  const elapsed = now - startAt;
  return elapsed / total;
}

/**
 * UI/LOOKS OPTIMIZATION: Main giveaway embed with rich branding
 */
export function createGiveawayEmbed(
  giveaway: GiveawayRecord,
  stats: { entrantCount: number; pot: number }
): EmbedBuilder {
  const now = Date.now();
  const timeProgress = getTimeProgress(giveaway.startAt, giveaway.endAt);
  const progressBar = createProgressBar(timeProgress, 1, 20);
  
  let color = GUHD_GOLD;
  let statusEmoji = '🎟️';
  let statusText = '';
  
  if (giveaway.state === 'REVEALING') {
    color = GUHD_GREEN;
    statusEmoji = '🎰';
    statusText = '\n\n**🛞 SPINNING THE WHEEL...**';
  } else if (giveaway.state === 'COMPLETE' && giveaway.winnerUserId) {
    color = GUHD_GREEN;
    statusEmoji = '🏆';
    statusText = `\n\n**Winner:** <@${giveaway.winnerUserId}>`;
  } else if (giveaway.state === 'CANCELLED') {
    color = GUHD_RED;
    statusEmoji = '⛔';
    statusText = '\n\n**CANCELLED** - All entries refunded';
  }
  
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${statusEmoji} ${giveaway.title}`)
    .setDescription(
      (giveaway.description || 'No description provided') + statusText
    )
    .addFields(
      {
        name: '💰 Pot',
        value: `**${stats.pot} VP**`,
        inline: true,
      },
      {
        name: '🎫 Entry Cost',
        value: `${giveaway.buyInCost} VP`,
        inline: true,
      },
      {
        name: '👥 Entrants',
        value: `${stats.entrantCount}`,
        inline: true,
      },
      {
        name: '🎯 Max Entries',
        value: `${giveaway.maxEntriesPerUser} per user`,
        inline: true,
      },
      {
        name: '🏦 Host Cut',
        value: `${giveaway.hostCut}%`,
        inline: true,
      },
      {
        name: '⏰ Ends',
        value: giveaway.state === 'ACTIVE' ? formatTime(giveaway.endAt) : 'Ended',
        inline: true,
      }
    )
    .setFooter({
      text: `Hosted by ${giveaway.hostId} • ID: ${giveaway.id}`,
    })
    .setTimestamp(new Date(giveaway.createdAt));
  
  // Add progress bar if active
  if (giveaway.state === 'ACTIVE' && now < giveaway.endAt) {
    const remaining = Math.max(0, giveaway.endAt - now);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    embed.addFields({
      name: '📊 Time Progress',
      value: `\`${progressBar}\` ${minutes}m ${seconds}s remaining`,
      inline: false,
    });
  }
  
  // Add type badge
  if (giveaway.type === 'jackpot') {
    embed.addFields({
      name: '💎 Special Event',
      value: '**JACKPOT GIVEAWAY** - Winner takes all!',
      inline: false,
    });
  } else if (giveaway.type === 'daily') {
    embed.addFields({
      name: '📅 Special Event',
      value: '**DAILY GIVEAWAY** - Community event!',
      inline: false,
    });
  }
  
  return embed;
}

/**
 * Build interactive buttons for giveaway
 */
export function buildGiveawayButtons(giveaway: GiveawayRecord): ActionRowBuilder<ButtonBuilder>[] {
  const joinDisabled = giveaway.state !== 'ACTIVE';
  
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway:join:${giveaway.id}`)
        .setLabel(joinDisabled ? 'Closed' : 'Join Giveaway')
        .setEmoji('🎟️')
        .setStyle(joinDisabled ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(joinDisabled),
      new ButtonBuilder()
        .setCustomId(`giveaway:entrants:${giveaway.id}`)
        .setLabel('View Entrants')
        .setEmoji('👥')
        .setStyle(ButtonStyle.Primary)
    ),
  ];
}

/**
 * UI/LOOKS OPTIMIZATION: Cinematic winner announcement
 */
export function buildWinnerEmbed(
  giveaway: GiveawayRecord,
  winner: { userId: string; payout: number; hostAmount: number },
  stats: { pot: number }
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(GUHD_GREEN)
    .setTitle('🏆 GIVEAWAY WINNER! 🏆')
    .setDescription(
      `**${giveaway.title}**\n\n` +
      `🎉 Congratulations to <@${winner.userId}>!\n\n` +
      `**Prize:** ${winner.payout} VP\n` +
      `**Host earned:** ${winner.hostAmount} VP`
    )
    .addFields(
      {
        name: '💰 Total Pot',
        value: `${stats.pot} VP`,
        inline: true,
      },
      {
        name: '🎫 Winner Gets',
        value: `${winner.payout} VP`,
        inline: true,
      },
      {
        name: '🏦 Host Gets',
        value: `${winner.hostAmount} VP`,
        inline: true,
      }
    )
    .setFooter({
      text: `Giveaway ID: ${giveaway.id}`,
    })
    .setTimestamp();
  
  return embed;
}

/**
 * Build history embed showing past giveaways
 */
export function buildHistoryEmbed(
  records: GiveawayHistory[],
  page: number,
  totalPages: number
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(GUHD_GOLD)
    .setTitle('📜 Giveaway History')
    .setFooter({
      text: `Page ${page}/${totalPages}`,
    })
    .setTimestamp();
  
  if (records.length === 0) {
    embed.setDescription('No giveaway history found.');
    return embed;
  }
  
  const description = records
    .map((record, index) => {
      const position = (page - 1) * 20 + index + 1;
      const typeEmoji = record.type === 'jackpot' ? '💎' : record.type === 'daily' ? '📅' : '🎟️';
      return (
        `${position}. ${typeEmoji} <@${record.winnerUserId}> won **${record.payoutAmount} VP** ` +
        `<t:${Math.floor(record.completedAt / 1000)}:R>`
      );
    })
    .join('\n');
  
  embed.setDescription(description);
  return embed;
}

/**
 * Build jackpot embed
 */
export function buildJackpotEmbed(totalVP: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(GUHD_GOLD)
    .setTitle('💎 COMMUNITY JACKPOT')
    .setDescription(
      `The global jackpot grows from all VP spent in giveaways!\n\n` +
      `**Current Jackpot:** ${totalVP} VP\n\n` +
      `Entry cost: **1 VP**\n` +
      `Winner takes the entire pot!`
    )
    .setFooter({
      text: 'Jackpot grows with every giveaway entry',
    })
    .setTimestamp();
}

/**
 * Build daily giveaway embed with modifiers
 */
export function buildDailyEmbed(
  basePot: number,
  modifiers: DailyModifier[],
  finalPot: number
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(GUHD_GREEN)
    .setTitle('📅 DAILY GIVEAWAY')
    .setDescription(
      `The daily community giveaway is here!\n\n` +
      `**Base Pot:** ${basePot} VP\n` +
      `**Final Pot:** ${finalPot} VP\n\n` +
      `Entry cost: **1 VP**`
    )
    .setFooter({
      text: 'Daily giveaways run automatically at 9AM EST',
    })
    .setTimestamp();
  
  if (modifiers.length > 0) {
    const modifierText = modifiers
      .map((mod) => {
        if (mod.modifierType === 'pot_boost') {
          return `🚀 +${mod.value} VP pot boost`;
        } else if (mod.modifierType === 'multiplier') {
          return `✨ ${mod.value}x multiplier`;
        } else {
          return `🎫 ${mod.value} bonus entries`;
        }
      })
      .join('\n');
    
    embed.addFields({
      name: '⚡ Active Boosts',
      value: modifierText,
      inline: false,
    });
  }
  
  return embed;
}

/**
 * Build list of active giveaways
 */
export function buildGiveawayListEmbed(giveaways: Array<{
  giveaway: GiveawayRecord;
  stats: { entrantCount: number; pot: number };
}>): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(GUHD_GOLD)
    .setTitle('🎟️ Active Giveaways')
    .setTimestamp();
  
  if (giveaways.length === 0) {
    embed.setDescription('No active giveaways right now.');
    return embed;
  }
  
  const description = giveaways
    .map((item) => {
      const { giveaway, stats } = item;
      const typeEmoji = giveaway.type === 'jackpot' ? '💎' : giveaway.type === 'daily' ? '📅' : '🎟️';
      return (
        `${typeEmoji} **${giveaway.title}**\n` +
        `💰 Pot: ${stats.pot} VP • 👥 ${stats.entrantCount} entrants\n` +
        `⏰ Ends ${formatTime(giveaway.endAt)} • Channel: <#${giveaway.channelId}>`
      );
    })
    .join('\n\n');
  
  embed.setDescription(description);
  return embed;
}

/**
 * Build entrants list
 */
export function buildEntrantsEmbed(
  giveaway: GiveawayRecord,
  entrants: Array<{ userId: string; count: number }>
): InteractionReplyOptions {
  if (entrants.length === 0) {
    return {
      ephemeral: true,
      content: 'No entrants yet.',
    };
  }
  
  const lines = entrants
    .map((entrant, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🎫';
      return `${medal} <@${entrant.userId}> — ${entrant.count} ticket(s)`;
    })
    .join('\n');
  
  const embed = new EmbedBuilder()
    .setColor(GUHD_BLUE)
    .setTitle(`👥 Entrants — ${giveaway.title}`)
    .setDescription(lines)
    .setFooter({
      text: `Total: ${entrants.length} participants`,
    });
  
  return {
    ephemeral: true,
    embeds: [embed],
  };
}

/**
 * Join confirmation message
 */
export function buildJoinConfirmation(
  giveaway: GiveawayRecord,
  newBalance: number,
  entryCount: number
): InteractionReplyOptions {
  return {
    ephemeral: true,
    content:
      `✅ You're in **${giveaway.title}**!\n\n` +
      `-${giveaway.buyInCost} VP • New balance: **${newBalance} VP**\n` +
      `You now have **${entryCount}** ${entryCount === 1 ? 'ticket' : 'tickets'}`,
  };
}

/**
 * Join failure message
 */
export function buildJoinFailure(reason: string): InteractionReplyOptions {
  return {
    ephemeral: true,
    content: `❌ ${reason}`,
  };
}

