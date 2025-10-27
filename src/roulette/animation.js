const FAST_SPINS = 20;
const MEDIUM_SPINS = 15;
const SLOW_SPINS = 10;

// Enhanced spinning frames for cinematic effect
export const ROULETTE_FRAMES = [
  '⚪🔴⚫⚪🔴⚫⚪🔴⚫⚪',
  '⚫⚪🔴⚫⚪🔴⚫⚪🔴⚫',
  '🔴⚫⚪🔴⚫⚪🔴⚫⚪🔴',
  '⚪🔴⚫⚪🔴⚫⚪🟢⚪🔴',
  '⚫⚪🔴⚫⚪🔴⚫⚪🔴⚫',
  '🔴⚫⚪🔴⚫⚪🔴⚫⚪🔴',
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function animateRoulette(update, winningFrame) {
  const sequences = [
    { count: FAST_SPINS, delay: 80, caption: '🎡 The wheel spins at breakneck speed... ⚡' },
    { count: MEDIUM_SPINS, delay: 150, caption: '⏳ The wheel begins to slow... 🌀' },
    { count: SLOW_SPINS, delay: 400, caption: '💫 Almost there... Final moments! ⏰' },
  ];

  let frameIndex = 0;

  // Fast spinning phase
  for (const seq of sequences) {
    for (let step = 0; step < seq.count; step += 1) {
      frameIndex = (frameIndex + 1) % ROULETTE_FRAMES.length;
      await update({ frame: ROULETTE_FRAMES[frameIndex], caption: seq.caption });
      await wait(seq.delay);
    }
  }

  // Dramatic pause before revealing result
  await wait(500);
  await update({ frame: '🎯 *Analyzing result...*', caption: '🎲 Determining winner...' });
  await wait(800);
  
  // Final result
  await update({ frame: winningFrame, caption: '🎉 The wheel has landed!' });
}
