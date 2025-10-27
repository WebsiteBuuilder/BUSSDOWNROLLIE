import { createCanvas } from 'canvas';

/**
 * Cinematic 3D Roulette Wheel Renderer
 * Features: Perspective tilt, depth shadows, neon glow, GUHD EATS branding
 */

// European roulette wheel order (0-36)
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

// GUHD EATS color system
const COLORS = {
  neonGreen: '#00FF75',
  gold: '#FFD700',
  goldDark: '#DAA520',
  red: '#E74C3C',
  black: '#2C3E50',
  green: '#27AE60',
  white: '#FFFFFF',
  zinc: '#18181B',
  darkBg: '#0A0A0A',
  glowGreen: 'rgba(0, 255, 117, 0.8)',
  glowGold: 'rgba(255, 215, 0, 0.8)',
  shadow: 'rgba(0, 0, 0, 0.6)'
};

// Perspective constants
export const PERSPECTIVE_FACTOR = 0.6; // Ellipse height compression (3D tilt)
const DEPTH_SCALE = 0.15; // Size variation by depth

/**
 * Get the color of a roulette number
 */
function getNumberColor(num) {
  if (num === 0) return 'green';
  return RED_NUMBERS.includes(num) ? 'red' : 'black';
}

/**
 * Transform Y coordinate for 3D perspective
 */
function applyPerspective(y, centerY) {
  const offset = y - centerY;
  return centerY + (offset * PERSPECTIVE_FACTOR);
}

/**
 * Calculate scale based on Y position (depth)
 */
function getDepthScale(y, height) {
  return 1 - ((y / height) - 0.5) * DEPTH_SCALE;
}

/**
 * Draw background with gradient
 */
function drawBackground(ctx, width, height) {
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, 0,
    width / 2, height / 2, width / 2
  );
  gradient.addColorStop(0, '#1a1a1a');
  gradient.addColorStop(1, COLORS.darkBg);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Draw depth shadow beneath wheel
 */
export function drawDepthShadow(ctx, centerX, centerY, radius) {
  ctx.save();
  
  const shadowGradient = ctx.createRadialGradient(
    centerX, centerY + 30, 0,
    centerX, centerY + 30, radius * 1.2
  );
  shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
  shadowGradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.4)');
  shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  
  ctx.fillStyle = shadowGradient;
  ctx.beginPath();
  ctx.ellipse(
    centerX, 
    centerY + 30, 
    radius * 0.8, 
    radius * 0.8 * PERSPECTIVE_FACTOR, 
    0, 0, Math.PI * 2
  );
  ctx.fill();
  
  ctx.restore();
}

/**
 * Draw wheel segments with 3D perspective
 */
function drawWheelSegments(ctx, centerX, centerY, outerRadius, innerRadius, angle, winningNumber = null, canvasHeight = 600) {
  const pocketCount = WHEEL_ORDER.length;
  const anglePerPocket = (Math.PI * 2) / pocketCount;
  
  ctx.save();
  ctx.translate(centerX, centerY);
  
  for (let i = 0; i < pocketCount; i++) {
    const number = WHEEL_ORDER[i];
    const color = getNumberColor(number);
    const startAngle = i * anglePerPocket + angle - Math.PI / 2;
    const endAngle = startAngle + anglePerPocket;
    const isWinning = winningNumber !== null && number === winningNumber;
    
    // Calculate positions with perspective
    const outerY1 = Math.sin(startAngle) * outerRadius;
    const outerY2 = Math.sin(endAngle) * outerRadius;
    const innerY1 = Math.sin(startAngle) * innerRadius;
    const innerY2 = Math.sin(endAngle) * innerRadius;
    
    const scale = getDepthScale(centerY + outerY1, canvasHeight);
    
    // Draw pocket with perspective
    ctx.beginPath();
    ctx.ellipse(0, 0, outerRadius * scale, outerRadius * scale * PERSPECTIVE_FACTOR, 0, startAngle, endAngle);
    ctx.ellipse(0, 0, innerRadius * scale, innerRadius * scale * PERSPECTIVE_FACTOR, 0, endAngle, startAngle, true);
    ctx.closePath();
    
    // Fill with color
    ctx.fillStyle = COLORS[color];
    ctx.fill();
    
    // Add winning glow
    if (isWinning) {
      ctx.save();
      ctx.shadowColor = COLORS.neonGreen;
      ctx.shadowBlur = 40;
      ctx.strokeStyle = COLORS.neonGreen;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.restore();
    }
    
    // Draw white border
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(
      Math.cos(startAngle) * innerRadius * scale,
      Math.sin(startAngle) * innerRadius * scale * PERSPECTIVE_FACTOR
    );
    ctx.lineTo(
      Math.cos(startAngle) * outerRadius * scale,
      Math.sin(startAngle) * outerRadius * scale * PERSPECTIVE_FACTOR
    );
    ctx.stroke();
  }
  
  ctx.restore();
}

