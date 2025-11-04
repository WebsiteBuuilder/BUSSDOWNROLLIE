/**
 * Test Validation Script
 * Validates that test files are properly structured
 */

import fs from 'fs';
import path from 'path';

const testDir = './tests/roulette';
const testFiles = [
  'physics.test.js',
  'mapping.test.js', 
  'render.test.js',
  'sprites.test.js',
  'integration.test.js'
];

console.log('🔍 Validating Roulette Test Files\n');

let allValid = true;

for (const file of testFiles) {
  const filePath = path.join(testDir, file);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for basic test structure
    const hasDescribe = content.includes('describe(');
    const hasIt = content.includes('it(') || content.includes('test(');
    const hasExpect = content.includes('expect(');
    
    // Check for required imports
    const hasImports = content.includes("from 'vitest'") || content.includes('from "vitest"');
    const hasDescribeImport = content.includes('describe');
    const hasExpectImport = content.includes('expect');
    
    // Count tests
    const describeMatches = content.match(/describe\(/g) || [];
    const itMatches = content.match(/it\(/g) || [];
    const testMatches = content.match(/test\(/g) || [];
    
    console.log(`📄 ${file}`);
    console.log(`  ✓ Has describe blocks: ${describeMatches.length}`);
    console.log(`  ✓ Has test cases: ${itMatches.length + testMatches.length}`);
    console.log(`  ✓ Has expect statements: ${hasExpect ? 'Yes' : 'No'}`);
    console.log(`  ✓ Proper imports: ${hasImports ? 'Yes' : 'No'}`);
    console.log(`  ✓ File size: ${(content.length / 1024).toFixed(2)} KB`);
    
    if (!hasDescribe || !hasIt || !hasExpect) {
      console.log(`  ❌ Missing essential test structure!`);
      allValid = false;
    }
    
    console.log('');
    
  } catch (error) {
    console.log(`❌ ${file}: Error reading file - ${error.message}`);
    allValid = false;
  }
}

// Validate test directory structure
console.log('📁 Test Directory Structure:');
try {
  const files = fs.readdirSync(testDir);
  console.log(`  ✓ Directory exists: ${testDir}`);
  console.log(`  ✓ Files found: ${files.length}`);
  files.forEach(file => {
    const stats = fs.statSync(path.join(testDir, file));
    console.log(`    - ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
  });
} catch (error) {
  console.log(`  ❌ Error accessing directory: ${error.message}`);
  allValid = false;
}

console.log('\n' + '='.repeat(50));
if (allValid) {
  console.log('✅ All test files are valid!');
  console.log('\nTo run tests:');
  console.log('  npm test -- tests/roulette');
  console.log('\nWith coverage:');
  console.log('  npm test -- tests/roulette --coverage');
} else {
  console.log('❌ Some test files have issues. Please review above.');
}

console.log('='.repeat(50));
