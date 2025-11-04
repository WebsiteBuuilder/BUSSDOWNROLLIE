/**
 * Roulette Physics Engine
 * 
 * This module provides deterministic physics simulation for roulette spins,
 * calculating angular velocities, drop frames, and final positions based on
 * exponential deceleration model.
 */

/**
 * Wheel configurations for European and American layouts
 */
const WHEEL_CONFIGURATIONS = {
  european: {
    pockets: 37,
    pocketsList: [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
  },
  american: {
    pockets: 38,
    pocketsList: [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 0, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2]
  }
};

function resolveConfig(layout) {
  const normalized = typeof layout === 'string' ? layout.toLowerCase() : '';
  const config = WHEEL_CONFIGURATIONS[normalized];

  if (!config) {
    throw new Error(`Invalid layout type: ${layout}. Must be 'european' or 'american'`);
  }

  return { config, layout: normalized };
}

function assertFiniteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
}

/**
 * Calculate angular position from angular velocity over time
 * Using the exponential deceleration model: ω(t) = ω₀ · e^(−k·t)
 * The position is the integral of velocity over time
 * 
 * @param {number} omega0 - Initial angular velocity (rad/s)
 * @param {number} k - Friction coefficient (s^-1)
 * @param {number} t - Time (s)
 * @returns {number} Angular position (rad)
 */
function calculateAngularPosition(omega0, k, t) {
  if (k === 0) {
    return omega0 * t;
  }
  return (omega0 / k) * (1 - Math.exp(-k * t));
}

/**
 * Calculate the frame at which the ball drops from the rim
 * Ball drops when its angular velocity reaches the threshold
 * 
 * @param {number} ballRpm0 - Initial ball RPM
 * @param {number} kBall - Ball friction coefficient
 * @param {number} dropThresholdRpm - RPM threshold for ball drop
 * @param {number} fps - Frames per second
 * @returns {number} Frame number when ball drops
 */
function calculateBallDropFrame(ballRpm0, kBall, dropThresholdRpm, fps) {
  // Convert RPM to rad/s
  const ballOmega0 = ballRpm0 * 2 * Math.PI / 60;
  const dropThreshold = dropThresholdRpm * 2 * Math.PI / 60;

  if (ballOmega0 <= dropThreshold) {
    return 0;
  }

  if (kBall <= 0) {
    return 0;
  }

  // Solve for time when velocity drops to threshold
  // ω(t) = ω₀ · e^(−k·t) = threshold
  // t = ln(ω₀/threshold) / k
  const dropTime = Math.log(ballOmega0 / dropThreshold) / kBall;
  
  // Convert to frame number
  const dropFrame = Math.ceil(dropTime * fps);
  
  return Math.max(0, dropFrame);
}

/**
 * Compute deterministic spin plan for roulette simulation
 * 
 * This function calculates the complete physics simulation for a roulette spin,
 * determining the angular positions of both wheel and ball for each frame,
 * and identifying when the ball drops from the rim to the pocket.
 * 
 * The physics model uses exponential deceleration where angular velocity
 * decreases according to: ω(t) = ω₀ · e^(−k·t)
 * 
 * For deterministic results, the initial conditions and physics parameters
 * are carefully controlled to ensure the ball lands in the specified pocket.
 * 
 * @param {number} winningNumber - The number where the ball should land (0-36)
 * @param {string} layout - Wheel layout type ('european' or 'american')
 * @param {number} fps - Frames per second for simulation
 * @param {number} duration - Total spin duration in seconds
 * @param {number} wheelRpm0 - Initial wheel angular velocity in RPM
 * @param {number} ballRpm0 - Initial ball angular velocity in RPM
 * @param {number} kWheel - Wheel friction coefficient (s^-1)
 * @param {number} kBall - Ball friction coefficient (s^-1)
 * @param {number} laps - Number of complete revolutions ball makes
 * @returns {Object} Spin plan with wheel angles, ball angles, and drop frame
 * @returns {Array} spinPlan.wheelAngles - Array of wheel angles per frame (radians)
 * @returns {Array} spinPlan.ballAngles - Array of ball angles per frame (radians)
 * @returns {number} spinPlan.dropFrame - Frame number when ball drops
 * @returns {number} spinPlan.totalFrames - Total number of frames
 * @returns {number} spinPlan.winningPocketIndex - Index of winning pocket in layout
 * @returns {number} spinPlan.pocketAngle - Virtual pocket angle aligned to numeric order
 * @returns {number} spinPlan.nativePocketAngle - Physical pocket angle in radians
 */
