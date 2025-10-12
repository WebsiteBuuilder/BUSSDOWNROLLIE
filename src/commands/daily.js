import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import prisma, { getOrCreateUser, getConfig } from '../db/index.js';
import { formatVP } from '../lib/utils.js';
import { logTransaction } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your random daily VP (24h cooldown)');

export async function execute(interaction) {
  try {
    await interaction.deferReply();

    const user = await getOrCreateUser(interaction.user.id);

    // Check if user is blacklisted
    if (user.blacklisted) {
      return interaction.editReply({
        content: '❌ You are blacklisted and cannot claim daily VP.'
      });
    }

    // Check cooldown
    if (user.lastDailyAt) {
      const now = new Date();
      const lastDaily = new Date(user.lastDailyAt);
      const timeSinceLastDaily = now - lastDaily;
      const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours

      if (timeSinceLastDaily < cooldownMs) {
        const timeRemaining = cooldownMs - timeSinceLastDaily;
        const hoursRemaining = Math.floor(timeRemaining / (60 * 60 * 1000));
        const minutesRemaining = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));

        return interaction.editReply({
          content: `⏰ You can claim your daily VP again in **${hoursRemaining}h ${minutesRemaining}m**.`
        });
      }
    }

    // Get RNG chance from config
    const chanceStr = await getConfig('daily_rng_chance', '0.35');
    const chance = parseFloat(chanceStr);

    // Roll RNG
    const roll = Math.random();
    const success = roll < chance;

    // Get daily amount from config
    const amountStr = await getConfig('daily_amount', '1');
    const amount = parseInt(amountStr);

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastDailyAt: new Date(),
        ...(success && { vp: { increment: amount } })
      }
    });

    // Create embed
    const embed = new EmbedBuilder()
      .setTimestamp();

    if (success) {
      embed
        .setColor(0x00FF00)
        .setTitle('🎉 Daily Claim Success!')
        .setDescription(`You won **${formatVP(amount)}**!`)
        .addFields(
          { name: 'Odds', value: `${(chance * 100).toFixed(0)}%`, inline: true },
          { name: 'New Balance', value: formatVP(updatedUser.vp), inline: true }
        );
    } else {
      embed
        .setColor(0xFF9900)
        .setTitle('😔 Daily Claim Failed')
        .setDescription('Better luck next time!')
        .addFields(
          { name: 'Odds', value: `${(chance * 100).toFixed(0)}%`, inline: true },
          { name: 'Current Balance', value: formatVP(updatedUser.vp), inline: true }
        );
    }

    await interaction.editReply({ embeds: [embed] });

    // Log transaction
    if (success) {
      await logTransaction('daily', {
        userId: interaction.user.id,
        amount,
        success: true
      });
    }

  } catch (error) {
    console.error('Error in daily command:', error);
    await interaction.editReply({
      content: '❌ Failed to claim daily VP. Please try again.'
    });
  }
}

