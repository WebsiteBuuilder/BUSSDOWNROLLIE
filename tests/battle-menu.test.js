import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleBattleGameSelect, BATTLE_MENU_NAMESPACE } from '../src/commands/battle.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('battle game select menu', () => {
  it('rejects interactions from non-participants', async () => {
    const reply = vi.fn(() => Promise.resolve());
    const interaction = {
      customId: `${BATTLE_MENU_NAMESPACE}:user-1:user-2:50`,
      user: { id: 'user-3' },
      values: ['coinflip'],
      reply,
    };

    const handled = await handleBattleGameSelect(interaction);

    expect(handled).toBe(true);
    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply.mock.calls[0][0]).toMatchObject({ ephemeral: true });
  });

  it('responds with instructions for a valid selection', async () => {
    const reply = vi.fn(() => Promise.resolve());
    const interaction = {
      customId: `${BATTLE_MENU_NAMESPACE}:user-1:user-2:75`,
      user: { id: 'user-1' },
      values: ['coinflip'],
      reply,
    };

    const handled = await handleBattleGameSelect(interaction);

    expect(handled).toBe(true);
    expect(reply).toHaveBeenCalledTimes(1);

    const { embeds } = reply.mock.calls[0][0];
    expect(Array.isArray(embeds)).toBe(true);
    expect(embeds[0]?.data?.title).toContain('Coin Flip');
    expect(embeds[0]?.data?.description).toContain('75 VP');
  });

  it('handles unknown menu options gracefully', async () => {
    const reply = vi.fn(() => Promise.resolve());
    const interaction = {
      customId: `${BATTLE_MENU_NAMESPACE}:user-1:user-2:20`,
      user: { id: 'user-1' },
      values: ['unknown'],
      reply,
    };

    const handled = await handleBattleGameSelect(interaction);

    expect(handled).toBe(true);
    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply.mock.calls[0][0].content).toContain('no longer available');
  });
});
