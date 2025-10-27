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
 * Quartic easeOut for even smoother, more dramatic slowdown
 */
function easeOutQuartic(t) {
  return 1 - Math.pow(1 - t, 4);
}

/**
 * Quintic easeOut for ultra-smooth final deceleration
 */
function easeOutQuintic(t) {
  return 1 - Math.pow(1 - t, 5);
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

    // Remove glow for better compression (we show result overlay instead)
    
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
    ctx.font = "bold 12px Arial"; // Reduced font size for compression
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
    ctx.arc(ballX, ballY, 6, 0, Math.PI * 2); // Slightly smaller ball
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
    width = 300,      // Reduced from 320 for smaller file size
    height = 300,
    duration = 8500,  // 8.5 seconds total (optimized)
    fps = 16,         // 16 FPS (136 frames - optimal balance)
    quality = 8,      // Lower quality = better compression with octree
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
    
    // WHEEL PHYSICS: Rotational kinematics (slower, more realistic)
    const wheelInitialVelocity = 10 + Math.random() * 3; // rad/s (slower for smoother animation)
    const wheelDeceleration = calculateDeceleration(wheelInitialVelocity, targetWheelAngle);
    const wheelStopTime = calculateStopTime(wheelInitialVelocity, wheelDeceleration);
    
    // BALL PHYSICS: Ball spins opposite direction, slightly faster, with visible slowdown
    const ballInitialVelocity = -wheelInitialVelocity * 1.1; // Opposite direction, only 1.1x speed (much slower)
    const ballTotalRotations = 10 + Math.random() * 3; // Fewer rotations for smoother visual
    const ballTotalAngle = Math.PI * 2 * ballTotalRotations;
    
    // Animation timing phases (OPTIMIZED for file size + smooth deceleration)
    const fastSpinTime = 2.5;      // Fast spinning phase
    const slowdownTime = 2.5;      // Visible slowdown phase (dramatic deceleration) - KEEP THIS
    const settlingTime = 1.0;      // Ball settles into pocket (ultra-slow) - KEEP THIS
    const restPhaseTime = 2.5;     // Ball completely still on winning number
    const totalAnimationTime = fastSpinTime + slowdownTime + settlingTime + restPhaseTime; // 8.5s total
    
    // Ball radius
    const maxBallRadius = Math.min(width, height) * 0.42;
    const finalBallRadius = Math.min(width, height) * 0.38;
    
    // Debug logging
    if (debugMode) {
      console.log('🎲 [ROULETTE DEBUG MODE - SIZE OPTIMIZED]');
      console.log(`  Winning Number: ${winningNumber} (index: ${winningIndex})`);
      console.log(`  Target Wheel Angle: ${(targetWheelAngle * 180 / Math.PI).toFixed(2)}°`);
      console.log(`  Wheel: v0=${wheelInitialVelocity.toFixed(2)} rad/s, a=${wheelDeceleration.toFixed(2)} rad/s²`);
      console.log(`  Ball: v0=${ballInitialVelocity.toFixed(2)} rad/s (1.1x wheel speed)`);
      console.log(`  Phases: fast=${fastSpinTime}s, slowdown=${slowdownTime}s, settling=${settlingTime}s, rest=${restPhaseTime}s`);
      console.log(`  Total: ${totalAnimationTime}s | Frames: ${Math.floor((totalAnimationTime * fps))} @ ${fps}fps`);
    }

    let lastLogTime = Date.now();
    
    for (let frame = 0; frame < totalFrames; frame++) {
      try {
        // TIME-BASED ANIMATION (not progress-based for physics)
        const currentTime = (frame / fps); // Current time in seconds
        const progress = frame / totalFrames; // Still needed for other calculations
        
        let wheelRotation, ballAngle, ballRadius, showBall, showResult;
        
        // Calculate cumulative phase times
        const fastSpinEnd = fastSpinTime;
        const slowdownEnd = fastSpinEnd + slowdownTime;
        const settlingEnd = slowdownEnd + settlingTime;
        const restEnd = settlingEnd + restPhaseTime;
        
        if (currentTime <= fastSpinEnd) {
          // ===== PHASE 1: FAST SPIN (0-2.5s) =====
          // Ball and wheel spin at relatively constant speed
          const t = currentTime;
          const phaseProgress = t / fastSpinTime;
          
          // Wheel rotates with physics (smooth deceleration)
          const wheelProgress = easeOutCubic(phaseProgress);
          wheelRotation = targetWheelAngle * wheelProgress * 0.4; // 40% of total rotation in fast phase
          
          // Ball rotates opposite direction at 1.1x speed
          const ballTotalAngleInPhase = ballTotalAngle * 0.5; // 50% of ball rotation in fast phase
          const ballProgress = phaseProgress;
          ballAngle = -(ballTotalAngleInPhase * ballProgress);
          
          // Ball spirals inward gently
          ballRadius = maxBallRadius - (phaseProgress * 0.3 * (maxBallRadius - finalBallRadius));
          
          showBall = true;
          showResult = false;
          
        } else if (currentTime <= slowdownEnd) {
          // ===== PHASE 2: SLOWDOWN (2.5-5s) =====
          // Ball VISIBLY slows down dramatically
          const phaseTime = currentTime - fastSpinEnd;
          const phaseProgress = phaseTime / slowdownTime;
          const easedProgress = easeOutQuartic(phaseProgress); // Quartic for dramatic slowdown
          
          // Wheel continues decelerating
          const wheelStartAngle = targetWheelAngle * 0.4;
          const wheelRemainingAngle = targetWheelAngle * 0.55; // Another 55% of rotation
          wheelRotation = wheelStartAngle + (wheelRemainingAngle * easedProgress);
          
          // Ball slows down DRAMATICALLY
          const ballStartAngle = -(ballTotalAngle * 0.5);
          const ballRemainingAngle = ballTotalAngle * 0.45; // Another 45% of ball rotation
          ballAngle = ballStartAngle - (ballRemainingAngle * easedProgress);
          
          // Ball continues spiraling inward
          const radiusStart = maxBallRadius - (0.3 * (maxBallRadius - finalBallRadius));
          const radiusRemaining = (maxBallRadius - finalBallRadius) * 0.6;
          ballRadius = radiusStart - (radiusRemaining * easedProgress);
          
          showBall = true;
          showResult = false;
          
        } else if (currentTime <= settlingEnd) {
          // ===== PHASE 3: SETTLING (5-6s) =====
          // Ball ultra-slowly settles into winning pocket
          const phaseTime = currentTime - slowdownEnd;
          const phaseProgress = phaseTime / settlingTime;
          const easedProgress = easeOutQuintic(phaseProgress); // Quintic for ultra-smooth settling
          
          // Wheel reaches final position smoothly
          const wheelStartAngle = targetWheelAngle * 0.95;
          const wheelRemainingAngle = targetWheelAngle * 0.05; // Final 5%
          wheelRotation = wheelStartAngle + (wheelRemainingAngle * easedProgress);
          
          // Ball slowly settles to landing position
          const ballStartAngle = -(ballTotalAngle * 0.95);
          let angleDiff = BALL_LANDING_POSITION - ballStartAngle;
          
          // Normalize angle difference to shortest path
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          
          ballAngle = ballStartAngle + (angleDiff * easedProgress);
          
          // Ball reaches final radius
          const radiusStart = maxBallRadius - (0.9 * (maxBallRadius - finalBallRadius));
          const radiusRemaining = (maxBallRadius - finalBallRadius) * 0.1;
          ballRadius = radiusStart - (radiusRemaining * easedProgress);
          
          showBall = true;
          showResult = false;
          
        } else if (currentTime <= restEnd) {
          // ===== PHASE 4: REST (6-8.5s) =====
          // Ball is COMPLETELY STILL on winning number
          wheelRotation = targetWheelAngle;
          ballAngle = BALL_LANDING_POSITION;
          ballRadius = finalBallRadius;
          
          showBall = true;
          showResult = false;
          
        } else {
          // ===== PHASE 5: RESULT OVERLAY =====
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

