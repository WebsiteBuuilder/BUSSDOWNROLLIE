import crypto from 'crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

export function createQuickStubGame({ key, name, prompt }) {
  return {
    key,
    name,
    async start(ctx) {
      let challengerReady = false;
      let opponentReady = false;

      async function tryResolve() {
        if (!challengerReady || !opponentReady) {
          return;
        }

        const winnerId = crypto.randomInt(2) === 0 ? ctx.challengerId : ctx.opponentId;
        const loserId = winnerId === ctx.challengerId ? ctx.opponentId : ctx.challengerId;
        await ctx.render({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${name}`)
              .setColor(0x2ecc71)
              .setDescription(
                [
                  `Winner: <@${winnerId}>`,
                  `Loser: <@${loserId}>`,
                  '',
                  'Thanks for playing!'
                ].join('\n')
              ),
          ],
          components: [],
        });
        await ctx.end(winnerId, loserId, { summary: `${name} concluded.` });
      }

      async function renderState(message) {
        ctx.clearActions();
        const embed = new EmbedBuilder()
          .setTitle(name)
          .setColor(0x3498db)
          .setDescription(message ?? prompt ?? 'Confirm when you are ready.');

        const row = new ActionRowBuilder();

        if (!challengerReady) {
          const readyId = ctx.registerAction(`${key}-ready-challenger`, async (interaction) => {
            if (interaction.user.id !== ctx.challengerId) {
              await interaction.reply({ ephemeral: true, content: 'Only the challenger can press this.' });
              return;
            }
            await interaction.deferUpdate();
            challengerReady = true;
            await renderState('Waiting for the opponent to confirm…');
            await tryResolve();
          });
          row.addComponents(new ButtonBuilder().setCustomId(readyId).setStyle(ButtonStyle.Success).setLabel('Challenger Ready'));
        } else {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(ctx.makeId(`${key}-ready-challenger-disabled`))
              .setStyle(ButtonStyle.Secondary)
              .setLabel('Challenger Ready')
              .setDisabled(true)
          );
        }

        if (!opponentReady) {
          const readyId = ctx.registerAction(`${key}-ready-opponent`, async (interaction) => {
            if (interaction.user.id !== ctx.opponentId) {
              await interaction.reply({ ephemeral: true, content: 'Only the opponent can press this.' });
              return;
            }
            await interaction.deferUpdate();
            opponentReady = true;
            await renderState('Waiting for the challenger to confirm…');
            await tryResolve();
          });
          row.addComponents(new ButtonBuilder().setCustomId(readyId).setStyle(ButtonStyle.Primary).setLabel('Opponent Ready'));
        } else {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(ctx.makeId(`${key}-ready-opponent-disabled`))
              .setStyle(ButtonStyle.Secondary)
              .setLabel('Opponent Ready')
              .setDisabled(true)
          );
        }

        await ctx.render({ embeds: [embed], components: [row] });
        ctx.setTimeout(`${key}-timeout`, 20_000, async () => {
          const winnerId = challengerReady ? ctx.challengerId : ctx.opponentId;
          const loserId = winnerId === ctx.challengerId ? ctx.opponentId : ctx.challengerId;
          await ctx.render({
            embeds: [
              new EmbedBuilder()
                .setTitle(name)
                .setColor(0xe74c3c)
                .setDescription('Timeout reached — awarding win to the ready player.'),
            ],
            components: [],
          });
          await ctx.end(winnerId, loserId, { summary: 'Win by readiness timeout.' });
        });
      }

      await renderState();
    },
  };
}
