import { describe, expect, it, vi, afterEach } from 'vitest';
import { handleBattleAttackButton } from '../src/components/buttons/battleAttack.js';
import { BattleStatus } from '../src/types.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('battle button handlers', () => {
  it('acks the button interaction immediately when attacking', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const deferUpdate = vi.fn(() => Promise.resolve());
    const followUp = vi.fn(() => Promise.resolve());
    const edit = vi.fn(() => Promise.resolve());

    const interaction = {
      user: { id: 'user-1' },
      message: { id: 'message-1', edit },
      deferred: false,
      replied: false,
      deferUpdate,
      followUp,
      customId: 'battle:attack:battle-1:user-1,user-2',
    };

    const battle = {
      id: 'battle-1',
      initiatorId: 'user-1',
      opponentId: 'user-2',
      participants: ['user-1', 'user-2'],
      participantsKey: 'user-1,user-2',
      status: BattleStatus.Active,
      hp: {
        'user-1': 100,
        'user-2': 100,
      },
      log: ['start'],
      message: { id: 'message-1', edit },
    };

    await handleBattleAttackButton({
      allowedUserIds: ['user-1', 'user-2'],
      battleId: 'battle-1',
      interaction,
      getBattle: () => battle,
      setBattle: () => {},
      endBattle: () => Promise.resolve(),
      buildBattleControls: () => [],
      renderBattleState: () => 'state',
    });

    expect(deferUpdate).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
