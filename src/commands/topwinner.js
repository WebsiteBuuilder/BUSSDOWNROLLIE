import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { getTopWinner24h } from '../lib/blackjack-results.js';
import { formatVP } from '../lib/utils.js';

function ephemeral(options = {}) {
  const { flags, ...rest } = options ?? {};
  return {
    ...rest,
    flags: (flags ?? 0) | MessageFlags.Ephemeral,
  };
}

export const data = new SlashCommandBuilder()
  .setName('topwinner')
  .setDescription('Show the top blackjack winner in the last 24 hours');

export async function execute(interaction) {
  if (!interaction.guildId) {
    return interaction.reply(
      ephemeral({
        content: '❌ This command can only be used inside the server.',
      })
    );
  }

  const topWinner = getTopWinner24h(interaction.guildId);

  if (!topWinner) {
    return interaction.reply({ content: 'No winners in the last 24 hours yet.' });
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🏆 24h Blackjack Leader')
    .setDescription(`Top Winner (24h): <@${topWinner.userId}> with +${formatVP(topWinner.net)}`)
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}
