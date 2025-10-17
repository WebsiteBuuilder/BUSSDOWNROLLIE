import { ActionRowBuilder, EmbedBuilder } from 'discord.js';

function scoreChip(label, value) {
  return `**${label}:** ${value}`;
}

export function presentGame(ctx, {
  title,
  round,
  totalRounds,
  challengerId,
  opponentId,
  challengerScore = 0,
  opponentScore = 0,
  description,
  fields = [],
  challengerControls = [],
  opponentControls = [],
  extraComponents = [],
  footer,
  color = 0x5865f2,
  countdown,
  status,
}) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(
      [
        `Round ${round} / ${totalRounds}`,
        `${scoreChip('Challenger', challengerScore)} | ${scoreChip('Opponent', opponentScore)}`,
        countdown != null ? `⏳ ${countdown}s remaining` : null,
        '',
        description,
        status ? `\n${status}` : null,
      ].filter(Boolean).join('\n')
    );

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  if (footer) {
    embed.setFooter({ text: footer });
  }

  const components = [];
  if (challengerControls.length > 0) {
    const row = new ActionRowBuilder();
    for (const control of challengerControls) {
      row.addComponents(control);
    }
    components.push(row);
  }

  if (opponentControls.length > 0) {
    const row = new ActionRowBuilder();
    for (const control of opponentControls) {
      row.addComponents(control);
    }
    components.push(row);
  }

  for (const extra of extraComponents) {
    components.push(extra);
  }

  return ctx.render({ embeds: [embed], components });
}
