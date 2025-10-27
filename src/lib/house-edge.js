import crypto from 'crypto';
import { houseEdgeConfig, vipConfig } from '../config/casino.js';

const rouletteStreaks = new Map();

const EUROPEAN_WHEEL = [
  { number: 0, color: 'green' },
  { number: 32, color: 'red' },
  { number: 15, color: 'black' },
  { number: 19, color: 'red' },
  { number: 4, color: 'black' },
  { number: 21, color: 'red' },
  { number: 2, color: 'black' },
  { number: 25, color: 'red' },
  { number: 17, color: 'black' },
  { number: 34, color: 'red' },
  { number: 6, color: 'black' },
  { number: 27, color: 'red' },
  { number: 13, color: 'black' },
  { number: 36, color: 'red' },
  { number: 11, color: 'black' },
  { number: 30, color: 'red' },
  { number: 8, color: 'black' },
  { number: 23, color: 'red' },
  { number: 10, color: 'black' },
  { number: 5, color: 'red' },
  { number: 24, color: 'black' },
  { number: 16, color: 'red' },
  { number: 33, color: 'black' },
  { number: 1, color: 'red' },
  { number: 20, color: 'black' },
  { number: 14, color: 'red' },
  { number: 31, color: 'black' },
  { number: 9, color: 'red' },
  { number: 22, color: 'black' },
  { number: 18, color: 'red' },
  { number: 29, color: 'black' },
  { number: 7, color: 'red' },
  { number: 28, color: 'black' },
  { number: 12, color: 'red' },
  { number: 35, color: 'black' },
  { number: 3, color: 'red' },
  { number: 26, color: 'black' },
];

function resolveVipEdge(userProfile) {
  if (!userProfile) return 0;
  if (userProfile.vipPoints >= vipConfig.threshold) {
    return vipConfig.houseEdgeReduction;
  }
  return 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function weightedPocketIndex(weights) {
  const total = weights.reduce((acc, weight) => acc + weight, 0);
  const pick = crypto.randomInt(0, Math.max(1, Math.round(total * 1000)));
  let cumulative = 0;

  for (let i = 0; i < weights.length; i += 1) {
    cumulative += Math.round(weights[i] * 1000);
    if (pick <= cumulative) {
      return i;
    }
  }

  return weights.length - 1;
}

export function getRoulettePocket({
  userId,
  betAmount,
  betDescriptor,
  userProfile,
}) {
  const { roulette } = houseEdgeConfig;
  const vipReduction = resolveVipEdge(userProfile);
  const streakInfo = rouletteStreaks.get(userId) ?? { wins: 0 };

  const baseWeights = EUROPEAN_WHEEL.map(() => 1 / EUROPEAN_WHEEL.length);

  const targetColor = betDescriptor?.color ?? null;
  const targetNumbers = new Set(betDescriptor?.numbers ?? []);

  const penalties = [];

  // Enhanced anti-exploitation measures
  if (betAmount >= roulette.progressiveThreshold) {
    const increments = Math.floor(betAmount / roulette.progressiveThreshold);
    penalties.push(roulette.progressiveIncrement * increments);
  }

  if (betAmount >= 1000) {
    penalties.push(roulette.highRollerPenalty);
  }

  if (streakInfo.wins >= 5) {
    const streakFactor = streakInfo.wins - 4;
    penalties.push(roulette.streakAdjustment * streakFactor);
  }

  // Additional penalty for consecutive wins on color bets (red/black)
  if (streakInfo.wins >= 3 && (targetColor === 'red' || targetColor === 'black')) {
    penalties.push(0.01 * (streakInfo.wins - 2)); // Increasing penalty for color betting streaks
  }

  // Enhanced penalty for high-value color bets
  if (targetColor && betAmount >= 100) {
    penalties.push(0.005); // Additional 0.5% penalty for high-value color bets
  }

  const totalPenalty = clamp(penalties.reduce((acc, value) => acc + value, roulette.baseEdge - vipReduction), 0, 0.5);

  const adjusted = baseWeights.map((weight, index) => {
    const pocket = EUROPEAN_WHEEL[index];

    let modifier = 1;
    if (targetColor && pocket.color === targetColor) {
      modifier -= totalPenalty;
    }
    if (targetNumbers.size > 0 && targetNumbers.has(pocket.number)) {
      modifier -= totalPenalty;
    }

    return clamp(weight * modifier, weight * 0.05, weight * 1.5);
  });

  // Force losing outcome for excessive streaks
  if (streakInfo.wins >= roulette.maxConsecutiveWins) {
    const losingOptions = EUROPEAN_WHEEL.filter((pocket) => {
      if (targetColor && pocket.color === targetColor) return false;
      if (targetNumbers.size > 0 && targetNumbers.has(pocket.number)) return false;
      return true;
    });

    if (losingOptions.length > 0) {
      return losingOptions[crypto.randomInt(losingOptions.length)];
    }
  }

  // Additional safeguard: Force losing outcome for suspicious patterns
  if (streakInfo.wins >= 5 && (targetColor === 'red' || targetColor === 'black')) {
    // 20% chance to force a losing outcome for color betting streaks
    if (crypto.randomInt(0, 100) < 20) {
      const losingOptions = EUROPEAN_WHEEL.filter((pocket) => pocket.color !== targetColor);
      if (losingOptions.length > 0) {
        return losingOptions[crypto.randomInt(losingOptions.length)];
      }
    }
  }

  const index = weightedPocketIndex(adjusted);
  return EUROPEAN_WHEEL[index];
}

export function recordRouletteOutcome(userId, didWin) {
  const existing = rouletteStreaks.get(userId) ?? { wins: 0 };

  if (didWin) {
    existing.wins += 1;
  } else {
    existing.wins = 0;
  }

  rouletteStreaks.set(userId, existing);
  return existing.wins;
}

export function getRouletteStreak(userId) {
  return rouletteStreaks.get(userId)?.wins ?? 0;
}

export function canDoubleDown(state) {
  const { doubleDownTotals } = houseEdgeConfig.blackjack;
  if (state.playerHand.length !== 2) return false;
  if (state.turns && state.turns > 0) return false;

  const value = state.cachedPlayerValue ?? 0;
  return doubleDownTotals.includes(value);
}
