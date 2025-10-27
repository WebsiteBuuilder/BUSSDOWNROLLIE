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
 * Draw motion blur effect (OPTIMIZED - reduced trails)
 */
function renderMotionBlur(angle, speed, winningNumber, width = 600, height = 600) {
  const trails = 2; // Reduced from 3 for faster rendering
  const frames = [];
  
  for (let i = 0; i < trails; i++) {
    const trailAngle = angle - (speed * i * 0.15);
    const alpha = (speed * 0.4) / (i + 1);
    
    const canvas = renderCinematicFrame({
      width,
      height,
      angle: trailAngle,
      speed,
      winningNumber: null,
      showBranding: i === 0,
      showLighting: false // Skip lighting in blur frames for performance
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
 * Generate OPTIMIZED cinematic roulette spin GIF
 * Targets: <3MB, <2s encode time, smooth 60-75 frames
 */
export async function generateCinematicSpin(winningNumber, options = {}) {
  const startTime = Date.now();
  
  const {
    duration = 3500,  // Reduced from 4000ms
    fps = 20,         // Reduced from 30fps for smaller file size
    width = 600,      // Reduced from 800px
    height = 600,     // Reduced from 800px
    quality = 15      // Slightly lower quality for smaller files (higher number = smaller file)
  } = options;

  const frames = Math.floor((duration / 1000) * fps);
  const encoder = new GIFEncoder(width, height);
  
  console.log(`🎬 [OPTIMIZED] Generating spin for #${winningNumber} (${frames} frames @ ${fps}fps, ${width}x${height})`);
  
  encoder.start();
  encoder.setRepeat(0); // Play once
  encoder.setDelay(1000 / fps);
  encoder.setQuality(quality);
  encoder.setTransparent(0x000000);

  // Calculate physics
  const targetAngle = getWinningAngle(winningNumber);
  const totalRotations = 5 + Math.random() * 1.5; // Slightly fewer rotations
  const confettiStartFrame = frames - 10;
  const highlightStartFrame = frames - 15;

  // Track progress
  let lastLogTime = Date.now();

  for (let frame = 0; frame < frames; frame++) {
    const progress = easeOutCubic(frame / frames);
    const angle = (totalRotations * 2 * Math.PI * progress) + targetAngle;
    const speed = calculateSpeed(frame, frames);
    
    // Determine which effects to show
    const isSpinning = frame < frames - 15;
    const showMotionBlur = speed > 0.6 && isSpinning;
    
    let finalCanvas;
    
    if (showMotionBlur) {
      // Render with motion blur (only during fast spinning)
      const { createCanvas } = await import('canvas');
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      
      const blurFrames = renderMotionBlur(angle, speed, null, width, height);
      compositeMotionBlur(ctx, blurFrames);
      
      finalCanvas = canvas;
    } else {
      // Render single frame with all effects
      const showWinningNumber = frame >= frames - 20;
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
        showLighting: !showMotionBlur, // Skip lighting during blur
        showConfetti: frame >= confettiStartFrame,
        confettiProgress,
        showWinningHighlight: frame >= highlightStartFrame,
        highlightProgress
      });
    }
    
    // Add frame to encoder
    const ctx = finalCanvas.getContext('2d');
    encoder.addFrame(ctx);
    
    // Optimized progress logging (every 500ms max)
    const now = Date.now();
    if (now - lastLogTime >= 500 || frame === frames - 1) {
      const percent = ((frame / frames) * 100).toFixed(0);
      const elapsed = ((now - startTime) / 1000).toFixed(1);
      console.log(`  🎞️  ${percent}% | Frame ${frame}/${frames} | ${elapsed}s elapsed`);
      lastLogTime = now;
    }
    
    // Clear canvas for memory
    finalCanvas = null;
  }

  encoder.finish();
  const buffer = encoder.out.getData();
  
  const encodeTime = ((Date.now() - startTime) / 1000).toFixed(2);
  const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
  const sizeKB = (buffer.length / 1024).toFixed(0);
  
  console.log(`✅ GIF Complete: ${sizeMB}MB (${sizeKB}KB) | ${frames} frames | ${encodeTime}s encode | ${fps}fps`);
  
  if (buffer.length > 3 * 1024 * 1024) {
    console.error(`❌ CRITICAL: GIF ${sizeMB}MB exceeds Discord 3MB limit!`);
    throw new Error(`GIF_TOO_LARGE: ${sizeMB}MB exceeds 3MB Discord limit`);
  }
  
  return {
    buffer,
    metadata: {
      sizeBytes: buffer.length,
      sizeMB: parseFloat(sizeMB),
      sizeKB: parseInt(sizeKB),
      frames,
      fps,
      duration,
      encodeTimeSeconds: parseFloat(encodeTime),
      resolution: `${width}x${height}`,
      winningNumber
    }
  };
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


