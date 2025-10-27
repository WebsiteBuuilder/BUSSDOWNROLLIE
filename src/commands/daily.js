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
    const totalChance = Math.max(baseChance + modifier, 0);

    // Calculate guaranteed VP and leftover probability
    // e.g., 2.35 = 2 guaranteed VP + 35% chance for 3rd VP
    const guaranteedMultiplier = Math.floor(totalChance);
    const leftoverChance = totalChance - guaranteedMultiplier;

    // Roll for the leftover probability
    const roll = Math.random();
    const bonusSuccess = roll < leftoverChance;

    // Total VP earned
    const vpMultiplier = guaranteedMultiplier + (bonusSuccess ? 1 : 0);
    const success = vpMultiplier > 0;

    // Get daily amount from config
    const amountStr = await getConfig('daily_amount', '1');
    const baseAmount = parseInt(amountStr);
    const totalAmount = baseAmount * vpMultiplier;

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastDailyAt: new Date(),
        ...(success && { vp: { increment: totalAmount } }),
      },
    });

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(success ? 0x00ff00 : 0xff0000)
      .setTitle(success ? '✅ Daily VP Claimed!' : '❌ Daily Claim Failed')
      .setDescription(
        success
          ? `You received **${totalAmount} VP**!\n\n` +
            (guaranteedMultiplier > 0 
              ? `🎯 Guaranteed: **${guaranteedMultiplier}x** (${baseAmount * guaranteedMultiplier} VP)\n`
              : '') +
            (bonusSuccess && leftoverChance > 0
              ? `🎲 Bonus roll: **Success!** (+${baseAmount} VP)\n`
              : leftoverChance > 0 && !bonusSuccess
              ? `🎲 Bonus roll: **Failed** (${(leftoverChance * 100).toFixed(1)}% chance)\n`
              : '') +
            `💰 New balance: **${updatedUser.vp} VP**`
          : `Better luck tomorrow! Your daily chance is ${(totalChance * 100).toFixed(1)}%.`
      )
      .addFields(
        {
          name: '📊 Current Chance',
          value: `${(totalChance * 100).toFixed(1)}%`,
          inline: true,
        },
        {
          name: '🎁 Base Reward',
          value: `${baseAmount} VP`,
          inline: true,
        },
        success && guaranteedMultiplier > 1 ? {
          name: '⚡ Multiplier',
          value: `${vpMultiplier}x`,
          inline: true,
        } : { name: '\u200b', value: '\u200b', inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Log transaction
    if (success) {
      await logTransaction('daily', {
        userId: interaction.user.id,
        amount: totalAmount,
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
