import { logger } from '../logger.js';

let canvasModule = null;
let canvasError = null;

try {
  canvasModule = await import('canvas');
} catch (error) {
  canvasError = error;
  logger.warn('Canvas dependency unavailable; graphics features will be degraded.', { err: error });
}

let sharpModule = null;
let sharpError = null;

try {
  const imported = await import('sharp');
  sharpModule = imported?.default ?? imported;
} catch (error) {
  sharpError = error;
  logger.warn('Sharp dependency unavailable; WebP encoding will be disabled.', { err: error });
}

export const canvasAvailable = Boolean(canvasModule?.createCanvas && canvasModule?.loadImage);
export const sharpAvailable = Boolean(sharpModule);

export function getCanvasModule() {
  if (!canvasAvailable) {
    throw new Error(
      'Canvas dependency is unavailable. Install native modules (canvas) to enable advanced roulette rendering.'
    );
  }
  return canvasModule;
}

export function getSharpModule() {
  if (!sharpAvailable) {
    throw new Error(
      'Sharp dependency is unavailable. Install native modules (sharp) to enable WebP encoding.'
    );
  }
  return sharpModule;
}

export function getNativeDependencyStatus() {
  return {
    canvasAvailable,
    sharpAvailable,
    canvasError,
    sharpError,
  };
}
