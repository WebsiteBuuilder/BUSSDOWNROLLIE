export const BATTLE_NAMESPACE = 'battle';

export const BattleStatus = Object.freeze({
  Active: 'active',
  Ended: 'ended',
});

export function parseCustomId(id = '') {
  return id.split(':');
}
