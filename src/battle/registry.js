import { hiLowDrawGame } from './games/hiLowDraw.js';
import { rockPaperScissorsGame } from './games/rockPaperScissors.js';
import { reactionTestGame } from './games/reactionTest.js';
import { ticTacToeBlitzGame } from './games/ticTacToeBlitz.js';
import { simonSaysGame } from './games/simonSays.js';
import { typeRacerDuelGame } from './games/typeRacerDuel.js';
import { mathClashGame } from './games/mathClash.js';
import { emojiMemoryFlipGame } from './games/emojiMemoryFlip.js';
import { bombDefuseGame } from './games/bombDefuse.js';
import { dicePushGame } from './games/dicePush.js';
import { nim21MisereGame } from './games/nim21Misere.js';
import { wordChainGame } from './games/wordChain.js';
import { quickdrawTriviaGame } from './games/quickdrawTrivia.js';

export const battleGames = [
  rockPaperScissorsGame,
  reactionTestGame,
  hiLowDrawGame,
  ticTacToeBlitzGame,
  simonSaysGame,
  typeRacerDuelGame,
  mathClashGame,
  emojiMemoryFlipGame,
  bombDefuseGame,
  dicePushGame,
  nim21MisereGame,
  wordChainGame,
  quickdrawTriviaGame,
];

export function getGameByKey(key) {
  return battleGames.find((game) => game.key === key);
}
