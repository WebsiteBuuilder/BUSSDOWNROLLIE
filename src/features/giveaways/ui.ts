import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionReplyOptions,
  InteractionUpdateOptions,
} from 'discord.js';
import { GiveawayPotSnapshot, GiveawayRecord } from './model.ts';

function formatTime(timestamp: number): string {
  return `<t:${Math.floor(timestamp / 1000)}:R>`;
}

export function buildGiveawayEmbed(
  giveaway: GiveawayRecord,
  stats: GiveawayPotSnapshot
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`🎟️ ${giveaway.title}`)
    .setDescription(giveaway.description ?? '')
    .addFields(
      { name: 'Buy-in', value: `${giveaway.buyInCost} VP`, inline: true },
      { name: 'Max Entries', value: `${giveaway.maxEntriesPerUser}`, inline: true },
      { name: 'Pot', value: `${stats.pot} VP`, inline: true },
      { name: 'Entrants', value: `${stats.entrantCount}`, inline: true },
      { name: 'Ends', value: formatTime(giveaway.endAt), inline: true },
      { name: 'Host', value: `<@${giveaway.hostId}>`, inline: true }
    )
    .setFooter({ text: `Giveaway ID: ${giveaway.id}` })
    .setTimestamp(new Date(giveaway.endAt));

  if (giveaway.state === 'REVEALING') {
    embed.setColor(0xf1c40f).setDescription(
      `${giveaway.description ?? ''}\n\n🛞 Grand Reveal! Spinning soon…`
    );
  } else if (giveaway.state === 'COMPLETE' && giveaway.winnerUserId) {
    embed.setColor(0x2ecc71).addFields({
      name: 'Winner',
      value: `<@${giveaway.winnerUserId}>`,
      inline: true,
    });
  } else if (giveaway.state === 'CANCELLED') {
    embed.setColor(0xe74c3c).setDescription(
      `${giveaway.description ?? ''}\n\n⛔ Cancelled. All entries refunded.`
    );
  } else {
    embed.setColor(0x5865f2);
  }

  return embed;
}

export function buildGiveawayComponents(giveaway: GiveawayRecord): ActionRowBuilder<ButtonBuilder>[] {
  const joinDisabled = giveaway.state !== 'ACTIVE';
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway:join:${giveaway.id}`)
        .setLabel(joinDisabled ? 'Closed' : 'Join')
        .setEmoji('🎟️')
        .setStyle(joinDisabled ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(joinDisabled),
      new ButtonBuilder()
        .setCustomId(`giveaway:entrants:${giveaway.id}`)
        .setLabel('View Entrants')
        .setStyle(ButtonStyle.Primary)
    ),
  ];
}

export function buildStatusEmbed(
  giveaway: GiveawayRecord,
  stats: GiveawayPotSnapshot
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`Giveaway Status — ${giveaway.title}`)
    .addFields(
      { name: 'State', value: giveaway.state, inline: true },
      { name: 'Buy-in Cost', value: `${giveaway.buyInCost} VP`, inline: true },
      { name: 'Pot', value: `${stats.pot} VP`, inline: true },
      { name: 'Entries', value: `${stats.entrantCount}`, inline: true },
      { name: 'Max Entries/User', value: `${giveaway.maxEntriesPerUser}`, inline: true },
      { name: 'Reveal Window', value: `${giveaway.revealWindowSeconds}s`, inline: true },
      { name: 'Payout Ratio', value: `${giveaway.payoutRatio}%`, inline: true },
      { name: 'Ends In', value: formatTime(giveaway.endAt), inline: true }
    )
    .setFooter({ text: `Giveaway ID: ${giveaway.id}` });

  if (giveaway.description) {
    embed.setDescription(giveaway.description);
  }

  return embed;
}

export function entrantsReply(entrants: { userId: string; entries: number }[]): InteractionReplyOptions {
  if (entrants.length === 0) {
    return {
      ephemeral: true,
      content: 'No entrants yet.',
    };
  }

  const lines = entrants
    .map((entrant, index) => `${index + 1}. <@${entrant.userId}> — ${entrant.entries} ticket(s)`)
    .join('\n');

  return {
    ephemeral: true,
    content: `**Entrants**\n${lines}`,
  };
}

export function buildJoinConfirmation(
  giveaway: GiveawayRecord,
  newBalance: number
): InteractionReplyOptions {
  return {
    ephemeral: true,
    content: `You're in **${giveaway.title}**! -${giveaway.buyInCost} VP • Balance: ${newBalance} VP`,
  };
}

export function buildJoinFailure(reason: string): InteractionReplyOptions {
  return {
    ephemeral: true,
    content: reason,
  };
}

export function buildUpdateMessage(
  giveaway: GiveawayRecord,
  stats: GiveawayPotSnapshot
): InteractionUpdateOptions {
  return {
    embeds: [buildGiveawayEmbed(giveaway, stats)],
    components: buildGiveawayComponents(giveaway),
  };
}

export function buildWheelAnnouncement(seed: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🛞 Grand Reveal Incoming')
    .setDescription(
      'The wheel is arming… final entries are locked. Get ready for the spin!\n' +
        `Seed: \`${seed}\``
    )
    .setColor(0xf1c40f);
}

export function buildWinnerEmbed(
  giveaway: GiveawayRecord,
  result: { winnerUserId: string; payout: number; seed: string; winnerIndex: number },
  stats: GiveawayPotSnapshot
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`🏆 ${giveaway.title}`)
    .setDescription(`Winner: <@${result.winnerUserId}>`)
    .addFields(
      { name: 'Payout', value: `${result.payout} VP`, inline: true },
      { name: 'Pot', value: `${stats.pot} VP`, inline: true },
      { name: 'Winning Ticket', value: `#${result.winnerIndex + 1}`, inline: true },
      { name: 'Seed', value: `\`${result.seed}\`` }
    )
    .setColor(0x2ecc71);
}
