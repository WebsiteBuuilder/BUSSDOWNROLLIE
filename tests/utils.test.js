import { describe, it, expect } from 'vitest';
import {
  formatVP,
  parseMessageLink,
  calculateTransferFee,
  calculateBattleRake,
  randomInt,
  getMedalEmoji,
  exportToCSV,
  hasImageAttachment,
  getFirstImageUrl
} from '../src/lib/utils.js';

describe('Utility Functions', () => {
  describe('formatVP', () => {
    it('should format VP with emoji', () => {
      expect(formatVP(100)).toBe('100 VP 💰');
      expect(formatVP(0)).toBe('0 VP 💰');
      expect(formatVP(1)).toBe('1 VP 💰');
    });
  });

  describe('parseMessageLink', () => {
    it('should parse valid Discord message link', () => {
      const link = 'https://discord.com/channels/123456789/987654321/111222333';
      const result = parseMessageLink(link);
      
      expect(result).toEqual({
        guildId: '123456789',
        channelId: '987654321',
        messageId: '111222333'
      });
    });

    it('should return null for invalid link', () => {
      expect(parseMessageLink('invalid')).toBeNull();
      expect(parseMessageLink('https://example.com')).toBeNull();
    });
  });

  describe('calculateTransferFee', () => {
    it('should calculate correct fee percentage', () => {
      expect(calculateTransferFee(100, 5)).toBe(5);
      expect(calculateTransferFee(200, 5)).toBe(10);
      expect(calculateTransferFee(50, 10)).toBe(5);
    });

    it('should enforce minimum 1 VP fee', () => {
      expect(calculateTransferFee(10, 5)).toBe(1);
      expect(calculateTransferFee(5, 5)).toBe(1);
      expect(calculateTransferFee(1, 5)).toBe(1);
    });

    it('should allow zero fee when percentage is zero or negative', () => {
      expect(calculateTransferFee(100, 0)).toBe(0);
      expect(calculateTransferFee(100, -5)).toBe(0);
    });
  });

  describe('calculateBattleRake', () => {
    it('should calculate correct rake from total pot', () => {
      expect(calculateBattleRake(100, 2)).toBe(4); // 2% of 200
      expect(calculateBattleRake(50, 2)).toBe(2); // 2% of 100
      expect(calculateBattleRake(25, 5)).toBe(2); // 5% of 50
    });
  });

  describe('randomInt', () => {
    it('should generate number within range', () => {
      for (let i = 0; i < 100; i++) {
        const num = randomInt(1, 10);
        expect(num).toBeGreaterThanOrEqual(1);
        expect(num).toBeLessThanOrEqual(10);
      }
    });

    it('should handle single number range', () => {
      expect(randomInt(5, 5)).toBe(5);
    });
  });

  describe('getMedalEmoji', () => {
    it('should return correct medal for top 3', () => {
      expect(getMedalEmoji(1)).toBe('🥇');
      expect(getMedalEmoji(2)).toBe('🥈');
      expect(getMedalEmoji(3)).toBe('🥉');
    });

    it('should return empty string for rank > 3', () => {
      expect(getMedalEmoji(4)).toBe('');
      expect(getMedalEmoji(10)).toBe('');
    });
  });

  describe('exportToCSV', () => {
    it('should export users to CSV format', () => {
      const users = [
        { discordId: '123', vp: 100, streakDays: 5, blacklisted: false, createdAt: new Date('2024-01-01') },
        { discordId: '456', vp: 50, streakDays: 0, blacklisted: true, createdAt: new Date('2024-01-02') }
      ];

      const csv = exportToCSV(users);

      expect(csv).toContain('Discord ID,VP Balance,Streak Days,Blacklisted,Created At');
      expect(csv).toContain('123,100,5,false');
      expect(csv).toContain('456,50,0,true');
    });
  });

  describe('image helpers', () => {
    const createAttachmentCollection = (items) => ({
      size: items.length,
      some: (fn) => items.some(fn),
      find: (fn) => items.find(fn),
      values: () => items[Symbol.iterator](),
      [Symbol.iterator]: function* () {
        for (const item of items) {
          yield item;
        }
      }
    });

    it('detects image attachments', () => {
      const attachment = { name: 'photo.png', url: 'https://cdn.example.com/photo.png', contentType: 'image/png' };
      const message = {
        attachments: createAttachmentCollection([attachment]),
        embeds: []
      };

      expect(hasImageAttachment(message)).toBe(true);
      expect(getFirstImageUrl(message)).toBe(attachment.url);
    });

    it('detects embedded images', () => {
      const message = {
        attachments: createAttachmentCollection([]),
        embeds: [{ image: { url: 'https://imgur.example.com/vouch.jpg' } }]
      };

      expect(hasImageAttachment(message)).toBe(true);
      expect(getFirstImageUrl(message)).toBe('https://imgur.example.com/vouch.jpg');
    });

    it('returns false when no images are present', () => {
      const message = {
        attachments: createAttachmentCollection([]),
        embeds: []
      };

      expect(hasImageAttachment(message)).toBe(false);
      expect(getFirstImageUrl(message)).toBeNull();
    });
  });
});

