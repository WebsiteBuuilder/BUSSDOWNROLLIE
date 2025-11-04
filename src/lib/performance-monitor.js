/**
 * Performance Monitoring and Logging Enhancements for Railway
 * Provides detailed metrics and logging for deployment monitoring
 */

import { PerformanceObserver, performance } from 'perf_hooks';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { EventEmitter } from 'events';

class RailwayPerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.logDir = options.logDir || '/tmp/logs';
    this.enableFileLogging = options.enableFileLogging !== false;
    this.logLevel = options.logLevel || 'info';
    this.metricsInterval = options.metricsInterval || 30000;
    
    this.metrics = {
      startTime: Date.now(),
      requests: 0,
      errors: 0,
      warnings: 0,
      operations: new Map(),
      memory: new Map(),
      database: new Map()
    };
    
    this.setupLogDirectory();
    this.setupPerformanceObserver();
    this.startMetricsCollection();
    this.setupGracefulShutdown();
  }
  
  setupLogDirectory() {
    if (this.enableFileLogging && !existsSync(this.logDir)) {
      try {
        mkdirSync(this.logDir, { recursive: true });
      } catch (error) {
        console.warn('Could not create log directory:', error.message);
      }
    }
  }
  
  setupPerformanceObserver() {
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric(entry.name, entry.duration, {
              type: entry.entryType,
              detail: entry.detail
            });
          }
        });
        
        obs.observe({ entryTypes: ['measure', 'mark'] });
        console.log('✅ Performance observer initialized');
      } catch (error) {
        console.warn('Could not initialize performance observer:', error.message);
      }
    }
  }
  
  startMetricsCollection() {
    setInterval(() => {
      this.collectSystemMetrics();
    }, this.metricsInterval);
  }
  
  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Memory metrics
    this.metrics.memory.set('rss', memUsage.rss);
    this.metrics.memory.set('heapUsed', memUsage.heapUsed);
    this.metrics.memory.set('heapTotal', memUsage.heapTotal);
    this.metrics.memory.set('external', memUsage.external);
    this.metrics.memory.set('arrayBuffers', memUsage.arrayBuffers);
    
    // CPU metrics
    this.metrics.memory.set('cpuUser', cpuUsage.user);
    this.metrics.memory.set('cpuSystem', cpuUsage.system);
    
    // System metrics
    this.metrics.memory.set('uptime', process.uptime());
    this.metrics.memory.set('loadAverage', process.platform !== 'win32' ? 
      require('os').loadavg() : [0, 0, 0]);
    
    // Emit metrics event for external monitoring
    this.emit('metrics', {
      timestamp: new Date().toISOString(),
      memory: memUsage,
      cpu: cpuUsage,
      uptime: process.uptime(),
      loadAverage: process.platform !== 'win32' ? 
        require('os').loadavg() : [0, 0, 0],
      application: {
        requests: this.metrics.requests,
        errors: this.metrics.errors,
        warnings: this.metrics.warnings,
        operationCount: this.metrics.operations.size
      }
    });
  }
  
  recordMetric(name, duration, metadata = {}) {
    if (!this.metrics.operations.has(name)) {
      this.metrics.operations.set(name, {
        count: 0,
        total: 0,
        min: Infinity,
        max: -Infinity,
        avg: 0
      });
    }
    
    const op = this.metrics.operations.get(name);
    op.count++;
    op.total += duration;
    op.min = Math.min(op.min, duration);
    op.max = Math.max(op.max, duration);
    op.avg = op.total / op.count;
    
    this.log('debug', `Operation: ${name}`, {
      duration: `${duration.toFixed(2)}ms`,
      metadata
    });
  }
  
  incrementRequest() {
    this.metrics.requests++;
  }
  
  incrementError() {
    this.metrics.errors++;
  }
  
  incrementWarning() {
    this.metrics.warnings++;
  }
  
  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      pid: process.pid,
      uptime: Math.round(process.uptime()),
      memory: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
      },
      ...data
    };
    
    const logMessage = this.formatLogMessage(logEntry);
    
    // Console output (always)
    console[level === 'error' ? 'error' : 'log'](logMessage);
    
    // File logging (if enabled)
    if (this.enableFileLogging) {
      this.writeToLogFile(level, logMessage);
    }
    
    // Emit log event for Railway monitoring
    this.emit('log', logEntry);
  }
  
  formatLogMessage(logEntry) {
    const { timestamp, level, message, memory } = logEntry;
    return `[${timestamp}] ${level} [PID:${logEntry.pid}] [Uptime:${logEntry.uptime}s] [Mem:${memory.heapUsed}] ${message}`;
  }
  
  writeToLogFile(level, message) {
    const logFile = join(this.logDir, `${level}.log`);
    const stream = createWriteStream(logFile, { flags: 'a' });
    
    stream.write(message + '\n');
    stream.end();
  }
  
  setupGracefulShutdown() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach(signal => {
      process.on(signal, () => {
        this.log('info', `Received ${signal}, shutting down gracefully`);
        this.emit('shutdown', signal);
        this.generateFinalReport();
      });
    });
  }
  
  generateFinalReport() {
    const uptime = Date.now() - this.metrics.startTime;
    const report = {
      summary: {
        totalUptime: `${Math.round(uptime / 1000)}s`,
        requests: this.metrics.requests,
        errors: this.metrics.errors,
        warnings: this.metrics.warnings,
        errorRate: this.metrics.requests > 0 ? 
          `${((this.metrics.errors / this.metrics.requests) * 100).toFixed(2)}%` : '0%'
      },
      operations: Object.fromEntries(this.metrics.operations),
      memory: Object.fromEntries(this.metrics.memory),
      timestamp: new Date().toISOString()
    };
    
    this.log('info', 'Performance Report', { report });
    
    if (this.enableFileLogging) {
      const reportFile = join(this.logDir, 'final-report.json');
      const fs = require('fs');
      fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    }
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      operations: Object.fromEntries(this.metrics.operations),
      memory: Object.fromEntries(this.metrics.memory)
    };
  }
  
  getHealthStatus() {
    const memoryUsage = process.memoryUsage();
    const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    const errorRate = this.metrics.requests > 0 ? 
      (this.metrics.errors / this.metrics.requests) * 100 : 0;
    
    return {
      status: errorRate > 10 || heapUsedPercent > 90 ? 'degraded' : 'healthy',
      metrics: {
        memory: {
          heapUsed: `${Math.round(heapUsedPercent)}%`,
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
        },
        performance: {
          uptime: Math.round(process.uptime()),
          requests: this.metrics.requests,
          errors: this.metrics.errors,
          errorRate: `${errorRate.toFixed(2)}%`
        }
      },
      timestamp: new Date().toISOString()
    };
  }
}

