/**
 * Roulette Number Mapping System
 * Handles pocket order for European and American roulette wheels
 * Maps pocket numbers to angles and vice versa
 */

// European roulette pocket order (clockwise from top, single zero)
const pocketOrderEU = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30,
  8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7,
  28, 12, 35, 3, 26
];

// American roulette pocket order (clockwise from top, double zero)
const pocketOrderUS = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24,
  36, 13, 1, 00, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33,
  16, 4, 23, 35, 14, 2
];

/**
 * Calculate the angle for a given pocket index
 * @param {number} index - The index of the pocket in the order array
 * @param {string} type - 'EU' for European, 'US' for American
 * @returns {number} The angle in degrees (0-360)
 */
function pocketAngle(index, type = 'EU') {
  const order = type === 'US' ? pocketOrderUS : pocketOrderEU;
  const totalPockets = order.length;
  
  if (index < 0 || index >= totalPockets) {
    throw new Error(`Invalid pocket index: ${index}. Must be between 0 and ${totalPockets - 1}`);
  }
  
  // Each pocket gets an equal portion of 360 degrees
  const anglePerPocket = 360 / totalPockets;
  
  // Calculate the center angle of the pocket
  const angle = (index * anglePerPocket) + (anglePerPocket / 2);
  
  return angle % 360;
}

/**
 * Find the pocket index based on an angle
 * @param {number} angle - The angle in degrees (0-360)
 * @param {string} type - 'EU' for European, 'US' for American
 * @returns {number} The pocket index
 */
function hitTest(angle, type = 'EU') {
  const order = type === 'US' ? pocketOrderUS : pocketOrderEU;
  const totalPockets = order.length;
  
  // Normalize angle to 0-360 range
  angle = angle % 360;
  if (angle < 0) angle += 360;
  
  const anglePerPocket = 360 / totalPockets;
  
  // Find which pocket this angle falls into
  const index = Math.floor(angle / anglePerPocket);
  
  // Ensure index is within bounds
  return Math.min(Math.max(index, 0), totalPockets - 1);
}

/**
 * Convert angle to pocket number
 * @param {number} angle - The angle in degrees (0-360)
 * @param {string} type - 'EU' for European, 'US' for American
 * @returns {number} The pocket number
 */
function angleToPocket(angle, type = 'EU') {
  const order = type === 'US' ? pocketOrderUS : pocketOrderEU;
  const index = hitTest(angle, type);
  return order[index];
}

/**
 * Convert pocket number to angle
 * @param {number} pocketNumber - The pocket number
 * @param {string} type - 'EU' for European, 'US' for American
 * @returns {number} The angle in degrees
 */
function pocketToAngle(pocketNumber, type = 'EU') {
  const order = type === 'US' ? pocketOrderUS : pocketOrderEU;
  const index = order.indexOf(pocketNumber);
  
  if (index === -1) {
    throw new Error(`Pocket number ${pocketNumber} not found in ${type} wheel`);
  }
  
  return pocketAngle(index, type);
}

/**
 * Get the index of a pocket number in the order
 * @param {number} pocketNumber - The pocket number
 * @param {string} type - 'EU' for European, 'US' for American
 * @returns {number} The index in the order array, or -1 if not found
 */
function pocketIndex(pocketNumber, type = 'EU') {
  const order = type === 'US' ? pocketOrderUS : pocketOrderEU;
  return order.indexOf(pocketNumber);
}

/**
 * Get all pocket numbers for a given type
 * @param {string} type - 'EU' for European, 'US' for American
 * @returns {Array} Array of pocket numbers
 */
function getPocketOrder(type = 'EU') {
  return type === 'US' ? [...pocketOrderUS] : [...pocketOrderEU];
}

/**
 * Get total number of pockets
 * @param {string} type - 'EU' for European, 'US' for American
 * @returns {number} Total number of pockets
 */
function getTotalPockets(type = 'EU') {
  return type === 'US' ? pocketOrderUS.length : pocketOrderEU.length;
}

/**
 * Check if a pocket number is red in European roulette
 * Red pockets: 1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36
 */
const RED_POCKETS_EU = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

/**
 * Check if a pocket number is red in American roulette
 * Red pockets: 1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36
 */
const RED_POCKETS_US = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

/**
 * Check if a pocket is red
 * @param {number} pocketNumber - The pocket number
 * @param {string} type - 'EU' for European, 'US' for American
 * @returns {boolean} True if red
 */
function isRed(pocketNumber, type = 'EU') {
  if (pocketNumber === 0 || pocketNumber === '00') return false;
  
  const redSet = type === 'US' ? RED_POCKETS_US : RED_POCKETS_EU;
  return redSet.has(pocketNumber);
}

/**
 * Check if a pocket is black
 * @param {number} pocketNumber - The pocket number
 * @param {string} type - 'EU' for European, 'US' for American
 * @returns {boolean} True if black
 */
