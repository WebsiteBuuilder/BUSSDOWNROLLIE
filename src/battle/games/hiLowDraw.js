import crypto from 'crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { presentGame } from '../../ui/presentGame.js';
import { labelForUser } from '../../ui/labelForUser.js';

const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck() {
  const deck = [];
  for (const suit of suits) {
    for (let index = 0; index < ranks.length; index += 1) {
      const rank = ranks[index];
      deck.push({ rank, suit, value: index + 2 });
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

const ROUND_TARGET = 3;
const ROUND_TIMEOUT_MS = 15000;

export const hiLowDrawGame = {
  key: 'hi_low_draw',
  name: 'HI-LO Showdown',
  async start(ctx) {
    const deck = shuffleDeck(createDeck());
    let deckIndex = 0;
    let round = 1;

    const scores = {
      p1: 0,
      p2: 0,
    };

    const draws = {
      p1: null,
      p2: null,
    };

    const playerLabel = (slot, options = {}) =>
      labelForUser(slot === 'p1' ? ctx.p1 : ctx.p2, slot === 'p1' ? ctx.challengerId : ctx.opponentId, {
        fallback: slot === 'p1' ? 'Player 1' : 'Player 2',
        ...options,
      });

    function nextCard() {
      if (deckIndex >= deck.length) {
        throw new Error('Deck exhausted');
      }
      const card = deck[deckIndex];
      deckIndex += 1;
      return card;
    }

    function resetRoundState() {
      draws.p1 = null;
      draws.p2 = null;
    }

    async function conclude(winnerKey, summary) {
      const winnerId = winnerKey === 'p1' ? ctx.challengerId : ctx.opponentId;
      const loserId = winnerKey === 'p1' ? ctx.opponentId : ctx.challengerId;
      await ctx.end(winnerId, loserId, { summary });
    }

    function scheduleTimeout(slot) {
      clearTimeoutFor(slot);
      ctx.setTimeout(`hi-lo-${round}-${slot}`, ROUND_TIMEOUT_MS, async () => {
        const winnerKey = slot === 'p1' ? 'p2' : 'p1';
        scores[winnerKey] += 1;
        await render(
          `⏳ ${playerLabel(slot, { emphasize: true })} hesitated too long! Point awarded to ${playerLabel(
            winnerKey,
            { emphasize: true }
          )}.`
        );
        if (scores[winnerKey] >= ROUND_TARGET) {
          await conclude(winnerKey, 'Victory by timeout.');
          return;
        }
        round += 1;
        resetRoundState();
        await render('✨ Shuffling for the next duel...');
        scheduleTimeout('p1');
        scheduleTimeout('p2');
      });
    }

    function clearTimeoutFor(slot) {
      const key = `hi-lo-${round}-${slot}`;
      ctx.clearTimeout(key);
    }

    function bothDrew() {
      return Boolean(draws.p1 && draws.p2);
    }

    function buildButtons() {
      const row = new ActionRowBuilder();
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(
            ctx.registerAction({ player: 'p1', action: `draw-${round}` }, async (interaction) => {
              if (interaction.user.id !== ctx.challengerId) {
                await interaction.reply({ ephemeral: true, content: 'This is for the challenger only.' });
                return;
              }
              clearTimeoutFor('p1');
              draws.p1 = nextCard();
              await interaction.deferUpdate();
              await render('🎴 Cards slide onto the table...');
              if (bothDrew()) {
                await resolveRound();
              }
            })
          )
          .setLabel(draws.p1 ? 'Waiting for other player…' : `🎴 Draw — ${playerLabel('p1')}`)
          .setStyle(draws.p1 ? ButtonStyle.Secondary : ButtonStyle.Primary)
          .setDisabled(Boolean(draws.p1))
      );

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(
            ctx.registerAction({ player: 'p2', action: `draw-${round}` }, async (interaction) => {
              if (interaction.user.id !== ctx.opponentId) {
                await interaction.reply({ ephemeral: true, content: 'This is for your opponent.' });
                return;
              }
              clearTimeoutFor('p2');
              draws.p2 = nextCard();
              await interaction.deferUpdate();
              await render('🎴 Cards slide onto the table...');
              if (bothDrew()) {
                await resolveRound();
              }
            })
          )
          .setLabel(draws.p2 ? 'Waiting for other player…' : `🎴 Draw — ${playerLabel('p2')}`)
          .setStyle(draws.p2 ? ButtonStyle.Secondary : ButtonStyle.Primary)
          .setDisabled(Boolean(draws.p2))
      );

      return [row];
    }

    async function render(message) {
      await presentGame(ctx, {
        title: '🎴 HI-LO Showdown',
        description: message ?? 'Both players tap **Draw** to flip their fate!',
        fields: [
          {
            name: 'Scoreboard',
            value: `${playerLabel('p1', { emphasize: true })}: ${scores.p1}\n${playerLabel('p2', {
              emphasize: true,
            })}: ${scores.p2}`,
          },
          {
            name: 'Current Reveals',
            value: `${playerLabel('p1')}: ${
              draws.p1 ? `**${formatCard(draws.p1)}**` : '🕒 Hidden'
            }\n${playerLabel('p2')}: ${draws.p2 ? `**${formatCard(draws.p2)}**` : '🕒 Hidden'}`,
          },
          {
            name: 'Round',
            value: `${round} / First to ${ROUND_TARGET}`,
            inline: true,
          },
        ],
        components: bothDrew() ? [] : buildButtons(),
        status: 'neutral',
      });
    }

    async function resolveRound() {
      const p1Card = draws.p1;
      const p2Card = draws.p2;

      if (!p1Card || !p2Card) return;

      let winnerKey = null;
      let message = '💥 Cards collide in mid-air!';

      if (p1Card.value === p2Card.value) {
        message = '🤝 Tie! Both warriors drew the same strength. Redraw!';
        await presentGame(ctx, {
          title: '🎴 HI-LO Showdown',
          description: message,
          fields: [
            {
              name: 'Reveals',
              value: `${playerLabel('p1')}: **${formatCard(p1Card)}**\n${playerLabel('p2')}: **${formatCard(
                p2Card
              )}**`,
            },
            {
              name: 'Scoreboard',
              value: `${playerLabel('p1', { emphasize: true })}: ${scores.p1}\n${playerLabel('p2', {
                emphasize: true,
              })}: ${scores.p2}`,
              inline: true,
            },
          ],
          components: [],
          status: 'neutral',
        });
        resetRoundState();
        round += 1;
        scheduleTimeout('p1');
        scheduleTimeout('p2');
        await render('🔄 Shuffling tie-breaker cards...');
        return;
      }

      if (p1Card.value > p2Card.value) {
        winnerKey = 'p1';
        scores.p1 += 1;
        message = `🟩 ${formatCard(p1Card)} overwhelms ${formatCard(p2Card)}! Point to ${playerLabel('p1', {
          emphasize: true,
        })}.`;
      } else {
        winnerKey = 'p2';
        scores.p2 += 1;
        message = `🟩 ${formatCard(p2Card)} slashes past ${formatCard(p1Card)}! Point to ${playerLabel('p2', {
          emphasize: true,
        })}.`;
      }

      resetRoundState();

      await presentGame(ctx, {
        title: '🎴 HI-LO Showdown',
        description: message,
        fields: [
          {
            name: 'Scoreboard',
            value: `${playerLabel('p1', { emphasize: true })}: ${scores.p1}\n${playerLabel('p2', {
              emphasize: true,
            })}: ${scores.p2}`,
          },
        ],
        status: scores.p1 === scores.p2 ? 'neutral' : scores.p1 > scores.p2 ? 'victory' : 'defeat',
      });

      if (scores[winnerKey] >= ROUND_TARGET) {
        await conclude(winnerKey, `Final score ${scores.p1}-${scores.p2}.`);
        return;
      }

      round += 1;
      scheduleTimeout('p1');
      scheduleTimeout('p2');
      await render('✨ Fresh steel glimmers. Tap Draw!');
    }

    scheduleTimeout('p1');
    scheduleTimeout('p2');
    await render('🔥 The arena ignites! First to three wins.');
  },
};
