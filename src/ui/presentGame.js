import { EmbedBuilder } from 'discord.js';
import { labelForUser, turnStatusLabel } from './labelForUser.js';

const COLOR_MAP = {
  neutral: 0x2b2d31,
  victory: 0x57f287,
  defeat: 0xed4245,
  warning: 0xfaa61a,
};

function resolveColor(status, explicitColor) {
  if (explicitColor) {
    return explicitColor;
  }
  return COLOR_MAP[status] ?? COLOR_MAP.neutral;
}

export async function presentGame(ctx, options = {}) {
  const {
    title = '⚔️ Battle',
    description,
    extraLines = [],
    fields = [],
    components = [],
    status = 'neutral',
    turnUserId = null,
    footer,
    viewerId = null,
    color,
  } = options;

  const embed = new EmbedBuilder().setTitle(title).setColor(resolveColor(status, color));

  const lines = [];

  if (ctx.p1 || ctx.p2) {
    const p1Label = labelForUser(ctx.p1, viewerId);
    const p2Label = labelForUser(ctx.p2, viewerId);
    lines.push(`${p1Label} 🆚 ${p2Label}`);
  }

  if (description) {
    lines.push(description);
  }

  if (turnUserId) {
    const turnPlayer = turnUserId === ctx.p1?.id ? ctx.p1 : turnUserId === ctx.p2?.id ? ctx.p2 : null;
    lines.push(`🎯 Turn: ${turnStatusLabel(turnPlayer, viewerId)}`);
  }

  if (extraLines?.length) {
    lines.push(...extraLines);
  }

  embed.setDescription(lines.join('\n\n'));

  if (fields?.length) {
    embed.addFields(fields);
  }

  embed.setFooter({ text: footer ?? `💰 Total Wager: ${ctx.amount} points` });

  await ctx.render({ embeds: [embed], components });
}
