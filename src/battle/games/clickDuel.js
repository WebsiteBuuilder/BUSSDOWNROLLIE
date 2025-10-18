import crypto from 'crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { presentGame } from '../../ui/presentGame.js';
import { labelForUser } from '../../ui/labelForUser.js';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const clickDuelGame = {
  key: 'click_duel',
  name: 'Click Duel',
  async start(ctx) {
    let ready = false;
    let resolved = false;

    const playerLabel = (slot, options = {}) =>
      labelForUser(slot === 'p1' ? ctx.p1 : ctx.p2, slot === 'p1' ? ctx.challengerId : ctx.opponentId, {
        fallback: slot === 'p1' ? 'Player 1' : 'Player 2',
        ...options,
      });

    function buildRows() {
      const rows = [];

      rows.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(
              ctx.registerAction({ player: 'p1', action: 'strike' }, async (interaction) => {
                if (interaction.user.id !== ctx.challengerId) {
                  await interaction.reply({ ephemeral: true, content: 'Let your opponent handle their own button.' });
                  return;
                }
                if (!ready) {
                  await interaction.reply({ ephemeral: true, content: '⛔ Wait for the signal!' });
                  return;
                }
                if (resolved) {
                  await interaction.reply({ ephemeral: true, content: 'This duel is already settled.' });
                  return;
                }

                resolved = true;
                await interaction.deferUpdate();
                await presentGame(ctx, {
                  title: '⚡ Click Duel',
                  description: `💥 First strike lands true! ${playerLabel('p1', { emphasize: true })} wins the clash.`,
                  status: 'victory',
                  extraLines: ['⚔️ Lightning reflexes decide the arena!'],
                });
                await ctx.end(ctx.challengerId, ctx.opponentId, { summary: 'Fastest click wins.' });
              })
            )
            .setLabel(ready ? `⚡ Strike — ${playerLabel('p1')}` : 'Standby…')
            .setStyle(ready ? ButtonStyle.Danger : ButtonStyle.Secondary)
            .setDisabled(!ready)
        )
      );

      rows.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(
              ctx.registerAction({ player: 'p2', action: 'strike' }, async (interaction) => {
                if (interaction.user.id !== ctx.opponentId) {
                  await interaction.reply({ ephemeral: true, content: 'That is not your duel to claim.' });
                  return;
                }
                if (!ready) {
                  await interaction.reply({ ephemeral: true, content: '⛔ Wait for the signal!' });
                  return;
                }
                if (resolved) {
                  await interaction.reply({ ephemeral: true, content: 'This duel is already settled.' });
                  return;
                }

                resolved = true;
                await interaction.deferUpdate();
                await presentGame(ctx, {
                  title: '⚡ Click Duel',
                  description: `💥 First strike lands true! ${playerLabel('p2', { emphasize: true })} wins the clash.`,
                  status: 'victory',
                  extraLines: ['⚔️ Lightning reflexes decide the arena!'],
                });
                await ctx.end(ctx.opponentId, ctx.challengerId, { summary: 'Fastest click wins.' });
              })
            )
            .setLabel(ready ? `⚡ Strike — ${playerLabel('p2')}` : 'Standby…')
            .setStyle(ready ? ButtonStyle.Danger : ButtonStyle.Secondary)
            .setDisabled(!ready)
        )
      );

      return rows;
    }

    async function render(message) {
      ctx.clearActions();
      await presentGame(ctx, {
        title: '⚡ Click Duel',
        description: message,
        components: resolved ? [] : buildRows(),
        status: 'neutral',
      });
    }

    await render('🕯️ The arena falls silent... hands hover over the trigger.');
    await delay(900 + crypto.randomInt(600));
    await render('🔔 The crowd inhales — any second now!');
    await delay(700 + crypto.randomInt(700));
    ready = true;
    await render('💥 GO! Slam your button before your rival.');
  },
};
