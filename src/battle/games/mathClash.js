import { createQuizDuelGame } from './quizDuelFactory.js';

const OPERATIONS = [
  { symbol: '+', compute: (a, b) => a + b },
  { symbol: '−', compute: (a, b) => a - b },
  { symbol: '×', compute: (a, b) => a * b },
];

export const mathClashGame = createQuizDuelGame({
  key: 'math_clash',
  name: 'Math Clash',
  color: 0xe67e22,
  describeRound: () => 'Crunch the numbers faster than your opponent.',
  roundFields: ({ roundData }) => [
    {
      name: 'Expression',
      value: `${roundData.left} ${roundData.symbol} ${roundData.right}`,
    },
  ],
  createRound: ({ rng }) => {
    const operation = rng.pick(OPERATIONS);
    const left = rng.range(4, 20);
    const right = rng.range(2, 12);
    const answer = operation.compute(left, right);

    const deltas = new Set();
    while (deltas.size < 2) {
      const magnitude = rng.range(1, 7);
      const sign = rng.pick([-1, 1]);
      deltas.add(magnitude * sign);
    }

    const options = [
      answer,
      ...Array.from(deltas).map((delta) => answer + delta),
    ]
      .map((value) => ({
        id: value.toString(),
        label: value.toString(),
      }))
      .sort((a, b) => Number(a.label) - Number(b.label));

    return {
      prompt: 'What is the correct result?',
      options,
      correctOption: answer.toString(),
      left,
      right,
      symbol: operation.symbol,
    };
  },
});
