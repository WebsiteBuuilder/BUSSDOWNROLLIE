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
        content: '❌ You are blacklisted and cannot claim daily VP.',
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
          content: `⏰ You can claim your daily VP again in **${hoursRemaining}h ${minutesRemaining}m**.`,
        });
      }
    }

    // Get RNG chance from config
    const chanceStr = await getConfig('daily_rng_chance', '0.10');
    const parsedBaseChance = parseFloat(chanceStr);
    const baseChance = Number.isFinite(parsedBaseChance) ? parsedBaseChance : 0.1;
    const modifier = Number.isFinite(user.dailyChanceModifier) ? user.dailyChanceModifier : 0;
    const finalChance = Math.min(Math.max(baseChance + modifier, 0), 1);

    // Roll RNG
    const roll = Math.random();
    const success = roll < finalChance;

    // Get daily amount from config
    const amountStr = await getConfig('daily_amount', '1');
    const amount = parseInt(amountStr);

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastDailyAt: new Date(),
        ...(success && { vp: { increment: amount } }),
      },
    });

    // Create embed
    const embed = new EmbedBuilder().setTimestamp();

    const oddsFields = [
      { name: 'Final Odds', value: `${(finalChance * 100).toFixed(2)}%`, inline: true },
      { name: 'Base Odds', value: `${(baseChance * 100).toFixed(2)}%`, inline: true },
    ];

    if (modifier !== 0) {
      oddsFields.push({
        name: 'Modifier',
        value: `${modifier >= 0 ? '+' : ''}${(modifier * 100).toFixed(2)}%`,
        inline: true,
      });
    }

    if (success) {
      embed
        .setColor(0x00ff00)
        .setTitle('🎉 Daily Claim Success!')
        .setDescription(`You won **${formatVP(amount)}**!`)
        .addFields(...oddsFields, { name: 'New Balance', value: formatVP(updatedUser.vp), inline: true });
    } else {
      embed
        .setColor(0xff9900)
        .setTitle('😔 Daily Claim Failed')
        .setDescription('Better luck next time!')
        .addFields(...oddsFields, { name: 'Current Balance', value: formatVP(updatedUser.vp), inline: true });
    }

    await interaction.editReply({ embeds: [embed] });

    // Log transaction
    if (success) {
      await logTransaction('daily', {
        userId: interaction.user.id,
        amount,
        success: true,
      });
    }
  } catch (error) {
    console.error('Error in daily command:', error);
    await interaction.editReply({
      content: '❌ Failed to claim daily VP. Please try again.',
    });
  }
}
