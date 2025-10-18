import { ButtonStyle } from 'discord.js';
import { createQuizDuelGame } from './quizDuelFactory.js';

const ACTIONS = [
  { id: 'green', label: 'Press Green', style: ButtonStyle.Success },
  { id: 'red', label: 'Press Red', style: ButtonStyle.Danger },
  { id: 'blue', label: 'Press Blue', style: ButtonStyle.Primary },
  { id: 'ignore', label: 'Stay Still', style: ButtonStyle.Secondary },
];

const SCENARIOS = [
  { command: 'Simon says hit the GREEN button!', correct: 'green' },
  { command: 'Simon says tap the RED button!', correct: 'red' },
  { command: 'Simon says go BLUE now!', correct: 'blue' },
  { command: 'Press the BLUE button!', correct: 'ignore' },
  { command: 'Do not touch the red button — seriously!', correct: 'ignore' },
  { command: 'Simon says do nothing.', correct: 'ignore' },
];

export const simonSaysGame = createQuizDuelGame({
  key: 'simon_says',
  name: 'Simon Says',
  color: 0xf1c40f,
  totalRounds: 4,
  describeRound: () => 'Respond only when Simon actually says!',
  roundFields: ({ roundData }) => [
    {
      name: 'Command',
      value: roundData.command,
    },
  ],
  createRound: ({ rng }) => {
    const scenario = rng.pick(SCENARIOS);
    const options = ACTIONS.map((action) => ({ ...action }));
    return {
      prompt: 'Which action keeps you safe?',
      options,
      correctOption: scenario.correct,
      command: scenario.command,
    };
  },
});
