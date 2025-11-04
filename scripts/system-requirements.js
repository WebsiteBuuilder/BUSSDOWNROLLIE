#!/usr/bin/env node

/**
 * System Requirements Validator for Railway Deployment
 * Ensures all dependencies and system requirements are met
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkRequirement(name, condition, description) {
  if (condition) {
    log(`✅ ${name}: OK - ${description}`, 'green');
    return true;
  } else {
    log(`❌ ${name}: FAILED - ${description}`, 'red');
    return false;
  }
}

function checkCommand(command, description) {
  try {
    execSync(command, { stdio: 'ignore' });
    log(`✅ Command available: ${command}`, 'green');
    return true;
  } catch (error) {
    log(`❌ Command missing: ${command} - ${description}`, 'red');
    return false;
  }
}

async function validateNodeVersion() {
  log('🔍 Validating Node.js version...', 'cyan');
  
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);
  
  return checkRequirement(
    'Node.js Version',
    major >= 18,
    `Version ${version} (Node 18+ required)`
  );
}

async function validateNpmVersion() {
  log('🔍 Validating npm version...', 'cyan');
  
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    return checkRequirement(
      'npm Version',
      true,
      `Version ${npmVersion}`
    );
  } catch (error) {
    return checkRequirement('npm Version', false, 'npm not found');
  }
}

async function validatePackageJson() {
  log('🔍 Validating package.json...', 'cyan');
  
  try {
    const packageJson = JSON.parse(
      readFileSync('package.json', 'utf8')
    );
    
    const requiredDeps = [
      '@prisma/client',
      'better-sqlite3',
      'canvas',
      'sharp',
      'discord.js'
    ];
    
    const missingDeps = requiredDeps.filter(
      dep => !packageJson.dependencies?.[dep]
    );
    
    if (missingDeps.length > 0) {
      return checkRequirement(
        'Package Dependencies',
        false,
        `Missing: ${missingDeps.join(', ')}`
      );
    }
    
    return checkRequirement(
      'Package Dependencies',
      true,
      'All required dependencies found'
    );
  } catch (error) {
    return checkRequirement('Package Dependencies', false, 'package.json not found or invalid');
  }
}

async function validateNativeDependencies() {
  log('🔍 Validating native dependencies...', 'cyan');
  
  const nativeDeps = [
    {
      name: 'Canvas',
      test: () => require('canvas'),
      description: 'Node.js canvas rendering library'
    },
    {
      name: 'Sharp',
      test: () => require('sharp'),
      description: 'High-performance image processing'
    },
    {
      name: 'Better-SQLite3',
      test: () => require('better-sqlite3'),
      description: 'SQLite3 database driver'
    }
  ];
  
  let allValid = true;
  
  for (const dep of nativeDeps) {
    try {
      dep.test();
      log(`✅ ${dep.name}: OK - ${dep.description}`, 'green');
    } catch (error) {
      log(`❌ ${dep.name}: FAILED - ${dep.description}`, 'red');
      log(`   Error: ${error.message}`, 'yellow');
      allValid = false;
    }
  }
  
  return allValid;
}

async function validatePrisma() {
  log('🔍 Validating Prisma setup...', 'cyan');
  
  const schemaExists = existsSync('prisma/schema.prisma');
  
  if (!schemaExists) {
    return checkRequirement('Prisma Schema', false, 'schema.prisma not found');
  }
  
  try {
    const { PrismaClient } = await import('@prisma/client');
    return checkRequirement('Prisma Client', true, 'Prisma client can be imported');
  } catch (error) {
    return checkRequirement('Prisma Client', false, 'Prisma client import failed');
  }
}

async function validateSystemLibraries() {
  log('🔍 Validating system libraries...', 'cyan');
  
  const systemLibs = [
    {
      command: 'ldconfig -p | grep -q libcairo',
      name: 'Cairo Graphics',
      description: 'Required for Canvas rendering'
    },
    {
      command: 'ldconfig -p | grep -q libpango',
      name: 'Pango',
      description: 'Required for text rendering'
    },
    {
      command: 'ldconfig -p | grep -q libjpeg',
      name: 'JPEG Library',
      description: 'Required for image processing'
    }
  ];
  
  let allValid = true;
  
  for (const lib of systemLibs) {
    try {
      execSync(lib.command, { stdio: 'ignore' });
      log(`✅ ${lib.name}: OK - ${lib.description}`, 'green');
    } catch (error) {
      log(`❌ ${lib.name}: FAILED - ${lib.description}`, 'red');
      allValid = false;
    }
  }
  
  return allValid;
}

async function validateDockerBuild() {
  log('🔍 Validating Docker build...', 'cyan');
  
  const dockerExists = existsSync('Dockerfile');
  
  if (!dockerExists) {
    return checkRequirement('Dockerfile', false, 'Dockerfile not found');
  }
  
  const dockerfile = readFileSync('Dockerfile', 'utf8');
  const hasCanvasDeps = dockerfile.includes('libcairo2-dev') && 
                       dockerfile.includes('libpango1.0-dev');
  const hasSharpDeps = dockerfile.includes('build-essential');
  const hasNode20 = dockerfile.includes('node:20');
  
  const allGood = hasCanvasDeps && hasSharpDeps && hasNode20;
  
  if (!hasCanvasDeps) {
    log('⚠️  Canvas dependencies might be missing in Dockerfile', 'yellow');
  }
  
  if (!hasSharpDeps) {
    log('⚠️  Sharp build dependencies might be missing in Dockerfile', 'yellow');
  }
  
  if (!hasNode20) {
    log('⚠️  Not using Node.js 20 in Dockerfile', 'yellow');
  }
  
  return checkRequirement(
    'Dockerfile Configuration',
    allGood,
    'All native dependencies and Node 20 properly configured'
  );
}

async function validateRailwayConfig() {
  log('🔍 Validating Railway configuration...', 'cyan');
  
  const railwayJsonExists = existsSync('railway.json');
  
  if (!railwayJsonExists) {
    return checkRequirement('Railway Config', false, 'railway.json not found');
  }
  
  try {
    const railwayConfig = JSON.parse(
      readFileSync('railway.json', 'utf8')
    );
    
    const hasHealthCheck = railwayConfig.deploy?.healthcheckPath;
    const hasBuildConfig = railwayConfig.build?.builder === 'DOCKERFILE';
    
    return checkRequirement(
      'Railway Configuration',
      hasHealthCheck && hasBuildConfig,
      'Health check and Docker builder properly configured'
    );
  } catch (error) {
    return checkRequirement('Railway Configuration', false, 'railway.json invalid');
  }
}

async function validateEnvironment() {
  log('🔍 Validating environment variables...', 'cyan');
  
  const requiredEnvVars = [
    'DISCORD_BOT_TOKEN'
  ];
  
  const optionalEnvVars = [
    'DATABASE_URL',
    'NODE_ENV',
    'PORT',
    'LOG_LEVEL'
  ];
  
  let allValid = true;
  
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      log(`✅ ${envVar}: Set`, 'green');
    } else {
      log(`❌ ${envVar}: NOT SET (Required)`, 'red');
      allValid = false;
    }
  }
  
  for (const envVar of optionalEnvVars) {
    if (process.env[envVar]) {
      log(`✅ ${envVar}: ${process.env[envVar]}`, 'green');
    } else {
      log(`ℹ️  ${envVar}: Not set (Using default)`, 'cyan');
    }
  }
  
  return allValid;
}

async function validateDiskSpace() {
  log('🔍 Validating disk space...', 'cyan');
  
  try {
    const { stdout } = execSync('df -h / | tail -1', { encoding: 'utf8' });
    const fields = stdout.trim().split(/\s+/);
    const available = fields[3];
    
    // Check if we have at least 1GB available
    const availableGB = parseFloat(available.replace(/[A-Z]/g, ''));
    const unit = available.match(/[A-Z]/)?.[0] || 'G';
    
    let isEnough = true;
    if (unit === 'M') {
      isEnough = availableGB >= 1024;
    } else if (unit === 'G') {
      isEnough = availableGB >= 1;
    }
    
    return checkRequirement(
      'Disk Space',
      isEnough,
      `${available} available`
    );
  } catch (error) {
    return checkRequirement('Disk Space', false, 'Could not check disk space');
  }
}

async function runAllValidations() {
  log('🚀 Starting System Requirements Validation\n', 'cyan');
  
  const validations = [
    { name: 'Node.js Version', func: validateNodeVersion },
    { name: 'npm Version', func: validateNpmVersion },
    { name: 'Package.json', func: validatePackageJson },
    { name: 'Native Dependencies', func: validateNativeDependencies },
    { name: 'Prisma Setup', func: validatePrisma },
    { name: 'System Libraries', func: validateSystemLibraries },
    { name: 'Docker Configuration', func: validateDockerBuild },
    { name: 'Railway Configuration', func: validateRailwayConfig },
    { name: 'Environment Variables', func: validateEnvironment },
    { name: 'Disk Space', func: validateDiskSpace }
  ];
  
  const results = [];
  
  for (const validation of validations) {
    try {
      const result = await validation.func();
      results.push({ name: validation.name, passed: result });
    } catch (error) {
      log(`❌ ${validation.name}: ERROR - ${error.message}`, 'red');
      results.push({ name: validation.name, passed: false });
    }
    log('', 'reset');
  }
  
  // Summary
  log('📊 Validation Summary', 'cyan');
  log('===================', 'cyan');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  for (const result of results) {
    const status = result.passed ? '✅' : '❌';
    log(`${status} ${result.name}`, result.passed ? 'green' : 'red');
  }
  
  log('', 'reset');
  log(`🎯 Overall: ${passed}/${total} validations passed`, passed === total ? 'green' : 'yellow');
  
  if (passed === total) {
    log('🎉 All system requirements met! Ready for Railway deployment.', 'green');
    process.exit(0);
  } else {
    log('⚠️  Some requirements not met. Please fix issues before deployment.', 'yellow');
    process.exit(1);
  }
}

// Run validations if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllValidations().catch(error => {
    log(`💥 Validation failed with error: ${error.message}`, 'red');
    process.exit(1);
  });
}

export { runAllValidations };