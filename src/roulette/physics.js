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
    pocketsList: [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 37, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2]
  }
};

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
  // Validate inputs
  if (!WHEEL_CONFIGURATIONS[layout]) {
    throw new Error(`Invalid layout type: ${layout}. Must be 'european' or 'american'`);
  }
  
  if (winningNumber < 0 || winningNumber > 36) {
    throw new Error(`Invalid winning number: ${winningNumber}. Must be between 0 and 36`);
  }
  
  // Get wheel configuration
  const config = WHEEL_CONFIGURATIONS[layout];
  
  // Calculate total frames
  const totalFrames = Math.ceil(duration * fps);
  
  // Convert RPM to rad/s
  const wheelOmega0 = wheelRpm0 * 2 * Math.PI / 60;
  const ballOmega0 = ballRpm0 * 2 * Math.PI / 60;
  
  // Calculate ball drop frame
  const dropThresholdRpm = 20; // Ball drops at 20 RPM
  const dropFrame = calculateBallDropFrame(ballRpm0, kBall, dropThresholdRpm, fps);
  
  // Find the winning pocket index
  const winningPocketIndex = config.pocketsList.indexOf(winningNumber);
  
  if (winningPocketIndex === -1) {
    throw new Error(`Winning number ${winningNumber} not found in ${layout} layout`);
  }
  
  // Calculate the target angle for the winning pocket
  const pocketAngle = 2 * Math.PI / config.pockets;
  const winningPocketAngle = winningPocketIndex * pocketAngle;
  
  // Calculate initial angle for wheel to ensure deterministic landing
  const totalWheelAngle = calculateAngularPosition(wheelOmega0, kWheel, duration);
  const ballTotalAngle = laps * 2 * Math.PI + totalWheelAngle + winningPocketAngle;
  
  // Calculate where ball should be at drop time to land on winning pocket
  const wheelAngleAtDrop = calculateAngularPosition(wheelOmega0, kWheel, dropFrame / fps);
  
  // Initial ball angle calculation with offset to ensure landing on correct pocket
  const ballAngleAtDrop = calculateAngularPosition(ballOmega0, kBall, dropFrame / fps);
  
  // Adjust initial ball angle so that at drop time, the relative position is correct
  const angleOffset = ballAngleAtDrop - wheelAngleAtDrop - winningPocketAngle;
  const ballInitialAngle = (laps * 2 * Math.PI) - angleOffset;
  
  // Calculate angles for each frame
  const wheelAngles = new Array(totalFrames);
  const ballAngles = new Array(totalFrames);
  
  for (let frame = 0; frame < totalFrames; frame++) {
    const time = frame / fps;
    
    // Wheel angle
    wheelAngles[frame] = calculateAngularPosition(wheelOmega0, kWheel, time);
    
    // Ball angle (before drop, follows physics; after drop, follows deterministic path)
    if (frame <= dropFrame) {
      ballAngles[frame] = ballInitialAngle + calculateAngularPosition(ballOmega0, kBall, time);
    } else {
      // After drop, calculate path to winning pocket
      const timeSinceDrop = time - dropFrame / fps;
      const wheelAngle = wheelAngles[frame];
      
      // Ball rolls down to pocket with controlled deceleration
      const ballDropDeceleration = kBall * 2; // Faster deceleration when on wheel
      const ballDropOmega0 = dropThresholdRpm * 2 * Math.PI / 60;
      
      const ballDropAngle = calculateAngularPosition(ballDropOmega0, ballDropDeceleration, timeSinceDrop);
      ballAngles[frame] = wheelAngle + winningPocketAngle - ballDropAngle;
    }
    
    // Normalize angles to 0-2π range
    wheelAngles[frame] = wheelAngles[frame] % (2 * Math.PI);
    ballAngles[frame] = ballAngles[frame] % (2 * Math.PI);
  }
  
  return {
    wheelAngles,
    ballAngles,
    dropFrame,
    totalFrames,
    winningPocketIndex,
    pocketAngle,
    layout
  };
}

/**
 * Get the number that corresponds to a specific angle on the wheel
 * 
 * @param {number} angle - Angle in radians (0 to 2π)
 * @param {string} layout - Wheel layout type
 * @returns {number} Pocket number at the given angle
 */
function getPocketFromAngle(angle, layout) {
  const config = WHEEL_CONFIGURATIONS[layout];
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
  const config = WHEEL_CONFIGURATIONS[layout];
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
  const diff = Math.abs(((angle1 - angle2) % (2 * Math.PI)) + Math.PI) - Math.PI;
  return Math.abs(diff);
}

/**
 * Verify that a spin plan results in the correct winning number
 * 
 * @param {Object} spinPlan - Spin plan object from computeSpinPlan
 * @returns {boolean} True if the ball lands on the winning pocket
 */
function verifySpinPlan(spinPlan) {
  const finalBallAngle = spinPlan.ballAngles[spinPlan.totalFrames - 1];
  const finalWheelAngle = spinPlan.wheelAngles[spinPlan.totalFrames - 1];
  
  // Calculate relative position
  const relativeAngle = ((finalBallAngle - finalWheelAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  
  // Find which pocket this corresponds to
  const landingIndex = Math.floor(relativeAngle / spinPlan.pocketAngle);
  const config = WHEEL_CONFIGURATIONS[spinPlan.layout];
  
  if (landingIndex >= config.pocketsList.length) {
    return false;
  }
  
  const landingNumber = config.pocketsList[landingIndex];
  const targetIndex = config.pocketsList.indexOf(spinPlan.winningPocketIndex);
  
  return landingNumber === targetIndex;
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
