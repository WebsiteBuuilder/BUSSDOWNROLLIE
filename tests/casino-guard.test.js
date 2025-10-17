import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChannelType, MessageFlags } from 'discord.js';

import { ensureCasinoChannel } from '../src/lib/casino-guard.js';

function createMockInteraction({
  channelId,
  guildId = 'guild-1',
  isThread = false,
  parentId = null,
}) {
  const reply = vi.fn(async () => {
    interaction.replied = true;
  });

  const followUp = vi.fn(async () => {});

  const interaction = {
    id: 'interaction-1',
    guildId,
    channelId,
    user: { id: 'user-1' },
    replied: false,
    deferred: false,
    reply,
    followUp,
    client: {
      channels: {
        fetch: vi.fn(),
      },
    },
  };

  if (guildId) {
    interaction.channel = isThread
      ? {
          id: `${channelId}-thread`,
          parentId: parentId ?? channelId,
          isThread: () => true,
          type: ChannelType.PublicThread,
        }
      : {
          id: channelId,
          type: ChannelType.GuildText,
        };
  }

  return interaction;
}

describe('ensureCasinoChannel', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows commands in the configured casino channel', async () => {
    const interaction = createMockInteraction({ channelId: process.env.CASINO_CHANNEL_ID });

    const result = await ensureCasinoChannel(interaction);

    expect(result.ok).toBe(true);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('rejects commands in other channels with an ephemeral reply', async () => {
    const interaction = createMockInteraction({ channelId: '123456789' });

    const result = await ensureCasinoChannel(interaction);

    expect(result.ok).toBe(false);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        flags: MessageFlags.Ephemeral,
      })
    );
  });

  it('rejects direct messages', async () => {
    const interaction = createMockInteraction({ channelId: '123456789', guildId: null });

    const result = await ensureCasinoChannel(interaction);

    expect(result.ok).toBe(false);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        flags: MessageFlags.Ephemeral,
      })
    );
  });

  it('allows commands when CASINO_CHANNEL_ID is provided with different casing', async () => {
    const originalValue = process.env.CASINO_CHANNEL_ID;
    delete process.env.CASINO_CHANNEL_ID;
    process.env.casino_channel_id = originalValue;

    try {
      const interaction = createMockInteraction({ channelId: originalValue });

      const result = await ensureCasinoChannel(interaction);

      expect(result.ok).toBe(true);
    } finally {
      delete process.env.casino_channel_id;
      process.env.CASINO_CHANNEL_ID = originalValue;
    }
  });

  it('allows threads under the casino channel', async () => {
    const interaction = createMockInteraction({
      channelId: 'thread-channel',
      isThread: true,
      parentId: process.env.CASINO_CHANNEL_ID,
    });

    const result = await ensureCasinoChannel(interaction);

    expect(result.ok).toBe(true);
    expect(result.isThread).toBe(true);
  });
});
