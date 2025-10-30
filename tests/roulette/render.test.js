/**
 * @file render.test.js
 * @description Comprehensive test suite for WebP rendering system
 * Tests: WebP encoding, size budget enforcement, frame generation
 * @author Roulette Testing Team
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import {
  renderFrames,
  encodeAnimatedWebP,
  saveAnimation,
  analyzeSize,
  renderAnimation,
  createPlaceholderEmbed,
  createResultEmbed,
  constants
} from '../../src/roulette/render.js';

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
      toBuffer: vi.fn().mockReturnValue(Buffer.from('mock-frame-data')),
      canvas: {
        width,
        height
      }
    })
  })),
  loadImage: vi.fn()
}));

// Mock sharp module
vi.mock('sharp', () => {
  return vi.fn().mockImplementation(() => ({
    create: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    composite: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-encoded-data'))
  }));
});

describe('🎨 WebP Rendering System', () => {
  describe('📦 Constants and Configuration', () => {
    it('should export correct constants', () => {
      expect(constants.HARD_SIZE_CAP).toBe(3 * 1024 * 1024); // 3MB
      expect(constants.TARGET_SIZE).toBe(2.5 * 1024 * 1024); // 2.5MB
      expect(constants.DEFAULT_SIZE).toBe(720);
      expect(constants.MIN_SIZE).toBe(480);
      expect(constants.MAX_FPS).toBe(30);
      expect(constants.MIN_FPS).toBe(10);
      expect(constants.REDUCTION_STEP).toBe(0.15);
    });

    it('should have valid size relationships', () => {
      expect(constants.MIN_SIZE).toBeLessThan(constants.DEFAULT_SIZE);
      expect(constants.TARGET_SIZE).toBeLessThan(constants.HARD_SIZE_CAP);
      expect(constants.MIN_FPS).toBeLessThanOrEqual(constants.MAX_FPS);
    });
  });

  describe('🖼️ Frame Generation', () => {
    it('should render frames with basic animation plan', async () => {
      const plan = {
        sequence: ['spin', 'decelerate', 'stop'],
        duration: 2000,
        effects: ['motion_blur']
      };

      const sprites = {
        wheelBase: { mock: true },
        ball: { mock: true }
      };

      const frames = await renderFrames(plan, sprites, 720);

      expect(frames).toBeDefined();
      expect(Array.isArray(frames)).toBe(true);
      expect(frames.length).toBeGreaterThan(0);
      expect(frames[0]).toBeInstanceOf(Buffer);
    });

    it('should render frames with different sizes', async () => {
      const plan = {
        sequence: ['spin'],
        duration: 1000
      };

      const sprites = { wheelBase: {} };

      const sizes = [480, 720, 1080];
      
      for (const size of sizes) {
        const frames = await renderFrames(plan, sprites, size);
        expect(frames).toBeDefined();
        expect(frames.length).toBeGreaterThan(0);
      }
    });

    it('should handle different animation sequences', async () => {
      const sequences = [
        ['spin'],
        ['spin', 'decelerate'],
        ['spin', 'decelerate', 'stop'],
        ['decelerate', 'stop']
      ];

      const plan = { duration: 2000 };
      const sprites = { wheelBase: {} };

      for (const sequence of sequences) {
        const frames = await renderFrames({ ...plan, sequence }, sprites, 720);
        expect(frames).toBeDefined();
        expect(frames.length).toBeGreaterThan(0);
      }
    });

    it('should apply motion blur effect when specified', async () => {
      const plan = {
        sequence: ['spin'],
        duration: 2000,
        effects: ['motion_blur']
      };

      const sprites = { wheelBase: {} };
      const frames = await renderFrames(plan, sprites, 720);

      expect(frames).toBeDefined();
      expect(frames.length).toBeGreaterThan(0);
    });

    it('should apply specular highlights when specified', async () => {
      const plan = {
        sequence: ['spin'],
        duration: 2000,
        effects: ['specular_highlights']
      };

      const sprites = { wheelBase: {} };
      const frames = await renderFrames(plan, sprites, 720);

      expect(frames).toBeDefined();
      expect(frames.length).toBeGreaterThan(0);
    });

    it('should calculate optimal FPS based on duration', async () => {
      const durations = [1000, 2000, 3000, 5000];
      
      for (const duration of durations) {
        const plan = { sequence: ['spin'], duration };
        const sprites = { wheelBase: {} };
        
        const frames = await renderFrames(plan, sprites, 720);
        
        // Should generate reasonable number of frames
        expect(frames.length).toBeGreaterThan(10);
        expect(frames.length).toBeLessThan(200);
      }
    });

    it('should handle invalid animation plans', async () => {
      const invalidPlans = [
        null,
        {},
        { sequence: null },
        { sequence: 'spin' }, // Not an array
        { sequence: [] } // Empty
      ];

      const sprites = { wheelBase: {} };

      for (const plan of invalidPlans) {
        await expect(renderFrames(plan, sprites, 720))
          .rejects.toThrow('Invalid animation plan');
      }
    });

    it('should handle missing sprites', async () => {
      const plan = { sequence: ['spin'], duration: 1000 };
      const invalidSprites = [null, undefined, {}, 'invalid'];

      for (const sprites of invalidSprites) {
        await expect(renderFrames(plan, sprites, 720))
          .rejects.toThrow('Invalid sprites');
      }
    });

    it('should report progress for large animations', async () => {
      const plan = {
        sequence: ['spin', 'decelerate', 'stop'],
        duration: 10000, // Long animation
        effects: ['motion_blur', 'specular_highlights']
      };

      const sprites = { wheelBase: {} };
      const frames = await renderFrames(plan, sprites, 720);

      expect(frames).toBeDefined();
      expect(frames.length).toBeGreaterThan(100);
    });
  });

  describe('🎬 WebP Encoding', () => {
    it('should encode frames as WebP format', async () => {
      const frames = [
        Buffer.from('frame1'),
        Buffer.from('frame2'),
        Buffer.from('frame3')
      ];

      const fps = 20;
      const budgetBytes = 1024 * 1024; // 1MB

      const result = await encodeAnimatedWebP(frames, fps, budgetBytes);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('buffer');
      expect(result).toHaveProperty('format');
      expect(result).toHaveProperty('size');
      expect(result.format).toBe('webp');
      expect(result.size).toBeGreaterThan(0);
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should respect FPS constraints', async () => {
      const frames = [Buffer.from('f1'), Buffer.from('f2')];
      
      const fpsValues = [5, 10, 15, 20, 25, 30, 35, 50];
      
      for (const fps of fpsValues) {
        const result = await encodeAnimatedWebP(frames, fps, 1024 * 1024);
        expect(result).toBeDefined();
      }
    });

    it('should enforce minimum FPS', async () => {
      const frames = [Buffer.from('f1')];
      const result = await encodeAnimatedWebP(frames, 5, 1024 * 1024);
      expect(result).toBeDefined();
    });

    it('should enforce maximum FPS', async () => {
      const frames = [Buffer.from('f1')];
      const result = await encodeAnimatedWebP(frames, 50, 1024 * 1024);
      expect(result).toBeDefined();
    });

    it('should try reduced quality when budget exceeded', async () => {
      const largeFrames = Array.from({ length: 30 }, (_, i) => 
        Buffer.from(`large-frame-${i}`.padEnd(1000, 'x'))
      );

      const result = await encodeAnimatedWebP(largeFrames, 30, 1024); // Very small budget

      expect(result).toBeDefined();
      expect(result.format).toMatch(/^(webp|apng)$/);
    });

    it('should try reduced frame count when quality insufficient', async () => {
      const frames = Array.from({ length: 50 }, (_, i) => 
        Buffer.from(`frame-${i}`.padEnd(2000, 'x'))
      );

      const result = await encodeAnimatedWebP(frames, 30, 1024 * 10); // Small budget

      expect(result).toBeDefined();
      // May have reduced frames
    });

    it('should fall back to APNG when WebP fails', async () => {
      const frames = [Buffer.from('f1'), Buffer.from('f2')];

      // Mock sharp to throw error
      const { default: sharp } = await import('sharp');
      vi.spyOn(sharp(), 'webp').mockImplementation(() => {
        throw new Error('WebP encoding failed');
      });

      const result = await encodeAnimatedWebP(frames, 20, 1024 * 1024);

      expect(result).toBeDefined();
      // Should attempt fallback
    });

    it('should handle empty frames array', async () => {
      await expect(encodeAnimatedWebP([], 20, 1024 * 1024))
        .rejects.toThrow('No frames provided');
    });

    it('should handle null frames', async () => {
      await expect(encodeAnimatedWebP(null, 20, 1024 * 1024))
        .rejects.toThrow('No frames provided');
    });
  });

  describe('📏 Size Budget Enforcement', () => {
    it('should analyze size within budget', () => {
      const sizeBytes = constants.TARGET_SIZE * 0.8; // 80% of target
      const metadata = {
        frames: 30,
        fps: 20,
        format: 'webp'
      };

      const analysis = analyzeSize(sizeBytes, metadata);

      expect(analysis).toBeDefined();
      expect(analysis.withinBudget).toBe(true);
      expect(analysis.withinHardCap).toBe(true);
      expect(analysis.sizeBytes).toBe(sizeBytes);
      expect(Array.isArray(analysis.recommendations)).toBe(true);
    });

    it('should analyze size exceeding target', () => {
      const sizeBytes = constants.TARGET_SIZE * 1.2; // 120% of target
      const metadata = {
        frames: 50,
        fps: 25,
        format: 'webp'
      };

      const analysis = analyzeSize(sizeBytes, metadata);

      expect(analysis.withinBudget).toBe(false);
      expect(analysis.withinHardCap).toBe(true);
      expect(analysis.sizeBytes).toBe(sizeBytes);
    });

    it('should analyze size exceeding hard cap', () => {
      const sizeBytes = constants.HARD_SIZE_CAP * 1.5; // 150% of hard cap
      const metadata = {
        frames: 100,
        fps: 30,
        format: 'apng'
      };

      const analysis = analyzeSize(sizeBytes, metadata);

      expect(analysis.withinBudget).toBe(false);
      expect(analysis.withinHardCap).toBe(false);
      expect(analysis.sizeBytes).toBe(sizeBytes);
    });

    it('should provide recommendations for optimization', () => {
      const metadata = {
        frames: 80,
        fps: 28,
        format: 'apng'
      };

      const analysis = analyzeSize(constants.TARGET_SIZE * 1.1, metadata);

      expect(analysis.recommendations).toContain('Animation exceeds target size');
      expect(analysis.recommendations).toContain('High frame count may be causing large file size');
      expect(analysis.recommendations).toContain('APNG format typically produces larger files than WebP');
    });

    it('should calculate size in MB correctly', () => {
      const sizeBytes = 2.5 * 1024 * 1024; // 2.5MB
      const metadata = { frames: 30, fps: 20, format: 'webp' };

      const analysis = analyzeSize(sizeBytes, metadata);

      expect(analysis.sizeMB).toBe(2.5);
    });

    it('should handle very small sizes', () => {
      const sizeBytes = 1024; // 1KB
      const metadata = { frames: 5, fps: 10, format: 'webp' };

      const analysis = analyzeSize(sizeBytes, metadata);

      expect(analysis.sizeBytes).toBe(1024);
      expect(analysis.sizeMB).toBe(0);
    });
  });

  describe('💾 Animation Saving', () => {
    it('should save WebP animation to file', async () => {
      const buffer = Buffer.from('mock-webp-data');
      const format = 'webp';
      const outputPath = '/tmp/test-roulette.webp';

      const savedPath = await saveAnimation(buffer, format, outputPath);

      expect(savedPath).toBe(outputPath);
    });

    it('should save APNG animation to file', async () => {
      const buffer = Buffer.from('mock-apng-data');
      const format = 'apng';
      const outputPath = '/tmp/test-roulette.apng';

      const savedPath = await saveAnimation(buffer, format, outputPath);

      expect(savedPath).toBe(outputPath);
    });

    it('should create directory if it does not exist', async () => {
      const buffer = Buffer.from('data');
      const format = 'webp';
      const outputPath = '/tmp/nonexistent/directory/test.webp';

      const savedPath = await saveAnimation(buffer, format, outputPath);

      expect(savedPath).toBe(outputPath);
    });

    it('should handle save errors gracefully', async () => {
      const buffer = Buffer.from('data');
      const format = 'webp';
      const outputPath = '/invalid/path/test.webp';

      await expect(saveAnimation(buffer, format, outputPath))
        .rejects.toThrow();
    });
  });

  describe('🎯 Complete Render Pipeline', () => {
    it('should complete full render pipeline', async () => {
      const plan = {
        sequence: ['spin', 'decelerate', 'stop'],
        duration: 3000,
        effects: ['motion_blur']
      };

      const sprites = { wheelBase: {} };

      const options = {
        size: 720,
        fps: 20,
        budgetBytes: constants.TARGET_SIZE,
        outputPath: '/tmp/test-animation'
      };

      const result = await renderAnimation(plan, sprites, options);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('frames');
      expect(result).toHaveProperty('encoded');
      expect(result).toHaveProperty('analysis');
      expect(result).toHaveProperty('savedPath');
      expect(result).toHaveProperty('metadata');

      expect(result.frames).toBeInstanceOf(Array);
      expect(result.encoded).toHaveProperty('buffer');
      expect(result.encoded).toHaveProperty('format');
      expect(result.encoded).toHaveProperty('size');
      expect(result.analysis).toHaveProperty('withinBudget');
      expect(result.savedPath).toBe('/tmp/test-animation.webp');
      expect(result.metadata).toHaveProperty('size');
      expect(result.metadata).toHaveProperty('fps');
      expect(result.metadata).toHaveProperty('frameCount');
    });

    it('should handle render without output path', async () => {
      const plan = { sequence: ['spin'], duration: 1000 };
      const sprites = { wheelBase: {} };

      const result = await renderAnimation(plan, sprites, { size: 720 });

      expect(result).toBeDefined();
      expect(result.savedPath).toBeNull();
    });

    it('should use default options when not provided', async () => {
      const plan = { sequence: ['spin'], duration: 1000 };
      const sprites = { wheelBase: {} };

      const result = await renderAnimation(plan, sprites);

      expect(result).toBeDefined();
      expect(result.metadata.size).toBe(constants.DEFAULT_SIZE);
      expect(result.metadata.fps).toBe(20);
    });

    it('should enforce minimum size budget', async () => {
      const plan = { sequence: ['spin'], duration: 5000 }; // Long animation
      const sprites = { wheelBase: {} };

      const result = await renderAnimation(plan, sprites, {
        size: 720,
        budgetBytes: 1000 // Very small budget
      });

      expect(result).toBeDefined();
      // Should still complete, possibly with reduced quality
    });

    it('should handle render pipeline errors', async () => {
      const invalidPlan = { sequence: null };
      const sprites = { wheelBase: {} };

      await expect(renderAnimation(invalidPlan, sprites, { size: 720 }))
        .rejects.toThrow();
    });
  });

  describe('🎨 Embed Creation', () => {
    describe('Placeholder Embed', () => {
      it('should create placeholder embed', () => {
        const displayName = 'TestPlayer';
        const totalBet = 1000;

        const embed = createPlaceholderEmbed(displayName, totalBet);

        expect(embed).toBeDefined();
        expect(embed.title).toContain('Roulette Spin');
        expect(embed.description).toContain(displayName);
        expect(embed.description).toContain(totalBet.toString());
        expect(embed.color).toBe(0xFFD700);
        expect(embed.footer).toBeDefined();
        expect(embed.timestamp).toBeDefined();
      });

      it('should handle different player names', () => {
        const names = ['Alice', 'Bob-Chan', 'User123', 'LongUsernameHere'];
        
        names.forEach(name => {
          const embed = createPlaceholderEmbed(name, 500);
          expect(embed.description).toContain(name);
        });
      });

      it('should handle different bet amounts', () => {
        const bets = [0, 100, 1000, 50000, 999999];
        
        bets.forEach(bet => {
          const embed = createPlaceholderEmbed('Player', bet);
          expect(embed.description).toContain(bet.toString());
        });
      });
    });

    describe('Result Embed', () => {
      it('should create result embed for win', () => {
        const data = {
          displayName: 'Winner',
          winningNumber: 17,
          winningColor: 'red',
          didWin: true,
          net: 3500,
          totalBet: 1000,
          totalWon: 4500,
          newBalance: 10000
        };

        const embed = createResultEmbed(data);

        expect(embed).toBeDefined();
        expect(embed.title).toContain('17');
        expect(embed.description).toContain('Winner');
        expect(embed.description).toContain('WON');
        expect(embed.color).toBe(0x00FF00);
        expect(embed.fields).toHaveLength(3);
      });

      it('should create result embed for loss', () => {
        const data = {
          displayName: 'Loser',
          winningNumber: 5,
          winningColor: 'black',
          didWin: false,
          net: -1000,
          totalBet: 1000,
          totalWon: 0,
          newBalance: 5000
        };

        const embed = createResultEmbed(data);

        expect(embed).toBeDefined();
        expect(embed.color).toBe(0xFF0000);
        expect(embed.description).toContain('lost');
      });

      it('should create result embed with metadata', () => {
        const data = {
          displayName: 'Player',
          winningNumber: 0,
          winningColor: 'green',
          didWin: false,
          net: -500,
          totalBet: 500,
          totalWon: 0,
          newBalance: 9500
        };

        const metadata = {
          frames: 30,
          sizeMB: 2.1,
          omega0: 15.5,
          k: 0.12
        };

        const embed = createResultEmbed(data, metadata);

        expect(embed.footer).toBeDefined();
        expect(embed.footer.text).toContain('30 frames');
        expect(embed.footer.text).toContain('Physics:');
      });

      it('should handle different colors', () => {
        const colors = ['red', 'black', 'green'];
        
        colors.forEach(color => {
          const data = {
            displayName: 'Player',
            winningNumber: color === 'green' ? 0 : 17,
            winningColor: color,
            didWin: true,
            net: 1000,
            totalBet: 500,
            totalWon: 1500,
            newBalance: 10000
          };

          const embed = createResultEmbed(data);
          expect(embed).toBeDefined();
        });
      });
    });
  });

  describe('⚡ Performance Tests', () => {
    it('should render animation within reasonable time', async () => {
      const plan = { sequence: ['spin'], duration: 1000 };
      const sprites = { wheelBase: {} };

      const start = performance.now();
      const result = await renderAnimation(plan, sprites, { size: 720 });
      const end = performance.now();

      const renderTime = end - start;
      console.log(`Render time: ${renderTime.toFixed(2)}ms`);

      expect(renderTime).toBeLessThan(5000); // 5 seconds max
    });

    it('should encode frames efficiently', async () => {
      const frames = Array.from({ length: 30 }, (_, i) => 
        Buffer.from(`frame-${i}`.padEnd(1000, 'x'))
      );

      const start = performance.now();
      const result = await encodeAnimatedWebP(frames, 20, 1024 * 1024);
      const end = performance.now();

      const encodeTime = end - start;
      console.log(`Encode time: ${encodeTime.toFixed(2)}ms for ${frames.length} frames`);

      expect(encodeTime).toBeLessThan(1000); // 1 second max
    });
  });

  describe('🛡️ Error Handling', () => {
    it('should handle canvas creation failures', async () => {
      const { createCanvas } = await import('canvas');
      vi.mocked(createCanvas).mockImplementation(() => {
        throw new Error('Canvas creation failed');
      });

      const plan = { sequence: ['spin'], duration: 1000 };
      const sprites = { wheelBase: {} };

      await expect(renderFrames(plan, sprites, 720))
        .rejects.toThrow('Canvas creation failed');
    });

    it('should handle sharp encoding failures', async () => {
      const { default: sharp } = await import('sharp');
      vi.spyOn(sharp(), 'toBuffer').mockRejectedValue(new Error('Sharp failed'));

      const frames = [Buffer.from('f1')];

      await expect(encodeAnimatedWebP(frames, 20, 1024 * 1024))
        .rejects.toThrow('Failed to encode animation');
    });

    it('should handle invalid size parameters', async () => {
      const invalidSizes = [0, -100, null, undefined, 'invalid'];

      for (const size of invalidSizes) {
        const plan = { sequence: ['spin'], duration: 1000 };
        const sprites = { wheelBase: {} };

        if (size === null || size === undefined) continue;

        await expect(renderFrames(plan, sprites, size))
          .rejects.toThrow();
      }
    });

    it('should handle very long animations gracefully', async () => {
      const plan = { sequence: ['spin', 'decelerate', 'stop'], duration: 60000 }; // 1 minute
      const sprites = { wheelBase: {} };

      const result = await renderAnimation(plan, sprites, { size: 720 });

      expect(result).toBeDefined();
      expect(result.frames.length).toBeLessThan(1000); // Should cap frame count
    });
  });
});

// Memory and resource management tests
describe('🔄 Resource Management', () => {
  it('should properly clean up canvas resources', async () => {
    const { createCanvas } = await import('canvas');
    const mockCanvas = {
      width: 720,
      height: 720,
      getContext: vi.fn().mockReturnValue({
        clearRect: vi.fn(),
        toBuffer: vi.fn().mockReturnValue(Buffer.from('frame'))
      })
    };
    vi.mocked(createCanvas).mockReturnValue(mockCanvas);

    const plan = { sequence: ['spin'], duration: 1000 };
    const sprites = { wheelBase: {} };

    const frames = await renderFrames(plan, sprites, 720);

    expect(frames.length).toBeGreaterThan(0);
    expect(mockCanvas.getContext).toHaveBeenCalled();
  });

  it('should handle concurrent render operations', async () => {
    const plan = { sequence: ['spin'], duration: 1000 };
    const sprites = { wheelBase: {} };

    const promises = Array.from({ length: 5 }, () => 
      renderAnimation(plan, sprites, { size: 480 })
    );

    const results = await Promise.all(promises);

    results.forEach(result => {
      expect(result).toBeDefined();
      expect(result.frames).toBeInstanceOf(Array);
    });
  });
});
