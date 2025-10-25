import { hiLowDrawGame } from './games/hiLowDraw.js';
import { ticTacToeGame } from './games/ticTacToe.js';
import { clickDuelGame } from './games/clickDuel.js';
import { coinFlipGame } from './games/coinFlip.js';
import { guessNumberGame } from './games/guessNumber.js';
import { blackjackBattleGame } from './games/blackjackBattle.js';

export const battleGames = [
  hiLowDrawGame,
  ticTacToeGame,
  clickDuelGame,
  coinFlipGame,
  guessNumberGame,
  blackjackBattleGame,
];

export function getGameByKey(key) {
  return battleGames.find((game) => game.key === key);
}