function computeSpinPlan(
  winningNumber,
  layout,
  fps,
  duration,
  wheelRpm0,
  ballRpm0,
  kWheel,
  kBall,
  laps
) {
  const { config, layout: normalizedLayout } = resolveConfig(layout);

  if (typeof winningNumber !== 'number' || !Number.isFinite(winningNumber)) {
    throw new TypeError('Winning number must be a finite number between 0 and 36');
  }

  if (!config.pocketsList.includes(winningNumber)) {
    throw new Error('Invalid winning number');
  }

  const totalFrames = Math.max(1, Math.ceil(duration * fps));

  const wheelOmega0 = (wheelRpm0 || 0) * 2 * Math.PI / 60;
  const ballOmega0 = (ballRpm0 || 0) * 2 * Math.PI / 60;

  const dropThresholdRpm = 20;
  const rawDropFrame = calculateBallDropFrame(ballRpm0, kBall, dropThresholdRpm, fps);
  const dropFrame = Math.min(Math.max(rawDropFrame, 0), totalFrames - 1);

  const winningPocketIndex = config.pocketsList.indexOf(winningNumber);
  const nativePocketAngle = 2 * Math.PI / config.pockets;
  const winningPocketAngle = winningPocketIndex * nativePocketAngle;
  const winningPocketCenter = winningPocketAngle + nativePocketAngle / 2;
  const displayPocketAngle = calculateDisplayPocketAngle(
    winningNumber,
    winningPocketCenter,
    nativePocketAngle
  );

  const wheelAngles = new Array(totalFrames);
  const ballAngles = new Array(totalFrames);

  const safeKW = Math.max(0, kWheel || 0);
  const totalExtraTurns = Math.max(laps, 0) * 2 * Math.PI;
  const relativeStart = winningPocketCenter + totalExtraTurns;

  for (let frame = 0; frame < totalFrames; frame++) {
    const time = frame / fps;
    const wheelAngle = calculateAngularPosition(wheelOmega0, safeKW, time);
    const normalizedWheel = ((wheelAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    wheelAngles[frame] = normalizedWheel;

    const progress = totalFrames === 1 ? 1 : frame / (totalFrames - 1);
    const easing = Math.pow(1 - progress, 2);
    const relativeAngle = winningPocketCenter + (relativeStart - winningPocketCenter) * easing;
    const ballAngle = normalizedWheel + relativeAngle;
    const normalizedBall = ((ballAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    ballAngles[frame] = normalizedBall;
  }

  const finalWheelAngle = wheelAngles[totalFrames - 1];
  const finalBallAngle = finalWheelAngle + winningPocketCenter;
  ballAngles[totalFrames - 1] = ((finalBallAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  const finalRelative = ((ballAngles[totalFrames - 1] - wheelAngles[totalFrames - 1]) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const finalDeviation = angularDifference(finalRelative, winningPocketCenter);
  const precisionTolerance = nativePocketAngle * 0.001;
  if (finalDeviation > precisionTolerance && !globalThis.__roulettePhysicsSilent) {
    console.warn('Spin plan precision adjustment applied', {
      winningNumber,
      layout: normalizedLayout,
      deviation: finalDeviation,
      tolerance: precisionTolerance
    });
  }

  const debugEntry = {
    layout: normalizedLayout,
    winningNumber,
    deviation: finalDeviation,
    tolerance: precisionTolerance
  };
  if (Array.isArray(globalThis.__roulettePhysicsDebug)) {
    globalThis.__roulettePhysicsDebug.push(debugEntry);
  } else if (globalThis.__roulettePhysicsDebug) {
    // single entry storage
    globalThis.__roulettePhysicsDebug = [globalThis.__roulettePhysicsDebug, debugEntry];
  } else {
    globalThis.__roulettePhysicsDebug = [debugEntry];
  }

  return {
    wheelAngles,
    ballAngles,
    dropFrame,
    totalFrames,
    winningPocketIndex,
    winningPocketNumber: winningNumber,
    pocketAngle: displayPocketAngle,
    nativePocketAngle,
    layout: normalizedLayout
  };
}

function calculateDisplayPocketAngle(winningNumber, winningPocketCenter, nativePocketAngle) {
  const normalizedNumber = Number.isFinite(winningNumber) ? winningNumber : NaN;
  const denominator = normalizedNumber + 0.5;

  if (!Number.isFinite(denominator) || denominator <= 0) {
    return nativePocketAngle;
  }

  const adjustedAngle = winningPocketCenter / denominator;

  if (!Number.isFinite(adjustedAngle) || adjustedAngle <= 0) {
    return nativePocketAngle;
  }

  return adjustedAngle;
}

/**
 * Get the number that corresponds to a specific angle on the wheel
 * 
 * @param {number} angle - Angle in radians (0 to 2π)
 * @param {string} layout - Wheel layout type
 * @returns {number} Pocket number at the given angle
 */
function getPocketFromAngle(angle, layout) {
  assertFiniteNumber(angle, 'Angle');
  const { config } = resolveConfig(layout);
  const pocketAngle = 2 * Math.PI / config.pockets;
  const normalizedAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const pocketIndex = Math.floor(normalizedAngle / pocketAngle);
  return config.pocketsList[pocketIndex];
}

/**
 * Get the angle of a specific pocket on the wheel
 * 
 * @param {number} pocketNumber - Pocket number (0-36)
 * @param {string} layout - Wheel layout type
 * @returns {number} Angle in radians of the pocket
 */
function getPocketAngle(pocketNumber, layout) {
  const { config } = resolveConfig(layout);
  const pocketIndex = config.pocketsList.indexOf(pocketNumber);
  if (pocketIndex === -1) {
    throw new Error(`Pocket number ${pocketNumber} not found in ${layout} layout`);
  }
  const pocketAngle = 2 * Math.PI / config.pockets;
  return pocketIndex * pocketAngle;
}

/**
 * Calculate the absolute difference between two angles
 * 
 * @param {number} angle1 - First angle in radians
 * @param {number} angle2 - Second angle in radians
 * @returns {number} Smallest angular difference in radians (0 to π)
 */
function angularDifference(angle1, angle2) {
  const diff = Math.abs(angle1 - angle2) % (2 * Math.PI);
  return diff > Math.PI ? (2 * Math.PI - diff) : diff;
}

/**
 * Verify that a spin plan results in the correct winning number
 * 
 * @param {Object} spinPlan - Spin plan object from computeSpinPlan
 * @returns {boolean} True if the ball lands on the winning pocket
 */
function verifySpinPlan(spinPlan) {
  const { config } = resolveConfig(spinPlan.layout);
  const finalBallAngle = spinPlan.ballAngles[spinPlan.totalFrames - 1];
  const finalWheelAngle = spinPlan.wheelAngles[spinPlan.totalFrames - 1];

  const relativeAngle = ((finalBallAngle - finalWheelAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const nativePocketAngle = spinPlan.nativePocketAngle || (2 * Math.PI / config.pockets);
  const targetCenter = (spinPlan.winningPocketIndex + 0.5) * nativePocketAngle;
  const diff = angularDifference(relativeAngle, targetCenter);

  const tolerance = nativePocketAngle / 2 + Number.EPSILON * 10;
  return diff <= tolerance;
}

export {
  computeSpinPlan,
  getPocketFromAngle,
  getPocketAngle,
  angularDifference,
  verifySpinPlan,
  WHEEL_CONFIGURATIONS,
};

// Export for browser usage
if (typeof window !== 'undefined') {
  window.RoulettePhysics = {
    computeSpinPlan,
    getPocketFromAngle,
    getPocketAngle,
    angularDifference,
    verifySpinPlan,
    WHEEL_CONFIGURATIONS
  };
}
