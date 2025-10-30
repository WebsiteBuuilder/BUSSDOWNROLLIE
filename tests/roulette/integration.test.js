/**
 * @file integration.test.js
 * @description End-to-end integration tests for complete roulette spin flow
 * Tests: Complete roulette spin flow from physics to rendering
 * @author Roulette Testing Team
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import {
  computeSpinPlan
} from '../../src/roulette/physics.js';
import {
  angleToPocket,
  pocketToAngle,
  getPocketOrder
} from '../../src/roulette/mapping.js';
import {
  renderFrames,
  renderAnimation,
  encodeAnimatedWebP,
  createPlaceholderEmbed,
  createResultEmbed,
  constants
} from '../../src/roulette/render.js';
import {
  getSpriteCache,
  initializeSpriteCache,
  getSprite,
  clearCache
} from '../../src/roulette/sprites.js';

// Mock all external dependencies for integration tests
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
      toBuffer: vi.fn().mockReturnValue(Buffer.from(`frame-${width}x${height}`)),
      canvas: { width, height }
    })
  })),
  loadImage: vi.fn()
}));

vi.mock('sharp', () => ({
  default: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    composite: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-encoded-animation'))
  }))
}));

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined)
}));

describe('🎰 Roulette System Integration', () => {
  beforeAll(async () => {
    await initializeSpriteCache();
  });

  afterAll(() => {
    clearCache();
  });

  beforeEach(() => {
    clearCache();
  });

  describe('🔄 Complete Spin Flow', () => {
    it('should execute full roulette spin from physics to rendering', async () => {
      // Step 1: Choose winning number and wheel type
      const winningNumber = 17;
      const wheelType = 'european';

      // Step 2: Generate physics plan
      const spinPlan = computeSpinPlan(
        winningNumber,
        wheelType,
        30, // fps
        5,  // duration (seconds)
        10, // wheel RPM
        40, // ball RPM
        0.1, // wheel friction
        0.2, // ball friction
        3    // laps
      );

      expect(spinPlan).toBeDefined();
      expect(spinPlan.layout).toBe(wheelType);
      expect(spinPlan.winningPocketIndex).toBeGreaterThanOrEqual(0);

      // Step 3: Load sprites
      const sprites = {
        wheelBase: await getSprite('wheelBase'),
        ball: await getSprite('ball'),
        numbersOverlay: await getSprite('numbersOverlay')
      };

      expect(sprites.wheelBase).toBeDefined();
      expect(sprites.ball).toBeDefined();
      expect(sprites.numbersOverlay).toBeDefined();

      // Step 4: Render animation frames
      const animationPlan = {
        sequence: ['spin', 'decelerate', 'stop'],
        duration: 5000,
        effects: ['motion_blur', 'specular_highlights']
      };

      const frames = await renderFrames(animationPlan, sprites, 720);

      expect(frames).toBeDefined();
      expect(frames.length).toBeGreaterThan(0);
      expect(frames.length).toBeLessThan(200);

      // Step 5: Encode animation
      const encoded = await encodeAnimatedWebP(frames, 20, constants.TARGET_SIZE);

      expect(encoded).toBeDefined();
      expect(encoded.buffer).toBeInstanceOf(Buffer);
      expect(encoded.size).toBeGreaterThan(0);
      expect(encoded.format).toMatch(/^(webp|apng)$/);

      // Step 6: Create result embed
      const resultData = {
        displayName: 'TestPlayer',
        winningNumber,
        winningColor: 'red', // 17 is red in European roulette
        didWin: true,
        net: 3500,
        totalBet: 1000,
        totalWon: 4500,
        newBalance: 10000
      };

      const resultEmbed = createResultEmbed(resultData, {
        frames: frames.length,
        sizeMB: (encoded.size / (1024 * 1024)).toFixed(2),
        omega0: 40,
        k: 0.2
      });

      expect(resultEmbed).toBeDefined();
      expect(resultEmbed.title).toContain(winningNumber.toString());
      expect(resultEmbed.color).toBe(0x00FF00); // Green for win

      console.log(`✓ Complete spin flow successful:
        - Winning Number: ${winningNumber}
        - Frames Generated: ${frames.length}
        - Animation Size: ${(encoded.size / 1024).toFixed(2)}KB
        - Format: ${encoded.format.toUpperCase()}`);
    });

    it('should handle American roulette wheel integration', async () => {
      const winningNumber = 5;
      const wheelType = 'american';

      const spinPlan = computeSpinPlan(winningNumber, wheelType, 30, 5, 10, 40, 0.1, 0.2, 3);
      const animationPlan = { sequence: ['spin', 'decelerate'], duration: 3000 };
      const sprites = { wheelBase: await getSprite('wheelBase') };

      const frames = await renderFrames(animationPlan, sprites, 720);
      const encoded = await encodeAnimatedWebP(frames, 20, constants.TARGET_SIZE);

      expect(spinPlan.layout).toBe('american');
      expect(frames.length).toBeGreaterThan(0);
      expect(encoded.size).toBeGreaterThan(0);

      // Verify color mapping for American wheel
      const resultData = {
        displayName: 'Player',
        winningNumber,
        winningColor: 'red', // 5 is red in American roulette
        didWin: false,
        net: -500,
        totalBet: 500,
        totalWon: 0,
        newBalance: 9500
      };

      const embed = createResultEmbed(resultData);
      expect(embed.description).toContain('lost');
    });

    it('should handle zero pocket (green) correctly', async () => {
      const winningNumber = 0;
      const wheelType = 'european';

      const spinPlan = computeSpinPlan(winningNumber, wheelType, 30, 5, 10, 40, 0.1, 0.2, 3);
      const animationPlan = { sequence: ['spin'], duration: 4000 };
      const sprites = { wheelBase: await getSprite('wheelBase') };

      const frames = await renderFrames(animationPlan, sprites, 720);
      const encoded = await encodeAnimatedWebP(frames, 20, constants.TARGET_SIZE);

      expect(spinPlan.winningPocketIndex).toBe(0);

      const resultData = {
        displayName: 'ZeroWinner',
        winningNumber,
        winningColor: 'green',
        didWin: true,
        net: 3500,
        totalBet: 1000,
        totalWon: 4500,
        newBalance: 10000
      };

      const embed = createResultEmbed(resultData);
      expect(embed.description).toContain('🟢');
    });

    it('should work with different animation durations and effects', async () => {
      const winningNumber = 13;
      const wheelType = 'european';

      const combinations = [
        { duration: 2000, effects: [] },
        { duration: 3000, effects: ['motion_blur'] },
        { duration: 4000, effects: ['specular_highlights'] },
        { duration: 5000, effects: ['motion_blur', 'specular_highlights'] }
      ];

      for (const config of combinations) {
        const spinPlan = computeSpinPlan(winningNumber, wheelType, 30, 5, 10, 40, 0.1, 0.2, 3);
        const animationPlan = {
          sequence: ['spin', 'decelerate', 'stop'],
          duration: config.duration,
          effects: config.effects
        };
        const sprites = { wheelBase: await getSprite('wheelBase') };

        const frames = await renderFrames(animationPlan, sprites, 720);
        const encoded = await encodeAnimatedWebP(frames, 20, constants.TARGET_SIZE);

        expect(frames.length).toBeGreaterThan(0);
        expect(encoded.size).toBeGreaterThan(0);
      }
    });
  });

  describe('🗺️ Physics to Mapping Integration', () => {
    it('should correctly map physics angles to pocket numbers', async () => {
      const winningNumber = 25;
      const wheelType = 'european';

      const spinPlan = computeSpinPlan(winningNumber, wheelType, 30, 5, 10, 40, 0.1, 0.2, 3);

      // Test final ball position
      const finalBallAngle = spinPlan.ballAngles[spinPlan.totalFrames - 1];
      const finalWheelAngle = spinPlan.wheelAngles[spinPlan.totalFrames - 1];
      
      // Calculate relative angle
      const relativeAngle = ((finalBallAngle - finalWheelAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      
      // Convert to degrees for mapping
      const angleDegrees = (relativeAngle * 180) / Math.PI;
      
      // Should map to correct pocket
      const mappedPocket = angleToPocket(angleDegrees, 'EU');
      const expectedPocket = 25; // from European wheel order
      
      expect(mappedPocket).toBe(expectedPocket);
    });

    it('should maintain consistency between physics and mapping systems', async () => {
      const wheelTypes = ['european', 'american'];
      
      for (const wheelType of wheelTypes) {
        for (let number = 0; number <= 36; number++) {
          const spinPlan = computeSpinPlan(number, wheelType, 30, 5, 10, 40, 0.1, 0.2, 3);
          
          // Get final position
          const finalBallAngle = spinPlan.ballAngles[spinPlan.totalFrames - 1];
          const finalWheelAngle = spinPlan.wheelAngles[spinPlan.totalFrames - 1];
          const relativeAngle = ((finalBallAngle - finalWheelAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
          const angleDegrees = (relativeAngle * 180) / Math.PI;
          
          const mappedPocket = angleToPocket(angleDegrees, wheelType === 'european' ? 'EU' : 'US');
          expect(mappedPocket).toBe(number);
        }
      }
    });

    it('should handle angle conversion accuracy', async () => {
      // Test that pocketToAngle(angleToPocket(angle)) returns angle
      const wheelType = 'european';
      const pocketOrder = getPocketOrder('EU');
      
      for (let i = 0; i < pocketOrder.length; i++) {
        const pocket = pocketOrder[i];
        const angle = pocketToAngle(pocket, 'EU');
        const backToPocket = angleToPocket(angle, 'EU');
        
        expect(backToPocket).toBe(pocket);
      }
    });
  });

  describe('🎨 Rendering Integration', () => {
    it('should render with different sprite configurations', async () => {
      const winningNumber = 7;
      const animationPlan = { sequence: ['spin'], duration: 3000 };

      const spriteConfigs = [
        { wheelBase: true },
        { wheelBase: true, ball: true },
        { wheelBase: true, ball: true, numbersOverlay: true },
        { wheelBase: true, ball: true, numbersOverlay: true, pocketMask: true },
        { wheelBase: true, ball: true, numbersOverlay: true, pocketMask: true, pocketColors: true }
      ];

      for (const config of spriteConfigs) {
        const sprites = {};
        for (const [key, needed] of Object.entries(config)) {
          if (needed) {
            sprites[key] = await getSprite(key);
          }
        }

        const frames = await renderFrames(animationPlan, sprites, 720);
        const encoded = await encodeAnimatedWebP(frames, 20, constants.TARGET_SIZE);

        expect(frames.length).toBeGreaterThan(0);
        expect(encoded.size).toBeGreaterThan(0);
      }
    });

    it('should handle different canvas sizes', async () => {
      const winningNumber = 12;
      const animationPlan = { sequence: ['spin', 'decelerate'], duration: 4000 };
      const sprites = { wheelBase: await getSprite('wheelBase') };

      const sizes = [480, 720, 1080, 1440];

      for (const size of sizes) {
        const frames = await renderFrames(animationPlan, sprites, size);
        const encoded = await encodeAnimatedWebP(frames, 20, constants.TARGET_SIZE);

        expect(frames.length).toBeGreaterThan(0);
        expect(encoded.size).toBeGreaterThan(0);

        // Larger sizes should generally result in larger encodings
        if (size === sizes[0]) {
          // Store baseline
          continue;
        }
      }
    });

    it('should enforce size budget across different configurations', async () => {
      const winningNumber = 18;
      const animationPlan = { sequence: ['spin', 'decelerate', 'stop'], duration: 6000 };
      const sprites = { wheelBase: await getSprite('wheelBase') };

      const budgets = [
        512 * 1024,   // 512KB
        1024 * 1024,  // 1MB
        2 * 1024 * 1024, // 2MB
        3 * 1024 * 1024  // 3MB (hard cap)
      ];

      for (const budget of budgets) {
        const frames = await renderFrames(animationPlan, sprites, 720);
        const encoded = await encodeAnimatedWebP(frames, 20, budget);

        expect(encoded.size).toBeGreaterThan(0);
        expect(encoded.size).toBeLessThanOrEqual(constants.HARD_SIZE_CAP); // Should never exceed hard cap
      }
    });
  });

  describe('📱 Embed Generation Integration', () => {
    it('should create consistent embeds across different scenarios', async () => {
      const scenarios = [
        { winningNumber: 0, color: 'green', won: true, displayName: 'ZeroMaster' },
        { winningNumber: 32, color: 'red', won: true, displayName: 'RedQueen' },
        { winningNumber: 15, color: 'black', won: false, displayName: 'BlackKnight' },
        { winningNumber: 36, color: 'red', won: false, displayName: 'LastNumber' }
      ];

      for (const scenario of scenarios) {
        const spinPlan = computeSpinPlan(scenario.winningNumber, 'european', 30, 5, 10, 40, 0.1, 0.2, 3);
        const animationPlan = { sequence: ['spin'], duration: 3000 };
        const sprites = { wheelBase: await getSprite('wheelBase') };

        const frames = await renderFrames(animationPlan, sprites, 720);
        const encoded = await encodeAnimatedWebP(frames, 20, constants.TARGET_SIZE);

        const resultData = {
          displayName: scenario.displayName,
          winningNumber: scenario.winningNumber,
          winningColor: scenario.color,
          didWin: scenario.won,
          net: scenario.won ? 3500 : -1000,
          totalBet: 1000,
          totalWon: scenario.won ? 4500 : 0,
          newBalance: 9000
        };

        const embed = createResultEmbed(resultData, {
          frames: frames.length,
          sizeMB: (encoded.size / (1024 * 1024)).toFixed(2)
        });

        expect(embed.title).toContain(scenario.winningNumber.toString());
        expect(embed.color).toBe(scenario.won ? 0x00FF00 : 0xFF0000);
      }
    });

    it('should generate placeholder embeds', async () => {
      const placeholder = createPlaceholderEmbed('WaitingPlayer', 2000);

      expect(placeholder.title).toContain('Roulette Spin');
      expect(placeholder.description).toContain('WaitingPlayer');
      expect(placeholder.description).toContain('2000');
      expect(placeholder.color).toBe(0xFFD700);
      expect(placeholder.footer).toBeDefined();
    });
  });

  describe('🔍 System Consistency Checks', () => {
    it('should maintain deterministic behavior', async () => {
      const winningNumber = 22;
      const wheelType = 'european';
      const params = {
        fps: 30,
        duration: 5,
        wheelRpm0: 10,
        ballRpm0: 40,
        kWheel: 0.1,
        kBall: 0.2,
        laps: 3
      };

      // Generate spin plan twice with same parameters
      const plan1 = computeSpinPlan(winningNumber, wheelType, ...Object.values(params));
      const plan2 = computeSpinPlan(winningNumber, wheelType, ...Object.values(params));

      expect(plan1.dropFrame).toBe(plan2.dropFrame);
      expect(plan1.totalFrames).toBe(plan2.totalFrames);
      expect(plan1.winningPocketIndex).toBe(plan2.winningPocketIndex);
      expect(JSON.stringify(plan1.wheelAngles)).toBe(JSON.stringify(plan2.wheelAngles));
      expect(JSON.stringify(plan1.ballAngles)).toBe(JSON.stringify(plan2.ballAngles));
    });

    it('should handle concurrent spin requests', async () => {
      const spinRequests = Array.from({ length: 5 }, (_, i) => ({
        winningNumber: i * 7 % 37,
        wheelType: i % 2 === 0 ? 'european' : 'american'
      }));

      const promises = spinRequests.map(async (request) => {
        const plan = computeSpinPlan(
          request.winningNumber,
          request.wheelType,
          30, 5, 10, 40, 0.1, 0.2, 3
        );
        const animationPlan = { sequence: ['spin'], duration: 2000 };
        const sprites = { wheelBase: await getSprite('wheelBase') };
        const frames = await renderFrames(animationPlan, sprites, 720);
        const encoded = await encodeAnimatedWebP(frames, 20, constants.TARGET_SIZE);

        return { plan, frames: frames.length, size: encoded.size };
      });

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.plan).toBeDefined();
        expect(result.frames).toBeGreaterThan(0);
        expect(result.size).toBeGreaterThan(0);
      });
    });

    it('should maintain cache efficiency across operations', async () => {
      const initialStats = getSpriteCache().getStats();
      
      // Perform various operations
      await getSprite('wheelBase');
      await getSprite('ball');
      await getSprite('wheelBase'); // Cache hit
      await getSprite('numbersOverlay');
      await getSprite('ball'); // Cache hit
      
      const finalStats = getSpriteCache().getStats();
      
      expect(finalStats.totalRequests).toBeGreaterThan(initialStats.totalRequests);
      expect(finalStats.hits).toBeGreaterThanOrEqual(2); // At least 2 cache hits
      expect(finalStats.misses).toBe(3); // 3 misses for new sprites
      expect(finalStats.cacheSize).toBeGreaterThan(initialStats.cacheSize);
    });
  });

  describe('⚡ Performance Integration', () => {
    it('should complete full pipeline within acceptable time', async () => {
      const winningNumber = 14;
      const wheelType = 'european';

      const start = performance.now();

      // Full pipeline
      const plan = computeSpinPlan(winningNumber, wheelType, 30, 5, 10, 40, 0.1, 0.2, 3);
      const sprites = await Promise.all([
        getSprite('wheelBase'),
        getSprite('ball'),
        getSprite('numbersOverlay')
      ]);
      const animationPlan = { sequence: ['spin', 'decelerate'], duration: 3000 };
      const frames = await renderFrames(animationPlan, {
        wheelBase: sprites[0],
        ball: sprites[1],
        numbersOverlay: sprites[2]
      }, 720);
      const encoded = await encodeAnimatedWebP(frames, 20, constants.TARGET_SIZE);

      const end = performance.now();
      const duration = end - start;

      console.log(`Full pipeline duration: ${duration.toFixed(2)}ms`);
      console.log(`Generated ${frames.length} frames, ${encoded.size} bytes`);

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(frames.length).toBeGreaterThan(0);
      expect(encoded.size).toBeGreaterThan(0);
    });

    it('should handle multiple spins efficiently', async () => {
      const start = performance.now();

      const spins = Array.from({ length: 10 }, async (_, i) => {
        const winningNumber = (i * 3) % 37;
        const plan = computeSpinPlan(winningNumber, 'european', 30, 3, 10, 40, 0.1, 0.2, 2);
        const sprites = { wheelBase: await getSprite('wheelBase') };
        const frames = await renderFrames({ sequence: ['spin'], duration: 2000 }, sprites, 720);
        const encoded = await encodeAnimatedWebP(frames, 20, constants.TARGET_SIZE);

        return { number: winningNumber, frames: frames.length, size: encoded.size };
      });

      const results = await Promise.all(spins);
      const end = performance.now();

      console.log(`10 spins completed in ${(end - start).toFixed(2)}ms`);
      console.log(`Average per spin: ${((end - start) / 10).toFixed(2)}ms`);

      expect(results).toHaveLength(10);
      expect(end - start).toBeLessThan(10000); // Should handle 10 spins in under 10 seconds
    });
  });

  describe('🛡️ Error Recovery Integration', () => {
    it('should handle partial system failures gracefully', async () => {
      const winningNumber = 9;

      // Physics should work
      const plan = computeSpinPlan(winningNumber, 'european', 30, 5, 10, 40, 0.1, 0.2, 3);
      expect(plan).toBeDefined();

      // Even if rendering fails for some sprites, should handle gracefully
      try {
        const sprites = {
          wheelBase: await getSprite('wheelBase'),
          ball: await getSprite('ball'),
          invalidSprite: null
        };

        // Should handle gracefully with partial sprites
        const frames = await renderFrames({ sequence: ['spin'], duration: 2000 }, sprites, 720);
        expect(frames).toBeDefined();
      } catch (error) {
        // If it fails, should be specific error about invalid input
        expect(error.message).toMatch(/Invalid sprites|missing/);
      }
    });

    it('should maintain data consistency during failures', async () => {
      const winningNumber = 16;

      // Generate valid plan
      const plan = computeSpinPlan(winningNumber, 'european', 30, 5, 10, 40, 0.1, 0.2, 3);
      
      // Clear cache
      clearCache();

      // Generate another plan - should still be valid
      const plan2 = computeSpinPlan(winningNumber, 'european', 30, 5, 10, 40, 0.1, 0.2, 3);
      
      expect(plan.winningPocketIndex).toBe(plan2.winningPocketIndex);
      expect(plan.layout).toBe(plan2.layout);
    });
  });
});

// End-to-end performance benchmarks
describe('🚀 E2E Performance Benchmarks', () => {
  beforeAll(async () => {
    await initializeSpriteCache();
  });

  afterAll(() => {
    clearCache();
  });

  it('e2e-complete-spin: should complete full spin in under 2 seconds', async () => {
    const winningNumber = Math.floor(Math.random() * 37);
    const start = performance.now();

    // Complete pipeline
    const plan = computeSpinPlan(winningNumber, 'european', 30, 4, 10, 40, 0.1, 0.2, 3);
    const sprites = await getSprite('wheelBase');
    const frames = await renderFrames({ sequence: ['spin', 'decelerate'], duration: 3000 }, { wheelBase: sprites }, 720);
    const encoded = await encodeAnimatedWebP(frames, 20, constants.TARGET_SIZE);

    const end = performance.now();
    const duration = end - start;

    console.log(`E2E spin: ${duration.toFixed(2)}ms for ${frames.length} frames`);
    expect(duration).toBeLessThan(2000);
  });

  it('e2e-batch-spins: should complete 5 spins in under 5 seconds', async () => {
    const start = performance.now();

    const batch = Array.from({ length: 5 }, async (_, i) => {
      const number = (i * 7) % 37;
      const plan = computeSpinPlan(number, i % 2 === 0 ? 'european' : 'american', 30, 3, 10, 40, 0.1, 0.2, 2);
      const sprites = { wheelBase: await getSprite('wheelBase') };
      const frames = await renderFrames({ sequence: ['spin'], duration: 2000 }, sprites, 600);
      return encodeAnimatedWebP(frames, 20, constants.TARGET_SIZE);
    });

    await Promise.all(batch);
    const end = performance.now();

    console.log(`5 E2E spins: ${(end - start).toFixed(2)}ms`);
    expect(end - start).toBeLessThan(5000);
  });
});
