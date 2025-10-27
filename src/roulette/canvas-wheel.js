import { createCanvas } from 'canvas';

/**
 * European Roulette Wheel Renderer using Canvas
 * Generates high-quality 800x800px wheel images with casino-style visuals
 */

// European roulette wheel order (0-36)
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

// Casino colors (GUHD EATS theme)
const COLORS = {
  red: '#E74C3C',
  black: '#2C3E50',
  green: '#27AE60',
  gold: '#FFD700',
  goldDark: '#DAA520',
  white: '#FFFFFF',
  zinc: '#18181B',
  shadow: 'rgba(0, 0, 0, 0.5)'
};

/**
 * Get the color of a roulette number
 */
function getNumberColor(num) {
  if (num === 0) return 'green';
  return RED_NUMBERS.includes(num) ? 'red' : 'black';
}

/**
 * Render a static roulette wheel with optional winning number highlight
 * @param {number|null} winningNumber - The winning number to highlight (null for no highlight)
 * @param {number} rotation - Rotation angle in degrees (default 0)
 * @returns {Canvas} Canvas object containing the rendered wheel
 */
export function renderStaticWheel(winningNumber = null, rotation = 0) {
  const size = 800;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const centerX = size / 2;
  const centerY = size / 2;
  const outerRadius = 380;
  const innerRadius = 100;
  const pocketCount = WHEEL_ORDER.length;

  // Clear background
  ctx.fillStyle = COLORS.zinc;
  ctx.fillRect(0, 0, size, size);

  // Save context for rotation
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((rotation * Math.PI) / 180);

  // Draw outer gold border
  const goldGradient = ctx.createRadialGradient(0, 0, outerRadius - 50, 0, 0, outerRadius + 20);
  goldGradient.addColorStop(0, COLORS.goldDark);
  goldGradient.addColorStop(0.5, COLORS.gold);
  goldGradient.addColorStop(1, COLORS.goldDark);
  
  ctx.fillStyle = goldGradient;
  ctx.beginPath();
  ctx.arc(0, 0, outerRadius + 20, 0, Math.PI * 2);
  ctx.fill();

  // Draw pockets
  const anglePerPocket = (Math.PI * 2) / pocketCount;
  
  for (let i = 0; i < pocketCount; i++) {
    const number = WHEEL_ORDER[i];
    const color = getNumberColor(number);
    const startAngle = i * anglePerPocket - Math.PI / 2;
    const endAngle = startAngle + anglePerPocket;
    const isWinning = winningNumber !== null && number === winningNumber;

    // Draw pocket
    ctx.beginPath();
    ctx.arc(0, 0, outerRadius, startAngle, endAngle);
    ctx.arc(0, 0, innerRadius, endAngle, startAngle, true);
    ctx.closePath();

    // Fill with appropriate color
    ctx.fillStyle = COLORS[color];
    ctx.fill();

    // Add gold glow for winning number
    if (isWinning) {
      ctx.save();
      ctx.shadowColor = COLORS.gold;
      ctx.shadowBlur = 30;
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }

    // Draw white border between pockets
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(
      Math.cos(startAngle) * innerRadius,
      Math.sin(startAngle) * innerRadius
    );
    ctx.lineTo(
      Math.cos(startAngle) * outerRadius,
      Math.sin(startAngle) * outerRadius
    );
    ctx.stroke();

    // Draw number
    const midAngle = startAngle + anglePerPocket / 2;
    const textRadius = (outerRadius + innerRadius) / 2;
    const textX = Math.cos(midAngle) * textRadius;
    const textY = Math.sin(midAngle) * textRadius;

    ctx.save();
    ctx.translate(textX, textY);
    ctx.rotate(midAngle + Math.PI / 2);
    
    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Add gold shadow for winning number
    if (isWinning) {
      ctx.shadowColor = COLORS.gold;
      ctx.shadowBlur = 15;
    }
    
    ctx.fillText(number.toString(), 0, 0);
    ctx.restore();
  }

  // Draw inner circle (center hub)
  const centerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, innerRadius);
  centerGradient.addColorStop(0, COLORS.zinc);
  centerGradient.addColorStop(1, COLORS.black);
  
  ctx.fillStyle = centerGradient;
  ctx.beginPath();
  ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
  ctx.fill();

  // Draw gold inner border
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(0, 0, innerRadius - 4, 0, Math.PI * 2);
  ctx.stroke();

  // Draw center logo area
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GUHD', 0, -15);
  
  ctx.font = 'bold 24px Arial';
  ctx.fillText('EATS', 0, 15);

  ctx.restore();

  return canvas;
}

