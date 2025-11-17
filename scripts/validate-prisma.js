#!/usr/bin/env node
/**
 * Validate Prisma configuration before deployment
 * Ensures Prisma client is generated correctly for direct SQLite connection
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🔍 Validating Prisma configuration...\n');

// Check 1: DATABASE_URL format
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ DATABASE_URL is not set!');
  process.exit(1);
}

if (dbUrl.startsWith('prisma://')) {
  console.error('❌ ERROR: DATABASE_URL is set to prisma:// (Data Proxy)');
  console.error('   This project uses direct SQLite connection with file:// URLs');
  console.error('   Current DATABASE_URL:', dbUrl);
  console.error('   Please set DATABASE_URL to a file:// URL (e.g., file:/data/guhdeats.db)');
  process.exit(1);
}

if (!dbUrl.startsWith('file:')) {
  console.warn('⚠️  WARNING: DATABASE_URL does not start with file://');
  console.warn('   Expected format: file:/path/to/database.db');
  console.warn('   Current:', dbUrl);
}

console.log('✅ DATABASE_URL format is correct:', dbUrl.startsWith('file:') ? dbUrl : '[REDACTED]');

// Check 2: Prisma schema exists
const schemaPath = join(projectRoot, 'prisma', 'schema.prisma');
if (!existsSync(schemaPath)) {
  console.error('❌ Prisma schema not found at:', schemaPath);
  process.exit(1);
}
console.log('✅ Prisma schema found');

// Check 3: Check for Data Proxy config in schema
import { readFileSync } from 'fs';
const schemaContent = readFileSync(schemaPath, 'utf8');

if (schemaContent.includes('accelerate') || schemaContent.includes('dataProxy')) {
  console.warn('⚠️  WARNING: Schema contains accelerate or dataProxy references');
  console.warn('   This may cause Prisma to generate client for Data Proxy mode');
}

// Check 4: Verify generator config
if (!schemaContent.includes('generator client')) {
  console.error('❌ No generator client block found in schema');
  process.exit(1);
}

console.log('✅ Generator configuration found');

// Check 5: Verify datasource config
if (!schemaContent.includes('datasource db')) {
  console.error('❌ No datasource db block found in schema');
  process.exit(1);
}

if (!schemaContent.includes('provider = "sqlite"')) {
  console.error('❌ Datasource provider is not sqlite');
  process.exit(1);
}

console.log('✅ Datasource configured for SQLite');

// Check 6: Environment variables
const requiredEnvVars = {
  PRISMA_CLIENT_ENGINE_TYPE: 'binary',
  PRISMA_GENERATE_DATAPROXY: 'false',
};

console.log('\n🔍 Checking Prisma environment variables:');
for (const [key, expectedValue] of Object.entries(requiredEnvVars)) {
  const actualValue = process.env[key];
  if (actualValue && actualValue !== expectedValue) {
    console.warn(`⚠️  ${key} is set to "${actualValue}" but should be "${expectedValue}"`);
  } else if (!actualValue) {
    console.log(`ℹ️  ${key} is not set (will use default or be overridden)`);
  } else {
    console.log(`✅ ${key}=${actualValue}`);
  }
}

console.log('\n✅ Prisma configuration validation complete!');
console.log('   The Prisma client should be generated for direct SQLite connection.');

