/**
 * Safe Canvas Utilities for Roulette Rendering
 * Provides error-safe wrappers and fallback generators
 */

/**
 * Get canvas dimensions safely
 */
export function getCanvasDimensions(canvas) {
  if (!canvas) {
    throw new Error('Canvas is null or undefined');
  }
  
  return {
    width: canvas.width || 600,
    height: canvas.height || 600,
    centerX: (canvas.width || 600) / 2,
    centerY: (canvas.height || 600) / 2
  };
}

/**
 * Validate canvas context
 */
export function validateCanvasContext(ctx) {
  if (!ctx) {
    throw new Error('Canvas context is null or undefined');
  }
  
  const requiredMethods = ['fillRect', 'arc', 'fillText', 'save', 'restore', 'beginPath', 'fill', 'stroke'];
  const missing = requiredMethods.filter(method => typeof ctx[method] !== 'function');
  
  if (missing.length > 0) {
    throw new Error(`Canvas context missing required methods: ${missing.join(', ')}`);
  }
  
  return true;
}

/**
 * Safe canvas render wrapper
 * Catches errors and logs them gracefully
 */
export function withSafeCanvasRender(fn, fallbackFn = null) {
  return async function safeWrapper(...args) {
    try {
      return await fn(...args);
    } catch (error) {
      console.error('❌ Canvas render error:', error.message);
      console.error('   Stack:', error.stack);
      
      if (fallbackFn) {
        console.log('🔄 Attempting fallback renderer...');
        try {
          return await fallbackFn(...args);
        } catch (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError.message);
          throw new Error(`Both primary and fallback renders failed: ${error.message}`);
        }
      }
      
      throw error;
    }
  };
}

/**
 * Generate a safe static roulette result image (PNG)
 * This is the ultimate fallback when cinematic GIF fails
 */
export async function generateStaticRouletteImage(winningNumber) {
  console.log(`📸 [STATIC FALLBACK] Generating static result for #${winningNumber}`);
  
  try {
    const { createCanvas } = await import('canvas');
    const canvas = createCanvas(600, 600);
    const ctx = canvas.getContext('2d');
    
    validateCanvasContext(ctx);
    
    const { width, height, centerX, centerY } = getCanvasDimensions(canvas);
    
    // Dark background
    const gradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, width / 2
    );
    gradient.addColorStop(0, '#1a1a1a');
    gradient.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Draw "STILL GUUHHHD" at top
    ctx.save();
    ctx.fillStyle = '#FFD700'; // Gold
    ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
    ctx.shadowBlur = 20;
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('STILL GUUHHHD 🎰', centerX, 80);
    ctx.restore();
    
    // Draw large winning number circle
    const circleRadius = 150;
    
    // Determine color
    const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const isRed = RED_NUMBERS.includes(winningNumber);
    const isGreen = winningNumber === 0;
    const circleColor = isGreen ? '#27AE60' : isRed ? '#E74C3C' : '#2C3E50';
    
    // Draw circle shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = circleColor;
    ctx.beginPath();
    ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    // Draw glow effect
    ctx.save();
    ctx.globalAlpha = 0.3;
    const glowGradient = ctx.createRadialGradient(
      centerX, centerY, circleRadius * 0.5,
      centerX, centerY, circleRadius * 1.3
    );
    glowGradient.addColorStop(0, '#00FF75');
    glowGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, circleRadius * 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    // Draw white border
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw winning number
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 10;
    ctx.font = 'bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(winningNumber.toString(), centerX, centerY);
    ctx.restore();
    
    // Draw color label
    ctx.save();
    ctx.fillStyle = '#FFD700';
    ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
    ctx.shadowBlur = 15;
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    const colorText = isGreen ? 'GREEN' : isRed ? 'RED' : 'BLACK';
    const colorEmoji = isGreen ? '🟢' : isRed ? '🔴' : '⚫';
    ctx.fillText(`${colorEmoji} ${colorText}`, centerX, centerY + 200);
    ctx.restore();
    
    // Draw GUHD EATS branding at bottom
    ctx.save();
    ctx.fillStyle = '#00FF75'; // Neon green
    ctx.shadowColor = 'rgba(0, 255, 117, 0.8)';
    ctx.shadowBlur = 20;
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GUHD EATS CASINO', centerX, height - 40);
    ctx.restore();
    
    const buffer = canvas.toBuffer('image/png');
    const sizeKB = (buffer.length / 1024).toFixed(1);
    
    console.log(`✅ [STATIC FALLBACK] Generated ${sizeKB}KB PNG successfully`);
    
    return buffer;
    
  } catch (error) {
    console.error('❌ [STATIC FALLBACK] Failed to generate static image:', error);
    throw new Error(`Static fallback failed: ${error.message}`);
  }
}

/**
 * Create a minimal emergency fallback (text-only)
 * Used when even the static image generator fails
 */
export function getEmergencyFallbackMessage(winningNumber) {
  const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const isRed = RED_NUMBERS.includes(winningNumber);
  const isGreen = winningNumber === 0;
  const color = isGreen ? 'GREEN 🟢' : isRed ? 'RED 🔴' : 'BLACK ⚫';
  
  return {
    content: `🎰 **STILL GUUHHHD ROULETTE**\n\n` +
             `🎡 **The wheel has stopped!**\n\n` +
             `**Winning Number:** \`${winningNumber}\`\n` +
             `**Color:** ${color}\n\n` +
             `_Animation unavailable - showing text result_`,
    embeds: []
  };
}

