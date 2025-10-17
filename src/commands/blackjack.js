import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

import prisma, { getOrCreateUser, hasActiveBlackjack, getConfig } from '../db/index.js';
import { logTransaction } from '../lib/logger.js';
import { ensureCasinoButtonContext, ensureCasinoChannel } from '../lib/casino-guard.js';
import { logBlackjackEvent } from '../lib/blackjack-telemetry.js';
import { formatVP } from '../lib/utils.js';
import {
  createBlackjackGame,
  hit,
  doubleDown,
  playDealer,
  calculateHandValue,
  formatHand,
  isBlackjack,
  isBust,
  canSplit,
  determineResult,
} from '../lib/blackjack.js';

export const data = new SlashCommandBuilder()
  .setName('blackjack')
  .setDescription('Play blackjack')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('play')
      .setDescription('Start a blackjack game')
      .addIntegerOption((option) =>
        option.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('cancel').setDescription('Cancel your active blackjack game')
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('rules').setDescription('View blackjack rules and table limits')
  );

const INACTIVITY_TIMEOUT_MS = 60000;
const activeBlackjackGames = new Map();

function getActiveGame(userId) {
  return activeBlackjackGames.get(userId) ?? null;
}

function registerActiveGame(userId, details) {
  activeBlackjackGames.set(userId, details);
}

function clearActiveGame(userId) {
  const existing = activeBlackjackGames.get(userId);

  if (existing?.timeoutId) {
    clearTimeout(existing.timeoutId);
  }

  activeBlackjackGames.delete(userId);
}

async function updateInteractionMessage(interaction, payload) {
  if (interaction.message && typeof interaction.message.edit === 'function') {
    await interaction.message.edit(payload);
    return;
  }

  if (typeof interaction.editReply === 'function') {
    await interaction.editReply(payload);
    return;
  }

  if (interaction.channel && typeof interaction.channel.send === 'function') {
    await interaction.channel.send(payload);
  }
}

