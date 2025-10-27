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
 * Rotational kinematics: Calculate angle at time t
 * angle(t) = initialVelocity * t - 0.5 * deceleration * t^2
 */
function calculateRotationAngle(initialVelocity, deceleration, time) {
  return initialVelocity * time - 0.5 * deceleration * time * time;
}

/**
 * Calculate deceleration needed to reach target angle with given initial velocity
 * Using: finalAngle = initialVelocity * t - 0.5 * deceleration * t^2
 * And: finalVelocity = 0 = initialVelocity - deceleration * t
 * Solving: deceleration = 2 * initialVelocity^2 / (2 * finalAngle)
 */
function calculateDeceleration(initialVelocity, targetAngle) {
  return (initialVelocity * initialVelocity) / (2 * targetAngle);
}

/**
 * Calculate time to stop given initial velocity and deceleration
 * finalVelocity = 0 = initialVelocity - deceleration * time
 */
function calculateStopTime(initialVelocity, deceleration) {
  return initialVelocity / deceleration;
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
    width = 320,      // Optimized for <3MB
    height = 320,
    duration = 8000,  // 8 seconds total (physics + rest)
    fps = 16,         // 16 FPS for smooth motion
    quality = 10,     // Balanced quality
    debugMode = false // Enable debug logging
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

    // ===== PHYSICS-BASED ROULETTE SIMULATION =====
    
    // Find winning segment index
    const winningIndex = ROULETTE_NUMBERS.findIndex((s) => s.num === winningNumber);
    if (winningIndex === -1) throw new Error(`Invalid winning number: ${winningNumber}`);
    
    const segmentAngle = (Math.PI * 2) / ROULETTE_NUMBERS.length; // ~9.73° per segment
    
    // FIXED: Ball landing position at TOP of canvas (12 o'clock)
    const BALL_LANDING_POSITION = -Math.PI / 2;
    
    // Random offset within winning segment (±30% of segment width)
    const randomOffset = (Math.random() - 0.5) * segmentAngle * 0.6;
    
    // Calculate exact final wheel angle to align winning segment with ball
    // Formula: wheelRotation + (winningIndex * segmentAngle) = BALL_LANDING_POSITION + randomOffset
    const targetSegmentAngle = BALL_LANDING_POSITION - (winningIndex * segmentAngle) + randomOffset;
    
    // Add random rotations (8-12 full spins for realism)
    const randomFullRotations = 8 + Math.random() * 4;
    const targetWheelAngle = (Math.PI * 2 * randomFullRotations) + targetSegmentAngle;
    
    // WHEEL PHYSICS: Rotational kinematics
    const wheelInitialVelocity = 15 + Math.random() * 5; // rad/s (randomized)
    const wheelDeceleration = calculateDeceleration(wheelInitialVelocity, targetWheelAngle);
    const wheelStopTime = calculateStopTime(wheelInitialVelocity, wheelDeceleration);
    
    // BALL PHYSICS: Ball spins opposite direction, faster, decelerates quicker
    const ballInitialVelocity = -wheelInitialVelocity * 1.5; // Opposite direction, 1.5x speed
    const ballTotalRotations = 15 + Math.random() * 5;
    const ballTotalAngle = Math.PI * 2 * ballTotalRotations;
    const ballDeceleration = calculateDeceleration(Math.abs(ballInitialVelocity), ballTotalAngle);
    const ballStopTime = calculateStopTime(Math.abs(ballInitialVelocity), ballDeceleration);
    
    // Animation timing
    const spinPhaseTime = Math.min(wheelStopTime, ballStopTime); // Until ball stops spinning
    const dropPhaseTime = 0.5; // Ball drops into pocket
    const restPhaseTime = 2.5; // Ball rests on winning number
    const totalAnimationTime = spinPhaseTime + dropPhaseTime + restPhaseTime;
    
    // Ball radius
    const maxBallRadius = Math.min(width, height) * 0.42;
    const finalBallRadius = Math.min(width, height) * 0.38;
    
    // Debug logging
    if (debugMode) {
      console.log('🎲 [ROULETTE DEBUG MODE]');
      console.log(`  Winning Number: ${winningNumber} (index: ${winningIndex})`);
      console.log(`  Target Wheel Angle: ${(targetWheelAngle * 180 / Math.PI).toFixed(2)}°`);
      console.log(`  Wheel: v0=${wheelInitialVelocity.toFixed(2)} rad/s, a=${wheelDeceleration.toFixed(2)} rad/s², t=${wheelStopTime.toFixed(2)}s`);
      console.log(`  Ball: v0=${ballInitialVelocity.toFixed(2)} rad/s, a=${ballDeceleration.toFixed(2)} rad/s², t=${ballStopTime.toFixed(2)}s`);
      console.log(`  Animation: spin=${spinPhaseTime.toFixed(2)}s, drop=${dropPhaseTime}s, rest=${restPhaseTime}s`);
    }

    let lastLogTime = Date.now();
    
    for (let frame = 0; frame < totalFrames; frame++) {
      try {
        // TIME-BASED ANIMATION (not progress-based)
        const currentTime = (frame / fps); // Current time in seconds
        const normalizedTime = currentTime / totalAnimationTime; // For phase detection
        
        let wheelRotation, ballAngle, ballRadius, showBall, showResult;
        
        if (currentTime <= spinPhaseTime) {
          // ===== SPIN PHASE: Physics-based rotation =====
          const t = currentTime;
          
          // Wheel rotation using kinematic equation: θ = v0*t - 0.5*a*t²
          wheelRotation = calculateRotationAngle(wheelInitialVelocity, wheelDeceleration, t);
          
          // Ball rotation (opposite direction, faster initial speed)
          const ballCurrentAngle = calculateRotationAngle(Math.abs(ballInitialVelocity), ballDeceleration, t);
          ballAngle = -ballCurrentAngle; // Negative for opposite direction
          
          // Ball spirals inward smoothly
          const spiralProgress = t / spinPhaseTime;
          ballRadius = maxBallRadius - (spiralProgress * (maxBallRadius - finalBallRadius));
          
          showBall = true;
          showResult = false;
          
        } else if (currentTime <= spinPhaseTime + dropPhaseTime) {
          // ===== DROP PHASE: Ball settles into winning pocket =====
          const dropProgress = (currentTime - spinPhaseTime) / dropPhaseTime;
          const easedDrop = easeOutCubic(dropProgress);
          
          // Wheel is at final position
          wheelRotation = targetWheelAngle;
          
          // Ball smoothly moves to landing position
          const ballAngleAtSpinEnd = -ballTotalAngle;
          let angleDiff = BALL_LANDING_POSITION - ballAngleAtSpinEnd;
          
          // Normalize angle difference to shortest path
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          
          ballAngle = ballAngleAtSpinEnd + (angleDiff * easedDrop);
          ballRadius = finalBallRadius;
          
          showBall = true;
          showResult = false;
          
        } else if (currentTime <= spinPhaseTime + dropPhaseTime + restPhaseTime) {
          // ===== REST PHASE: Ball sits on winning number =====
          wheelRotation = targetWheelAngle;
          ballAngle = BALL_LANDING_POSITION;
          ballRadius = finalBallRadius;
          
          showBall = true;
          showResult = false;
          
        } else {
          // ===== RESULT PHASE: Show overlay =====
          wheelRotation = targetWheelAngle;
          ballAngle = BALL_LANDING_POSITION;
          ballRadius = finalBallRadius;
          
          showBall = false; // Hide ball during result overlay
          showResult = true;
        }

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

    // HARD LIMIT: Reject if over 2.9MB (safety margin for Discord's 3MB limit)
    const MAX_SIZE_BYTES = 2.9 * 1024 * 1024;
    if (buffer.length > MAX_SIZE_BYTES) {
      console.error(`❌ CRITICAL: GIF ${sizeMB}MB exceeds 2.9MB safety limit!`);
      console.error(`   Discord limit is 3MB, using 2.9MB for safety margin`);
      throw new Error(`GIF_TOO_LARGE: ${sizeMB}MB exceeds safe limit (max 2.9MB)`);
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

