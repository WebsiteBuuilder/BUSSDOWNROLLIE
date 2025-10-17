import { describe, it, expect, afterEach } from 'vitest';

import { getEnvVar } from '../src/lib/env.js';

const originalUpper = process.env.TEST_KEY;
const originalLower = process.env.test_key;

afterEach(() => {
  if (originalUpper === undefined) {
    delete process.env.TEST_KEY;
  } else {
    process.env.TEST_KEY = originalUpper;
  }

  if (originalLower === undefined) {
    delete process.env.test_key;
  } else {
    process.env.test_key = originalLower;
  }
});

describe('getEnvVar', () => {
  it('returns trimmed values for matching keys', () => {
    process.env.TEST_KEY = '  value  ';

    expect(getEnvVar('TEST_KEY')).toBe('value');
  });

  it('looks up keys case-insensitively', () => {
    delete process.env.TEST_KEY;
    process.env.test_key = 'abc';

    expect(getEnvVar('TEST_KEY')).toBe('abc');
  });

  it('treats empty strings as undefined', () => {
    process.env.TEST_KEY = '   ';

    expect(getEnvVar('TEST_KEY')).toBeUndefined();
  });
});
