import { Client, Collection, Events, GatewayIntentBits, MessageFlags, REST, Routes } from 'discord.js';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { readdirSync, existsSync } from 'fs';
import prisma, { initializeDatabase } from './db/index.js';
import { initLogger } from './lib/logger.js';
import { handleBattleComponent, handleBattleSelect, isBattleInteraction } from './commands/battle.js';
import { handleBlackjackInteraction } from './commands/blackjack.js';
import { handleRouletteButton } from './commands/roulette.js';
import { GSTART_MODAL_ID, handleGstartModalSubmit } from './commands/gstart.js';
import { handleApproveVouchButton } from './commands/approvevouch.js';
import { config as botConfig, assertConfig } from './config.js';
import { logger } from './logger.js';
import { startNetworkServer } from './server.js';
import { runStartupValidation } from './utils/startup-validator.js';
import { validateCinematicAnimation, getAnimationStatus } from './roulette/safe-animation.js';
import { ensureTypescriptBuild, distSrcDir } from './utils/typescript-runtime.js';
import { getGiveawayRuntimeState } from './giveaway/runtime.js';

// ES modules dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
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

  const built = await ensureTypescriptBuild('giveaway/db.js');
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
let giveawayUnavailableReason = null;

function updateGiveawayHandlers(module, sourcePath, runtimeState = {}) {
  const initFn = module?.initGiveawaySystem;
  const handleFn = module?.handleGiveawayButton;
  const isButtonFn = module?.isGiveawayButton;

  if (typeof initFn === 'function' && typeof handleFn === 'function' && typeof isButtonFn === 'function') {
    giveawayHandlers = {
      initGiveawaySystem: initFn,
      handleGiveawayButton: handleFn,
      isGiveawayButton: isButtonFn,
    };
    const { available = true, reason = null } = runtimeState;
    giveawaysLoaded = Boolean(available);
    giveawayModuleSource = sourcePath ?? null;
    giveawayUnavailableReason = available ? null : reason;

    if (giveawaysLoaded) {
      if (sourcePath) {
        logger.info('Giveaway module loaded', { source: sourcePath });
      } else {
        logger.info('Giveaway module loaded');
      }
    } else {
      logger.warn('Giveaway module operating in degraded mode', {
        source: sourcePath,
        reason: reason ?? 'unknown',
      });
    }
  } else {
    logger.warn('Giveaway module missing required exports', { source: sourcePath });
  }
}

async function loadGiveawayHandlers() {
  try {
    const runtimeState = getGiveawayRuntimeState();

    if (runtimeState?.module) {
      updateGiveawayHandlers(runtimeState.module, runtimeState.source, runtimeState);
      return;
    }

    logger.warn('Giveaway runtime returned no module; giveaway handlers will remain unavailable.');
  } catch (error) {
    logger.error('unexpected error while loading giveaway handlers', { err: error });
  }
}

const bootStartedAt = Date.now();
const networkServerPromise = startNetworkServer({ bootStartedAt }).catch((error) => {
  console.error('❌ Failed to start network server', error);
  process.exit(1);
});

void networkServerPromise;

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
  
  if (!existsSync(commandsPath)) {
    logger.error('Commands directory not found', { path: commandsPath });
    console.error(`❌ Commands directory not found at: ${commandsPath}`);
    return;
  }
  
  const commandFiles = readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
  
  console.log(`📦 Found ${commandFiles.length} command file(s) in ${commandsPath}`);
  
  let loadedCount = 0;
  let skippedCount = 0;

  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    let command;

    try {
      command = await import(pathToFileURL(filePath).href);
    } catch (error) {
      logger.error('failed to load command module', { file, err: error });
      skippedCount++;
      continue;
    }

    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`✅ Loaded command: ${command.data.name}`);
      loadedCount++;
    } else {
      console.warn(`⚠️  Command at ${file} is missing required "data" or "execute" property`);
      skippedCount++;
    }
  }
  
  console.log(`📊 Command loading complete: ${loadedCount} loaded, ${skippedCount} skipped`);
  
  if (loadedCount === 0) {
    console.warn('⚠️  WARNING: No commands were loaded! Bot will not respond to slash commands.');
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

  if (commands.length === 0) {
    console.warn('⚠️  WARNING: No commands to register! Check command loading.');
    logger.warn('No commands available for registration');
    return;
  }

  console.log(`🔄 Registering ${commands.length} slash command(s) with Discord...`);
  console.log(`📋 Commands: ${commands.map(c => c.name).join(', ')}`);

  const rest = new REST().setToken(botConfig.token);

  try {
    // Guild-specific registration (faster for development)
    if (botConfig.guildId) {
      await rest.put(Routes.applicationGuildCommands(client.user.id, botConfig.guildId), {
        body: commands,
      });
      console.log(`✅ Successfully registered ${commands.length} guild command(s) to guild ${botConfig.guildId}`);
    } else {
      // Global registration (takes up to 1 hour to propagate)
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
      console.log(`✅ Successfully registered ${commands.length} global command(s)`);
    }
  } catch (error) {
    console.error('❌ Failed to register commands with Discord:', error.message);
    logger.error('error registering commands', { err: error });
  }
}

