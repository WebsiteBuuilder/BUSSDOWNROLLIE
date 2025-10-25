import crypto from 'crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { presentGame } from '../../ui/presentGame.js';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const TURN_TIMEOUT_MS = 20000;

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

function shuffle(deck) {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function cardValue(card) {
  if (card.rank === 'A') return 11;
  if (['K', 'Q', 'J'].includes(card.rank)) return 10;
  return parseInt(card.rank, 10);
}

function handValue(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === 'A') {
      aces += 1;
    }
    total += cardValue(card);
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function formatCard(card) {
  return `${card.rank}${card.suit}`;
}

function formatHand(hand) {
  if (!hand.length) return '—';
  return `${hand.map(formatCard).join(' ')}`;
}

export const blackjackBattleGame = {
  key: 'blackjack_battle',
  name: 'Blackjack Battle',
  async start(ctx) {
    let deck = shuffle(createDeck());
    const hands = {
      p1: [],
      p2: [],
    };
    const status = {
      p1: 'playing',
      p2: 'waiting',
    };
    let current = 'p1';
    let turnCounter = 1;
    let resolved = false;

    function drawCard() {
      if (deck.length === 0) {
        deck = shuffle(createDeck());
      }
      return deck.pop();
    }

    function buildButtons() {
      const rows = [];
      const waitSlot = current === 'p1' ? 'p2' : 'p1';

      rows.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(
              ctx.registerAction({ player: current, action: 'hit' }, async (interaction) => {
                const expectedId = current === 'p1' ? ctx.challengerId : ctx.opponentId;
                if (interaction.user.id !== expectedId) {
                  await interaction.reply({ ephemeral: true, content: 'Not your turn to act.' });
                  return;
                }

                ctx.clearTimeout(`bj-${turnCounter}`);
                hands[current].push(drawCard());
                await interaction.deferUpdate();

                if (handValue(hands[current]) > 21) {
                  status[current] = 'bust';
                  await presentState(`${formatHand(hands[current])} — 💥 Bust!`);
                  await finalize(current === 'p1' ? 'p2' : 'p1', `${formatHand(hands[current])} went over 21.`);
                  return;
                }

                await presentState('🃏 A fresh card hits your hand.');
                nextTurn();
                await render();
              })
            )
            .setLabel('🃏 Hit (you)')
            .setStyle(ButtonStyle.Success)
        )
      );

      rows.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(
              ctx.registerAction({ player: current, action: 'stand' }, async (interaction) => {
                const expectedId = current === 'p1' ? ctx.challengerId : ctx.opponentId;
                if (interaction.user.id !== expectedId) {
                  await interaction.reply({ ephemeral: true, content: 'Not your decision to make.' });
                  return;
                }

                ctx.clearTimeout(`bj-${turnCounter}`);
                status[current] = 'stand';
                await interaction.deferUpdate();
                await presentState('✋ You hold your ground.');

                if (status.p1 === 'stand' && status.p2 === 'stand') {
                  await resolveShowdown('Both players stand. Comparing totals...');
                  return;
                }

                nextTurn();
                await render();
              })
            )
            .setLabel('✋ Stand (you)')
            .setStyle(ButtonStyle.Secondary)
        )
      );

      rows.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(ctx.makeId({ player: waitSlot, action: 'wait' }))
            .setLabel('Waiting for other player…')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        )
      );

      return rows;
    }

    function nextTurn() {
      if (resolved) return;
      current = current === 'p1' ? 'p2' : 'p1';
      if (status[current] === 'bust') {
        current = current === 'p1' ? 'p2' : 'p1';
      }
      if (status[current] === 'stand') {
        if (status.p1 === 'stand' && status.p2 === 'stand') {
          return;
        }
        current = current === 'p1' ? 'p2' : 'p1';
      }
      turnCounter += 1;
    }

    async function presentState(message) {
      await presentGame(ctx, {
        title: '🃏 Blackjack Battle',
        description: message,
        fields: buildFields(),
        status: 'neutral',
      });
    }

    function buildFields() {
      return [
        {
          name: ctx.p1?.displayName ?? 'Player 1',
          value: `${formatHand(hands.p1)}\nTotal: ${handValue(hands.p1)}`,
          inline: true,
        },
        {
          name: ctx.p2?.displayName ?? 'Player 2',
          value: `${formatHand(hands.p2)}\nTotal: ${handValue(hands.p2)}`,
          inline: true,
        },
      ];
    }

    async function resolveShowdown(message) {
      const p1Total = handValue(hands.p1);
      const p2Total = handValue(hands.p2);

      if (p1Total === p2Total) {
        hands.p1.push(drawCard());
        hands.p2.push(drawCard());
        await presentGame(ctx, {
          title: '🃏 Blackjack Battle',
          description: `${message}\n🤝 Tie! Drawing one more card each...`,
          fields: buildFields(),
          status: 'neutral',
        });
        await resolveShowdown('Sudden death draw');
        return;
      }

      const winnerSlot = p1Total > p2Total ? 'p1' : 'p2';
      await finalize(winnerSlot, `${winnerSlot === 'p1' ? 'P1' : 'P2'} wins with ${Math.max(p1Total, p2Total)}.`);
    }

    async function finalize(winnerSlot, summary) {
      if (resolved) return;
      resolved = true;
      const winnerId = winnerSlot === 'p1' ? ctx.challengerId : ctx.opponentId;
      const loserId = winnerSlot === 'p1' ? ctx.opponentId : ctx.challengerId;

      await presentGame(ctx, {
        title: '🃏 Blackjack Battle',
        description: `🏆 ${winnerSlot === 'p1' ? '<@' + ctx.challengerId + '>' : '<@' + ctx.opponentId + '>'} claims victory!`,
        fields: buildFields(),
        status: 'victory',
      });

      await ctx.end(winnerId, loserId, { summary });
    }

    async function render() {
      if (resolved) return;
      ctx.clearActions();
      ctx.clearTimeout(`bj-${turnCounter - 1}`);

      await presentGame(ctx, {
        title: '🃏 Blackjack Battle',
        description: 'Choose to hit or stand. Closest to 21 wins!',
        fields: buildFields(),
        components: buildButtons(),
        turnUserId: current === 'p1' ? ctx.challengerId : ctx.opponentId,
        status: 'neutral',
      });

      ctx.setTimeout(`bj-${turnCounter}`, TURN_TIMEOUT_MS, async () => {
        const winnerSlot = current === 'p1' ? 'p2' : 'p1';
        await presentGame(ctx, {
          title: '🃏 Blackjack Battle',
          description: '⏳ Patience ran out — your rival wins by timeout.',
          fields: buildFields(),
          status: 'defeat',
        });
        await finalize(winnerSlot, 'Won by timeout.');
      });
    }

    function initialDeal() {
      hands.p1.push(drawCard());
      hands.p2.push(drawCard());
      hands.p1.push(drawCard());
      hands.p2.push(drawCard());
    }

    initialDeal();

    const p1Total = handValue(hands.p1);
    const p2Total = handValue(hands.p2);

    if (p1Total === 21 || p2Total === 21) {
      if (p1Total === 21 && p2Total === 21) {
        await presentGame(ctx, {
          title: '🃏 Blackjack Battle',
          description: '💫 Double blackjack! Drawing one more card each...',
          fields: buildFields(),
          status: 'neutral',
        });
        hands.p1.push(drawCard());
        hands.p2.push(drawCard());
        await resolveShowdown('Sudden death draw');
        return;
      }
      const winnerSlot = p1Total === 21 ? 'p1' : 'p2';
      await finalize(winnerSlot, 'Blackjack on the opening deal.');
      return;
    }

    await render();
  },
};
