#!/usr/bin/env node
/**
 * Prisma client generation script - ensures binary engine mode (not Data Proxy)
 * Cross-platform compatible (works on Windows, Linux, macOS)
 */

const { spawn } = require('child_process');
const path = require('path');

// Set environment variables to force binary engine mode
process.env.PRISMA_CLIENT_ENGINE_TYPE = 'binary';
process.env.PRISMA_GENERATE_DATAPROXY = 'false';
process.env.PRISMA_QUERY_ENGINE_TYPE = 'binary';
process.env.PRISMA_CLI_QUERY_ENGINE_TYPE = 'binary';

console.log('🔧 Generating Prisma client in binary mode (not Data Proxy)...');
console.log('   PRISMA_CLIENT_ENGINE_TYPE=binary');
console.log('   PRISMA_GENERATE_DATAPROXY=false');

const prismaGenerate = spawn('npx', ['prisma', 'generate'], {
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..'),
});

prismaGenerate.on('close', (code) => {
  if (code !== 0) {
    console.error(`⚠️  Prisma generate exited with code ${code}`);
    process.exit(code);
  } else {
    console.log('✅ Prisma client generated successfully');
  }
});

prismaGenerate.on('error', (error) => {
  console.error('❌ Failed to run prisma generate:', error);
  process.exit(1);
});

