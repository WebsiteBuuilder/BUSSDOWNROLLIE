/**
 * @file physics.test.js
 * @description Comprehensive test suite for roulette physics engine
 * Tests: pocket order integrity, angle↔pocket mapping accuracy, ball landing precision
 * @author Roulette Testing Team
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  computeSpinPlan,
  getPocketFromAngle,
  getPocketAngle,
  angularDifference,
  verifySpinPlan,
  WHEEL_CONFIGURATIONS
} from '../../src/roulette/physics.js';

describe('🎲 Roulette Physics Engine', () => {
  describe('📐 Angle to Pocket Mapping', () => {
    describe('European Wheel (37 pockets)', () => {
      const config = WHEEL_CONFIGURATIONS.european;
      
      it('should map angle 0 to correct pocket', () => {
        const angle = 0;
        const pocket = getPocketFromAngle(angle, 'european');
        expect(pocket).toBe(config.pocketsList[0]);
      });

      it('should map angle π to correct pocket', () => {
        const angle = Math.PI;
        const pocket = getPocketFromAngle(angle, 'european');
        const expectedIndex = Math.floor(18.5); // Middle of the wheel
        expect(pocket).toBe(config.pocketsList[expectedIndex]);
      });

      it('should map angle 2π to correct pocket (wrapping)', () => {
        const angle = 2 * Math.PI;
        const pocket = getPocketFromAngle(angle, 'european');
        expect(pocket).toBe(config.pocketsList[0]);
      });

      it('should handle negative angles correctly', () => {
        const negativeAngle = -Math.PI / 2;
        const positiveAngle = 3 * Math.PI / 2;
        const pocket1 = getPocketFromAngle(negativeAngle, 'european');
        const pocket2 = getPocketFromAngle(positiveAngle, 'european');
        expect(pocket1).toBe(pocket2);
      });

      it('should handle angles > 2π correctly', () => {
        const angle1 = 2 * Math.PI + Math.PI / 4;
        const angle2 = Math.PI / 4;
        const pocket1 = getPocketFromAngle(angle1, 'european');
        const pocket2 = getPocketFromAngle(angle2, 'european');
        expect(pocket1).toBe(pocket2);
      });

      it('should map all angles to valid pockets', () => {
        for (let i = 0; i < 1000; i++) {
          const angle = (i / 1000) * 2 * Math.PI;
          const pocket = getPocketFromAngle(angle, 'european');
          expect(pocket).toBeGreaterThanOrEqual(0);
          expect(pocket).toBeLessThanOrEqual(36);
        }
      });
    });

    describe('American Wheel (38 pockets)', () => {
      const config = WHEEL_CONFIGURATIONS.american;
      
      it('should map angle 0 to correct pocket', () => {
        const angle = 0;
        const pocket = getPocketFromAngle(angle, 'american');
        expect(pocket).toBe(config.pocketsList[0]);
      });

      it('should map angle π to correct pocket', () => {
        const angle = Math.PI;
        const pocket = getPocketFromAngle(angle, 'american');
        const expectedIndex = Math.floor(19);
        expect(pocket).toBe(config.pocketsList[expectedIndex]);
      });

      it('should map all angles to valid pockets', () => {
        for (let i = 0; i < 1000; i++) {
          const angle = (i / 1000) * 2 * Math.PI;
          const pocket = getPocketFromAngle(angle, 'american');
          expect(pocket).toBeGreaterThanOrEqual(0);
          expect(pocket).toBeLessThanOrEqual(36);
        }
      });
    });
  });

  describe('🔢 Pocket to Angle Mapping', () => {
    describe('European Wheel', () => {
      it('should return correct angle for pocket 0', () => {
        const angle = getPocketAngle(0, 'european');
        expect(angle).toBeGreaterThanOrEqual(0);
        expect(angle).toBeLessThan(2 * Math.PI);
      });

      it('should return correct angle for pocket 36', () => {
        const angle = getPocketAngle(36, 'european');
        const expectedAngle = 13 * (2 * Math.PI / 37);
        expect(angle).toBeCloseTo(expectedAngle, 6);
      });

      it('should return angles in increasing order', () => {
        const angles = [];
        for (let i = 0; i < 37; i++) {
          const pocket = WHEEL_CONFIGURATIONS.european.pocketsList[i];
          angles.push(getPocketAngle(pocket, 'european'));
        }
        
        for (let i = 1; i < angles.length; i++) {
          expect(angles[i]).toBeGreaterThan(angles[i - 1]);
        }
      });

      it('should throw error for invalid pocket number', () => {
        expect(() => getPocketAngle(99, 'european')).toThrow('Pocket number 99 not found');
      });
    });

    describe('American Wheel', () => {
      it('should return correct angle for pocket 0', () => {
        const angle = getPocketAngle(0, 'american');
        expect(angle).toBeGreaterThanOrEqual(0);
        expect(angle).toBeLessThan(2 * Math.PI);
      });

      it('should return correct angle for pocket 36', () => {
        const angle = getPocketAngle(36, 'american');
        const expectedAngle = 16 * (2 * Math.PI / 38);
        expect(angle).toBeCloseTo(expectedAngle, 6);
      });

      it('should throw error for invalid pocket number', () => {
        expect(() => getPocketAngle(99, 'american')).toThrow('Pocket number 99 not found');
      });
    });
  });

  describe('🎯 Pocket Order Integrity', () => {
    describe('European Wheel', () => {
      it('should have exactly 37 pockets', () => {
        expect(WHEEL_CONFIGURATIONS.european.pockets).toBe(37);
        expect(WHEEL_CONFIGURATIONS.european.pocketsList).toHaveLength(37);
      });

      it('should contain all numbers 0-36 exactly once', () => {
        const expectedNumbers = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
        expect(WHEEL_CONFIGURATIONS.european.pocketsList).toEqual(expectedNumbers);
      });

      it('should have no duplicate numbers', () => {
        const uniqueCount = new Set(WHEEL_CONFIGURATIONS.european.pocketsList).size;
        expect(uniqueCount).toBe(37);
      });

      it('should start with 0 at index 0', () => {
        expect(WHEEL_CONFIGURATIONS.european.pocketsList[0]).toBe(0);
      });
    });

    describe('American Wheel', () => {
      it('should have exactly 38 pockets', () => {
        expect(WHEEL_CONFIGURATIONS.american.pockets).toBe(38);
        expect(WHEEL_CONFIGURATIONS.american.pocketsList).toHaveLength(38);
      });

      it('should contain all numbers 0-36 exactly once', () => {
        const numbers = WHEEL_CONFIGURATIONS.american.pocketsList;
        const redNumbers = numbers.filter(n => n !== 0);
        const uniqueRedCount = new Set(redNumbers).size;
        expect(uniqueRedCount).toBe(36);
      });

      it('should start with 0 at index 0', () => {
        expect(WHEEL_CONFIGURATIONS.american.pocketsList[0]).toBe(0);
      });
    });
  });

  describe('⚡ Angular Calculations', () => {
    describe('Angular Difference', () => {
      it('should calculate difference between same angle as 0', () => {
        const diff = angularDifference(Math.PI, Math.PI);
        expect(diff).toBe(0);
      });

      it('should calculate correct difference for opposite angles', () => {
        const diff = angularDifference(0, Math.PI);
        expect(diff).toBeCloseTo(Math.PI, 6);
      });

      it('should return smallest angular difference', () => {
        const diff1 = angularDifference(0, Math.PI / 2);
        const diff2 = angularDifference(Math.PI / 2, 0);
        expect(diff1).toBe(diff2);
        expect(diff1).toBeCloseTo(Math.PI / 2, 6);
      });

      it('should handle wrapping correctly', () => {
        const diff = angularDifference(0, 2 * Math.PI - 0.1);
        expect(diff).toBeCloseTo(0.1, 6);
      });
    });
  });

  describe('🔄 Spin Plan Generation', () => {
    describe('European Wheel', () => {
      it('should generate valid spin plan for pocket 0', () => {
        const plan = computeSpinPlan(0, 'european', 30, 5, 10, 40, 0.1, 0.2, 3);
        
        expect(plan).toHaveProperty('wheelAngles');
        expect(plan).toHaveProperty('ballAngles');
        expect(plan).toHaveProperty('dropFrame');
        expect(plan).toHaveProperty('totalFrames');
        expect(plan).toHaveProperty('winningPocketIndex');
        expect(plan).toHaveProperty('pocketAngle');
        expect(plan).toHaveProperty('layout');
        
        expect(plan.layout).toBe('european');
        expect(plan.winningPocketIndex).toBe(0);
        expect(plan.wheelAngles).toHaveLength(plan.totalFrames);
        expect(plan.ballAngles).toHaveLength(plan.totalFrames);
      });

      it('should generate valid spin plan for pocket 36', () => {
        const plan = computeSpinPlan(36, 'european', 30, 5, 10, 40, 0.1, 0.2, 3);
        expect(plan.winningPocketIndex).toBe(13);
      });

      it('should validate spin plan accuracy', () => {
        const winningNumber = 17;
        const plan = computeSpinPlan(winningNumber, 'european', 30, 5, 10, 40, 0.1, 0.2, 3);
        expect(verifySpinPlan(plan)).toBe(true);
      });

      it('should throw error for invalid layout', () => {
        expect(() => computeSpinPlan(0, 'invalid', 30, 5, 10, 40, 0.1, 0.2, 3))
          .toThrow('Invalid layout type');
      });

      it('should throw error for invalid winning number', () => {
        expect(() => computeSpinPlan(99, 'european', 30, 5, 10, 40, 0.1, 0.2, 3))
          .toThrow('Invalid winning number');
      });
    });

    describe('American Wheel', () => {
      it('should generate valid spin plan for pocket 0', () => {
        const plan = computeSpinPlan(0, 'american', 30, 5, 10, 40, 0.1, 0.2, 3);
        expect(plan.layout).toBe('american');
        expect(plan.winningPocketIndex).toBe(0);
      });

      it('should validate spin plan accuracy for American wheel', () => {
        const winningNumber = 17;
        const plan = computeSpinPlan(winningNumber, 'american', 30, 5, 10, 40, 0.1, 0.2, 3);
        expect(verifySpinPlan(plan)).toBe(true);
      });
    });

    describe('Performance Benchmarks', () => {
      it('should generate spin plan within 10ms', () => {
        const start = performance.now();
        computeSpinPlan(17, 'european', 30, 5, 10, 40, 0.1, 0.2, 3);
        const end = performance.now();
        expect(end - start).toBeLessThan(10);
      });

      it('should handle 100 consecutive spin plans efficiently', () => {
        const start = performance.now();
        for (let i = 0; i < 100; i++) {
          computeSpinPlan(i % 37, 'european', 30, 5, 10, 40, 0.1, 0.2, 3);
        }
        const end = performance.now();
        expect(end - start).toBeLessThan(100); // 1ms per spin
      });
    });
  });

  describe('🎯 Ball Landing Precision', () => {
    it('should land ball within pocket boundaries', () => {
      for (let pocket = 0; pocket < 37; pocket++) {
        const plan = computeSpinPlan(pocket, 'european', 60, 5, 10, 40, 0.1, 0.2, 3);
        const finalBallAngle = plan.ballAngles[plan.totalFrames - 1];
        const finalWheelAngle = plan.wheelAngles[plan.totalFrames - 1];
        
        // Calculate relative position
        const relativeAngle = ((finalBallAngle - finalWheelAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        
        // Find pocket bounds
        const pocketIndex = Math.floor(relativeAngle / plan.pocketAngle);
        const pocketStartAngle = pocketIndex * plan.pocketAngle;
        const pocketEndAngle = (pocketIndex + 1) * plan.pocketAngle;
        
        // Ball should be within pocket bounds
        expect(relativeAngle).toBeGreaterThanOrEqual(pocketStartAngle);
        expect(relativeAngle).toBeLessThan(pocketEndAngle);
      }
    });

    it('should have ball landing precision within 0.1% of pocket center', () => {
      const tolerance = plan => plan.pocketAngle * 0.001; // 0.1% of pocket angle
      
      for (let i = 0; i < 10; i++) {
        const pocket = Math.floor(Math.random() * 37);
        const plan = computeSpinPlan(pocket, 'european', 60, 5, 10, 40, 0.1, 0.2, 3);
        
        const finalBallAngle = plan.ballAngles[plan.totalFrames - 1];
        const finalWheelAngle = plan.wheelAngles[plan.totalFrames - 1];
        const relativeAngle = ((finalBallAngle - finalWheelAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        
        const pocketCenterAngle = (pocket * plan.pocketAngle) + (plan.pocketAngle / 2);
        const deviation = angularDifference(relativeAngle, pocketCenterAngle);
        
        expect(deviation).toBeLessThan(tolerance(plan));
      }
    });
  });

  describe('🔧 Physics Parameters', () => {
    it('should handle zero friction coefficient', () => {
      const plan = computeSpinPlan(17, 'european', 30, 5, 10, 40, 0, 0, 3);
      expect(plan).toBeDefined();
      expect(plan.wheelAngles.length).toBeGreaterThan(0);
    });

    it('should handle high friction coefficients', () => {
      const plan = computeSpinPlan(17, 'european', 30, 5, 10, 40, 1.0, 2.0, 3);
      expect(plan).toBeDefined();
      expect(plan.wheelAngles.length).toBeGreaterThan(0);
    });

    it('should handle different initial velocities', () => {
      const velocities = [1, 10, 20, 30, 40, 60];
      
      velocities.forEach(velocity => {
        const plan = computeSpinPlan(17, 'european', 30, 5, velocity, velocity * 4, 0.1, 0.2, 3);
        expect(plan).toBeDefined();
        expect(plan.ballAngles.length).toBeGreaterThan(0);
      });
    });

    it('should calculate correct drop frame', () => {
      const plan = computeSpinPlan(17, 'european', 30, 5, 10, 40, 0.1, 0.2, 3);
      
      // Ball should drop at reasonable time
      const expectedDropFrame = Math.ceil(Math.log(40 / 20) / 0.2 * 30);
      expect(plan.dropFrame).toBe(expectedDropFrame);
      expect(plan.dropFrame).toBeGreaterThan(0);
      expect(plan.dropFrame).toBeLessThan(plan.totalFrames);
    });
  });

  describe('📊 Statistical Tests', () => {
    it('should generate uniformly distributed results', () => {
      const results = {};
      const testCount = 370; // 10x the number of pockets
      
      for (let i = 0; i < testCount; i++) {
        const pocket = i % 37;
        const plan = computeSpinPlan(pocket, 'european', 30, 5, 10, 40, 0.1, 0.2, 3);
        const winningPocket = plan.winningPocketIndex;
        results[winningPocket] = (results[winningPocket] || 0) + 1;
      }
      
      // Each pocket should be selected roughly equally
      const expectedCount = testCount / 37;
      const tolerance = expectedCount * 0.5; // 50% tolerance
      
      for (let pocket = 0; pocket < 37; pocket++) {
        const count = results[pocket] || 0;
        expect(Math.abs(count - expectedCount)).toBeLessThan(tolerance);
      }
    });
  });

  describe('🛡️ Edge Cases', () => {
    it('should handle minimum parameters', () => {
      const plan = computeSpinPlan(0, 'european', 10, 1, 1, 10, 0.01, 0.01, 1);
      expect(plan).toBeDefined();
      expect(plan.totalFrames).toBe(10);
    });

    it('should handle maximum parameters', () => {
      const plan = computeSpinPlan(0, 'european', 60, 10, 60, 100, 1.0, 2.0, 10);
      expect(plan).toBeDefined();
      expect(plan.totalFrames).toBe(600);
    });

    it('should handle fractional laps correctly', () => {
      const plan1 = computeSpinPlan(17, 'european', 30, 5, 10, 40, 0.1, 0.2, 3);
      const plan2 = computeSpinPlan(17, 'european', 30, 5, 10, 40, 0.1, 0.2, 3.5);
      
      expect(plan1).toBeDefined();
      expect(plan2).toBeDefined();
    });
  });
});

// Performance benchmarks
describe('⚡ Performance Benchmarks', () => {
  it('physics-engine: should complete 1000 operations in under 100ms', () => {
    const start = performance.now();
    
    for (let i = 0; i < 1000; i++) {
      computeSpinPlan(i % 37, 'european', 30, 5, 10, 40, 0.1, 0.2, 3);
      getPocketFromAngle(Math.random() * 2 * Math.PI, 'european');
      getPocketAngle(i % 37, 'european');
    }
    
    const end = performance.now();
    const duration = end - start;
    
    console.log(`Physics engine operations: ${duration.toFixed(2)}ms for 1000 operations`);
    expect(duration).toBeLessThan(100);
  });
});