export async function execute(interaction, _client) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'rules') {
    return showRules(interaction);
  }

  if (subcommand === 'cancel') {
    return cancelBlackjack(interaction);
  }

  const guard = await ensureCasinoChannel(interaction);
  if (!guard.ok) {
    return;
  }

  const bet = interaction.options.getInteger('bet');
  const userId = interaction.user.id;

  if (getActiveGame(userId)) {
    return interaction.reply({
      content:
        '❌ You already have an active blackjack game. Use /blackjack cancel to end it first.',
      ephemeral: true,
    });
  }

  try {
    logBlackjackEvent('game.request', {
      userId,
      bet,
      guildId: interaction.guildId,
      channelId: guard.resolvedChannelId ?? interaction.channelId,
      isThread: guard.isThread,
    });

    await interaction.deferReply();

    const user = await getOrCreateUser(userId);

    if (user.blacklisted) {
      return interaction.editReply({
        content: '❌ You are blacklisted and cannot play blackjack.',
      });
    }

    if (await hasActiveBlackjack(userId)) {
      return interaction.editReply({
        content:
          '❌ You already have an active blackjack game. Use /blackjack cancel to end it first.',
      });
    }

    const minStr = await getConfig('bj_min', '1');
    const maxStr = await getConfig('bj_max', '50');
    const min = parseInt(minStr, 10);
    const max = parseInt(maxStr, 10);

    if (bet < min || bet > max) {
      return interaction.editReply({
        content: `❌ Bet must be between ${formatVP(min)} and ${formatVP(max)}.`,
      });
    }

    if (user.vp < bet) {
      return interaction.editReply({
        content: `❌ Insufficient balance. You need ${formatVP(bet)}, but you only have ${formatVP(user.vp)}.`,
      });
    }

    const gameState = createBlackjackGame(bet);

    const round = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { vp: { decrement: bet } },
      });

      return tx.blackjackRound.create({
        data: {
          userId: user.id,
          amount: bet,
          state: JSON.stringify(gameState),
        },
      });
    });

    registerActiveGame(userId, {
      roundId: round.id,
      timeoutId: null,
    });

    logBlackjackEvent('game.started', {
      userId,
      roundId: round.id,
      bet,
      guildId: interaction.guildId,
      channelId: guard.resolvedChannelId ?? interaction.channelId,
      isThread: guard.isThread,
    });

    if (isBlackjack(gameState.playerHand)) {
      if (isBlackjack(gameState.dealerHand)) {
        await resolveGame(interaction, round, gameState, user, { origin: 'instant_push' });
      } else {
        await resolveGame(interaction, round, gameState, user, { origin: 'instant_blackjack' });
      }
      return;
    }

    await showGameUI(interaction, round, gameState, user);

    const timeoutId = setTimeout(async () => {
      try {
        const currentRound = await prisma.blackjackRound.findUnique({
          where: { id: round.id },
          include: { user: true },
        });

        if (currentRound && !currentRound.result) {
          const state = JSON.parse(currentRound.state);
          state.playerStand = true;

          logBlackjackEvent('game.timeout', {
            userId,
            roundId: round.id,
          });

          try {
            await interaction.followUp({
              content: '⌛ No response detected in time. Auto-standing your hand.',
              ephemeral: true,
            });
          } catch (followUpError) {
            logBlackjackEvent('game.timeout.followup_error', {
              userId,
              roundId: round.id,
              error: followUpError.message,
            });
          }

          await resolveGame(interaction, currentRound, state, currentRound.user, {
            origin: 'timeout',
          });
        }
      } catch (error) {
        console.error('Error in blackjack timeout:', error);
        logBlackjackEvent('game.timeout.error', {
          userId,
          roundId: round.id,
          error: error.message,
        });
      }
    }, INACTIVITY_TIMEOUT_MS);

    const tracked = getActiveGame(userId);
    if (tracked) {
      tracked.timeoutId = timeoutId;
    } else {
      registerActiveGame(userId, { roundId: round.id, timeoutId });
    }
  } catch (error) {
    logBlackjackEvent('game.error', {
      userId,
      error: error.message,
    });
    clearActiveGame(userId);
    console.error('Error in blackjack command:', error);

    const payload = {
      content: '❌ Failed to start blackjack game. Please try again.',
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload);
    } else {
      await interaction.reply({ ...payload, ephemeral: true });
    }
  }
}

