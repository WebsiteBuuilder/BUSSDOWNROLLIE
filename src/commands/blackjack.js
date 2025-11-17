import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
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
import { canDoubleDown } from '../lib/house-edge.js';
import { 
  createGameUIEmbed, 
  createResultUIEmbed, 
  createActionButtons, 
  createRulesEmbed 
} from '../lib/blackjack-ui.js';

function ephemeral(options = {}) {
  const { flags, ...rest } = options ?? {};
  return {
    ...rest,
    flags: (flags ?? 0) | MessageFlags.Ephemeral,
  };
}

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
    return interaction.reply(
      ephemeral({
        content:
          '❌ You already have an active blackjack game. Use /blackjack cancel to end it first.',
      })
    );
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
    const min = parseInt(minStr, 10);

    if (bet < min) {
      return interaction.editReply({
        content: `❌ Bet must be at least ${formatVP(min)}.`,
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

    await showGameUI(interaction, round, gameState, user, gameState.hasPeeked || false);

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
            await interaction.followUp(
              ephemeral({
                content: '⌛ No response detected in time. Auto-standing your hand.',
              })
            );
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
      await interaction.reply(ephemeral(payload));
    }
  }
}

async function cancelBlackjack(interaction) {
  if (!interaction.guildId) {
    return interaction.reply(
      ephemeral({
        content: '❌ This command can only be used inside the server.',
      })
    );
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
      return interaction.reply(
        ephemeral({
          content: '✅ You do not have an active blackjack game.',
        })
      );
    }

    // Only the same user who started the game can cancel it
    if (activeRound.user.discordId !== userId) {
      return interaction.reply(
        ephemeral({
          content: '❌ You can only cancel your own blackjack game.',
        })
      );
    }

    clearActiveGame(userId);

    // Calculate half bet (rounded down)
    const halfBet = Math.floor(activeRound.amount / 2);
    const forfeitedAmount = halfBet;
    const refundAmount = activeRound.amount - halfBet;

    await prisma.$transaction(async (tx) => {
      await tx.blackjackRound.update({
        where: { id: activeRound.id },
        data: {
          result: 'cancelled',
        },
      });

      // Refund half the bet (player loses half)
      if (refundAmount > 0) {
        await tx.user.update({
          where: { id: activeRound.userId },
          data: { vp: { increment: refundAmount } },
        });
      }
    });

    logBlackjackEvent('game.cancelled', {
      userId,
      roundId: activeRound.id,
      forfeitedAmount,
    });

    return interaction.reply(
      ephemeral({
        content: `✅ Your blackjack game has been cancelled. You forfeited ${formatVP(forfeitedAmount)} (half your bet).`,
      })
    );
  } catch (error) {
    logBlackjackEvent('game.cancel_error', {
      userId,
      error: error.message,
    });
    console.error('Error cancelling blackjack game:', error);

    if (interaction.replied || interaction.deferred) {
      return interaction.followUp(
        ephemeral({
          content: '❌ Failed to cancel your blackjack game. Please try again.',
        })
      );
    }

    return interaction.reply(
      ephemeral({
        content: '❌ Failed to cancel your blackjack game. Please try again.',
      })
    );
  }
}

async function showRules(interaction) {
  const minStr = await getConfig('bj_min', '1');
  const min = parseInt(minStr, 10);

  const embed = createRulesEmbed(min);
  await interaction.reply({ embeds: [embed] });
}

