import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';

import { createCanvas } from 'canvas';
import GIFEncoder from 'gifencoder';
import { AttachmentBuilder } from 'discord.js';

import {
  createWheelTextures,
  drawConfetti,
  drawLightingReflection,
  drawWinningHighlight,
  getWheelOrder
} from './cinematic-wheel.js';
import { validateCanvasContext } from './safe-canvas-utils.js';

const MAX_FILE_BYTES = Math.floor(2.9 * 1024 * 1024);
const PREVIEW_MIME = 'image/png';
const TEXTURE_CACHE = new Map();

const immediate = () => new Promise(resolve => setImmediate(resolve));

const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

function calculateSpeed(frame, totalFrames) {
  const progress = frame / (totalFrames - 1);
  return 1 - easeOutCubic(progress);
}

function getWinningAngle(winningNumber) {
  const wheelOrder = getWheelOrder();
  const pocketIndex = wheelOrder.indexOf(winningNumber);
  const anglePerPocket = (Math.PI * 2) / wheelOrder.length;
  return -(pocketIndex * anglePerPocket) + (Math.PI / 2);
}

function resolveConfig(options = {}) {
  const fps = Math.max(18, Math.min(24, options.fps ?? 20));
  const durationMs = options.duration ?? 2200;
  const rawFrames = Math.round((durationMs / 1000) * fps);
  const frameCount = Math.max(35, Math.min(45, rawFrames || 0));

  const quality = Math.max(8, Math.min(18, options.quality ?? 12));

  const baseWidth = options.width ?? 520;
  const baseHeight = options.height ?? baseWidth;

  let width = Math.max(420, Math.min(640, baseWidth));
  let height = Math.max(420, Math.min(640, baseHeight));

  const totalPixels = width * height * frameCount;
  const estimatedBytes = totalPixels * 0.19; // conservative upper bound
  if (estimatedBytes > MAX_FILE_BYTES) {
    const scale = Math.sqrt(MAX_FILE_BYTES / estimatedBytes);
    width = Math.max(360, Math.floor(width * scale));
    height = Math.max(360, Math.floor(height * scale));
  }

  const duration = Math.round((frameCount / fps) * 1000);

  return {
    fps,
    quality,
    width,
    height,
    frameCount,
    duration,
    totalRotations: 5.4 + Math.random() * 1.1
  };
}

function getTextures(width, height) {
  const key = `${width}x${height}`;
  if (!TEXTURE_CACHE.has(key)) {
    TEXTURE_CACHE.set(key, createWheelTextures(width, height));
  }
  return TEXTURE_CACHE.get(key);
}

function drawWheelLayer(ctx, textures, angle, speed) {
  const { centerX, centerY } = textures.meta;

  ctx.save();
  ctx.translate(centerX, centerY);

  if (speed > 0.55) {
    const blurOffset = speed * 0.09;
    ctx.rotate(angle - blurOffset);
    ctx.globalAlpha = 0.35;
    ctx.drawImage(textures.wheel, -centerX, -centerY);
    ctx.rotate(blurOffset * 0.6);
    ctx.globalAlpha = 0.6;
    ctx.drawImage(textures.wheel, -centerX, -centerY);
    ctx.rotate(blurOffset * 0.4);
    ctx.globalAlpha = 0.95;
    ctx.drawImage(textures.wheel, -centerX, -centerY);
  } else {
    ctx.rotate(angle);
    ctx.globalAlpha = 1;
    ctx.drawImage(textures.wheel, -centerX, -centerY);
  }

  ctx.restore();
}

function drawBranding(ctx, textures, angle) {
  const { centerX, centerY } = textures.meta;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(angle * 0.45);
  ctx.drawImage(textures.branding, -centerX, -centerY);
  ctx.restore();
}