/**
 * Draw numbers on wheel with 3D perspective
 */
function drawNumbers(ctx, centerX, centerY, outerRadius, innerRadius, angle, winningNumber = null, canvasWidth = 600, canvasHeight = 600) {
  const pocketCount = WHEEL_ORDER.length;
  const anglePerPocket = (Math.PI * 2) / pocketCount;
  const textRadius = (outerRadius + innerRadius) / 2;
  
  ctx.save();
  ctx.translate(centerX, centerY);
  
  for (let i = 0; i < pocketCount; i++) {
    const number = WHEEL_ORDER[i];
    const midAngle = i * anglePerPocket + anglePerPocket / 2 + angle - Math.PI / 2;
    const isWinning = winningNumber !== null && number === winningNumber;
    
    const textX = Math.cos(midAngle) * textRadius;
    const textY = Math.sin(midAngle) * textRadius * PERSPECTIVE_FACTOR;
    
    const scale = getDepthScale(centerY + textY, canvasHeight);
    
    ctx.save();
    ctx.translate(textX, textY);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.scale(scale, scale);
    
    ctx.fillStyle = COLORS.white;
    // Scale font size to canvas
    const fontSize = Math.floor(20 * (canvasWidth / 800));
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    if (isWinning) {
      ctx.shadowColor = COLORS.gold;
      ctx.shadowBlur = 20;
    }
    
    ctx.fillText(number.toString(), 0, 0);
    ctx.restore();
  }
  
  ctx.restore();
}

/**
 * Draw gold outer border with neon glow
 */
function drawOuterBorder(ctx, centerX, centerY, radius) {
  ctx.save();
  
  // Neon green glow
  ctx.shadowColor = COLORS.glowGreen;
  ctx.shadowBlur = 30;
  
  const gradient = ctx.createLinearGradient(
    centerX - radius, centerY,
    centerX + radius, centerY
  );
  gradient.addColorStop(0, COLORS.goldDark);
  gradient.addColorStop(0.5, COLORS.gold);
  gradient.addColorStop(1, COLORS.goldDark);
  
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.ellipse(
    centerX, centerY,
    radius, radius * PERSPECTIVE_FACTOR,
    0, 0, Math.PI * 2
  );
  ctx.stroke();
  
  ctx.restore();
}

/**
 * Draw center hub with GUHD EATS branding
 */