function isBlack(pocketNumber, type = 'EU') {
  if (pocketNumber === 0 || pocketNumber === '00') return false;
  return !isRed(pocketNumber, type);
}

/**
 * Check if a pocket is green (0 or 00)
 * @param {number} pocketNumber - The pocket number
 * @returns {boolean} True if green
 */
function isGreen(pocketNumber) {
  return pocketNumber === 0 || pocketNumber === '00';
}

// Export all functions and constants
module.exports = {
  // Constants
  pocketOrderEU,
  pocketOrderUS,
  RED_POCKETS_EU,
  RED_POCKETS_US,
  
  // Main functions
  pocketAngle,
  hitTest,
  angleToPocket,
  pocketToAngle,
  
  // Utility functions
  pocketIndex,
  getPocketOrder,
  getTotalPockets,
  isRed,
  isBlack,
  isGreen,
  
  // Unit test exports for comprehensive testing
  tests: {
    testPocketAngle,
    testHitTest,
    testAngleToPocket,
    testPocketToAngle,
    testPocketIndex,
    testGetPocketOrder,
    testGetTotalPockets,
    testIsRed,
    testIsBlack,
    testIsGreen,
    runAllTests
  }
};

/**
 * Unit Test Functions
 */

/**
 * Test pocketAngle function
 */
function testPocketAngle() {
  const tests = [];
  
  // Test European wheel
  tests.push({
    name: 'pocketAngle EU index 0',
    input: [0, 'EU'],
    expected: 360 / 37 / 2,
    actual: pocketAngle(0, 'EU'),
    pass: Math.abs(pocketAngle(0, 'EU') - (360 / 37 / 2)) < 0.001
  });
  
  tests.push({
    name: 'pocketAngle EU index 18',
    input: [18, 'EU'],
    expected: (18 * (360 / 37)) + ((360 / 37) / 2),
    actual: pocketAngle(18, 'EU'),
    pass: Math.abs(pocketAngle(18, 'EU') - ((18 * (360 / 37)) + ((360 / 37) / 2))) < 0.001
  });
  
  // Test American wheel
  tests.push({
    name: 'pocketAngle US index 0',
    input: [0, 'US'],
    expected: 360 / 38 / 2,
    actual: pocketAngle(0, 'US'),
    pass: Math.abs(pocketAngle(0, 'US') - (360 / 38 / 2)) < 0.001
  });
  
  // Test invalid index
  try {
    pocketAngle(50, 'EU');
    tests.push({
      name: 'pocketAngle invalid index',
      input: [50, 'EU'],
      expected: 'Error',
      actual: 'No error',
      pass: false
    });
  } catch (e) {
    tests.push({
      name: 'pocketAngle invalid index',
      input: [50, 'EU'],
      expected: 'Error',
      actual: 'Error',
      pass: true
    });
  }
  
  return tests;
}

/**
 * Test hitTest function
 */
function testHitTest() {
  const tests = [];
  
  // Test European wheel
  tests.push({
    name: 'hitTest EU angle 0',
    input: [0, 'EU'],
    expected: 0,
    actual: hitTest(0, 'EU'),
    pass: hitTest(0, 'EU') === 0
  });
  
  tests.push({
    name: 'hitTest EU angle 180',
    input: [180, 'EU'],
    expected: Math.floor(180 / (360 / 37)),
    actual: hitTest(180, 'EU'),
    pass: hitTest(180, 'EU') === Math.floor(180 / (360 / 37))
  });
  
  // Test American wheel
  tests.push({
    name: 'hitTest US angle 90',
    input: [90, 'US'],
    expected: Math.floor(90 / (360 / 38)),
    actual: hitTest(90, 'US'),
    pass: hitTest(90, 'US') === Math.floor(90 / (360 / 38))
  });
  
  // Test negative angle
  tests.push({
    name: 'hitTest negative angle',
    input: [-10, 'EU'],
    expected: hitTest(350, 'EU'),
    actual: hitTest(-10, 'EU'),
    pass: hitTest(-10, 'EU') === hitTest(350, 'EU')
  });
  
  // Test angle > 360
  tests.push({
    name: 'hitTest angle > 360',
    input: [370, 'EU'],
    expected: hitTest(10, 'EU'),
    actual: hitTest(370, 'EU'),
    pass: hitTest(370, 'EU') === hitTest(10, 'EU')
  });
  
  return tests;
}

/**
 * Test angleToPocket function
 */