function drawHighlight(ctx, textures, winningNumber, progress, angle) {
  if (winningNumber === null || winningNumber === undefined) {
    return;
  }

  ctx.save();
  ctx.translate(textures.meta.centerX, textures.meta.centerY);
  ctx.rotate(angle);
  drawWinningHighlight(ctx, 0, 0, textures.meta.outerRadius, winningNumber, progress);
  ctx.restore();
}

function drawConfettiLayer(ctx, textures, progress) {
  drawConfetti(ctx, textures.meta.centerX, textures.meta.centerY, progress);
}

function renderFrame(textures, state, frameIndex, winningNumber, reuseCanvas) {
  const canvas = reuseCanvas ?? createCanvas(textures.meta.width, textures.meta.height);
  const ctx = canvas.getContext('2d');
  validateCanvasContext(ctx);

  ctx.clearRect(0, 0, textures.meta.width, textures.meta.height);
  ctx.drawImage(textures.background, 0, 0);

  const progress = frameIndex / (state.frameCount - 1);
  const eased = easeOutCubic(progress);
  const currentAngle = state.startAngle - state.spinDistance * eased;
  const speed = calculateSpeed(frameIndex, state.frameCount);

  drawWheelLayer(ctx, textures, currentAngle, speed);
  drawBranding(ctx, textures, currentAngle);

  if (speed < 0.75) {
    const intensity = Math.max(0.2, 1 - speed);
    drawLightingReflection(
      ctx,
      textures.meta.centerX,
      textures.meta.centerY,
      textures.meta.outerRadius,
      currentAngle * 0.85,
      intensity
    );
  }

  ctx.drawImage(textures.centerHub, 0, 0);

  if (frameIndex >= state.confettiStart) {
    const confettiProgress = (frameIndex - state.confettiStart) / (state.frameCount - state.confettiStart);
    drawConfettiLayer(ctx, textures, Math.min(1, confettiProgress));
  }

  if (frameIndex >= state.highlightStart) {
    const highlightProgress = (frameIndex - state.highlightStart) / (state.frameCount - state.highlightStart);
    drawHighlight(ctx, textures, winningNumber, Math.min(1, highlightProgress), currentAngle);
  }

  return canvas;
}

async function encodeSpin({ winningNumber, textures, state, firstFrameCanvas }) {
  const encoder = new GIFEncoder(state.width, state.height);
  encoder.start();
  encoder.setRepeat(0);
  encoder.setDelay(Math.round(1000 / state.fps));
  encoder.setQuality(state.quality);

  const tempFile = path.join('/tmp', `roulette-spin-${Date.now()}-${Math.random().toString(16).slice(2)}.gif`);
  const writeStream = fs.createWriteStream(tempFile);
  encoder.createReadStream().pipe(writeStream);

  const concurrency = Math.min(4, state.frameCount);
  const tasks = new Map();
  let scheduled = 0;

  function schedule(frameIndex) {
    const task = (async () => {
      await immediate();
      if (frameIndex === 0 && firstFrameCanvas) {
        return { frameIndex, canvas: firstFrameCanvas };
      }
      const canvas = renderFrame(textures, state, frameIndex, winningNumber);
      return { frameIndex, canvas };
    })();
    tasks.set(frameIndex, task);
    scheduled++;
  }

  while (scheduled < concurrency) {
    schedule(scheduled);
  }

  for (let frame = 0; frame < state.frameCount; frame++) {
    const task = tasks.get(frame);
    const { canvas } = await task;
    tasks.delete(frame);

    const ctx = canvas.getContext('2d');
    validateCanvasContext(ctx);
    encoder.addFrame(ctx);

    if (scheduled < state.frameCount) {
      schedule(scheduled);
    }

    if (frame % 5 === 0) {
      await immediate();
    }
  }

  encoder.finish();
  await once(writeStream, 'finish');

  const buffer = await fs.promises.readFile(tempFile);
  await fs.promises.rm(tempFile, { force: true });

  return buffer;
}

