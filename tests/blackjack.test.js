import { describe, it, expect } from 'vitest';
import {
  createDeck,
  createShoe,
  calculateHandValue,
  formatCard,
  formatHand,
  isBlackjack,
  isBust,
  canSplit,
  shouldDealerHit,
  createBlackjackGame,
} from '../src/lib/blackjack.js';
import { houseEdgeConfig } from '../src/config/casino.js';

describe('Blackjack Engine', () => {
  describe('createDeck', () => {
    it('should create 52-card deck', () => {
      const deck = createDeck();
      expect(deck).toHaveLength(52);
    });

    it('should have all suits and ranks', () => {
      const deck = createDeck();
      const suits = new Set(deck.map((card) => card.suit));
      const ranks = new Set(deck.map((card) => card.rank));

      expect(suits.size).toBe(4);
      expect(ranks.size).toBe(13);
    });
  });

  describe('calculateHandValue', () => {
    it('should calculate number cards correctly', () => {
      const hand = [
        { rank: '5', suit: '♠️' },
        { rank: '7', suit: '♥️' },
      ];
      expect(calculateHandValue(hand)).toBe(12);
    });

    it('should count face cards as 10', () => {
      const hand = [
        { rank: 'K', suit: '♠️' },
        { rank: 'Q', suit: '♥️' },
      ];
      expect(calculateHandValue(hand)).toBe(20);
    });

    it('should count ace as 11 when possible', () => {
      const hand = [
        { rank: 'A', suit: '♠️' },
        { rank: '9', suit: '♥️' },
      ];
      expect(calculateHandValue(hand)).toBe(20);
    });

    it('should count ace as 1 to avoid bust', () => {
      const hand = [
        { rank: 'A', suit: '♠️' },
        { rank: 'K', suit: '♥️' },
        { rank: '5', suit: '♦️' },
      ];
      expect(calculateHandValue(hand)).toBe(16);
    });

    it('should handle multiple aces', () => {
      const hand = [
        { rank: 'A', suit: '♠️' },
        { rank: 'A', suit: '♥️' },
        { rank: '9', suit: '♦️' },
      ];
      expect(calculateHandValue(hand)).toBe(21);
    });
  });

  describe('formatCard', () => {
    it('should format card with rank and suit', () => {
      expect(formatCard({ rank: 'A', suit: '♠️' })).toBe('A♠️');
      expect(formatCard({ rank: '10', suit: '♥️' })).toBe('10♥️');
    });
  });

  describe('formatHand', () => {
    it('should format visible hand', () => {
      const hand = [
        { rank: 'A', suit: '♠️' },
        { rank: 'K', suit: '♥️' },
      ];
      expect(formatHand(hand)).toBe('A♠️ K♥️');
    });

    it('should hide first card when specified', () => {
      const hand = [
        { rank: 'A', suit: '♠️' },
        { rank: 'K', suit: '♥️' },
        { rank: '5', suit: '♦️' },
      ];
      expect(formatHand(hand, true)).toContain('🃏');
      expect(formatHand(hand, true)).toContain('K♥️');
    });
  });

  describe('isBlackjack', () => {
    it('should detect blackjack (A + 10-value)', () => {
      const hand1 = [
        { rank: 'A', suit: '♠️' },
        { rank: 'K', suit: '♥️' },
      ];
      expect(isBlackjack(hand1)).toBe(true);

      const hand2 = [
        { rank: 'A', suit: '♠️' },
        { rank: '10', suit: '♥️' },
      ];
      expect(isBlackjack(hand2)).toBe(true);
    });

    it('should not detect blackjack with more than 2 cards', () => {
      const hand = [
        { rank: 'A', suit: '♠️' },
        { rank: '5', suit: '♥️' },
        { rank: '5', suit: '♦️' },
      ];
      expect(isBlackjack(hand)).toBe(false);
    });

    it('should not detect blackjack for 21 without ace', () => {
      const hand = [
        { rank: 'K', suit: '♠️' },
        { rank: 'Q', suit: '♥️' },
      ];
      expect(isBlackjack(hand)).toBe(false);
    });
  });

  describe('isBust', () => {
    it('should detect bust over 21', () => {
      const hand = [
        { rank: 'K', suit: '♠️' },
        { rank: 'Q', suit: '♥️' },
        { rank: '5', suit: '♦️' },
      ];
      expect(isBust(hand)).toBe(true);
    });

    it('should not detect bust at 21 or below', () => {
      const hand1 = [
        { rank: 'K', suit: '♠️' },
        { rank: 'Q', suit: '♥️' },
        { rank: 'A', suit: '♦️' },
      ];
      expect(isBust(hand1)).toBe(false);

      const hand2 = [
        { rank: '5', suit: '♠️' },
        { rank: '7', suit: '♥️' },
      ];
      expect(isBust(hand2)).toBe(false);
    });
  });

  describe('canSplit', () => {
    it('should allow split for matching pairs', () => {
      const hand1 = [
        { rank: '8', suit: '♠️' },
        { rank: '8', suit: '♥️' },
      ];
      expect(canSplit(hand1)).toBe(true);

      const hand2 = [
        { rank: 'K', suit: '♠️' },
        { rank: 'Q', suit: '♥️' },
      ];
      expect(canSplit(hand2)).toBe(true); // Both worth 10
    });

    it('should not allow split for non-matching cards', () => {
      const hand = [
        { rank: '5', suit: '♠️' },
        { rank: '7', suit: '♥️' },
      ];
      expect(canSplit(hand)).toBe(false);
    });

    it('should not allow split with more than 2 cards', () => {
      const hand = [
        { rank: '8', suit: '♠️' },
        { rank: '8', suit: '♥️' },
        { rank: '8', suit: '♦️' },
      ];
      expect(canSplit(hand)).toBe(false);
    });
  });

  describe('shouldDealerHit', () => {
    it('should hit below 17', () => {
      const hand = [
        { rank: '10', suit: '♠️' },
        { rank: '5', suit: '♥️' },
      ];
      expect(shouldDealerHit(hand)).toBe(true);
    });

    it('should stand on hard 17+', () => {
      const hand = [
        { rank: '10', suit: '♠️' },
        { rank: '7', suit: '♥️' },
      ];
      expect(shouldDealerHit(hand)).toBe(false);
    });

    it('should stand on soft 17 when configured', () => {
      const hand = [
        { rank: 'A', suit: '♠️' },
        { rank: '6', suit: '♥️' },
      ];
      expect(shouldDealerHit(hand)).toBe(false);
    });
  });

  describe('createBlackjackGame', () => {
    it('should create initial game state', () => {
      const game = createBlackjackGame(10);

      expect(game.deck).toBeDefined();
      expect(game.playerHand).toHaveLength(2);
      expect(game.dealerHand).toHaveLength(2);
      expect(game.bet).toBe(10);
      expect(game.doubled).toBe(false);
      expect(game.playerStand).toBe(false);
      expect(game.turns).toBe(0);
      expect(typeof game.cachedPlayerValue).toBe('number');
    });

    it('should draw from deck', () => {
      const game = createBlackjackGame(10);
      const initialDeckSize = game.deck.length;

      const expected = houseEdgeConfig.blackjack.deckCount * 52 - 4;
      expect(initialDeckSize).toBe(expected);
    });
  });

  describe('createShoe', () => {
    it('should respect deck count', () => {
      const shoe = createShoe(2);
      expect(shoe).toHaveLength(104);
    });
  });
});
