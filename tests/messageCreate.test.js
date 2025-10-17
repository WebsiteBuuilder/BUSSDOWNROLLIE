import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbMocks = vi.hoisted(() => {
  const mockFindUnique = vi.fn();
  const mockVouchCreate = vi.fn();
  const mockTxUserUpdate = vi.fn();
  const mockTxVouchCreate = vi.fn();
  const mockTransaction = vi.fn();
  const mockGetOrCreateUser = vi.fn();

  return {
    mockFindUnique,
    mockVouchCreate,
    mockTxUserUpdate,
    mockTxVouchCreate,
    mockTransaction,
    mockGetOrCreateUser
  };
});

const loggerMocks = vi.hoisted(() => ({
  mockLogTransaction: vi.fn()
}));

vi.mock('../src/db/index.js', () => ({
  __esModule: true,
  default: {
    vouch: {
      findUnique: dbMocks.mockFindUnique,
      create: dbMocks.mockVouchCreate
    },
    $transaction: dbMocks.mockTransaction
  },
  getOrCreateUser: dbMocks.mockGetOrCreateUser
}));

vi.mock('../src/lib/logger.js', () => ({
  __esModule: true,
  logTransaction: loggerMocks.mockLogTransaction
}));

import { execute } from '../src/events/messageCreate.js';

const VOUCH_CHANNEL_ID = '333333333';
const PROVIDER_ROLE_ID = '111111111';

const {
  mockFindUnique,
  mockVouchCreate,
  mockTxUserUpdate,
  mockTxVouchCreate,
  mockTransaction,
  mockGetOrCreateUser
} = dbMocks;

const { mockLogTransaction } = loggerMocks;

describe('messageCreate event', () => {
  beforeEach(() => {
    process.env.VOUCH_CHANNEL_ID = VOUCH_CHANNEL_ID;
    process.env.PROVIDER_ROLE_ID = PROVIDER_ROLE_ID;

    mockFindUnique.mockReset();
    mockVouchCreate.mockReset();
    mockTxUserUpdate.mockReset();
    mockTxVouchCreate.mockReset();
    mockTransaction.mockReset();
    mockGetOrCreateUser.mockReset();
    mockLogTransaction.mockReset();

    mockTransaction.mockImplementation(async (callback) => {
      return callback({
        user: { update: mockTxUserUpdate },
        vouch: { create: mockTxVouchCreate }
      });
    });
  });

  const createBaseMessage = () => ({
    author: {
      bot: false,
      id: 'user-123',
      send: vi.fn().mockResolvedValue()
    },
    channel: {
      id: VOUCH_CHANNEL_ID,
      name: 'vouch'
    },
    id: 'message-456',
    url: 'https://discord.com/channels/1/2/message-456',
    attachments: [
      { name: 'order.png', url: 'https://cdn.example.com/order.png', contentType: 'image/png' }
    ],
    embeds: [],
    mentions: {
      roles: { has: vi.fn() },
      members: { some: vi.fn() }
    },
    reply: vi.fn().mockResolvedValue(),
    react: vi.fn().mockResolvedValue()
  });

  it('auto-approves vouches with provider mention and image', async () => {
    const message = createBaseMessage();

    message.mentions.roles.has.mockReturnValue(false);
    message.mentions.members.some.mockImplementation((predicate) =>
      predicate({ roles: { cache: { has: (id) => id === PROVIDER_ROLE_ID } } })
    );

    mockGetOrCreateUser.mockResolvedValue({ id: 1, blacklisted: false, vp: 10 });
    mockFindUnique.mockResolvedValue(null);
    mockTxUserUpdate.mockResolvedValue({ id: 1, vp: 11 });
    mockTxVouchCreate.mockResolvedValue({});

    await execute(message);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockTxUserUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { vp: { increment: 1 } }
    });
    expect(mockTxVouchCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        messageId: 'message-456',
        userId: 1,
        imageUrl: 'https://cdn.example.com/order.png',
        providerMentioned: true,
        status: 'auto'
      })
    });
    expect(mockVouchCreate).not.toHaveBeenCalled();
    expect(message.react).toHaveBeenCalledWith('✅');
    expect(message.reply).not.toHaveBeenCalled();
    expect(mockLogTransaction).toHaveBeenCalledWith('vouch', expect.objectContaining({
      userId: message.author.id,
      amount: 1,
      status: 'auto'
    }));
  });

  it('creates pending vouch when provider is not mentioned', async () => {
    const message = createBaseMessage();

    message.mentions.roles.has.mockReturnValue(false);
    message.mentions.members.some.mockReturnValue(false);

    mockGetOrCreateUser.mockResolvedValue({ id: 2, blacklisted: false, vp: 5 });
    mockFindUnique.mockResolvedValue(null);

    await execute(message);

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockVouchCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        messageId: 'message-456',
        userId: 2,
        imageUrl: 'https://cdn.example.com/order.png',
        providerMentioned: false,
        status: 'pending'
      })
    });
    expect(message.react).toHaveBeenCalledWith('⏳');
    expect(message.reply).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('@ a provider')
    }));
    expect(mockLogTransaction).not.toHaveBeenCalled();
  });
});
