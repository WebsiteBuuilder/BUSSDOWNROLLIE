import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChannelType } from 'discord.js';

vi.mock('../src/lib/logger.js', () => ({
  logTransaction: vi.fn(),
  initLogger: vi.fn(),
}));

const mockRecordResult = vi.fn();
const mockGetTopWinner = vi.fn().mockReturnValue(null);

vi.mock('../src/lib/blackjack-results.js', () => ({
  recordBlackjackResult: mockRecordResult,
  getTopWinner24h: mockGetTopWinner,
}));

const mockPrisma = {
  $transaction: vi.fn(async (callback) => {
    return callback({
      user: mockPrisma.user,
      blackjackRound: mockPrisma.blackjackRound,
    });
  }),
  blackjackRound: {
    create: vi.fn(async ({ data }) => ({ id: 101, ...data })),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  user: {
    update: vi.fn(async ({ data }) => {
      const increment = data?.vp?.increment ?? 0;
      const decrement = data?.vp?.decrement ?? 0;
      return { id: 1, vp: 150 + increment - decrement };
    }),
    findUnique: vi.fn().mockResolvedValue({ id: 1, discordId: 'user-1', vp: 120 }),
  },
};

const mockGetOrCreateUser = vi.fn().mockResolvedValue({
  id: 1,
  discordId: 'user-1',
  vp: 150,
  blacklisted: false,
});

const mockHasActiveBlackjack = vi.fn().mockResolvedValue(false);
const mockGetConfig = vi.fn(async (_key, fallback) => fallback);

vi.mock('../src/db/index.js', () => ({
  default: mockPrisma,
  getOrCreateUser: mockGetOrCreateUser,
  hasActiveBlackjack: mockHasActiveBlackjack,
  getConfig: mockGetConfig,
}));

describe('blackjack command execute', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPrisma.$transaction.mockClear();
    mockPrisma.blackjackRound.create.mockClear();
    mockPrisma.blackjackRound.findUnique.mockReset();
    mockPrisma.blackjackRound.update.mockClear();
    mockPrisma.user.update.mockClear();
    mockPrisma.user.findUnique.mockClear();
    mockGetOrCreateUser.mockClear();
    mockHasActiveBlackjack.mockClear();
    mockGetConfig.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('starts a blackjack round when invoked inside the casino channel', async () => {
    vi.resetModules();
    const blackjackModule = await import('../src/lib/blackjack.js');
    const telemetry = await import('../src/lib/blackjack-telemetry.js');
    vi.spyOn(telemetry, 'logBlackjackEvent').mockImplementation(() => {});

    vi.spyOn(blackjackModule, 'createBlackjackGame').mockReturnValue({
      deck: [
        { rank: '5', suit: '♠️' },
        { rank: '4', suit: '♦️' },
      ],
      playerHand: [
        { rank: '8', suit: '♠️' },
        { rank: '7', suit: '♥️' },
      ],
      dealerHand: [
        { rank: '9', suit: '♣️' },
        { rank: '6', suit: '♦️' },
      ],
      bet: 25,
      doubled: false,
      split: false,
      playerStand: false,
    });

    const { execute } = await import('../src/commands/blackjack.js');

    const interaction = {
      id: 'interaction-1',
      guildId: 'guild-1',
      channelId: process.env.CASINO_CHANNEL_ID,
      channel: {
        id: process.env.CASINO_CHANNEL_ID,
        type: ChannelType.GuildText,
      },
      options: {
        getSubcommand: () => 'play',
        getInteger: () => 25,
      },
      user: { id: 'user-1' },
      client: {
        channels: {
          fetch: vi.fn(),
        },
      },
      replied: false,
      deferred: false,
      deferReply: vi.fn(async () => {
        interaction.deferred = true;
      }),
      editReply: vi.fn(async () => {}),
      reply: vi.fn(async () => {
        interaction.replied = true;
      }),
      followUp: vi.fn(async () => {}),
    };

    const serializedState = JSON.stringify({
      playerHand: [
        { rank: '8', suit: '♠️' },
        { rank: '7', suit: '♥️' },
      ],
      dealerHand: [
        { rank: '9', suit: '♣️' },
        { rank: '6', suit: '♦️' },
      ],
      bet: 25,
      deck: [
        { rank: '5', suit: '♠️' },
        { rank: '4', suit: '♦️' },
      ],
    });

    mockPrisma.blackjackRound.create.mockResolvedValueOnce({
      id: 501,
      state: serializedState,
      amount: 25,
      userId: 1,
    });

    mockPrisma.blackjackRound.findUnique.mockResolvedValueOnce({
      id: 501,
      state: serializedState,
      result: null,
      amount: 25,
      userId: 1,
      user: {
        id: 1,
        discordId: 'user-1',
        vp: 150,
      },
    });

    await execute(interaction);

    expect(mockGetOrCreateUser).toHaveBeenCalledWith('user-1');
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.blackjackRound.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 25 }),
      })
    );
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        components: expect.any(Array),
      })
    );
  });
});
