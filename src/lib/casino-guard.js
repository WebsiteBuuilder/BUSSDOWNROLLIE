import { ChannelType } from 'discord.js';

import { logBlackjackEvent } from './blackjack-telemetry.js';
import { getEnvVar } from './env.js';

async function respondEphemeral(interaction, message) {
  const payload = typeof message === 'string' ? { content: message, ephemeral: true } : message;

  if (interaction.replied || interaction.deferred) {
    try {
      return await interaction.followUp(payload);
    } catch (error) {
      logBlackjackEvent('guard.follow_up_error', {
        error: error.message,
        interactionId: interaction.id,
      });
    }
    return null;
  }

  try {
    return await interaction.reply(payload);
  } catch (error) {
    logBlackjackEvent('guard.reply_error', {
      error: error.message,
      interactionId: interaction.id,
    });
  }

  return null;
}

function resolveChannelMetadata(channel) {
  if (!channel) {
    return { isThread: false, resolvedChannelId: null, parentId: null };
  }

  const isThread =
    typeof channel.isThread === 'function'
      ? channel.isThread()
      : [
          ChannelType.PublicThread,
          ChannelType.PrivateThread,
          ChannelType.AnnouncementThread,
        ].includes(channel.type);

  if (isThread) {
    return {
      isThread: true,
      resolvedChannelId: channel.parentId ?? null,
      parentId: channel.parentId ?? null,
    };
  }

  return {
    isThread: false,
    resolvedChannelId: channel.id ?? null,
    parentId: null,
  };
}

export async function ensureCasinoChannel(interaction) {
  const casinoChannelId = getEnvVar('CASINO_CHANNEL_ID');
  const baseLog = {
    userId: interaction.user?.id,
    guildId: interaction.guildId ?? null,
    channelId: interaction.channelId ?? null,
    casinoChannelId,
  };

  logBlackjackEvent('guard.start', baseLog);

  if (!casinoChannelId) {
    logBlackjackEvent('guard.error.missing_env', baseLog);
    await respondEphemeral(
      interaction,
      '❌ CASINO_CHANNEL_ID is not configured. Please tell an admin to set it before playing.'
    );
    return { ok: false };
  }

  if (!interaction.guildId) {
    logBlackjackEvent('guard.error.dm_context', baseLog);
    await respondEphemeral(
      interaction,
      `❌ Blackjack is only available inside the server. Please use this command in <#${casinoChannelId}>.`
    );
    return { ok: false };
  }

  let channel = interaction.channel ?? null;

  if (!channel) {
    try {
      channel = await interaction.client.channels.fetch(interaction.channelId);
    } catch (error) {
      logBlackjackEvent('guard.error.fetch_failed', {
        ...baseLog,
        error: error.message,
      });
      await respondEphemeral(
        interaction,
        '❌ I could not determine which channel you are in. Please try again in the casino channel.'
      );
      return { ok: false };
    }
  }

  const metadata = resolveChannelMetadata(channel);

  if (!metadata.resolvedChannelId) {
    logBlackjackEvent('guard.error.no_channel', {
      ...baseLog,
      ...metadata,
    });
    await respondEphemeral(
      interaction,
      '❌ I could not determine a valid channel for blackjack. Please try again.'
    );
    return { ok: false };
  }

  if (metadata.resolvedChannelId !== casinoChannelId) {
    logBlackjackEvent('guard.error.wrong_channel', {
      ...baseLog,
      ...metadata,
    });
    await respondEphemeral(interaction, `❌ Please use this command in <#${casinoChannelId}>.`);
    return { ok: false };
  }

  logBlackjackEvent('guard.success', {
    ...baseLog,
    ...metadata,
  });

  return {
    ok: true,
    channel,
    ...metadata,
  };
}

export async function ensureCasinoButtonContext(interaction) {
  if (!interaction.guildId) {
    await respondEphemeral(
      interaction,
      '❌ Blackjack buttons are only available inside the server. This interaction has been cancelled.'
    );
    return { ok: false };
  }

  const channel = interaction.channel ?? null;
  const metadata = resolveChannelMetadata(channel);

  const casinoChannelId = getEnvVar('CASINO_CHANNEL_ID');

  if (!metadata.resolvedChannelId || !casinoChannelId) {
    await respondEphemeral(
      interaction,
      '❌ Blackjack controls are unavailable right now. Please start a new game in the casino channel.'
    );
    return { ok: false };
  }

  if (metadata.resolvedChannelId !== casinoChannelId) {
    await respondEphemeral(
      interaction,
      `❌ These controls only work in <#${casinoChannelId}>.`
    );
    return { ok: false };
  }

  return {
    ok: true,
    channel,
    ...metadata,
  };
}
