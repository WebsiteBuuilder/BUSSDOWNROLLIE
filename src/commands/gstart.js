import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import {
  getGiveawayService,
  getGiveawayScheduler,
  ensureGiveawayRuntimeAvailable,
} from '../giveaway/runtime.js';

/**
 * Parse duration string like "30m", "1h30m", "2h", "1 hour 30 minutes"
 */
function parseDuration(str) {
  if (!str) {
    return null;
  }

  const normalized = str.toLowerCase().replace(/\s+/g, '');
  const pattern = /(\d+)(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)/g;

  let totalMinutes = 0;
  let matchedLength = 0;
  let match;

  while ((match = pattern.exec(normalized)) !== null) {
    const [, valueStr, unit] = match;
    const value = parseInt(valueStr, 10);

    if (Number.isNaN(value)) {
      return null;
    }

    matchedLength += match[0].length;

    if (unit.startsWith('h')) {
      totalMinutes += value * 60;
    } else {
      totalMinutes += value;
    }
  }

  if (matchedLength === 0 || matchedLength !== normalized.length || totalMinutes === 0) {
    return null;
  }

  return totalMinutes * 60 * 1000;
}

function formatDuration(durationMs) {
  const totalMinutes = Math.round(durationMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }

  if (!parts.length) {
    return '0m';
  }

  return parts.join(' ');
}

export const data = new SlashCommandBuilder()
  .setName('gstart')
  .setDescription('🎟️ Start a community giveaway (costs 1+ VP to create)')
  .addStringOption((option) =>
    option
      .setName('title')
      .setDescription('Giveaway title')
      .setRequired(false)
      .setMaxLength(100)
  )
  .addStringOption((option) =>
    option
      .setName('duration')
      .setDescription('Duration (e.g., 30m, 1h30m, 2h)')
      .setRequired(false)
  )
  .addIntegerOption((option) =>
    option
      .setName('buyin_cost')
      .setDescription('VP required to enter')
      .setRequired(false)
      .setMinValue(1)
  )
  .addIntegerOption((option) =>
    option
      .setName('host_cut')
      .setDescription('Percentage of pot you keep as host (0-50%)')
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(50)
  )
  .addIntegerOption((option) =>
    option
      .setName('max_entries')
      .setDescription('Maximum entries per user')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(100)
  )
  .addStringOption((option) =>
    option
      .setName('description')
      .setDescription('Optional description')
      .setRequired(false)
      .setMaxLength(500)
  );

const MODAL_ID = 'giveaway:gstart';
const MODAL_FIELD_IDS = {
  title: 'giveaway:gstart:title',
  description: 'giveaway:gstart:description',
  duration: 'giveaway:gstart:duration',
  buyInCost: 'giveaway:gstart:buyin',
  hostCutMaxEntries: 'giveaway:gstart:hostmax',
};

function buildGiveawayModal(prefill = {}) {
  const modal = new ModalBuilder()
    .setCustomId(MODAL_ID)
    .setTitle('🎁 Launch a Giveaway');

  const titleInput = new TextInputBuilder()
    .setCustomId(MODAL_FIELD_IDS.title)
    .setLabel('🎟️ Giveaway title')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(100)
    .setPlaceholder('e.g. VIP Dinner for Two')
    .setRequired(true);

  if (prefill.title) {
    titleInput.setValue(prefill.title);
  }

  const descriptionInput = new TextInputBuilder()
    .setCustomId(MODAL_FIELD_IDS.description)
    .setLabel('📝 Description (optional)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Tell customers what they could win!')
    .setRequired(false)
    .setMaxLength(500);

  if (prefill.description) {
    descriptionInput.setValue(prefill.description);
  }

  const durationInput = new TextInputBuilder()
    .setCustomId(MODAL_FIELD_IDS.duration)
    .setLabel('⏱️ Duration')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 30m, 1h 30m, 2 hours')
    .setRequired(true);

  if (prefill.duration) {
    durationInput.setValue(prefill.duration);
  } else {
    durationInput.setValue('30m');
  }

  const buyInInput = new TextInputBuilder()
    .setCustomId(MODAL_FIELD_IDS.buyInCost)
    .setLabel('💰 Entry cost (VP)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Minimum 1 VP')
    .setRequired(true);

  if (prefill.buyInCost != null) {
    buyInInput.setValue(String(prefill.buyInCost));
  } else {
    buyInInput.setValue('1');
  }

  const hostMaxInput = new TextInputBuilder()
    .setCustomId(MODAL_FIELD_IDS.hostCutMaxEntries)
    .setLabel('🏦 Host cut % / 🎯 Max entries per user')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 10 / 5 (0 / 5 for default)')
    .setRequired(true);

  if (prefill.hostCut != null || prefill.maxEntries != null) {
    const hostValue = prefill.hostCut != null ? prefill.hostCut : '';
    const maxValue = prefill.maxEntries != null ? prefill.maxEntries : '';
    hostMaxInput.setValue(`${hostValue}${hostValue !== '' || maxValue !== '' ? ' / ' : ''}${maxValue}`);
  } else {
    hostMaxInput.setValue('0 / 5');
  }

  return modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(descriptionInput),
    new ActionRowBuilder().addComponents(durationInput),
    new ActionRowBuilder().addComponents(buyInInput),
    new ActionRowBuilder().addComponents(hostMaxInput)
  );
}