function buildState(config, winningNumber) {
  const targetAngle = getWinningAngle(winningNumber);
  const startAngle = targetAngle + config.totalRotations * Math.PI * 2;
  const spinDistance = startAngle - targetAngle;

  return {
    ...config,
    startAngle,
    spinDistance,
    confettiStart: Math.max(0, config.frameCount - 8),
    highlightStart: Math.max(0, config.frameCount - 10)
  };
}

async function createPreview(textures, state, winningNumber) {
  const canvas = renderFrame(textures, state, 0, winningNumber);
  const buffer = canvas.toBuffer(PREVIEW_MIME);
  return { canvas, buffer };
}

export async function generateCinematicSpin(winningNumber, options = {}) {
  if (typeof winningNumber !== 'number' || winningNumber < 0 || winningNumber > 36) {
    throw new Error(`Invalid winning number: ${winningNumber}`);
  }

  const config = resolveConfig(options);
  const textures = getTextures(config.width, config.height);
  const state = buildState({ ...config, width: config.width, height: config.height }, winningNumber);

  const startTime = Date.now();
  console.log(`[SPIN_START] #${winningNumber} | ${state.width}x${state.height} @${state.fps}fps (${state.frameCount} frames)`);

  const { canvas: previewCanvas, buffer: previewBuffer } = await createPreview(textures, state, winningNumber);
  console.log(`[FIRST_FRAME_READY] +${Date.now() - startTime}ms`);

  let resolveFinal;
  let rejectFinal;
  const finalPromise = new Promise((resolve, reject) => {
    resolveFinal = resolve;
    rejectFinal = reject;
  });

  (async () => {
    try {
      const buffer = await encodeSpin({
        winningNumber,
        textures,
        state,
        firstFrameCanvas: previewCanvas
      });

      const encodeDuration = Date.now() - startTime;
      console.log(`[ENCODE_COMPLETE] +${encodeDuration}ms`);

      if (buffer.length > MAX_FILE_BYTES) {
        console.warn(`⚠️  GIF exceeded threshold (${(buffer.length / 1024 / 1024).toFixed(2)}MB).`);
      }

      console.log(`[FINAL_SIZE] ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);

      resolveFinal({
        buffer,
        metadata: {
          sizeBytes: buffer.length,
          sizeMB: parseFloat((buffer.length / 1024 / 1024).toFixed(2)),
          sizeKB: Math.round(buffer.length / 1024),
          frames: state.frameCount,
          fps: state.fps,
          duration: state.duration,
          encodeTimeSeconds: parseFloat((encodeDuration / 1000).toFixed(2)),
          resolution: `${state.width}x${state.height}`,
          winningNumber
        }
      });
    } catch (error) {
      rejectFinal(error);
    }
  })();

  return {
    preview: {
      buffer: previewBuffer,
      mimeType: PREVIEW_MIME,
      width: state.width,
      height: state.height
    },
    final: finalPromise
  };
}

export async function createCinematicAttachment(winningNumber, options = {}) {
  const job = await generateCinematicSpin(winningNumber, options);
  const result = await job.final;
  return new AttachmentBuilder(result.buffer, {
    name: 'roulette-spin.gif',
    description: `STILL GUUHHHD Roulette - Number ${winningNumber}`
  });
}

export function generateResultFrame(winningNumber) {
  const textures = getTextures(600, 600);
  const frameCount = 40;
  const config = resolveConfig({ fps: 20, duration: 2000, width: 600, height: 600 });
  const state = buildState({ ...config, frameCount, width: 600, height: 600 }, winningNumber);
  state.confettiStart = Math.max(0, frameCount - 5);
  state.highlightStart = Math.max(0, frameCount - 5);
  const canvas = renderFrame(textures, state, frameCount - 1, winningNumber);
  return canvas.toBuffer('image/png');
}

export function createResultAttachment(winningNumber) {
  const pngBuffer = generateResultFrame(winningNumber);
  return new AttachmentBuilder(pngBuffer, {
    name: 'roulette-result.png',
    description: `Winning Number: ${winningNumber}`
  });
}
