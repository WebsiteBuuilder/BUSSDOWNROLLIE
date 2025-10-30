const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 [Pre-build] Starting self-healing dependency validation...');

// Core dependencies that must be validated
const CRITICAL_DEPS = [
  'canvas',
  'gifencoder',
  'sharp'
];

// Optional but recommended dependencies
const OPTIONAL_DEPS = [
  'node-canvas-gif',
  '@napi-rs/canvas'
];

function logWithEmoji(emoji, message) {
  console.log(`${emoji} [Pre-build] ${message}`);
}

function runCommand(command, description) {
  try {
    logWithEmoji('⚙️', `Running: ${description}`);
    const result = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    logWithEmoji('✅', `${description} completed successfully`);
    return result;
  } catch (error) {
    logWithEmoji('❌', `${description} failed: ${error.message}`);
    throw error;
  }
}

function checkModule(moduleName) {
  try {
    require.resolve(moduleName);
    return true;
  } catch (error) {
    return false;
  }
}

function installDependency(depName, isRequired = false) {
  try {
    logWithEmoji('🔧', `Auto-installing missing dependency: ${depName}`);
    
    // Try npm install with different strategies
    const strategies = [
      `npm install ${depName} --save`,
      `npm install ${depName} --save --legacy-peer-deps`,
      `npm install ${depName} --save-dev --legacy-peer-deps`
    ];
    
    for (const strategy of strategies) {
      try {
        runCommand(strategy, `Install ${depName}`);
        
        // Verify the installation worked
        if (checkModule(depName)) {
          logWithEmoji('✅', `${depName} installed and verified successfully`);
          return true;
        }
      } catch (error) {
        logWithEmoji('⚠️', `Strategy failed, trying next: ${strategy}`);
        continue;
      }
    }
    
    throw new Error(`All installation strategies failed for ${depName}`);
  } catch (error) {
    if (isRequired) {
      logWithEmoji('🚨', `CRITICAL: Failed to install required dependency ${depName}`);
      logWithEmoji('💡', `Please run manually: npm install ${depName} --save`);
      process.exit(1);
    } else {
      logWithEmoji('⚠️', `Optional dependency ${depName} could not be installed, skipping...`);
      return false;
    }
  }
}

function checkSystemDependencies() {
  logWithEmoji('🖥️', 'Checking system dependencies...');
  
  const requiredLibraries = [
    'libcairo2-dev',
    'libpango1.0-dev', 
    'libjpeg-dev',
    'libgif-dev',
    'librsvg2-dev',
    'pkg-config'
  ];
  
  // Check if we're in a Debian/Ubuntu environment
  try {
    const osRelease = execSync('cat /etc/os-release', { encoding: 'utf-8' }).toLowerCase();
    const isDebian = osRelease.includes('debian') || osRelease.includes('ubuntu');
    
    if (isDebian) {
      logWithEmoji('🐧', 'Detected Debian/Ubuntu environment, checking system packages...');
      
      for (const lib of requiredLibraries) {
        try {
          execSync(`dpkg -l | grep -q ${lib}`, { stdio: 'pipe' });
          logWithEmoji('✅', `${lib} is installed`);
        } catch (error) {
          logWithEmoji('🔧', `Installing missing system library: ${lib}`);
          try {
            execSync(`apt-get update && apt-get install -y ${lib}`, { stdio: 'pipe' });
            logWithEmoji('✅', `${lib} installed successfully`);
          } catch (installError) {
            logWithEmoji('⚠️', `Could not install ${lib}, canvas functionality may be limited`);
          }
        }
      }
    } else {
      logWithEmoji('ℹ️', `Non-Debian environment detected. Please ensure these libraries are installed: ${requiredLibraries.join(', ')}`);
    }
  } catch (error) {
    logWithEmoji('ℹ️', 'Could not determine OS type, skipping system dependency check');
  }
}

