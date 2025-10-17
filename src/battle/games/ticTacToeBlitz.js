import { createQuizDuelGame } from './quizDuelFactory.js';

const COORDS = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'];

const SCENARIOS = [
  { board: ['X', 'X', null, 'O', 'O', null, null, null, null], winningIndex: 2 },
  { board: ['O', null, 'O', 'X', 'X', null, null, null, null], winningIndex: 5 },
  { board: [null, 'X', null, 'O', 'X', null, 'O', null, null], winningIndex: 8 },
  { board: ['X', null, 'O', null, 'X', null, null, 'O', null], winningIndex: 6 },
  { board: ['O', 'O', 'X', null, 'X', null, null, null, null], winningIndex: 3 },
  { board: [null, null, null, 'X', 'O', 'X', null, 'O', null], winningIndex: 0 },
  { board: ['X', null, null, 'O', 'X', null, null, null, 'O'], winningIndex: 6 },
];

function renderBoard(board) {
  const rows = [
    board.slice(0, 3),
    board.slice(3, 6),
    board.slice(6, 9),
  ];
  return rows
    .map((row) => row.map((cell) => cell ?? '·').join(' | '))
    .join('\n');
}

export const ticTacToeBlitzGame = createQuizDuelGame({
  key: 'tic_tac_toe_blitz',
  name: 'Tic-Tac-Toe Blitz',
  color: 0x2ecc71,
  describeRound: ({ round }) => `Round ${round}: identify the winning move for **X**.`,
  roundFields: ({ roundData }) => [
    {
      name: 'Board',
      value: renderBoard(roundData.board),
    },
  ],
  createRound: ({ rng }) => {
    const scenario = rng.pick(SCENARIOS);
    const emptyIndices = scenario.board
      .map((value, index) => (value ? null : index))
      .filter((index) => index !== null);

    const distractors = emptyIndices.filter((idx) => idx !== scenario.winningIndex);
    const optionsPool = [scenario.winningIndex];

    while (optionsPool.length < Math.min(3, emptyIndices.length)) {
      const pick = rng.pick(distractors);
      if (!optionsPool.includes(pick)) {
        optionsPool.push(pick);
      }
    }

    const options = optionsPool
      .map((index) => ({
        index,
        label: COORDS[index],
        id: COORDS[index].toLowerCase(),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return {
      prompt: 'Where should X play to win immediately?',
      options,
      correctOption: COORDS[scenario.winningIndex].toLowerCase(),
      board: scenario.board,
    };
  },
});
