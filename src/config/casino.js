export const houseEdgeConfig = {
  roulette: {
    baseEdge: 0.027,
    streakAdjustment: 0.005,
    maxConsecutiveWins: 7,
    highRollerPenalty: 0.01,
    progressiveThreshold: 500,
    progressiveIncrement: 0.0025,
  },
  blackjack: {
    deckCount: 6,
    shufflePoint: 0.75,
    baseEdge: 0.005,
    sideBetEdge: 0.06,
    dealerAdvantage: {
      standOnSoft17: true,
      blackjackPayout: 1.5,
      pushRule: 'dealerWins',
    },
    doubleDownTotals: [9, 10, 11],
  },
};

export const rewardConfig = {
  tiers: [
    { min: 0, max: 5, points: { min: 1, max: 5 } },
    { min: 5, max: 20, points: { min: 5, max: 15 } },
    { min: 20, max: 1000, points: { min: 15, max: 30 } },
  ],
  jackpot: { points: { min: 30, max: 60 } },
  dailyLogin: 5,
  streakBonus: { perWin: 2, maxBonus: 10 },
};

export const vipConfig = {
  threshold: 60,
  houseEdgeReduction: 0.005,
};

export function resolveRewardPoints(multiplier, { jackpot = false } = {}) {
  if (jackpot) {
    return rewardConfig.jackpot.points.max;
  }

  for (const tier of rewardConfig.tiers) {
    if (multiplier >= tier.min && multiplier < tier.max) {
      return tier.points.max;
    }
  }

  return rewardConfig.tiers[0].points.min;
}
