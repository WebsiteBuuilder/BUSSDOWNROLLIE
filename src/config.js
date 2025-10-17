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
    throw new Error('Discord token is required to start the bot.');
  }
}
