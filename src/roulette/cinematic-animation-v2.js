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
  { num: 0, color: 'green' },
  { num: 32, color: 'red' },
  { num: 15, color: 'black' },
  { num: 19, color: 'red' },
  { num: 4, color: 'black' },
  { num: 21, color: 'red' },
  { num: 2, color: 'black' },
  { num: 25, color: 'red' },
  { num: 17, color: 'black' },
  { num: 34, color: 'red' },
  { num: 6, color: 'black' },
  { num: 27, color: 'red' },
  { num: 13, color: 'black' },
  { num: 36, color: 'red' },
  { num: 11, color: 'black' },
  { num: 30, color: 'red' },
  { num: 8, color: 'black' },
  { num: 23, color: 'red' },
  { num: 10, color: 'black' },
  { num: 5, color: 'red' },
  { num: 24, color: 'black' },
  { num: 16, color: 'red' },
  { num: 33, color: 'black' },
  { num: 1, color: 'red' },
  { num: 20, color: 'black' },
  { num: 14, color: 'red' },
  { num: 31, color: 'black' },
  { num: 9, color: 'red' },
  { num: 22, color: 'black' },
  { num: 18, color: 'red' },
  { num: 29, color: 'black' },
  { num: 7, color: 'red' },
  { num: 28, color: 'black' },
  { num: 12, color: 'red' },
  { num: 35, color: 'black' },
  { num: 3, color: 'red' },
  { num: 26, color: 'black' },
];

const CASINO_COLORS = {
  tableDark: '#010807',
  tableLight: '#04251a',
  woodDark: '#3f2c22',
  woodLight: '#6f4c3c',
  brassDark: '#a46a11',
  brassLight: '#fcd34d',
  pocketRed: '#aa1615',
  pocketBlack: '#10161f',
  pocketGreen: '#0f5d3b',
  pocketHighlight: '#fde68a',
  pocketHighlightOuter: '#f59e0b',
  numberText: '#f9fafb',
  numberShadow: 'rgba(0, 0, 0, 0.55)',
  ballMetal: '#f2f2f2',
  ballShadow: 'rgba(0, 0, 0, 0.45)',
  ballHighlight: 'rgba(255, 255, 255, 0.85)',
};

