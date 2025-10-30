/**
 * @file sprites.test.js
 * @description Test suite for the sprite caching system
 * @author GUHD EATS Development Team
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getSpriteCache, initializeSpriteCache, getSprite, getCacheStats, clearCache, clearVolatile } from '../src/roulette/sprites.js';

describe('Sprite Caching System', () => {
  let cache;

  beforeAll(async () => {
    cache = getSpriteCache();
    await initializeSpriteCache();
  });

  afterAll(() => {
    cache.shutdown();
  });

  describe('Sprite Generation', () => {
    it('should generate wheelBase sprite', async () => {
      const wheelBase = await getSprite('wheelBase');
      expect(wheelBase).toBeDefined();
      expect(wheelBase.width).toBe(600);
      expect(wheelBase.height).toBe(600);
    });

    it('should generate numbers overlay', async () => {
      const numbersOverlay = await getSprite('numbersOverlay');
      expect(numbersOverlay).toBeDefined();
      expect(numbersOverlay.width).toBe(600);
      expect(numbersOverlay.height).toBe(600);
    });

    it('should generate pocket mask', async () => {
      const pocketMask = await getSprite('pocketMask');
      expect(pocketMask).toBeDefined();
      expect(pocketMask.width).toBe(600);
      expect(pocketMask.height).toBe(600);
    });

    it('should generate ball sprite', async () => {
      const ball = await getSprite('ball');
      expect(ball).toBeDefined();
      expect(ball.width).toBe(40);
      expect(ball.height).toBe(40);
    });

    it('should generate pocket colors', async () => {
      const pocketColors = await getSprite('pocketColors');
      expect(pocketColors).toBeDefined();
      expect(pocketColors.width).toBe(600);
      expect(pocketColors.height).toBe(600);
    });
  });

  describe('Cache Functionality', () => {
    it('should cache sprites and return cached versions', async () => {
      // First request should generate and cache
      const ball1 = await getSprite('ball');
      
      // Second request should return cached version
      const ball2 = await getSprite('ball');
      
      // Should be the same object reference
      expect(ball1).toBe(ball2);
    });

    it('should track cache statistics', async () => {
      const stats = getCacheStats();
      expect(stats).toBeDefined();
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.totalRequests).toBeGreaterThan(0);
      expect(typeof stats.hitRate).toBe('string');
    });

    it('should clear cache correctly', async () => {
      await getSprite('wheelBase');
      const beforeClear = cache.getCachedKeys().length;
      
      clearCache();
      
      const afterClear = cache.getCachedKeys().length;
      expect(afterClear).toBe(0);
      expect(beforeClear).toBeGreaterThan(0);
    });

    it('should clear volatile sprites', async () => {
      // Ball sprite is marked as volatile
      await getSprite('ball');
      const ballCached = cache.hasSprite('ball');
      
      clearVolatile();
      
      expect(ballCached).toBe(true);
      expect(cache.hasSprite('ball')).toBe(false);
    });
  });

  describe('Memory Management', () => {
    it('should track memory usage', async () => {
      await getSprite('wheelBase');
      
      const memory = cache.getMemoryUsage();
      expect(memory).toBeDefined();
      expect(memory.spriteCount).toBeGreaterThan(0);
      expect(memory.totalSizeBytes).toBeGreaterThan(0);
      expect(memory.totalSizeMB).toBeDefined();
    });

    it('should validate cache integrity', async () => {
      const validation = cache.validateCache();
      expect(validation).toBeDefined();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toBeInstanceOf(Array);
      expect(validation.warnings).toBeInstanceOf(Array);
    });
  });

  describe('Health Monitoring', () => {
    it('should provide health status', async () => {
      const health = cache.getHealthStatus();
      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
      expect(health.issues).toBeInstanceOf(Array);
      expect(health.stats).toBeDefined();
      expect(health.memory).toBeDefined();
    });

    it('should export monitoring data', async () => {
      const monitoring = cache.exportMonitoringData();
      expect(monitoring).toBeDefined();
      expect(monitoring.timestamp).toBeDefined();
      expect(monitoring.stats).toBeDefined();
      expect(monitoring.memory).toBeDefined();
      expect(monitoring.health).toBeDefined();
      expect(monitoring.validation).toBeDefined();
    });
  });

  describe('Pocket Layout', () => {
    it('should generate correct number of pockets (European roulette)', () => {
      const pockets = cache._getPocketLayout();
      expect(pockets.length).toBe(37); // 0-36
    });

    it('should assign correct colors to pockets', () => {
      const pockets = cache._getPocketLayout();
      
      // Check zero pocket
      const zeroPocket = pockets.find(p => p.number === '0');
      expect(zeroPocket.color).toBe('green');
      
      // Check red pockets
      const redPockets = ['1', '3', '5', '7', '9', '12', '14', '16', '18', '19', '21', '23', '25', '27', '30', '32', '34', '36'];
      redPockets.forEach(num => {
        const pocket = pockets.find(p => p.number === num);
        expect(pocket.color).toBe('red');
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unknown sprite key', async () => {
      await expect(getSprite('unknownSprite')).rejects.toThrow('Unknown sprite key');
    });

    it('should throw error for sprite generation failure', async () => {
      // Try to access a non-existent sprite
      await expect(getSprite('invalidKey')).rejects.toThrow();
    });
  });
});
