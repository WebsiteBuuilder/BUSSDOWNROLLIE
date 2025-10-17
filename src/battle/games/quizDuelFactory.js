import crypto from 'crypto';
import { ButtonBuilder, ButtonStyle } from 'discord.js';
import { presentGame } from '../ui/presentGame.js';

function defaultEvaluate({ roundData, picks }) {
  const correctOption = roundData.correctOption;
  const challengerPick = picks.challenger;
  const opponentPick = picks.opponent;

  const challengerCorrect = challengerPick?.optionId === correctOption;
  const opponentCorrect = opponentPick?.optionId === correctOption;

  if (challengerCorrect && !opponentCorrect) {
    return {
      winnerKey: 'challenger',
      challengerPoints: 1,
      opponentPoints: 0,
      status: 'Challenger scores with the correct answer!',
    };
  }

  if (!challengerCorrect && opponentCorrect) {
    return {
      winnerKey: 'opponent',
      challengerPoints: 0,
      opponentPoints: 1,
      status: 'Opponent gets the point with the right call!',
    };
  }

  if (challengerCorrect && opponentCorrect) {
    if (!challengerPick || !opponentPick) {
      return {
        winnerKey: null,
        challengerPoints: 0,
        opponentPoints: 0,
        status: 'Both players responded, but timing data was missing.',
      };
    }

    if (challengerPick.timestamp === opponentPick.timestamp) {
      const winnerKey = crypto.randomInt(2) === 0 ? 'challenger' : 'opponent';
      return {
        winnerKey,
        challengerPoints: winnerKey === 'challenger' ? 1 : 0,
        opponentPoints: winnerKey === 'opponent' ? 1 : 0,
        status: `${winnerKey === 'challenger' ? 'Challenger' : 'Opponent'} wins the speed tie!`,
      };
    }

    const winnerKey = challengerPick.timestamp < opponentPick.timestamp ? 'challenger' : 'opponent';
    return {
      winnerKey,
      challengerPoints: winnerKey === 'challenger' ? 1 : 0,
      opponentPoints: winnerKey === 'opponent' ? 1 : 0,
      status: `${winnerKey === 'challenger' ? 'Challenger' : 'Opponent'} answered correctly first for the point!`,
    };
  }

  return {
    winnerKey: null,
    challengerPoints: 0,
    opponentPoints: 0,
    status: 'Nobody found the right answer this round.',
  };
}