const BALL_LANDING_ANGLE = -Math.PI / 2;
const MAX_BALL_TRAIL_POINTS = 6;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeAngle(angle) {
  const tau = Math.PI * 2;
  return ((angle % tau) + tau) % tau;
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function updateBallTrail(trail, position) {
  if (!position) {
    return;
  }

  trail.push(position);
  while (trail.length > MAX_BALL_TRAIL_POINTS) {
    trail.shift();
  }
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
 * Draw complete roulette frame with authentic casino styling
 * NO BRANDING - Clean professional casino aesthetic
 */
function drawRouletteFrame({
  ctx,
  width,
  height,
  wheelRotation,
  ballAngle,
  ballRadius,
  ballTrail,
  showBall,
  winningNumber,
  winningIndex,
  highlightStrength,
  showResult,
}) {
  const centerX = width / 2;
  const centerY = height / 2;
  const wheelRadius = Math.min(width, height) * 0.36;
  const pocketAngle = (Math.PI * 2) / ROULETTE_NUMBERS.length;

  // Velvet table background with subtle vignette
  const tableGradient = ctx.createRadialGradient(centerX, centerY, width * 0.1, centerX, centerY, width * 0.65);
  tableGradient.addColorStop(0, CASINO_COLORS.tableLight);
  tableGradient.addColorStop(1, CASINO_COLORS.tableDark);
  ctx.fillStyle = tableGradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(centerX, centerY);

  // Wood rim with polished sheen
  ctx.beginPath();
  ctx.arc(0, 0, wheelRadius + 44, 0, Math.PI * 2);
  const woodGradient = ctx.createRadialGradient(0, 0, wheelRadius, 0, 0, wheelRadius + 44);
  woodGradient.addColorStop(0, CASINO_COLORS.woodLight);
  woodGradient.addColorStop(1, CASINO_COLORS.woodDark);
  ctx.fillStyle = woodGradient;
  ctx.fill();

  // Brass ring with soft reflection
  ctx.beginPath();
  ctx.arc(0, 0, wheelRadius + 20, 0, Math.PI * 2);
  const brassGradient = ctx.createRadialGradient(0, 0, wheelRadius * 0.92, 0, 0, wheelRadius + 22);
  brassGradient.addColorStop(0, CASINO_COLORS.brassLight);
  brassGradient.addColorStop(1, CASINO_COLORS.brassDark);
  ctx.fillStyle = brassGradient;
  ctx.fill();

  ctx.rotate(wheelRotation);

  for (let i = 0; i < ROULETTE_NUMBERS.length; i++) {
    const segment = ROULETTE_NUMBERS[i];
    const startAngle = i * pocketAngle;
    const endAngle = startAngle + pocketAngle;

    const segmentBaseColor =
      segment.color === 'green' ? CASINO_COLORS.pocketGreen : segment.color === 'red' ? CASINO_COLORS.pocketRed : CASINO_COLORS.pocketBlack;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, wheelRadius, startAngle, endAngle);
    ctx.closePath();

    // Slight radial gradient for depth
    const pocketGradient = ctx.createRadialGradient(0, 0, wheelRadius * 0.35, 0, 0, wheelRadius);
    pocketGradient.addColorStop(0, segmentBaseColor);
    pocketGradient.addColorStop(0.9, segmentBaseColor);
    pocketGradient.addColorStop(1, '#050505');
    ctx.fillStyle = pocketGradient;
    ctx.fill();

    // Golden separators
    ctx.strokeStyle = 'rgba(255, 215, 128, 0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    // Engraved pocket dividers
    ctx.save();
    ctx.rotate(startAngle);
    ctx.beginPath();
    ctx.moveTo(wheelRadius * 0.87, 0);
    ctx.lineTo(wheelRadius, 0);
    ctx.strokeStyle = 'rgba(180, 180, 180, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Pocket numbering with drop shadow
    ctx.save();
    ctx.rotate(startAngle + pocketAngle / 2);
    ctx.fillStyle = CASINO_COLORS.numberShadow;
    ctx.font = 'bold 14px "Arial"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(segment.num.toString(), wheelRadius * 0.73 + 1.5, 1.2);
    ctx.fillStyle = CASINO_COLORS.numberText;
    ctx.fillText(segment.num.toString(), wheelRadius * 0.73, 0);
    ctx.restore();
  }

  // Highlight the winning pocket with glow
  if (highlightStrength > 0 && winningIndex >= 0) {
    ctx.save();
    ctx.rotate(winningIndex * pocketAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, wheelRadius, 0, pocketAngle);
    ctx.closePath();
    const glowStrength = clamp(highlightStrength, 0, 1);
    ctx.fillStyle = `rgba(253, 230, 138, ${0.35 * glowStrength})`;
    ctx.fill();

    ctx.lineWidth = 6;
    ctx.strokeStyle = `rgba(245, 158, 11, ${0.55 * glowStrength})`;
    ctx.stroke();
    ctx.restore();
  }

  // Inner reflective surface
  ctx.beginPath();
  ctx.arc(0, 0, wheelRadius * 0.86, 0, Math.PI * 2);
  const reflectionGradient = ctx.createRadialGradient(0, 0, wheelRadius * 0.2, 0, 0, wheelRadius * 0.86);
  reflectionGradient.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
  reflectionGradient.addColorStop(1, 'rgba(120, 120, 120, 0.45)');
  ctx.fillStyle = reflectionGradient;
  ctx.fill();

  // Center hub polished steel
  const hubRadius = wheelRadius * 0.26;
  ctx.beginPath();
  ctx.arc(0, 0, hubRadius, 0, Math.PI * 2);
  const hubGradient = ctx.createRadialGradient(0, 0, hubRadius * 0.35, 0, 0, hubRadius);
  hubGradient.addColorStop(0, '#d1d5db');
  hubGradient.addColorStop(0.6, '#9ca3af');
  hubGradient.addColorStop(1, '#4b5563');
  ctx.fillStyle = hubGradient;
  ctx.fill();

  ctx.restore();

  // Ball trail for cinematic motion blur
  if (showBall && ballTrail.length > 1) {
    for (let i = 0; i < ballTrail.length - 1; i++) {
      const alpha = (i + 1) / ballTrail.length;
      const point = ballTrail[i];
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4 - i * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.12 * alpha})`;
      ctx.fill();
    }
  }

  if (showBall) {
    const ballX = centerX + Math.cos(ballAngle) * ballRadius;
    const ballY = centerY + Math.sin(ballAngle) * ballRadius;
    const ballGradient = ctx.createRadialGradient(ballX - 2, ballY - 2, 1, ballX, ballY, 8);
    ballGradient.addColorStop(0, CASINO_COLORS.ballHighlight);
    ballGradient.addColorStop(0.6, CASINO_COLORS.ballMetal);
    ballGradient.addColorStop(1, CASINO_COLORS.ballShadow);
    ctx.beginPath();
    ctx.arc(ballX, ballY, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = ballGradient;
    ctx.fill();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.stroke();
  }

  if (showResult) {
    const winningSegment = ROULETTE_NUMBERS[winningIndex];
    const colorEmoji = winningSegment.color === 'red' ? '🔴' : winningSegment.color === 'black' ? '⚫' : '🟢';

    const overlayHeight = 86;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.fillRect(0, height - overlayHeight, width, overlayHeight);

    const accentGradient = ctx.createLinearGradient(0, height - overlayHeight, 0, height - overlayHeight + 6);
    accentGradient.addColorStop(0, CASINO_COLORS.brassLight);
    accentGradient.addColorStop(1, CASINO_COLORS.brassDark);
    ctx.fillStyle = accentGradient;
    ctx.fillRect(0, height - overlayHeight, width, 6);

    ctx.font = '600 34px "Arial"';
    ctx.fillStyle = CASINO_COLORS.pocketHighlight;
    ctx.textAlign = 'center';
    ctx.fillText(`${colorEmoji} ${winningSegment.num}`, centerX, height - 40);

    ctx.font = '600 18px "Arial"';
    ctx.fillStyle = CASINO_COLORS.numberText;
    ctx.fillText(`${winningSegment.color.toUpperCase()} WINS`, centerX, height - 16);
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

  const totalDurationSeconds = duration / 1000;
  const totalFrames = Math.floor(totalDurationSeconds * fps);

  console.log(
    `🎬 [V2 REALISTIC] Generating spin for #${winningNumber} (${totalFrames} frames @ ${fps}fps, ${width}x${height})`,
  );

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

    const winningIndex = ROULETTE_NUMBERS.findIndex((s) => s.num === winningNumber);
    if (winningIndex === -1) throw new Error(`Invalid winning number: ${winningNumber}`);

    const pocketAngle = (Math.PI * 2) / ROULETTE_NUMBERS.length;
    const pocketCenterAngle = winningIndex * pocketAngle + pocketAngle / 2;

    const landingOffset = (Math.random() - 0.5) * pocketAngle * 0.18;
    const ballLandingAngle = BALL_LANDING_ANGLE + landingOffset;

    const wheelAlignment = normalizeAngle(ballLandingAngle - pocketCenterAngle);
    const additionalWheelRotations = 6.5 + Math.random() * 4.5; // 6.5 - 11 full rotations
    const totalWheelRotation = Math.PI * 2 * additionalWheelRotations + wheelAlignment;

    const fastSpinTime = 2.6;
    const slowdownTime = 2.3;
    const settlingTime = 1.1;
    const spinDuration = fastSpinTime + slowdownTime + settlingTime;
    const restPhaseTime = 1.9;
    const overlayStart = spinDuration + restPhaseTime;

    const wheelInitialVelocity = (2 * totalWheelRotation) / spinDuration;
    const wheelDeceleration = wheelInitialVelocity / spinDuration;

    const ballExtraRotations = 3 + Math.random() * 1.4;
    const ballTotalRotations = additionalWheelRotations + ballExtraRotations;
    const ballTotalTravel = Math.PI * 2 * ballTotalRotations;
    const ballStopTime = spinDuration * 0.94;
    const ballInitialVelocity = (2 * ballTotalTravel) / ballStopTime;
    const ballDeceleration = ballInitialVelocity / ballStopTime;
    const ballStartAngle = ballLandingAngle + ballTotalTravel;

    const maxBallRadius = Math.min(width, height) * 0.425;
    const finalBallRadius = Math.min(width, height) * 0.375;
    const radiusEaseEnd = spinDuration - settlingTime * 0.4;

    if (debugMode) {
      console.log('🎲 [ROULETTE DEBUG MODE - REALISTIC]');
      console.log(`  Winning Number: ${winningNumber} (index: ${winningIndex})`);
      console.log(`  Landing offset: ${(landingOffset * 180 / Math.PI).toFixed(2)}°`);
      console.log(`  Wheel rotations: ${additionalWheelRotations.toFixed(2)} | Total angle ${(totalWheelRotation * 180 / Math.PI).toFixed(1)}°`);
      console.log(`  Wheel physics: v0=${wheelInitialVelocity.toFixed(2)} rad/s, dec=${wheelDeceleration.toFixed(3)} rad/s², stop=${spinDuration.toFixed(2)}s`);
      console.log(`  Ball physics: travel=${ballTotalRotations.toFixed(2)} rev, v0=${ballInitialVelocity.toFixed(2)} rad/s, stop=${ballStopTime.toFixed(2)}s`);
      console.log(`  Timeline: spin=${spinDuration.toFixed(2)}s, rest=${restPhaseTime.toFixed(2)}s, overlay=${Math.max(totalDurationSeconds - overlayStart, 0).toFixed(2)}s`);
    }

    const centerX = width / 2;
    const centerY = height / 2;
    const ballTrail = [];
    let lastLogTime = Date.now();

    for (let frame = 0; frame < totalFrames; frame++) {
      try {
        const currentTime = frame / fps;

        const wheelTime = Math.min(currentTime, spinDuration);
        let wheelRotation = wheelInitialVelocity * wheelTime - 0.5 * wheelDeceleration * wheelTime * wheelTime;
        if (currentTime >= spinDuration) {
          wheelRotation = totalWheelRotation;
        }

        const ballTime = Math.min(currentTime, ballStopTime);
        let ballAngle = ballStartAngle - (ballInitialVelocity * ballTime - 0.5 * ballDeceleration * ballTime * ballTime);
        if (currentTime >= ballStopTime) {
          const settleProgress = clamp((currentTime - ballStopTime) / (settlingTime * 0.75), 0, 1);
          ballAngle = lerp(ballAngle, ballLandingAngle, easeOutQuintic(settleProgress));
        }

        const radiusProgress = clamp(currentTime / radiusEaseEnd, 0, 1);
        let ballRadius = lerp(maxBallRadius, finalBallRadius * 1.05, easeOutQuartic(radiusProgress));
        if (currentTime >= spinDuration - settlingTime) {
          const settleRadiusProgress = clamp((currentTime - (spinDuration - settlingTime)) / settlingTime, 0, 1);
          const wobble = Math.sin(settleRadiusProgress * Math.PI) * 2.2 * (1 - settleRadiusProgress);
          ballRadius = finalBallRadius + wobble;
        }

        const highlightStrength = currentTime >= spinDuration ? clamp((currentTime - spinDuration) / 0.9, 0, 1) : 0;
        const showResult = currentTime >= overlayStart;
        const showBall = currentTime <= overlayStart;

        const ballPosition = showBall
          ? {
              x: centerX + Math.cos(ballAngle) * ballRadius,
              y: centerY + Math.sin(ballAngle) * ballRadius,
            }
          : null;

        updateBallTrail(ballTrail, ballPosition);

        drawRouletteFrame({
          ctx,
          width,
          height,
          wheelRotation,
          ballAngle,
          ballRadius,
          ballTrail,
          showBall,
          winningNumber,
          winningIndex,
          highlightStrength: showResult ? 1 : highlightStrength,
          showResult,
        });

        encoder.addFrame(ctx);

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
 * Get animation status (removed - use safe-animation.js instead)
 * This function is not used - getAnimationStatus is exported from safe-animation.js
 */