async function cancelBlackjack(interaction) {
  if (!interaction.guildId) {
    return interaction.reply({
      content: '❌ This command can only be used inside the server.',
      ephemeral: true,
    });
  }

  const userId = interaction.user.id;

  try {
    const activeRound = await prisma.blackjackRound.findFirst({
      where: {
        result: null,
        user: {
          discordId: userId,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });

    if (!activeRound) {
      clearActiveGame(userId);
      return interaction.reply({
        content: '✅ You do not have an active blackjack game.',
        ephemeral: true,
      });
    }

    clearActiveGame(userId);

    await prisma.$transaction(async (tx) => {
      await tx.blackjackRound.update({
        where: { id: activeRound.id },
        data: {
          result: 'cancelled',
        },
      });

      await tx.user.update({
        where: { id: activeRound.userId },
        data: { vp: { increment: activeRound.amount } },
      });
    });

    logBlackjackEvent('game.cancelled', {
      userId,
      roundId: activeRound.id,
    });

    return interaction.reply({
      content: '✅ Your blackjack game was cancelled and your bet was refunded.',
      ephemeral: true,
    });
  } catch (error) {
    logBlackjackEvent('game.cancel_error', {
      userId,
      error: error.message,
    });
    console.error('Error cancelling blackjack game:', error);

    if (interaction.replied || interaction.deferred) {
      return interaction.followUp({
        content: '❌ Failed to cancel your blackjack game. Please try again.',
        ephemeral: true,
      });
    }

    return interaction.reply({
      content: '❌ Failed to cancel your blackjack game. Please try again.',
      ephemeral: true,
    });
  }
}

async function showRules(interaction) {
  const minStr = await getConfig('bj_min', '1');
  const maxStr = await getConfig('bj_max', '50');

  const embed = new EmbedBuilder()
    .setColor(0x000000)
    .setTitle('♠️ Blackjack Rules')
    .setDescription('Welcome to the GUHD EATS Blackjack table!')
    .addFields(
      {
        name: '📊 Table Limits',
        value: `Min: ${formatVP(minStr)}\nMax: ${formatVP(maxStr)}`,
        inline: true,
      },
      { name: '💰 Payouts', value: 'Blackjack: 3:2\nWin: 1:1\nPush: Bet Returned', inline: true },
      {
        name: '🎴 Rules',
        value:
          '• Dealer hits on soft 17\n• Blackjack pays 3:2\n• Double down available\n• Split available (same value cards)',
        inline: false,
      },
      {
        name: '⏱️ Timeout',
        value: 'You have 60 seconds per action or the game will auto-stand.',
        inline: false,
      }
    )
    .setFooter({ text: 'Good luck at the tables!' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function showGameUI(interaction, round, gameState, user) {
  const playerValue = calculateHandValue(gameState.playerHand);
  const dealerValue = calculateHandValue([gameState.dealerHand[0]]);

  const embed = new EmbedBuilder()
    .setColor(0x000000)
    .setTitle('♠️ Blackjack')
    .addFields(
      {
        name: '🎴 Your Hand',
        value: `${formatHand(gameState.playerHand)}\n**Value:** ${playerValue}`,
        inline: false,
      },
      {
        name: '🃏 Dealer Hand',
        value: `${formatHand(gameState.dealerHand, true)}\n**Showing:** ${dealerValue}`,
        inline: false,
      },
      { name: '💰 Bet', value: formatVP(gameState.bet), inline: true },
      { name: '💵 Balance', value: formatVP(user.vp - gameState.bet), inline: true }
    )
    .setTimestamp();

  const row = new ActionRowBuilder();

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`bj_hit_${round.id}`)
      .setLabel('Hit')
      .setStyle(ButtonStyle.Primary)
  );

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`bj_stand_${round.id}`)
      .setLabel('Stand')
      .setStyle(ButtonStyle.Success)
  );

  // Double down only available on first two cards
  if (gameState.playerHand.length === 2 && user.vp >= gameState.bet) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`bj_double_${round.id}`)
        .setLabel('Double')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  // Split only available on matching pairs
  if (canSplit(gameState.playerHand) && user.vp >= gameState.bet && !gameState.split) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`bj_split_${round.id}`)
        .setLabel('Split')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true) // Simplified version doesn't support split yet
    );
  }

  await updateInteractionMessage(interaction, {
    embeds: [embed],
    components: [row],
  });
}

