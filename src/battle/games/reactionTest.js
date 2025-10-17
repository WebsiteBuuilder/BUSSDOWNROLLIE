import crypto from 'crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

export const reactionTestGame = {
  key: 'reaction_test',
  name: 'Reaction Test',
  async start(ctx) {
    await ctx.render({
      embeds: [
        new EmbedBuilder()
          .setTitle('Reaction Test')
          .setColor(0x9b59b6)
          .setDescription(
            [
              'Stay alert! When the button appears, click it as fast as you can.',
              'Early clicks don\'t count.',
            ].join('\n')
          ),
      ],
      components: [],
    });

    const delay = crypto.randomInt(2000, 5000);

    ctx.setTimeout('reaction-ready', delay, async () => {
      const buttonId = ctx.registerAction('reaction-click', async (interaction) => {
        if (![ctx.challengerId, ctx.opponentId].includes(interaction.user.id)) {
          await interaction.reply({ ephemeral: true, content: 'This battle is not yours.' });
          return;
        }

        ctx.clearTimeout('reaction-timeout');
        ctx.clearActions();
        await interaction.deferUpdate();

        const winnerId = interaction.user.id;
        const loserId = winnerId === ctx.challengerId ? ctx.opponentId : ctx.challengerId;

        await ctx.render({
          embeds: [
            new EmbedBuilder()
              .setTitle('Reaction Test')
              .setColor(0x9b59b6)
              .setDescription(`⚡ <@${winnerId}> reacted first and wins the duel!`),
          ],
          components: [],
        });

        await ctx.end(winnerId, loserId, { summary: 'Lightning fast reflexes!' });
      });

      await ctx.render({
        embeds: [
          new EmbedBuilder()
            .setTitle('Reaction Test')
            .setColor(0x9b59b6)
            .setDescription('GO! Tap the button NOW!'),
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(buttonId).setLabel('Click me!').setStyle(ButtonStyle.Success)
          ),
        ],
      });

      ctx.setTimeout('reaction-timeout', 20_000, async () => {
        ctx.clearActions();
        const winnerId = crypto.randomInt(2) === 0 ? ctx.challengerId : ctx.opponentId;
        const loserId = winnerId === ctx.challengerId ? ctx.opponentId : ctx.challengerId;
        await ctx.render({
          embeds: [
            new EmbedBuilder()
              .setTitle('Reaction Test')
              .setColor(0x9b59b6)
              .setDescription('Nobody clicked in time. Random winner selected.'),
          ],
          components: [],
        });
        await ctx.end(winnerId, loserId, { summary: 'Win by timeout — nobody reacted.' });
      });
    });
  },
};
