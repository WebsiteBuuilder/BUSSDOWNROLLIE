/**
 * Example: How to Use the Render Worker from Main Thread
 * 
 * This example demonstrates how to integrate the render-worker.js
 * into your roulette system for off-thread rendering.
 */

const { Worker } = require('worker_threads');
const path = require('path');

class RenderWorkerManager {
  constructor(workerPath) {
    this.workerPath = workerPath;
    this.worker = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.isReady = false;
    
    // Performance tracking
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };
  }

  /**
   * Initialize the worker
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      this.worker = new Worker(this.workerPath);
      
      // Handle worker messages
      this.worker.on('message', (message) => this.handleMessage(message));
      
      // Handle worker errors
      this.worker.on('error', (error) => {
        console.error('Worker error:', error);
        reject(error);
      });
      
      // Handle worker exit
      this.worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`Worker stopped with exit code ${code}`);
          reject(new Error(`Worker exited with code ${code}`));
        }
      });
      
      // Set up timeout for initialization
      const initTimeout = setTimeout(() => {
        reject(new Error('Worker initialization timeout'));
      }, 10000);
      
      // Mark as ready when 'ready' message received
      this.once('ready').then(() => {
        clearTimeout(initTimeout);
        resolve();
      });
    });
  }

  /**
   * Handle messages from worker
   */
  handleMessage(message) {
    const { type, id } = message;
    
    switch (type) {
      case 'ready':
        console.log(`✅ Worker ready (Thread ID: ${message.threadId})`);
        this.isReady = true;
        this.emit('ready', message);
        break;
        
      case 'progress':
        if (id && this.pendingRequests.has(id)) {
          const request = this.pendingRequests.get(id);
          if (request.onProgress) {
            request.onProgress({
              progress: message.progress,
              message: message.message,
              timestamp: message.timestamp
            });
          }
        }
        break;
        
      case 'render-result':
        this.handleRenderResult(message);
        break;
        
      case 'health-status':
        this.handleHealthStatus(message);
        break;
        
      case 'metrics':
        this.emit('metrics', message.metrics);
        break;
        
      case 'error':
        console.error('Worker error:', message.error);
        if (id && this.pendingRequests.has(id)) {
          this.rejectRequest(id, new Error(message.error));
        }
        this.emit('error', message);
        break;
        
      case 'fatal-error':
        console.error('Fatal worker error:', message.error);
        this.emit('fatal-error', message);
        break;
        
      case 'pong':
        this.emit('pong', message);
        break;
        
      default:
        console.warn(`Unknown message type: ${type}`);
    }
  }

  /**
   * Handle render result
   */
  handleRenderResult(message) {
    const { id, success, processingTime } = message;
    
    if (!this.pendingRequests.has(id)) {
      console.warn(`Received result for unknown request: ${id}`);
      return;
    }
    
    const request = this.pendingRequests.get(id);
    const responseTime = Date.now() - request.startTime;
    
    // Update metrics
    this.metrics.totalRequests++;
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    this.updateAverageResponseTime(responseTime);
    
    if (success) {
      this.resolveRequest(id, message.data);
    } else {
      this.rejectRequest(id, new Error(message.error || 'Render failed'));
    }
  }

  /**
   * Handle health status update
   */
  handleHealthStatus(message) {
    const { health, metrics } = message;
    
    // Log important health changes
    if (health.status === 'degraded') {
      console.warn('⚠️ Worker performance degraded');
    } else if (health.status === 'busy') {
      console.log('⏳ Worker is busy');
    }
    
    this.emit('health-status', { health, metrics });
  }

  /**
   * Submit a render request
   */
  async renderSpin(winningNumber, options = {}) {
    if (!this.isReady) {
      throw new Error('Worker not ready');
    }
    
    const id = `req-${++this.requestId}`;
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      // Store request info
      this.pendingRequests.set(id, {
        id,
        startTime,
        onProgress: options.onProgress || null,
        resolve: (data) => {
          this.pendingRequests.delete(id);
          resolve(data);
        },
        reject: (error) => {
          this.pendingRequests.delete(id);
          reject(error);
        }
      });
      
      // Send render request to worker
      this.worker.postMessage({
        type: 'render',
        id,
        winningNumber,
        options
      });
      
      console.log(`📤 Submitted render request ${id} for number ${winningNumber}`);
    });
  }

  /**
   * Check worker health
   */
  async checkHealth() {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ status: 'timeout' });
      }, 5000);
      
      this.once('health-status').then((data) => {
        clearTimeout(timeout);
        resolve(data.health);
      });
      
      this.worker.postMessage({ type: 'health-check' });
    });
  }

  /**
   * Get performance metrics
   */
  async getMetrics() {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(this.metrics);
      }, 5000);
      
      this.once('metrics').then((data) => {
        clearTimeout(timeout);
        resolve(data);
      });
      
      this.worker.postMessage({ type: 'get-metrics' });
    });
  }

  /**
   * Clear sprite cache
   */
  async clearCache() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Cache clear timeout'));
      }, 10000);
      
      this.worker.once('message', (message) => {
        if (message.type === 'cache-cleared') {
          clearTimeout(timeout);
          if (message.success) {
            resolve();
          } else {
            reject(new Error(message.error));
          }
        }
      });
      
      this.worker.postMessage({ type: 'clear-cache' });
    });
  }

  /**
   * Test worker connection
   */
  async ping() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Ping timeout'));
      }, 5000);
      
      this.once('pong').then((data) => {
        clearTimeout(timeout);
        resolve(data.timestamp);
      });
      
      this.worker.postMessage({ type: 'test' });
    });
  }

  /**
   * Terminate worker
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.isReady = false;
      console.log('Worker terminated');
    }
  }

  /**
   * Update average response time
   */
  updateAverageResponseTime(newTime) {
    const total = this.metrics.totalRequests;
    if (total === 1) {
      this.metrics.averageResponseTime = newTime;
    } else {
      this.metrics.averageResponseTime = 
        ((this.metrics.averageResponseTime * (total - 1)) + newTime) / total;
    }
  }

  /**
   * Resolve request
   */
  resolveRequest(id, data) {
    const request = this.pendingRequests.get(id);
    if (request) {
      request.resolve(data);
      this.pendingRequests.delete(id);
      console.log(`✅ Request ${id} completed`);
    }
  }

  /**
   * Reject request
   */
  rejectRequest(id, error) {
    const request = this.pendingRequests.get(id);
    if (request) {
      request.reject(error);
      this.pendingRequests.delete(id);
      console.error(`❌ Request ${id} failed:`, error.message);
    }
  }

  /**
   * Simple event emitter implementation
   */
  constructor() {
    this.events = {};
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  once(event, callback) {
    const onceWrapper = (data) => {
      callback(data);
      this.off(event, onceWrapper);
    };
    this.on(event, onceWrapper);
  }

  off(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
  }

  emit(event, data) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(data));
    }
  }
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

