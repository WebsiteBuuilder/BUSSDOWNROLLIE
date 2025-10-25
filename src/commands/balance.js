import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { getOrCreateUser } from '../db/index.js';
import { formatVP } from '../lib/utils.js';

export const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('Check VP balance')
  .addUserOption((option) =>
    option
      .setName('user')
      .setDescription('User to check balance for (leave empty for yourself)')
      .setRequired(false)
  );

export async function execute(interaction) {
  const targetUser = interaction.options.getUser('user') || interaction.user;

  try {
    const user = await getOrCreateUser(targetUser.id);

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('💰 VP Balance')
      .setDescription(`**${targetUser.username}** has **${formatVP(user.vp)}**`)
      .setThumbnail(targetUser.displayAvatarURL())
      .setTimestamp();

    if (user.streakDays > 0) {
      embed.addFields({
        name: '🔥 Daily Streak',
        value: `${user.streakDays} day${user.streakDays !== 1 ? 's' : ''}`,
        inline: true,
      });
    }

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in balance command:', error);
    await interaction.reply({
      content: '❌ Failed to fetch balance. Please try again.',
      flags: MessageFlags.Ephemeral,
    });
  }
}
