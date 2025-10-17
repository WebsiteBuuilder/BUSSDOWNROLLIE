import crypto from 'crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck() {
  const deck = [];
  for (const suit of suits) {
    for (let index = 0; index < ranks.length; index += 1) {
      const rank = ranks[index];
      deck.push({ rank, suit, value: index });
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function formatCard(card) {
  return `${card.rank}${card.suit}`;
}

export const hiLowDrawGame = {
  key: 'hi_low_draw',
  name: 'Hi–Low Draw',
  async start(ctx) {
    const deck = shuffleDeck(createDeck());
    let deckIndex = 0;
    let round = 1;
    const scores = { challenger: 0, opponent: 0 };

    async function concludeMatch(winnerKey, reason) {
      const winnerId = winnerKey === 'challenger' ? ctx.challengerId : ctx.opponentId;
      const loserId = winnerKey === 'challenger' ? ctx.opponentId : ctx.challengerId;
      await ctx.end(winnerId, loserId, {
        summary: `Final score ${scores.challenger}-${scores.opponent}. ${reason ?? ''}`.trim(),
      });
    }

    const drawState = {
      challenger: null,
      opponent: null,
    };

    function nextCard() {
      if (deckIndex >= deck.length) {
        throw new Error('deck exhausted');
      }
      const card = deck[deckIndex];
      deckIndex += 1;
      return card;
    }

    async function renderRound(message, buttons = true) {
      ctx.clearActions();

      const embed = new EmbedBuilder()
        .setTitle(`Hi–Low Draw — Round ${round}`)
        .setColor(0x1abc9c)
        .setDescription(
          [
            `First to 3 round wins. Stake: ${ctx.amount} VP`,
            '',
            `Score — <@${ctx.challengerId}>: **${scores.challenger}** | <@${ctx.opponentId}>: **${scores.opponent}**`,
            '',
            message ?? 'Both players click **Draw** to reveal cards simultaneously.',
          ].join('\n')
        );

      if (drawState.challenger) {
        embed.addFields({
          name: `Challenger`,
          value: `${formatCard(drawState.challenger)}`,
          inline: true,
        });
      } else {
        embed.addFields({ name: 'Challenger', value: 'Awaiting draw…', inline: true });
      }

      if (drawState.opponent) {
        embed.addFields({ name: 'Opponent', value: `${formatCard(drawState.opponent)}`, inline: true });
      } else {
        embed.addFields({ name: 'Opponent', value: 'Awaiting draw…', inline: true });
      }

      const components = [];
      if (buttons) {
        const row = new ActionRowBuilder();
        const challengerDisabled = Boolean(drawState.challenger);
        const opponentDisabled = Boolean(drawState.opponent);

        if (!challengerDisabled) {
          const challengerId = ctx.registerAction(`hldraw-${round}-challenger`, async (interaction) => {
            if (interaction.user.id !== ctx.challengerId) {
              await interaction.reply({ ephemeral: true, content: 'This button is for the challenger.' });
              return;
            }
            await handleDraw('challenger', interaction);
          });
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(challengerId)
              .setStyle(ButtonStyle.Primary)
              .setLabel('Draw (Challenger)')
          );
        } else {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(ctx.makeId(`noop-${round}-c`))
              .setStyle(ButtonStyle.Secondary)
              .setLabel('Drawn')
              .setDisabled(true)
          );
        }

        if (!opponentDisabled) {
          const opponentId = ctx.registerAction(`hldraw-${round}-opponent`, async (interaction) => {
            if (interaction.user.id !== ctx.opponentId) {
              await interaction.reply({ ephemeral: true, content: 'This button is for the opponent.' });
              return;
            }
            await handleDraw('opponent', interaction);
          });
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(opponentId)
              .setStyle(ButtonStyle.Primary)
              .setLabel('Draw (Opponent)')
          );
        } else {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(ctx.makeId(`noop-${round}-o`))
              .setStyle(ButtonStyle.Secondary)
              .setLabel('Drawn')
              .setDisabled(true)
          );
        }

        components.push(row);
      }

      await ctx.render({ embeds: [embed], components });
    }

    function scheduleRoundTimeout(playerKey) {
      const timeoutKey = `round-${round}-${playerKey}`;
      ctx.setTimeout(timeoutKey, 10_000, async () => {
        const winnerKey = playerKey === 'challenger' ? 'opponent' : 'challenger';
        scores[winnerKey] += 1;
        drawState.challenger = null;
        drawState.opponent = null;
        const forfeiterId = playerKey === 'challenger' ? ctx.challengerId : ctx.opponentId;
        const message = `<@${forfeiterId}> did not draw in time — round awarded to <@${winnerKey === 'challenger' ? ctx.challengerId : ctx.opponentId}>.`;
        await renderRound(message, false);
        await handleRoundEnd(winnerKey, true);
      });
    }

    async function handleDraw(playerKey, interaction) {
      ctx.clearTimeout(`round-${round}-${playerKey}`);
      await interaction.deferUpdate();
      drawState[playerKey] = nextCard();
      await renderRound('Waiting for both players to draw…');
      await evaluateRound();
    }

    async function evaluateRound() {
      if (!drawState.challenger || !drawState.opponent) {
        return;
      }

      const challengerCard = drawState.challenger;
      const opponentCard = drawState.opponent;

      if (challengerCard.value === opponentCard.value) {
        drawState.challenger = null;
        drawState.opponent = null;
        await renderRound('Tie on rank — redraw immediately!');
        scheduleRoundTimeout('challenger');
        scheduleRoundTimeout('opponent');
        return;
      }

      const winnerKey = challengerCard.value > opponentCard.value ? 'challenger' : 'opponent';
      scores[winnerKey] += 1;

      const winnerId = winnerKey === 'challenger' ? ctx.challengerId : ctx.opponentId;
      const loserId = winnerKey === 'challenger' ? ctx.opponentId : ctx.challengerId;
      await ctx.render({
        embeds: [
          new EmbedBuilder()
            .setTitle(`Hi–Low Draw — Round ${round}`)
            .setColor(0x1abc9c)
            .setDescription(
              [
                `Cards revealed!`,
                `• <@${ctx.challengerId}> drew **${formatCard(challengerCard)}**`,
                `• <@${ctx.opponentId}> drew **${formatCard(opponentCard)}**`,
                '',
                `<@${winnerId}> wins the round!`,
                '',
                `Score — <@${ctx.challengerId}>: **${scores.challenger}** | <@${ctx.opponentId}>: **${scores.opponent}**`,
              ].join('\n')
            ),
        ],
        components: [],
      });

      drawState.challenger = null;
      drawState.opponent = null;

      await handleRoundEnd(winnerKey, false);
    }

    async function handleRoundEnd(winnerKey, fromForfeit) {
      ctx.clearTimeout(`round-${round}-challenger`);
      ctx.clearTimeout(`round-${round}-opponent`);

      if (scores[winnerKey] >= 3) {
        await concludeMatch(winnerKey, fromForfeit ? 'Win via opponent timeout.' : undefined);
        return;
      }

      if (round >= 5) {
        const overallWinner = scores.challenger > scores.opponent ? 'challenger' : 'opponent';
        await concludeMatch(overallWinner);
        return;
      }

      round += 1;
      await renderRound('Next round — draw your cards!');
      scheduleRoundTimeout('challenger');
      scheduleRoundTimeout('opponent');
    }

    await renderRound('Both players click **Draw** to reveal cards.');
    scheduleRoundTimeout('challenger');
    scheduleRoundTimeout('opponent');
  },
};
