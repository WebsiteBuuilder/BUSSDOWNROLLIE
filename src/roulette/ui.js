import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const COLOR_INFO = {
  red: { emoji: '🟥', name: 'RED', style: ButtonStyle.Danger },
  black: { emoji: '⬛', name: 'BLACK', style: ButtonStyle.Secondary },
  green: { emoji: '🟩', name: 'GREEN', style: ButtonStyle.Success },
};

export function buildPromptEmbed({ displayName, amount }) {
  return new EmbedBuilder()
    .setTitle('🎡 Roulette Royale')
    .setColor(0x2b2d31)
    .setDescription(
      [
        `${displayName} (you) approaches the wheel.`,
        `Stake: ${amount} points`,
        '',
        'Choose a color to release the spin!',
      ].join('\n')
    )
    .setFooter({ text: `💰 Total Wager: ${amount} points` });
}

export function buildColorButtons(baseId) {
  const row = new ActionRowBuilder();
  for (const [key, info] of Object.entries(COLOR_INFO)) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`roulette:${baseId}:${key}`)
        .setLabel(`${info.emoji} ${info.name} (you)`)
        .setStyle(info.style)
    );
  }
  return [row];
}

export function buildSpinEmbed({ displayName, amount, frame, caption }) {
  return new EmbedBuilder()
    .setTitle('🎡 Roulette Royale')
    .setColor(0x2b2d31)
    .setDescription(
      [
        `${displayName} (you)`,
        '',
        caption,
        frame,
      ].join('\n')
    )
    .setFooter({ text: `💰 Total Wager: ${amount} points` });
}

export function buildResultEmbed({ displayName, amount, winningColor, frame, didWin, net, chosenColor }) {
  const info = COLOR_INFO[winningColor];
  const chosenInfo = COLOR_INFO[chosenColor];
  const colorValue = didWin ? 0x57f287 : 0xed4245;

  const lines = [
    '🎉 The wheel stops!',
    frame,
    '',
    `🪙 Winning Color: ${info.emoji} **${info.name}**`,
    `🎯 Your Pick: ${chosenInfo.emoji} **${chosenInfo.name}**`,
  ];

  if (didWin) {
    lines.push(`🏆 Winner: ${displayName} (+${net} points)`);
  } else {
    lines.push(`💀 Loss: ${displayName} (-${amount} points)`);
  }

  return new EmbedBuilder()
    .setTitle('🎡 Roulette Royale')
    .setColor(colorValue)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `💰 Total Wager: ${amount} points` });
}
