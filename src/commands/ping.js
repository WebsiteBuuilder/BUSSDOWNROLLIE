import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check if the bot is responding and healthy');

export async function execute(interaction) {
  const startTime = Date.now();
  
  await interaction.reply({
    content: '🏓 Pong!',
    ephemeral: true,
  });
  
  const latency = Date.now() - startTime;
  const wsLatency = interaction.client.ws.ping;
  
  await interaction.editReply({
    content: `🏓 Pong!\n\n` +
      `**Response Time:** ${latency}ms\n` +
      `**WebSocket Ping:** ${wsLatency}ms\n` +
      `**Status:** ✅ Bot is healthy and responding`,
  });
}

