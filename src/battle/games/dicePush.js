import { ButtonStyle } from 'discord.js';
import { createQuizDuelGame } from './quizDuelFactory.js';

const OPTIONS = [
  { id: 'push', label: 'Push (roll again)', style: ButtonStyle.Primary },
  { id: 'hold', label: 'Hold Position', style: ButtonStyle.Success },
];

const SCENARIOS = [
  { total: 7, target: 15, reasoning: 'You are far from the target — risk it.', best: 'push' },
  { total: 13, target: 18, reasoning: 'One solid roll away. Push for the win.', best: 'push' },
  { total: 16, target: 18, reasoning: 'Any bust loses the round. Lock it in.', best: 'hold' },
  { total: 18, target: 20, reasoning: 'Two points up — play it safe.', best: 'hold' },
  { total: 9, target: 16, reasoning: 'You need momentum to catch up.', best: 'push' },
];

export const dicePushGame = createQuizDuelGame({
  key: 'dice_push',
  name: 'Dice Push',
  color: 0x95a5a6,
  describeRound: () => 'Decide whether to push your luck or lock in the current score.',
  roundFields: ({ roundData }) => [
    { name: 'Current Total', value: `${roundData.total}` },
    { name: 'Target', value: `${roundData.target}` },
    { name: 'Coach Note', value: roundData.reasoning },
  ],
  createRound: ({ rng }) => {
    const scenario = rng.pick(SCENARIOS);
    return {
      prompt: 'What is the optimal call?',
      options: OPTIONS,
      correctOption: scenario.best,
      total: scenario.total,
      target: scenario.target,
      reasoning: scenario.reasoning,
    };
  },
});
