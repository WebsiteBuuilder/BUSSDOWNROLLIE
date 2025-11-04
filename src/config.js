import { config as loadEnv } from 'dotenv';

loadEnv();

const required = ['DISCORD_TOKEN'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable ${key}`);
  }
}

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID ?? process.env.DISCORD_CLIENT_ID ?? '',
  guildId: process.env.GUILD_ID ?? '',
};

export function assertConfig() {
  if (!config.token) {
    console.error('❌ DISCORD_TOKEN is missing! Bot cannot start without a Discord token.');
    console.error('   Please set DISCORD_TOKEN in your environment variables or .env file.');
    throw new Error('Discord token is required to start the bot.');
  }
  
  if (!config.clientId) {
    console.warn('⚠️  CLIENT_ID or DISCORD_CLIENT_ID not set. Command registration may fail.');
  }
  
  console.log('✅ Discord configuration validated');
}
