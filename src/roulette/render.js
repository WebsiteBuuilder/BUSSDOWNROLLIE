/**
 * WebP Rendering System for Roulette Animations
 * 
 * This module provides comprehensive WebP rendering capabilities for roulette wheel
 * animations with size budget enforcement, quality optimization, and fallback mechanisms.
 * 
 * @author Roulette Animation System
 * @version 1.0.0
 */

import { createCanvas, loadImage } from 'canvas';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

// Constants
const HARD_SIZE_CAP = 3 * 1024 * 1024; // 3MB hard cap
const TARGET_SIZE = 2.5 * 1024 * 1024; // 2.5MB target
const DEFAULT_SIZE = 720; // Default canvas size
const MIN_SIZE = 480; // Minimum canvas size for quality reduction
const MAX_FPS = 30; // Maximum frames per second
const MIN_FPS = 10; // Minimum frames per second
const REDUCTION_STEP = 0.15; // 15% frame reduction step

// Performance optimization: Precomputed trigonometric tables
const DEG_TO_RAD = Math.PI / 180;
const SIN_TABLE = new Float32Array(360);
const COS_TABLE = new Float32Array(360);

// Precompute sin/cos tables for performance optimization
(function initTrigTables() {
    for (let i = 0; i < 360; i++) {
        const rad = i * DEG_TO_RAD;
        SIN_TABLE[i] = Math.sin(rad);
        COS_TABLE[i] = Math.cos(rad);
    }
})();

/**
 * Reusable canvas paths for performance optimization
 */
const PathCache = {
    circle: null,
    arc: null,
    sector: null
};

/**
 * Initialize cached paths
 * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
 */
function initPathCache(ctx) {
    // Cache reusable paths
    if (!PathCache.circle) {
        PathCache.circle = new (ctx.constructor).Path2D();
        PathCache.circle.arc(0, 0, 1, 0, 2 * Math.PI);
    }
}

/**
 * Render animation frames using node-canvas
 * 
 * @param {Object} plan - Animation plan with sequence, timing, and effects
 * @param {Object} sprites - Sprite assets for roulette wheel elements
 * @param {number} size - Canvas size (width and height)
 * @returns {Promise<Array<Buffer>>} Array of frame buffers
 * @throws {Error} If rendering fails
 * 
 * @example
 * const plan = {
 *   sequence: ['spin', 'decelerate', 'stop'],
 *   duration: 3000,
 *   effects: ['motion_blur', 'specular_highlights']
 * };
 * const frames = await renderFrames(plan, sprites, 720);
 */
async function renderFrames(plan, sprites, size = DEFAULT_SIZE) {
    const startTime = Date.now();
    
    try {
        // Validate inputs
        if (!plan || !plan.sequence || !Array.isArray(plan.sequence)) {
            throw new Error('Invalid animation plan: missing sequence');
        }
        
        if (!sprites || typeof sprites !== 'object') {
            throw new Error('Invalid sprites: sprites object required');
        }

        // Calculate frame count based on duration and FPS
        const fps = calculateOptimalFPS(plan.duration || 2000);
        const frameCount = Math.ceil((plan.duration || 2000) / 1000 * fps);

        // Create canvas
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        
        // Initialize path cache for performance
        initPathCache(ctx);

        const frames = [];
        const frameInterval = 1000 / fps; // ms between frames

        // Render each frame
        for (let i = 0; i < frameCount; i++) {
            const timestamp = i * frameInterval;
            const progress = frameCount > 1 ? i / (frameCount - 1) : 1;

            // Clear canvas
            ctx.clearRect(0, 0, size, size);

            // Set up rendering context with optimizations
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Render background gradient
            renderBackground(ctx, size);

            // Render roulette wheel based on animation phase
            await renderWheelFrame(ctx, plan, sprites, size, progress, timestamp);

            // Apply winning number popup animation
            if (plan.winningNumber !== undefined && plan.winningNumber !== null) {
                renderWinningPopup(ctx, plan.winningNumber, size, progress);
            }

            // Apply motion blur accumulation for ball movement
            if (plan.effects && plan.effects.includes('motion_blur')) {
                applyMotionBlurAccumulation(ctx, size, progress, timestamp);
            }

            // Apply winning pocket glow effect for final 1 second
            if (plan.winningPocket !== undefined && progress > 0.7) {
                const glowIntensity = Math.min(1, (progress - 0.7) / 0.3);
                applyWinningPocketGlow(ctx, size, plan.winningPocket, glowIntensity);
            }

            // Apply enhanced specular highlights if specified
            if (plan.effects && plan.effects.includes('specular_highlights')) {
                applyEnhancedSpecularHighlights(ctx, size);
            }

            // Apply vignette effects around wheel edges
            applyVignetteEffect(ctx, size);

            // Apply GUHD EATS title ribbon overlay if enabled
            if (plan.enableRibbon !== false) { // Default to true
                renderRibbonOverlay(ctx, size);
            }

            // Convert canvas to buffer
            const buffer = canvas.toBuffer('image/png', { 
                compressionLevel: 9,
                filter: 2 
            });
            frames.push(buffer);

            // Progress reporting for long animations
            if (frameCount > 60 && i % 10 === 0) {
                const progressPercent = Math.round((i / frameCount) * 100);
                console.log(`Rendering progress: ${progressPercent}%`);
            }
        }

        const renderTime = Date.now() - startTime;
        console.log(`Frame rendering completed: ${frameCount} frames in ${renderTime}ms`);

        return frames;

    } catch (error) {
        console.error('Frame rendering failed:', error);
        throw new Error(`Failed to render frames: ${error.message}`);
    }
}

