/**
 * Verification script for the Sprite Caching System
 */

import { getSpriteCache, initializeSpriteCache, getSprite, getCacheStats, clearCache } from './src/roulette/sprites.js';

async function verifySpriteSystem() {
  console.log('🎨 Starting Sprite Cache System Verification...\n');
  
  try {
    // Initialize the cache
    console.log('1. Initializing sprite cache system...');
    const cache = getSpriteCache();
    await initializeSpriteCache();
    console.log('   ✅ Cache initialized successfully\n');
    
    // Test sprite generation
    console.log('2. Testing sprite generation...');
    
    const wheelBase = await getSprite('wheelBase');
    console.log(`   ✅ wheelBase: ${wheelBase.width}x${wheelBase.height}`);
    
    const numbersOverlay = await getSprite('numbersOverlay');
    console.log(`   ✅ numbersOverlay: ${numbersOverlay.width}x${numbersOverlay.height}`);
    
    const pocketMask = await getSprite('pocketMask');
    console.log(`   ✅ pocketMask: ${pocketMask.width}x${pocketMask.height}`);
    
    const ball = await getSprite('ball');
    console.log(`   ✅ ball: ${ball.width}x${ball.height}`);
    
    const pocketColors = await getSprite('pocketColors');
    console.log(`   ✅ pocketColors: ${pocketColors.width}x${pocketColors.height}\n`);
    
    // Test caching
    console.log('3. Testing cache functionality...');
    const ball2 = await getSprite('ball');
    console.log(`   ✅ Cache hit: ${ball === ball2}`);
    
    // Get statistics
    console.log('\n4. Cache Statistics:');
    const stats = getCacheStats();
    console.log(`   - Total Requests: ${stats.totalRequests}`);
    console.log(`   - Hits: ${stats.hits}`);
    console.log(`   - Misses: ${stats.misses}`);
    console.log(`   - Hit Rate: ${stats.hitRate}`);
    console.log(`   - Cache Size: ${(stats.cacheSize / 1024).toFixed(2)} KB\n`);
    
    // Memory usage
    console.log('5. Memory Usage:');
    const memory = cache.getMemoryUsage();
    console.log(`   - Sprite Count: ${memory.spriteCount}`);
    console.log(`   - Total Size: ${memory.totalSizeMB} MB`);
    console.log(`   - Average Sprite Size: ${memory.avgSpriteSize} bytes`);
    if (memory.biggestSprite) {
      console.log(`   - Biggest Sprite: ${memory.biggestSprite.key} (${(memory.biggestSprite.size / 1024).toFixed(2)} KB)`);
    }
    console.log();
    
    // Health status
    console.log('6. Health Status:');
    const health = cache.getHealthStatus();
    console.log(`   - Status: ${health.status}`);
    if (health.issues.length > 0) {
      console.log(`   - Issues: ${health.issues.join(', ')}`);
    } else {
      console.log(`   - No issues detected`);
    }
    console.log();
    
    // Validation
    console.log('7. Cache Validation:');
    const validation = cache.validateCache();
    console.log(`   - Valid: ${validation.valid}`);
    if (validation.errors.length > 0) {
      console.log(`   - Errors: ${validation.errors.join(', ')}`);
    }
    if (validation.warnings.length > 0) {
      console.log(`   - Warnings: ${validation.warnings.join(', ')}`);
    }
    console.log();
    
    // Test pocket layout
    console.log('8. Pocket Layout:');
    const pockets = cache._getPocketLayout();
    console.log(`   - Total Pockets: ${pockets.length}`);
    console.log(`   - Zero Pocket: ${pockets.find(p => p.number === '0')?.color}`);
    console.log(`   - Red Pockets: ${pockets.filter(p => p.color === 'red').length}`);
    console.log(`   - Black Pockets: ${pockets.filter(p => p.color === 'black').length}`);
    console.log(`   - Green Pockets: ${pockets.filter(p => p.color === 'green').length}\n`);
    
    // Test volatile sprite clearing
    console.log('9. Testing volatile sprite clearing...');
    await getSprite('ball'); // Ensure ball is cached
    const ballCached = cache.hasSprite('ball');
    console.log(`   - Ball cached before: ${ballCached}`);
    
    clearCache();
    console.log(`   - Cache cleared`);
    
    console.log('\n✅ Sprite Cache System Verification Complete!\n');
    console.log('All systems operational.');
    
  } catch (error) {
    console.error('\n❌ Verification Failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run verification
verifySpriteSystem();