function parseHostCutAndMaxEntries(raw) {
  const numbers = raw.match(/\d+/g);
  if (!numbers || numbers.length < 2) {
    return null;
  }

  const [hostCutRaw, maxEntriesRaw] = numbers;
  const hostCut = parseInt(hostCutRaw, 10);
  const maxEntriesPerUser = parseInt(maxEntriesRaw, 10);

  if (Number.isNaN(hostCut) || Number.isNaN(maxEntriesPerUser)) {
    return null;
  }

  return { hostCut, maxEntriesPerUser };
}

async function runCreateFlow(interaction, options) {
  const available = await ensureGiveawayRuntimeAvailable(interaction);
  if (!available) {
    return;
  }

  const service = getGiveawayService();
  const scheduler = getGiveawayScheduler();

  const title = options.title?.trim();
  const durationStr = options.duration?.trim();
  const buyInCost = options.buyInCost;
  const hostCut = options.hostCut;
  const maxEntriesPerUser = options.maxEntriesPerUser;
  const description = options.description ? options.description.trim() : null;

  if (!title) {
    await interaction.reply({
      content: '❌ Please provide a title for the giveaway.',
      ephemeral: true,
    });
    return;
  }

  if (!durationStr) {
    await interaction.reply({
      content: '❌ Please provide how long the giveaway should run (e.g. 30m, 2h).',
      ephemeral: true,
    });
    return;
  }

  if (buyInCost == null || Number.isNaN(buyInCost) || buyInCost < 1) {
    await interaction.reply({
      content: '❌ Entry cost must be a number greater than or equal to 1.',
      ephemeral: true,
    });
    return;
  }

  if (hostCut == null || Number.isNaN(hostCut) || hostCut < 0 || hostCut > 50) {
    await interaction.reply({
      content: '❌ Host cut must be a percentage between 0 and 50.',
      ephemeral: true,
    });
    return;
  }

  if (
    maxEntriesPerUser == null ||
    Number.isNaN(maxEntriesPerUser) ||
    maxEntriesPerUser < 1 ||
    maxEntriesPerUser > 100
  ) {
    await interaction.reply({
      content: '❌ Max entries must be between 1 and 100.',
      ephemeral: true,
    });
    return;
  }

  const durationMs = parseDuration(durationStr);
  if (durationMs == null) {
    await interaction.reply({
      content: '❌ Could not understand the duration. Try formats like `30m`, `1h 30m`, or `2 hours`.',
      ephemeral: true,
    });
    return;
  }

  if (durationMs < 120_000) {
    await interaction.reply({
      content: '❌ Invalid duration. Minimum is 2 minutes (2m).',
      ephemeral: true,
    });
    return;
  }

  if (durationMs > 24 * 60 * 60 * 1000) {
    await interaction.reply({
      content: '❌ Duration cannot exceed 24 hours.',
      ephemeral: true,
    });
    return;
  }

  if (service.hasActiveInChannel(interaction.channelId)) {
    await interaction.reply({
      content: '❌ There is already an active giveaway in this channel.',
      ephemeral: true,
    });
    return;
  }

  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    const giveaway = await service.createGiveaway({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      hostId: interaction.user.id,
      title,
      description: description?.length ? description : null,
      buyInCost,
      hostCut,
      maxEntriesPerUser,
      durationMs,
    });

    scheduler.scheduleNew(giveaway.id, giveaway.endAt);

    const messageLink = giveaway.messageId
      ? `https://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}/${giveaway.messageId}`
      : null;

    const displayDuration = formatDuration(durationMs);
    const endTimestamp = Math.floor(giveaway.endAt / 1000);

    const summaryEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Giveaway created!')
      .setDescription('Your giveaway is live — here are the details at a glance:')
      .addFields(
        { name: '🎟️ Title', value: title, inline: false },
        { name: '💰 Entry cost', value: `${buyInCost} VP`, inline: true },
        { name: '🏦 Host cut', value: `${hostCut}%`, inline: true },
        { name: '🎯 Max entries', value: `${maxEntriesPerUser} per user`, inline: true },
        { name: '⏱️ Duration', value: `${displayDuration}\nEnds <t:${endTimestamp}:R>`, inline: false }
      )
      .setFooter({ text: `Hosted by ${interaction.user.tag}` })
      .setTimestamp(new Date(giveaway.startAt));

    if (description) {
      summaryEmbed.addFields({ name: '📝 Description', value: description, inline: false });
    }

    const components = [];

    if (messageLink) {
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Open giveaway message')
            .setStyle(ButtonStyle.Link)
            .setURL(messageLink)
        )
      );
    }

    await interaction.editReply({
      content: '✅ Giveaway created successfully!',
      embeds: [summaryEmbed],
      components,
    });
  } catch (error) {
    console.error('Error creating giveaway:', error);

    const errorMessage = error.message || 'Failed to create giveaway';

    if (interaction.deferred) {
      await interaction.editReply({
        content: `❌ ${errorMessage}`,
      });
    } else if (!interaction.replied) {
      await interaction.reply({
        content: `❌ ${errorMessage}`,
        ephemeral: true,
      });
    }
  }
}

