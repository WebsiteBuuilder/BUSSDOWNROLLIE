import { createQuizDuelGame } from './quizDuelFactory.js';

const SCENARIOS = [
  {
    lastWord: 'Galaxy',
    options: [
      { id: 'young', label: 'Youngling' },
      { id: 'comet', label: 'Comet' },
      { id: 'nova', label: 'Nova' },
    ],
    correct: 'young',
  },
  {
    lastWord: 'Echo',
    options: [
      { id: 'orbit', label: 'Orbit' },
      { id: 'orange', label: 'Orange' },
      { id: 'overture', label: 'Overture' },
    ],
    correct: 'orbit',
  },
  {
    lastWord: 'Trail',
    options: [
      { id: 'lantern', label: 'Lantern' },
      { id: 'river', label: 'River' },
      { id: 'track', label: 'Track' },
    ],
    correct: 'lantern',
  },
  {
    lastWord: 'Crown',
    options: [
      { id: 'nectar', label: 'Nectar' },
      { id: 'night', label: 'Nightfall' },
      { id: 'ember', label: 'Ember' },
    ],
    correct: 'nectar',
  },
];

export const wordChainGame = createQuizDuelGame({
  key: 'word_chain',
  name: 'Word Chain',
  color: 0x8e44ad,
  describeRound: () => 'Continue the chain with a word starting from the last letter.',
  roundFields: ({ roundData }) => [
    { name: 'Previous Word', value: roundData.lastWord },
  ],
  createRound: ({ rng }) => {
    const scenario = rng.pick(SCENARIOS);
    return {
      prompt: `Choose a word that starts with "${scenario.lastWord.slice(-1).toUpperCase()}".`,
      options: scenario.options,
      correctOption: scenario.correct,
      lastWord: scenario.lastWord,
    };
  },
});