export function createQuizDuelGame(config) {
  const {
    key,
    name,
    totalRounds = 5,
    color = 0x5865f2,
    createRound,
    describeRound,
    roundFields,
    evaluateRound = defaultEvaluate,
    footer,
  } = config;

  if (!key || !name || typeof createRound !== 'function') {
    throw new Error('createQuizDuelGame requires key, name, and createRound function.');
  }

  return {
    key,
    name,
    async start(ctx) {
      const scores = { challenger: 0, opponent: 0 };
      const history = [];
      let roundNumber = 1;
      let activeRound = null;
      let statusMessage = 'Make your selection before the timer hits zero!';

      function serializeRound(round) {
        if (!round) return null;
        return {
          prompt: round.data.prompt,
          options: round.data.options.map((option) => option.label),
          correctOption: round.data.correctOption,
          countdown: round.countdown,
          picks: {
            challenger: round.picks.challenger ? round.picks.challenger.optionId : null,
            opponent: round.picks.opponent ? round.picks.opponent.optionId : null,
          },
        };
      }

      async function saveSnapshot() {
        ctx.saveSnapshot({
          key,
          name,
          round: roundNumber,
          totalRounds,
          scores,
          statusMessage,
          history,
          activeRound: serializeRound(activeRound),
        });
      }

      async function render(descriptionOverride) {
        const description =
          descriptionOverride ??
          describeRound?.({ round: roundNumber, totalRounds, scores, roundData: activeRound?.data }) ??
            activeRound?.data.prompt ??
            'Select the best option.';
        const fields = roundFields?.({ round: roundNumber, totalRounds, roundData: activeRound?.data }) ?? [];

        const challengerControls = [];
        const opponentControls = [];

        if (activeRound) {
          for (const optionEntry of activeRound.options) {
            const challengerButton = new ButtonBuilder()
              .setCustomId(optionEntry.challengerId)
              .setLabel(optionEntry.option.label)
              .setStyle(optionEntry.option.style ?? ButtonStyle.Primary)
              .setDisabled(Boolean(activeRound.picks.challenger) || activeRound.resolved);

            const opponentButton = new ButtonBuilder()
              .setCustomId(optionEntry.opponentId)
              .setLabel(optionEntry.option.label)
              .setStyle(optionEntry.option.style ?? ButtonStyle.Secondary)
              .setDisabled(Boolean(activeRound.picks.opponent) || activeRound.resolved);

            challengerControls.push(challengerButton);
            opponentControls.push(opponentButton);
          }
        }

        await saveSnapshot();
        await presentGame(ctx, {
          title: name,
          round: roundNumber,
          totalRounds,
          challengerId: ctx.challengerId,
          opponentId: ctx.opponentId,
          challengerScore: scores.challenger,
          opponentScore: scores.opponent,
          description,
          fields,
          challengerControls,
          opponentControls,
          footer,
          color,
          countdown: activeRound?.countdown ?? null,
          status: statusMessage,
        });
      }

      function stopCountdown() {
        if (!activeRound) return;
        if (activeRound.interval) {
          clearInterval(activeRound.interval);
          activeRound.interval = null;
        }
        if (activeRound.timeoutKey) {
          ctx.clearTimeout(activeRound.timeoutKey);
          activeRound.timeoutKey = null;
        }
      }

      async function finishRound(reason) {
        if (!activeRound || activeRound.resolved) {
          return;
        }
        stopCountdown();
        activeRound.resolved = true;

        const result = evaluateRound({
          roundData: activeRound.data,
          picks: activeRound.picks,
          reason,
          scores: { ...scores },
        });

        if (result.challengerPoints) {
          scores.challenger += result.challengerPoints;
        }

        if (result.opponentPoints) {
          scores.opponent += result.opponentPoints;
        }

        history.push({
          round: roundNumber,
          picks: {
            challenger: activeRound.picks.challenger ? { ...activeRound.picks.challenger } : null,
            opponent: activeRound.picks.opponent ? { ...activeRound.picks.opponent } : null,
          },
          correct: activeRound.data.correctOption,
          winnerKey: result.winnerKey ?? null,
        });

        statusMessage = result.status ?? statusMessage;
        activeRound.data.revealed = true;
        await render();

        if (roundNumber >= totalRounds) {
          await concludeMatch();
          return;
        }

        roundNumber += 1;
        await startRound();
      }

      async function concludeMatch() {
        const challengerScore = scores.challenger;
        const opponentScore = scores.opponent;

        let winnerKey = null;
        if (challengerScore > opponentScore) {
          winnerKey = 'challenger';
        } else if (opponentScore > challengerScore) {
          winnerKey = 'opponent';
        } else {
          winnerKey = crypto.randomInt(2) === 0 ? 'challenger' : 'opponent';
          statusMessage = `${statusMessage}\nTiebreaker coin flip awards the win to ${winnerKey === 'challenger' ? 'challenger' : 'opponent'}.`;
        }

        const winnerId = winnerKey === 'challenger' ? ctx.challengerId : ctx.opponentId;
        const loserId = winnerKey === 'challenger' ? ctx.opponentId : ctx.challengerId;

        statusMessage = `${statusMessage}\nFinal score — ${scores.challenger}-${scores.opponent}.`;
        await saveSnapshot();
        await ctx.end(winnerId, loserId, {
          summary: `Final score ${scores.challenger}-${scores.opponent}.`,
        });
      }

      async function handleTimeout() {
        statusMessage = 'Time expired — no new responses allowed.';
        await finishRound('timeout');
      }

      async function startRound() {
        ctx.clearActions();
        const rng = {
          int: (max) => crypto.randomInt(max),
          range: (min, max) => crypto.randomInt(min, max),
          pick: (items) => items[crypto.randomInt(items.length)],
        };

        const roundData = createRound({
          round: roundNumber,
          totalRounds,
          scores: { ...scores },
          rng,
        });

        if (!roundData || !Array.isArray(roundData.options) || roundData.options.length === 0) {
          throw new Error(`Round definition for ${name} is missing options.`);
        }

        activeRound = {
          data: roundData,
          picks: { challenger: null, opponent: null },
          options: [],
          countdown: 20,
          resolved: false,
          interval: null,
          timeoutKey: null,
        };

        for (const option of roundData.options) {
          const challengerId = ctx.registerAction(`${key}-${roundNumber}-c-${option.id}`, async (interaction) => {
            if (interaction.user.id !== ctx.challengerId) {
              await interaction.reply({ ephemeral: true, content: 'Only the challenger can pick here.' });
              return;
            }

            if (activeRound.resolved) {
              await interaction.reply({ ephemeral: true, content: 'This round is already resolved.' });
              return;
            }

            if (activeRound.picks.challenger) {
              await interaction.reply({ ephemeral: true, content: 'You already locked your choice.' });
              return;
            }

            await interaction.deferUpdate();
            activeRound.picks.challenger = { optionId: option.id, timestamp: Date.now() };
            statusMessage = 'Waiting for opponent to answer…';
            await render();
            if (activeRound.picks.opponent) {
              await finishRound('both-answered');
            }
          });

          const opponentId = ctx.registerAction(`${key}-${roundNumber}-o-${option.id}`, async (interaction) => {
            if (interaction.user.id !== ctx.opponentId) {
              await interaction.reply({ ephemeral: true, content: 'Only the opponent can pick here.' });
              return;
            }

            if (activeRound.resolved) {
              await interaction.reply({ ephemeral: true, content: 'This round is already resolved.' });
              return;
            }

            if (activeRound.picks.opponent) {
              await interaction.reply({ ephemeral: true, content: 'You already locked your choice.' });
              return;
            }

            await interaction.deferUpdate();
            activeRound.picks.opponent = { optionId: option.id, timestamp: Date.now() };
            statusMessage = 'Waiting for challenger to answer…';
            await render();
            if (activeRound.picks.challenger) {
              await finishRound('both-answered');
            }
          });

          activeRound.options.push({ option, challengerId, opponentId });
        }

        statusMessage = 'Make your selections!';
        await render(roundData.prompt);

        const timeoutKey = `${key}-${roundNumber}-timeout`;
        activeRound.timeoutKey = timeoutKey;
        ctx.setTimeout(timeoutKey, 20_000, handleTimeout);
        activeRound.interval = setInterval(async () => {
          if (!activeRound || activeRound.resolved) {
            return;
          }
          activeRound.countdown -= 1;
          if (activeRound.countdown <= 0) {
            clearInterval(activeRound.interval);
            activeRound.interval = null;
            return;
          }
          await render();
        }, 1000);
        activeRound.interval?.unref?.();
      }

      await startRound();
    },
  };
}
