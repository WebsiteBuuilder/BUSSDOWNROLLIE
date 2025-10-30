import { animateRouletteWithUpdates, animateLiteMode } from './canvas-animation.js';

/**
 * Legacy-compatible roulette animation wrapper.
 *
 * The existing roulette managers expect a simple text-frame animation
 * where the callback receives an object with a `frame` and `caption`.
 * Recent canvas changes introduced richer animations but removed the
 * previous helper module, causing the bot to crash when it attempted to
 * import `./animation.js`. This module restores that entry point and
 * bridges to the new animation utilities while keeping the old contract.
 *
 * @param {(update: { frame: string; caption: string; attachment?: import('discord.js').AttachmentBuilder; imageUrl?: string }) => Promise<void>} updateFrame
 *   Callback used by the managers to update Discord messages.
 * @param {string | { winningNumber: number, caption?: string }} winningFrame
 *   The final winning frame (legacy string) or an object describing the
 *   winning number so canvas animations can be used.
 */
export async function animateRoulette(updateFrame, winningFrame) {
  if (typeof updateFrame !== 'function') {
    throw new TypeError('animateRoulette requires a callback function');
  }

  const forwardLiteUpdate = async (frame, caption) => {
    await updateFrame({ frame, caption });
  };

  // Support new callers that may provide a winning number for the
  // canvas-based animation while keeping compatibility with the legacy
  // string-based frame format.
  if (winningFrame && typeof winningFrame === 'object' && 'winningNumber' in winningFrame) {
    const { winningNumber, caption } = winningFrame;

    try {
      await animateRouletteWithUpdates(
        async (imageUrl, attachment, updateCaption) => {
          await updateFrame({
            frame: '',
            caption: updateCaption ?? caption ?? '🎡 The wheel spins...',
            attachment,
            imageUrl,
          });
        },
        winningNumber
      );
      return;
    } catch (error) {
      console.error('Roulette canvas animation failed, falling back to lite mode:', error);
      const fallbackFrame = caption ?? `🎯 **${winningNumber}**`;
      await animateLiteMode(forwardLiteUpdate, fallbackFrame);
      return;
    }
  }

  // Legacy behaviour: treat winningFrame as the final string to display.
  const finalFrame = typeof winningFrame === 'string' ? winningFrame : '🎯 The wheel has landed!';

  try {
    await animateLiteMode(forwardLiteUpdate, finalFrame);
  } catch (error) {
    console.error('Roulette lite animation failed:', error);
    await updateFrame({ frame: finalFrame, caption: '🎯 The wheel has landed!' });
  }
}