export const GSTART_MODAL_ID = MODAL_ID;

export async function execute(interaction) {
  const title = interaction.options.getString('title');
  const durationStr = interaction.options.getString('duration');
  const buyInCost = interaction.options.getInteger('buyin_cost');
  const hostCut = interaction.options.getInteger('host_cut');
  const maxEntriesPerUser = interaction.options.getInteger('max_entries');
  const description = interaction.options.getString('description');

  const hasAllValues =
    title != null &&
    durationStr != null &&
    buyInCost != null &&
    hostCut != null &&
    maxEntriesPerUser != null;

  if (!hasAllValues) {
    const modal = buildGiveawayModal({
      title: title ?? undefined,
      description: description ?? undefined,
      duration: durationStr ?? undefined,
      buyInCost: buyInCost ?? undefined,
      hostCut: hostCut ?? undefined,
      maxEntries: maxEntriesPerUser ?? undefined,
    });
    await interaction.showModal(modal);
    return;
  }

  await runCreateFlow(interaction, {
    title,
    duration: durationStr,
    buyInCost,
    hostCut,
    maxEntriesPerUser,
    description,
  });
}

export async function handleGstartModalSubmit(interaction) {
  const title = interaction.fields.getTextInputValue(MODAL_FIELD_IDS.title)?.trim();
  const descriptionRaw = interaction.fields
    .getTextInputValue(MODAL_FIELD_IDS.description)
    ?.trim();
  const duration = interaction.fields.getTextInputValue(MODAL_FIELD_IDS.duration)?.trim();
  const buyInRaw = interaction.fields.getTextInputValue(MODAL_FIELD_IDS.buyInCost)?.trim();
  const hostMaxRaw = interaction.fields
    .getTextInputValue(MODAL_FIELD_IDS.hostCutMaxEntries)
    ?.trim();

  if (!hostMaxRaw) {
    await interaction.reply({
      ephemeral: true,
      content: '❌ Please include both the host cut and the max entries (e.g. 10 / 5).',
    });
    return;
  }

  const parsed = parseHostCutAndMaxEntries(hostMaxRaw);
  if (!parsed) {
    await interaction.reply({
      ephemeral: true,
      content:
        '❌ Could not understand the host cut and max entries. Try a format like `10 / 5`, where the first number is your cut and the second is the per-user limit.',
    });
    return;
  }

  const buyInCost = parseInt(buyInRaw, 10);

  if (Number.isNaN(buyInCost)) {
    await interaction.reply({
      ephemeral: true,
      content: '❌ Entry cost must be a whole number (VP).',
    });
    return;
  }

  await runCreateFlow(interaction, {
    title,
    description: descriptionRaw?.length ? descriptionRaw : null,
    duration,
    buyInCost,
    hostCut: parsed.hostCut,
    maxEntriesPerUser: parsed.maxEntriesPerUser,
  });
}

