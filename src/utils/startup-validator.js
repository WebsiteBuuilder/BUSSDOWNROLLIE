/**
 * Startup Validator
 * Runs integrity checks on bot startup
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Validate Prisma setup
 */
async function validatePrisma() {
  console.log('🔍 Validating Prisma setup...');
  
  try {
    const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma');
    if (!existsSync(schemaPath)) {
      console.error('❌ Prisma schema not found');
      return false;
    }
    
    // Try to import Prisma client
    await import('@prisma/client');
    console.log('✅ Prisma client OK');
    return true;
  } catch (error) {
    console.error('❌ Prisma validation failed:', error.message);
    return false;
  }
}

/**
 * Validate Node version
 */
function validateNodeVersion() {
  console.log('🔍 Validating Node version...');
  
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (major < 18) {
    console.error(`❌ Node version ${nodeVersion} is too old. Requires Node 18+`);
    return false;
  }
  
  console.log(`✅ Node ${nodeVersion} OK`);
  return true;
}

/**
 * Validate environment variables
 */
function validateEnvironment() {
  console.log('🔍 Validating environment variables...');
  
  const required = ['DISCORD_TOKEN'];
  const optional = ['DISCORD_CLIENT_ID'];
  const missing = [];
  
  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    return false;
  }
  
  for (const key of optional) {
    if (!process.env[key]) {
      console.warn(`⚠️  Optional variable ${key} not set`);
    }
  }
  
  console.log('✅ Environment variables OK');
  return true;
}

/**
 * Validate critical files exist
 */
function validateFiles() {
  console.log('🔍 Validating critical files...');
  
  const criticalFiles = [
    'src/index.js',
    'src/db/index.js',
    'src/commands/roulette.js',
    'src/roulette/robust-manager.js'
  ];
  
  const missing = [];
  
  for (const file of criticalFiles) {
    const filePath = join(__dirname, '..', '..', file);
    if (!existsSync(filePath)) {
      missing.push(file);
    }
  }
  
  if (missing.length > 0) {
    console.error(`❌ Missing critical files: ${missing.join(', ')}`);
    return false;
  }
  
  console.log('✅ Critical files OK');
  return true;
}

/**
 * Run all startup validations
 */
export async function runStartupValidation() {
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║         GUHD EATS Bot - Startup Validation       ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');
  
  const checks = [
    { name: 'Node Version', fn: validateNodeVersion },
    { name: 'Environment', fn: validateEnvironment },
    { name: 'Critical Files', fn: validateFiles },
    { name: 'Prisma', fn: validatePrisma }
  ];
  
  let allPassed = true;
  
  for (const check of checks) {
    try {
      const passed = await check.fn();
      if (!passed) {
        allPassed = false;
      }
    } catch (error) {
      console.error(`❌ ${check.name} check crashed:`, error.message);
      allPassed = false;
    }
    console.log('');
  }
  
  if (!allPassed) {
    console.warn('⚠️  Some startup checks failed, continuing anyway...\n');
    console.warn('Bot may have limited functionality. Review warnings above.');
    // Don't exit - let bot start
  } else {
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║          ✅ ALL VALIDATIONS PASSED                ║');
    console.log('╚═══════════════════════════════════════════════════╝\n');
  }
  
  console.log('🤖 GUHD EATS Bot is ready to start!\n');
}

