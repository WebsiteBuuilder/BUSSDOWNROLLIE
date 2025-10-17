import { shuffle } from './utils.js';

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

/**
 * Calculate hand value
 */
export function calculateHandValue(hand) {
  let value = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.rank === 'A') {
      aces++;
      value += 11;
    } else if (['K', 'Q', 'J'].includes(card.rank)) {
      value += 10;
    } else {
      value += parseInt(card.rank);
    }
  }

  // Adjust for aces
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }

  return value;
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
export function formatHand(hand, hideFirst = false) {
  if (hideFirst) {
    return `🃏 ${hand.slice(1).map(formatCard).join(' ')}`;
  }
  return hand.map(formatCard).join(' ');
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
  const value = calculateHandValue(hand);

  if (value < 17) return true;
  if (value > 17) return false;

  // Check for soft 17 (hand value is 17 with an ace counted as 11)
  let hasAce = false;
  let total = 0;

  for (const card of hand) {
    if (card.rank === 'A') {
      hasAce = true;
      total += 11;
    } else if (['K', 'Q', 'J'].includes(card.rank)) {
      total += 10;
    } else {
      total += parseInt(card.rank);
    }
  }

  // If we have soft 17 (ace + 6), hit
  if (total === 17 && hasAce) return true;

  return false;
}

/**
 * Create initial game state
 */
export function createBlackjackGame(bet) {
  const deck = createDeck();

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
  };
}

/**
 * Hit - draw a card
 */
export function hit(state) {
  const card = state.deck.pop();
  state.playerHand.push(card);
  return state;
}

/**
 * Double down
 */
export function doubleDown(state) {
  state.bet *= 2;
  state.doubled = true;
  const card = state.deck.pop();
  state.playerHand.push(card);
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

  // Player bust
  if (isBust(state.playerHand)) {
    return { result: 'lose', payout: 0 };
  }

  // Player blackjack
  if (isBlackjack(state.playerHand) && !isBlackjack(state.dealerHand)) {
    return { result: 'blackjack', payout: Math.floor(state.bet * 2.5) }; // 3:2 payout
  }

  // Dealer bust
  if (isBust(state.dealerHand)) {
    return { result: 'win', payout: state.bet * 2 };
  }

  // Compare values
  if (playerValue > dealerValue) {
    return { result: 'win', payout: state.bet * 2 };
  } else if (dealerValue > playerValue) {
    return { result: 'lose', payout: 0 };
  } else {
    return { result: 'push', payout: state.bet }; // Return bet
  }
}
