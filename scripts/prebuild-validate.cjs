const assert = require('assert');

console.log('🔍 [Pre-build] Validating cinematic animation dependencies...');

try {
  // 1. Check for canvas
  const { createCanvas } = require('canvas');
  assert(typeof createCanvas === 'function', 'canvas.createCanvas is not a function');
  console.log('  ✅ canvas module loaded successfully.');

  // 2. Check for gifencoder
  const GIFEncoder = require('gifencoder');
  assert(typeof GIFEncoder === 'function', 'gifencoder is not a function');
  console.log('  ✅ gifencoder module loaded successfully.');

  // 3. Perform a sample render test
  const canvas = createCanvas(10, 10);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'green';
  ctx.fillRect(0, 0, 10, 10);

  const encoder = new GIFEncoder(10, 10);
  encoder.start();
  encoder.addFrame(ctx);
  encoder.finish();

  const buffer = encoder.out.getData();
  assert(buffer.length > 0, 'GIFEncoder did not produce a buffer');
  console.log('  ✅ Sample render test passed.');

  console.log('🎉 [Pre-build] All cinematic dependencies are functional!');
  process.exit(0);
} catch (error) {
  console.error('❌ [Pre-build] Cinematic dependency validation FAILED!');
  console.error('   Error:', error.message);
  console.error('   Please check Dockerfile system libraries and package.json dependencies.');
  process.exit(1);
}
