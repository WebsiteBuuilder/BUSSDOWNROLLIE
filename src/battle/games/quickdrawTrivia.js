import { createQuizDuelGame } from './quizDuelFactory.js';

const QUESTIONS = [
  {
    prompt: 'Which planet has the most moons?',
    options: [
      { id: 'jupiter', label: 'Jupiter' },
      { id: 'saturn', label: 'Saturn' },
      { id: 'mars', label: 'Mars' },
    ],
    correct: 'saturn',
    fact: 'Saturn currently leads the solar system moon count.',
  },
  {
    prompt: 'What instrument has keys, pedals, and strings?',
    options: [
      { id: 'violin', label: 'Violin' },
      { id: 'harp', label: 'Harp' },
      { id: 'piano', label: 'Piano' },
    ],
    correct: 'piano',
    fact: 'A piano is technically both a string and percussion instrument.',
  },
  {
    prompt: 'Which element has the chemical symbol "Na"?',
    options: [
      { id: 'sodium', label: 'Sodium' },
      { id: 'neon', label: 'Neon' },
      { id: 'nitrogen', label: 'Nitrogen' },
    ],
    correct: 'sodium',
    fact: 'Na comes from "natrium", the Latin name for sodium.',
  },
  {
    prompt: 'What is the fastest land animal?',
    options: [
      { id: 'cheetah', label: 'Cheetah' },
      { id: 'pronghorn', label: 'Pronghorn' },
      { id: 'lion', label: 'Lion' },
    ],
    correct: 'cheetah',
    fact: 'Cheetahs can accelerate 0–60 mph in roughly three seconds.',
  },
];

export const quickdrawTriviaGame = createQuizDuelGame({
  key: 'quickdraw_trivia',
  name: 'Quickdraw Trivia',
  color: 0x2980b9,
  describeRound: () => 'Answer faster than your opponent to snag the point.',
  roundFields: ({ roundData }) => [
    {
      name: 'Fact',
      value: roundData.revealed ? roundData.fact : 'Answer to reveal the fun fact!',
    },
  ],
  createRound: ({ rng }) => {
    const question = rng.pick(QUESTIONS);
    return {
      prompt: question.prompt,
      options: question.options,
      correctOption: question.correct,
      fact: question.fact,
    };
  },
});