export async function handleBlackjackInteraction(interaction) {
  if (!interaction.isButton()) return;

  const customId = interaction.customId ?? '';
  if (!customId.startsWith('bj_')) return;

  const parts = customId.split('_');
  const action = parts[1];
  const roundId = parseInt(parts[2]);

  const guard = await ensureCasinoButtonContext(interaction);
  if (!guard.ok) {
    return;
  }

  try {
    const round = await prisma.blackjackRound.findUnique({
      where: { id: roundId },
      include: { user: true },
    });

    if (!round) {
      logBlackjackEvent('game.action.round_missing', {
        userId: interaction.user.id,
        roundId,
        action,
      });
      return interaction.reply({
        content: '❌ Game not found.',
        ephemeral: true,
      });
    }

    // Only the player can interact
    if (interaction.user.id !== round.user.discordId) {
      logBlackjackEvent('game.action.unauthorized', {
        userId: interaction.user.id,
        roundId,
        action,
      });
      return interaction.reply({
        content: '❌ This is not your game.',
        ephemeral: true,
      });
    }

    // Game already resolved
    if (round.result) {
      logBlackjackEvent('game.action.resolved_round', {
        userId: interaction.user.id,
        roundId,
        action,
        result: round.result,
      });
      return interaction.reply({
        content: '❌ This game has already ended.',
        ephemeral: true,
      });
    }

    await interaction.deferUpdate();

    let gameState = JSON.parse(round.state);

    logBlackjackEvent('game.action', {
      userId: interaction.user.id,
      roundId,
      action,
    });

    switch (action) {
      case 'hit':
        gameState = hit(gameState);

        // Check for bust
        if (isBust(gameState.playerHand)) {
          await resolveGame(interaction, round, gameState, round.user, { origin: 'player_bust' });
        } else {
          // Update state and show UI
          await prisma.blackjackRound.update({
            where: { id: roundId },
            data: { state: JSON.stringify(gameState) },
          });
          await showGameUI(interaction, round, gameState, round.user);
        }
        break;

      case 'stand':
        gameState.playerStand = true;
        await resolveGame(interaction, round, gameState, round.user, { origin: 'player_stand' });
        break;

      case 'double':
        // Check balance
        if (round.user.vp < gameState.bet) {
          return interaction.followUp({
            content: '❌ Insufficient balance to double down.',
            ephemeral: true,
          });
        }

        gameState = doubleDown(gameState);

        // Deduct additional bet
        await prisma.user.update({
          where: { id: round.user.id },
          data: { vp: { decrement: gameState.bet / 2 } },
        });

        await resolveGame(interaction, round, gameState, round.user, { origin: 'player_double' });
        break;
    }
  } catch (error) {
    console.error('Error handling blackjack button:', error);
    logBlackjackEvent('game.action_error', {
      userId: interaction.user.id,
      roundId,
      action,
      error: error.message,
    });
    await interaction.followUp({
      content: '❌ An error occurred. Please try again.',
      ephemeral: true,
    });
  }
}

async function resolveGame(interaction, round, gameState, user, options = {}) {
  const origin = options.origin ?? 'unknown';
  const userDiscordId = user.discordId ?? interaction.user?.id ?? null;

  if (userDiscordId) {
    clearActiveGame(userDiscordId);
  }

  logBlackjackEvent('game.resolve.start', {
    userId: userDiscordId,
    roundId: round.id,
    origin,
  });

  gameState = playDealer(gameState);

  const { result, payout } = determineResult(gameState);

  await prisma.$transaction(async (tx) => {
    await tx.blackjackRound.update({
      where: { id: round.id },
      data: {
        result,
        state: JSON.stringify(gameState),
      },
    });

    if (payout > 0) {
      await tx.user.update({
        where: { id: user.id },
        data: { vp: { increment: payout } },
      });
    }
  });

  const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });

  const playerValue = calculateHandValue(gameState.playerHand);
  const dealerValue = calculateHandValue(gameState.dealerHand);

  let color = 0xff0000;
  let title = '😔 You Lost';

  if (result === 'win') {
    color = 0x00ff00;
    title = '🎉 You Won!';
  } else if (result === 'blackjack') {
    color = 0xffd700;
    title = '♠️ BLACKJACK!';
  } else if (result === 'push') {
    color = 0xffff00;
    title = '🤝 Push';
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .addFields(
      {
        name: '🎴 Your Hand',
        value: `${formatHand(gameState.playerHand)}\n**Value:** ${playerValue}`,
        inline: false,
      },
      {
        name: '🃏 Dealer Hand',
        value: `${formatHand(gameState.dealerHand)}\n**Value:** ${dealerValue}`,
        inline: false,
      },
      { name: '💰 Bet', value: formatVP(gameState.bet), inline: true },
      { name: '💵 Payout', value: formatVP(payout), inline: true },
      { name: '💳 New Balance', value: formatVP(updatedUser.vp), inline: true }
    )
    .setTimestamp();

  await updateInteractionMessage(interaction, {
    embeds: [embed],
    components: [],
  });

  logBlackjackEvent('game.resolve.end', {
    userId: userDiscordId,
    roundId: round.id,
    origin,
    result,
    payout,
  });

  if (result !== 'lose') {
    await logTransaction('blackjack', {
      userId: userDiscordId,
      amount: gameState.bet,
      result,
      payout,
    });
  }
}
