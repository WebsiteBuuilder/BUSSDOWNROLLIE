import GIFEncoder from 'gif-encoder-2';
import { createCanvas } from 'canvas';
import { getWheelOrder } from './cinematic-wheel.js';
import {
  validateCanvasContext,
  getCanvasDimensions
} from './safe-canvas-utils.js';

/**
 * REVAMPED Cinematic Roulette Animation
 * Using gif-encoder-2 with neuquant for better compression
 * 9-second animation with realistic ball physics
 */

// Roulette wheel configuration (standard European order)
const ROULETTE_NUMBERS = [
  { num: 0, color: "green" },
  { num: 32, color: "red" },
  { num: 15, color: "black" },
  { num: 19, color: "red" },
  { num: 4, color: "black" },
  { num: 21, color: "red" },
  { num: 2, color: "black" },
  { num: 25, color: "red" },
  { num: 17, color: "black" },
  { num: 34, color: "red" },
  { num: 6, color: "black" },
  { num: 27, color: "red" },
  { num: 13, color: "black" },
  { num: 36, color: "red" },
  { num: 11, color: "black" },
  { num: 30, color: "red" },
  { num: 8, color: "black" },
  { num: 23, color: "red" },
  { num: 10, color: "black" },
  { num: 5, color: "red" },
  { num: 24, color: "black" },
  { num: 16, color: "red" },
  { num: 33, color: "black" },
  { num: 1, color: "red" },
  { num: 20, color: "black" },
  { num: 14, color: "red" },
  { num: 31, color: "black" },
  { num: 9, color: "red" },
  { num: 22, color: "black" },
  { num: 18, color: "red" },
  { num: 29, color: "black" },
  { num: 7, color: "red" },
  { num: 28, color: "black" },
  { num: 12, color: "red" },
  { num: 35, color: "black" },
  { num: 3, color: "red" },
  { num: 26, color: "black" },
];

/**
 * Cubic easeOut for smooth deceleration
 */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Draw complete roulette frame with professional styling
 */