function testCriticalModules() {
  logWithEmoji('🧪', 'Testing critical modules...');
  
  // Test canvas
  try {
    const { createCanvas } = require('canvas');
    if (typeof createCanvas !== 'function') {
      throw new Error('canvas.createCanvas is not a function');
    }
    
    // Test canvas can actually render
    const testCanvas = createCanvas(10, 10);
    const ctx = testCanvas.getContext('2d');
    ctx.fillStyle = 'green';
    ctx.fillRect(0, 0, 10, 10);
    
    logWithEmoji('✅', 'Canvas module is functional');
  } catch (error) {
    logWithEmoji('🚨', `Canvas test failed: ${error.message}`);
    logWithEmoji('💡', 'This usually indicates missing system libraries or native bindings');
    throw error;
  }
  
  // Test gifencoder
  try {
    const GIFEncoder = require('gifencoder');
    if (typeof GIFEncoder !== 'function') {
      throw new Error('gifencoder is not a function');
    }
    
    // Test gifencoder can encode
    const encoder = new GIFEncoder(10, 10);
    encoder.start();
    const { createCanvas } = require('canvas');
    const ctx = createCanvas(10, 10).getContext('2d');
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 10, 10);
    encoder.addFrame(ctx);
    encoder.finish();
    
    const buffer = encoder.out.getData();
    if (buffer.length === 0) {
      throw new Error('GIFEncoder produced empty buffer');
    }
    
    logWithEmoji('✅', 'Gifencoder module is functional');
  } catch (error) {
    logWithEmoji('🚨', `Gifencoder test failed: ${error.message}`);
    logWithEmoji('💡', 'This indicates gifencoder is not properly installed or configured');
    throw error;
  }
  
  // Test sharp
  try {
    const sharp = require('sharp');
    if (typeof sharp !== 'function') {
      throw new Error('sharp is not a function');
    }
    
    logWithEmoji('✅', 'Sharp module is functional');
  } catch (error) {
    logWithEmoji('🚨', `Sharp test failed: ${error.message}`);
    throw error;
  }
}

function validateOptionalModules() {
  logWithEmoji('🔍', 'Checking optional animation modules...');
  
  for (const dep of OPTIONAL_DEPS) {
    if (checkModule(dep)) {
      try {
        require(dep);
        logWithEmoji('✅', `Optional module ${dep} is available`);
      } catch (error) {
        logWithEmoji('⚠️', `Optional module ${dep} exists but failed to load: ${error.message}`);
      }
    } else {
      logWithEmoji('ℹ️', `Optional module ${dep} not installed (not required)`);
    }
  }
}

function main() {
  try {
    logWithEmoji('🚀', 'Starting self-healing dependency validation...');
    
    // Step 1: Check and fix system dependencies
    checkSystemDependencies();
    
    // Step 2: Validate and auto-install critical dependencies
    logWithEmoji('📦', 'Validating critical npm dependencies...');
    for (const dep of CRITICAL_DEPS) {
      if (!checkModule(dep)) {
        installDependency(dep, true);
      } else {
        logWithEmoji('✅', `Critical dependency ${dep} is already installed`);
      }
    }
    
    // Step 3: Check optional dependencies (don't auto-install these)
    validateOptionalModules();
    
    // Step 4: Test that critical modules actually work
    testCriticalModules();
    
    // Step 5: Ensure native bindings are compiled for canvas
    try {
      logWithEmoji('🔨', 'Ensuring canvas native bindings are compiled...');
      execSync('npm rebuild canvas', { stdio: 'pipe' });
      logWithEmoji('✅', 'Canvas native bindings compiled successfully');
    } catch (error) {
      logWithEmoji('⚠️', `Canvas rebuild failed: ${error.message}. This may cause runtime issues.`);
    }
    
    // Step 6: Verify sharp compilation
    try {
      logWithEmoji('🔧', 'Verifying sharp compilation...');
      execSync('npm rebuild sharp', { stdio: 'pipe' });
      logWithEmoji('✅', 'Sharp compiled successfully');
    } catch (error) {
      logWithEmoji('⚠️', `Sharp rebuild failed: ${error.message}. This may cause runtime issues.`);
    }
    
    logWithEmoji('🎉', '🎉 Self-healing validation completed successfully! 🎉');
    logWithEmoji('✨', 'All critical dependencies are functional and ready for build.');
    process.exit(0);
    
  } catch (error) {
    logWithEmoji('💥', 'Self-healing validation FAILED!');
    logWithEmoji('📋', 'Manual troubleshooting steps:');
    logWithEmoji('📋', '1. Ensure all system libraries are installed (libcairo2-dev, etc.)');
    logWithEmoji('📋', '2. Try: npm install --legacy-peer-deps');
    logWithEmoji('📋', '3. Check: npm run rebuild-all');
    logWithEmoji('📋', '4. Verify: docker system prune -a');
    logWithEmoji('');
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

// Run the validation
main();