import { Client, Collection, Events, GatewayIntentBits, MessageFlags, REST, Routes } from 'discord.js';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { readdirSync, existsSync } from 'fs';
import { createRequire } from 'module';
import { spawn } from 'child_process';
import prisma, { initializeDatabase } from './db/index.js';
import { initLogger } from './lib/logger.js';
import { handleBattleComponent, handleBattleSelect, isBattleInteraction } from './commands/battle.js';
import { handleBlackjackInteraction } from './commands/blackjack.js';
import { handleRouletteButton } from './commands/roulette.js';
import { GSTART_MODAL_ID, handleGstartModalSubmit } from './commands/gstart.js';
import { handleApproveVouchButton } from './commands/approvevouch.js';
import { config as botConfig, assertConfig } from './config.js';
import { logger } from './logger.js';
import { runStartupValidation } from './utils/startup-validator.js';
import { validateCinematicAnimation, getAnimationStatus } from './roulette/safe-animation.js';

// ES modules dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const distSrcDir = join(projectRoot, 'dist', 'src');

let typescriptBuildPromise = null;

async function ensureTypescriptBuild() {
  const giveawayOutput = join(distSrcDir, 'giveaway', 'router.js');
  if (existsSync(giveawayOutput)) {
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

    const args = [tscPath, '--project', join(projectRoot, 'tsconfig.json')];
    const child = spawn(process.execPath, args, { cwd: projectRoot });

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

    return true;
  })().catch((error) => {
    logger.error('failed to compile TypeScript sources for runtime', { err: error });
    return false;
  });

  return typescriptBuildPromise;
}

async function ensureGiveawayDatabaseReady() {
  const localDb = join(__dirname, 'giveaway', 'db.js');
  const distDb = join(distSrcDir, 'giveaway', 'db.js');

  const tryEnsure = async (candidate) => {
    try {
      const module = await import(pathToFileURL(candidate).href);
      const ensureFn = module?.ensureGiveawayDb;

      if (typeof ensureFn === 'function') {
        ensureFn();
        return true;
      }

      logger.warn('Giveaway database module missing ensureGiveawayDb export', {
        source: candidate,
      });
      return false;
    } catch (error) {
      logger.error('failed to prepare giveaway database schema', {
        source: candidate,
        err: error,
      });
      throw error;
    }
  };

  if (existsSync(localDb)) {
    return tryEnsure(localDb);
  }

  if (existsSync(distDb)) {
    return tryEnsure(distDb);
  }

  const built = await ensureTypescriptBuild();
  if (!built) {
    logger.warn('Skipping giveaway database initialization: TypeScript build failed.');
    return false;
  }

  if (existsSync(distDb)) {
    return tryEnsure(distDb);
  }

  logger.warn('Skipping giveaway database initialization: compiled giveaway DB module missing.', {
    path: distDb,
  });
  return false;
}

