import { MessageFlags } from 'discord.js';
import { getOrCreateUser, removeVP, addVP } from '../db/index.js';
import { 
  createRoulettePromptEmbed, 
  createSpinEmbed, 
  createResultEmbed, 
  createBettingButtons,
  createRouletteRulesEmbed,
  getNumberColor
} from './simple-ui.js';
import { animateRoulette } from './animation.js';
import { safeReply } from '../utils/interaction.js';
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

    const commandId = interaction.id;
    
    await interaction.deferReply();

    const displayName = formatDisplayName(interaction);
    const message = await interaction.editReply({
      embeds: [createRoulettePromptEmbed(displayName, 0)],
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
  } catch (error) {
    console.error('Error starting roulette:', error);
    await safeReply(interaction, {
      content: '❌ Failed to start roulette. Please try again soon.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

export async function handleRouletteButton(interaction) {
  const customId = interaction.customId ?? '';
  if (!customId.startsWith('roulette_')) {
    return false;
  }

  try {
    const [, action, commandId, ...params] = customId.split('_');
    const state = ACTIVE_ROULETTE.get(commandId);

    if (!state) {
      await interaction.reply({ ephemeral: true, content: '⏱️ This roulette game is no longer active.' });
      return true;
    }

    if (interaction.user.id !== state.userId) {
      await interaction.reply({ ephemeral: true, content: '🙅 Only the original player can interact with this game.' });
      return true;
    }

    await interaction.deferUpdate();

    switch (action) {
      case 'chip':
        // Change selected chip value
        const chipValue = parseInt(params[0]);
        state.selectedChip = chipValue;
        await updateRouletteUI(interaction, state);
        break;

      case 'bet':
        // Place a bet
        const betType = params.join('_');
        await placeBet(interaction, state, betType);
        break;

      case 'spin':
        // Spin the wheel
        await spinWheel(interaction, state);
        break;

      case 'clear':
        // Clear all bets
        state.bets = {};
        state.totalBet = 0;
        await updateRouletteUI(interaction, state);
        break;

      default:
        await interaction.followUp({ ephemeral: true, content: '❌ Unknown action.' });
    }
  } catch (error) {
    console.error('Roulette button error:', error);
    await interaction.followUp({ ephemeral: true, content: '❌ An error occurred. Please try again.' });
  }

  return true;
}

async function placeBet(interaction, state, betType) {
  const user = await getOrCreateUser(state.userId);
  
  if (user.vp < state.selectedChip) {
    await interaction.followUp({ 
      ephemeral: true, 
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

  // Deduct VP from user immediately
  await removeVP(state.userId, state.selectedChip);

  await updateRouletteUI(interaction, state);
}

async function spinWheel(interaction, state) {
  if (state.totalBet === 0) {
    await interaction.followUp({ 
      ephemeral: true, 
      content: '❌ You must place at least one bet before spinning!' 
    });
    return;
  }

  // Remove the game from active games
  const commandId = interaction.customId.split('_')[2];
  ACTIVE_ROULETTE.delete(commandId);

  const updateFrame = async ({ frame, caption }) => {
    await interaction.editReply({
      embeds: [createSpinEmbed(state.displayName, frame, caption, state.totalBet)],
      components: [],
    });
  };

  // Determine winning number and color
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

  // Animate the wheel
  await animateRoulette(updateFrame, `🎯 **${pocket.number}** ${getNumberColor(pocket.number) === 'red' ? '🔴' : getNumberColor(pocket.number) === 'black' ? '⚫' : '🟢'}`);

  // Calculate winnings
  let totalWinnings = 0;
  let didWin = false;

  for (const [betType, betAmount] of Object.entries(state.bets)) {
    const won = checkBetWin(betType, pocket.number, pocket.color);
    if (won) {
      const multiplier = PAYOUTS[betType] || 2;
      totalWinnings += betAmount * multiplier;
      didWin = true;
    }
  }

  const net = totalWinnings - state.totalBet;

  if (totalWinnings > 0) {
    await addVP(state.userId, totalWinnings);
  }

  recordRouletteOutcome(state.userId, didWin);

  const resultEmbed = createResultEmbed({
    displayName: state.displayName,
    winningNumber: pocket.number,
    winningColor: pocket.color,
    frame: `🎯 **${pocket.number}** ${getNumberColor(pocket.number) === 'red' ? '🔴' : getNumberColor(pocket.number) === 'black' ? '⚫' : '🟢'}`,
    didWin,
    net,
    bets: state.bets,
    houseEdge: houseEdgeConfig.roulette.baseEdge,
  });

  await interaction.editReply({ embeds: [resultEmbed], components: [] });
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

async function updateRouletteUI(interaction, state) {
  const embed = createRoulettePromptEmbed(state.displayName, state.totalBet, state.bets);
  const commandId = interaction.customId.split('_')[2];
  const components = createBettingButtons(commandId, state.selectedChip);

  await interaction.editReply({
    embeds: [embed],
    components: components,
  });
}

export async function showRouletteRules(interaction) {
  const embed = createRouletteRulesEmbed();
  await interaction.reply({ embeds: [embed] });
}
