#!/usr/bin/env node

/**
 * Roulette Dependencies Validator - STRICT MODE
 * Pre-flight check to ensure all roulette animation dependencies are installed
 * FAILS HARD if dependencies can't be installed or tested
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REQUIRED_DEPS = [
  { name: 'canvas', version: '^2.11.2' },
  { name: 'gifencoder', version: '^2.0.1' },
];

const MAX_INSTALL_RETRIES = 3;

console.log('╔═══════════════════════════════════════════════════╗');
console.log('║  GUHD EATS - Roulette Dependencies Validator     ║');
console.log('║              STRICT MODE - NO FALLBACK            ║');
console.log('╚═══════════════════════════════════════════════════╝\n');

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
 * Auto-install missing dependency with retries
 */
function installPackage(packageName, version, attempt = 1) {
  console.log(`📦 Installing ${packageName}@${version} (attempt ${attempt}/${MAX_INSTALL_RETRIES})...`);
  try {
    execSync(`npm install ${packageName}@${version}`, {
      stdio: 'inherit',
      cwd: join(__dirname, '..')
    });
    console.log(`✅ Successfully installed ${packageName}\n`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to install ${packageName}: ${error.message}\n`);
    
    if (attempt < MAX_INSTALL_RETRIES) {
      console.log(`🔄 Retrying installation...`);
      return installPackage(packageName, version, attempt + 1);
    }
    
    return false;
  }
}

/**
 * Validate all required dependencies
 */
function validateDependencies() {
  console.log('📋 Checking required dependencies:\n');
  
  let allInstalled = true;
  
  for (const dep of REQUIRED_DEPS) {
    const installed = isPackageInstalled(dep.name);
    
    if (!installed) {
      console.log(`❌ ${dep.name} - NOT INSTALLED`);
      console.log(`   Attempting automatic installation...\n`);
      
      const success = installPackage(dep.name, dep.version);
      if (!success) {
        console.error(`\n❌ CRITICAL: Failed to install ${dep.name} after ${MAX_INSTALL_RETRIES} attempts`);
        allInstalled = false;
      }
    } else {
      console.log(`✅ ${dep.name} - OK`);
    }
  }
  
  console.log('');
  return allInstalled;
}

/**
 * Test canvas and gifencoder imports
 */
async function testImports() {
  console.log('🧪 Testing module imports...\n');
  
  try {
    // Test canvas
    console.log('Testing canvas import...');
    const { createCanvas } = await import('canvas');
    if (!createCanvas) {
      throw new Error('createCanvas function not available');
    }
    
    // Create a test canvas to verify it works
    const testCanvas = createCanvas(10, 10);
    if (!testCanvas) {
      throw new Error('Canvas creation failed');
    }
    console.log('✅ canvas - Import successful\n');
  } catch (error) {
    console.error(`❌ canvas - Import failed: ${error.message}\n`);
    return false;
  }

  try {
    // Test gifencoder
    console.log('Testing gifencoder import...');
    const GIFEncoder = (await import('gifencoder')).default;
    if (!GIFEncoder) {
      throw new Error('GIFEncoder class not available');
    }
    
    const testEncoder = new GIFEncoder(10, 10);
    if (!testEncoder) {
      throw new Error('GIFEncoder creation failed');
    }
    console.log('✅ gifencoder - Import successful\n');
  } catch (error) {
    console.error(`❌ gifencoder - Import failed: ${error.message}\n`);
    return false;
  }

  return true;
}

/**
 * Perform actual test render to verify canvas + gifencoder work together
 */
async function testRender() {
  console.log('🎨 Testing canvas rendering + GIF encoding...\n');
  
  try {
    const { createCanvas } = await import('canvas');
    const GIFEncoder = (await import('gifencoder')).default;
    
    // Create test canvas
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    
    // Draw test content (GUHD EATS colors)
    ctx.fillStyle = '#00FF75'; // Neon green
    ctx.fillRect(0, 0, 100, 100);
    ctx.fillStyle = '#FFD700'; // Gold
    ctx.font = 'bold 24px Arial';
    ctx.fillText('TEST', 20, 50);
    
    // Draw a circle to test more complex rendering
    ctx.beginPath();
    ctx.arc(50, 50, 30, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Test GIF encoder
    console.log('   Encoding test GIF...');
    const encoder = new GIFEncoder(100, 100);
    encoder.start();
    encoder.setRepeat(0);
    encoder.setDelay(100);
    encoder.setQuality(10);
    encoder.addFrame(ctx);
    encoder.finish();
    const buffer = encoder.out.getData();
    
    if (buffer.length === 0) {
      throw new Error('GIF encoder produced empty buffer');
    }
    
    console.log(`   Generated ${buffer.length} bytes`);
    console.log('✅ Test render successful - Canvas + GIF encoding working!\n');
    return true;
  } catch (error) {
    console.error(`❌ Test render failed: ${error.message}`);
    console.error(`   Stack: ${error.stack}\n`);
    return false;
  }
}

/**
 * Main validation flow
 */
async function main() {
  let exitCode = 0;
  
  try {
    // Step 1: Validate/install dependencies
    const depsInstalled = validateDependencies();
    if (!depsInstalled) {
      console.error('╔═══════════════════════════════════════════════════╗');
      console.error('║      ❌ DEPENDENCY INSTALLATION FAILED            ║');
      console.error('╚═══════════════════════════════════════════════════╝\n');
      console.error('Required packages could not be installed.');
      console.error('Cinematic animation will be DISABLED.\n');
      process.exit(1);
    }

    // Step 2: Test imports
    const importsWork = await testImports();
    if (!importsWork) {
      console.error('╔═══════════════════════════════════════════════════╗');
      console.error('║         ❌ MODULE IMPORT FAILED                   ║');
      console.error('╚═══════════════════════════════════════════════════╝\n');
      console.error('Packages are installed but cannot be imported.');
      console.error('This may indicate missing system dependencies.');
      console.error('Cinematic animation will be DISABLED.\n');
      process.exit(1);
    }

    // Step 3: Test actual rendering
    const testRenderPassed = await testRender();
    if (!testRenderPassed) {
      console.error('╔═══════════════════════════════════════════════════╗');
      console.error('║         ❌ RENDER TEST FAILED                     ║');
      console.error('╚═══════════════════════════════════════════════════╝\n');
      console.error('Canvas and GIF encoder are available but rendering failed.');
      console.error('This may indicate corrupted dependencies or system libraries.');
      console.error('Cinematic animation will be DISABLED.\n');
      process.exit(1);
    }

    // All checks passed!
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║       ✅ ALL VALIDATIONS PASSED                   ║');
    console.log('╚═══════════════════════════════════════════════════╝\n');
    console.log('🎰 Cinematic roulette animation system: READY');
    console.log('🎨 3D wheel rendering: ENABLED');
    console.log('🎬 Motion blur & lighting: ENABLED');
    console.log('✨ "STILL GUUHHHD 🎰" branding: ACTIVE\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Validation script crashed:', error);
    console.error('Cinematic animation will be DISABLED.\n');
    process.exit(1);
  }
}

// Run validation
main();
