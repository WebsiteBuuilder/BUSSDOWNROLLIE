import { Client, Collection, Events, GatewayIntentBits, MessageFlags, REST, Routes } from 'discord.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';
import prisma, { initializeDatabase } from './db/index.js';
import { initLogger } from './lib/logger.js';
import { handleBattleComponent, handleBattleSelect, isBattleInteraction } from './commands/battle.js';
import { handleBlackjackInteraction } from './commands/blackjack.js';
import { handleRouletteButton } from './commands/roulette.js';
import { handleApproveVouchButton } from './commands/approvevouch.js';
import { config as botConfig, assertConfig } from './config.js';
import { logger } from './logger.js';
import {
  handleGiveawayButton,
  initGiveaways,
  isGiveawayButton,
} from './features/giveaways/router.js';
import { runStartupValidation } from './utils/startup-validator.js';
import { getAnimationStatus } from './roulette/safe-animation.js';

// ES modules dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    const command = await import(`file://${filePath}`);

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
  initGiveaways(client);

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

    if (interaction.isButton()) {
      if (isBattleInteraction(interaction.customId)) {
        const handled = await handleBattleComponent(interaction);
        if (handled) {
          return;
        }
      }

      const customId = interaction.customId ?? '';

      if (isGiveawayButton(customId)) {
        await handleGiveawayButton(interaction);
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
    
    // Check animation status
    const animStatus = await getAnimationStatus();
    console.log(`🎨 Roulette Animation Mode: ${animStatus.mode}`);
    if (animStatus.fallback) {
      console.log('⚠️  Running in fallback mode - cinematic animations disabled');
    }
    
    // Initialize bot
    await init();
  } catch (error) {
    console.error('❌ Fatal startup error:', error);
    process.exit(1);
  }
})();

export default client;