function drawRouletteFrame(
  ctx,
  width,
  height,
  wheelRotation,
  ballAngle,
  ballRadius,
  progress,
  winningNumber,
  showResult
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const wheelRadius = Math.min(width, height) * 0.38;

  // Background with green felt gradient
  const bgGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, width * 0.7);
  bgGradient.addColorStop(0, "#0d4d2d");
  bgGradient.addColorStop(0.6, "#0a3d24");
  bgGradient.addColorStop(1, "#051a10");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  // Subtle texture
  ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    ctx.fillRect(x, y, 1, 1);
  }

  // Title with casino neon effect
  ctx.save();
  ctx.font = "bold 36px Arial";
  const titleGradient = ctx.createLinearGradient(0, 35, width, 35);
  titleGradient.addColorStop(0, "#00FF88");
  titleGradient.addColorStop(0.5, "#FFD700");
  titleGradient.addColorStop(1, "#00FF88");
  ctx.fillStyle = titleGradient;
  ctx.textAlign = "center";
  ctx.shadowColor = "#00FF88";
  ctx.shadowBlur = 25;
  ctx.fillText("STILL GUUHHHD 🎰", centerX, 45);
  ctx.restore();

  ctx.save();
  ctx.translate(centerX, centerY);

  // Wooden rim
  const rimGradient = ctx.createRadialGradient(0, 0, wheelRadius + 15, 0, 0, wheelRadius + 35);
  rimGradient.addColorStop(0, "#8B4513");
  rimGradient.addColorStop(0.5, "#654321");
  rimGradient.addColorStop(1, "#3d2817");
  ctx.beginPath();
  ctx.arc(0, 0, wheelRadius + 35, 0, Math.PI * 2);
  ctx.fillStyle = rimGradient;
  ctx.fill();

  // Chrome border
  const chromeGradient = ctx.createRadialGradient(0, 0, wheelRadius + 10, 0, 0, wheelRadius + 20);
  chromeGradient.addColorStop(0, "#E8E8E8");
  chromeGradient.addColorStop(0.3, "#C0C0C0");
  chromeGradient.addColorStop(0.5, "#A8A8A8");
  chromeGradient.addColorStop(0.7, "#C0C0C0");
  chromeGradient.addColorStop(1, "#909090");
  ctx.beginPath();
  ctx.arc(0, 0, wheelRadius + 15, 0, Math.PI * 2);
  ctx.fillStyle = chromeGradient;
  ctx.fill();
  ctx.strokeStyle = "#707070";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Rotate wheel
  ctx.rotate(wheelRotation);

  const segmentAngle = (Math.PI * 2) / ROULETTE_NUMBERS.length;

  // Draw segments
  for (let i = 0; i < ROULETTE_NUMBERS.length; i++) {
    const segment = ROULETTE_NUMBERS[i];
    const startAngle = i * segmentAngle - Math.PI / 2;
    const endAngle = startAngle + segmentAngle;

    let segmentColor, shadowColor;
    if (segment.color === "green") {
      segmentColor = "#00843D";
      shadowColor = "#005A29";
    } else if (segment.color === "red") {
      segmentColor = "#D50000";
      shadowColor = "#8B0000";
    } else {
      segmentColor = "#1C1C1C";
      shadowColor = "#0A0A0A";
    }

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Winning number glow effect
    if (showResult && segment.num === winningNumber) {
      ctx.shadowColor = "#00FF88";
      ctx.shadowBlur = 40;
    }

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, wheelRadius, startAngle, endAngle);
    ctx.closePath();

    const segGradient = ctx.createRadialGradient(0, 0, wheelRadius * 0.3, 0, 0, wheelRadius);
    segGradient.addColorStop(0, segmentColor);
    segGradient.addColorStop(1, shadowColor);
    ctx.fillStyle = segGradient;
    ctx.fill();

    ctx.strokeStyle = "#D4AF37";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Diamond separators
    ctx.save();
    ctx.rotate(startAngle + segmentAngle / 2);
    ctx.beginPath();
    ctx.moveTo(wheelRadius - 15, -5);
    ctx.lineTo(wheelRadius - 10, 0);
    ctx.lineTo(wheelRadius - 15, 5);
    ctx.lineTo(wheelRadius - 20, 0);
    ctx.closePath();
    ctx.fillStyle = "#D4AF37";
    ctx.fill();
    ctx.strokeStyle = "#B8941E";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Numbers
    ctx.save();
    ctx.rotate(startAngle + segmentAngle / 2);
    ctx.translate(wheelRadius * 0.7, 0);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 3;
    ctx.fillText(segment.num.toString(), 0, 0);
    ctx.restore();
  }

  // Center hub
  const centerRadius = wheelRadius * 0.28;

  // Gold chrome ring
  const centerChromeGradient = ctx.createRadialGradient(0, 0, centerRadius * 0.9, 0, 0, centerRadius);
  centerChromeGradient.addColorStop(0, "#D4AF37");
  centerChromeGradient.addColorStop(0.5, "#B8941E");
  centerChromeGradient.addColorStop(1, "#8B7220");
  ctx.beginPath();
  ctx.arc(0, 0, centerRadius, 0, Math.PI * 2);
  ctx.fillStyle = centerChromeGradient;
  ctx.fill();
  ctx.strokeStyle = "#6B5A1A";
  ctx.lineWidth = 4;
  ctx.stroke();

  // Inner dark circle
  const innerCenterGradient = ctx.createRadialGradient(-5, -5, 0, 0, 0, centerRadius * 0.85);
  innerCenterGradient.addColorStop(0, "#3a3a3a");
  innerCenterGradient.addColorStop(0.5, "#2a2a2a");
  innerCenterGradient.addColorStop(1, "#1a1a1a");
  ctx.beginPath();
  ctx.arc(0, 0, centerRadius * 0.85, 0, Math.PI * 2);
  ctx.fillStyle = innerCenterGradient;
  ctx.fill();

  // GUHD EATS branding
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#00FF88";
  ctx.shadowBlur = 15;
  ctx.fillText("GUHD", 0, -10);
  ctx.font = "bold 20px Arial";
  ctx.fillText("EATS", 0, 12);

  ctx.restore();

  // Ball with motion blur
  if (progress < 0.95) {
    const ballX = centerX + Math.cos(ballAngle) * ballRadius;
    const ballY = centerY + Math.sin(ballAngle) * ballRadius;

    // Motion blur trail (more intense when faster)
    const blurIntensity = Math.max(0.1, 1 - progress);
    ctx.globalAlpha = 0.25 * blurIntensity;
    for (let i = 1; i <= 6; i++) {
      const trailAngle = ballAngle - i * 0.08;
      const trailRadius = ballRadius + i * 1.5;
      const trailX = centerX + Math.cos(trailAngle) * trailRadius;
      const trailY = centerY + Math.sin(trailAngle) * trailRadius;

      ctx.beginPath();
      ctx.arc(trailX, trailY, 9 - i * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = "#F0F0F0";
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Ball shadow
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(ballX + 3, ballY + 3, 9, 0, Math.PI * 2);
    ctx.fillStyle = "#000000";
    ctx.fill();
    ctx.restore();

    // Ball with chrome gradient
    const ballGradient = ctx.createRadialGradient(ballX - 4, ballY - 4, 1, ballX, ballY, 10);
    ballGradient.addColorStop(0, "#FFFFFF");
    ballGradient.addColorStop(0.3, "#F5F5F5");
    ballGradient.addColorStop(0.6, "#D0D0D0");
    ballGradient.addColorStop(0.85, "#A0A0A0");
    ballGradient.addColorStop(1, "#707070");

    ctx.beginPath();
    ctx.arc(ballX, ballY, 10, 0, Math.PI * 2);
    ctx.fillStyle = ballGradient;
    ctx.fill();
    ctx.strokeStyle = "#505050";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Shine highlights
    ctx.beginPath();
    ctx.arc(ballX - 3, ballY - 3, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(ballX + 2, ballY - 1, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fill();
  }

  // Result overlay
  if (showResult) {
    const winningSegment = ROULETTE_NUMBERS.find((s) => s.num === winningNumber);
    const colorEmoji = winningSegment.color === "red" ? "🔴" : winningSegment.color === "black" ? "⚫" : "🟢";
    const colorName = winningSegment.color.toUpperCase();

    // Dark overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, height - 120, width, 120);

    // Gold accent line
    ctx.fillStyle = "#FFD700";
    ctx.fillRect(0, height - 120, width, 4);

    // Winning number display
    ctx.font = "bold 56px Arial";
    ctx.fillStyle = "#FFD700";
    ctx.textAlign = "center";
    ctx.shadowColor = "#00FF88";
    ctx.shadowBlur = 30;
    ctx.fillText(`🎯 ${winningNumber}`, centerX, height - 75);

    // Color indicator
    ctx.font = "bold 28px Arial";
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowBlur = 15;
    ctx.fillText(`${colorEmoji} ${colorName}`, centerX, height - 35);
  }
}

/**
 * Generate optimized roulette GIF with gif-encoder-2
 */
export async function generateCinematicSpin(winningNumber, options = {}) {
  const startTime = Date.now();
  
  // Validate winning number
  if (typeof winningNumber !== 'number' || winningNumber < 0 || winningNumber > 36) {
    throw new Error(`Invalid winning number: ${winningNumber} (must be 0-36)`);
  }

  const {
    width = 600,
    height = 600,
    duration = 9000,  // 9 seconds
    fps = 30,         // 30 FPS
    quality = 15      // Balanced quality
  } = options;

  const totalFrames = Math.floor((duration / 1000) * fps);
  
  console.log(`🎬 [V2 OPTIMIZED] Generating spin for #${winningNumber} (${totalFrames} frames @ ${fps}fps, ${width}x${height})`);

  try {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    validateCanvasContext(ctx);

    // Initialize gif-encoder-2 with neuquant algorithm
    const encoder = new GIFEncoder(width, height, 'neuquant', true);
    encoder.setDelay(1000 / fps);
    encoder.setQuality(quality);
    encoder.start();

    // Animation parameters
    const spinDuration = 0.85; // 85% of animation is spinning
    
    // Find winning segment index
    const winningIndex = ROULETTE_NUMBERS.findIndex((s) => s.num === winningNumber);
    const segmentAngle = (Math.PI * 2) / ROULETTE_NUMBERS.length;
    const targetAngle = -(winningIndex * segmentAngle) + Math.PI / 2;

    let lastLogTime = Date.now();

    for (let frame = 0; frame < totalFrames; frame++) {
      try {
        const progress = frame / totalFrames;
        const spinProgress = Math.min(progress / spinDuration, 1);
        const easedProgress = easeOutCubic(spinProgress);

        // Wheel rotation
        const wheelRotation = easedProgress * (Math.PI * 16) + targetAngle * easedProgress;

        // Ball physics
        const ballSpeed = (1 - easedProgress) * 18 + 4;
        const ballAngle = -progress * Math.PI * 2 * ballSpeed;
        const maxRadius = Math.min(width, height) * 0.44;
        const minRadius = Math.min(width, height) * 0.39;
        const ballRadius = maxRadius - easedProgress * (maxRadius - minRadius);

        const showResult = progress > spinDuration;

        // Draw frame
        drawRouletteFrame(
          ctx,
          width,
          height,
          wheelRotation,
          ballAngle,
          ballRadius,
          progress,
          winningNumber,
          showResult
        );

        encoder.addFrame(ctx);

        // Progress logging
        const now = Date.now();
        if (now - lastLogTime >= 500 || frame === totalFrames - 1) {
          const percent = ((frame / totalFrames) * 100).toFixed(0);
          const elapsed = ((now - startTime) / 1000).toFixed(1);
          console.log(`  🎞️  ${percent}% | Frame ${frame}/${totalFrames} | ${elapsed}s elapsed`);
          lastLogTime = now;
        }

      } catch (frameError) {
        console.error(`❌ Error rendering frame ${frame}:`, frameError.message);
        throw new Error(`Frame ${frame} render failed: ${frameError.message}`);
      }
    }

    encoder.finish();
    const buffer = encoder.out.getData();

    const encodeTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    const sizeKB = (buffer.length / 1024).toFixed(0);

    console.log(`✅ GIF Complete: ${sizeMB}MB (${sizeKB}KB) | ${totalFrames} frames | ${encodeTime}s encode | ${fps}fps`);

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
        frames: totalFrames,
        fps,
        duration,
        encodeTimeSeconds: parseFloat(encodeTime),
        resolution: `${width}x${height}`,
        winningNumber
      }
    };

  } catch (error) {
    console.error('❌ Cinematic animation generation failed:', error);
    throw error;
  }
}

/**
 * Validate animation is available
 */
export async function validateCinematicAnimation() {
  try {
    console.log('🔍 Validating cinematic animation system (V2)...');
    
    // Test canvas
    const testCanvas = createCanvas(50, 50);
    const ctx = testCanvas.getContext('2d');
    ctx.fillRect(0, 0, 50, 50);
    
    validateCanvasContext(ctx);
    
    console.log('✅ Cinematic animation V2 validated successfully');
    return true;
  } catch (error) {
    console.error('❌ Cinematic animation V2 validation FAILED');
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

/**
 * Get animation status
 */
export function getAnimationStatus() {
  return {
    available: true,
    mode: 'CINEMATIC_V2_NEUQUANT'
  };
}

