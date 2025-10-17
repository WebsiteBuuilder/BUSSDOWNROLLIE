import { shuffle, randomInt } from './utils.js';

/**
 * Rock Paper Scissors Game
 */
export function createRPSGame() {
  return {
    type: 'rps',
    challengerChoice: null,
    opponentChoice: null,
  };
}

export function resolveRPS(challengerChoice, opponentChoice) {
  if (challengerChoice === opponentChoice) {
    return 'tie';
  }

  const wins = {
    rock: 'scissors',
    paper: 'rock',
    scissors: 'paper',
  };

  return wins[challengerChoice] === opponentChoice ? 'challenger' : 'opponent';
}

/**
 * High Card Game
 */
export function createHighCardGame() {
  const suits = ['♠️', '♥️', '♦️', '♣️'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ rank, suit, value: ranks.indexOf(rank) });
    }
  }

  const shuffled = shuffle(deck);

  return {
    type: 'highcard',
    challengerCard: shuffled[0],
    opponentCard: shuffled[1],
  };
}

export function resolveHighCard(game) {
  if (game.challengerCard.value > game.opponentCard.value) {
    return 'challenger';
  } else if (game.opponentCard.value > game.challengerCard.value) {
    return 'opponent';
  }
  return 'tie';
}

/**
 * Dice Duel Game
 */
export function createDiceGame() {
  const challengerRolls = [randomInt(1, 6), randomInt(1, 6)];
  const opponentRolls = [randomInt(1, 6), randomInt(1, 6)];

  const challengerTotal = challengerRolls.reduce((a, b) => a + b, 0);
  const opponentTotal = opponentRolls.reduce((a, b) => a + b, 0);

  return {
    type: 'dice',
    challengerRolls,
    opponentRolls,
    challengerTotal,
    opponentTotal,
  };
}

export function resolveDice(game) {
  if (game.challengerTotal > game.opponentTotal) {
    return 'challenger';
  } else if (game.opponentTotal > game.challengerTotal) {
    return 'opponent';
  }
  return 'tie';
}

/**
 * Hi-Lo Game
 */
export function createHiLoGame() {
  return {
    type: 'hilow',
    number: randomInt(1, 100),
    challengerChoice: null,
    opponentChoice: null,
  };
}

export function resolveHiLo(game) {
  // If number is exactly 50, it's a tie (reroll)
  if (game.number === 50) {
    return 'tie';
  }

  const isHigh = game.number > 50;

  // Challenger chose high
  if (game.challengerChoice === 'high') {
    return isHigh ? 'challenger' : 'opponent';
  } else {
    // Challenger chose low
    return isHigh ? 'opponent' : 'challenger';
  }
}

/**
 * Reaction Duel Game
 */
export function createReactionGame() {
  return {
    type: 'reaction',
    delay: randomInt(2000, 5000), // 2-5 seconds
    startTime: null,
    clickedAt: {
      challenger: null,
      opponent: null,
    },
  };
}

export function resolveReaction(game) {
  const challengerTime = game.clickedAt.challenger;
  const opponentTime = game.clickedAt.opponent;

  // Both missed or clicked too early
  if (!challengerTime && !opponentTime) {
    return 'tie';
  }

  // Only one clicked
  if (challengerTime && !opponentTime) {
    return 'challenger';
  }
  if (!challengerTime && opponentTime) {
    return 'opponent';
  }

  // Both clicked, compare times
  if (challengerTime < opponentTime) {
    return 'challenger';
  } else if (opponentTime < challengerTime) {
    return 'opponent';
  }

  return 'tie';
}

/**
 * Coin Flip Game
 */
export function createCoinFlipGame() {
  return {
    type: 'coinflip',
    flip: Math.random() < 0.5 ? 'heads' : 'tails',
  };
}

export function resolveCoinFlip(game) {
  return game.flip === 'heads' ? 'challenger' : 'opponent';
}

/**
 * Odd vs Even Game
 */
export function createOddEvenGame() {
  const number = randomInt(1, 10);
  return {
    type: 'oddeven',
    number,
  };
}

export function resolveOddEven(game) {
  return game.number % 2 === 1 ? 'challenger' : 'opponent';
}

/**
 * Archery Shootout Game
 */
export function createArcheryGame() {
  const challengerShots = Array.from({ length: 3 }, () => randomInt(1, 10));
  const opponentShots = Array.from({ length: 3 }, () => randomInt(1, 10));

  const challengerTotal = challengerShots.reduce((acc, value) => acc + value, 0);
  const opponentTotal = opponentShots.reduce((acc, value) => acc + value, 0);

  return {
    type: 'archery',
    challengerShots,
    opponentShots,
    challengerTotal,
    opponentTotal,
  };
}

export function resolveArchery(game) {
  if (game.challengerTotal > game.opponentTotal) {
    return 'challenger';
  }

  if (game.opponentTotal > game.challengerTotal) {
    return 'opponent';
  }

  return 'tie';
}

/**
 * Sprint Showdown Game
 */
export function createSprintGame() {
  const challengerTime = randomInt(800, 1600);
  const opponentTime = randomInt(800, 1600);

  return {
    type: 'sprint',
    challengerTime,
    opponentTime,
  };
}

export function resolveSprint(game) {
  if (game.challengerTime < game.opponentTime) {
    return 'challenger';
  }

  if (game.opponentTime < game.challengerTime) {
    return 'opponent';
  }

  return 'tie';
}

/**
 * Format card for display
 */
export function formatCard(card) {
  return `${card.rank}${card.suit}`;
}

/**
 * Get game display name
 */
export function getGameDisplayName(gameType) {
  const names = {
    rps: 'Rock Paper Scissors',
    highcard: 'High Card',
    dice: 'Dice Duel',
    hilow: 'Hi-Lo',
    reaction: 'Reaction Duel',
    coinflip: 'Coin Flip',
    oddeven: 'Odd vs Even',
    archery: 'Archery Shootout',
    sprint: 'Sprint Showdown',
  };
  return names[gameType] || gameType;
}
