import crypto from 'crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { presentGame } from '../../ui/presentGame.js';
import { labelForUser } from '../../ui/labelForUser.js';

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const MAX_ATTEMPTS = 3;
const TURN_TIMEOUT_MS = 20000;

export const guessNumberGame = {
  key: 'guess_number',
  name: 'Guess the Number',
  async start(ctx) {
    let target = crypto.randomInt(1, 10);
    let current = 'p1';
    let turnCounter = 1;
    const attempts = {
      p1: [],
      p2: [],
    };

    const playerLabel = (slot, options = {}) =>
      labelForUser(slot === 'p1' ? ctx.p1 : ctx.p2, slot === 'p1' ? ctx.challengerId : ctx.opponentId, {
        fallback: slot === 'p1' ? 'Player 1' : 'Player 2',
        ...options,
      });

    function switchTurn() {
      current = current === 'p1' ? 'p2' : 'p1';
      turnCounter += 1;
    }

    function attemptsLeft(slot) {
      return MAX_ATTEMPTS - attempts[slot].length;
    }

    function buildButtons() {
      const rows = [];
      for (let i = 0; i < NUMBERS.length; i += 3) {
        const row = new ActionRowBuilder();
        for (let j = i; j < i + 3 && j < NUMBERS.length; j += 1) {
          const value = NUMBERS[j];
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(
                ctx.registerAction({ player: current, action: `guess-${value}` }, async (interaction) => {
                  const expectedId = current === 'p1' ? ctx.challengerId : ctx.opponentId;
                  if (interaction.user.id !== expectedId) {
                    await interaction.reply({
                      ephemeral: true,
                      content: 'Please wait — it is not your turn.',
                    });
                    return;
                  }

                  ctx.clearTimeout(`guess-${turnCounter}`);

                  if (attempts[current].includes(value)) {
                    await interaction.reply({ ephemeral: true, content: 'You already tried that number!' });
                    return;
                  }

                  attempts[current].push(value);
                  await interaction.deferUpdate();

                  if (value === target) {
                    await presentGame(ctx, {
                      title: '🔢 Guess the Number',
                      description: `🟩 Correct! ${value} was the secret number.`,
                      extraLines: [renderAttemptLog()],
                      status: 'victory',
                    });
                    const winnerId = current === 'p1' ? ctx.challengerId : ctx.opponentId;
                    const loserId = current === 'p1' ? ctx.opponentId : ctx.challengerId;
                    await ctx.end(winnerId, loserId, { summary: `Guessed ${value} correctly.` });
                    return;
                  }

                  let hint = value < target ? '⬆️ Too low!' : '⬇️ Too high!';
                  if (attemptsLeft(current) <= 0) {
                    hint += ' No attempts left for you!';
                  }

                  switchTurn();

                  if (attemptsLeft('p1') <= 0 && attemptsLeft('p2') <= 0) {
                    target = crypto.randomInt(1, 10);
                    attempts.p1 = [];
                    attempts.p2 = [];
                    current = crypto.randomInt(2) === 0 ? 'p1' : 'p2';
                    await presentGame(ctx, {
                      title: '🔢 Guess the Number',
                      description: `${hint}\n\n🤝 Both players exhausted their guesses. New number hidden!`,
                      extraLines: [renderAttemptLog()],
                      status: 'neutral',
                    });
                    await render('🎲 Fresh number locked. Try again fast!');
                    return;
                  }

                  await render(`${hint} ${playerLabel(current, { emphasize: true })}, your move!`);
                })
              )
              .setLabel(`${value}`)
              .setStyle(ButtonStyle.Primary)
          );
        }
        rows.push(row);
      }

      const waitingFor = current === 'p1' ? 'p2' : 'p1';
      rows.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(ctx.makeId({ player: waitingFor, action: 'wait' }))
            .setLabel('Waiting for other player…')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        )
      );

      return rows;
    }

    function renderAttemptLog() {
      const p1 = attempts.p1.length ? attempts.p1.join(', ') : 'None';
      const p2 = attempts.p2.length ? attempts.p2.join(', ') : 'None';
      return [
        `${playerLabel('p1', { emphasize: true })} Attempts: ${p1}`,
        `${playerLabel('p2', { emphasize: true })} Attempts: ${p2}`,
      ].join('\n');
    }

    async function render(message) {
      ctx.clearActions();
      ctx.clearTimeout(`guess-${turnCounter - 1}`);
      await presentGame(ctx, {
        title: '🔢 Guess the Number',
        description: message ?? 'A secret number between 1 and 9 glows behind the curtain.',
        extraLines: [
          renderAttemptLog(),
          `Attempts left — ${playerLabel('p1')}: ${attemptsLeft('p1')} | ${playerLabel('p2')}: ${attemptsLeft('p2')}`,
        ],
        components: buildButtons(),
        turnUserId: current === 'p1' ? ctx.challengerId : ctx.opponentId,
        status: 'neutral',
      });

      ctx.setTimeout(`guess-${turnCounter}`, TURN_TIMEOUT_MS, async () => {
        const winnerKey = current === 'p1' ? 'p2' : 'p1';
        const winnerId = winnerKey === 'p1' ? ctx.challengerId : ctx.opponentId;
        const loserId = winnerKey === 'p1' ? ctx.opponentId : ctx.challengerId;
        await presentGame(ctx, {
          title: '🔢 Guess the Number',
          description: `⌛ Time slipped away — ${playerLabel(winnerKey, { emphasize: true })} wins by default.`,
          extraLines: [renderAttemptLog()],
          status: 'defeat',
        });
        await ctx.end(winnerId, loserId, { summary: 'Opponent timed out.' });
      });
    }

    await render('🎲 Guess wisely! P1 begins the hunt.');
  },
};