function createUnavailableGiveawayHandlers() {
  return {
    initGiveawaySystem() {
      logger.warn('Giveaway module unavailable during initialization; skipping setup.');
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
  };
}

let giveawayHandlers = createUnavailableGiveawayHandlers();
let giveawaysLoaded = false;
let giveawayModuleSource = null;

function updateGiveawayHandlers(module, sourcePath) {
  const initFn = module?.initGiveawaySystem;
  const handleFn = module?.handleGiveawayButton;
  const isButtonFn = module?.isGiveawayButton;

  if (typeof initFn === 'function' && typeof handleFn === 'function' && typeof isButtonFn === 'function') {
    giveawayHandlers = {
      initGiveawaySystem: initFn,
      handleGiveawayButton: handleFn,
      isGiveawayButton: isButtonFn,
    };
    giveawaysLoaded = true;
    giveawayModuleSource = sourcePath;
    logger.info('Giveaway module loaded', { source: sourcePath });
  } else {
    logger.warn('Giveaway module missing required exports', { source: sourcePath });
  }
}

async function loadGiveawayHandlers() {
  const tryLoadModule = async (modulePath) => {
    try {
      const module = await import(pathToFileURL(modulePath).href);
      updateGiveawayHandlers(module, modulePath);
      return true;
    } catch (error) {
      logger.error('failed to load giveaway module', { source: modulePath, err: error });
      return false;
    }
  };

  const localJs = join(__dirname, 'giveaway', 'router.js');
  try {
    if (existsSync(localJs) && (await tryLoadModule(localJs))) {
      return;
    }

    const distJs = join(distSrcDir, 'giveaway', 'router.js');
    if (existsSync(distJs) && (await tryLoadModule(distJs))) {
      return;
    }

    const tsSource = join(__dirname, 'giveaway', 'router.ts');
    if (!existsSync(tsSource)) {
      logger.warn('Giveaway system disabled: router module not found.');
      return;
    }

    const built = await ensureTypescriptBuild();
    if (!built) {
      logger.warn('Giveaway system disabled: TypeScript build failed.');
      return;
    }

    if (existsSync(distJs) && (await tryLoadModule(distJs))) {
      return;
    }

    logger.warn('Giveaway system disabled: compiled router module missing after build.', {
      path: distJs,
    });
    return;
  } catch (error) {
    logger.error('unexpected error while loading giveaway handlers', { err: error });
  }
}

const giveawayModuleReady = loadGiveawayHandlers();

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Store commands in collection
client.commands = new Collection();

/**
 * Load all command files
 */
async function loadCommands() {
  const commandsPath = join(__dirname, 'commands');
  const commandFiles = readdirSync(commandsPath).filter((file) => file.endsWith('.js') || file.endsWith('.ts'));

  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    let command;

    try {
      if (file.endsWith('.js')) {
        command = await import(pathToFileURL(filePath).href);
      } else if (file.endsWith('.ts')) {
        const built = await ensureTypescriptBuild();
        if (!built) {
          logger.warn('Skipping TypeScript command due to build failure', { file });
          continue;
        }

        const compiledPath = join(distSrcDir, 'commands', file.replace(/\.ts$/, '.js'));
        if (!existsSync(compiledPath)) {
          logger.warn('Compiled command not found after build', { file, compiledPath });
          continue;
        }

        command = await import(pathToFileURL(compiledPath).href);
      } else {
        logger.warn('Skipping unsupported command file', { file });
        continue;
      }
    } catch (error) {
      logger.error('failed to load command module', { file, err: error });
      continue;
    }

    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`✅ Loaded command: ${command.data.name}`);
    } else {
      console.warn(`⚠️  Command at ${file} is missing required "data" or "execute" property`);
    }
  }
}

/**
 * Load all event files
 */
async function loadEvents() {
  const eventsPath = join(__dirname, 'events');
  const eventFiles = readdirSync(eventsPath).filter((file) => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = join(eventsPath, file);
    const event = await import(`file://${filePath}`);

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }

    console.log(`✅ Loaded event: ${event.name}`);
  }
}

/**
 * Register slash commands with Discord
 */
async function registerCommands() {
  const commands = [];

  for (const command of client.commands.values()) {
    commands.push(command.data.toJSON());
  }

  const rest = new REST().setToken(botConfig.token);

  try {
    console.log(`🔄 Registering ${commands.length} slash commands...`);

    // Guild-specific registration (faster for development)
    if (botConfig.guildId) {
      await rest.put(Routes.applicationGuildCommands(client.user.id, botConfig.guildId), {
        body: commands,
      });
      console.log('✅ Successfully registered guild commands');
    } else {
      // Global registration (takes up to 1 hour to propagate)
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
      console.log('✅ Successfully registered global commands');
    }
  } catch (error) {
    logger.error('error registering commands', { err: error });
  }
}

/**
 * Initialize bot
 */
async function init() {
  try {
    assertConfig();
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database initialized');

    try {
      const ensured = await ensureGiveawayDatabaseReady();
      if (!ensured) {
        logger.warn('Giveaway database not initialized during startup; giveaway commands may be unavailable.');
      }
    } catch (error) {
      logger.warn('Failed to initialize giveaway database during startup', { err: error });
    }

    // Load commands and events
    await loadCommands();
    await loadEvents();

    // Login to Discord
    await client.login(botConfig.token);
  } catch (error) {
    logger.error('failed to initialize bot', { err: error });
    process.exit(1);
  }
}

