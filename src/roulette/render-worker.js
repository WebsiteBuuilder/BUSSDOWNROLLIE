/**
 * Enhanced Roulette Render Worker
 * 
 * This worker thread handles computationally intensive rendering operations off the main thread,
 * providing concurrent request handling, performance monitoring, and memory management.
 * 
 * Features:
 * - Concurrent render request queue management
 * - Physics simulation integration (exponential deceleration model)
 * - Number mapping for European/American layouts
 * - WebP animation rendering with quality optimization
 * - Sprite caching and memory management
 * - Progress reporting and timeout handling
 * - Performance monitoring and health checks
 * - Resource cleanup and memory management
 */

const { parentPort, workerData, threadId } = require('worker_threads');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

// ============================================================================
// CONSTANTS AND CONFIGURATION
// ============================================================================

const CONFIG = {
  // Worker settings
  MAX_CONCURRENT_REQUESTS: Math.max(1, Math.min(4, os.cpus().length - 1)),
  REQUEST_TIMEOUT: 30000, // 30 seconds
  HEALTH_CHECK_INTERVAL: 5000, // 5 seconds
  
  // Memory management
  MAX_MEMORY_USAGE: 500 * 1024 * 1024, // 500MB
  CLEANUP_INTERVAL: 10000, // 10 seconds
  GC_THRESHOLD: 100 * 1024 * 1024, // 100MB
  
  // Performance monitoring
  METRICS_RETENTION: 300, // Keep 300 data points
  PROGRESS_UPDATE_INTERVAL: 100, // Update progress every 100ms
  
  // Render settings
  DEFAULT_SIZE: 720,
  MAX_SIZE: 1080,
  MIN_SIZE: 480,
  DEFAULT_FPS: 20,
  MIN_FPS: 10,
  MAX_FPS: 30,
  TARGET_SIZE_BYTES: 2.5 * 1024 * 1024, // 2.5MB
  HARD_SIZE_CAP: 3 * 1024 * 1024 // 3MB
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

class WorkerState {
  constructor() {
    this.initialized = false;
    this.modules = {
      physics: null,
      mapping: null,
      render: null,
      sprites: null
    };
    
    this.requestQueue = [];
    this.activeRequests = new Map();
    this.completedRequests = new Map();
    
    this.metrics = {
      requestsProcessed: 0,
      requestsFailed: 0,
      averageProcessingTime: 0,
      memoryUsage: [],
      cpuUsage: [],
      lastCleanup: Date.now(),
      startTime: Date.now()
    };
    
    this.health = {
      status: 'initializing',
      lastHealthCheck: Date.now(),
      uptime: 0,
      loadAverage: []
    };
    
    this.performanceEmitter = new EventEmitter();
  }

  addRequest(request) {
    this.requestQueue.push(request);
    this._log(`Request queued (ID: ${request.id}), queue length: ${this.requestQueue.length}`);
  }

  processNextRequest() {
    if (this.requestQueue.length === 0) return null;
    
    const request = this.requestQueue.shift();
    this.activeRequests.set(request.id, {
      ...request,
      startTime: Date.now(),
      status: 'processing'
    });
    
    this._log(`Processing request ${request.id}, active: ${this.activeRequests.size}`);
    return request;
  }

  completeRequest(requestId, result) {
    const request = this.activeRequests.get(requestId);
    if (request) {
      const processingTime = Date.now() - request.startTime;
      this.completedRequests.set(requestId, {
        ...request,
        result,
        processingTime,
        status: 'completed'
      });
      
      this.activeRequests.delete(requestId);
      this.metrics.requestsProcessed++;
      this._updateAverageProcessingTime(processingTime);
      
      this._log(`Request ${requestId} completed in ${processingTime}ms`);
    }
  }

  failRequest(requestId, error) {
    const request = this.activeRequests.get(requestId);
    if (request) {
      const processingTime = Date.now() - request.startTime;
      this.completedRequests.set(requestId, {
        ...request,
        error: error.message,
        processingTime,
        status: 'failed'
      });
      
      this.activeRequests.delete(requestId);
      this.metrics.requestsFailed++;
      
      this._log(`Request ${requestId} failed: ${error.message}`, 'error');
    }
  }

  _updateAverageProcessingTime(newTime) {
    const total = this.metrics.requestsProcessed;
    if (total === 1) {
      this.metrics.averageProcessingTime = newTime;
    } else {
      // Running average
      this.metrics.averageProcessingTime = 
        ((this.metrics.averageProcessingTime * (total - 1)) + newTime) / total;
    }
  }

  _log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [Worker:${threadId}] ${message}`;
    
    switch (level) {
      case 'debug':
        if (process.env.DEBUG_WORKER) console.log(logMessage);
        break;
      case 'info':
        console.log(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'error':
        console.error(logMessage);
        break;
    }
  }
}

const state = new WorkerState();

// ============================================================================
// MODULE INITIALIZATION
// ============================================================================

async function initializeModules() {
  try {
    state._log('Initializing worker modules...');
    
    // Dynamic imports for worker compatibility
    const physicsModule = await import(path.join(process.cwd(), 'src/roulette/physics.js'));
    const mappingModule = await import(path.join(process.cwd(), 'src/roulette/mapping.js'));
    const renderModule = await import(path.join(process.cwd(), 'src/roulette/render.js'));
    const spritesModule = await import(path.join(process.cwd(), 'src/roulette/sprites.js'));
    
    state.modules.physics = physicsModule;
    state.modules.mapping = mappingModule;
    state.modules.render = renderModule;
    state.modules.sprites = spritesModule;
    
    state.initialized = true;
    state.health.status = 'ready';
    
    state._log('All modules initialized successfully');
    
    // Preload essential sprites
    try {
      await state.modules.sprites.preloadEssentialSprites();
      state._log('Essential sprites preloaded');
    } catch (error) {
      state._log(`Failed to preload sprites: ${error.message}`, 'warn');
    }
    
    parentPort.postMessage({ 
      type: 'ready',
      threadId,
      config: {
        maxConcurrentRequests: CONFIG.MAX_CONCURRENT_REQUESTS,
        capabilities: ['physics', 'render', 'sprites']
      }
    });
    
  } catch (error) {
    state.health.status = 'error';
    state._log(`Failed to initialize modules: ${error.message}`, 'error');
    
    parentPort.postMessage({
      type: 'error',
      error: error.message,
      stack: error.stack
    });
    
    throw error;
  }
}

// ============================================================================
// REQUEST HANDLERS
// ============================================================================

/**
 * Handle render request with physics computation
 */
async function handleRenderRequest(message) {
  const { id, winningNumber, options = {} } = message;
  
  const startTime = Date.now();
  
  try {
    // Validate inputs
    if (typeof winningNumber !== 'number' || winningNumber < 0 || winningNumber > 36) {
      throw new Error(`Invalid winning number: ${winningNumber}`);
    }
    
    const {
      layout = 'european',
      fps = CONFIG.DEFAULT_FPS,
      duration = 8.5,
      wheelRpm0 = 30,
      ballRpm0 = 180,
      kWheel = 0.8,
      kBall = 0.6,
      laps = 15,
      size = CONFIG.DEFAULT_SIZE,
      budgetBytes = CONFIG.TARGET_SIZE_BYTES
    } = options;
    
    // Clamp values to safe ranges
    const clampedFps = Math.max(CONFIG.MIN_FPS, Math.min(CONFIG.MAX_FPS, fps));
    const clampedSize = Math.max(CONFIG.MIN_SIZE, Math.min(CONFIG.MAX_SIZE, size));
    
    state._log(`Processing render request ${id}: winningNumber=${winningNumber}, layout=${layout}`);
    
    // Step 1: Compute physics
    const physicsResult = await computeSpinPhysics({
      winningNumber,
      layout,
      fps: clampedFps,
      duration,
      wheelRpm0,
      ballRpm0,
      kWheel,
      kBall,
      laps
    });
    
    if (!physicsResult.success) {
      throw new Error(physicsResult.error || 'Physics computation failed');
    }
    
    // Step 2: Get sprites
    await reportProgress(id, 30, 'Loading sprites...');
    
    const sprites = await loadSprites();
    
    // Step 3: Render animation
    await reportProgress(id, 40, 'Rendering frames...');
    
    const renderResult = await renderAnimation(physicsResult.spinPlan, sprites, {
      size: clampedSize,
      fps: clampedFps,
      budgetBytes,
      onProgress: (progress) => {
        const adjustedProgress = 40 + (progress * 0.5); // 40% to 90%
        reportProgress(id, adjustedProgress, `Rendering frames... ${Math.round(progress)}%`);
      }
    });
    
    // Step 4: Finalize
    await reportProgress(id, 95, 'Finalizing...');
    
    const totalTime = Date.now() - startTime;
    
    // Clean up sprites cache if needed
    await manageMemory();
    
    state._log(`Request ${id} completed successfully in ${totalTime}ms`);
    
    // Send success response
    parentPort.postMessage({
      id,
      type: 'render-result',
      success: true,
      data: {
        buffer: renderResult.encoded.buffer,
        format: renderResult.encoded.format,
        size: renderResult.encoded.size,
        metadata: {
          ...renderResult.metadata,
          winningNumber,
          layout,
          processingTime: totalTime,
          framesRendered: renderResult.frames.length,
          quality: clampedFps,
          dimensions: `${clampedSize}x${clampedSize}`
        },
        analysis: renderResult.analysis
      }
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    state._log(`Request ${id} failed after ${totalTime}ms: ${error.message}`, 'error');
    
    parentPort.postMessage({
      id,
      type: 'render-result',
      success: false,
      error: error.message,
      processingTime: totalTime
    });
  }
}

/**
 * Compute spin physics using the physics module
 */
async function computeSpinPhysics(data) {
  try {
    const {
      winningNumber,
      layout,
      fps,
      duration,
      wheelRpm0,
      ballRpm0,
      kWheel,
      kBall,
      laps
    } = data;
    
    const spinPlan = state.modules.physics.computeSpinPlan(
      winningNumber,
      layout,
      fps,
      duration,
      wheelRpm0,
      ballRpm0,
      kWheel,
      kBall,
      laps
    );
    
    // Add debug information
    spinPlan.debug = {
      omega0: ballRpm0 * 2 * Math.PI / 60,
      k: kBall,
      laps,
      targetAngle: winningNumber * (2 * Math.PI / 37),
      dropFrame: spinPlan.dropFrame,
      layout
    };
    
    return {
      success: true,
      spinPlan
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Load and cache sprites
 */
async function loadSprites() {
  try {
    const essential = ['wheelBase', 'numbersOverlay', 'pocketMask', 'ball'];
    const sprites = {};
    
    for (const spriteKey of essential) {
      try {
        sprites[spriteKey] = await state.modules.sprites.getSprite(spriteKey);
      } catch (error) {
        state._log(`Failed to load sprite ${spriteKey}: ${error.message}`, 'warn');
      }
    }
    
    return sprites;
  } catch (error) {
    state._log(`Failed to load sprites: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Render animation using the render module
 */
async function renderAnimation(spinPlan, sprites, options) {
  try {
    const result = await state.modules.render.renderAnimation(spinPlan, sprites, options);
    return result;
  } catch (error) {
    state._log(`Animation rendering failed: ${error.message}`, 'error');
    throw new Error(`Animation rendering failed: ${error.message}`);
  }
}

/**
 * Report progress to main thread
 */
async function reportProgress(requestId, progress, message) {
  try {
    parentPort.postMessage({
      id: requestId,
      type: 'progress',
      progress: Math.round(progress),
      message,
      timestamp: Date.now()
    });
  } catch (error) {
    // Silently ignore progress reporting errors
  }
}

/**
 * Handle health check request
 */
function handleHealthCheck() {
  const now = Date.now();
  
  state.health.uptime = now - state.health.startTime;
  state.health.lastHealthCheck = now;
  state.health.loadAverage = os.loadavg();
  
  // Get memory usage
  const memUsage = process.memoryUsage();
  state.health.memoryUsage = {
    rss: memUsage.rss,
    heapTotal: memUsage.heapTotal,
    heapUsed: memUsage.heapUsed,
    external: memUsage.external
  };
  
  // Determine health status
  const memUsedMB = memUsage.heapUsed / (1024 * 1024);
  const activeRequests = state.activeRequests.size;
  const queueLength = state.requestQueue.length;
  
  if (memUsedMB > 400 || activeRequests > CONFIG.MAX_CONCURRENT_REQUESTS) {
    state.health.status = 'degraded';
  } else if (memUsedMB > 300 || activeRequests >= CONFIG.MAX_CONCURRENT_REQUESTS) {
    state.health.status = 'busy';
  } else {
    state.health.status = 'ready';
  }
  
  parentPort.postMessage({
    type: 'health-status',
    health: state.health,
    metrics: {
      ...state.metrics,
      queueLength,
      activeRequests
    }
  });
}

// ============================================================================
// MEMORY MANAGEMENT
// ============================================================================

async function manageMemory() {
  try {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / (1024 * 1024);
    
    // Clean up completed requests older than 1 minute
    const oneMinuteAgo = Date.now() - 60000;
    let cleaned = 0;
    
    for (const [id, request] of state.completedRequests.entries()) {
      if (request.completedAt && request.completedAt < oneMinuteAgo) {
        state.completedRequests.delete(id);
        cleaned++;
      }
    }
    
    // Clear volatile sprites if memory usage is high
    if (heapUsedMB > 100) {
      try {
        const clearedSprites = state.modules.sprites.clearVolatile();
        if (clearedSprites > 0) {
          state._log(`Cleared ${clearedSprites} volatile sprites to free memory`);
        }
      } catch (error) {
        state._log(`Failed to clear volatile sprites: ${error.message}`, 'warn');
      }
    }
    
    // Force garbage collection if available and memory is very high
    if (heapUsedMB > 200 && global.gc) {
      global.gc();
      state._log('Forced garbage collection');
    }
    
    state.metrics.lastCleanup = Date.now();
    
    if (cleaned > 0) {
      state._log(`Cleaned up ${cleaned} old completed requests`);
    }
    
  } catch (error) {
    state._log(`Memory management failed: ${error.message}`, 'error');
  }
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

parentPort.on('message', async (message) => {
  try {
    switch (message.type) {
      case 'init':
        await initializeModules();
        break;
        
      case 'render':
        if (!state.initialized) {
          throw new Error('Worker not initialized');
        }
        
        // Add to queue and process if capacity available
        state.addRequest(message);
        processNextInQueue();
        break;
        
      case 'health-check':
        handleHealthCheck();
        break;
        
      case 'get-metrics':
        parentPort.postMessage({
          type: 'metrics',
          metrics: state.metrics
        });
        break;
        
      case 'clear-cache':
        try {
          state.modules.sprites.clearCache();
          parentPort.postMessage({
            type: 'cache-cleared',
            success: true
          });
        } catch (error) {
          parentPort.postMessage({
            type: 'cache-cleared',
            success: false,
            error: error.message
          });
        }
        break;
        
      case 'test':
        parentPort.postMessage({ 
          type: 'pong',
          threadId,
          timestamp: Date.now()
        });
        break;
        
      default:
        parentPort.postMessage({
          type: 'error',
          error: `Unknown message type: ${message.type}`
        });
    }
  } catch (error) {
    state._log(`Message handling failed: ${error.message}`, 'error');
    
    if (message.id) {
      state.failRequest(message.id, error);
    }
    
    parentPort.postMessage({
      id: message.id,
      type: 'error',
      error: error.message,
      stack: error.stack
    });
  }
});

// ============================================================================
// QUEUE PROCESSING
// ============================================================================

function processNextInQueue() {
  if (state.activeRequests.size >= CONFIG.MAX_CONCURRENT_REQUESTS) {
    return; // At capacity
  }
  
  const request = state.processNextRequest();
  if (!request) {
    return; // No requests in queue
  }
  
  // Process the request
  handleRenderRequest(request).catch(error => {
    state.failRequest(request.id, error);
  });
}

// ============================================================================
// CLEANUP AND SHUTDOWN
// ============================================================================

function setupCleanup() {
  // Periodic cleanup
  setInterval(async () => {
    try {
      await manageMemory();
    } catch (error) {
      state._log(`Periodic cleanup failed: ${error.message}`, 'error');
    }
  }, CONFIG.CLEANUP_INTERVAL);
  
  // Memory monitoring
  setInterval(async () => {
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / (1024 * 1024);
      
      // Add to metrics
      state.metrics.memoryUsage.push({
        timestamp: Date.now(),
        heapUsedMB,
        rssMB: memUsage.rss / (1024 * 1024)
      });
      
      // Keep only recent data points
      if (state.metrics.memoryUsage.length > CONFIG.METRICS_RETENTION) {
        state.metrics.memoryUsage = state.metrics.memoryUsage.slice(-CONFIG.METRICS_RETENTION);
      }
      
      // Alert if memory usage is too high
      if (heapUsedMB > 400) {
        state._log(`High memory usage detected: ${heapUsedMB.toFixed(2)}MB`, 'warn');
        await manageMemory();
      }
      
    } catch (error) {
      state._log(`Memory monitoring failed: ${error.message}`, 'error');
    }
  }, CONFIG.HEALTH_CHECK_INTERVAL);
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

process.on('uncaughtException', (error) => {
  state._log(`Uncaught exception: ${error.message}`, 'error');
  state._log(error.stack, 'error');
  
  parentPort.postMessage({
    type: 'fatal-error',
    error: error.message,
    stack: error.stack
  });
});

process.on('unhandledRejection', (reason, promise) => {
  state._log(`Unhandled rejection: ${reason}`, 'error');
  
  parentPort.postMessage({
    type: 'fatal-error',
    error: `Unhandled rejection: ${reason}`,
    timestamp: Date.now()
  });
});

// ============================================================================
// WORKER INITIALIZATION
// ============================================================================

async function initializeWorker() {
  try {
    state._log('Starting render worker initialization...');
    
    // Initialize modules
    await initializeModules();
    
    // Setup cleanup processes
    setupCleanup();
    
    // Mark as ready
    state.health.status = 'ready';
    state.initialized = true;
    
    state._log('Render worker fully initialized and ready');
    
  } catch (error) {
    state._log(`Worker initialization failed: ${error.message}`, 'error');
    state.health.status = 'error';
    
    parentPort.postMessage({
      type: 'fatal-error',
      error: error.message,
      stack: error.stack
    });
    
    process.exit(1);
  }
}

// Start the worker
initializeWorker();
