import { hiLowDrawGame } from './games/hiLowDraw.js';
import { rockPaperScissorsGame } from './games/rockPaperScissors.js';
import { reactionTestGame } from './games/reactionTest.js';
import { createQuickStubGame } from './games/quickStub.js';

const stubGames = [
  createQuickStubGame({
    key: 'tic_tac_toe_blitz',
    name: 'Tic-Tac-Toe Blitz',
    prompt: 'Race to confirm you are ready for a blitz match! First fully ready player wins if the other times out.'
  }),
  createQuickStubGame({
    key: 'simon_says',
    name: 'Simon Says',
    prompt: 'Confirm when you are ready to follow instructions. Both players ready → random victor to simulate performance.'
  }),
  createQuickStubGame({
    key: 'type_racer_duel',
    name: 'Type Racer Duel',
    prompt: 'Warm up those fingers and confirm ready. Winner decided once both are prepped.'
  }),
  createQuickStubGame({
    key: 'math_clash',
    name: 'Math Clash',
    prompt: 'Sharpen your mental math, then hit ready. Someone will out-calc the other!' 
  }),
  createQuickStubGame({
    key: 'emoji_memory_flip',
    name: 'Emoji Memory Flip',
    prompt: 'Prepare for a memory showdown. Confirm ready to begin.'
  }),
  createQuickStubGame({
    key: 'bomb_defuse',
    name: 'Bomb Defuse',
    prompt: 'Steady those nerves and confirm ready. Someone will defuse in time.'
  }),
  createQuickStubGame({
    key: 'dice_push',
    name: 'Dice Push',
    prompt: 'Lock in when you are ready to push your luck.'
  }),
  createQuickStubGame({
    key: 'nim_21_misere',
    name: 'Nim 21 Misère',
    prompt: 'Strategize quickly and confirm ready for a nim showdown.'
  }),
  createQuickStubGame({
    key: 'word_chain',
    name: 'Word Chain',
    prompt: 'Mentally prepare your vocabulary and confirm ready to play.'
  }),
  createQuickStubGame({
    key: 'quickdraw_trivia',
    name: 'Quickdraw Trivia',
    prompt: 'Ready your facts and confirm when prepared. Trivia waits for no one.'
  }),
];

export const battleGames = [
  rockPaperScissorsGame,
  reactionTestGame,
  hiLowDrawGame,
  ...stubGames,
];

export function getGameByKey(key) {
  return battleGames.find((game) => game.key === key);
}
