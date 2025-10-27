import { MessageFlags } from 'discord.js';
import { getOrCreateUser, removeVP, addVP } from '../db/index.js';
import { 
  createRoulettePromptEmbed, 
  createSpinEmbed, 
  createResultEmbed, 
  createBettingButtons,
  createRouletteRulesEmbed,
  getNumberColor
} from './enhanced-ui.js';
import { animateRoulette } from './animation.js';
import { safeReply } from '../utils/interaction.js';
import { getRoulettePocket, recordRouletteOutcome } from '../lib/house-edge.js';
import { houseEdgeConfig } from '../config/casino.js';
import { formatVP } from '../lib/utils.js';

const ACTIVE_ROULETTE = new Map();

const PAYOUTS = {
  'number-0': 35,
  'number-1': 35, 'number-2': 35, 'number-3': 35, 'number-4': 35, 'number-5': 35,
  'number-6': 35, 'number-7': 35, 'number-8': 35, 'number-9': 35, 'number-10': 35,
  'number-11': 35, 'number-12': 35, 'number-13': 35, 'number-14': 35, 'number-15': 35,
  'number-16': 35, 'number-17': 35, 'number-18': 35, 'number-19': 35, 'number-20': 35,
  'number-21': 35, 'number-22': 35, 'number-23': 35, 'number-24': 35, 'number-25': 35,
  'number-26': 35, 'number-27': 35, 'number-28': 35, 'number-29': 35, 'number-30': 35,
  'number-31': 35, 'number-32': 35, 'number-33': 35, 'number-34': 35, 'number-35': 35,
  'number-36': 35,
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
      content: `❌ You need ${formatVP(amount)} VP, but you only have ${formatVP(user.vp)}.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const commandId = interaction.id;

  await interaction.deferReply();

  const displayName = formatDisplayName(interaction);
  const message = await interaction.editReply({
    embeds: [createRoulettePromptEmbed(displayName, amount)],
    components: createBettingButtons(commandId),
  });

  ACTIVE_ROULETTE.set(commandId, {
    userId,
    amount,
    messageId: message.id,
    channelId: message.channelId,
    displayName,
    vipScore: user.streakDays ?? 0,
    bets: {},
    selectedChip: 10,
    totalBet: 0
  });
}

export async function handleRouletteButton(interaction) {
  const customId = interaction.customId ?? '';
  if (!customId.startsWith('roulette_')) {
    return false;
  }

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

  try {
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

  // Deduct VP from user
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
  ACTIVE_ROULETTE.delete(state.commandId);

  const updateFrame = async ({ frame, caption }) => {
    await interaction.editReply({
      embeds: [createSpinEmbed(state.displayName, state.amount, frame, caption, state.bets)],
      components: [],
    });
  };

  // Determine winning number and color
  // Extract the primary bet type for house edge calculation
  const primaryBetType = Object.keys(state.bets)[0];
  let betDescriptor = {};
  
  if (primaryBetType?.startsWith('number-')) {
    const betNumber = parseInt(primaryBetType.split('-')[1]);
    betDescriptor = { numbers: [betNumber] };
  } else if (['red', 'black', 'green'].includes(primaryBetType)) {
    betDescriptor = { color: primaryBetType };
  }
  
  // Additional anti-exploitation: Check for suspicious betting patterns
  const suspiciousPatterns = checkSuspiciousBetting(state.bets);
  if (suspiciousPatterns.isSuspicious) {
    // Force a losing outcome for suspicious patterns
    const losingNumbers = getLosingNumbers(state.bets);
    if (losingNumbers.length > 0) {
      const randomLosingNumber = losingNumbers[Math.floor(Math.random() * losingNumbers.length)];
      const pocket = { number: randomLosingNumber, color: getNumberColor(randomLosingNumber) };
      
      // Skip normal house edge calculation and proceed to results
      await processResults(interaction, state, pocket);
      return;
    }
  }
  
  const pocket = getRoulettePocket({
    userId: state.userId,
    betAmount: state.totalBet,
    betDescriptor: betDescriptor,
    userProfile: { vipPoints: state.vipScore ?? 0 },
  });

  // Process the results using the extracted function
  await processResults(interaction, state, pocket);
}

function checkBetWin(betType, winningNumber, winningColor) {
  if (betType.startsWith('number-')) {
    const betNumber = parseInt(betType.split('-')[1]);
    return betNumber === winningNumber;
  }

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

/**
 * Check for suspicious betting patterns that could indicate exploitation
 */
function checkSuspiciousBetting(bets) {
  const betTypes = Object.keys(bets);
  const totalBetAmount = Object.values(bets).reduce((sum, val) => sum + val, 0);
  
  // Check for betting on both red and black (covers almost all numbers)
  const hasRed = bets['red'] > 0;
  const hasBlack = bets['black'] > 0;
  const hasGreen = bets['green'] > 0;
  
  // Check for betting on both even and odd
  const hasEven = bets['even'] > 0;
  const hasOdd = bets['odd'] > 0;
  
  // Check for betting on both 1-18 and 19-36
  const hasLow = bets['1-18'] > 0;
  const hasHigh = bets['19-36'] > 0;
  
  // Suspicious patterns
  const coversAllColors = hasRed && hasBlack && hasGreen;
  const coversAllParity = hasEven && hasOdd;
  const coversAllRanges = hasLow && hasHigh;
  
  // Check for betting on all dozens
  const hasAllDozens = bets['1st-12'] > 0 && bets['2nd-12'] > 0 && bets['3rd-12'] > 0;
  
  // Check for excessive coverage (betting on too many outcomes)
  const coverageCount = betTypes.length;
  const excessiveCoverage = coverageCount >= 8; // Arbitrary threshold
  
  return {
    isSuspicious: coversAllColors || coversAllParity || coversAllRanges || hasAllDozens || excessiveCoverage,
    patterns: {
      coversAllColors,
      coversAllParity,
      coversAllRanges,
      hasAllDozens,
      excessiveCoverage
    },
    coverageCount,
    totalBetAmount
  };
}

/**
 * Get numbers that would lose for the given bets
 */
function getLosingNumbers(bets) {
  const losingNumbers = [];
  
  for (let i = 0; i <= 36; i++) {
    let wouldLose = true;
    
    // Check if this number would win any bet
    for (const [betType, betAmount] of Object.entries(bets)) {
      if (betAmount > 0 && checkBetWin(betType, i, getNumberColor(i))) {
        wouldLose = false;
        break;
      }
    }
    
    if (wouldLose) {
      losingNumbers.push(i);
    }
  }
  
  return losingNumbers;
}

/**
 * Process game results (extracted for reuse)
 */
async function processResults(interaction, state, pocket) {
  // Animate the wheel
  const updateFrame = async ({ frame, caption }) => {
    await interaction.editReply({
      embeds: [createSpinEmbed(state.displayName, state.amount, frame, caption, state.bets)],
      components: [],
    });
  };

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
    amount: state.amount,
    winningNumber: pocket.number,
    winningColor: pocket.color,
    frame: `🎯 **${pocket.number}** ${getNumberColor(pocket.number) === 'red' ? '🔴' : getNumberColor(pocket.number) === 'black' ? '⚫' : '🟢'}`,
    didWin,
    net,
    chosenColor: Object.keys(state.bets)[0] || 'none',
    bets: state.bets,
    houseEdge: houseEdgeConfig.roulette.baseEdge,
  });

  await interaction.editReply({ embeds: [resultEmbed], components: [] });
}

async function updateRouletteUI(interaction, state) {
  const embed = createRoulettePromptEmbed(state.displayName, state.amount, state.bets);
  const components = createBettingButtons(state.commandId, state.selectedChip);

  await interaction.editReply({
    embeds: [embed],
    components: components,
  });
}

export async function showRouletteRules(interaction) {
  const embed = createRouletteRulesEmbed();
  await interaction.reply({ embeds: [embed] });
}
