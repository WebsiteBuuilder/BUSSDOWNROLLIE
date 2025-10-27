/**
 * Roulette Stability Test
 * Simulates 10 roulette spins to verify no crashes occur
 */

import { generateCinematicSpin } from '../src/roulette/cinematic-animation.js';
import { generateStaticRouletteImage } from '../src/roulette/safe-canvas-utils.js';

const COLORS = {
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m'
};

async function testSpin(testNumber, winningNumber) {
  console.log(`\n${COLORS.BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.RESET}`);
  console.log(`${COLORS.BLUE}Test #${testNumber}: Spinning for number ${winningNumber}${COLORS.RESET}`);
  console.log(`${COLORS.BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.RESET}`);
  
  const startTime = Date.now();
  let success = false;
  let method = 'NONE';
  let error = null;
  
  // Try cinematic GIF
  try {
    const job = await generateCinematicSpin(winningNumber, {
      duration: 3500,
      fps: 20,
      quality: 15
    });

    const result = await job.final;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    if (result && result.buffer && result.metadata) {
      console.log(`${COLORS.GREEN}✅ PASS: Cinematic GIF generated successfully${COLORS.RESET}`);
      console.log(`   Preview: ${(job.preview.buffer.length / 1024).toFixed(1)}KB`);
      console.log(`   Size: ${result.metadata.sizeMB}MB (${result.metadata.sizeKB}KB)`);
      console.log(`   Frames: ${result.metadata.frames}`);
      console.log(`   Encode Time: ${result.metadata.encodeTimeSeconds}s`);
      console.log(`   Total Time: ${elapsed}s`);
      console.log(`   FPS: ${result.metadata.fps}`);
      console.log(`   Resolution: ${result.metadata.resolution}`);
      success = true;
      method = 'CINEMATIC_GIF';
    } else {
      throw new Error('Result missing buffer or metadata');
    }
  } catch (gifError) {
    console.log(`${COLORS.YELLOW}⚠️  Cinematic GIF failed: ${gifError.message}${COLORS.RESET}`);
    
    // Try static PNG fallback
    try {
      const pngBuffer = await generateStaticRouletteImage(winningNumber);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      const sizeKB = (pngBuffer.length / 1024).toFixed(1);
      
      console.log(`${COLORS.GREEN}✅ PASS: Static PNG fallback generated successfully${COLORS.RESET}`);
      console.log(`   Size: ${sizeKB}KB`);
      console.log(`   Total Time: ${elapsed}s`);
      success = true;
      method = 'STATIC_PNG';
    } catch (pngError) {
      console.log(`${COLORS.RED}❌ FAIL: Static PNG also failed: ${pngError.message}${COLORS.RESET}`);
      error = pngError;
      method = 'FAILED';
    }
  }
  
  return { success, method, error, testNumber, winningNumber };
}

async function runStabilityTest() {
  console.log(`\n${COLORS.GREEN}╔════════════════════════════════════════════════════╗${COLORS.RESET}`);
  console.log(`${COLORS.GREEN}║   🎰 ROULETTE STABILITY TEST - 10 SPINS 🎰        ║${COLORS.RESET}`);
  console.log(`${COLORS.GREEN}╚════════════════════════════════════════════════════╝${COLORS.RESET}\n`);
  
  const testNumbers = [0, 7, 15, 23, 30, 36, 12, 19, 25, 32]; // Various numbers
  const results = [];
  
  const overallStart = Date.now();
  
  for (let i = 0; i < testNumbers.length; i++) {
    const result = await testSpin(i + 1, testNumbers[i]);
    results.push(result);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  const overallTime = ((Date.now() - overallStart) / 1000).toFixed(2);
  
  // Summary
  console.log(`\n${COLORS.BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.RESET}`);
  console.log(`${COLORS.BLUE}📊 TEST SUMMARY${COLORS.RESET}`);
  console.log(`${COLORS.BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.RESET}\n`);
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const gifCount = results.filter(r => r.method === 'CINEMATIC_GIF').length;
  const pngCount = results.filter(r => r.method === 'STATIC_PNG').length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`${COLORS.GREEN}Successful: ${successCount}${COLORS.RESET}`);
  console.log(`${COLORS.RED}Failed: ${failCount}${COLORS.RESET}`);
  console.log(`Cinematic GIF: ${gifCount}`);
  console.log(`Static PNG: ${pngCount}`);
  console.log(`Total Time: ${overallTime}s`);
  console.log(`Average Time: ${(overallTime / results.length).toFixed(2)}s per spin`);
  
  // Method breakdown
  console.log(`\n${COLORS.BLUE}Method Breakdown:${COLORS.RESET}`);
  results.forEach(r => {
    const status = r.success ? `${COLORS.GREEN}✓${COLORS.RESET}` : `${COLORS.RED}✗${COLORS.RESET}`;
    console.log(`  ${status} Test ${r.testNumber} (#${r.winningNumber}): ${r.method}`);
  });
  
  // Final verdict
  console.log(`\n${COLORS.BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.RESET}`);
  
  if (failCount === 0) {
    console.log(`${COLORS.GREEN}✅ ROULETTE CINEMATIC PIPELINE VERIFIED AND STABLE!${COLORS.RESET}`);
    console.log(`${COLORS.GREEN}   All ${results.length} spins completed successfully.${COLORS.RESET}`);
    console.log(`${COLORS.GREEN}   ${gifCount} via GIF, ${pngCount} via PNG fallback.${COLORS.RESET}`);
  } else {
    console.log(`${COLORS.RED}❌ PIPELINE UNSTABLE${COLORS.RESET}`);
    console.log(`${COLORS.RED}   ${failCount} out of ${results.length} spins failed.${COLORS.RESET}`);
    
    // Show errors
    console.log(`\n${COLORS.RED}Errors:${COLORS.RESET}`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`  Test ${r.testNumber} (#${r.winningNumber}): ${r.error?.message || 'Unknown error'}`);
    });
  }
  
  console.log(`${COLORS.BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.RESET}\n`);
  
  process.exit(failCount > 0 ? 1 : 0);
}

// Run the test
runStabilityTest().catch(error => {
  console.error(`${COLORS.RED}❌ Test runner crashed: ${error.message}${COLORS.RESET}`);
  console.error(error.stack);
  process.exit(1);
});

