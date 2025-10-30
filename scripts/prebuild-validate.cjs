#!/usr/bin/env node
/*
 * Self-healing native module validator for the GUHD EATS bot.
 * Ensures that canvas, gifencoder, and sharp are present and functional.
 * Attempts automated repairs when possible and only exits non-zero after all
 * repair strategies for a module are exhausted.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
process.chdir(PROJECT_ROOT);

const args = process.argv.slice(2);
const verifyOnly = args.includes('--verify-only');

const packageJson = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8')
);

function logWithEmoji(emoji, message) {
  console.log(`${emoji} [prebuild] ${message}`);
}

function runCommand(command, description) {
  logWithEmoji('⚙️', `${description} (${command})`);
  try {
    execSync(command, { stdio: 'inherit' });
    logWithEmoji('✅', `${description} succeeded`);
    return true;
  } catch (error) {
    logWithEmoji('❌', `${description} failed: ${error.message}`);
    return false;
  }
}

function clearRequireCache(moduleName) {
  try {
    const resolved = require.resolve(moduleName);
    delete require.cache[resolved];
  } catch (error) {
    // Ignore resolution errors – caller will handle.
  }
}

function getExpectedVersion(moduleName) {
  return (
    (packageJson.dependencies && packageJson.dependencies[moduleName]) ||
    (packageJson.optionalDependencies &&
      packageJson.optionalDependencies[moduleName]) ||
    (packageJson.devDependencies && packageJson.devDependencies[moduleName]) ||
    'latest'
  );
}

async function testCanvas() {
  clearRequireCache('canvas');
  const canvasModule = require('canvas');
  const { createCanvas } = canvasModule;
  if (typeof createCanvas !== 'function') {
    throw new Error('canvas.createCanvas is not available');
  }

  const canvas = createCanvas(16, 16);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#00ff99';
  ctx.fillRect(0, 0, 16, 16);

  const pngBuffer = canvas.toBuffer('image/png');
  if (!pngBuffer || pngBuffer.length === 0) {
    throw new Error('canvas.toBuffer returned empty buffer');
  }

  const bindingPath = path.resolve(
    path.dirname(require.resolve('canvas')),
    '../build/Release/canvas.node'
  );

  if (!fs.existsSync(bindingPath)) {
    throw new Error(`Missing native binding at ${bindingPath}`);
  }

  return true;
}

async function testGifencoder() {
  clearRequireCache('gifencoder');
  const GIFEncoder = require('gifencoder');
  if (typeof GIFEncoder !== 'function') {
    throw new Error('gifencoder export is not a constructor');
  }

  const encoder = new GIFEncoder(8, 8);
  encoder.start();
  encoder.setRepeat(0);
  encoder.setDelay(20);

  const { createCanvas } = require('canvas');
  const canvas = createCanvas(8, 8);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ff0066';
  ctx.fillRect(0, 0, 8, 8);
  encoder.addFrame(ctx);
  encoder.finish();

  const buffer = encoder.out.getData();
  if (!buffer || buffer.length === 0) {
    throw new Error('gifencoder produced an empty buffer');
  }

  return true;
}

async function testSharp() {
  clearRequireCache('sharp');
  const sharp = require('sharp');
  if (typeof sharp !== 'function') {
    throw new Error('sharp export is not callable');
  }

  const image = sharp({
    create: {
      width: 4,
      height: 4,
      channels: 4,
      background: { r: 10, g: 20, b: 30, alpha: 1 }
    }
  });

  await image.png().toBuffer();
  return true;
}

const MODULES = [
  {
    name: 'canvas',
    tester: testCanvas,
    repairs: [
      {
        description: 'Rebuilding canvas from source',
        command: 'npm rebuild --build-from-source canvas'
      },
      {
        description: 'Reinstalling canvas with legacy peer deps',
        command: `npm install canvas@${getExpectedVersion(
          'canvas'
        )} --force --legacy-peer-deps`
      }
    ]
  },
  {
    name: 'gifencoder',
    tester: testGifencoder,
    repairs: [
      {
        description: 'Reinstalling gifencoder',
        command: `npm install gifencoder@${getExpectedVersion(
          'gifencoder'
        )} --force --legacy-peer-deps`
      }
    ]
  },
  {
    name: 'sharp',
    tester: testSharp,
    repairs: [
      {
        description: 'Rebuilding sharp',
        command: 'npm rebuild sharp'
      },
      {
        description: 'Reinstalling sharp with legacy peer deps',
        command: `npm install sharp@${getExpectedVersion(
          'sharp'
        )} --force --legacy-peer-deps`
      }
    ]
  }
];

async function ensureModule(moduleInfo) {
  const { name, tester, repairs } = moduleInfo;
  logWithEmoji('🔍', `Validating ${name}...`);

  try {
    await tester();
    logWithEmoji('✅', `${name} passed integrity test`);
    return true;
  } catch (initialError) {
    logWithEmoji('⚠️', `${name} failed initial test: ${initialError.message}`);

    if (verifyOnly) {
      return false;
    }

    for (const repair of repairs) {
      const success = runCommand(repair.command, repair.description);
      if (!success) {
        continue;
      }

      try {
        await tester();
        logWithEmoji('✅', `${name} recovered after repair`);
        return true;
      } catch (postRepairError) {
        logWithEmoji('⚠️', `${name} still failing: ${postRepairError.message}`);
      }
    }

    logWithEmoji('❌', `${name} could not be repaired automatically`);
    if (name === 'canvas') {
      logWithEmoji(
        '💡',
        'Ensure system libraries are installed: libcairo2-dev libpixman-1-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev'
      );
    }
    if (name === 'sharp') {
      logWithEmoji('💡', 'Try clearing npm cache and ensuring libvips is available.');
    }
    return false;
  }
}

async function main() {
  logWithEmoji('🚀', 'Starting native module self-check');
  logWithEmoji(
    'ℹ️',
    `Mode: ${verifyOnly ? 'verification-only (no repairs)' : 'self-healing'} \n`
  );

  const failures = [];

  for (const moduleInfo of MODULES) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await ensureModule(moduleInfo);
    if (!ok) {
      failures.push(moduleInfo.name);
    }
  }

  if (failures.length > 0) {
    logWithEmoji(
      '💥',
      `Validation failed for: ${failures.join(', ')}`
    );
    process.exit(1);
  }

  logWithEmoji('🎉', 'All critical native modules are ready!');
}

main().catch((error) => {
  logWithEmoji('💣', `Unexpected error: ${error.message}`);
  process.exit(1);
});