// Create and export singleton instance
let monitorInstance = null;

export function getPerformanceMonitor(options = {}) {
  if (!monitorInstance) {
    monitorInstance = new RailwayPerformanceMonitor(options);
  }
  return monitorInstance;
}

// Decorators for easy instrumentation
export function instrumentOperation(operationName) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args) {
      const monitor = getPerformanceMonitor();
      const startTime = Date.now();
      
      try {
        monitor.log('debug', `Starting operation: ${operationName}`, { args: args.length });
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;
        
        monitor.recordMetric(operationName, duration, { success: true });
        monitor.log('debug', `Completed operation: ${operationName}`, { duration: `${duration}ms` });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        monitor.recordMetric(operationName, duration, { success: false, error: error.message });
        monitor.incrementError();
        monitor.log('error', `Operation failed: ${operationName}`, { 
          duration: `${duration}ms`,
          error: error.message 
        });
        throw error;
      }
    };
    
    return descriptor;
  };
}

// Enhanced logging functions
export const logger = {
  info: (message, data) => getPerformanceMonitor().log('info', message, data),
  warn: (message, data) => {
    getPerformanceMonitor().incrementWarning();
    getPerformanceMonitor().log('warn', message, data);
  },
  error: (message, data) => {
    getPerformanceMonitor().incrementError();
    getPerformanceMonitor().log('error', message, data);
  },
  debug: (message, data) => getPerformanceMonitor().log('debug', message, data)
};

// Export for use in main application
export default RailwayPerformanceMonitor;