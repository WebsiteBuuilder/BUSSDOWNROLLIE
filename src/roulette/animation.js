const FAST_SPINS = 12;
const MEDIUM_SPINS = 8;
const SLOW_SPINS = 4;

export const ROULETTE_FRAMES = [
  '⬛🟥⬛🟥⬛🟥🟩🟥⬛🟥⬛🟥🟩⬛',
  '🟥⬛🟥⬛🟥⬛🟥🟩🟥⬛🟥⬛🟥🟩',
  '⬛🟥⬛🟥⬛🟥⬛🟥🟩🟥⬛🟥⬛🟥',
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function animateRoulette(update, winningFrame) {
  const sequences = [
    { count: FAST_SPINS, delay: 100, caption: '🎡 The wheel spins faster…' },
    { count: MEDIUM_SPINS, delay: 300, caption: '⏳ Slowing down…' },
    { count: SLOW_SPINS, delay: 600, caption: '💫 Final spin…' },
  ];

  let frameIndex = 0;

  for (const seq of sequences) {
    for (let step = 0; step < seq.count; step += 1) {
      frameIndex = (frameIndex + 1) % ROULETTE_FRAMES.length;
      await update({ frame: ROULETTE_FRAMES[frameIndex], caption: seq.caption });
      await wait(seq.delay);
    }
  }

  await update({ frame: winningFrame, caption: '🎉 The wheel stops!' });
}
