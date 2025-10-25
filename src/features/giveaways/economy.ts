import { addVP, getOrCreateUser, removeVP } from '../../db/index.js';

export async function getBalance(discordId: string): Promise<number> {
  const user = await getOrCreateUser(discordId);
  return user.vp;
}

export async function addPoints(discordId: string, amount: number, reason: string): Promise<void> {
  await addVP(discordId, amount, reason);
}

export async function subtractPoints(
  discordId: string,
  amount: number,
  reason: string
): Promise<void> {
  await removeVP(discordId, amount);
}
