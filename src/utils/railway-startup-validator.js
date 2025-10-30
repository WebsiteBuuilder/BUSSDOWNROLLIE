/**
 * Enhanced Startup Validation for Railway Deployment
 * Integrates with the main application for comprehensive startup checks
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

class RailwayStartupValidator {
  constructor() {
    this.validationResults = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      nodeVersion: process.version,
      platform: process.platform,
      checks: {},
      errors: [],
      warnings: []
    };
  }

  async runAllValidations() {
    console.log('🚀 Starting Railway Startup Validation...\n');
    
    const validations = [
      { name: 'Environment Variables', method: this.validateEnvironmentVariables },
      { name: 'File System', method: this.validateFileSystem },
      { name: 'Dependencies', method: this.validateDependencies },
      { name: 'Database', method: this.validateDatabase },
      { name: 'Canvas Rendering', method: this.validateCanvas },
      { name: 'Sharp Processing', method: this.validateSharp },
      { name: 'Prisma Setup', method: this.validatePrisma },
      { name: 'Discord Configuration', method: this.validateDiscordConfig },
      { name: 'Performance', method: this.validatePerformance },
      { name: 'Security', method: this.validateSecurity }
    ];

    for (const validation of validations) {
      try {
        const result = await validation.method.call(this);
        this.validationResults.checks[validation.name] = result;
        this.logResult(validation.name, result);
      } catch (error) {
        this.validationResults.checks[validation.name] = {
          passed: false,
          error: error.message
        };
        this.logResult(validation.name, { passed: false, error: error.message });
      }
    }

    this.generateSummary();
    return this.validationResults;
  }

  logResult(name, result) {
    const icon = result.passed ? '✅' : '❌';
    const color = result.passed ? '\x1b[32m' : '\x1b[31m';
    
    console.log(`${color}${icon} ${name}: ${result.passed ? 'PASSED' : 'FAILED'}\x1b[0m`);
    
    if (result.details) {
      console.log(`   Details: ${result.details}`);
    }
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
      this.validationResults.errors.push(`${name}: ${result.error}`);
    }
    
    if (result.warning) {
      console.log(`\x1b[33m   Warning: ${result.warning}\x1b[0m`);
      this.validationResults.warnings.push(`${name}: ${result.warning}`);
    }
    
    console.log('');
  }

  async validateEnvironmentVariables() {
    const required = ['DISCORD_BOT_TOKEN'];
    const optional = ['DATABASE_URL', 'NODE_ENV', 'PORT', 'LOG_LEVEL'];
    
    const missingRequired = required.filter(varName => !process.env[varName]);
    
    if (missingRequired.length > 0) {
      return {
        passed: false,
        error: `Missing required variables: ${missingRequired.join(', ')}`
      };
    }

    const presentOptional = optional.filter(varName => process.env[varName]);
    const defaultOptional = optional.filter(varName => !process.env[varName]);

    return {
      passed: true,
      details: `Required: ${required.length}/${required.length}, Optional: ${presentOptional.length}/${optional.length} set`
    };
  }

  async validateFileSystem() {
    const checks = [
      { path: 'dist/src/index.js', description: 'Main application bundle' },
      { path: 'prisma/schema.prisma', description: 'Prisma schema' },
      { path: 'package.json', description: 'Package configuration' }
    ];

    const missingFiles = checks.filter(check => !existsSync(check.path));

    if (missingFiles.length > 0) {
      return {
        passed: false,
        error: `Missing files: ${missingFiles.map(f => f.path).join(', ')}`
      };
    }

    // Check write permissions
    try {
      const testFile = '/tmp/railway-write-test';
      require('fs').writeFileSync(testFile, 'test');
      require('fs').unlinkSync(testFile);
    } catch (error) {
      return {
        passed: false,
        warning: 'Limited write permissions (this may affect some features)'
      };
    }

    return {
      passed: true,
      details: 'All critical files present, write permissions OK'
    };
  }

  async validateDependencies() {
    const criticalDeps = [
      { name: 'canvas', module: 'canvas', description: 'Canvas rendering' },
      { name: 'sharp', module: 'sharp', description: 'Image processing' },
      { name: '@prisma/client', module: '@prisma/client', description: 'Database client' },
      { name: 'better-sqlite3', module: 'better-sqlite3', description: 'SQLite driver' },
      { name: 'discord.js', module: 'discord.js', description: 'Discord API' }
    ];

    const failedDeps = [];

    for (const dep of criticalDeps) {
      try {
        require(dep.module);
      } catch (error) {
        failedDeps.push(`${dep.name}: ${error.message}`);
      }
    }

    if (failedDeps.length > 0) {
      return {
        passed: false,
        error: `Failed dependencies: ${failedDeps.join(', ')}`
      };
    }

    return {
      passed: true,
      details: `All ${criticalDeps.length} critical dependencies loaded successfully`
    };
  }

  async validateDatabase() {
    try {
      // Check if database URL is set
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        return {
          passed: true,
          details: 'Using default SQLite database'
        };
      }

      // Check if database file exists (for SQLite)
      if (dbUrl.startsWith('file:')) {
        const dbPath = dbUrl.replace('file:', '');
        const exists = existsSync(dbPath);
        
        return {
          passed: true,
          details: `Database file ${exists ? 'found' : 'will be created'}: ${dbPath}`
        };
      }

      return {
        passed: true,
        details: 'Using external database'
      };
    } catch (error) {
      return {
        passed: false,
        error: `Database validation failed: ${error.message}`
      };
    }
  }

  async validateCanvas() {
    try {
      const canvas = require('canvas');
      
      // Test canvas creation
      const testCanvas = canvas.createCanvas(100, 100);
      const ctx = testCanvas.getContext('2d');
      
      // Test basic drawing
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 50, 50);
      
      return {
        passed: true,
        details: 'Canvas rendering functional'
      };
    } catch (error) {
      return {
        passed: false,
        error: `Canvas validation failed: ${error.message}`
      };
    }
  }

  async validateSharp() {
    try {
      const sharp = require('sharp');
      
      // Test sharp processing
      const testBuffer = Buffer.from('test');
      await sharp(testBuffer).resize(100, 100).toBuffer();
      
      return {
        passed: true,
        details: 'Sharp image processing functional'
      };
    } catch (error) {
      return {
        passed: false,
        error: `Sharp validation failed: ${error.message}`
      };
    }
  }

  async validatePrisma() {
    try {
      // Check schema file
      const schemaPath = 'prisma/schema.prisma';
      if (!existsSync(schemaPath)) {
        return {
          passed: false,
          error: 'Prisma schema file not found'
        };
      }

      // Test Prisma client import
      const { PrismaClient } = await import('@prisma/client');
      
      return {
        passed: true,
        details: 'Prisma setup validated'
      };
    } catch (error) {
      return {
        passed: false,
        error: `Prisma validation failed: ${error.message}`
      };
    }
  }

  async validateDiscordConfig() {
    const token = process.env.DISCORD_BOT_TOKEN;
    
    if (!token) {
      return {
        passed: false,
        error: 'DISCORD_BOT_TOKEN not set'
      };
    }

    // Basic token format validation
    if (token.length < 50 || token.length > 200) {
      return {
        passed: false,
        error: 'Invalid Discord bot token format'
      };
    }

    return {
      passed: true,
      details: 'Discord configuration appears valid'
    };
  }

  async validatePerformance() {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);

    const warnings = [];
    
    if (heapUsedMB > 512) {
      warnings.push(`High heap usage: ${heapUsedMB}MB`);
    }
    
    if (rssMB > 1024) {
      warnings.push(`High RSS usage: ${rssMB}MB`);
    }

    return {
      passed: warnings.length === 0,
      details: `Memory usage: Heap ${heapUsedMB}MB, RSS ${rssMB}MB`,
      warning: warnings.length > 0 ? warnings.join(', ') : undefined
    };
  }

  async validateSecurity() {
    const checks = [];
    
    // Check if running as non-root (Railway best practice)
    if (process.getuid && process.getuid() === 0) {
      checks.push('Running as root user (security risk)');
    }
    
    // Check environment
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv !== 'production') {
      checks.push(`Not in production mode: ${nodeEnv}`);
    }

    return {
      passed: checks.length === 0,
      details: checks.length === 0 ? 'Security checks passed' : 'Some security concerns',
      warning: checks.length > 0 ? checks.join(', ') : undefined
    };
  }

  generateSummary() {
    const totalChecks = Object.keys(this.validationResults.checks).length;
    const passedChecks = Object.values(this.validationResults.checks)
      .filter(result => result.passed).length;
    const failedChecks = totalChecks - passedChecks;

    console.log('📊 Validation Summary');
    console.log('===================');
    console.log(`Total Checks: ${totalChecks}`);
    console.log(`\x1b[32mPassed: ${passedChecks}\x1b[0m`);
    console.log(`\x1b[31mFailed: ${failedChecks}\x1b[0m`);
    console.log(`\x1b[33mWarnings: ${this.validationResults.warnings.length}\x1b[0m`);

    if (this.validationResults.errors.length > 0) {
      console.log('\n❌ Critical Errors:');
      this.validationResults.errors.forEach(error => {
        console.log(`   • ${error}`);
      });
    }

    if (this.validationResults.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.validationResults.warnings.forEach(warning => {
        console.log(`   • ${warning}`);
      });
    }

    if (failedChecks === 0) {
      console.log('\n🎉 All validation checks passed!');
      console.log('✅ System is ready for Railway deployment');
    } else {
      console.log('\n❌ Some validation checks failed!');
      console.log('🔧 Please fix the issues before deployment');
    }

    console.log('\n' + '='.repeat(50));
  }

  getValidationReport() {
    return this.validationResults;
  }

  shouldProceed() {
    const criticalErrors = this.validationResults.errors.length;
    return criticalErrors === 0;
  }
}

// Export for use in main application
export default RailwayStartupValidator;

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new RailwayStartupValidator();
  validator.runAllValidations().then(results => {
    if (validator.shouldProceed()) {
      console.log('✅ Validation successful - proceeding with startup');
      process.exit(0);
    } else {
      console.log('❌ Validation failed - aborting startup');
      process.exit(1);
    }
  }).catch(error => {
    console.error('💥 Validation crashed:', error);
    process.exit(1);
  });
}