import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import prisma, { getOrCreateUser, setConfig, getConfig } from '../db/index.js';
import { formatVP, exportToCSV, memberHasProviderRole } from '../lib/utils.js';
import { logTransaction } from '../lib/logger.js';

export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Admin commands for managing VP economy')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('add')
      .setDescription('Add VP to a user')
      .addUserOption((option) =>
        option.setName('user').setDescription('User to add VP to').setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('amount')
          .setDescription('Amount of VP to add')
          .setRequired(true)
          .setMinValue(1)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('remove')
      .setDescription('Remove VP from a user')
      .addUserOption((option) =>
        option.setName('user').setDescription('User to remove VP from').setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('amount')
          .setDescription('Amount of VP to remove')
          .setRequired(true)
          .setMinValue(1)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('set')
      .setDescription("Set a user's VP balance")
      .addUserOption((option) =>
        option.setName('user').setDescription('User to set balance for').setRequired(true)
      )
      .addIntegerOption((option) =>
        option.setName('amount').setDescription('New VP balance').setRequired(true).setMinValue(0)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('blacklist')
      .setDescription('Blacklist a user from earning/using VP')
      .addUserOption((option) =>
        option.setName('user').setDescription('User to blacklist').setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('unblacklist')
      .setDescription('Remove a user from blacklist')
      .addUserOption((option) =>
        option.setName('user').setDescription('User to unblacklist').setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('config')
      .setDescription('View or update bot configuration')
      .addStringOption((option) =>
        option
          .setName('key')
          .setDescription('Configuration key')
          .setRequired(false)
          .addChoices(
            { name: 'Daily RNG Chance', value: 'daily_rng_chance' },
            { name: 'Transfer Fee %', value: 'transfer_fee_percent' },
            { name: 'Battle Rake %', value: 'battle_rake_percent' },
            { name: 'Blackjack Min', value: 'bj_min' },
            { name: 'Blackjack Max', value: 'bj_max' },
            { name: '$5 Order Cost', value: 'five_cost' },
            { name: 'Free Order Cost', value: 'free_cost' },
            { name: 'Daily Amount', value: 'daily_amount' }
          )
      )
      .addStringOption((option) =>
        option.setName('value').setDescription('New value for the configuration').setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('export').setDescription('Export all user balances as CSV')
  );

export async function execute(interaction) {
  const adminRoleId = process.env.ADMIN_ROLE_ID;

  // Check if user has admin or provider role
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const hasAdminRole = adminRoleId ? member.roles.cache.has(adminRoleId) : false;
  const hasProviderRole = memberHasProviderRole(member);

  if (!hasAdminRole && !hasProviderRole) {
    return interaction.reply({
      content: '❌ You do not have permission to use admin commands.',
      ephemeral: true,
    });
  }

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'add':
      await handleAdd(interaction);
      break;
    case 'remove':
      await handleRemove(interaction);
      break;
    case 'set':
      await handleSet(interaction);
      break;
    case 'blacklist':
      await handleBlacklist(interaction);
      break;
    case 'unblacklist':
      await handleUnblacklist(interaction);
      break;
    case 'config':
      await handleConfig(interaction);
      break;
    case 'export':
      await handleExport(interaction);
      break;
  }
}

async function handleAdd(interaction) {
  const targetUser = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');

  try {
    await interaction.deferReply();

    const user = await getOrCreateUser(targetUser.id);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { vp: { increment: amount } },
    });

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ VP Added')
      .addFields(
        { name: 'User', value: `<@${targetUser.id}>`, inline: true },
        { name: 'Amount Added', value: formatVP(amount), inline: true },
        { name: 'New Balance', value: formatVP(updated.vp), inline: true }
      )
      .setFooter({ text: `Admin: ${interaction.user.username}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // DM user
    try {
      await targetUser.send({
        embeds: [
          {
            color: 0x00ff00,
            title: '💰 VP Added',
            description: `An admin has added ${formatVP(amount)} to your balance!`,
            fields: [{ name: 'New Balance', value: formatVP(updated.vp), inline: true }],
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch (error) {
      console.log('Could not DM user:', error.message);
    }

    // Log
    await logTransaction('admin', {
      adminId: interaction.user.id,
      action: 'Add VP',
      targetUserId: targetUser.id,
      amount,
    });
  } catch (error) {
    console.error('Error in admin add:', error);
    await interaction.editReply({
      content: '❌ Failed to add VP. Please try again.',
    });
  }
}

async function handleRemove(interaction) {
  const targetUser = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');

  try {
    await interaction.deferReply();

    const user = await getOrCreateUser(targetUser.id);

    if (user.vp < amount) {
      return interaction.editReply({
        content: `❌ Cannot remove ${formatVP(amount)}. User only has ${formatVP(user.vp)}.`,
      });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { vp: { decrement: amount } },
    });

    const embed = new EmbedBuilder()
      .setColor(0xff9900)
      .setTitle('⚠️ VP Removed')
      .addFields(
        { name: 'User', value: `<@${targetUser.id}>`, inline: true },
        { name: 'Amount Removed', value: formatVP(amount), inline: true },
        { name: 'New Balance', value: formatVP(updated.vp), inline: true }
      )
      .setFooter({ text: `Admin: ${interaction.user.username}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // DM user
    try {
      await targetUser.send({
        embeds: [
          {
            color: 0xff9900,
            title: '⚠️ VP Removed',
            description: `An admin has removed ${formatVP(amount)} from your balance.`,
            fields: [{ name: 'New Balance', value: formatVP(updated.vp), inline: true }],
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch (error) {
      console.log('Could not DM user:', error.message);
    }

    // Log
    await logTransaction('admin', {
      adminId: interaction.user.id,
      action: 'Remove VP',
      targetUserId: targetUser.id,
      amount,
    });
  } catch (error) {
    console.error('Error in admin remove:', error);
    await interaction.editReply({
      content: '❌ Failed to remove VP. Please try again.',
    });
  }
}

async function handleSet(interaction) {
  const targetUser = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');

  try {
    await interaction.deferReply();

    const user = await getOrCreateUser(targetUser.id);

    await prisma.user.update({
      where: { id: user.id },
      data: { vp: amount },
    });

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ VP Balance Set')
      .addFields(
        { name: 'User', value: `<@${targetUser.id}>`, inline: true },
        { name: 'Previous Balance', value: formatVP(user.vp), inline: true },
        { name: 'New Balance', value: formatVP(amount), inline: true }
      )
      .setFooter({ text: `Admin: ${interaction.user.username}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // DM user
    try {
      await targetUser.send({
        embeds: [
          {
            color: 0x00ff00,
            title: '💰 VP Balance Updated',
            description: `An admin has set your balance to ${formatVP(amount)}.`,
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch (error) {
      console.log('Could not DM user:', error.message);
    }

    // Log
    await logTransaction('admin', {
      adminId: interaction.user.id,
      action: 'Set VP',
      targetUserId: targetUser.id,
      amount,
    });
  } catch (error) {
    console.error('Error in admin set:', error);
    await interaction.editReply({
      content: '❌ Failed to set VP. Please try again.',
    });
  }
}

async function handleBlacklist(interaction) {
  const targetUser = interaction.options.getUser('user');

  try {
    await interaction.deferReply();

    const user = await getOrCreateUser(targetUser.id);

    if (user.blacklisted) {
      return interaction.editReply({
        content: `❌ <@${targetUser.id}> is already blacklisted.`,
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { blacklisted: true },
    });

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('🚫 User Blacklisted')
      .setDescription(`<@${targetUser.id}> has been blacklisted from the VP economy.`)
      .setFooter({ text: `Admin: ${interaction.user.username}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // DM user
    try {
      await targetUser.send({
        embeds: [
          {
            color: 0xff0000,
            title: '🚫 You Have Been Blacklisted',
            description:
              'You have been blacklisted from the VP economy and can no longer earn or use VP.',
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch (error) {
      console.log('Could not DM user:', error.message);
    }

    // Log
    await logTransaction('admin', {
      adminId: interaction.user.id,
      action: 'Blacklist',
      targetUserId: targetUser.id,
    });
  } catch (error) {
    console.error('Error in admin blacklist:', error);
    await interaction.editReply({
      content: '❌ Failed to blacklist user. Please try again.',
    });
  }
}

async function handleUnblacklist(interaction) {
  const targetUser = interaction.options.getUser('user');

  try {
    await interaction.deferReply();

    const user = await getOrCreateUser(targetUser.id);

    if (!user.blacklisted) {
      return interaction.editReply({
        content: `❌ <@${targetUser.id}> is not blacklisted.`,
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { blacklisted: false },
    });

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ User Unblacklisted')
      .setDescription(`<@${targetUser.id}> has been removed from the blacklist.`)
      .setFooter({ text: `Admin: ${interaction.user.username}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // DM user
    try {
      await targetUser.send({
        embeds: [
          {
            color: 0x00ff00,
            title: '✅ You Have Been Unblacklisted',
            description:
              'You have been removed from the blacklist and can now earn and use VP again!',
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch (error) {
      console.log('Could not DM user:', error.message);
    }

    // Log
    await logTransaction('admin', {
      adminId: interaction.user.id,
      action: 'Unblacklist',
      targetUserId: targetUser.id,
    });
  } catch (error) {
    console.error('Error in admin unblacklist:', error);
    await interaction.editReply({
      content: '❌ Failed to unblacklist user. Please try again.',
    });
  }
}

async function handleConfig(interaction) {
  const key = interaction.options.getString('key');
  const value = interaction.options.getString('value');

  try {
    // View all config
    if (!key) {
      await interaction.deferReply();

      const allConfig = await prisma.config.findMany();

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('⚙️ Bot Configuration')
        .setTimestamp();

      for (const config of allConfig) {
        embed.addFields({
          name: config.key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          value: config.value,
          inline: true,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // Update config
    if (!value) {
      const currentValue = await getConfig(key);
      return interaction.reply({
        content: `Current value of **${key}**: \`${currentValue}\`\n\nTo update, provide a value: \`/admin config ${key} <new_value>\``,
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    await setConfig(key, value);

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Configuration Updated')
      .addFields(
        { name: 'Key', value: key, inline: true },
        { name: 'New Value', value: value, inline: true }
      )
      .setFooter({ text: `Admin: ${interaction.user.username}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in admin config:', error);
    await interaction.editReply({
      content: '❌ Failed to update config. Please try again.',
    });
  }
}

async function handleExport(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const users = await prisma.user.findMany({
      orderBy: { vp: 'desc' },
    });

    const csv = exportToCSV(users);

    const attachment = new AttachmentBuilder(Buffer.from(csv, 'utf-8'), {
      name: `guhd-eats-export-${Date.now()}.csv`,
    });

    await interaction.editReply({
      content: `✅ Exported ${users.length} user records.`,
      files: [attachment],
    });
  } catch (error) {
    console.error('Error in admin export:', error);
    await interaction.editReply({
      content: '❌ Failed to export data. Please try again.',
    });
  }
}
