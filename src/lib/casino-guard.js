import { ChannelType, MessageFlags } from 'discord.js';

import { logBlackjackEvent } from './blackjack-telemetry.js';
import { getEnvVar } from './env.js';

function findCachedCasinoChannel(interaction) {
  const guild = interaction.guild ?? interaction.client?.guilds?.cache?.get(interaction.guildId ?? '');

  if (!guild) {
    return null;
  }

  return (
    guild.channels.cache.find((channel) => {
      if (!channel || typeof channel.name !== 'string') {
        return false;
      }

      return channel.name.toLowerCase().includes('casino');
    }) ?? null
  );
}

async function respondEphemeral(interaction, message) {
  const basePayload = typeof message === 'string' ? { content: message } : message;
  const { ephemeral, flags, ...rest } = basePayload ?? {};
  const payload = {
    ...rest,
    flags: (flags ?? 0) | MessageFlags.Ephemeral,
  };

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
  let casinoChannelId = getEnvVar('CASINO_CHANNEL_ID');
  const baseLog = {
    userId: interaction.user?.id,
    guildId: interaction.guildId ?? null,
    channelId: interaction.channelId ?? null,
    casinoChannelId: casinoChannelId ?? null,
  };

  logBlackjackEvent('guard.start', baseLog);

  if (!casinoChannelId) {
    const fallbackChannel = findCachedCasinoChannel(interaction);

    if (fallbackChannel) {
      casinoChannelId = fallbackChannel.id;
      logBlackjackEvent('guard.fallback.detected', {
        ...baseLog,
        casinoChannelId,
        fallbackChannelId: fallbackChannel.id,
      });
    } else {
      logBlackjackEvent('guard.error.missing_env', baseLog);
      await respondEphemeral(
        interaction,
        '❌ CASINO_CHANNEL_ID is not configured, and I could not auto-detect a casino channel. Please create one or set the variable before playing.'
      );
      return { ok: false };
    }
  }

  const resolvedLog = {
    ...baseLog,
    casinoChannelId,
  };

  if (!interaction.guildId) {
    logBlackjackEvent('guard.error.dm_context', resolvedLog);
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
        ...resolvedLog,
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
      ...resolvedLog,
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
      ...resolvedLog,
      ...metadata,
    });
    await respondEphemeral(interaction, `❌ Please use this command in <#${casinoChannelId}>.`);
    return { ok: false };
  }

  logBlackjackEvent('guard.success', {
    ...resolvedLog,
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

  const envCasinoChannelId = getEnvVar('CASINO_CHANNEL_ID');
  const fallbackChannel = envCasinoChannelId ? null : findCachedCasinoChannel(interaction);
  const casinoChannelId = envCasinoChannelId ?? fallbackChannel?.id ?? null;

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
