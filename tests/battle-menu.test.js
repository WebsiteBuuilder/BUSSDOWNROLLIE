import { describe, expect, it } from 'vitest';
import { data as battleCommand } from '../src/commands/battle.js';
import { battleGames, getGameByKey } from '../src/battle/registry.js';

describe('battle command', () => {
  it('includes challenge and open subcommands', () => {
    const json = battleCommand.toJSON();
    const subcommands = json.options.filter((option) => option.type === 1); // type 1 = SUB_COMMAND
    const names = subcommands.map((option) => option.name);

    expect(names).toContain('challenge');
    expect(names).toContain('open');

    const challenge = subcommands.find((option) => option.name === 'challenge');
    expect(challenge.options.find((option) => option.name === 'opponent').required).toBe(true);
    expect(challenge.options.find((option) => option.name === 'amount').required).toBe(true);

    const open = subcommands.find((option) => option.name === 'open');
    expect(open.options.find((option) => option.name === 'amount').required).toBe(true);
  });
});

describe('battle games registry', () => {
  it('contains all 13 registered games', () => {
    const keys = battleGames.map((game) => game.key);
    expect(new Set(keys).size).toBe(13);
    expect(keys).toContain('hi_low_draw');
    expect(keys).toContain('rock_paper_scissors');
    expect(keys).toContain('reaction_test');
  });

  it('finds games by key', () => {
    const game = getGameByKey('hi_low_draw');
    expect(game).toBeDefined();
    expect(game?.name).toContain('Hi');
  });
});
