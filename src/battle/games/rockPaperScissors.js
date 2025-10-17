import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

const CHOICES = ['rock', 'paper', 'scissors'];
const CHOICE_EMOJI = {
  rock: '🪨',
  paper: '📄',
  scissors: '✂️',
};

function beats(a, b) {
  return (
    (a === 'rock' && b === 'scissors') ||
    (a === 'paper' && b === 'rock') ||
    (a === 'scissors' && b === 'paper')
  );
}

export const rockPaperScissorsGame = {
  key: 'rock_paper_scissors',
  name: 'Rock Paper Scissors',
  async start(ctx) {
    let round = 1;
    const scores = { challenger: 0, opponent: 0 };
    const picks = { challenger: null, opponent: null };

    async function renderState(message = 'First to 2 wins. Select your move below.') {
      const embed = new EmbedBuilder()
        .setTitle(`Rock Paper Scissors — Round ${round}`)
        .setColor(0xe67e22)
        .setDescription(
          [
            `Score — <@${ctx.challengerId}>: **${scores.challenger}** | <@${ctx.opponentId}>: **${scores.opponent}**`,
            '',
            message,
          ].join('\n')
        );

      if (picks.challenger) {
        embed.addFields({
          name: 'Challenger Choice',
          value: `${CHOICE_EMOJI[picks.challenger]} ${picks.challenger.toUpperCase()}`,
          inline: true,
        });
      }

      if (picks.opponent) {
        embed.addFields({
          name: 'Opponent Choice',
          value: `${CHOICE_EMOJI[picks.opponent]} ${picks.opponent.toUpperCase()}`,
          inline: true,
        });
      }

      ctx.clearActions();
      const challengerRow = new ActionRowBuilder();
      const opponentRow = new ActionRowBuilder();

      for (const choice of CHOICES) {
        if (!picks.challenger) {
          const customId = ctx.registerAction(`rps-${round}-challenger-${choice}`, async (interaction) => {
            if (interaction.user.id !== ctx.challengerId) {
              await interaction.reply({ ephemeral: true, content: 'Only the challenger can use these buttons.' });
              return;
            }
            await handlePick('challenger', choice, interaction);
          });
          challengerRow.addComponents(
            new ButtonBuilder()
              .setCustomId(customId)
              .setStyle(ButtonStyle.Primary)
              .setLabel(`${CHOICE_EMOJI[choice]} ${choice}`)
          );
        } else {
          challengerRow.addComponents(
            new ButtonBuilder()
              .setCustomId(ctx.makeId(`noop-${round}-c-${choice}`))
              .setStyle(ButtonStyle.Secondary)
              .setLabel(`${CHOICE_EMOJI[choice]} ${choice}`)
              .setDisabled(true)
          );
        }

        if (!picks.opponent) {
          const customId = ctx.registerAction(`rps-${round}-opponent-${choice}`, async (interaction) => {
            if (interaction.user.id !== ctx.opponentId) {
              await interaction.reply({ ephemeral: true, content: 'Only the opponent can use these buttons.' });
              return;
            }
            await handlePick('opponent', choice, interaction);
          });
          opponentRow.addComponents(
            new ButtonBuilder()
              .setCustomId(customId)
              .setStyle(ButtonStyle.Primary)
              .setLabel(`${CHOICE_EMOJI[choice]} ${choice}`)
          );
        } else {
          opponentRow.addComponents(
            new ButtonBuilder()
              .setCustomId(ctx.makeId(`noop-${round}-o-${choice}`))
              .setStyle(ButtonStyle.Secondary)
              .setLabel(`${CHOICE_EMOJI[choice]} ${choice}`)
              .setDisabled(true)
          );
        }
      }

      await ctx.render({ embeds: [embed], components: [challengerRow, opponentRow] });
      ctx.setTimeout(`rps-${round}-challenger`, 20_000, async () => forfeitRound('opponent', 'Challenger did not choose in time.'));
      ctx.setTimeout(`rps-${round}-opponent`, 20_000, async () => forfeitRound('challenger', 'Opponent did not choose in time.'));
    }

    async function handlePick(playerKey, choice, interaction) {
      ctx.clearTimeout(`rps-${round}-${playerKey}`);
      await interaction.deferUpdate();
      picks[playerKey] = choice;
      await renderState('Waiting for both players to lock in.');
      await evaluateRound();
    }

    async function forfeitRound(winnerKey, reason) {
      ctx.clearTimeout(`rps-${round}-challenger`);
      ctx.clearTimeout(`rps-${round}-opponent`);
      picks.challenger = null;
      picks.opponent = null;
      scores[winnerKey] += 1;
      const winnerId = winnerKey === 'challenger' ? ctx.challengerId : ctx.opponentId;
      await ctx.render({
        embeds: [
          new EmbedBuilder()
            .setTitle(`Rock Paper Scissors — Round ${round}`)
            .setColor(0xe67e22)
            .setDescription(`${reason}\n\nScore — <@${ctx.challengerId}>: **${scores.challenger}** | <@${ctx.opponentId}>: **${scores.opponent}**`),
        ],
        components: [],
      });
      await finishRound(winnerKey, true);
    }

    async function evaluateRound() {
      if (!picks.challenger || !picks.opponent) {
        return;
      }

      ctx.clearTimeout(`rps-${round}-challenger`);
      ctx.clearTimeout(`rps-${round}-opponent`);

      if (picks.challenger === picks.opponent) {
        picks.challenger = null;
        picks.opponent = null;
        await renderState('Tie! Re-select your moves.');
        return;
      }

      const winnerKey = beats(picks.challenger, picks.opponent) ? 'challenger' : 'opponent';
      scores[winnerKey] += 1;
      const embed = new EmbedBuilder()
        .setTitle(`Rock Paper Scissors — Round ${round}`)
        .setColor(0xe67e22)
        .setDescription(
          [
            `<@${ctx.challengerId}> chose ${CHOICE_EMOJI[picks.challenger]} ${picks.challenger}.`,
            `<@${ctx.opponentId}> chose ${CHOICE_EMOJI[picks.opponent]} ${picks.opponent}.`,
            '',
            `<@${winnerKey === 'challenger' ? ctx.challengerId : ctx.opponentId}> wins the round!`,
            '',
            `Score — <@${ctx.challengerId}>: **${scores.challenger}** | <@${ctx.opponentId}>: **${scores.opponent}**`,
          ].join('\n')
        );

      await ctx.render({ embeds: [embed], components: [] });
      picks.challenger = null;
      picks.opponent = null;

      await finishRound(winnerKey, false);
    }

    async function finishRound(winnerKey, fromForfeit) {
      if (scores[winnerKey] >= 2) {
        const winnerId = winnerKey === 'challenger' ? ctx.challengerId : ctx.opponentId;
        const loserId = winnerKey === 'challenger' ? ctx.opponentId : ctx.challengerId;
        await ctx.end(winnerId, loserId, {
          summary: fromForfeit
            ? `Match ended ${scores.challenger}-${scores.opponent} (timeout).`
            : `Match ended ${scores.challenger}-${scores.opponent}.`,
        });
        return;
      }

      round += 1;
      await renderState('Next round! Make your selection.');
    }

    await renderState();
  },
};
