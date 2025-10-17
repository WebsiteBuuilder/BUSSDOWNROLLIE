import { ButtonStyle } from 'discord.js';
import { createQuizDuelGame } from './quizDuelFactory.js';

const WIRES = [
  { id: 'red', label: 'Cut Red', style: ButtonStyle.Danger },
  { id: 'blue', label: 'Cut Blue', style: ButtonStyle.Primary },
  { id: 'green', label: 'Cut Green', style: ButtonStyle.Success },
  { id: 'yellow', label: 'Cut Yellow', style: ButtonStyle.Secondary },
];

const SCENARIOS = [
  {
    intel: 'Timer is blinking red. Serial number ends with 7. Wires: Red, Blue, Yellow.',
    correct: 'red',
    rule: 'Odd serial → cut the warmest color.',
    wires: ['red', 'blue', 'yellow'],
  },
  {
    intel: 'Panel coolant leaking. Serial number contains B. Wires: Blue, Green, Yellow.',
    correct: 'blue',
    rule: 'If the serial has a letter, favor the matching color.',
    wires: ['blue', 'green', 'yellow'],
  },
  {
    intel: 'Humidity spike detected. Serial number ends with 4. Wires: Green, Yellow, Red.',
    correct: 'green',
    rule: 'Even serial with moisture → cut green.',
    wires: ['green', 'yellow', 'red'],
  },
  {
    intel: 'All lights off. Serial number ends with 9. Wires: Yellow, Red, Blue.',
    correct: 'yellow',
    rule: 'In blackout conditions, go for the brightest color.',
    wires: ['yellow', 'red', 'blue'],
  },
];

export const bombDefuseGame = createQuizDuelGame({
  key: 'bomb_defuse',
  name: 'Bomb Defuse',
  color: 0xe74c3c,
  describeRound: () => 'Study the intel, then choose the safe wire to cut.',
  roundFields: ({ roundData }) => [
    { name: 'Intel', value: roundData.intel },
    { name: 'Rule', value: roundData.rule },
  ],
  createRound: ({ rng }) => {
    const scenario = rng.pick(SCENARIOS);
    const options = WIRES.filter((wire) => scenario.wires.includes(wire.id));

    return {
      prompt: 'Which wire keeps the bomb dormant?',
      options,
      correctOption: scenario.correct,
      intel: scenario.intel,
      rule: scenario.rule,
    };
  },
});
