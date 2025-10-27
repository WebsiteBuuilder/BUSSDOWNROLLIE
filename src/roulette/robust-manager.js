import { MessageFlags } from 'discord.js';
import { getOrCreateUser, removeVP, addVP } from '../db/index.js';
import { 
  createRoulettePromptEmbed, 
  createSpinEmbed,
  createCinematicSpinEmbed,
  createResultEmbed, 
  createBettingButtons,
  createRouletteRulesEmbed,
  getNumberColor
} from './simple-ui.js';
import { createDetailedRulesEmbed } from './lobby-ui.js';
import { 
  generateCinematicSpin, 
  validateCinematicAnimation,
  getAnimationStatus 
} from './safe-animation.js';
import { AttachmentBuilder } from 'discord.js';
import { safeReply, ackWithin3s } from '../utils/interaction.js';
import { getRoulettePocket, recordRouletteOutcome } from '../lib/house-edge.js';
import { houseEdgeConfig } from '../config/casino.js';
import { formatVP } from '../lib/utils.js';

const ACTIVE_ROULETTE = new Map();

const PAYOUTS = {
  'red': 2,
  'black': 2,
  'green': 35,
  'even': 2,
  'odd': 2,
  '1-18': 2,
  '19-36': 2,
  '1st-12': 2,
  '2nd-12': 2,
  '3rd-12': 2
};

function formatDisplayName(interaction) {
  return interaction.member?.displayName ?? interaction.user.username;
}

/**
 * Start roulette game directly (entry point for /roulette play)
 */
