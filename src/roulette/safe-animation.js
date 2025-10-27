/**
 * Cinematic Animation Enforcer
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
    console.log('🔍 Validating cinematic animation system...');
    
    // Test canvas import
    const canvas = await import('canvas');
    if (!canvas.createCanvas) {
      throw new Error('canvas.createCanvas not available');
    }
    
    // Test gifencoder import
    const gifencoder = await import('gifencoder');
    if (!gifencoder.default) {
      throw new Error('gifencoder.default not available');
    }
    
    // Load cinematic module
    cinematicModule = await import('./cinematic-animation.js');
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
    
    console.log('✅ Cinematic animation validated successfully');
    validationPassed = true;
    return true;
  } catch (error) {
    console.error('❌ Cinematic animation validation FAILED');
    console.error(`   Error: ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
    console.error('');
    console.error('⚠️  Roulette command will be DISABLED');
    console.error('   Missing dependencies: canvas or gifencoder');
    console.error('   Please check Docker build logs for system library issues');
    console.error('');
    validationPassed = false;
    return false;
  }
}

/**
 * Generate cinematic spin - strict mode only (NO FALLBACK)
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
    mode: validationPassed ? 'CINEMATIC_3D' : 'DISABLED'
  };
}
