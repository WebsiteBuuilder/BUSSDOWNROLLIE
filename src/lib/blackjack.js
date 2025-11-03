import { shuffle } from './utils.js';
import { houseEdgeConfig } from '../config/casino.js';
import { canDoubleDown as canDoubleDownAccordingToHouse } from './house-edge.js';

function evaluateHand(hand) {
  let value = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.rank === 'A') {
      aces += 1;
      value += 11;
    } else if (['K', 'Q', 'J'].includes(card.rank)) {
      value += 10;
    } else {
      value += parseInt(card.rank, 10);
    }
  }

  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }

  const isSoft = aces > 0;
  return { value, isSoft };
}

/**
 * Create a new deck of cards
 */
export function createDeck() {
  const suits = ['♠️', '♥️', '♦️', '♣️'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ rank, suit });
    }
  }

  return shuffle(deck);
}

export function createShoe(deckCount = houseEdgeConfig.blackjack.deckCount) {
  const shoe = [];
  for (let index = 0; index < deckCount; index += 1) {
    shoe.push(...createDeck());
  }
  return shuffle(shoe);
}

/**
 * Calculate hand value
 */
export function calculateHandValue(hand) {
  return evaluateHand(hand).value;
}

/**
 * Format card for display
 */
export function formatCard(card) {
  return `${card.rank}${card.suit}`;
}

/**
 * Format hand for display
 */
export function formatHand(hand, hideHoleCard = false) {
  if (!hideHoleCard) {
    return hand.map(formatCard).join(' ');
  }

  return hand
    .map((card, index) => {
      if (index === 1) {
        return '🃏';
      }

      return formatCard(card);
    })
    .join(' ')
    .trim();
}

/**
 * Check if hand is blackjack
 */
export function isBlackjack(hand) {
  return hand.length === 2 && calculateHandValue(hand) === 21;
}

/**
 * Check if hand is bust
 */
export function isBust(hand) {
  return calculateHandValue(hand) > 21;
}

/**
 * Check if hand can be split
 */
export function canSplit(hand) {
  if (hand.length !== 2) return false;

  const value1 =
    hand[0].rank === 'A'
      ? 11
      : ['K', 'Q', 'J'].includes(hand[0].rank)
        ? 10
        : parseInt(hand[0].rank);
  const value2 =
    hand[1].rank === 'A'
      ? 11
      : ['K', 'Q', 'J'].includes(hand[1].rank)
        ? 10
        : parseInt(hand[1].rank);

  return value1 === value2;
}

/**
 * Dealer AI - hits on soft 17
 */
export function shouldDealerHit(hand) {
  const { value, isSoft } = evaluateHand(hand);

  if (value < 17) return true;
  if (value > 17) return false;

  if (value === 17 && isSoft) {
    return !houseEdgeConfig.blackjack.dealerAdvantage.standOnSoft17;
  }

  return false;
}

/**
 * Create initial game state
 */
export function createBlackjackGame(bet) {
  const deck = createShoe();

  const playerHand = [deck.pop(), deck.pop()];
  const dealerHand = [deck.pop(), deck.pop()];

  return {
    deck,
    playerHand,
    dealerHand,
    bet,
    doubled: false,
    split: false,
    playerStand: false,
    turns: 0,
    cachedPlayerValue: calculateHandValue(playerHand),
    penetrationIndex: Math.floor(deck.length * houseEdgeConfig.blackjack.shufflePoint),
  };
}

/**
 * Hit - draw a card
 */
export function hit(state) {
  const card = state.deck.pop();
  state.playerHand.push(card);
  state.turns = (state.turns ?? 0) + 1;
  state.cachedPlayerValue = calculateHandValue(state.playerHand);
  return state;
}

/**
 * Double down
 */
export function doubleDown(state) {
  state.cachedPlayerValue = calculateHandValue(state.playerHand);
  if (!canDoubleDownAccordingToHouse(state)) {
    throw new Error('DOUBLE_DOWN_UNAVAILABLE');
  }

  state.bet *= 2;
  state.doubled = true;
  const card = state.deck.pop();
  state.playerHand.push(card);
  state.turns = (state.turns ?? 0) + 1;
  state.cachedPlayerValue = calculateHandValue(state.playerHand);
  state.playerStand = true; // Automatically stand after double
  return state;
}

/**
 * Dealer plays
 */
export function playDealer(state) {
  while (shouldDealerHit(state.dealerHand)) {
    const card = state.deck.pop();
    state.dealerHand.push(card);
  }
  return state;
}

/**
 * Determine game result
 */
export function determineResult(state) {
  const playerValue = calculateHandValue(state.playerHand);
  const dealerValue = calculateHandValue(state.dealerHand);
  const playerBlackjack = isBlackjack(state.playerHand);
  const dealerBlackjack = isBlackjack(state.dealerHand);

  // Player bust
  if (isBust(state.playerHand)) {
    return { result: 'lose', payout: 0 };
  }

  // Player blackjack
  if (playerBlackjack && !dealerBlackjack) {
    return {
      result: 'blackjack',
      payout: Math.floor(state.bet * (1 + houseEdgeConfig.blackjack.dealerAdvantage.blackjackPayout)),
    };
  }

  // Dealer bust
  if (isBust(state.dealerHand)) {
    return { result: 'win', payout: state.bet * 2 };
  }

  // Compare values
  if (playerValue > dealerValue) {
    return { result: 'win', payout: state.bet * 2 };
  }

  if (dealerValue > playerValue) {
    return { result: 'lose', payout: 0 };
  }

  if (playerBlackjack && dealerBlackjack) {
    return { result: 'push', payout: state.bet };
  }

  if (houseEdgeConfig.blackjack.dealerAdvantage.pushRule === 'dealerWins') {
    return { result: 'dealer_push', payout: 0 };
  }

  return { result: 'push', payout: state.bet };
}