function testAngleToPocket() {
  const tests = [];
  
  // Test European wheel
  tests.push({
    name: 'angleToPocket EU angle 0',
    input: [0, 'EU'],
    expected: pocketOrderEU[0],
    actual: angleToPocket(0, 'EU'),
    pass: angleToPocket(0, 'EU') === pocketOrderEU[0]
  });
  
  tests.push({
    name: 'angleToPocket EU angle 180',
    input: [180, 'EU'],
    expected: pocketOrderEU[hitTest(180, 'EU')],
    actual: angleToPocket(180, 'EU'),
    pass: angleToPocket(180, 'EU') === pocketOrderEU[hitTest(180, 'EU')]
  });
  
  // Test American wheel
  tests.push({
    name: 'angleToPocket US angle 90',
    input: [90, 'US'],
    expected: pocketOrderUS[hitTest(90, 'US')],
    actual: angleToPocket(90, 'US'),
    pass: angleToPocket(90, 'US') === pocketOrderUS[hitTest(90, 'US')]
  });
  
  return tests;
}

/**
 * Test pocketToAngle function
 */
function testPocketToAngle() {
  const tests = [];
  
  // Test European wheel
  tests.push({
    name: 'pocketToAngle EU 0',
    input: [0, 'EU'],
    expected: pocketAngle(pocketIndex(0, 'EU'), 'EU'),
    actual: pocketToAngle(0, 'EU'),
    pass: pocketToAngle(0, 'EU') === pocketAngle(pocketIndex(0, 'EU'), 'EU')
  });
  
  tests.push({
    name: 'pocketToAngle EU 36',
    input: [36, 'EU'],
    expected: pocketAngle(pocketIndex(36, 'EU'), 'EU'),
    actual: pocketToAngle(36, 'EU'),
    pass: pocketToAngle(36, 'EU') === pocketAngle(pocketIndex(36, 'EU'), 'EU')
  });
  
  // Test American wheel
  tests.push({
    name: 'pocketToAngle US 0',
    input: [0, 'US'],
    expected: pocketAngle(pocketIndex(0, 'US'), 'US'),
    actual: pocketToAngle(0, 'US'),
    pass: pocketToAngle(0, 'US') === pocketAngle(pocketIndex(0, 'US'), 'US')
  });
  
  tests.push({
    name: 'pocketToAngle US 36',
    input: [36, 'US'],
    expected: pocketAngle(pocketIndex(36, 'US'), 'US'),
    actual: pocketToAngle(36, 'US'),
    pass: pocketToAngle(36, 'US') === pocketAngle(pocketIndex(36, 'US'), 'US')
  });
  
  // Test invalid pocket
  try {
    pocketToAngle(99, 'EU');
    tests.push({
      name: 'pocketToAngle invalid pocket',
      input: [99, 'EU'],
      expected: 'Error',
      actual: 'No error',
      pass: false
    });
  } catch (e) {
    tests.push({
      name: 'pocketToAngle invalid pocket',
      input: [99, 'EU'],
      expected: 'Error',
      actual: 'Error',
      pass: true
    });
  }
  
  return tests;
}

/**
 * Test pocketIndex function
 */
function testPocketIndex() {
  const tests = [];
  
  // Test European wheel
  tests.push({
    name: 'pocketIndex EU 0',
    input: [0, 'EU'],
    expected: 0,
    actual: pocketIndex(0, 'EU'),
    pass: pocketIndex(0, 'EU') === 0
  });
  
  tests.push({
    name: 'pocketIndex EU 36',
    input: [36, 'EU'],
    expected: 13,
    actual: pocketIndex(36, 'EU'),
    pass: pocketIndex(36, 'EU') === 13
  });
  
  // Test American wheel
  tests.push({
    name: 'pocketIndex US 0',
    input: [0, 'US'],
    expected: 0,
    actual: pocketIndex(0, 'US'),
    pass: pocketIndex(0, 'US') === 0
  });
  
  tests.push({
    name: 'pocketIndex US 36',
    input: [36, 'US'],
    expected: 16,
    actual: pocketIndex(36, 'US'),
    pass: pocketIndex(36, 'US') === 16
  });
  
  // Test non-existent pocket
  tests.push({
    name: 'pocketIndex non-existent',
    input: [99, 'EU'],
    expected: -1,
    actual: pocketIndex(99, 'EU'),
    pass: pocketIndex(99, 'EU') === -1
  });
  
  return tests;
}

/**
 * Test getPocketOrder function
 */
function testGetPocketOrder() {
  const tests = [];
  
  tests.push({
    name: 'getPocketOrder EU',
    input: ['EU'],
    expected: pocketOrderEU,
    actual: getPocketOrder('EU'),
    pass: JSON.stringify(getPocketOrder('EU')) === JSON.stringify(pocketOrderEU)
  });
  
  tests.push({
    name: 'getPocketOrder US',
    input: ['US'],
    expected: pocketOrderUS,
    actual: getPocketOrder('US'),
    pass: JSON.stringify(getPocketOrder('US')) === JSON.stringify(pocketOrderUS)
  });
  
  return tests;
}

