import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { MessageFlags } from 'discord.js';
import { logger } from '../logger.js';
import { ensureTypescriptBuild, distSrcDir } from '../utils/typescript-runtime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function createUnavailableError(reason) {
  const message = reason ?? 'Giveaway system is not available.';
  const error = new Error(message);
  error.code = 'GIVEAWAY_UNAVAILABLE';
  return error;
}

function createUnavailableModule(reason) {
  return {
    initGiveawaySystem() {
      logger.warn('Giveaway module unavailable during initialization; skipping setup.', { reason });
      return null;
    },
    isGiveawayButton() {
      return false;
    },
    async handleGiveawayButton(interaction) {
      if (interaction.replied || interaction.deferred) {
        return;
      }

      try {
        await interaction.reply({
          content: 'Giveaway system is not available right now.',
          flags: MessageFlags.Ephemeral,
        });
      } catch (error) {
        logger.warn('failed to send unavailable giveaway response', { err: error });
      }
    },
    getGiveawayService() {
      throw createUnavailableError(reason);
    },
    getGiveawayScheduler() {
      throw createUnavailableError(reason);
    },
    getDailyScheduler() {
      throw createUnavailableError(reason);
    },
  };
}

async function tryLoadModule(modulePath) {
  try {
    const module = await import(pathToFileURL(modulePath).href);

    const requiredExports = [
      'initGiveawaySystem',
      'handleGiveawayButton',
      'isGiveawayButton',
      'getGiveawayService',
      'getGiveawayScheduler',
      'getDailyScheduler',
    ];

    const missing = requiredExports.filter((name) => typeof module[name] !== 'function');
    if (missing.length) {
      logger.warn('Giveaway router module missing required exports', {
        source: modulePath,
        missing,
      });
      return null;
    }

    return module;
  } catch (error) {
    logger.error('failed to load giveaway router module', { source: modulePath, err: error });
    return null;
  }
}

async function loadGiveawayRuntime() {
  // Try to load compiled JS file first (production build)
  const distRouterPath = join(distSrcDir, 'giveaway', 'router.js');

  if (existsSync(distRouterPath)) {
    const module = await tryLoadModule(distRouterPath);
    if (module) {
      logger.info('Giveaway router loaded from compiled build', { source: distRouterPath });
      return { module, available: true, source: distRouterPath, reason: null };
    }
  }

  // Try to build from TypeScript source if available (development/runtime build)
  const tsSource = join(__dirname, 'router.ts');
  if (existsSync(tsSource)) {
    logger.info('Attempting to build giveaway router from TypeScript source', { source: tsSource });
    const built = await ensureTypescriptBuild('giveaway/router.js');
    if (built && existsSync(distRouterPath)) {
      const module = await tryLoadModule(distRouterPath);
      if (module) {
        logger.info('Giveaway router built and loaded successfully', { source: distRouterPath });
        return { module, available: true, source: distRouterPath, reason: null };
      }
    }
  }

  // Giveaway is optional - log warning but don't fail
  const reason = 'Giveaway router not available (optional feature). Bot will continue without giveaway functionality.';
  logger.warn(reason, { 
    distPath: distRouterPath,
    tsSource: existsSync(tsSource) ? tsSource : 'not found',
    distExists: existsSync(distSrcDir)
  });
  return { module: createUnavailableModule(reason), available: false, source: null, reason };
}

const runtimeState = await loadGiveawayRuntime();
const runtimeModule = runtimeState.module;

const {
  initGiveawaySystem,
  handleGiveawayButton,
  isGiveawayButton,
  getGiveawayService,
  getGiveawayScheduler,
  getDailyScheduler,
} = runtimeModule;

export {
  initGiveawaySystem,
  handleGiveawayButton,
  isGiveawayButton,
  getGiveawayService,
  getGiveawayScheduler,
  getDailyScheduler,
};

export function isGiveawayRuntimeAvailable() {
  return runtimeState.available;
}

export function getGiveawayRuntimeSource() {
  return runtimeState.source;
}

export function getGiveawayRuntimeReason() {
  return runtimeState.reason;
}

export function getGiveawayRuntimeState() {
  return runtimeState;
}

export function getGiveawayUnavailableMessage() {
  if (runtimeState.available) {
    return null;
  }

  if (runtimeState.reason) {
    return `🎁 Giveaway system is currently unavailable: ${runtimeState.reason}`;
  }

  return '🎁 Giveaway system is currently unavailable. Please try again later.';
}

export async function ensureGiveawayRuntimeAvailable(interaction) {
  if (runtimeState.available) {
    return true;
  }

  const message = getGiveawayUnavailableMessage();
  const payload = {
    content: message ?? '🎁 Giveaway system is currently unavailable. Please try again later.',
    ephemeral: true,
  };

  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (error) {
    logger.warn('failed to notify user about unavailable giveaway system', { err: error });
  }

  return false;
}
