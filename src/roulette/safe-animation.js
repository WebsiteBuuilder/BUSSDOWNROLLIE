/**
 * Cinematic Animation Enforcer V2
 * Using gif-encoder-2 with neuquant for better compression
 * NO FALLBACK - Cinematic rendering only or throw error
 */

let cinematicModule = null;
let validationAttempted = false;
let validationPassed = false;

/**
 * Validate cinematic animation is available (once per runtime)
 */
export async function validateCinematicAnimation() {
  if (validationAttempted) {
    return validationPassed;
  }
  
  validationAttempted = true;
  
  try {
    console.log('🔍 Validating cinematic animation system V2...');
    
    // Test canvas import
    const canvas = await import('canvas');
    if (!canvas.createCanvas) {
      throw new Error('canvas.createCanvas not available');
    }
    
    // Test gif-encoder-2 import
    const gifencoder = await import('gif-encoder-2');
    if (!gifencoder.default) {
      throw new Error('gif-encoder-2.default not available');
    }
    
    // Load cinematic module V2
    cinematicModule = await import('./cinematic-animation-v2.js');
    if (!cinematicModule.generateCinematicSpin) {
      throw new Error('generateCinematicSpin function not found');
    }
    
    // Perform test render to verify everything works
    console.log('   Testing render capabilities...');
    const testCanvas = canvas.createCanvas(50, 50);
    const ctx = testCanvas.getContext('2d');
    ctx.fillStyle = '#00FF75';
    ctx.fillRect(0, 0, 50, 50);
    
    // Verify context has required methods
    if (!ctx.fillRect || !ctx.arc || !ctx.fillText) {
      throw new Error('Canvas context missing required methods');
    }
    
    console.log('✅ Cinematic animation V2 validated successfully');
    validationPassed = true;
    return true;
  } catch (error) {
    console.error('❌ Cinematic animation V2 validation FAILED');
    console.error(`   Error: ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
    console.error('');
    console.error('⚠️  Roulette command will be DISABLED');
    console.error('   Missing dependencies: canvas or gif-encoder-2');
    console.error('   Please check Docker build logs for system library issues');
    console.error('');
    validationPassed = false;
    return false;
  }
}

/**
 * Generate cinematic spin V2 - strict mode only (NO FALLBACK)
 */
export async function generateCinematicSpin(winningNumber, options = {}) {
  if (!validationPassed) {
    throw new Error('Cinematic animation unavailable. Missing or broken dependencies.');
  }
  
  try {
    return await cinematicModule.generateCinematicSpin(winningNumber, options);
  } catch (error) {
    console.error('❌ Cinematic animation generation failed:', error);
    throw error; // Propagate error, no fallback
  }
}

/**
 * Get animation status
 */
export function getAnimationStatus() {
  return {
    available: validationPassed,
    mode: validationPassed ? 'CINEMATIC_V2_NEUQUANT' : 'DISABLED'
  };
}