// Handle bot ready event
client.once(Events.ClientReady, async () => {
  console.log(`🚀 Bot is online as ${client.user.tag}`);

  // Register commands
  await registerCommands();

  // Initialize giveaway system
  await giveawayModuleReady;
  giveawayHandlers.initGiveawaySystem(client);

  if (!giveawaysLoaded) {
    logger.warn('Giveaway system not initialized; related commands will be unavailable.');
  } else if (giveawayModuleSource) {
    logger.info('Giveaway system initialized', { source: giveawayModuleSource });
  }

  // Initialize logger
  if (process.env.LOG_CHANNEL_ID) {
    try {
      const logChannel = await client.channels.fetch(process.env.LOG_CHANNEL_ID);
      initLogger(logChannel);
      console.log('✅ Logger initialized');
    } catch (error) {
      logger.warn('could not initialize channel logger', { err: error });
    }
  }

  console.log('✅ GUHD EATS bot is ready!');
});

// Handle interaction events (slash commands and buttons)
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        logger.warn('unknown command received', {
          command: interaction.commandName,
          userId: interaction.user?.id,
        });
        return;
      }

      try {
        await command.execute(interaction, client);
      } catch (error) {
        logger.error(`error executing command ${interaction.commandName}`, {
          err: error,
          command: interaction.commandName,
          userId: interaction.user?.id,
        });

        const errorMessage = {
          content: '❌ There was an error executing this command!',
          flags: MessageFlags.Ephemeral,
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === GSTART_MODAL_ID) {
        await handleGstartModalSubmit(interaction);
        return;
      }
    }

    if (interaction.isButton()) {
      if (isBattleInteraction(interaction.customId)) {
        const handled = await handleBattleComponent(interaction);
        if (handled) {
          return;
        }
      }

      const customId = interaction.customId ?? '';

      await giveawayModuleReady;

      if (giveawayHandlers.isGiveawayButton(customId)) {
        await giveawayHandlers.handleGiveawayButton(interaction);
        return;
      }

      if (customId.startsWith('approvevouch:')) {
        await handleApproveVouchButton(interaction);
        return;
      }

      if (customId.startsWith('bj_')) {
        await handleBlackjackInteraction(interaction);
        return;
      }

      if (customId.startsWith('roulette')) {
        const handled = await handleRouletteButton(interaction);
        if (handled) {
          return;
        }
      }
    }

    if (interaction.isStringSelectMenu()) {
      if (isBattleInteraction(interaction.customId)) {
        const handled = await handleBattleSelect(interaction);
        if (handled) {
          return;
        }
      }
    }
  } catch (err) {
    logger.error('interaction error', {
      err,
      type: interaction.type,
      id: interaction.id,
      user: interaction.user?.id,
    });

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        ephemeral: true,
        content: 'Something went wrong. Try again.',
      });
    }
  }
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down bot...');
  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down bot...');
  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error, origin) => {
  logger.error('uncaught exception', {
    err: error,
    origin,
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('unhandled rejection', {
    err: reason instanceof Error ? reason : new Error(String(reason)),
    promiseState: promise && typeof promise === 'object' ? promise.constructor?.name : undefined,
  });
});

// Start the bot with validation
(async () => {
  try {
    // Run startup validation
    await runStartupValidation();
    
    // Validate cinematic animation system
    await validateCinematicAnimation();
    
    // Check animation status
    const animStatus = getAnimationStatus();
    console.log(`🎨 Roulette Animation Mode: ${animStatus.mode}`);
    
    if (!animStatus.available) {
      console.error('❌ CRITICAL: Cinematic animation is NOT available!');
      console.error('   Roulette command will be DISABLED');
      console.error('   Please check Docker build logs for canvas/gifencoder issues');
      console.error('');
    }
    
    // Initialize bot
    await init();
  } catch (error) {
    console.error('❌ Fatal startup error:', error);
    process.exit(1);
  }
})();

export default client;
