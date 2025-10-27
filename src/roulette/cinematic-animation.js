import GIFEncoder from 'gifencoder';
import { AttachmentBuilder } from 'discord.js';
import {
  renderCinematicFrame,
  getPocketIndex,
  getWheelOrder
} from './cinematic-wheel.js';

/**
 * Cinematic Roulette Animation System
 * Generates realistic 3D spinning wheel with motion blur, lighting, and confetti
 */

/**
 * Easing function for realistic deceleration
 */
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

/**
 * Calculate rotation speed at given frame
 */
function calculateSpeed(frame, totalFrames) {
  const progress = frame / totalFrames;
  return 1 - easeOutCubic(progress);
}

/**
 * Calculate winning angle for a number
 */
function getWinningAngle(winningNumber) {
  const wheelOrder = getWheelOrder();
  const pocketIndex = wheelOrder.indexOf(winningNumber);
  const anglePerPocket = (Math.PI * 2) / wheelOrder.length;
  
  // Rotate so winning number is at top (90 degrees)
  return -(pocketIndex * anglePerPocket) + (Math.PI / 2);
}

/**
 * Draw motion blur effect
 */
function renderMotionBlur(angle, speed, winningNumber) {
  const trails = 3;
  const frames = [];
  
  for (let i = 0; i < trails; i++) {
    const trailAngle = angle - (speed * i * 0.15);
    const alpha = (speed * 0.4) / (i + 1);
    
    const canvas = renderCinematicFrame({
      angle: trailAngle,
      speed,
      winningNumber: null,
      showBranding: i === 0,
      showLighting: i === 0
    });
    
    frames.push({ canvas, alpha });
  }
  
  return frames;
}

/**
 * Composite motion blur frames
 */
function compositeMotionBlur(ctx, frames) {
  ctx.save();
  
  for (let i = frames.length - 1; i >= 0; i--) {
    ctx.globalAlpha = frames[i].alpha;
    ctx.drawImage(frames[i].canvas, 0, 0);
  }
  
  ctx.restore();
}

/**
 * Generate cinematic roulette spin GIF
 */
export async function generateCinematicSpin(winningNumber, options = {}) {
  const {
    duration = 4000,
    fps = 30,
    width = 800,
    height = 800,
    quality = 10
  } = options;

  const frames = Math.floor((duration / 1000) * fps);
  const encoder = new GIFEncoder(width, height);
  
  console.log(`🎬 Generating cinematic spin for number ${winningNumber} (${frames} frames)`);
  
  encoder.start();
  encoder.setRepeat(0); // Play once
  encoder.setDelay(1000 / fps);
  encoder.setQuality(quality);
  encoder.setTransparent(0x000000);

  // Calculate physics
  const targetAngle = getWinningAngle(winningNumber);
  const totalRotations = 6 + Math.random() * 2;
  const confettiStartFrame = frames - 15;
  const highlightStartFrame = frames - 20;

  for (let frame = 0; frame < frames; frame++) {
    const progress = easeOutCubic(frame / frames);
    const angle = (totalRotations * 2 * Math.PI * progress) + targetAngle;
    const speed = calculateSpeed(frame, frames);
    
    // Determine which effects to show
    const isSpinning = frame < frames - 20;
    const isSlowingDown = frame >= frames - 20 && frame < frames - 5;
    const isFinalFrames = frame >= frames - 5;
    const showMotionBlur = speed > 0.5;
    
    let finalCanvas;
    
    if (showMotionBlur && isSpinning) {
      // Render with motion blur
      const { createCanvas } = await import('canvas');
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      
      const blurFrames = renderMotionBlur(angle, speed, null);
      compositeMotionBlur(ctx, blurFrames);
      
      finalCanvas = canvas;
    } else {
      // Render single frame with all effects
      const showWinningNumber = frame >= frames - 25;
      const confettiProgress = frame >= confettiStartFrame 
        ? (frame - confettiStartFrame) / (frames - confettiStartFrame)
        : 0;
      const highlightProgress = frame >= highlightStartFrame
        ? (frame - highlightStartFrame) / (frames - highlightStartFrame)
        : 0;
      
      finalCanvas = renderCinematicFrame({
        width,
        height,
        angle,
        speed,
        winningNumber: showWinningNumber ? winningNumber : null,
        showBranding: true,
        showLighting: true,
        showConfetti: frame >= confettiStartFrame,
        confettiProgress,
        showWinningHighlight: frame >= highlightStartFrame,
        highlightProgress
      });
    }
    
    // Add frame to encoder
    const ctx = finalCanvas.getContext('2d');
    encoder.addFrame(ctx);
    
    // Progress logging
    if (frame % 20 === 0 || frame === frames - 1) {
      const percent = ((frame / frames) * 100).toFixed(1);
      console.log(`  🎞️  Frame ${frame}/${frames} (${percent}%) - Speed: ${speed.toFixed(2)}`);
    }
    
    // Clear canvas for memory
    finalCanvas = null;
  }

  encoder.finish();
  const buffer = encoder.out.getData();
  
  const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
  console.log(`✅ Cinematic GIF generated: ${sizeMB} MB`);
  
  if (buffer.length > 3 * 1024 * 1024) {
    console.warn(`⚠️  GIF size (${sizeMB} MB) exceeds 3MB Discord limit!`);
  }
  
  return buffer;
}

