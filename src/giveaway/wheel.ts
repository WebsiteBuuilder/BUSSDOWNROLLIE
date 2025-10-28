import { GuildTextBasedChannel } from 'discord.js';
import { GiveawayEntry } from './db.js';
import { logger } from '../logger.js';

/**
 * UI/LOOKS OPTIMIZATION: Cinematic wheel reveal for giveaway winners
 * Adapted from the existing roulette animation system
 */
export async function runWinnerWheel(
  channel: GuildTextBasedChannel,
  entries: GiveawayEntry[],
  winnerIndex: number
): Promise<void> {
  try {
    if (entries.length === 0) return;
    
    // Get unique users for the wheel
    const uniqueUsers = Array.from(new Set(entries.map(e => e.userId)));
    const winnerUserId = entries[winnerIndex].userId;
    
    // Create a simple text-based reveal for now
    // In production, this could use the canvas-based animation from roulette
    const revealMessages = [
      '🎰 **SPINNING THE WHEEL...**',
      '🔄 **The wheel is spinning...**',
      '⚡ **Slowing down...**',
      '🎯 **Almost there...**',
    ];
    
    let message = await channel.send(revealMessages[0]);
    
    // Animate through reveal messages
    for (let i = 1; i < revealMessages.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      await message.edit(revealMessages[i]);
    }
    
    // Final reveal
    await new Promise(resolve => setTimeout(resolve, 2000));
    await message.edit(`🏆 **AND THE WINNER IS...**`);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    await message.edit(`🎉 **<@${winnerUserId}>** 🎉`);
    
    // Delete the animation message after a delay
    setTimeout(() => {
      message.delete().catch(() => {});
    }, 5000);
    
  } catch (error) {
    logger.error('Failed to run winner wheel animation', { err: error });
  }
}

/**
 * Future enhancement: Canvas-based wheel animation
 * This would adapt the existing cinematic-animation-v2.js from roulette
 * to display entrant avatars on a spinning wheel
 */
export async function runCanvasWinnerWheel(
  channel: GuildTextBasedChannel,
  entries: GiveawayEntry[],
  winnerIndex: number
): Promise<void> {
  // TODO: Implement canvas-based animation using existing roulette system
  // For now, fallback to text animation
  await runWinnerWheel(channel, entries, winnerIndex);
}