/**
 * Render a single frame of the spinning wheel with ball
 * @param {number} rotation - Wheel rotation in degrees
 * @param {number} ballAngle - Ball position angle in degrees
 * @param {number} ballRadius - Distance of ball from center
 * @returns {Canvas} Canvas object containing the rendered frame
 */
export function renderSpinningWheel(rotation, ballAngle, ballRadius = 350) {
  const canvas = renderStaticWheel(null, rotation);
  const ctx = canvas.getContext('2d');
  const centerX = 400;
  const centerY = 400;

  // Calculate ball position
  const ballX = centerX + Math.cos((ballAngle * Math.PI) / 180) * ballRadius;
  const ballY = centerY + Math.sin((ballAngle * Math.PI) / 180) * ballRadius;

  // Draw ball shadow
  ctx.save();
  ctx.shadowColor = COLORS.shadow;
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 5;
  ctx.shadowOffsetY = 5;

  // Draw ball
  const ballGradient = ctx.createRadialGradient(
    ballX - 5,
    ballY - 5,
    2,
    ballX,
    ballY,
    15
  );
  ballGradient.addColorStop(0, COLORS.white);
  ballGradient.addColorStop(0.7, '#CCCCCC');
  ballGradient.addColorStop(1, '#999999');

  ctx.fillStyle = ballGradient;
  ctx.beginPath();
  ctx.arc(ballX, ballY, 15, 0, Math.PI * 2);
  ctx.fill();

  // Ball border
  ctx.strokeStyle = COLORS.white;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();

  return canvas;
}

/**
 * Calculate ball position with physics-based deceleration
 * @param {number} frame - Current frame number (0-based)
 * @param {number} totalFrames - Total number of frames
 * @param {number} targetPocket - The pocket index the ball should land in
 * @returns {Object} { rotation, ballAngle, ballRadius }
 */
export function calculateBallPhysics(frame, totalFrames, targetPocket) {
  const progress = frame / totalFrames;
  
  // Easing function: fast start, slow end (cubic ease-out)
  const easeOut = 1 - Math.pow(1 - progress, 3);
  
  // Wheel rotation (multiple full spins)
  const totalWheelRotation = 360 * 8; // 8 full rotations
  const wheelRotation = easeOut * totalWheelRotation;
  
  // Ball moves counter-clockwise (opposite to wheel)
  const totalBallRotation = 360 * 10; // 10 full rotations
  const targetAngle = (targetPocket / WHEEL_ORDER.length) * 360;
  const ballAngle = -easeOut * totalBallRotation + targetAngle;
  
  // Ball radius (moves inward as it slows down)
  const startRadius = 370;
  const endRadius = 280;
  const ballRadius = startRadius - (startRadius - endRadius) * Math.pow(easeOut, 2);
  
  return {
    rotation: wheelRotation % 360,
    ballAngle: ballAngle % 360,
    ballRadius
  };
}

/**
 * Get the pocket index for a given number
 * @param {number} number - The roulette number
 * @returns {number} The pocket index
 */
export function getPocketIndex(number) {
  return WHEEL_ORDER.indexOf(number);
}

/**
 * Render the result wheel with winning highlight
 * @param {number} winningNumber - The winning number
 * @returns {Canvas} Canvas object containing the result
 */
export function renderResultWheel(winningNumber) {
  const pocketIndex = getPocketIndex(winningNumber);
  const anglePerPocket = 360 / WHEEL_ORDER.length;
  const targetAngle = pocketIndex * anglePerPocket;
  
  // Rotate so winning number is at top
  const rotation = -targetAngle + 90;
  
  return renderStaticWheel(winningNumber, rotation);
}

