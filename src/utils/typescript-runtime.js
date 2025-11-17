import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { logger } from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// [AI FIX]: Detect project root by checking for package.json to avoid double dist/dist path
// When running from dist/src/utils/typescript-runtime.js, __dirname is dist/src/utils
// Going up two levels gives 'dist', so we need to go up one more to get project root
let computedRepoRoot = join(__dirname, '..', '..');
// Check if package.json exists at this level, if not, we're in dist directory
const packageJsonPath = join(computedRepoRoot, 'package.json');
if (!existsSync(packageJsonPath)) {
  // We're likely in dist directory, go up one more level to get project root
  computedRepoRoot = join(__dirname, '..', '..', '..');
}

export const repoRoot = computedRepoRoot;
export const srcRoot = join(repoRoot, 'src');
export const distSrcDir = join(repoRoot, 'dist', 'src');

let typescriptBuildPromise = null;

function resolveIndicatorPath(indicatorRelativePath) {
  if (!indicatorRelativePath) {
    return null;
  }

  return join(distSrcDir, indicatorRelativePath);
}

export async function ensureTypescriptBuild(indicatorRelativePath = 'giveaway/router.js') {
  const indicatorPath = resolveIndicatorPath(indicatorRelativePath);

  if (indicatorPath && existsSync(indicatorPath)) {
    return true;
  }

  if (typescriptBuildPromise) {
    return typescriptBuildPromise;
  }

  typescriptBuildPromise = (async () => {
    let tscPath;
    try {
      const moduleRequire = createRequire(import.meta.url);
      tscPath = moduleRequire.resolve('typescript/bin/tsc');
    } catch (error) {
      logger.warn('TypeScript runtime compiler unavailable; skipping build', { err: error });
      return false;
    }

    logger.info('Compiling TypeScript sources for runtime support...');

    const args = [tscPath, '--project', join(repoRoot, 'tsconfig.json')];
    const child = spawn(process.execPath, args, { cwd: repoRoot });

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }

    const exitCode = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', (code) => resolve(code ?? 1));
    });

    if (exitCode !== 0) {
      throw new Error(`tsc exited with code ${exitCode}${stderr ? `: ${stderr.trim()}` : ''}`);
    }

    if (stdout.trim()) {
      logger.info('TypeScript compiler output', { output: stdout.trim() });
    }

    if (indicatorPath && !existsSync(indicatorPath)) {
      logger.warn('TypeScript build completed but expected output is missing', {
        indicatorPath,
      });
    }

    return true;
  })()
    .catch((error) => {
      logger.error('failed to compile TypeScript sources for runtime', { err: error });
      return false;
    })
    .finally(() => {
      typescriptBuildPromise = null;
    });

  return typescriptBuildPromise;
}