/**
 * Test getTotalPockets function
 */
function testGetTotalPockets() {
  const tests = [];
  
  tests.push({
    name: 'getTotalPockets EU',
    input: ['EU'],
    expected: 37,
    actual: getTotalPockets('EU'),
    pass: getTotalPockets('EU') === 37
  });
  
  tests.push({
    name: 'getTotalPockets US',
    input: ['US'],
    expected: 38,
    actual: getTotalPockets('US'),
    pass: getTotalPockets('US') === 38
  });
  
  return tests;
}

/**
 * Test isRed function
 */
function testIsRed() {
  const tests = [];
  
  // Test red pockets
  tests.push({
    name: 'isRed 1 EU',
    input: [1, 'EU'],
    expected: true,
    actual: isRed(1, 'EU'),
    pass: isRed(1, 'EU') === true
  });
  
  tests.push({
    name: 'isRed 32 EU',
    input: [32, 'EU'],
    expected: true,
    actual: isRed(32, 'EU'),
    pass: isRed(32, 'EU') === true
  });
  
  // Test black pockets
  tests.push({
    name: 'isRed 2 EU',
    input: [2, 'EU'],
    expected: false,
    actual: isRed(2, 'EU'),
    pass: isRed(2, 'EU') === false
  });
  
  tests.push({
    name: 'isRed 28 EU',
    input: [28, 'EU'],
    expected: false,
    actual: isRed(28, 'EU'),
    pass: isRed(28, 'EU') === false
  });
  
  // Test green pockets
  tests.push({
    name: 'isRed 0 EU',
    input: [0, 'EU'],
    expected: false,
    actual: isRed(0, 'EU'),
    pass: isRed(0, 'EU') === false
  });
  
  tests.push({
    name: 'isRed 00 US',
    input: ['00', 'US'],
    expected: false,
    actual: isRed('00', 'US'),
    pass: isRed('00', 'US') === false
  });
  
  return tests;
}

/**
 * Test isBlack function
 */
function testIsBlack() {
  const tests = [];
  
  // Test black pockets
  tests.push({
    name: 'isBlack 2 EU',
    input: [2, 'EU'],
    expected: true,
    actual: isBlack(2, 'EU'),
    pass: isBlack(2, 'EU') === true
  });
  
  tests.push({
    name: 'isBlack 28 EU',
    input: [28, 'EU'],
    expected: true,
    actual: isBlack(28, 'EU'),
    pass: isBlack(28, 'EU') === true
  });
  
  // Test red pockets
  tests.push({
    name: 'isBlack 1 EU',
    input: [1, 'EU'],
    expected: false,
    actual: isBlack(1, 'EU'),
    pass: isBlack(1, 'EU') === false
  });
  
  // Test green pockets
  tests.push({
    name: 'isBlack 0 EU',
    input: [0, 'EU'],
    expected: false,
    actual: isBlack(0, 'EU'),
    pass: isBlack(0, 'EU') === false
  });
  
  tests.push({
    name: 'isBlack 00 US',
    input: ['00', 'US'],
    expected: false,
    actual: isBlack('00', 'US'),
    pass: isBlack('00', 'US') === false
  });
  
  return tests;
}

/**
 * Test isGreen function
 */
function testIsGreen() {
  const tests = [];
  
  // Test green pockets
  tests.push({
    name: 'isGreen 0',
    input: [0],
    expected: true,
    actual: isGreen(0),
    pass: isGreen(0) === true
  });
  
  tests.push({
    name: 'isGreen 00',
    input: ['00'],
    expected: true,
    actual: isGreen('00'),
    pass: isGreen('00') === true
  });
  
  // Test non-green pockets
  tests.push({
    name: 'isGreen 1',
    input: [1],
    expected: false,
    actual: isGreen(1),
    pass: isGreen(1) === false
  });
  
  tests.push({
    name: 'isGreen 36',
    input: [36],
    expected: false,
    actual: isGreen(36),
    pass: isGreen(36) === false
  });
  
  return tests;
}

/**
 * Run all tests and return results
 */
function runAllTests() {
  const allTestFunctions = [
    testPocketAngle,
    testHitTest,
    testAngleToPocket,
    testPocketToAngle,
    testPocketIndex,
    testGetPocketOrder,
    testGetTotalPockets,
    testIsRed,
    testIsBlack,
    testIsGreen
  ];
  
  const results = {
    passed: 0,
    failed: 0,
    total: 0,
    tests: []
  };
  
  allTestFunctions.forEach(testFunc => {
    const testResults = testFunc();
    testResults.forEach(test => {
      results.total++;
      if (test.pass) {
        results.passed++;
      } else {
        results.failed++;
      }
      results.tests.push(test);
    });
  });
  
  results.passRate = ((results.passed / results.total) * 100).toFixed(2);
  
  return results;
}
