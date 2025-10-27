import { AttachmentBuilder } from 'discord.js';
import {
  renderSpinningWheel,
  renderResultWheel,
  calculateBallPhysics,
  getPocketIndex,
  isCanvasModuleAvailable
} from './canvas-wheel.js';

let GIFEncoderCtor = null;
let gifEncoderError = null;

try {
  const gifModule = await import('gifencoder');
  GIFEncoderCtor = gifModule.default ?? gifModule;
  if (typeof GIFEncoderCtor !== 'function') {
    GIFEncoderCtor = null;
    gifEncoderError = new Error('gifencoder module does not export a constructor');
  }
} catch (error) {
  gifEncoderError = error;
  console.warn(
    '⚠️ GIFEncoder dependency not available; roulette animations will fall back to lite mode.',
    error?.message ?? error
  );
}

function assertCanvasAnimationAvailable(action) {
  if (!isCanvasAnimationAvailable()) {
    const error = new Error('Canvas animation is not available to ' + action + '.');
    if (gifEncoderError) {
      error.cause = gifEncoderError;
    }
    throw error;
  }
}

function assertCanvasAvailable(action) {
  if (!isCanvasModuleAvailable()) {
    throw new Error('Canvas module is not available to ' + action + '.');
  }
}

export function isCanvasAnimationAvailable() {
  return isCanvasModuleAvailable() && typeof GIFEncoderCtor === 'function';
}

/**
 * Canvas-based Roulette Animation System
 * Generates smooth GIF animations with physics-based wheel spinning
 */

/**
 * Generate a full animated GIF of the roulette wheel spinning
 * @param {number} winningNumber - The number that will win
 * @param {number} duration - Animation duration in milliseconds (default 8000ms)
 * @returns {Promise<Buffer>} GIF buffer
 */
export async function generateWheelGIF(winningNumber, duration = 8000) {
  assertCanvasAnimationAvailable('generate roulette GIFs');
  const fps = 15; // 15 frames per second for smooth animation
  const totalFrames = Math.floor((duration / 1000) * fps);
  const targetPocket = getPocketIndex(winningNumber);

  // Initialize GIF encoder
  const encoder = new GIFEncoderCtor(800, 800);
  encoder.start();
  encoder.setRepeat(-1); // Loop indefinitely
  encoder.setDelay(1000 / fps); // Frame delay in ms
  encoder.setQuality(10); // Quality (1-20, lower is better but larger file size)

  console.log(`🎬 Generating ${totalFrames} frames for winning number ${winningNumber}`);

  // Generate frames
  for (let frame = 0; frame < totalFrames; frame++) {
    const physics = calculateBallPhysics(frame, totalFrames, targetPocket);
    const canvas = renderSpinningWheel(
      physics.rotation,
      physics.ballAngle,
      physics.ballRadius
    );

    // Add frame to GIF
    const ctx = canvas.getContext('2d');
    encoder.addFrame(ctx);

    // Log progress every 20 frames
    if (frame % 20 === 0 || frame === totalFrames - 1) {
      const progress = ((frame / totalFrames) * 100).toFixed(1);
      console.log(`  📊 Frame ${frame}/${totalFrames} (${progress}%)`);
    }
  }

  encoder.finish();
  const buffer = encoder.out.getData();
  
  console.log(`✅ GIF generated: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
  
  return buffer;
}

/**
 * Generate a static result image
 * @param {number} winningNumber - The winning number
 * @returns {Buffer} PNG buffer
 */
export function generateResultImage(winningNumber) {
  assertCanvasAvailable('render roulette result images');
  const canvas = renderResultWheel(winningNumber);
  return canvas.toBuffer('image/png');
}

/**
 * Create Discord attachment for GIF animation
 * @param {number} winningNumber - The winning number
 * @param {number} duration - Animation duration in milliseconds
 * @returns {Promise<AttachmentBuilder>} Discord attachment
 */
export async function createSpinAnimation(winningNumber, duration = 8000) {
  const gifBuffer = await generateWheelGIF(winningNumber, duration);
  return new AttachmentBuilder(gifBuffer, { name: 'roulette-spin.gif' });
}

/**
 * Create Discord attachment for result image
 * @param {number} winningNumber - The winning number
 * @returns {AttachmentBuilder} Discord attachment
 */
export function createResultImage(winningNumber) {
  assertCanvasAvailable('render roulette result images');
  const pngBuffer = generateResultImage(winningNumber);
  return new AttachmentBuilder(pngBuffer, { name: 'roulette-result.png' });
}

/**
 * Animated roulette with progressive updates (for real-time feedback)
 * Updates the embed with images at key intervals during generation
 * @param {Function} updateCallback - Callback function (embed, attachment)
 * @param {number} winningNumber - The winning number
 * @param {number} duration - Animation duration in milliseconds
 */
export async function animateRouletteWithUpdates(updateCallback, winningNumber, duration = 8000) {
  assertCanvasAvailable('animate the roulette wheel');
  const fps = 15;
  const totalFrames = Math.floor((duration / 1000) * fps);
  const targetPocket = getPocketIndex(winningNumber);
  const updateInterval = 10; // Update every 10 frames

  console.log(`🎬 Starting animated roulette (${totalFrames} frames)`);

  // Phase 1: Fast spinning (first 33%)
  const phase1End = Math.floor(totalFrames * 0.33);
  for (let frame = 0; frame < phase1End; frame += updateInterval) {
    const physics = calculateBallPhysics(frame, totalFrames, targetPocket);
    const canvas = renderSpinningWheel(physics.rotation, physics.ballAngle, physics.ballRadius);
    const buffer = canvas.toBuffer('image/png');
    const attachment = new AttachmentBuilder(buffer, { name: 'wheel.png' });
    
    await updateCallback(
      'attachment://wheel.png',
      attachment,
      '🎡 **The wheel spins at breakneck speed...** ⚡'
    );
    
    await wait(100);
  }

  // Phase 2: Medium spinning (33% - 66%)
  const phase2End = Math.floor(totalFrames * 0.66);
  for (let frame = phase1End; frame < phase2End; frame += updateInterval) {
    const physics = calculateBallPhysics(frame, totalFrames, targetPocket);
    const canvas = renderSpinningWheel(physics.rotation, physics.ballAngle, physics.ballRadius);
    const buffer = canvas.toBuffer('image/png');
    const attachment = new AttachmentBuilder(buffer, { name: 'wheel.png' });
    
    await updateCallback(
      'attachment://wheel.png',
      attachment,
      '⏳ **The wheel begins to slow...** 🌀'
    );
    
    await wait(150);
  }

  // Phase 3: Slow spinning (66% - 100%)
  for (let frame = phase2End; frame < totalFrames; frame += Math.floor(updateInterval / 2)) {
    const physics = calculateBallPhysics(frame, totalFrames, targetPocket);
    const canvas = renderSpinningWheel(physics.rotation, physics.ballAngle, physics.ballRadius);
    const buffer = canvas.toBuffer('image/png');
    const attachment = new AttachmentBuilder(buffer, { name: 'wheel.png' });
    
    await updateCallback(
      'attachment://wheel.png',
      attachment,
      '💫 **Almost there... Final moments!** ⏰'
    );
    
    await wait(300);
  }

  // Final: Show result with highlight
  await wait(500);
  const resultBuffer = generateResultImage(winningNumber);
  const resultAttachment = new AttachmentBuilder(resultBuffer, { name: 'wheel.png' });
  
  await updateCallback(
    'attachment://wheel.png',
    resultAttachment,
    '🎯 **The wheel has landed!**'
  );

  console.log(`✅ Animation complete: Number ${winningNumber}`);
}