/**
 * Calculate optimal FPS based on animation duration
 * @param {number} duration - Animation duration in milliseconds
 * @returns {number} Optimal FPS
 */
function calculateOptimalFPS(duration) {
    // For shorter animations, use higher FPS for smoothness
    if (duration < 1500) return 24;
    if (duration < 3000) return 20;
    return 16;
}

/**
 * Render background gradient
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} size - Canvas size
 */
function renderBackground(ctx, size) {
    const gradient = ctx.createRadialGradient(
        size / 2, size / 2, 0,
        size / 2, size / 2, size / 2
    );
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#16213e');
    gradient.addColorStop(1, '#0f3460');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
}

/**
 * Render wheel frame based on animation state
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} plan - Animation plan
 * @param {Object} sprites - Sprite assets
 * @param {number} size - Canvas size
 * @param {number} progress - Animation progress (0-1)
 * @param {number} timestamp - Current timestamp
 */
async function renderWheelFrame(ctx, plan, sprites, size, progress, timestamp) {
    const centerX = size / 2;
    const centerY = size / 2;
    const wheelRadius = size * 0.35;

    // Calculate rotation based on animation phase
    const rotation = calculateRotation(plan, progress, timestamp);

    // Save context for rotation
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);

    // Render wheel base
    await renderWheelBase(ctx, sprites, wheelRadius);

    // Render wheel segments
    await renderWheelSegments(ctx, sprites, wheelRadius, progress);

    // Render ball track
    await renderBallTrack(ctx, sprites, wheelRadius, progress, timestamp);

    // Restore context
    ctx.restore();
}

/**
 * Calculate wheel rotation based on animation plan
 * @param {Object} plan - Animation plan
 * @param {number} progress - Progress (0-1)
 * @param {number} timestamp - Current timestamp
 * @returns {number} Rotation in radians
 */
function calculateRotation(plan, progress, timestamp) {
    let rotation = 0;

    if (plan.sequence.includes('spin')) {
        // Accelerating spin phase
        const spinProgress = Math.min(progress * 2, 1);
        const spinSpeed = easeOutCubic(spinProgress);
        rotation += spinSpeed * 6 * Math.PI; // Multiple rotations
    }

    if (plan.sequence.includes('decelerate')) {
        // Decelerating phase
        const decelStart = plan.sequence.indexOf('spin') >= 0 ? 0.5 : 0;
        const decelProgress = Math.max(0, (progress - decelStart) * 2);
        const decelSpeed = easeOutQuart(decelProgress);
        rotation += decelSpeed * 2 * Math.PI;
    }

    if (plan.sequence.includes('stop')) {
        // Final positioning
        const stopProgress = Math.max(0, progress - 0.8) * 5;
        rotation += stopProgress * (Math.PI / 18); // Small adjustments
    }

    return rotation;
}

/**
 * Easing functions for smooth animation
 */
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
}

/**
 * Render wheel base structure
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} sprites - Sprite assets
 * @param {number} radius - Wheel radius
 */
async function renderWheelBase(ctx, sprites, radius) {
    // Outer rim
    ctx.fillStyle = '#c0c0c0';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2 * Math.PI);
    ctx.fill();

    // Inner rim
    ctx.fillStyle = '#808080';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.9, 0, 2 * Math.PI);
    ctx.fill();

    // Center hub
    ctx.fillStyle = '#606060';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.15, 0, 2 * Math.PI);
    ctx.fill();
}

/**
 * Render wheel segments (numbers)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} sprites - Sprite assets
 * @param {number} radius - Wheel radius
 * @param {number} progress - Animation progress
 */
