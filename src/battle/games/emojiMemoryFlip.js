import { createQuizDuelGame } from './quizDuelFactory.js';

const EMOJI_SETS = [
  ['🐶', '🍕', '🚀', '🌊'],
  ['🎲', '🎯', '🧠', '⚡'],
  ['🍎', '🍰', '🍩', '🥑'],
  ['🦄', '🐉', '🦋', '🦂'],
  ['🎧', '📚', '🎬', '🎮'],
];

export const emojiMemoryFlipGame = createQuizDuelGame({
  key: 'emoji_memory_flip',
  name: 'Emoji Memory Flip',
  color: 0x9b59b6,
  describeRound: () => 'Memorize the sequence — which emoji was hiding there?',
  roundFields: ({ roundData }) => [
    {
      name: 'Sequence',
      value: roundData.sequence.join(' '),
    },
  ],
  createRound: ({ rng }) => {
    const sequence = rng.pick(EMOJI_SETS);
    const index = rng.range(0, sequence.length);
    const position = index + 1;
    const correctEmoji = sequence[index];

    const poolSet = new Set(sequence.concat(rng.pick(EMOJI_SETS)));
    poolSet.delete(correctEmoji);
    const pool = Array.from(poolSet);
    const options = new Set([correctEmoji]);
    while (options.size < 3 && pool.length > 0) {
      const index = rng.int(pool.length);
      const [candidate] = pool.splice(index, 1);
      options.add(candidate);
    }

    const optionList = Array.from(options)
      .map((emoji) => ({ id: emoji, label: emoji }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return {
      prompt: `Which emoji was in position #${position}?`,
      options: optionList,
      correctOption: correctEmoji,
      sequence,
    };
  },
});
