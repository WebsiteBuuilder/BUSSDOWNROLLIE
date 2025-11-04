/**
 * @file mapping.test.js
 * @description Comprehensive test suite for roulette mapping system
 * Tests: European/American sequences, conversion functions, edge cases
 * @author Roulette Testing Team
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  pocketAngle,
  hitTest,
  angleToPocket,
  pocketToAngle,
  pocketIndex,
  getPocketOrder,
  getTotalPockets,
  isRed,
  isBlack,
  isGreen,
  pocketOrderEU,
  pocketOrderUS,
  RED_POCKETS_EU,
  RED_POCKETS_US
} from '../../src/roulette/mapping.js';

describe('🗺️ Roulette Mapping System', () => {
  describe('🇪🇺 European Roulette (Single Zero)', () => {
    describe('Pocket Order Validation', () => {
      it('should have exactly 37 pockets', () => {
        expect(pocketOrderEU).toHaveLength(37);
        expect(getTotalPockets('EU')).toBe(37);
      });

      it('should start with 0', () => {
        expect(pocketOrderEU[0]).toBe(0);
        expect(getPocketOrder('EU')[0]).toBe(0);
      });

      it('should contain all valid numbers 0-36 exactly once', () => {
        const uniqueNumbers = new Set(pocketOrderEU);
        expect(uniqueNumbers.size).toBe(37);
        
        // Should contain 0
        expect(uniqueNumbers.has(0)).toBe(true);
        
        // Should contain all numbers 1-36
        for (let i = 1; i <= 36; i++) {
          expect(uniqueNumbers.has(i)).toBe(true);
        }
      });

      it('should match expected European sequence', () => {
        const expected = [
          0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30,
          8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7,
          28, 12, 35, 3, 26
        ];
        expect(pocketOrderEU).toEqual(expected);
      });

      it('should have correct pocket order at specific positions', () => {
        expect(pocketOrderEU[0]).toBe(0);    // Zero
        expect(pocketOrderEU[1]).toBe(32);   // Red
        expect(pocketOrderEU[13]).toBe(36);  // Red (last high)
        expect(pocketOrderEU[15]).toBe(30);  // Red
        expect(pocketOrderEU[23]).toBe(1);   // Red
        expect(pocketOrderEU[26]).toBe(31);  // Black
        expect(pocketOrderEU[35]).toBe(3);   // Red
      });
    });

    describe('Pocket Angle Calculation', () => {
      it('should calculate angle for first pocket (index 0)', () => {
        const angle = pocketAngle(0, 'EU');
        const expectedAngle = 360 / 37 / 2; // Half of first pocket angle
        expect(angle).toBeCloseTo(expectedAngle, 6);
      });

      it('should calculate angles in equal increments', () => {
        const angleStep = 360 / 37;
        const angles = [];
        
        for (let i = 0; i < 37; i++) {
          angles.push(pocketAngle(i, 'EU'));
        }
        
        // Check that angles increase by constant step
        for (let i = 1; i < angles.length; i++) {
          const diff = angles[i] - angles[i - 1];
          expect(diff).toBeCloseTo(angleStep, 6);
        }
      });

      it('should return angle in valid range (0-360)', () => {
        for (let i = 0; i < 37; i++) {
          const angle = pocketAngle(i, 'EU');
          expect(angle).toBeGreaterThanOrEqual(0);
          expect(angle).toBeLessThan(360);
        }
      });

      it('should wrap angle correctly for last pocket', () => {
        const lastAngle = pocketAngle(36, 'EU');
        expect(lastAngle).toBeGreaterThan(350); // Near end of circle
        expect(lastAngle).toBeLessThan(360);
      });

      it('should throw error for out-of-bounds index', () => {
        expect(() => pocketAngle(-1, 'EU')).toThrow();
        expect(() => pocketAngle(37, 'EU')).toThrow();
        expect(() => pocketAngle(100, 'EU')).toThrow();
      });
    });

    describe('Angle to Pocket Conversion', () => {
      it('should convert angle 0 to first pocket', () => {
        const index = hitTest(0, 'EU');
        expect(index).toBe(0);
      });

      it('should convert angle 180 to correct pocket', () => {
        const index = hitTest(180, 'EU');
        const expectedIndex = Math.floor((180 / 360) * 37);
        expect(index).toBe(expectedIndex);
      });

      it('should convert angle near end to last pocket', () => {
        const index = hitTest(359, 'EU');
        expect(index).toBe(36);
      });

      it('should handle negative angles by normalization', () => {
        const normalizedIndex = hitTest(-10, 'EU');
        const positiveIndex = hitTest(350, 'EU');
        expect(normalizedIndex).toBe(positiveIndex);
      });

      it('should handle angles > 360 by normalization', () => {
        const normalizedIndex = hitTest(370, 'EU');
        const positiveIndex = hitTest(10, 'EU');
        expect(normalizedIndex).toBe(positiveIndex);
      });

      it('should return valid indices for all angles', () => {
        for (let i = 0; i < 360; i += 5) {
          const index = hitTest(i, 'EU');
          expect(index).toBeGreaterThanOrEqual(0);
          expect(index).toBeLessThan(37);
        }
      });
    });

    describe('Bidirectional Conversion', () => {
      it('should round-trip angle through pocket conversion', () => {
        for (let angle = 0; angle < 360; angle += 15) {
          const pocket = angleToPocket(angle, 'EU');
          const backToAngle = pocketToAngle(pocket, 'EU');
          const backToPocket = angleToPocket(backToAngle, 'EU');
          
          expect(pocket).toBe(backToPocket);
        }
      });

      it('should find correct pocket for each angle range', () => {
        const angleStep = 360 / 37;
        
        for (let i = 0; i < 37; i++) {
          const pocket = pocketOrderEU[i];
          const centerAngle = i * angleStep + angleStep / 2;
          const foundPocket = angleToPocket(centerAngle, 'EU');
          
          expect(foundPocket).toBe(pocket);
        }
      });
    });

    describe('Pocket Index Lookup', () => {
      it('should find correct index for each pocket', () => {
        for (let i = 0; i < 37; i++) {
          const pocket = pocketOrderEU[i];
          const index = pocketIndex(pocket, 'EU');
          expect(index).toBe(i);
        }
      });

      it('should return -1 for non-existent pocket', () => {
        expect(pocketIndex(99, 'EU')).toBe(-1);
        expect(pocketIndex(-1, 'EU')).toBe(-1);
      });

      it('should find zero at index 0', () => {
        expect(pocketIndex(0, 'EU')).toBe(0);
      });
    });

    describe('Color Determination', () => {
      const expectedRedNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
      const expectedBlackNumbers = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];

      it('should correctly identify all red pockets', () => {
        expectedRedNumbers.forEach(num => {
          expect(isRed(num, 'EU')).toBe(true);
          expect(isBlack(num, 'EU')).toBe(false);
          expect(isGreen(num)).toBe(false);
        });
      });

      it('should correctly identify all black pockets', () => {
        expectedBlackNumbers.forEach(num => {
          expect(isRed(num, 'EU')).toBe(false);
          expect(isBlack(num, 'EU')).toBe(true);
          expect(isGreen(num)).toBe(false);
        });
      });

      it('should correctly identify zero as green', () => {
        expect(isRed(0, 'EU')).toBe(false);
        expect(isBlack(0, 'EU')).toBe(false);
        expect(isGreen(0)).toBe(true);
      });

      it('should have correct red pocket count', () => {
        let redCount = 0;
        for (let i = 1; i <= 36; i++) {
          if (isRed(i, 'EU')) redCount++;
        }
        expect(redCount).toBe(18);
      });

      it('should have correct black pocket count', () => {
        let blackCount = 0;
        for (let i = 1; i <= 36; i++) {
          if (isBlack(i, 'EU')) blackCount++;
        }
        expect(blackCount).toBe(18);
      });

      it('should match RED_POCKETS_EU set', () => {
        for (let i = 0; i <= 36; i++) {
          if (RED_POCKETS_EU.has(i)) {
            expect(isRed(i, 'EU')).toBe(true);
          }
        }
      });
    });
  });

  describe('🇺🇸 American Roulette (Double Zero)', () => {
    describe('Pocket Order Validation', () => {
      it('should have exactly 38 pockets', () => {
        expect(pocketOrderUS).toHaveLength(38);
        expect(getTotalPockets('US')).toBe(38);
      });

      it('should start with 0', () => {
        expect(pocketOrderUS[0]).toBe(0);
        expect(getPocketOrder('US')[0]).toBe(0);
      });

      it('should match expected American sequence', () => {
        const expected = [
          0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24,
          36, 13, 1, '00', 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33,
          16, 4, 23, 35, 14, 2
        ];
        expect(pocketOrderUS).toEqual(expected);
      });

      it('should have 00 at correct position', () => {
        expect(pocketOrderUS[19]).toBe('00');
      });
    });

    describe('Pocket Angle Calculation', () => {
      it('should calculate angles for 38 pockets', () => {
        const angleStep = 360 / 38;
        
        for (let i = 0; i < 38; i++) {
          const angle = pocketAngle(i, 'US');
          expect(angle).toBeGreaterThanOrEqual(0);
          expect(angle).toBeLessThan(360);
        }
        
        // Check first and last angles
        const firstAngle = pocketAngle(0, 'US');
        const lastAngle = pocketAngle(37, 'US');
        
        expect(firstAngle).toBeCloseTo(angleStep / 2, 6);
        expect(lastAngle).toBeCloseTo(360 - angleStep / 2, 6);
      });
    });

    describe('Angle to Pocket Conversion', () => {
      it('should convert angles to correct pockets', () => {
        const angleStep = 360 / 38;
        
        for (let i = 0; i < 38; i++) {
          const centerAngle = i * angleStep + angleStep / 2;
          const pocket = angleToPocket(centerAngle, 'US');
          const expectedPocket = pocketOrderUS[i];
          
          expect(pocket).toBe(expectedPocket);
        }
      });
    });

    describe('Color Determination', () => {
      it('should correctly identify red pockets', () => {
        const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
        redNumbers.forEach(num => {
          expect(isRed(num, 'US')).toBe(true);
        });
      });

      it('should correctly identify green pockets (0 and 00)', () => {
        expect(isGreen(0)).toBe(true);
        expect(isGreen('00')).toBe(true);
        expect(isRed(0, 'US')).toBe(false);
        expect(isRed('00', 'US')).toBe(false);
      });

      it('should match RED_POCKETS_US set', () => {
        for (const num of RED_POCKETS_US) {
          expect(isRed(num, 'US')).toBe(true);
        }
      });
    });
  });

  describe('🔄 Cross-Wheel Compatibility', () => {
    it('should have different pocket orders', () => {
      expect(pocketOrderEU).not.toEqual(pocketOrderUS);
      expect(pocketOrderEU.length).not.toEqual(pocketOrderUS.length);
    });

    it('should both contain numbers 1-36', () => {
      const euNumbers = new Set(pocketOrderEU.filter(n => n !== 0));
      const usNumbers = new Set(pocketOrderUS.filter(n => n !== 0 && n !== '00'));
      
      for (let i = 1; i <= 36; i++) {
        expect(euNumbers.has(i)).toBe(true);
        expect(usNumbers.has(i)).toBe(true);
      }
    });

    it('should handle both wheel types in same operations', () => {
      const angle = 90;
      const euPocket = angleToPocket(angle, 'EU');
      const usPocket = angleToPocket(angle, 'US');
      
      expect(euPocket).toBeDefined();
      expect(usPocket).toBeDefined();
      expect(euPocket).not.toBe(usPocket);
    });
  });

  describe('📏 Precision Tests', () => {
    it('should maintain numerical precision for calculations', () => {
      const angle = 180.5;
      const euIndex = hitTest(angle, 'EU');
      const usIndex = hitTest(angle, 'US');
      
      expect(euIndex).toBe(Math.floor(euIndex));
      expect(usIndex).toBe(Math.floor(usIndex));
    });

    it('should handle floating point edge cases', () => {
      const edgeAngles = [0, 90, 180, 270, 359.9999];
      
      edgeAngles.forEach(angle => {
        const euIndex = hitTest(angle, 'EU');
        const usIndex = hitTest(angle, 'US');
        
        expect(euIndex).toBeGreaterThanOrEqual(0);
        expect(euIndex).toBeLessThan(37);
        expect(usIndex).toBeGreaterThanOrEqual(0);
        expect(usIndex).toBeLessThan(38);
      });
    });
  });

  describe('🛡️ Error Handling', () => {
    describe('Invalid Inputs', () => {
      it('should throw errors for invalid wheel types', () => {
        expect(() => pocketAngle(0, 'INVALID')).toThrow();
        expect(() => hitTest(0, 'INVALID')).toThrow();
        expect(() => angleToPocket(0, 'INVALID')).toThrow();
        expect(() => pocketToAngle(0, 'INVALID')).toThrow();
      });

      it('should handle null and undefined gracefully', () => {
        expect(() => pocketAngle(null)).toThrow();
        expect(() => hitTest(undefined)).toThrow();
        expect(() => angleToPocket(null)).toThrow();
      });

      it('should throw for negative pocket numbers', () => {
        expect(() => pocketIndex(-1)).toBe(-1); // Should return -1 for not found
        expect(() => pocketToAngle(-1)).toThrow();
      });

      it('should throw for out-of-range pocket numbers', () => {
        expect(() => pocketToAngle(100)).toThrow();
        expect(() => pocketToAngle(37)).toThrow(); // 37 doesn't exist in European
      });
    });
  });

  describe('⚡ Performance Tests', () => {
    it('should complete 10000 operations in under 100ms', () => {
      const start = performance.now();
      
      for (let i = 0; i < 10000; i++) {
        const angle = Math.random() * 360;
        hitTest(angle, 'EU');
        angleToPocket(angle, 'EU');
        pocketIndex(i % 37, 'EU');
      }
      
      const end = performance.now();
      const duration = end - start;
      
      console.log(`Mapping operations: ${duration.toFixed(2)}ms for 10000 operations`);
      expect(duration).toBeLessThan(100);
    });

    it('should handle bulk conversions efficiently', () => {
      const angles = Array.from({ length: 1000 }, () => Math.random() * 360);
      
      const start = performance.now();
      const results = angles.map(angle => angleToPocket(angle, 'EU'));
      const end = performance.now();
      
      expect(results).toHaveLength(1000);
      expect(end - start).toBeLessThan(50);
    });
  });

  describe('🔍 Edge Cases', () => {
    it('should handle angle exactly on pocket boundary', () => {
      const angleStep = 360 / 37;
      const boundaryAngle = angleStep; // Exactly on boundary
      
      const index = hitTest(boundaryAngle, 'EU');
      expect(index).toBe(1); // Should be in second pocket
    });

    it('should handle maximum angle value', () => {
      const maxAngle = 359.9999999;
      const index = hitTest(maxAngle, 'EU');
      expect(index).toBe(36); // Last pocket
    });

    it('should handle minimum angle value', () => {
      const minAngle = 0.0000001;
      const index = hitTest(minAngle, 'EU');
      expect(index).toBe(0); // First pocket
    });

    it('should handle large lap angles correctly', () => {
      const largeAngle = 360 * 5 + 45; // 5 laps + 45 degrees
      const normalizedAngle = 45;
      
      const index1 = hitTest(largeAngle, 'EU');
      const index2 = hitTest(normalizedAngle, 'EU');
      
      expect(index1).toBe(index2);
    });
  });

  describe('📊 Statistical Distribution', () => {
    it('should produce uniform distribution of pocket hits', () => {
      const hits = new Array(37).fill(0);
      const iterations = 3700; // 100x number of pockets
      
      for (let i = 0; i < iterations; i++) {
        const angle = (i / iterations) * 360;
        const index = hitTest(angle, 'EU');
        hits[index]++;
      }
      
      const expectedHits = iterations / 37;
      const tolerance = expectedHits * 0.1; // 10% tolerance
      
      hits.forEach(hitCount => {
        expect(Math.abs(hitCount - expectedHits)).toBeLessThan(tolerance);
      });
    });

    it('should have consistent color distribution', () => {
      const angles = Array.from({ length: 360 }, (_, i) => i);
      const redHits = angles.filter(angle => {
        const pocket = angleToPocket(angle, 'EU');
        return isRed(pocket, 'EU');
      }).length;
      
      const blackHits = angles.filter(angle => {
        const pocket = angleToPocket(angle, 'EU');
        return isBlack(pocket, 'EU');
      }).length;
      
      // Red and black should be approximately equal (18:18 ratio)
      expect(redHits).toBeGreaterThan(blackHits * 0.9);
      expect(redHits).toBeLessThan(blackHits * 1.1);
    });
  });
});

// Test fixtures and utilities
describe('🧪 Test Utilities', () => {
  it('should provide consistent test data', () => {
    const euOrder = getPocketOrder('EU');
    const usOrder = getPocketOrder('US');
    
    expect(euOrder).toEqual(pocketOrderEU);
    expect(usOrder).toEqual(pocketOrderUS);
  });

  it('should maintain data immutability', () => {
    const originalEU = [...pocketOrderEU];
    const originalUS = [...pocketOrderUS];
    
    const returnedEU = getPocketOrder('EU');
    const returnedUS = getPocketOrder('US');
    
    // Should return copies, not references
    expect(returnedEU).toEqual(originalEU);
    expect(returnedUS).toEqual(originalUS);
    
    // Modifying returned arrays shouldn't affect originals
    returnedEU[0] = 999;
    returnedUS[0] = 999;
    
    expect(pocketOrderEU[0]).toBe(0);
    expect(pocketOrderUS[0]).toBe(0);
  });
});
