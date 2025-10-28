import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getGiveawayService, getGiveawayScheduler } from '../giveaway/router.js';
import { getDailyModifiers, addDailyModifier } from '../giveaway/db.js';
import { buildDailyEmbed } from '../giveaway/ui.js';

const BASE_DAILY_POT = 50;

function getTodayDateString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

export const data = new SlashCommandBuilder()
  .setName('daily-giveaway')
  .setDescription('📅 Daily community giveaway system')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('start')
      .setDescription('Start the daily giveaway (Admin only)')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('boost-pot')
      .setDescription('Add VP to today\'s daily pot (Admin only)')
      .addIntegerOption((option) =>
        option
          .setName('amount')
          .setDescription('Amount of VP to add to the pot')
          .setRequired(true)
          .setMinValue(1)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('boost-multiplier')
      .setDescription('Set a multiplier for today\'s daily pot (Admin only)')
      .addNumberOption((option) =>
        option
          .setName('multiplier')
          .setDescription('Multiplier value (e.g., 2 for 2x, 3 for 3x)')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(10)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('status')
      .setDescription('View today\'s daily giveaway status and boosts')
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'status') {
    const today = getTodayDateString();
    const modifiers = getDailyModifiers(today);
    
    let basePot = BASE_DAILY_POT;
    let multiplier = 1;
    
    for (const mod of modifiers) {
      if (mod.modifierType === 'pot_boost') {
        basePot += mod.value;
      } else if (mod.modifierType === 'multiplier') {
        multiplier = Math.max(multiplier, mod.value);
      }
    }
    
    const finalPot = Math.floor(basePot * multiplier);
    const embed = buildDailyEmbed(BASE_DAILY_POT, modifiers, finalPot);
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // Admin-only commands
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      content: '❌ You need Manage Server permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  if (subcommand === 'boost-pot') {
    const amount = interaction.options.getInteger('amount', true);
    const today = getTodayDateString();
    
    addDailyModifier(today, 'pot_boost', amount, interaction.user.id);
    
    await interaction.reply({
      content: `✅ Added **${amount} VP** to today's daily pot!`,
      ephemeral: true,
    });
    return;
  }

  if (subcommand === 'boost-multiplier') {
    const multiplier = interaction.options.getNumber('multiplier', true);
    const today = getTodayDateString();
    
    addDailyModifier(today, 'multiplier', multiplier, interaction.user.id);
    
    await interaction.reply({
      content: `✅ Set **${multiplier}x** multiplier for today's daily pot!`,
      ephemeral: true,
    });
    return;
  }

  if (subcommand === 'start') {
    const service = getGiveawayService();
    const scheduler = getGiveawayScheduler();

    // Check if there's already an active giveaway in this channel
    if (service.hasActiveInChannel(interaction.channelId)) {
      await interaction.reply({
        content: '❌ There is already an active giveaway in this channel.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const today = getTodayDateString();
      const modifiers = getDailyModifiers(today);
      
      let basePot = BASE_DAILY_POT;
      let multiplier = 1;
      
      for (const mod of modifiers) {
        if (mod.modifierType === 'pot_boost') {
          basePot += mod.value;
        } else if (mod.modifierType === 'multiplier') {
          multiplier = Math.max(multiplier, mod.value);
        }
      }
      
      const finalPot = Math.floor(basePot * multiplier);
      
      let description =
        `🌅 **Today's Daily Giveaway**\n\n` +
        `Base pot: ${BASE_DAILY_POT} VP\n`;
      
      if (modifiers.length > 0) {
        description += `\n⚡ **Active Boosts:**\n`;
        for (const mod of modifiers) {
          if (mod.modifierType === 'pot_boost') {
            description += `• +${mod.value} VP bonus\n`;
          } else if (mod.modifierType === 'multiplier') {
            description += `• ${mod.value}x multiplier\n`;
          }
        }
      }
      
      description += `\n💰 **Final Pot: ${finalPot} VP**`;

      const giveaway = await service.createGiveaway({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        hostId: interaction.user.id,
        title: '📅 DAILY GIVEAWAY',
        description,
        buyInCost: 1,
        hostCut: 0,
        maxEntriesPerUser: 5,
        durationMs: 60 * 60 * 1000, // 1 hour
        type: 'daily',
      });

      // Schedule the end
      scheduler.scheduleNew(giveaway.id, giveaway.endAt);

      const messageLink = giveaway.messageId
        ? `https://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}/${giveaway.messageId}`
        : null;

      await interaction.editReply({
        content:
          `🎉 **DAILY GIVEAWAY STARTED!**\n\n` +
          `💰 Pot: **${finalPot} VP**\n` +
          `🎫 Entry cost: **1 VP**\n` +
          `⏰ Duration: **1 hour**\n\n` +
          (messageLink ? `[Jump to giveaway](${messageLink})` : 'Check the channel above!'),
      });
    } catch (error) {
      console.error('Error creating daily giveaway:', error);
      await interaction.editReply({
        content: `❌ ${error.message || 'Failed to create daily giveaway'}`,
      });
    }
  }
}

