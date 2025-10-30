#!/usr/bin/env node

/**
 * Health Check Script for Railway Deployment
 * Validates system readiness and provides health status
 */

import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const PORT = process.env.PORT || 3000;

let healthStatus = {
  status: 'starting',
  timestamp: new Date().toISOString(),
  checks: {
    database: false,
    prisma: false,
    canvas: false,
    sharp: false,
    discord: false,
    dependencies: false
  }
};

async function validatePrisma() {
  try {
    const schemaPath = join(projectRoot, 'prisma', 'schema.prisma');
    if (!existsSync(schemaPath)) {
      return false;
    }
    
    // Try to import Prisma client
    await import('@prisma/client');
    return true;
  } catch (error) {
    console.error('Prisma validation failed:', error.message);
    return false;
  }
}

async function validateCanvas() {
  try {
    const canvas = await import('canvas');
    return !!canvas.default || !!canvas.createCanvas;
  } catch (error) {
    console.error('Canvas validation failed:', error.message);
    return false;
  }
}

async function validateSharp() {
  try {
    const sharp = await import('sharp');
    return !!sharp.default;
  } catch (error) {
    console.error('Sharp validation failed:', error.message);
    return false;
  }
}

async function validateDependencies() {
  try {
    const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
    const requiredDeps = ['@prisma/client', 'better-sqlite3', 'canvas', 'sharp', 'discord.js'];
    
    return requiredDeps.every(dep => {
      const depName = dep.replace(/^@.*\//, ''); // Handle scoped packages
      return packageJson.dependencies && packageJson.dependencies[dep];
    });
  } catch (error) {
    console.error('Dependencies validation failed:', error.message);
    return false;
  }
}

async function runHealthChecks() {
  console.log('🔍 Running health checks...');
  
  try {
    // Check if dist directory exists
    const distPath = join(projectRoot, 'dist');
    if (!existsSync(distPath)) {
      console.error('❌ Dist directory not found');
      return false;
    }

    healthStatus.checks.dependencies = await validateDependencies();
    console.log(`✅ Dependencies: ${healthStatus.checks.dependencies ? 'OK' : 'FAILED'}`);

    healthStatus.checks.prisma = await validatePrisma();
    console.log(`✅ Prisma: ${healthStatus.checks.prisma ? 'OK' : 'FAILED'}`);

    healthStatus.checks.canvas = await validateCanvas();
    console.log(`✅ Canvas: ${healthStatus.checks.canvas ? 'OK' : 'FAILED'}`);

    healthStatus.checks.sharp = await validateSharp();
    console.log(`✅ Sharp: ${healthStatus.checks.sharp ? 'OK' : 'FAILED'}`);

    healthStatus.checks.discord = !!process.env.DISCORD_BOT_TOKEN;
    console.log(`✅ Discord Token: ${healthStatus.checks.discord ? 'OK' : 'NOT SET'}`);

    // Check database file
    healthStatus.checks.database = existsSync('/data/guhdeats.db') || existsSync('guhdeats.db');
    console.log(`✅ Database: ${healthStatus.checks.database ? 'OK' : 'NOT FOUND'}`);

    const allChecks = Object.values(healthStatus.checks).every(check => check);
    healthStatus.status = allChecks ? 'healthy' : 'degraded';
    healthStatus.timestamp = new Date().toISOString();

    return allChecks;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    healthStatus.status = 'error';
    healthStatus.timestamp = new Date().toISOString();
    healthStatus.error = error.message;
    return false;
  }
}

function createHealthServer() {
  const server = createServer(async (req, res) => {
    // CORS headers for Railway
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.url === '/health' || req.url === '/') {
      const isHealthy = await runHealthChecks();
      
      res.writeHead(isHealthy ? 200 : 503, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      });
      
      res.end(JSON.stringify({
        ...healthStatus,
        service: 'roulette-system',
        version: '1.0.0'
      }, null, 2));
      return;
    }

    if (req.url === '/ready') {
      // Readiness probe - check if app is ready to accept traffic
      const isReady = healthStatus.status === 'healthy';
      res.writeHead(isReady ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ready: isReady, timestamp: new Date().toISOString() }));
      return;
    }

    if (req.url === '/metrics') {
      // Basic metrics for monitoring
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // 404 for other routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', timestamp: new Date().toISOString() }));
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🏥 Health check server running on port ${PORT}`);
    console.log(`📊 Health endpoint: http://localhost:${PORT}/health`);
    console.log(`✅ Ready endpoint: http://localhost:${PORT}/ready`);
    console.log(`📈 Metrics endpoint: http://localhost:${PORT}/metrics`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down health server...');
    server.close(() => {
      console.log('✅ Health server closed');
      process.exit(0);
    });
  });
}

// Start health check server
createHealthServer();