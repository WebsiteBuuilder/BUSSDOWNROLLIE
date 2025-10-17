import { Client, Collection, GatewayIntentBits, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';
import prisma, { initializeDatabase } from './db/index.js';
import { initLogger } from './lib/logger.js';
import { handleBattleInteraction } from './commands/battle.js';
import { handleBlackjackInteraction } from './commands/blackjack.js';

// Load environment variables
config();

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
  const commandFiles = readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

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

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);

  try {
    console.log(`🔄 Registering ${commands.length} slash commands...`);

    // Guild-specific registration (faster for development)
    if (process.env.GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID), {
        body: commands,
      });
      console.log('✅ Successfully registered guild commands');
    } else {
      // Global registration (takes up to 1 hour to propagate)
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
      console.log('✅ Successfully registered global commands');
    }
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
}

/**
 * Initialize bot
 */
async function init() {
  try {
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database initialized');

    // Load commands and events
    await loadCommands();
    await loadEvents();

    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error('❌ Failed to initialize bot:', error);
    process.exit(1);
  }
}

// Handle bot ready event
client.once('ready', async () => {
  console.log(`🚀 Bot is online as ${client.user.tag}`);

  // Register commands
  await registerCommands();

  // Initialize logger
  if (process.env.LOG_CHANNEL_ID) {
    try {
      const logChannel = await client.channels.fetch(process.env.LOG_CHANNEL_ID);
      initLogger(logChannel);
      console.log('✅ Logger initialized');
    } catch (error) {
      console.warn('⚠️  Could not initialize logger:', error.message);
    }
  }

  console.log('✅ GUHD EATS bot is ready!');
});

// Handle interaction events (slash commands and buttons)
client.on('interactionCreate', async (interaction) => {
  // Handle slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(`Error executing ${interaction.commandName}:`, error);

      const errorMessage = {
        content: '❌ There was an error executing this command!',
        ephemeral: true,
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
    const customId = interaction.customId ?? '';

    if (customId.startsWith('bj_')) {
      try {
        await handleBlackjackInteraction(interaction);
      } catch (error) {
        console.error('Error handling blackjack interaction:', error);
      }
      return;
    }

    const battlePrefixes = ['battle_', 'rps_', 'hilow_', 'reaction_'];

    if (battlePrefixes.some((prefix) => customId.startsWith(prefix))) {
      try {
        await handleBattleInteraction(interaction);
      } catch (error) {
        console.error('Error handling battle interaction:', error);
      }
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
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

// Start the bot
init();

export default client;
