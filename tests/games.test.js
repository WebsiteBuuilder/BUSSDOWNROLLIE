import { describe, it, expect } from 'vitest';
import {
  createRPSGame,
  resolveRPS,
  createHighCardGame,
  resolveHighCard,
  createDiceGame,
  resolveDice,
  createHiLoGame,
  resolveHiLo,
  getGameDisplayName
} from '../src/lib/games.js';

describe('Game Engines', () => {
  describe('Rock Paper Scissors', () => {
    it('should create initial game state', () => {
      const game = createRPSGame();
      expect(game.type).toBe('rps');
      expect(game.challengerChoice).toBeNull();
      expect(game.opponentChoice).toBeNull();
    });

    it('should resolve winner correctly', () => {
      expect(resolveRPS('rock', 'scissors')).toBe('challenger');
      expect(resolveRPS('paper', 'rock')).toBe('challenger');
      expect(resolveRPS('scissors', 'paper')).toBe('challenger');
      
      expect(resolveRPS('scissors', 'rock')).toBe('opponent');
      expect(resolveRPS('rock', 'paper')).toBe('opponent');
      expect(resolveRPS('paper', 'scissors')).toBe('opponent');
    });

    it('should detect ties', () => {
      expect(resolveRPS('rock', 'rock')).toBe('tie');
      expect(resolveRPS('paper', 'paper')).toBe('tie');
      expect(resolveRPS('scissors', 'scissors')).toBe('tie');
    });
  });

  describe('High Card', () => {
    it('should create game with two cards', () => {
      const game = createHighCardGame();
      expect(game.type).toBe('highcard');
      expect(game.challengerCard).toBeDefined();
      expect(game.opponentCard).toBeDefined();
      expect(game.challengerCard.rank).toBeDefined();
      expect(game.challengerCard.suit).toBeDefined();
    });

    it('should resolve based on card values', () => {
      const game1 = {
        challengerCard: { rank: 'A', suit: '♠️', value: 12 },
        opponentCard: { rank: 'K', suit: '♥️', value: 11 }
      };
      expect(resolveHighCard(game1)).toBe('challenger');

      const game2 = {
        challengerCard: { rank: '5', suit: '♦️', value: 3 },
        opponentCard: { rank: '10', suit: '♣️', value: 8 }
      };
      expect(resolveHighCard(game2)).toBe('opponent');

      const game3 = {
        challengerCard: { rank: 'Q', suit: '♠️', value: 10 },
        opponentCard: { rank: 'Q', suit: '♥️', value: 10 }
      };
      expect(resolveHighCard(game3)).toBe('tie');
    });
  });

  describe('Dice Duel', () => {
    it('should create game with dice rolls', () => {
      const game = createDiceGame();
      expect(game.type).toBe('dice');
      expect(game.challengerRolls).toHaveLength(2);
      expect(game.opponentRolls).toHaveLength(2);
      expect(game.challengerTotal).toBeGreaterThanOrEqual(2);
      expect(game.challengerTotal).toBeLessThanOrEqual(12);
    });

    it('should resolve based on totals', () => {
      const game1 = {
        challengerRolls: [6, 6],
        opponentRolls: [1, 1],
        challengerTotal: 12,
        opponentTotal: 2
      };
      expect(resolveDice(game1)).toBe('challenger');

      const game2 = {
        challengerRolls: [2, 3],
        opponentRolls: [5, 6],
        challengerTotal: 5,
        opponentTotal: 11
      };
      expect(resolveDice(game2)).toBe('opponent');

      const game3 = {
        challengerRolls: [3, 4],
        opponentRolls: [2, 5],
        challengerTotal: 7,
        opponentTotal: 7
      };
      expect(resolveDice(game3)).toBe('tie');
    });
  });

  describe('Hi-Lo', () => {
    it('should create game with number', () => {
      const game = createHiLoGame();
      expect(game.type).toBe('hilow');
      expect(game.number).toBeGreaterThanOrEqual(1);
      expect(game.number).toBeLessThanOrEqual(100);
    });

    it('should resolve based on high/low guess', () => {
      const gameHigh = {
        number: 75,
        challengerChoice: 'high',
        opponentChoice: 'low'
      };
      expect(resolveHiLo(gameHigh)).toBe('challenger');

      const gameLow = {
        number: 25,
        challengerChoice: 'high',
        opponentChoice: 'low'
      };
      expect(resolveHiLo(gameLow)).toBe('opponent');

      const gameTie = {
        number: 50,
        challengerChoice: 'high',
        opponentChoice: 'low'
      };
      expect(resolveHiLo(gameTie)).toBe('tie');
    });
  });

  describe('getGameDisplayName', () => {
    it('should return correct display names', () => {
      expect(getGameDisplayName('rps')).toBe('Rock Paper Scissors');
      expect(getGameDisplayName('highcard')).toBe('High Card');
      expect(getGameDisplayName('dice')).toBe('Dice Duel');
      expect(getGameDisplayName('hilow')).toBe('Hi-Lo');
      expect(getGameDisplayName('reaction')).toBe('Reaction Duel');
    });
  });
});

