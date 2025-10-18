import { createQuizDuelGame } from './quizDuelFactory.js';

function bestMove(remaining) {
  if (remaining <= 1) return 1;
  if (remaining <= 4) {
    return remaining - 1;
  }
  const mod = remaining % 4;
  if (mod === 0) {
    return 3;
  }
  if (mod === 1) {
    return 1;
  }
  return mod;
}

function reasoningFor(remaining, take) {
  if (remaining % 4 === 1 && remaining > 4) {
    return 'This is a rough position — take 1 and hope for a mistake.';
  }
  if (remaining <= 4) {
    return 'Leave a single token for your opponent.';
  }
  return 'Force the count into a 1 (mod 4) position for your opponent.';
}

export const nim21MisereGame = createQuizDuelGame({
  key: 'nim_21_misere',
  name: 'Nim 21 Misère',
  color: 0x1abc9c,
  describeRound: () => 'Choose how many to take without being stuck with the last token.',
  roundFields: ({ roundData }) => [
    { name: 'Tokens Remaining', value: `${roundData.remaining}` },
    { name: 'Allowed Move', value: 'Take 1 to 3 tokens', inline: false },
    { name: 'Strategy Note', value: roundData.reasoning },
  ],
  createRound: ({ rng }) => {
    const remaining = rng.range(5, 18);
    const take = bestMove(remaining);
    const reasoning = reasoningFor(remaining, take);

    const options = [1, 2, 3].map((value) => ({
      id: value.toString(),
      label: `Take ${value}`,
    }));

    return {
      prompt: 'How many tokens should you take?',
      options,
      correctOption: take.toString(),
      remaining,
      reasoning,
    };
  },
});