/**
 * Create Discord attachment for cinematic spin
 */
export async function createCinematicAttachment(winningNumber, options = {}) {
  console.log(`🎰 Creating cinematic attachment for number ${winningNumber}`);
  
  const gifBuffer = await generateCinematicSpin(winningNumber, options);
  
  return new AttachmentBuilder(gifBuffer, { 
    name: 'roulette-spin.gif',
    description: `STILL GUUHHHD Roulette - Number ${winningNumber}`
  });
}

/**
 * Generate static result frame with confetti
 */
export function generateResultFrame(winningNumber) {
  console.log(`🎯 Generating result frame for number ${winningNumber}`);
  
  const targetAngle = getWinningAngle(winningNumber);
  
  const canvas = renderCinematicFrame({
    width: 800,
    height: 800,
    angle: targetAngle,
    speed: 0,
    winningNumber,
    showBranding: true,
    showLighting: false,
    showConfetti: true,
    confettiProgress: 0.8,
    showWinningHighlight: true,
    highlightProgress: 1
  });
  
  return canvas.toBuffer('image/png');
}

/**
 * Create Discord attachment for result image
 */
export function createResultAttachment(winningNumber) {
  const pngBuffer = generateResultFrame(winningNumber);
  
  return new AttachmentBuilder(pngBuffer, { 
    name: 'roulette-result.png',
    description: `Winning Number: ${winningNumber}`
  });
}

/**
 * Lite mode fallback - text-based animation
 */
export async function animateLiteMode(updateCallback, winningFrame) {
  const sequences = [
    { count: 12, delay: 60, frame: '⚡ 🎰 ⚡ 🎰 ⚡ 🎰 ⚡', caption: '🎡 **Accelerating...** ⚡' },
    { count: 10, delay: 100, frame: '🎰 💫 🎰 💫 🎰 💫 🎰', caption: '🌀 **Spinning fast...** 💨' },
    { count: 8, delay: 150, frame: '⭐ 🎯 ⭐ 🎯 ⭐ 🎯 ⭐', caption: '⏳ **Slowing down...** 🌀' },
    { count: 5, delay: 300, frame: '✨ 🎰 ✨ 🎰 ✨ 🎰 ✨', caption: '💫 **Almost there...** ⏰' },
  ];

  for (const seq of sequences) {
    for (let i = 0; i < seq.count; i++) {
      await updateCallback(seq.frame, seq.caption);
      await wait(seq.delay);
    }
  }

  // Dramatic pause
  await wait(500);
  await updateCallback('🎯 **Analyzing result...**', '✨ **The wheel has stopped!** ✨');
  await wait(800);

  // Final result
  await updateCallback(winningFrame, '🎉 **STILL GUUHHHD!** 🎰');
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