async function showGameUI(interaction, round, gameState, user, hasPeeked = false) {
  const playerValue = calculateHandValue(gameState.playerHand);
  const dealerShowingValue = hasPeeked ? calculateHandValue(gameState.dealerHand) : calculateHandValue([gameState.dealerHand[0]]);

  const embed = createGameUIEmbed(gameState, user, playerValue, dealerShowingValue, hasPeeked);
  const row = createActionButtons(round, gameState, user, hasPeeked);

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
      return interaction.reply(
        ephemeral({
          content: '❌ Game not found.',
        })
      );
    }

    // Only the player can interact
    if (interaction.user.id !== round.user.discordId) {
      logBlackjackEvent('game.action.unauthorized', {
        userId: interaction.user.id,
        roundId,
        action,
      });
      return interaction.reply(
        ephemeral({
          content: '❌ This is not your game.',
        })
      );
    }

    // Game already resolved
    if (round.result) {
      logBlackjackEvent('game.action.resolved_round', {
        userId: interaction.user.id,
        roundId,
        action,
        result: round.result,
      });
      return interaction.reply(
        ephemeral({
          content: '❌ This game has already ended.',
        })
      );
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
          await showGameUI(interaction, round, gameState, round.user, gameState.hasPeeked || false);
        }
        break;

      case 'stand':
        gameState.playerStand = true;
        await resolveGame(interaction, round, gameState, round.user, { origin: 'player_stand' });
        break;

      case 'double':
        if (!canDoubleDown(gameState)) {
          return interaction.followUp(
            ephemeral({
              content: '❌ Double down is only available on your first move with totals of 9, 10, or 11.',
            })
          );
        }

        // Check balance
        if (round.user.vp < gameState.bet) {
          return interaction.followUp(
            ephemeral({
              content: '❌ Insufficient balance to double down.',
            })
          );
        }

        try {
          gameState = doubleDown(gameState);
        } catch (error) {
          if (error.message === 'DOUBLE_DOWN_UNAVAILABLE') {
            return interaction.followUp(
              ephemeral({
                content: '❌ Double down is only allowed before you hit and with totals of 9, 10, or 11.',
              })
            );
          }
          throw error;
        }

        // Deduct additional bet
        await prisma.user.update({
          where: { id: round.user.id },
          data: { vp: { decrement: gameState.bet / 2 } },
        });

        await resolveGame(interaction, round, gameState, round.user, { origin: 'player_double' });
        break;

      case 'peek':
        const peekCost = Math.max(1, Math.floor(gameState.bet * 0.1)); // 10% of bet, minimum 1 VP
        
        // Check if user has enough VP
        if (round.user.vp < peekCost) {
          return interaction.followUp(
            ephemeral({
              content: `❌ You need ${formatVP(peekCost)} VP to peek at the dealer's card.`,
            })
          );
        }

        // Check if already peeked
        if (gameState.hasPeeked) {
          return interaction.followUp(
            ephemeral({
              content: '❌ You have already peeked at the dealer\'s card.',
            })
          );
        }

        // Deduct peek cost
        await prisma.user.update({
          where: { id: round.user.id },
          data: { vp: { decrement: peekCost } },
        });

        // Mark as peeked
        gameState.hasPeeked = true;

        // Update state and show UI with peeked cards
        await prisma.blackjackRound.update({
          where: { id: roundId },
          data: { state: JSON.stringify(gameState) },
        });

        // Refresh user data after VP deduction
        const updatedUser = await prisma.user.findUnique({ where: { id: round.user.id } });
        await showGameUI(interaction, round, gameState, updatedUser, true);

        // Send confirmation message
        await interaction.followUp(
          ephemeral({
            content: `👁️ You peeked at the dealer's hole card for ${formatVP(peekCost)} VP!`,
          })
        );
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
    await interaction.followUp(
      ephemeral({
        content: '❌ An error occurred. Please try again.',
      })
    );
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

    // Handle push: return the full bet (no profit, no loss)
    if (result === 'push') {
      // Return the full bet amount (handles both regular and double-down cases)
      await tx.user.update({
        where: { id: user.id },
        data: { vp: { increment: gameState.bet } },
      });
    } else if (payout > 0) {
      // Win or blackjack: add payout
      await tx.user.update({
        where: { id: user.id },
        data: { vp: { increment: payout } },
      });
    }
    // Lose: payout is 0, no balance change needed (bet already deducted)
  });

  const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });

  const playerValue = calculateHandValue(gameState.playerHand);
  const dealerValue = calculateHandValue(gameState.dealerHand);

  const embed = createResultUIEmbed(gameState, user, playerValue, dealerValue, result, payout, updatedUser);

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
