import { Client, TextBasedChannel } from 'discord.js';
import { logAudit } from './db.js';
import { logger } from '../../logger.js';

interface AuditMeta {
  [key: string]: unknown;
}

export class GiveawayAuditService {
  private logChannelId: string | null;
  private logChannel: TextBasedChannel | null = null;

  constructor(private readonly client: Client) {
    this.logChannelId = process.env.GIVEAWAY_LOG_CHANNEL_ID ?? null;
  }

  private async ensureChannel(): Promise<TextBasedChannel | null> {
    if (!this.logChannelId) {
      return null;
    }

    if (this.logChannel) {
      return this.logChannel;
    }

    try {
      const channel = await this.client.channels.fetch(this.logChannelId);
      if (!channel?.isTextBased()) {
        logger.warn('Giveaway log channel is not text based', { channelId: this.logChannelId });
        this.logChannelId = null;
        return null;
      }
      this.logChannel = channel;
      return channel;
    } catch (error) {
      logger.error('Failed to fetch giveaway log channel', { err: error });
      this.logChannelId = null;
      return null;
    }
  }

  async log(giveawayId: string, actorId: string | null, action: string, meta: AuditMeta): Promise<void> {
    logAudit(giveawayId, actorId, action, meta);
    logger.info('giveaway event', { giveawayId, actorId, action, meta });

    const channel = await this.ensureChannel();
    if (!channel) {
      return;
    }

    const summary = Object.entries(meta)
      .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
      .join(' • ');

    await channel.send({
      content: `**[Giveaway]** ${action} — ${summary || 'no meta'}${actorId ? ` (actor: <@${actorId}>)` : ''}`,
    });
  }
}
