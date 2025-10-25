import { Message, TextBasedChannel } from 'discord.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatEntries(entries: string[], highlightIndex: number): string {
  return entries
    .map((label, index) => (index === highlightIndex ? `➡️ **${label}**` : `▫️ ${label}`))
    .join('\n');
}

function buildSequence(total: number, winnerIndex: number, steps = 18): number[] {
  const sequence: number[] = [];
  let current = Math.floor(Math.random() * total);
  for (let i = 0; i < steps; i += 1) {
    current = (current + 1) % total;
    sequence.push(current);
  }
  // Ensure we land on winner by the end
  while (sequence[sequence.length - 1] !== winnerIndex) {
    current = (current + 1) % total;
    sequence.push(current);
  }
  return sequence;
}

export async function runFallbackWheel(
  channel: TextBasedChannel,
  entries: { userId: string }[],
  winnerIndex: number
): Promise<Message> {
  const labels = entries.map((entry, index) => `#${index + 1} <@${entry.userId}>`);
  const sequence = buildSequence(entries.length, winnerIndex);
  const message = await channel.send({
    content: '🛞 Spinning the wheel…',
  });

  for (let i = 0; i < sequence.length; i += 1) {
    const idx = sequence[i];
    await message.edit({
      content: `🛞 Spinning the wheel…\n${formatEntries(labels, idx)}`,
    });
    const delay = 100 + i * 35;
    await sleep(Math.min(delay, 650));
  }

  await message.edit({
    content: `🏆 Winner: ${labels[winnerIndex]}`,
  });

  return message;
}
