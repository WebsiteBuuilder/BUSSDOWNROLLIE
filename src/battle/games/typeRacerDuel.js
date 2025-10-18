import { createQuizDuelGame } from './quizDuelFactory.js';

const WORDS = [
  'velocity',
  'symphony',
  'dazzling',
  'quizzical',
  'hyperbole',
  'chromatic',
  'wanderlust',
  'blueprint',
  'watermark',
  'harmony',
];

function makeVariants(word) {
  const variants = new Set();
  variants.add(word);

  if (word.length > 3) {
    variants.add(word.slice(0, word.length - 1) + word.slice(-1).toUpperCase());
  }

  if (word.length > 4) {
    variants.add(word.slice(0, 2) + word[2].toUpperCase() + word.slice(3));
  }

  variants.add(`${word.slice(0, 1).toUpperCase()}${word.slice(1)}`);
  variants.add(`${word}${word[word.length - 1]}`);
  variants.add(word.replace(/[aeiou]/, 'oo'));

  return Array.from(variants).filter((variant) => variant !== word);
}

export const typeRacerDuelGame = createQuizDuelGame({
  key: 'type_racer_duel',
  name: 'Type Racer Duel',
  color: 0x3498db,
  describeRound: () => 'Pick the correctly typed target word.',
  roundFields: ({ roundData }) => [
    {
      name: 'Target Sentence',
      value: `"${roundData.sentence}"`,
    },
  ],
  createRound: ({ rng }) => {
    const word = rng.pick(WORDS);
    const variants = makeVariants(word);
    const distractors = [];
    while (distractors.length < 2 && variants.length > 0) {
      const variant = rng.pick(variants);
      distractors.push(variant);
      const index = variants.indexOf(variant);
      variants.splice(index, 1);
    }

    const sentence = `The quick fox must type **${word}** flawlessly.`;

    const options = [word, ...distractors]
      .map((value) => ({
        id: value.toLowerCase(),
        label: value,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return {
      prompt: 'Which spelling matches the prompt exactly?',
      options,
      correctOption: word.toLowerCase(),
      sentence,
    };
  },
});