async function renderWheelSegments(ctx, sprites, radius, progress) {
    const segmentCount = 37; // European roulette
    const segmentAngle = (2 * Math.PI) / segmentCount;
    const segmentWidth = radius * 0.8;

    for (let i = 0; i < segmentCount; i++) {
        const angle = i * segmentAngle;
        const isRed = isRedNumber(i);
        const alpha = 0.8 + 0.2 * Math.sin(i + Date.now() * 0.001);

        ctx.save();
        ctx.rotate(angle);
        
        // Draw segment background
        ctx.globalAlpha = alpha;
        ctx.fillStyle = isRed ? '#ff0000' : '#000000';
        ctx.beginPath();
        ctx.moveTo(radius * 0.2, 0);
        ctx.arc(0, 0, segmentWidth, 0, segmentAngle);
        ctx.lineTo(radius * 0.2, 0);
        ctx.fill();

        // Draw number
        ctx.fillStyle = '#ffffff';
        ctx.font = `${radius * 0.08}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i.toString(), radius * 0.5, 0);

        ctx.restore();
    }
}

/**
 * Check if a number is red in roulette
 * @param {number} num - Roulette number
 * @returns {boolean} True if red
 */
function isRedNumber(num) {
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return redNumbers.includes(num);
}

/**
 * Render ball track with animated ball
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} sprites - Sprite assets
 * @param {number} radius - Wheel radius
 * @param {number} progress - Animation progress
 * @param {number} timestamp - Current timestamp
 */
async function renderBallTrack(ctx, sprites, radius, progress, timestamp) {
    const ballRadius = radius * 0.03;
    const trackRadius = radius * 0.85;

    // Calculate ball position
    let ballAngle = 0;
    
    if (progress < 0.5) {
        // Ball spinning around track
        const spinProgress = progress * 2;
        ballAngle = spinProgress * 8 * Math.PI + timestamp * 0.01;
    } else {
        // Ball moving toward center
        const fallProgress = (progress - 0.5) * 2;
        const fallRadius = trackRadius * (1 - fallProgress);
        ballAngle = 4 * Math.PI + timestamp * 0.005;
        
        // Draw ball at current position
        const ballX = fallRadius * Math.cos(ballAngle);
        const ballY = fallRadius * Math.sin(ballAngle);
        
        // Ball shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(ballX + 2, ballY + 2, ballRadius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Ball body
        const ballGradient = ctx.createRadialGradient(
            ballX - ballRadius * 0.3, ballY - ballRadius * 0.3, 0,
            ballX, ballY, ballRadius
        );
        ballGradient.addColorStop(0, '#ffffff');
        ballGradient.addColorStop(0.7, '#f0f0f0');
        ballGradient.addColorStop(1, '#c0c0c0');
        
        ctx.fillStyle = ballGradient;
        ctx.beginPath();
        ctx.arc(ballX, ballY, ballRadius, 0, 2 * Math.PI);
        ctx.fill();
        
        return;
    }

    // Draw ball on track
    const ballX = trackRadius * Math.cos(ballAngle);
    const ballY = trackRadius * Math.sin(ballAngle);

    // Ball shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(ballX + 2, ballY + 2, ballRadius, 0, 2 * Math.PI);
    ctx.fill();

    // Ball body
    const ballGradient = ctx.createRadialGradient(
        ballX - ballRadius * 0.3, ballY - ballRadius * 0.3, 0,
        ballX, ballY, ballRadius
    );
    ballGradient.addColorStop(0, '#ffffff');
    ballGradient.addColorStop(0.7, '#f0f0f0');
    ballGradient.addColorStop(1, '#c0c0c0');

    ctx.fillStyle = ballGradient;
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, 2 * Math.PI);
    ctx.fill();
}

/**
 * Apply enhanced motion blur with accumulation for realistic ball movement
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} size - Canvas size
 * @param {number} progress - Animation progress
 * @param {number} timestamp - Current timestamp for trail effects
 */
function applyMotionBlurAccumulation(ctx, size, progress, timestamp) {
    const centerX = size / 2;
    const centerY = size / 2;
    const wheelRadius = size * 0.35;
    const trackRadius = wheelRadius * 0.85;
    
    // Calculate ball position for blur trail
    let ballAngle = 0;
    if (progress < 0.5) {
        const spinProgress = progress * 2;
        ballAngle = spinProgress * 8 * Math.PI + timestamp * 0.01;
    } else {
        ballAngle = 4 * Math.PI + timestamp * 0.005;
    }
    
    const fallRadius = progress < 0.5 ? trackRadius : trackRadius * (1 - (progress - 0.5) * 2);
    const ballX = centerX + Math.cos(ballAngle) * fallRadius;
    const ballY = centerY + Math.sin(ballAngle) * fallRadius;
    
    // Create motion blur trail effect
    ctx.save();
    
    // Multiple blur layers for better accumulation
    const blurLayers = 5;
    const blurStep = 0.02;
    
    for (let i = 0; i < blurLayers; i++) {
        const blurProgress = progress - (i * blurStep);
        if (blurProgress <= 0) continue;
        
        const trailAngle = ballAngle - (i * 0.5);
        const trailRadius = fallRadius - (i * 2);
        const trailX = centerX + Math.cos(trailAngle) * trailRadius;
        const trailY = centerY + Math.sin(trailAngle) * trailRadius;
        
        const alpha = Math.max(0, 0.5 - (i * 0.08));
        const blur = Math.min(12, 3 + (i * 2));
        
        ctx.globalAlpha = alpha;
        ctx.filter = `blur(${blur}px)`;
        ctx.drawImage(ctx.canvas, trailX - ballX, trailY - ballY);
    }
    
    ctx.restore();
    ctx.filter = 'none';
    ctx.globalAlpha = 1.0;
}

/**
 * Apply enhanced specular highlights for premium metal surfaces
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} size - Canvas size
 */
function applyEnhancedSpecularHighlights(ctx, size) {
    const centerX = size / 2;
    const centerY = size / 2;
    const wheelRadius = size * 0.35;
    
    ctx.save();
    
    // Primary light source from top-left (directional lighting)
    const primaryLight = ctx.createRadialGradient(
        centerX - wheelRadius * 0.3, 
        centerY - wheelRadius * 0.3, 
        0,
        centerX, 
        centerY, 
        wheelRadius * 1.2
    );
    
    primaryLight.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
    primaryLight.addColorStop(0.2, 'rgba(255, 255, 255, 0.15)');
    primaryLight.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
    primaryLight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    // Secondary light source for rim reflection
    const rimLight = ctx.createRadialGradient(
        centerX + wheelRadius * 0.2, 
        centerY - wheelRadius * 0.4, 
        0,
        centerX, 
        centerY, 
        wheelRadius * 1.1
    );
    
    rimLight.addColorStop(0, 'rgba(200, 200, 255, 0.15)');
    rimLight.addColorStop(0.4, 'rgba(150, 150, 255, 0.08)');
    rimLight.addColorStop(1, 'rgba(100, 100, 255, 0)');
    
    // Apply highlights with screen blend mode for realistic metal reflection
    ctx.globalCompositeOperation = 'screen';
    
    ctx.fillStyle = primaryLight;
    ctx.beginPath();
    ctx.arc(centerX, centerY, wheelRadius * 1.1, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = rimLight;
    ctx.beginPath();
    ctx.arc(centerX, centerY, wheelRadius * 1.05, 0, Math.PI * 2);
    ctx.fill();
    
    // Add subtle center hub highlight
    const hubHighlight = ctx.createRadialGradient(
        centerX - wheelRadius * 0.05, 
        centerY - wheelRadius * 0.05, 
        0,
        centerX, 
        centerY, 
        wheelRadius * 0.2
    );
    hubHighlight.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    hubHighlight.addColorStop(0.7, 'rgba(255, 255, 255, 0.1)');
    hubHighlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = hubHighlight;
    ctx.beginPath();
    ctx.arc(centerX, centerY, wheelRadius * 0.15, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
}

/**
 * Apply subtle vignette effects around wheel edges
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} size - Canvas size
 */
function applyVignetteEffect(ctx, size) {
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2;
    
    // Create radial vignette gradient
    const vignetteGradient = ctx.createRadialGradient(
        centerX, centerY, radius * 0.4,
        centerX, centerY, radius
    );
    
    vignetteGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignetteGradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
    vignetteGradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
    
    ctx.fillStyle = vignetteGradient;
    ctx.fillRect(0, 0, size, size);
}

/**
 * Apply winning pocket glow effect for final 1 second
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} size - Canvas size
 * @param {number} winningPocket - The winning pocket index
 * @param {number} intensity - Glow intensity (0-1)
 */
function applyWinningPocketGlow(ctx, size, winningPocket, intensity) {
    const centerX = size / 2;
    const centerY = size / 2;
    const wheelRadius = size * 0.35;
    const pocketRadius = wheelRadius * 0.8;
    const segmentAngle = (2 * Math.PI) / 37;
    
    // Calculate winning pocket position
    const startAngle = winningPocket * segmentAngle;
    const endAngle = (winningPocket + 1) * segmentAngle;
    const midAngle = (startAngle + endAngle) / 2;
    
    // Create pulsing glow effect
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.008);
    const finalIntensity = intensity * pulse;
    
    // Outer glow
    const outerGlow = ctx.createRadialGradient(
        centerX, centerY, pocketRadius * 0.8,
        centerX, centerY, pocketRadius * 1.1
    );
    
    outerGlow.addColorStop(0, `rgba(255, 215, 0, ${finalIntensity * 0.3})`);
    outerGlow.addColorStop(0.5, `rgba(255, 215, 0, ${finalIntensity * 0.15})`);
    outerGlow.addColorStop(1, 'rgba(255, 215, 0, 0)');
    
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(centerX, centerY, pocketRadius * 1.15, startAngle, endAngle);
    ctx.arc(centerX, centerY, pocketRadius * 0.75, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fill();
    
    // Inner bright highlight
    const innerGlow = ctx.createRadialGradient(
        centerX, centerY, pocketRadius * 0.85,
        centerX, centerY, pocketRadius * 1.0
    );
    
    innerGlow.addColorStop(0, `rgba(255, 255, 255, ${finalIntensity * 0.5})`);
    innerGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = innerGlow;
    ctx.beginPath();
    ctx.arc(centerX, centerY, pocketRadius * 1.05, startAngle, endAngle);
    ctx.arc(centerX, centerY, pocketRadius * 0.85, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fill();
    
    ctx.globalCompositeOperation = 'source-over';
}

/**
 * Render winning number popup animation
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} winningNumber - The winning number
 * @param {number} size - Canvas size
 * @param {number} progress - Animation progress
 */
function renderWinningPopup(ctx, winningNumber, size, progress) {
    // Show popup only in final 20% of animation
    if (progress < 0.8) return;
    
    const popupProgress = (progress - 0.8) / 0.2;
    const centerX = size / 2;
    const popupY = size * 0.15;
    
    // Popup animation with ease out
    const easeOut = 1 - Math.pow(1 - popupProgress, 3);
    const yOffset = (1 - easeOut) * -50;
    const alpha = Math.min(1, popupProgress * 2);
    
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(centerX, popupY + yOffset);
    
    // Draw popup background
    const popupWidth = 200;
    const popupHeight = 60;
    const radius = 10;
    
    // Background with gradient
    const bgGradient = ctx.createLinearGradient(-popupWidth/2, -popupHeight/2, popupWidth/2, popupHeight/2);
    bgGradient.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
    bgGradient.addColorStop(0.5, 'rgba(20, 20, 40, 0.9)');
    bgGradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
    
    ctx.fillStyle = bgGradient;
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
    ctx.lineWidth = 2;
    
    // Rounded rectangle
    ctx.beginPath();
    ctx.moveTo(-popupWidth/2 + radius, -popupHeight/2);
    ctx.lineTo(popupWidth/2 - radius, -popupHeight/2);
    ctx.quadraticCurveTo(popupWidth/2, -popupHeight/2, popupWidth/2, -popupHeight/2 + radius);
    ctx.lineTo(popupWidth/2, popupHeight/2 - radius);
    ctx.quadraticCurveTo(popupWidth/2, popupHeight/2, popupWidth/2 - radius, popupHeight/2);
    ctx.lineTo(-popupWidth/2 + radius, popupHeight/2);
    ctx.quadraticCurveTo(-popupWidth/2, popupHeight/2, -popupWidth/2, popupHeight/2 - radius);
    ctx.lineTo(-popupWidth/2, -popupHeight/2 + radius);
    ctx.quadraticCurveTo(-popupWidth/2, -popupHeight/2, -popupWidth/2 + radius, -popupHeight/2);
    ctx.closePath();
    
    ctx.fill();
    ctx.stroke();
    
    // Add glow effect
    ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
    ctx.shadowBlur = 15;
    ctx.stroke();
    
    // Draw winning number text
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.fillText(`WINNING NUMBER`, 0, -10);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px Arial';
    ctx.fillText(winningNumber.toString(), 0, 15);
    
    ctx.restore();
}

/**
 * Render GUHD EATS title ribbon overlay
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} size - Canvas size
 */
function renderRibbonOverlay(ctx, size) {
    const centerX = size / 2;
    const ribbonY = size * 0.05;
    const ribbonWidth = size * 0.7;
    const ribbonHeight = size * 0.08;
    
    ctx.save();
    ctx.translate(centerX, ribbonY);
    
    // Ribbon gradient
    const ribbonGradient = ctx.createLinearGradient(-ribbonWidth/2, 0, ribbonWidth/2, 0);
    ribbonGradient.addColorStop(0, 'rgba(139, 69, 19, 0.9)');
    ribbonGradient.addColorStop(0.2, 'rgba(205, 133, 63, 0.95)');
    ribbonGradient.addColorStop(0.5, 'rgba(222, 184, 135, 0.95)');
    ribbonGradient.addColorStop(0.8, 'rgba(205, 133, 63, 0.95)');
    ribbonGradient.addColorStop(1, 'rgba(139, 69, 19, 0.9)');
    
    // Ribbon with pointed ends
    ctx.fillStyle = ribbonGradient;
    ctx.beginPath();
    ctx.moveTo(-ribbonWidth/2, 0);
    ctx.lineTo(-ribbonWidth/2 + ribbonHeight, -ribbonHeight/2);
    ctx.lineTo(ribbonWidth/2 - ribbonHeight, -ribbonHeight/2);
    ctx.lineTo(ribbonWidth/2, 0);
    ctx.lineTo(ribbonWidth/2 - ribbonHeight, ribbonHeight/2);
    ctx.lineTo(-ribbonWidth/2 + ribbonHeight, ribbonHeight/2);
    ctx.closePath();
    ctx.fill();
    
    // Ribbon border
    ctx.strokeStyle = 'rgba(101, 67, 33, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Add decorative stitching
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Title text
    ctx.fillStyle = '#FFD700';
    ctx.font = `bold ${size * 0.035}px 'Times New Roman', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Add text shadow for depth
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    ctx.fillText('GUHD EATS', 0, 0);
    
    ctx.restore();
}

/**
 * Encode frames as animated WebP with fallback to APNG
 * 
 * @param {Array<Buffer>} frames - Array of frame buffers
 * @param {number} fps - Frames per second
 * @param {number} budgetBytes - Size budget in bytes
 * @returns {Promise<{buffer: Buffer, format: string, size: number}>} Encoded animation
 * 
 * @example
 * const encoded = await encodeAnimatedWebP(frames, 20, 2.5 * 1024 * 1024);
 * console.log(`Format: ${encoded.format}, Size: ${encoded.size} bytes`);
 */
async function encodeAnimatedWebP(frames, fps, budgetBytes = TARGET_SIZE) {
    const startTime = Date.now();

    try {
        if (!frames || frames.length === 0) {
            throw new Error('No frames provided for encoding');
        }

        // Validate and clamp FPS
        fps = Math.max(MIN_FPS, Math.min(MAX_FPS, fps));
        
        const frameDelay = Math.round(1000 / fps); // Convert to milliseconds

        // First attempt: Try WebP with original settings
        console.log(`Encoding ${frames.length} frames to WebP at ${fps} FPS`);
        
        let result = await tryWebPEncoding(frames, frameDelay, budgetBytes);
        
        // If WebP fails or exceeds budget, try quality reduction
        if (!result || result.size > budgetBytes) {
            console.log('WebP failed or exceeded budget, trying with reduced quality...');
            result = await tryReducedQualityEncoding(frames, frameDelay, budgetBytes);
        }

        // If still exceeds budget, reduce frame count
        if (result.size > budgetBytes) {
            console.log('Still exceeds budget, reducing frame count...');
            result = await tryReducedFrameCount(frames, frameDelay, budgetBytes);
        }

        // If WebP completely fails, try APNG fallback
        if (!result || result.size === 0) {
            console.log('WebP encoding failed, trying APNG fallback...');
            result = await tryAPNGEncoding(frames, frameDelay, budgetBytes);
        }

        const encodeTime = Date.now() - startTime;
        console.log(`Encoding completed in ${encodeTime}ms: ${result.size} bytes`);

        return result;

    } catch (error) {
        console.error('Animated WebP encoding failed:', error);
        throw new Error(`Failed to encode animation: ${error.message}`);
    }
}

/**
 * Try encoding as WebP with current settings
 * @param {Array<Buffer>} frames - Frame buffers
 * @param {number} frameDelay - Frame delay in ms
 * @param {number} budgetBytes - Size budget
 * @returns {Promise<Object>} Encoding result
 */
async function tryWebPEncoding(frames, frameDelay, budgetBytes) {
    try {
        // WebP metadata for animated encoding
        const metadata = {
            loop: 0, // Infinite loop
            delay: frameDelay
        };

        // Create animated WebP
        const webpBuffer = await sharp({
            create: {
                width: frames[0].width || 720,
                height: frames[0].height || 720,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            }
        })
        .webp({
            quality: 85,
            effort: 6, // Maximum compression effort
            loop: 0,
            delay: frameDelay
        })
        .composite(frames.map(buffer => ({
            input: buffer,
            top: 0,
            left: 0
        })))
        .toBuffer();

        if (webpBuffer.length <= budgetBytes) {
            return {
                buffer: webpBuffer,
                format: 'webp',
                size: webpBuffer.length
            };
        }

        return { buffer: webpBuffer, format: 'webp', size: webpBuffer.length };

    } catch (error) {
        console.warn('WebP encoding attempt failed:', error.message);
        return null;
    }
}

/**
 * Try encoding with reduced quality settings
 * @param {Array<Buffer>} frames - Frame buffers
 * @param {number} frameDelay - Frame delay in ms
 * @param {number} budgetBytes - Size budget
 * @returns {Promise<Object>} Encoding result
 */
async function tryReducedQualityEncoding(frames, frameDelay, budgetBytes) {
    const qualitySteps = [75, 65, 55, 45];
    
    for (const quality of qualitySteps) {
        try {
            const webpBuffer = await sharp({
                create: {
                    width: frames[0].width || 720,
                    height: frames[0].height || 720,
                    channels: 4,
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                }
            })
            .webp({
                quality: quality,
                effort: 6,
                loop: 0,
                delay: frameDelay
            })
            .composite(frames.map(buffer => ({
                input: buffer,
                top: 0,
                left: 0
            })))
            .toBuffer();

            if (webpBuffer.length <= budgetBytes) {
                return {
                    buffer: webpBuffer,
                    format: 'webp',
                    size: webpBuffer.length
                };
            }

        } catch (error) {
            console.warn(`WebP encoding with quality ${quality} failed:`, error.message);
            continue;
        }
    }

    return null;
}

/**
 * Try encoding with reduced frame count
 * @param {Array<Buffer>} frames - Frame buffers
 * @param {number} frameDelay - Frame delay in ms
 * @param {number} budgetBytes - Size budget
 * @returns {Promise<Object>} Encoding result
 */
async function tryReducedFrameCount(frames, frameDelay, budgetBytes) {
    // Try reducing frame count by 10%, 20%, 30%
    const reductionSteps = [0.1, 0.2, 0.3];
    
    for (const reduction of reductionSteps) {
        try {
            const reducedFrames = frames.filter((_, index) => 
                index % Math.ceil(1 / (1 - reduction)) === 0 || 
                index === frames.length - 1
            );

            const webpBuffer = await sharp({
                create: {
                    width: frames[0].width || 720,
                    height: frames[0].height || 720,
                    channels: 4,
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                }
            })
            .webp({
                quality: 65,
                effort: 6,
                loop: 0,
                delay: frameDelay * (1 / (1 - reduction)) // Adjust timing
            })
            .composite(reducedFrames.map(buffer => ({
                input: buffer,
                top: 0,
                left: 0
            })))
            .toBuffer();

            if (webpBuffer.length <= budgetBytes) {
                return {
                    buffer: webpBuffer,
                    format: 'webp',
                    size: webpBuffer.length,
                    frames: reducedFrames.length
                };
            }

        } catch (error) {
            console.warn(`Frame reduction encoding failed:`, error.message);
            continue;
        }
    }

    return null;
}

/**
 * Try APNG fallback encoding
 * @param {Array<Buffer>} frames - Frame buffers
 * @param {number} frameDelay - Frame delay in ms
 * @param {number} budgetBytes - Size budget
 * @returns {Promise<Object>} Encoding result
 */
async function tryAPNGEncoding(frames, frameDelay, budgetBytes) {
    try {
        // For APNG fallback, we'll create a PNG sequence and zip them
        // This is a simplified fallback - in production you might want
        // a dedicated APNG encoder
        
        const pngBuffers = await Promise.all(
            frames.map(frame => sharp(frame).png({ compressionLevel: 9 }).toBuffer())
        );

        // Combine PNG frames into a simple format
        // In a real implementation, you'd use an APNG encoder library
        const apngBuffer = Buffer.concat(pngBuffers);

        if (apngBuffer.length <= budgetBytes) {
            return {
                buffer: apngBuffer,
                format: 'apng',
                size: apngBuffer.length
            };
        }

        return null;

    } catch (error) {
        console.warn('APNG encoding failed:', error.message);
        return null;
    }
}

/**
 * Save encoded animation to file
 * 
 * @param {Buffer} buffer - Encoded animation buffer
 * @param {string} format - Animation format (webp/apng)
 * @param {string} outputPath - Output file path
 * @returns {Promise<string>} Saved file path
 * 
 * @example
 * const path = await saveAnimation(encoded.buffer, 'webp', './output/roulette.webp');
 */
async function saveAnimation(buffer, format, outputPath) {
    try {
        // Ensure output directory exists
        const dir = path.dirname(outputPath);
        await fs.mkdir(dir, { recursive: true });

        // Save file
        await fs.writeFile(outputPath, buffer);
        
        console.log(`Animation saved: ${outputPath} (${buffer.length} bytes, ${format.toUpperCase()})`);
        
        return outputPath;

    } catch (error) {
        console.error('Failed to save animation:', error);
        throw new Error(`Failed to save animation: ${error.message}`);
    }
}

/**
 * Analyze animation size and provide optimization suggestions
 * 
 * @param {number} sizeBytes - Animation size in bytes
 * @param {Object} metadata - Animation metadata
 * @returns {Object} Analysis results and recommendations
 * 
 * @example
 * const analysis = analyzeSize(1024 * 1024, { fps: 20, frames: 30, format: 'webp' });
 * console.log(analysis.recommendations);
 */
function analyzeSize(sizeBytes, metadata) {
    const sizeMB = sizeBytes / (1024 * 1024);
    const recommendations = [];

    // Size analysis
    if (sizeBytes > HARD_SIZE_CAP) {
        recommendations.push('Animation exceeds hard size cap. Significant reduction required.');
    } else if (sizeBytes > TARGET_SIZE) {
        recommendations.push('Animation exceeds target size. Consider quality reduction.');
    } else {
        recommendations.push('Animation size is within target range.');
    }

    // Frame count analysis
    if (metadata.frames > 60) {
        recommendations.push('High frame count may be causing large file size.');
    }

    // FPS analysis
    if (metadata.fps > 24) {
        recommendations.push('High FPS may be unnecessary for this animation.');
    }

    // Format analysis
    if (metadata.format === 'apng') {
        recommendations.push('APNG format typically produces larger files than WebP.');
    }

    return {
        sizeBytes,
        sizeMB: Math.round(sizeMB * 100) / 100,
        withinBudget: sizeBytes <= TARGET_SIZE,
        withinHardCap: sizeBytes <= HARD_SIZE_CAP,
        recommendations
    };
}

/**
 * Main render pipeline that combines frame rendering and encoding
 * 
 * @param {Object} plan - Animation plan
 * @param {Object} sprites - Sprite assets
 * @param {Object} options - Rendering and encoding options
 * @returns {Promise<Object>} Complete result with frames and analysis
 * 
 * @example
 * const result = await renderAnimation(plan, sprites, {
 *   size: 720,
 *   fps: 20,
 *   budgetBytes: 2.5 * 1024 * 1024
 * });
 */
async function renderAnimation(plan, sprites, options = {}) {
    const {
        size = DEFAULT_SIZE,
        fps = 20,
        budgetBytes = TARGET_SIZE,
        outputPath = null
    } = options;

    try {
        console.log('Starting roulette animation render...');
        console.log(`Configuration: ${size}x${size}, ${fps} FPS, ${Math.round(budgetBytes / 1024 / 1024 * 100) / 100}MB budget`);

        // Step 1: Render frames
        const frames = await renderFrames(plan, sprites, size);

        // Step 2: Encode to WebP/APNG
        const encoded = await encodeAnimatedWebP(frames, fps, budgetBytes);

        // Step 3: Analyze result
        const analysis = analyzeSize(encoded.size, {
            frames: frames.length,
            fps,
            format: encoded.format
        });

        // Step 4: Save if output path provided
        let savedPath = null;
        if (outputPath) {
            const extension = encoded.format === 'webp' ? '.webp' : '.apng';
            savedPath = await saveAnimation(encoded.buffer, encoded.format, outputPath + extension);
        }

        console.log('Animation render completed successfully');
        console.log(`Final size: ${Math.round(encoded.size / 1024 / 1024 * 100) / 100}MB`);
        console.log(`Format: ${encoded.format.toUpperCase()}`);
        console.log(`Analysis: ${analysis.recommendations.join(', ')}`);

        return {
            frames,
            encoded,
            analysis,
            savedPath,
            metadata: {
                size,
                fps,
                frameCount: frames.length,
                sizeBytes: encoded.size,
                format: encoded.format,
                renderTime: Date.now()
            }
        };

    } catch (error) {
        console.error('Animation render pipeline failed:', error);
        throw new Error(`Render pipeline failed: ${error.message}`);
    }
}

/**
 * Generate placeholder embed for instant response
 */
function createPlaceholderEmbed(displayName, totalBet) {
    return {
        title: '🎡 Roulette Spin',
        description: `**${displayName}** is spinning the wheel...\n\n**Total Bet:** ${totalBet} VP`,
        color: 0xFFD700,
        timestamp: new Date().toISOString(),
        footer: {
            text: 'Calculating physics... | Still GUHHHD Roulette'
        }
    };
}

/**
 * Create result embed with animation metadata
 */
function createResultEmbed(data, metadata = null) {
    const {
        displayName,
        winningNumber,
        winningColor,
        didWin,
        net,
        totalBet,
        totalWon,
        newBalance
    } = data;
    
    const embed = {
        title: `🎯 Result: ${winningNumber}`,
        description: `${getColorEmoji(winningColor)} **${displayName}** ${didWin ? 'WON' : 'lost'} ${Math.abs(net)} VP`,
        color: didWin ? 0x00FF00 : 0xFF0000,
        fields: [
            {
                name: '💰 Bet',
                value: `${totalBet} VP`,
                inline: true
            },
            {
                name: didWin ? '🏆 Won' : '💸 Lost',
                value: `${Math.abs(net)} VP`,
                inline: true
            },
            {
                name: '💳 New Balance',
                value: `${newBalance} VP`,
                inline: true
            }
        ],
        timestamp: new Date().toISOString()
    };
    
    if (metadata) {
        embed.footer = {
            text: `${metadata.frames} frames | ${metadata.sizeMB}MB | Physics: ω₀=${metadata.omega0?.toFixed(2)}k=${metadata.k?.toFixed(2)} | Still GUHHHD Roulette`
        };
    }
    
    return embed;
}

function getColorEmoji(color) {
    switch (color) {
        case 'red': return '🔴';
        case 'black': return '⚫';
        case 'green': return '🟢';
        default: return '⚪';
    }
}

// Export functions
module.exports = {
    renderFrames,
    encodeAnimatedWebP,
    saveAnimation,
    analyzeSize,
    renderAnimation,
    createPlaceholderEmbed,
    createResultEmbed,
    constants: {
        HARD_SIZE_CAP,
        TARGET_SIZE,
        DEFAULT_SIZE,
        MIN_SIZE,
        MAX_FPS,
        MIN_FPS,
        REDUCTION_STEP
    }
};