export type GiveawayState =
  | 'DRAFT'
  | 'ACTIVE'
  | 'REVEALING'
  | 'COMPLETE'
  | 'CANCELLED';

export interface GiveawayRecord {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string | null;
  hostId: string;
  title: string;
  description: string | null;
  buyInCost: number;
  maxEntriesPerUser: number;
  revealWindowSeconds: number;
  payoutRatio: number;
  startAt: number;
  endAt: number;
  state: GiveawayState;
  seed: string | null;
  winnerUserId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface GiveawayWithStats extends GiveawayRecord {
  entrantCount: number;
  pot: number;
}

export interface GiveawayEntry {
  id: number;
  giveawayId: string;
  userId: string;
  entryIndex: number;
  createdAt: number;
}

export interface GiveawayAuditLog {
  id: number;
  giveawayId: string;
  actorId: string | null;
  action: string;
  meta: string;
  at: number;
}

export interface GiveawayConfig {
  defaultBuyInCost: number;
  defaultMaxEntriesPerUser: number;
  defaultRevealWindowSeconds: number;
  defaultPayoutRatio: number;
}

export interface EntrantSummary {
  userId: string;
  entries: number;
}

export interface GiveawaySpinResult {
  winnerUserId: string;
  winnerIndex: number;
  seed: string;
  payout: number;
}

export interface GiveawayPotSnapshot {
  entrantCount: number;
  pot: number;
}

export const GIVEAWAY_STATES: GiveawayState[] = [
  'DRAFT',
  'ACTIVE',
  'REVEALING',
  'COMPLETE',
  'CANCELLED',
];

export function isTerminalState(state: GiveawayState): boolean {
  return state === 'COMPLETE' || state === 'CANCELLED';
}

export function isActiveState(state: GiveawayState): boolean {
  return state === 'ACTIVE' || state === 'REVEALING';
}
