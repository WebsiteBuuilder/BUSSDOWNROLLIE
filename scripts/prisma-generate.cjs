#!/usr/bin/env node
/**
 * Prisma client generation script - ensures binary engine mode (not Data Proxy)
 * Cross-platform compatible (works on Windows, Linux, macOS)
 * 
 * [CRITICAL]: This script MUST ensure Prisma client is generated for direct
 * SQLite connection, NOT Data Proxy/Accelerate mode.
 */

const { spawn } = require('child_process');
const { existsSync, readFileSync } = require('fs');
const path = require('path');

// [CRITICAL]: Set environment variables to force binary engine mode BEFORE generation
// These MUST be set before prisma generate runs, or it may generate for Data Proxy
process.env.PRISMA_CLIENT_ENGINE_TYPE = 'binary';
process.env.PRISMA_GENERATE_DATAPROXY = 'false';
process.env.PRISMA_QUERY_ENGINE_TYPE = 'binary';
process.env.PRISMA_CLI_QUERY_ENGINE_TYPE = 'binary';

// Also unset any Data Proxy related vars that might interfere
delete process.env.PRISMA_ACCELERATE_URL;
delete process.env.PRISMA_DATABASE_URL;

console.log('🔧 Generating Prisma client in binary mode (NOT Data Proxy)...');
console.log('   PRISMA_CLIENT_ENGINE_TYPE=binary');
console.log('   PRISMA_GENERATE_DATAPROXY=false');
console.log('   PRISMA_QUERY_ENGINE_TYPE=binary');

const projectRoot = path.resolve(__dirname, '..');

// Verify DATABASE_URL is set and is file:// (not prisma://)
const dbUrl = process.env.DATABASE_URL;
if (dbUrl && dbUrl.startsWith('prisma://')) {
  console.error('❌ ERROR: DATABASE_URL is set to prisma:// (Data Proxy)');
  console.error('   This script generates for direct SQLite connection.');
  console.error('   Current DATABASE_URL:', dbUrl);
  console.error('   Please set DATABASE_URL to file:// format (e.g., file:/data/guhdeats.db)');
  process.exit(1);
}

// [CRITICAL]: Delete existing Prisma client to force clean regeneration
// This ensures we don't reuse a client that was generated with Data Proxy
const { rmSync } = require('fs');
const clientPath = path.join(projectRoot, 'node_modules', '@prisma', 'client');
const generatedPath = path.join(projectRoot, 'node_modules', '.prisma');

if (existsSync(clientPath)) {
  console.log('🧹 Removing existing Prisma client to force clean regeneration...');
  try {
    rmSync(clientPath, { recursive: true, force: true });
    console.log('✅ Removed existing Prisma client');
  } catch (error) {
    console.warn('⚠️  Could not remove existing Prisma client:', error.message);
    console.warn('   Continuing anyway - prisma generate will overwrite it');
  }
}

if (existsSync(generatedPath)) {
  try {
    rmSync(generatedPath, { recursive: true, force: true });
    console.log('✅ Removed existing Prisma generated files');
  } catch (error) {
    console.warn('⚠️  Could not remove existing Prisma generated files:', error.message);
  }
}

const prismaGenerate = spawn('npx', ['prisma', 'generate'], {
  stdio: 'inherit',
  shell: true,
  cwd: projectRoot,
  env: {
    ...process.env,
    // Ensure these are definitely set in the child process
    PRISMA_CLIENT_ENGINE_TYPE: 'binary',
    PRISMA_GENERATE_DATAPROXY: 'false',
    PRISMA_QUERY_ENGINE_TYPE: 'binary',
    PRISMA_CLI_QUERY_ENGINE_TYPE: 'binary',
  },
});

prismaGenerate.on('close', (code) => {
  if (code !== 0) {
    console.error(`⚠️  Prisma generate exited with code ${code}`);
    console.error('   This may indicate the client was generated incorrectly.');
    process.exit(code);
  } else {
    console.log('✅ Prisma client generated successfully');
    
    // Verify the generated client doesn't have Data Proxy indicators
    const clientPath = path.join(projectRoot, 'node_modules', '@prisma', 'client');
    const indexPath = path.join(clientPath, 'index.js');
    
    if (existsSync(indexPath)) {
      try {
        const clientCode = readFileSync(indexPath, 'utf8');
        if (clientCode.includes('prisma://') && clientCode.includes('dataproxy')) {
          console.warn('⚠️  WARNING: Generated client may contain Data Proxy references');
          console.warn('   The client should use binary engines for SQLite.');
        } else {
          console.log('✅ Verified: Generated client appears to be in binary mode');
        }
      } catch (error) {
        console.warn('⚠️  Could not verify generated client:', error.message);
      }
    }
  }
});

prismaGenerate.on('error', (error) => {
  console.error('❌ Failed to run prisma generate:', error);
  process.exit(1);
});

