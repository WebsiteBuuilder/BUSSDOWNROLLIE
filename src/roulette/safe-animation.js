/**
 * Safe Animation Wrapper
 * Provides graceful fallback if canvas/gifencoder dependencies fail
 */

let cinematicAvailable = false;
let cinematicModule = null;

/**
 * Check if cinematic animation is available
 */
export async function isCinematicAvailable() {
  if (cinematicModule !== null) {
    return cinematicAvailable;
  }

  try {
    // Test canvas
    await import('canvas');
    
    // Test gifencoder
    await import('gifencoder');
    
    // Load cinematic module
    cinematicModule = await import('./cinematic-animation.js');
    cinematicAvailable = true;
    
    console.log('✅ Cinematic animation system loaded successfully');
    return true;
  } catch (error) {
    console.warn('⚠️  Cinematic animation unavailable, using fallback mode');
    console.warn(`   Reason: ${error.message}`);
    cinematicAvailable = false;
    cinematicModule = null;
    return false;
  }
}

/**
 * Safely generate cinematic spin with automatic fallback
 */
export async function safeGenerateCinematicSpin(winningNumber, options = {}) {
  const available = await isCinematicAvailable();
  
  if (!available) {
    throw new Error('FALLBACK_MODE');
  }

  try {
    return await cinematicModule.generateCinematicSpin(winningNumber, options);
  } catch (error) {
    console.error('❌ Cinematic animation generation failed:', error);
    throw new Error('FALLBACK_MODE');
  }
}

/**
 * Safely animate lite mode (always available)
 */
export async function safeAnimateLiteMode(updateCallback, winningFrame) {
  try {
    // Import lite mode animation
    const { animateLiteMode } = await import('./cinematic-animation.js');
    await animateLiteMode(updateCallback, winningFrame);
  } catch (error) {
    console.error('❌ Lite mode animation failed, using ultra-safe fallback:', error);
    
    // Ultra-safe fallback: simple text animation
    const frames = ['🎰 ⚡', '⚡ 🎰', '🎰 💫', '💫 🎰', '🎰 ✨', '✨ 🎰'];
    for (let i = 0; i < 20; i++) {
      const frame = frames[i % frames.length];
      await updateCallback(frame, '🎡 Spinning...');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    await updateCallback(winningFrame, '🎉 Result!');
  }
}

/**
 * Get animation status for logging
 */
export async function getAnimationStatus() {
  const available = await isCinematicAvailable();
  return {
    cinematic: available,
    fallback: !available,
    mode: available ? 'CINEMATIC_3D' : 'LITE_TEXT'
  };
}

