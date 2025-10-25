import crypto from 'crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { presentGame } from '../../ui/presentGame.js';
import { labelForUser } from '../../ui/labelForUser.js';

const CHOICES = {
  heads: { emoji: '🟥', label: 'Heads' },
  tails: { emoji: '⬛', label: 'Tails' },
};
export const coinFlipGame = {
  key: 'coin_flip',
  name: 'Coin Flip Clash',
  async start(ctx) {
    const selections = {
      p1: null,
      p2: null,
    };

    let resolved = false;

    const playerLabel = (slot, options = {}) =>
      labelForUser(slot === 'p1' ? ctx.p1 : ctx.p2, slot === 'p1' ? ctx.challengerId : ctx.opponentId, {
        fallback: slot === 'p1' ? 'Player 1' : 'Player 2',
        ...options,
      });

    function buildRow(slot) {
      const choice = selections[slot];
      const row = new ActionRowBuilder();
      for (const [key, data] of Object.entries(CHOICES)) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(
              ctx.registerAction({ player: slot, action: `${key}` }, async (interaction) => {
                const expectedId = slot === 'p1' ? ctx.challengerId : ctx.opponentId;
                if (interaction.user.id !== expectedId) {
                  await interaction.reply({ ephemeral: true, content: 'This choice is reserved for your opponent.' });
                  return;
                }

                const rivalSlot = slot === 'p1' ? 'p2' : 'p1';
                const rivalChoice = selections[rivalSlot];
                if (rivalChoice && rivalChoice === key) {
                  await interaction.reply({
                    ephemeral: true,
                    content: '🎭 That side is already taken. Choose the other color!',
                  });
                  return;
                }

                selections[slot] = key;
                await interaction.deferUpdate();
                await render(`${data.emoji} ${data.label} locked in for you!`);
                if (selections.p1 && selections.p2) {
                  await resolveFlip();
                }
              })
            )
            .setLabel(`${data.emoji} ${data.label} — ${playerLabel(slot)}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(Boolean(choice))
        );
      }
      return row;
    }

    function waitingRow(slot) {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(ctx.makeId({ player: slot, action: 'wait' }))
          .setLabel('Waiting for other player…')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
    }

    function describeSelections() {
      const p1 = selections.p1
        ? `${CHOICES[selections.p1].emoji} ${CHOICES[selections.p1].label}`
        : '—';
      const p2 = selections.p2
        ? `${CHOICES[selections.p2].emoji} ${CHOICES[selections.p2].label}`
        : '—';
      return `${playerLabel('p1', { emphasize: true })}: ${p1}\n${playerLabel('p2', { emphasize: true })}: ${p2}`;
    }

    async function render(message) {
      ctx.clearActions();
      if (resolved) {
        await presentGame(ctx, {
          title: '🪙 Coin Flip Clash',
          description: message ?? 'Pick your color — only one can win the fall!',
          extraLines: [describeSelections(), 'Animated flip begins once both sides are chosen.'],
          components: [],
          status: 'neutral',
        });
        return;
      }

      const components = [buildRow('p1'), buildRow('p2')];
      if ((selections.p1 && !selections.p2) || (selections.p2 && !selections.p1)) {
        const waitingFor = selections.p1 ? 'p2' : 'p1';
        components.push(waitingRow(waitingFor));
      }

      await presentGame(ctx, {
        title: '🪙 Coin Flip Clash',
        description: message ?? 'Pick your color — only one can win the fall!',
        extraLines: [describeSelections(), 'Animated flip begins once both sides are chosen.'],
        components,
        status: 'neutral',
      });
    }

    async function resolveFlip() {
      if (resolved) return;
      resolved = true;

      await presentGame(ctx, {
        title: '🪙 Coin Flip Clash',
        description: '🎞️ Tossing the coin high into the neon lights...',
        extraLines: [describeSelections()],
        status: 'neutral',
      });

      const frames = ['🟥⬛', '⬛🟥', '🟥⬛', '⬛🟥', '🟥⬛'];
      for (const frame of frames) {
        await new Promise((resolve) => setTimeout(resolve, 160));
        await presentGame(ctx, {
          title: '🪙 Coin Flip Clash',
          description: '💫 Spinning...',
          extraLines: [`${frame}`, describeSelections()],
          status: 'neutral',
        });
      }

      const winning = crypto.randomInt(2) === 0 ? 'heads' : 'tails';
      const winnerSlot = selections.p1 === winning ? 'p1' : selections.p2 === winning ? 'p2' : null;

      if (!winnerSlot) {
        resolved = false;
        selections.p1 = null;
        selections.p2 = null;
        await render('🤝 The coin landed on its edge?! Re-choose quickly!');
        return;
      }

      const winningData = CHOICES[winning];
      const winnerId = winnerSlot === 'p1' ? ctx.challengerId : ctx.opponentId;
      const loserId = winnerSlot === 'p1' ? ctx.opponentId : ctx.challengerId;

      await presentGame(ctx, {
        title: '🪙 Coin Flip Clash',
        description: `🎉 The coin hits the felt on ${winningData.emoji} **${winningData.label}**!`,
        extraLines: [`${describeSelections()}`, '🏆 Victory is swift.'],
        status: 'victory',
      });

      await ctx.end(winnerId, loserId, {
        summary: `${winningData.label} prevails.`,
      });
    }

    await render('🕺 Step up! Claim your color.');
  },
};
