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
 * Quartic easeOut for even smoother deceleration
 */
function easeOutQuartic(t) {
  return 1 - Math.pow(1 - t, 4);
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
  showResult,
  showBall = true
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const wheelRadius = Math.min(width, height) * 0.36;

  // Dark background (FLAT color for compression)
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(centerX, centerY);

  // Wood rim (FLAT color)
  ctx.beginPath();
  ctx.arc(0, 0, wheelRadius + 40, 0, Math.PI * 2);
  ctx.fillStyle = "#4e342e";
  ctx.fill();

  // Gold ring (FLAT color)
  ctx.beginPath();
  ctx.arc(0, 0, wheelRadius + 18, 0, Math.PI * 2);
  ctx.fillStyle = "#c9a227";
  ctx.fill();

  // Rotate wheel
  ctx.rotate(wheelRotation);

  const segmentAngle = (Math.PI * 2) / ROULETTE_NUMBERS.length;

  // Draw segments with authentic casino colors
  for (let i = 0; i < ROULETTE_NUMBERS.length; i++) {
    const segment = ROULETTE_NUMBERS[i];
    const startAngle = i * segmentAngle;
    const endAngle = startAngle + segmentAngle;

    let baseColor;
    if (segment.color === "green") {
      baseColor = "#047857";
    } else if (segment.color === "red") {
      baseColor = "#b91c1c";
    } else {
      baseColor = "#1f2937";
    }

    ctx.save();

    // Winning number glow (only if showing result)
    if (showResult && segment.num === winningNumber) {
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 20;
    }

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, wheelRadius, startAngle, endAngle);
    ctx.closePath();

    // FLAT color (no gradient)
    ctx.fillStyle = baseColor;
    ctx.fill();

    // Thin gold separator
    ctx.strokeStyle = "#c9a227";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Simplified dividers
    ctx.save();
    ctx.rotate(startAngle);
    ctx.beginPath();
    ctx.moveTo(wheelRadius * 0.85, 0);
    ctx.lineTo(wheelRadius, 0);
    ctx.strokeStyle = "#a0a0a0";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Clean white numbers (NO shadow for compression)
    ctx.save();
    ctx.rotate(startAngle + segmentAngle / 2);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(segment.num.toString(), wheelRadius * 0.72, 0);
    ctx.restore();
  }

  // Center hub (FLAT color)
  const centerRadius = wheelRadius * 0.25;
  ctx.beginPath();
  ctx.arc(0, 0, centerRadius, 0, Math.PI * 2);
  ctx.fillStyle = "#808080";
  ctx.fill();

  ctx.restore();

  // Chrome ball (show during spin and rest periods)
  if (showBall) {
    const ballX = centerX + Math.cos(ballAngle) * ballRadius;
    const ballY = centerY + Math.sin(ballAngle) * ballRadius;

    // Simple ball (NO blur trail, NO shadow, NO gradient)
    ctx.beginPath();
    ctx.arc(ballX, ballY, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#f0f0f0";
    ctx.fill();
    ctx.strokeStyle = "#707070";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Result overlay
  if (showResult) {
    const winningSegment = ROULETTE_NUMBERS.find((s) => s.num === winningNumber);
    const colorEmoji = winningSegment.color === "red" ? "🔴" : winningSegment.color === "black" ? "⚫" : "🟢";

    // Simple black overlay
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, height - 80, width, 80);

    // Gold accent bar
    ctx.fillStyle = "#c9a227";
    ctx.fillRect(0, height - 80, width, 2);

    // Winning number (NO shadow)
    ctx.font = "bold 32px Arial";
    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "center";
    ctx.fillText(`${colorEmoji} ${winningNumber}`, centerX, height - 45);

    // Color name
    ctx.font = "bold 18px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(winningSegment.color.toUpperCase(), centerX, height - 20);
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
    width = 350,      // ULTRA compression for guaranteed <3MB
    height = 350,
    duration = 10500, // 10.5 seconds (longer for smooth animation + 3s rest)
    fps = 15,         // 15 FPS (smoother animation, still fast encoding)
    quality = 6       // 6 = slightly better compression speed, still small
  } = options;

  const totalFrames = Math.floor((duration / 1000) * fps);
  
  console.log(`🎬 [V2 ULTRA-OPTIMIZED] Generating spin for #${winningNumber} (${totalFrames} frames @ ${fps}fps, ${width}x${height})`);

  try {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    validateCanvasContext(ctx);

    // Initialize gif-encoder-2 with OCTREE algorithm (smallest files!)
    const encoder = new GIFEncoder(width, height, 'octree', true);
    encoder.setQuality(quality);       // 10 = good balance (lower = smaller file)
    encoder.setFrameRate(fps);         // Better than setDelay
    encoder.setRepeat(0);              // Loop forever
    encoder.start();

    // Animation parameters (total 10.5 seconds)
    const spinDuration = 0.57;    // 57% fast spinning (6s)
    const slowdownDuration = 0.095; // 9.5% gradual slowdown (1s)
    const restDuration = 0.285;   // 28.5% ball resting still (3s)
    const resultDuration = 0.05;  // 5% showing overlay (0.5s)
    
    // Find winning segment index
    const winningIndex = ROULETTE_NUMBERS.findIndex((s) => s.num === winningNumber);
    const segmentAngle = (Math.PI * 2) / ROULETTE_NUMBERS.length;
    
    // Add random offset so ball doesn't always land at exact same spot
    const randomOffset = (Math.random() - 0.5) * segmentAngle * 0.8; // Random position within 80% of segment
    const targetAngle = -(winningIndex * segmentAngle) + Math.PI / 2 + randomOffset;
    
    // Add random extra rotations (12-16 instead of fixed 14)
    const randomSpins = 12 + Math.random() * 4;

    let lastLogTime = Date.now();

    for (let frame = 0; frame < totalFrames; frame++) {
      try {
        const progress = frame / totalFrames;
        
        // Determine animation phase
        const isSpinning = progress < spinDuration;
        const isSlowingDown = progress >= spinDuration && progress < spinDuration + slowdownDuration;
        const isResting = progress >= spinDuration + slowdownDuration && progress < spinDuration + slowdownDuration + restDuration;
        const showResult = progress >= spinDuration + slowdownDuration + restDuration;
        
        let wheelRotation, ballAngle, ballRadius;
        
        if (isSpinning) {
          // Fast spinning phase
          const spinProgress = progress / spinDuration;
          const easedProgress = easeOutQuartic(spinProgress);
          wheelRotation = easedProgress * (Math.PI * 2 * randomSpins) + targetAngle * easedProgress;
          
          const ballSpeed = (1 - easedProgress) * 16 + 3;
          ballAngle = -progress * Math.PI * 2 * ballSpeed;
          const maxRadius = Math.min(width, height) * 0.42;
          const minRadius = Math.min(width, height) * 0.38;
          ballRadius = maxRadius - easedProgress * (maxRadius - minRadius);
          
        } else if (isSlowingDown) {
          // Gradual slowdown phase (1 second)
          const slowdownProgress = (progress - spinDuration) / slowdownDuration;
          const easeSlowdown = easeOutCubic(slowdownProgress); // Gentler for slowdown
          
          // Wheel continues to target angle
          const finalSpin = 1.0; // Almost at target
          wheelRotation = (finalSpin) * (Math.PI * 2 * randomSpins) + targetAngle * (1.0 - slowdownProgress * 0.1);
          
          // Ball gradually settles
          const startBallSpeed = 3;
          const endBallSpeed = 0.2;
          const ballSpeed = startBallSpeed - (startBallSpeed - endBallSpeed) * easeSlowdown;
          ballAngle = -((spinDuration + slowdownProgress * slowdownDuration) * Math.PI * 2 * ballSpeed) - targetAngle * slowdownProgress;
          ballRadius = Math.min(width, height) * 0.38;
          
        } else {
          // Resting or result: completely still
          wheelRotation = (Math.PI * 2 * randomSpins) + targetAngle;
          ballAngle = -targetAngle; // Aligned with winning segment
          ballRadius = Math.min(width, height) * 0.38;
        }
        
        const showBall = !showResult; // Hide ball only during result overlay

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
          showResult,
          showBall
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