/**
 * Initialize bot
 */
async function init() {
  let canLogin = true;

  try {
    assertConfig();
  } catch (error) {
    canLogin = false;
    logger.error('bot configuration invalid; skipping Discord login', { err: error });
  }

  try {
    await initializeDatabase();
    console.log('✅ Database initialized');
  } catch (error) {
    logger.error('failed to initialize database; continuing in degraded mode', { err: error });
  }

  try {
    const ensured = await ensureGiveawayDatabaseReady();
    if (!ensured) {
      logger.warn('Giveaway database not initialized during startup; giveaway commands may be unavailable.');
    }
  } catch (error) {
    logger.warn('Failed to initialize giveaway database during startup', { err: error });
  }

  try {
    await loadCommands();
  } catch (error) {
    logger.error('failed to load command modules during startup', { err: error });
  }

  try {
    await loadEvents();
  } catch (error) {
    logger.error('failed to load event handlers during startup', { err: error });
  }

  if (canLogin) {
    try {
      await client.login(botConfig.token);
    } catch (error) {
      logger.error('failed to authenticate with Discord', { err: error });
    }
  } else {
    logger.warn('Discord login skipped because configuration is invalid.');
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
    if (giveawayUnavailableReason) {
      logger.warn('Giveaway system not initialized; related commands will be unavailable.', {
        reason: giveawayUnavailableReason,
      });
    } else {
      logger.warn('Giveaway system not initialized; related commands will be unavailable.');
    }
  } else if (giveawayModuleSource) {
    logger.info('Giveaway system initialized', { source: giveawayModuleSource });
  } else {
    logger.info('Giveaway system initialized');
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
        // [FIX]: Reply to user so they know command doesn't exist
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ Unknown command. The bot may have been recently updated.',
            flags: MessageFlags.Ephemeral,
          });
        }
        return;
      }

      try {
        await command.execute(interaction, client);
      } catch (error) {
        // [FIX]: Print full error details directly to console for debugging
        console.error('═══════════════════════════════════════════════════');
        console.error(`COMMAND EXECUTION ERROR: /${interaction.commandName}`);
        console.error('User:', interaction.user?.tag, `(${interaction.user?.id})`);
        console.error('Guild:', interaction.guild?.name, `(${interaction.guild?.id})`);
        console.error('Error:', error);
        console.error('Stack:', error.stack);
        console.error('═══════════════════════════════════════════════════');
        
        // Also use structured logger
        logger.error(`error executing command ${interaction.commandName}`, {
          err: error,
          command: interaction.commandName,
          userId: interaction.user?.id,
          guildId: interaction.guild?.id,
        });

        const errorMessage = {
          content: '❌ There was an error executing this command!',
          flags: MessageFlags.Ephemeral,
        };

        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
          } else {
            await interaction.reply(errorMessage);
          }
        } catch (replyError) {
          console.error('Failed to send error message to user:', replyError);
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
    // [FIX]: Print full error details for top-level interaction errors
    console.error('═══════════════════════════════════════════════════');
    console.error('TOP-LEVEL INTERACTION ERROR');
    console.error('Type:', interaction.type);
    console.error('Command/CustomId:', interaction.commandName || interaction.customId);
    console.error('User:', interaction.user?.tag, `(${interaction.user?.id})`);
    console.error('Error:', err);
    console.error('Stack:', err.stack);
    console.error('═══════════════════════════════════════════════════');
    
    logger.error('interaction error', {
      err,
      type: interaction.type,
      id: interaction.id,
      user: interaction.user?.id,
      commandName: interaction.commandName,
      customId: interaction.customId,
    });

    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          ephemeral: true,
          content: 'Something went wrong. Try again.',
        });
      }
    } catch (replyError) {
      console.error('Failed to send error reply:', replyError);
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
  // [FIX]: Print full error to console before logging
  console.error('═══════════════════════════════════════════════════');
  console.error('UNCAUGHT EXCEPTION');
  console.error('Origin:', origin);
  console.error('Error:', error);
  console.error('Stack:', error.stack);
  console.error('═══════════════════════════════════════════════════');
  
  logger.error('uncaught exception', {
    err: error,
    origin,
  });
  
  // Don't exit immediately - log and continue
  // In production, you may want to gracefully shutdown
});

process.on('unhandledRejection', (reason, promise) => {
  // [FIX]: Print full error to console before logging
  const error = reason instanceof Error ? reason : new Error(String(reason));
  console.error('═══════════════════════════════════════════════════');
  console.error('UNHANDLED PROMISE REJECTION');
  console.error('Reason:', reason);
  console.error('Stack:', error.stack);
  console.error('═══════════════════════════════════════════════════');
  
  logger.error('unhandled rejection', {
    err: error,
    promiseState: promise && typeof promise === 'object' ? promise.constructor?.name : undefined,
  });
});

// Start the bot with validation
(async () => {
  try {
    await networkServerPromise;
    logger.info('network server confirmed listening before bot initialization');

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
    logger.error('fatal startup error during bot bootstrap', { err: error });
  }
})();

export default client;