export async function startRoulette(interaction) {
  try {
    const userId = interaction.user.id;
    const user = await getOrCreateUser(userId);

    if (user.blacklisted) {
      await safeReply(interaction, {
        content: '🚫 You are not allowed to play roulette.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (user.vp < 1) {
      await safeReply(interaction, {
        content: `❌ You need at least 1 VP to play roulette, but you only have ${formatVP(user.vp)}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const displayName = formatDisplayName(interaction);
    const commandId = interaction.id;

    console.log(`🎰 Starting roulette for user ${userId}`);

    await interaction.deferReply();

    const message = await interaction.editReply({
      embeds: [createRoulettePromptEmbed(displayName, 0, {}, user.vp)],
      components: createBettingButtons(commandId),
    });

    ACTIVE_ROULETTE.set(commandId, {
      userId,
      messageId: message.id,
      channelId: message.channelId,
      displayName,
      vipScore: user.streakDays ?? 0,
      bets: {},
      selectedChip: 10,
      totalBet: 0
    });

    console.log(`✅ Roulette game started for ${displayName}`);
  } catch (error) {
    console.error('❌ Error starting roulette:', error);
    await safeReply(interaction, {
      content: '❌ Failed to start roulette. Please try again soon.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Handle all roulette button interactions
 */
export async function handleRouletteButton(interaction) {
  const customId = interaction.customId ?? '';
  console.log(`🎰 Button interaction: ${customId}`);

  if (!customId.startsWith('roulette_')) {
    return false;
  }

  const finishAckTimer = ackWithin3s(interaction, {
    game: 'roulette',
    customId,
    userId: interaction.user?.id,
  });

  try {
    const [, action, commandIdOrUserId, ...rawParams] = customId.split('_');
    const params = rawParams.filter(Boolean);
    const commandId = commandIdOrUserId;
    const state = ACTIVE_ROULETTE.get(commandId);

    if (!state) {
      console.log(`⚠️ No active roulette game found for commandId: ${commandId}`);
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ flags: MessageFlags.Ephemeral, content: '⏱️ This roulette game is no longer active.' });
      } else {
        await interaction.followUp({ flags: MessageFlags.Ephemeral, content: '⏱️ This roulette game is no longer active.' });
      }
      return true;
    }

    if (interaction.user.id !== state.userId) {
      console.log(`⚠️ Unauthorized interaction attempt by ${interaction.user.id} on game owned by ${state.userId}`);
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ flags: MessageFlags.Ephemeral, content: '🙅 Only the original player can interact with this game.' });
      } else {
        await interaction.followUp({ flags: MessageFlags.Ephemeral, content: '🙅 Only the original player can interact with this game.' });
      }
      return true;
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }

    console.log(`✅ Processing ${action} action for user ${interaction.user.username}`);

    switch (action) {
      case 'chip': {
        const chipValue = parseInt(params[0], 10);
        if (!Number.isNaN(chipValue)) {
          state.selectedChip = chipValue;
        }
        await updateBettingUI(interaction, state, commandId);
        console.log(`✅ Updated chip selection to ${state.selectedChip} VP`);
        break;
      }

      case 'bet': {
        const betType = params.join('_');
        await placeBet(interaction, state, betType, commandId);
        break;
      }

      case 'spin': {
        await spinWheel(interaction, state, commandId);
        break;
      }

      case 'clear': {
        if (state.totalBet > 0) {
          await addVP(state.userId, state.totalBet);
        }
        state.bets = {};
        state.totalBet = 0;
        await updateBettingUI(interaction, state, commandId);
        console.log(`✅ Cleared all bets for ${interaction.user.username}`);
        break;
      }

      default: {
        console.log(`⚠️ Unknown action: ${action}`);
        await interaction.followUp({ flags: MessageFlags.Ephemeral, content: '❌ Unknown action.' });
      }
    }
  } catch (error) {
    console.error('❌ Roulette button error:', error);

    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ flags: MessageFlags.Ephemeral, content: '❌ An error occurred. Please try again.' });
      } else {
        await interaction.followUp({ flags: MessageFlags.Ephemeral, content: '❌ An error occurred. Please try again.' });
      }
    } catch (followUpError) {
      console.error('❌ Failed to send error message:', followUpError);
    }
  } finally {
    finishAckTimer();
  }

  return true;
}

async function placeBet(interaction, state, betType, commandId) {
  try {
    const user = await getOrCreateUser(state.userId);
    
    if (user.vp < state.selectedChip) {
      console.log(`⚠️ Insufficient VP: user has ${user.vp}, needs ${state.selectedChip}`);
      await interaction.followUp({
        flags: MessageFlags.Ephemeral,
        content: `❌ You need ${formatVP(state.selectedChip)} VP to place this bet, but you only have ${formatVP(user.vp)}.`
      });
      return;
    }

    // Add bet to state
    if (!state.bets[betType]) {
      state.bets[betType] = 0;
    }
    state.bets[betType] += state.selectedChip;
    state.totalBet += state.selectedChip;

    console.log(`💰 Bet placed: ${betType} for ${state.selectedChip} VP (Total: ${state.totalBet} VP)`);

    // Deduct VP from user immediately
    await removeVP(state.userId, state.selectedChip);

    // Fetch updated balance
    const updatedUser = await getOrCreateUser(state.userId);
    await updateBettingUI(interaction, state, commandId, updatedUser.vp);
  } catch (error) {
    console.error('❌ Error placing bet:', error);
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: '❌ Failed to place bet. Please try again.' });
  }
}

async function spinWheel(interaction, state, commandId) {
  if (state.totalBet === 0) {
    console.log('⚠️ Attempted to spin with no bets placed');
    await interaction.followUp({
      flags: MessageFlags.Ephemeral,
      content: '❌ You must place at least one bet before spinning!'
    });
    return;
  }

  console.log(`🎡 Spinning wheel for ${state.displayName} with bets totaling ${state.totalBet} VP`);

  // Remove the game from active games
  ACTIVE_ROULETTE.delete(commandId);

  // Determine winning number
  const primaryBetType = Object.keys(state.bets)[0];
  let betDescriptor = {};
  
  if (['red', 'black', 'green'].includes(primaryBetType)) {
    betDescriptor = { color: primaryBetType };
  }

  const pocket = getRoulettePocket({
    userId: state.userId,
    betAmount: state.totalBet,
    betDescriptor: betDescriptor,
    userProfile: { vipPoints: state.vipScore ?? 0 },
  });

  console.log(`🎯 Winning number: ${pocket.number} (${pocket.color})`);

  // Animate the wheel with cinematic effects (NO FALLBACK)
  try {
    console.log(`🎬 Generating cinematic spin animation...`);
    
    const gifBuffer = await generateCinematicSpin(pocket.number, {
      duration: 4000,
      fps: 30,
      quality: 10
    });
    
    const attachment = new AttachmentBuilder(gifBuffer, { 
      name: 'roulette-spin.gif',
      description: `STILL GUUHHHD Roulette - Number ${pocket.number}`
    });

    await interaction.editReply({
      embeds: [createCinematicSpinEmbed(state.displayName, state.totalBet)],
      files: [attachment],
      components: []
    });

    await new Promise(resolve => setTimeout(resolve, 4000));
    console.log('✅ Cinematic animation completed successfully');
    
  } catch (cinematicError) {
    console.error('❌ CRITICAL: Cinematic animation failed');
    console.error(`   Error: ${cinematicError.message}`);
    console.error(`   Stack: ${cinematicError.stack}`);
    
    // Return VP to user and show error
    if (state.totalBet > 0) {
      await addVP(state.userId, state.totalBet);
      console.log(`💰 Refunded ${state.totalBet} VP to user ${state.userId}`);
    }
    ACTIVE_ROULETTE.delete(commandId);
    
    await interaction.editReply({
      content: '❌ **Roulette Animation System Error**\n\n' +
               'The cinematic wheel renderer encountered a critical error and could not display the animation.\n\n' +
               `🔄 **Your bet of ${formatVP(state.totalBet)} has been fully refunded.**\n\n` +
               '⚠️ This is a system issue. Please contact an administrator if this persists.',
      embeds: [],
      components: []
    });
    
    return; // Exit early, don't show results
  }

  // Calculate winnings
  let totalWinnings = 0;
  let didWin = false;

  for (const [betType, betAmount] of Object.entries(state.bets)) {
    const won = checkBetWin(betType, pocket.number, pocket.color);
    if (won) {
      const multiplier = PAYOUTS[betType] || 2;
      totalWinnings += betAmount * multiplier;
      didWin = true;
      console.log(`✅ Bet ${betType} won! Payout: ${betAmount} × ${multiplier} = ${betAmount * multiplier} VP`);
    }
  }

  const net = totalWinnings - state.totalBet;
  console.log(`💰 Final payout: ${didWin ? '+' : ''}${net} VP (Total winnings: ${totalWinnings} VP)`);

  if (totalWinnings > 0) {
    await addVP(state.userId, totalWinnings);
  }

  recordRouletteOutcome(state.userId, didWin);

  // Fetch updated balance
  const updatedUser = await getOrCreateUser(state.userId);

  const resultEmbed = createResultEmbed({
    displayName: state.displayName,
    winningNumber: pocket.number,
    winningColor: pocket.color,
    frame: `🎯 **${pocket.number}** ${getNumberColor(pocket.number) === 'red' ? '🔴' : getNumberColor(pocket.number) === 'black' ? '⚫' : '🟢'}`,
    didWin,
    net,
    bets: state.bets,
    houseEdge: houseEdgeConfig.roulette.baseEdge,
    totalWon: totalWinnings,
    totalBet: state.totalBet,
    newBalance: updatedUser.vp
  });

  await interaction.editReply({ 
    embeds: [resultEmbed], 
    components: [], // No buttons - simplified flow
    files: []
  });

  console.log(`✅ Roulette game completed for ${state.displayName}`);
}

function checkBetWin(betType, winningNumber, winningColor) {
  switch (betType) {
    case 'red':
      return winningColor === 'red';
    case 'black':
      return winningColor === 'black';
    case 'green':
      return winningColor === 'green';
    case 'even':
      return winningNumber !== 0 && winningNumber % 2 === 0;
    case 'odd':
      return winningNumber % 2 === 1;
    case '1-18':
      return winningNumber >= 1 && winningNumber <= 18;
    case '19-36':
      return winningNumber >= 19 && winningNumber <= 36;
    case '1st-12':
      return winningNumber >= 1 && winningNumber <= 12;
    case '2nd-12':
      return winningNumber >= 13 && winningNumber <= 24;
    case '3rd-12':
      return winningNumber >= 25 && winningNumber <= 36;
    default:
      return false;
  }
}

async function updateBettingUI(interaction, state, commandId, currentBalance = null) {
  try {
    if (currentBalance === null) {
      const user = await getOrCreateUser(state.userId);
      currentBalance = user.vp;
    }

    const embed = createRoulettePromptEmbed(state.displayName, state.totalBet, state.bets, currentBalance);
    const components = createBettingButtons(commandId, state.selectedChip);

    await interaction.editReply({
      embeds: [embed],
      components: components,
    });
  } catch (error) {
    console.error('❌ Error updating betting UI:', error);
    // Attempt to recover
    try {
      await interaction.editReply({
        content: '⚠️ There was an error updating the UI. Please try again.',
        embeds: [],
        components: []
      });
    } catch (recoverError) {
      console.error('❌ Failed to recover from UI error:', recoverError);
    }
  }
}

export async function showRouletteRules(interaction) {
  try {
    const embed = createDetailedRulesEmbed();
    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('❌ Error showing roulette rules:', error);
    await interaction.reply({ content: '❌ Failed to load rules. Please try again.', flags: MessageFlags.Ephemeral });
  }
}
