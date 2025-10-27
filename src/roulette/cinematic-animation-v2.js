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
 * Draw complete roulette frame with authentic casino styling
 * NO BRANDING - Clean professional casino aesthetic
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
  const wheelRadius = Math.min(width, height) * 0.36;

  // Dark background with subtle radial gradient
  const bgGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, width * 0.6);
  bgGradient.addColorStop(0, "#1a1a1a");
  bgGradient.addColorStop(1, "#0a0a0a");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(centerX, centerY);

  // Polished wood outer rim
  const outerRimGradient = ctx.createRadialGradient(0, 0, wheelRadius + 20, 0, 0, wheelRadius + 40);
  outerRimGradient.addColorStop(0, "#5d4037");
  outerRimGradient.addColorStop(0.5, "#4e342e");
  outerRimGradient.addColorStop(1, "#3e2723");
  ctx.beginPath();
  ctx.arc(0, 0, wheelRadius + 40, 0, Math.PI * 2);
  ctx.fillStyle = outerRimGradient;
  ctx.fill();
  ctx.strokeStyle = "#2c1810";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Brass/gold metallic ring with realistic shine
  const metalRingGradient = ctx.createRadialGradient(0, 0, wheelRadius + 8, 0, 0, wheelRadius + 18);
  metalRingGradient.addColorStop(0, "#d4af37");
  metalRingGradient.addColorStop(0.3, "#f4e5b0");
  metalRingGradient.addColorStop(0.5, "#c9a227");
  metalRingGradient.addColorStop(0.7, "#f4e5b0");
  metalRingGradient.addColorStop(1, "#b8941e");
  ctx.beginPath();
  ctx.arc(0, 0, wheelRadius + 18, 0, Math.PI * 2);
  ctx.fillStyle = metalRingGradient;
  ctx.fill();
  ctx.strokeStyle = "#9a7b1a";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Rotate wheel
  ctx.rotate(wheelRotation);

  const segmentAngle = (Math.PI * 2) / ROULETTE_NUMBERS.length;

  // Draw segments with authentic casino colors
  for (let i = 0; i < ROULETTE_NUMBERS.length; i++) {
    const segment = ROULETTE_NUMBERS[i];
    const startAngle = i * segmentAngle;
    const endAngle = startAngle + segmentAngle;

    let baseColor, darkColor;
    if (segment.color === "green") {
      baseColor = "#047857";
      darkColor = "#065f46";
    } else if (segment.color === "red") {
      baseColor = "#b91c1c";
      darkColor = "#991b1b";
    } else {
      baseColor = "#1f2937";
      darkColor = "#111827";
    }

    ctx.save();

    // Winning number glow effect
    if (showResult && segment.num === winningNumber) {
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 30;
    }

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, wheelRadius, startAngle, endAngle);
    ctx.closePath();

    const segGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, wheelRadius);
    segGradient.addColorStop(0, baseColor);
    segGradient.addColorStop(0.8, baseColor);
    segGradient.addColorStop(1, darkColor);
    ctx.fillStyle = segGradient;
    ctx.fill();

    // Thin gold separator lines
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Chrome metal pocket dividers
    ctx.save();
    ctx.rotate(startAngle);
    ctx.beginPath();
    ctx.moveTo(wheelRadius * 0.85, 0);
    ctx.lineTo(wheelRadius, 0);
    ctx.strokeStyle = "#c0c0c0";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Clean white numbers
    ctx.save();
    ctx.rotate(startAngle + segmentAngle / 2);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 4;
    ctx.fillText(segment.num.toString(), wheelRadius * 0.72, 0);
    ctx.restore();
  }

  // Metallic center hub with gradient (silver/gray tones)
  const centerRadius = wheelRadius * 0.25;

  const centerMetalGradient = ctx.createRadialGradient(-5, -5, 0, 0, 0, centerRadius);
  centerMetalGradient.addColorStop(0, "#e0e0e0");
  centerMetalGradient.addColorStop(0.4, "#b0b0b0");
  centerMetalGradient.addColorStop(0.7, "#808080");
  centerMetalGradient.addColorStop(1, "#606060");
  ctx.beginPath();
  ctx.arc(0, 0, centerRadius, 0, Math.PI * 2);
  ctx.fillStyle = centerMetalGradient;
  ctx.fill();
  ctx.strokeStyle = "#404040";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.restore();

  // Chrome ball with motion blur trail
  if (progress < 0.92) {
    const ballX = centerX + Math.cos(ballAngle) * ballRadius;
    const ballY = centerY + Math.sin(ballAngle) * ballRadius;

    // Motion blur trail (4 frames, fades as ball slows)
    const blurAmount = Math.max(0, 1 - progress) * 0.4;
    ctx.globalAlpha = blurAmount;
    for (let i = 1; i <= 4; i++) {
      const trailAngle = ballAngle - i * 0.12;
      const trailX = centerX + Math.cos(trailAngle) * ballRadius;
      const trailY = centerY + Math.sin(trailAngle) * ballRadius;
      ctx.beginPath();
      ctx.arc(trailX, trailY, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#e0e0e0";
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Ball shadow for depth
    ctx.beginPath();
    ctx.arc(ballX + 2, ballY + 2, 8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fill();

    // Ball with realistic chrome gradient
    const ballGradient = ctx.createRadialGradient(ballX - 3, ballY - 3, 1, ballX, ballY, 8);
    ballGradient.addColorStop(0, "#ffffff");
    ballGradient.addColorStop(0.4, "#f0f0f0");
    ballGradient.addColorStop(0.7, "#c0c0c0");
    ballGradient.addColorStop(1, "#909090");
    ctx.beginPath();
    ctx.arc(ballX, ballY, 8, 0, Math.PI * 2);
    ctx.fillStyle = ballGradient;
    ctx.fill();
    ctx.strokeStyle = "#707070";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Shine highlight
    ctx.beginPath();
    ctx.arc(ballX - 2.5, ballY - 2.5, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fill();
  }

  // Result overlay
  if (showResult) {
    const winningSegment = ROULETTE_NUMBERS.find((s) => s.num === winningNumber);
    const colorEmoji = winningSegment.color === "red" ? "🔴" : winningSegment.color === "black" ? "⚫" : "🟢";

    // Semi-transparent black overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(0, height - 100, width, 100);

    // Gold accent bar
    ctx.fillStyle = "#d4af37";
    ctx.fillRect(0, height - 100, width, 3);

    // Winning number in gold
    ctx.font = "bold 48px Arial";
    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "center";
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 20;
    ctx.fillText(`${colorEmoji} ${winningNumber}`, centerX, height - 55);

    // Color name below in white
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 10;
    ctx.fillText(winningSegment.color.toUpperCase(), centerX, height - 25);
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
    width = 450,      // Aggressively optimized for <3MB
    height = 450,
    duration = 9000,  // 9 seconds
    fps = 20,         // 20 FPS (180 total frames for smaller size)
    quality = 20      // Higher number = faster encode, smaller file
  } = options;

  const totalFrames = Math.floor((duration / 1000) * fps);
  
  console.log(`🎬 [V2 CASINO OPTIMIZED] Generating spin for #${winningNumber} (${totalFrames} frames @ ${fps}fps, ${width}x${height})`);

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
    const spinDuration = 0.88; // 88% of animation is spinning, 12% shows result
    
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

        // Wheel rotation (14 full revolutions)
        const wheelRotation = easedProgress * (Math.PI * 14) + targetAngle * easedProgress;

        // Ball physics (counter to wheel direction)
        const ballSpeed = (1 - easedProgress) * 16 + 3;
        const ballAngle = -progress * Math.PI * 2 * ballSpeed;
        const maxRadius = Math.min(width, height) * 0.42; // Starts at outer edge
        const minRadius = Math.min(width, height) * 0.38; // Spirals inward
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