function drawCenterHub(ctx, centerX, centerY, radius) {
  ctx.save();
  
  // Hub background
  const hubGradient = ctx.createRadialGradient(
    centerX, centerY, 0,
    centerX, centerY, radius
  );
  hubGradient.addColorStop(0, COLORS.zinc);
  hubGradient.addColorStop(1, COLORS.black);
  
  ctx.fillStyle = hubGradient;
  ctx.beginPath();
  ctx.ellipse(
    centerX, centerY,
    radius, radius * PERSPECTIVE_FACTOR,
    0, 0, Math.PI * 2
  );
  ctx.fill();
  
  // Gold border
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 6;
  ctx.shadowColor = COLORS.glowGold;
  ctx.shadowBlur = 20;
  ctx.stroke();
  
  // GUHD EATS text (scaled to canvas size)
  ctx.shadowBlur = 30;
  ctx.fillStyle = COLORS.gold;
  const scaleFactor = radius / 100; // Based on hub radius
  ctx.font = `bold ${Math.floor(32 * scaleFactor)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GUHD', centerX, centerY - 18 * scaleFactor);
  
  ctx.font = `bold ${Math.floor(22 * scaleFactor)}px Arial`;
  ctx.fillText('EATS', centerX, centerY + 15 * scaleFactor);
  
  ctx.restore();
}

/**
 * Draw rotating "STILL GUUHHHD" branding ring (scaled)
 */
export function drawBrandingRing(ctx, centerX, centerY, radius, angle, canvasWidth = 600) {
  const text = 'STILL GUUHHHD 🎰 ';
  const repeats = 6;
  const totalChars = text.length * repeats;
  const anglePerChar = (Math.PI * 2) / totalChars;
  
  ctx.save();
  // Scale font size based on canvas
  const fontSize = Math.floor(18 * (canvasWidth / 800));
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.fillStyle = COLORS.gold;
  ctx.shadowColor = COLORS.glowGold;
  ctx.shadowBlur = 15;
  
  for (let i = 0; i < totalChars; i++) {
    const char = text[i % text.length];
    const charAngle = i * anglePerChar + angle;
    
    const x = centerX + Math.cos(charAngle) * radius;
    const y = centerY + Math.sin(charAngle) * radius * PERSPECTIVE_FACTOR;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(charAngle + Math.PI / 2);
    ctx.fillText(char, 0, 0);
    ctx.restore();
  }
  
  ctx.restore();
}

/**
 * Draw lighting reflection sweep
 */
export function drawLightingReflection(ctx, centerX, centerY, radius, angle, intensity = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = intensity * 0.3;
  
  const gradient = ctx.createRadialGradient(
    centerX + Math.cos(angle) * radius * 0.3,
    centerY + Math.sin(angle) * radius * 0.3 * PERSPECTIVE_FACTOR,
    0,
    centerX + Math.cos(angle) * radius * 0.3,
    centerY + Math.sin(angle) * radius * 0.3 * PERSPECTIVE_FACTOR,
    radius * 0.8
  );
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.3)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(
    centerX, centerY,
    radius * 0.9, radius * 0.9 * PERSPECTIVE_FACTOR,
    0, 0, Math.PI * 2
  );
  ctx.fill();
  
  ctx.restore();
}

/**
 * Draw confetti burst particles
 */
export function drawConfetti(ctx, centerX, centerY, progress) {
  const particles = 50;
  
  ctx.save();
  
  for (let i = 0; i < particles; i++) {
    const angle = (i / particles) * Math.PI * 2 + (Math.random() * 0.5);
    const velocity = 1 + Math.random() * 0.5;
    const distance = progress * 300 * velocity;
    
    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance * PERSPECTIVE_FACTOR;
    
    const size = 3 + Math.random() * 3;
    const color = i % 2 === 0 ? COLORS.gold : COLORS.neonGreen;
    
    ctx.fillStyle = color;
    ctx.globalAlpha = (1 - progress) * 0.8;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

/**
 * Draw winning number highlight pulse
 */
export function drawWinningHighlight(ctx, centerX, centerY, radius, winningNumber, progress) {
  const pocketIndex = WHEEL_ORDER.indexOf(winningNumber);
  const anglePerPocket = (Math.PI * 2) / WHEEL_ORDER.length;
  const winningAngle = pocketIndex * anglePerPocket - Math.PI / 2;

  const pulse = Math.sin(progress * Math.PI * 4) * 0.3 + 0.7;
  
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.shadowColor = COLORS.neonGreen;
  ctx.shadowBlur = 50 * pulse;
  ctx.strokeStyle = COLORS.neonGreen;
  ctx.lineWidth = 8;
  
  ctx.translate(centerX, centerY);
  ctx.beginPath();
  ctx.ellipse(
    Math.cos(winningAngle) * radius * 0.75,
    Math.sin(winningAngle) * radius * 0.75 * PERSPECTIVE_FACTOR,
    30, 30 * PERSPECTIVE_FACTOR,
    0, 0, Math.PI * 2
  );
  ctx.stroke();
  ctx.restore();
}

/**
 * Pre-compute reusable wheel textures for a given resolution
 */
export function createWheelTextures(width = 600, height = 600) {
  const centerX = width / 2;
  const centerY = height / 2;
  const scaleFactor = width / 800;
  const outerRadius = 350 * scaleFactor;
  const innerRadius = 100 * scaleFactor;

  const background = createCanvas(width, height);
  const backgroundCtx = background.getContext('2d');
  drawBackground(backgroundCtx, width, height);
  drawDepthShadow(backgroundCtx, centerX, centerY, outerRadius);

  const wheel = createCanvas(width, height);
  const wheelCtx = wheel.getContext('2d');
  drawWheelSegments(wheelCtx, centerX, centerY, outerRadius, innerRadius, 0, null, height);
  drawNumbers(wheelCtx, centerX, centerY, outerRadius, innerRadius, 0, null, width, height);
  drawOuterBorder(wheelCtx, centerX, centerY, outerRadius + 10);

  const branding = createCanvas(width, height);
  const brandingCtx = branding.getContext('2d');
  drawBrandingRing(brandingCtx, centerX, centerY, outerRadius + 40, 0, width);

  const centerHub = createCanvas(width, height);
  const centerCtx = centerHub.getContext('2d');
  drawCenterHub(centerCtx, centerX, centerY, innerRadius);

  return {
    background,
    wheel,
    branding,
    centerHub,
    meta: {
      width,
      height,
      centerX,
      centerY,
      outerRadius,
      innerRadius,
      scaleFactor,
      perspective: PERSPECTIVE_FACTOR
    }
  };
}

/**
 * Render complete cinematic frame (OPTIMIZED for 600x600)
 */
export function renderCinematicFrame(options = {}) {
  const {
    width = 600,
    height = 600,
    angle = 0,
    speed = 0,
    winningNumber = null,
    showBranding = true,
    showLighting = true,
    showConfetti = false,
    confettiProgress = 0,
    showWinningHighlight = false,
    highlightProgress = 0
  } = options;
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  const centerX = width / 2;
  const centerY = height / 2;
  // Scale radii proportionally to canvas size
  const scaleFactor = width / 800;
  const outerRadius = 350 * scaleFactor;
  const innerRadius = 100 * scaleFactor;
  
  // Draw layers
  drawBackground(ctx, width, height);
  drawDepthShadow(ctx, centerX, centerY, outerRadius);
  drawWheelSegments(ctx, centerX, centerY, outerRadius, innerRadius, angle, winningNumber, height);
  drawNumbers(ctx, centerX, centerY, outerRadius, innerRadius, angle, winningNumber, width, height);
  drawOuterBorder(ctx, centerX, centerY, outerRadius + 10);
  
  if (showLighting) {
    drawLightingReflection(ctx, centerX, centerY, outerRadius, angle * 2, 1 - speed);
  }
  
  if (showBranding) {
    drawBrandingRing(ctx, centerX, centerY, outerRadius + 40, angle * 0.5, width);
  }
  
  drawCenterHub(ctx, centerX, centerY, innerRadius);
  
  if (showConfetti) {
    drawConfetti(ctx, centerX, centerY, confettiProgress);
  }
  
  if (showWinningHighlight) {
    drawWinningHighlight(ctx, centerX, centerY, outerRadius, winningNumber, highlightProgress);
  }
  
  return canvas;
}

/**
 * Get wheel order for calculations
 */
export function getWheelOrder() {
  return WHEEL_ORDER;
}

/**
 * Get pocket index for number
 */
export function getPocketIndex(number) {
  return WHEEL_ORDER.indexOf(number);
}

