#!/usr/bin/env node

/**
 * Roulette Dependencies Validator
 * Pre-flight check to ensure all roulette animation dependencies are installed
 * Runs before bot startup to prevent crashes
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REQUIRED_DEPS = [
  'canvas',
  'gifencoder',
];

const OPTIONAL_DEPS = [
  'node-canvas-gif',
  '@napi-rs/canvas'
];

console.log('🔍 Validating roulette animation dependencies...\n');

/**
 * Check if a package is installed
 */
function isPackageInstalled(packageName) {
  try {
    const packageJsonPath = join(__dirname, '..', 'node_modules', packageName, 'package.json');
    readFileSync(packageJsonPath, 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if package.json includes dependency
 */
function isInPackageJson(packageName) {
  try {
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    return !!(packageJson.dependencies?.[packageName] || packageJson.devDependencies?.[packageName]);
  } catch (error) {
    console.error(`❌ Failed to read package.json: ${error.message}`);
    return false;
  }
}

/**
 * Auto-install missing dependency
 */
function installPackage(packageName, version = 'latest') {
  console.log(`📦 Installing ${packageName}@${version}...`);
  try {
    execSync(`npm install ${packageName}@${version}`, {
      stdio: 'inherit',
      cwd: join(__dirname, '..')
    });
    console.log(`✅ Successfully installed ${packageName}\n`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to install ${packageName}: ${error.message}\n`);
    return false;
  }
}

/**
 * Validate all required dependencies
 */
function validateDependencies() {
  let missingRequired = [];
  let missingOptional = [];
  let allValid = true;

  // Check required dependencies
  console.log('📋 Checking required dependencies:\n');
  for (const dep of REQUIRED_DEPS) {
    const installed = isPackageInstalled(dep);
    const inPackageJson = isInPackageJson(dep);

    if (!installed) {
      console.log(`❌ ${dep} - NOT INSTALLED`);
      missingRequired.push(dep);
      allValid = false;
    } else if (!inPackageJson) {
      console.log(`⚠️  ${dep} - Installed but not in package.json`);
    } else {
      console.log(`✅ ${dep} - OK`);
    }
  }

  // Check optional dependencies
  console.log('\n📋 Checking optional dependencies:\n');
  for (const dep of OPTIONAL_DEPS) {
    const installed = isPackageInstalled(dep);
    if (!installed) {
      console.log(`⚠️  ${dep} - Not installed (optional)`);
      missingOptional.push(dep);
    } else {
      console.log(`✅ ${dep} - OK`);
    }
  }

  return { missingRequired, missingOptional, allValid };
}

/**
 * Test canvas and gifencoder imports
 */
async function testImports() {
  console.log('\n🧪 Testing module imports...\n');
  
  try {
    // Test canvas
    console.log('Testing canvas import...');
    const { createCanvas } = await import('canvas');
    const testCanvas = createCanvas(100, 100);
    if (!testCanvas) throw new Error('Canvas creation failed');
    console.log('✅ canvas - Import successful\n');
  } catch (error) {
    console.error(`❌ canvas - Import failed: ${error.message}\n`);
    return false;
  }

  try {
    // Test gifencoder
    console.log('Testing gifencoder import...');
    const GIFEncoder = (await import('gifencoder')).default;
    const testEncoder = new GIFEncoder(100, 100);
    if (!testEncoder) throw new Error('GIFEncoder creation failed');
    console.log('✅ gifencoder - Import successful\n');
  } catch (error) {
    console.error(`❌ gifencoder - Import failed: ${error.message}\n`);
    return false;
  }

  return true;
}

/**
 * Main validation flow
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   GUHD EATS - Roulette Dependencies Validator    ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');

  // Step 1: Validate dependencies
  const { missingRequired, missingOptional, allValid } = validateDependencies();

  // Step 2: Auto-install missing required dependencies
  if (missingRequired.length > 0) {
    console.log('\n🔧 Auto-installing missing required dependencies...\n');
    
    const versions = {
      'canvas': '^2.11.2',
      'gifencoder': '^2.0.1'
    };

    for (const dep of missingRequired) {
      const success = installPackage(dep, versions[dep] || 'latest');
      if (!success) {
        console.error(`\n❌ CRITICAL: Failed to install ${dep}`);
        console.error('Roulette animation will be disabled. Bot will use fallback mode.\n');
        process.exit(0); // Exit gracefully, not error
      }
    }
  }

  // Step 3: Test imports
  const importsWork = await testImports();
  
  if (!importsWork) {
    console.error('⚠️  WARNING: Module imports failed.');
    console.error('Roulette will use text-based animation fallback.\n');
    process.exit(0); // Graceful exit
  }

  // Step 4: Final summary
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║            ✅ VALIDATION COMPLETE                 ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');
  console.log('🎰 Roulette animation system verified and ready');
  console.log('🎨 Cinematic 3D wheel rendering: ENABLED');
  console.log('✨ "STILL GUUHHHD 🎰" branding: ACTIVE\n');
  
  process.exit(0);
}

// Run validation
main().catch(error => {
  console.error('\n❌ Validation script crashed:', error);
  console.error('Bot will start in safe mode with animation disabled.\n');
  process.exit(0); // Graceful exit even on script error
});