async function example() {
  const workerManager = new RenderWorkerManager(
    path.join(__dirname, 'render-worker.js')
  );
  
  try {
    // Initialize worker
    console.log('Initializing worker...');
    await workerManager.initialize();
    console.log('Worker initialized successfully');
    
    // Set up event listeners
    workerManager.on('progress', (progress) => {
      process.stdout.write(`\rProgress: ${progress.progress}% - ${progress.message}`);
    });
    
    workerManager.on('health-status', ({ health }) => {
      if (health.status === 'degraded') {
        console.log('\n⚠️ Worker performance degraded');
      }
    });
    
    // Example 1: Basic render request
    console.log('\n--- Example 1: Basic Render ---');
    const result1 = await workerManager.renderSpin(17, {
      layout: 'european',
      fps: 20,
      size: 720
    });
    
    console.log(`\n✅ Render complete!`);
    console.log(`Format: ${result1.format}`);
    console.log(`Size: ${Math.round(result1.size / 1024)}KB`);
    console.log(`Frames: ${result1.metadata.framesRendered}`);
    console.log(`Time: ${result1.metadata.processingTime}ms`);
    
    // Example 2: Render with progress callback
    console.log('\n--- Example 2: Render with Progress ---');
    const result2 = await workerManager.renderSpin(23, {
      layout: 'european',
      fps: 24,
      size: 720,
      onProgress: (progress) => {
        console.log(`\n🔄 ${progress.message} (${progress.progress}%)`);
      }
    });
    
    console.log(`\n✅ Render complete!`);
    console.log(`Processing time: ${result2.metadata.processingTime}ms`);
    
    // Example 3: Check worker health
    console.log('\n--- Example 3: Health Check ---');
    const health = await workerManager.checkHealth();
    console.log('Worker Health:', health);
    
    // Example 4: Get metrics
    console.log('\n--- Example 4: Performance Metrics ---');
    const metrics = await workerManager.getMetrics();
    console.log('Metrics:', metrics);
    
    // Example 5: Multiple concurrent requests
    console.log('\n--- Example 5: Concurrent Requests ---');
    const requests = [
      workerManager.renderSpin(5, { fps: 20 }),
      workerManager.renderSpin(12, { fps: 20 }),
      workerManager.renderSpin(18, { fps: 20 }),
      workerManager.renderSpin(25, { fps: 20 })
    ];
    
    const results = await Promise.all(requests);
    console.log(`✅ Completed ${results.length} concurrent renders`);
    
    // Example 6: Error handling
    console.log('\n--- Example 6: Error Handling ---');
    try {
      await workerManager.renderSpin(999); // Invalid number
    } catch (error) {
      console.log(`✅ Caught expected error: ${error.message}`);
    }
    
    console.log('\n--- All Examples Complete ---');
    
  } catch (error) {
    console.error('Example failed:', error);
  } finally {
    // Clean up
    workerManager.terminate();
  }
}

// ============================================================================
// RUN EXAMPLE IF CALLED DIRECTLY
// ============================================================================

if (require.main === module) {
  example().catch(console.error);
}

module.exports = RenderWorkerManager;
