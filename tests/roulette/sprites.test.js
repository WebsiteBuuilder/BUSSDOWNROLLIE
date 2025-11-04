/**
 * @file sprites.test.js
 * @description Comprehensive test suite for sprite caching system
 * Tests: sprite caching, memory management, generation
 * @author Roulette Testing Team
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { getSpriteCache, initializeSpriteCache, getSprite, getCacheStats, clearCache, clearVolatile, preloadEssentialSprites } from '../../src/roulette/sprites.js';

// Mock canvas module
vi.mock('canvas', () => ({
  createCanvas: vi.fn().mockImplementation((width, height) => ({
    width,
    height,
    getContext: vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn()
      }),
      canvas: { width, height }
    })
  }))
}));

// Mock fs module
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined)
}));

describe('🎨 Sprite Cache System', () => {
  let spriteCache;

  beforeEach(() => {
    spriteCache = getSpriteCache();
    clearCache(); // Ensure clean state
  });

  afterEach(() => {
    clearCache();
  });

  describe('🏗️ Initialization', () => {
    it('should initialize sprite cache successfully', async () => {
      await expect(initializeSpriteCache()).resolves.not.toThrow();
      expect(spriteCache.initialized).toBe(true);
    });

    it('should be idempotent for initialization', async () => {
      await initializeSpriteCache();
      await expect(initializeSpriteCache()).resolves.not.toThrow();
      expect(spriteCache.initialized).toBe(true);
    });

    it('should create cache directory on initialization', async () => {
      const { mkdir } = await import('fs/promises');
      await initializeSpriteCache();
      expect(mkdir).toHaveBeenCalledWith('./cache/sprites', { recursive: true });
    });

    it('should handle initialization failures gracefully', async () => {
      const { mkdir } = await import('fs/promises');
      vi.mocked(mkdir).mockRejectedValue(new Error('Permission denied'));

      await expect(initializeSpriteCache()).rejects.toThrow('Permission denied');
    });
  });

  describe('💾 Cache Operations', () => {
    beforeEach(async () => {
      await initializeSpriteCache();
    });

    describe('Get Sprite', () => {
      it('should get cached sprite on subsequent calls', async () => {
        const sprite1 = await getSprite('wheelBase');
        const sprite2 = await getSprite('wheelBase');

        expect(sprite1).toBeDefined();
        expect(sprite2).toBeDefined();
        expect(sprite1).toBe(sprite2); // Same reference
      });

      it('should generate sprite on first access', async () => {
        const sprite = await getSprite('wheelBase');
        expect(sprite).toBeDefined();
        expect(spriteCache.hasSprite('wheelBase')).toBe(true);
      });

      it('should generate all sprite types', async () => {
        const spriteTypes = ['wheelBase', 'numbersOverlay', 'pocketMask', 'ball', 'pocketColors'];

        for (const type of spriteTypes) {
          const sprite = await getSprite(type);
          expect(sprite).toBeDefined();
          expect(spriteCache.hasSprite(type)).toBe(true);
        }
      });

      it('should throw error for unknown sprite types', async () => {
        await expect(getSprite('unknownSprite')).rejects.toThrow('Unknown sprite key');
      });

      it('should update cache statistics on hit', async () => {
        const stats1 = getCacheStats();
        await getSprite('wheelBase');
        const stats2 = getCacheStats();

        expect(stats2.totalRequests).toBe(stats1.totalRequests + 1);
        expect(stats2.hits).toBe(stats1.hits + 1);
        expect(stats2.misses).toBe(stats1.misses);
      });

      it('should update cache statistics on miss', async () => {
        const stats1 = getCacheStats();
        await getSprite('ball');
        const stats2 = getCacheStats();

        expect(stats2.totalRequests).toBe(stats1.totalRequests + 1);
        expect(stats2.misses).toBe(stats1.misses + 1);
        expect(stats2.hits).toBe(stats1.hits);
      });
    });

    describe('Cache Persistence', () => {
      it('should persist sprites in cache', async () => {
        await getSprite('wheelBase');
        
        expect(spriteCache.cache.has('wheelBase')).toBe(true);
        expect(spriteCache.getCachedKeys()).toContain('wheelBase');
      });

      it('should maintain sprite reference identity', async () => {
        const sprite1 = await getSprite('wheelBase');
        const sprite2 = await getSprite('wheelBase');
        
        expect(sprite1).toBe(sprite2);
      });

      it('should track sprite sizes', async () => {
        await getSprite('wheelBase');
        const stats = getCacheStats();
        
        expect(stats.spriteSizes.has('wheelBase')).toBe(true);
        expect(stats.spriteSizes.get('wheelBase')).toBeGreaterThan(0);
      });
    });
  });

  describe('🧠 Memory Management', () => {
    beforeEach(async () => {
      await initializeSpriteCache();
    });

    describe('Cache Size Tracking', () => {
      it('should calculate total cache size correctly', async () => {
        await getSprite('wheelBase');
        await getSprite('numbersOverlay');
        
        const memory = spriteCache.getMemoryUsage();
        expect(memory.totalSizeBytes).toBeGreaterThan(0);
        expect(memory.totalSizeMB).toBeGreaterThan(0);
        expect(memory.spriteCount).toBeGreaterThan(0);
      });

      it('should track individual sprite sizes', async () => {
        const sizes = new Map();
        const spriteTypes = ['wheelBase', 'numbersOverlay', 'pocketMask', 'ball', 'pocketColors'];

        for (const type of spriteTypes) {
          await getSprite(type);
          const stats = getCacheStats();
          sizes.set(type, stats.spriteSizes.get(type));
        }

        sizes.forEach((size, spriteType) => {
          expect(size).toBeGreaterThan(0);
          console.log(`${spriteType}: ${size} bytes`);
        });
      });

      it('should identify biggest sprite', async () => {
        await getSprite('wheelBase');
        await getSprite('ball');
        
        const memory = spriteCache.getMemoryUsage();
        const biggest = memory.biggestSprite;
        
        expect(biggest).toBeDefined();
        expect(biggest.key).toBe('wheelBase'); // Should be the largest
        expect(biggest.size).toBeGreaterThan(0);
      });
    });

    describe('Cache Clearing', () => {
      it('should clear entire cache', async () => {
        await getSprite('wheelBase');
        await getSprite('ball');
        
        expect(spriteCache.cache.size).toBeGreaterThan(0);
        
        clearCache();
        
        expect(spriteCache.cache.size).toBe(0);
        expect(spriteCache.getCachedKeys()).toHaveLength(0);
      });

      it('should reset statistics when cache cleared', async () => {
        await getSprite('wheelBase');
        await getSprite('wheelBase'); // Hit
        await getSprite('ball'); // Miss
        
        clearCache();
        const stats = getCacheStats();
        
        expect(stats.cacheSize).toBe(0);
        expect(stats.spriteSizes.size).toBe(0);
      });

      it('should clear specific sprite from cache', async () => {
        await getSprite('wheelBase');
        await getSprite('ball');
        
        expect(spriteCache.hasSprite('wheelBase')).toBe(true);
        expect(spriteCache.hasSprite('ball')).toBe(true);
        
        const result = spriteCache.clearSprite('wheelBase');
        
        expect(result).toBe(true);
        expect(spriteCache.hasSprite('wheelBase')).toBe(false);
        expect(spriteCache.hasSprite('ball')).toBe(true);
      });

      it('should return false when clearing non-existent sprite', async () => {
        const result = spriteCache.clearSprite('nonExistent');
        expect(result).toBe(false);
      });
    });

    describe('Volatile Sprite Management', () => {
      it('should identify volatile sprites correctly', async () => {
        await getSprite('ball'); // Volatile
        await getSprite('wheelBase'); // Non-volatile
        
        const ballConfig = spriteCache.configs.get('ball');
        const wheelConfig = spriteCache.configs.get('wheelBase');
        
        expect(ballConfig.volatile).toBe(true);
        expect(wheelConfig.volatile).toBe(false);
      });

      it('should clear only volatile sprites', async () => {
        await getSprite('ball');
        await getSprite('wheelBase');
        await getSprite('numbersOverlay');
        
        expect(spriteCache.cache.size).toBe(3);
        
        const clearedCount = clearVolatile();
        
        expect(clearedCount).toBe(1); // Only ball
        expect(spriteCache.cache.size).toBe(2); // wheelBase and numbersOverlay remain
        expect(spriteCache.hasSprite('ball')).toBe(false);
        expect(spriteCache.hasSprite('wheelBase')).toBe(true);
      });

      it('should update cache size when volatile sprites cleared', async () => {
        await getSprite('ball');
        const statsBefore = getCacheStats();
        
        clearVolatile();
        const statsAfter = getCacheStats();
        
        expect(statsAfter.cacheSize).toBeLessThan(statsBefore.cacheSize);
      });
    });
  });

  describe('🎨 Sprite Generation', () => {
    beforeEach(async () => {
      await initializeSpriteCache();
    });

    it('should generate wheel base with correct dimensions', async () => {
      const sprite = await getSprite('wheelBase');
      const config = spriteCache.configs.get('wheelBase');
      
      expect(sprite).toBeDefined();
      expect(sprite.width).toBe(config.width);
      expect(sprite.height).toBe(config.height);
    });

    it('should generate ball sprite with correct dimensions', async () => {
      const sprite = await getSprite('ball');
      const config = spriteCache.configs.get('ball');
      
      expect(sprite).toBeDefined();
      expect(sprite.width).toBe(config.width);
      expect(sprite.height).toBe(config.height);
      expect(sprite.width).toBeLessThan(100); // Ball should be small
    });

    it('should generate numbers overlay', async () => {
      const sprite = await getSprite('numbersOverlay');
      
      expect(sprite).toBeDefined();
      expect(sprite.width).toBe(600);
      expect(sprite.height).toBe(600);
    });

    it('should generate pocket mask', async () => {
      const sprite = await getSprite('pocketMask');
      
      expect(sprite).toBeDefined();
      expect(sprite.width).toBe(600);
      expect(sprite.height).toBe(600);
    });

    it('should generate pocket colors', async () => {
      const sprite = await getSprite('pocketColors');
      
      expect(sprite).toBeDefined();
      expect(sprite.width).toBe(600);
      expect(sprite.height).toBe(600);
    });

    it('should handle generation failures gracefully', async () => {
      // Test with mock canvas failure
      const { createCanvas } = await import('canvas');
      vi.mocked(createCanvas).mockImplementation(() => {
        throw new Error('Canvas generation failed');
      });

      await expect(getSprite('wheelBase')).rejects.toThrow('Canvas generation failed');
    });
  });

  describe('📊 Statistics and Monitoring', () => {
    beforeEach(async () => {
      await initializeSpriteCache();
    });

    describe('Cache Statistics', () => {
      it('should track hit rate correctly', async () => {
        await getSprite('wheelBase'); // Miss
        await getSprite('wheelBase'); // Hit
        await getSprite('numbersOverlay'); // Miss
        await getSprite('numbersOverlay'); // Hit
        
        const stats = getCacheStats();
        
        expect(stats.totalRequests).toBe(4);
        expect(stats.hits).toBe(2);
        expect(stats.misses).toBe(2);
        expect(stats.hitRate).toBe('50.00%');
      });

      it('should calculate hit rate percentage', async () => {
        await getSprite('wheelBase'); // Miss
        await getSprite('wheelBase'); // Hit
        
        const stats = getCacheStats();
        const hitRate = parseFloat(stats.hitRate);
        
        expect(hitRate).toBe(50);
      });

      it('should handle zero requests correctly', () => {
        clearCache();
        const stats = getCacheStats();
        
        expect(stats.hitRate).toBe('0%');
        expect(stats.totalRequests).toBe(0);
      });

      it('should update last accessed timestamp', async () => {
        const stats1 = getCacheStats();
        const lastAccess1 = stats1.lastAccessed;
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 10));
        
        await getSprite('wheelBase');
        const stats2 = getCacheStats();
        
        expect(stats2.lastAccessed).toBeGreaterThan(lastAccess1);
      });
    });

    describe('Memory Usage', () => {
      it('should report memory usage correctly', async () => {
        await getSprite('wheelBase');
        await getSprite('ball');
        
        const memory = spriteCache.getMemoryUsage();
        
        expect(memory.spriteCount).toBe(2);
        expect(memory.totalSizeBytes).toBeGreaterThan(0);
        expect(memory.totalSizeMB).toBeGreaterThan(0);
        expect(memory.avgSpriteSize).toBeGreaterThan(0);
      });

      it('should calculate average sprite size', async () => {
        const sprites = ['wheelBase', 'numbersOverlay', 'pocketMask'];
        for (const sprite of sprites) {
          await getSprite(sprite);
        }
        
        const memory = spriteCache.getMemoryUsage();
        
        expect(memory.avgSpriteSize).toBe(
          memory.totalSizeBytes / memory.spriteCount
        );
      });
    });

    describe('Health Status', () => {
      it('should report healthy status with good metrics', async () => {
        // Populate cache with good hit rate
        for (let i = 0; i < 10; i++) {
          await getSprite('wheelBase');
        }
        
        const health = spriteCache.getHealthStatus();
        
        expect(health.status).toBe('healthy');
        expect(health.issues).toHaveLength(0);
        expect(health.stats).toBeDefined();
        expect(health.memory).toBeDefined();
      });

      it('should report degraded status with low hit rate', async () => {
        // Create cache with low hit rate
        for (let i = 0; i < 20; i++) {
          await getSprite(`sprite${i}`); // Different sprites to cause misses
        }
        
        const health = spriteCache.getHealthStatus();
        
        expect(health.status).toBe('degraded');
        expect(health.issues.length).toBeGreaterThan(0);
      });

      it('should report degraded status with high memory usage', async () => {
        // Mock large sprite sizes
        spriteCache.stats.cacheSize = 100 * 1024 * 1024; // 100MB
        
        const health = spriteCache.getHealthStatus();
        
        expect(health.status).toBe('degraded');
        expect(health.issues).toContain('High memory usage');
      });

      it('should report cache access issues', async () => {
        // Mock old last access
        spriteCache.stats.lastAccessed = Date.now() - 600000; // 10 minutes ago
        
        const health = spriteCache.getHealthStatus();
        
        expect(health.issues).toContain('Cache not accessed recently');
      });
    });
  });

  describe('✅ Validation', () => {
    beforeEach(async () => {
      await initializeSpriteCache();
    });

    it('should validate cache integrity', async () => {
      await getSprite('wheelBase');
      await getSprite('ball');
      
      const validation = spriteCache.validateCache();
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect orphaned sprites', async () => {
      // Manually add sprite without configuration
      spriteCache.cache.set('orphanedSprite', {});
      
      const validation = spriteCache.validateCache();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Sprite 'orphanedSprite' has no configuration");
    });

    it('should detect cache size mismatches', async () => {
      await getSprite('wheelBase');
      
      // Corrupt size tracking
      spriteCache.stats.cacheSize = 999999;
      
      const validation = spriteCache.validateCache();
      
      expect(validation.warnings).toContain('Cache size mismatch detected');
    });
  });

  describe('🔄 Preloading', () => {
    beforeEach(async () => {
      await initializeSpriteCache();
    });

    it('should preload essential sprites', async () => {
      clearCache();
      
      await preloadEssentialSprites();
      
      const essential = ['wheelBase', 'numbersOverlay', 'pocketMask'];
      for (const sprite of essential) {
        expect(spriteCache.hasSprite(sprite)).toBe(true);
      }
    });

    it('should not preload already cached sprites', async () => {
      await getSprite('wheelBase');
      
      const stats1 = getCacheStats();
      await preloadEssentialSprites();
      const stats2 = getCacheStats();
      
      // Should not regenerate wheelBase
      expect(stats2.misses).toBe(stats1.misses);
    });
  });

  describe('📤 Export', () => {
    beforeEach(async () => {
      await initializeSpriteCache();
    });

    it('should export monitoring data', async () => {
      await getSprite('wheelBase');
      await getSprite('ball');
      
      const data = spriteCache.exportMonitoringData();
      
      expect(data).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(data.stats).toBeDefined();
      expect(data.memory).toBeDefined();
      expect(data.health).toBeDefined();
      expect(data.validation).toBeDefined();
    });

    it('should provide snapshot of current state', async () => {
      await getSprite('wheelBase');
      
      const data1 = spriteCache.exportMonitoringData();
      const data2 = spriteCache.exportMonitoringData();
      
      expect(data1.timestamp).toBeLessThanOrEqual(data2.timestamp);
    });
  });

  describe('🔌 Lifecycle', () => {
    beforeEach(async () => {
      await initializeSpriteCache();
      await getSprite('wheelBase');
      await getSprite('ball');
    });

    it('should shutdown cleanly', () => {
      spriteCache.shutdown();
      
      expect(spriteCache.cache.size).toBe(0);
      expect(spriteCache.initialized).toBe(false);
    });

    it('should clear cache on shutdown', () => {
      expect(spriteCache.cache.size).toBeGreaterThan(0);
      
      spriteCache.shutdown();
      
      expect(spriteCache.cache.size).toBe(0);
      expect(spriteCache.stats.cacheSize).toBe(0);
    });
  });

  describe('⚡ Performance', () => {
    beforeEach(async () => {
      await initializeSpriteCache();
    });

    it('should cache sprites efficiently', async () => {
      const start = performance.now();
      
      // First access (generate)
      await getSprite('wheelBase');
      const firstTime = performance.now() - start;
      
      // Second access (cache hit)
      const start2 = performance.now();
      await getSprite('wheelBase');
      const secondTime = performance.now() - start2;
      
      console.log(`First access: ${firstTime.toFixed(2)}ms, Second access: ${secondTime.toFixed(2)}ms`);
      
      // Cache hit should be much faster
      expect(secondTime).toBeLessThan(firstTime * 0.1);
    });

    it('should handle multiple concurrent requests', async () => {
      const promises = Array.from({ length: 10 }, () => getSprite('wheelBase'));
      
      const results = await Promise.all(promises);
      
      results.forEach(sprite => {
        expect(sprite).toBeDefined();
      });
      
      // All should be the same reference
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toBe(results[0]);
      }
    });

    it('should generate multiple sprite types efficiently', async () => {
      const spriteTypes = ['wheelBase', 'numbersOverlay', 'pocketMask', 'ball', 'pocketColors'];
      
      const start = performance.now();
      
      const sprites = await Promise.all(
        spriteTypes.map(type => getSprite(type))
      );
      
      const duration = performance.now() - start;
      
      sprites.forEach(sprite => {
        expect(sprite).toBeDefined();
      });
      
      console.log(`Generated ${spriteTypes.length} sprites in ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('🛡️ Error Handling', () => {
    it('should handle concurrent initialization', async () => {
      const promise1 = initializeSpriteCache();
      const promise2 = initializeSpriteCache();
      
      await Promise.all([promise1, promise2]);
      
      expect(spriteCache.initialized).toBe(true);
    });

    it('should handle cache directory creation failures', async () => {
      const { mkdir } = await import('fs/promises');
      vi.mocked(mkdir).mockRejectedValue(new Error('Access denied'));
      
      await expect(initializeSpriteCache()).rejects.toThrow('Access denied');
    });
  });

  describe('🎯 Integration Tests', () => {
    it('should maintain cache during sprite lifecycle', async () => {
      // Load sprites
      const wheel1 = await getSprite('wheelBase');
      const ball1 = await getSprite('ball');
      
      // Clear volatile
      clearVolatile();
      
      // Wheel should still be there
      const wheel2 = await getSprite('wheelBase');
      expect(wheel1).toBe(wheel2);
      
      // Ball should be regenerated
      const ball2 = await getSprite('ball');
      expect(ball1).not.toBe(ball2);
    });

    it('should handle cache eviction and regeneration', async () => {
      const sprite1 = await getSprite('wheelBase');
      
      clearCache();
      
      const sprite2 = await getSprite('wheelBase');
      expect(sprite1).not.toBe(sprite2); // New instance
    });
  });
});

// Performance benchmark tests
describe('⚡ Performance Benchmarks', () => {
  beforeAll(async () => {
    await initializeSpriteCache();
  });

  afterAll(() => {
    spriteCache?.shutdown();
  });

  it('sprite-cache: should complete 1000 cache operations in under 50ms', async () => {
    const start = performance.now();
    
    for (let i = 0; i < 1000; i++) {
      await getSprite('wheelBase');
    }
    
    const end = performance.now();
    const duration = end - start;
    
    console.log(`Sprite cache operations: ${duration.toFixed(2)}ms for 1000 cache hits`);
    expect(duration).toBeLessThan(50);
  });

  it('sprite-generation: should generate 10 different sprites in under 500ms', async () => {
    clearCache();
    
    const spriteTypes = ['wheelBase', 'numbersOverlay', 'pocketMask', 'ball', 'pocketColors'];
    const iterations = 2; // Generate each twice
    
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      await Promise.all(spriteTypes.map(type => getSprite(type)));
    }
    
    const end = performance.now();
    const duration = end - start;
    
    console.log(`Sprite generation: ${duration.toFixed(2)}ms for ${spriteTypes.length * iterations} sprites`);
    expect(duration).toBeLessThan(500);
  });
});
