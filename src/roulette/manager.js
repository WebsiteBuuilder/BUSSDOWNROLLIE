import crypto from 'crypto';
import { MessageFlags } from 'discord.js';
import { getOrCreateUser, removeVP, addVP } from '../db/index.js';
import { buildPromptEmbed, buildColorButtons, buildSpinEmbed, buildResultEmbed } from './ui.js';
import { animateRoulette } from './animation.js';
import { safeReply } from '../utils/interaction.js';

const ACTIVE_ROULETTE = new Map();

const WIN_FRAMES = {
  red: '🟩🟥⬛🟥⬛🟥⬛🟥⬛🟥🟩⬛🟥⬛',
  black: '🟩⬛🟥⬛🟥⬛🟥⬛🟥⬛🟩🟥⬛🟥',
  green: '🟥⬛🟥⬛🟥⬛🟥⬛🟥⬛🟥⬛🟩🟥',
};

const PAYOUTS = {
  red: 2,
  black: 2,
  green: 15,
};

function pickWinningColor() {
  const wheel = [
    ...Array(18).fill('red'),
    ...Array(18).fill('black'),
    'green',
  ];
  return wheel[crypto.randomInt(wheel.length)];
}

function formatDisplayName(interaction) {
  return interaction.member?.displayName ?? interaction.user.username;
}

export async function startRoulette(interaction, amount) {
  const userId = interaction.user.id;
  const user = await getOrCreateUser(userId);

  if (user.blacklisted) {
    await safeReply(interaction, {
      content: '🚫 You are not allowed to play roulette.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (user.vp < amount) {
    await safeReply(interaction, {
      content: `❌ You need ${amount} points, but you only have ${user.vp}.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const commandId = interaction.id;

  await interaction.deferReply();

  const displayName = formatDisplayName(interaction);
  const message = await interaction.editReply({
    embeds: [buildPromptEmbed({ displayName, amount })],
    components: buildColorButtons(commandId),
  });

  ACTIVE_ROULETTE.set(commandId, {
    userId,
    amount,
    messageId: message.id,
    channelId: message.channelId,
    displayName,
  });
}

export async function handleRouletteButton(interaction) {
  const customId = interaction.customId ?? '';
  if (!customId.startsWith('roulette:')) {
    return false;
  }

  const [, commandId, color] = customId.split(':');
  const state = ACTIVE_ROULETTE.get(commandId);

  if (!state) {
    await interaction.reply({ ephemeral: true, content: '⏱️ This roulette spin is no longer active.' });
    return true;
  }

  if (!WIN_FRAMES[color]) {
    await interaction.reply({ ephemeral: true, content: 'That color is unavailable.' });
    return true;
  }

  if (interaction.user.id !== state.userId) {
    await interaction.reply({ ephemeral: true, content: '🙅 Only the original spinner can choose the color.' });
    return true;
  }

  ACTIVE_ROULETTE.delete(commandId);

  await interaction.deferUpdate();

  try {
    await removeVP(state.userId, state.amount);
  } catch (error) {
    await interaction.editReply({
      content: '❌ Could not place your bet. Do you still have enough points?',
      embeds: [],
      components: [],
    });
    return true;
  }

  const updateFrame = async ({ frame, caption }) => {
    await interaction.editReply({
      embeds: [buildSpinEmbed({ displayName: state.displayName, amount: state.amount, frame, caption })],
      components: [],
    });
  };

  const winningColor = pickWinningColor();
  await animateRoulette(updateFrame, WIN_FRAMES[winningColor]);

  let payout = 0;
  let didWin = false;

  if (winningColor === color) {
    const multiplier = PAYOUTS[color] ?? 2;
    payout = state.amount * multiplier;
    didWin = true;
    await addVP(state.userId, payout);
  }

  const netGain = didWin ? payout - state.amount : 0;

  const resultEmbed = buildResultEmbed({
    displayName: state.displayName,
    amount: state.amount,
    winningColor,
    frame: WIN_FRAMES[winningColor],
    didWin,
    net: netGain,
    chosenColor: color,
  });

  if (!didWin) {
    await interaction.editReply({ embeds: [resultEmbed], components: [] });
    return true;
  }

  await interaction.editReply({ embeds: [resultEmbed], components: [] });
  return true;
}
