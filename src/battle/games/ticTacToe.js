import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { presentGame } from '../../ui/presentGame.js';

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const SYMBOLS = {
  p1: '🟥',
  p2: '🟦',
};

const TURN_TIMEOUT_MS = 20000;

export const ticTacToeGame = {
  key: 'tic_tac_toe',
  name: 'Tic Tac Toe',
  async start(ctx) {
    let board = Array(9).fill(null);
    let current = 'p1';
    let turnCounter = 1;

    function markFor(slot) {
      return SYMBOLS[slot];
    }

    function renderBoardLines() {
      const rows = [
        board.slice(0, 3),
        board.slice(3, 6),
        board.slice(6, 9),
      ];
      return rows
        .map((row) => row.map((cell) => (cell ? SYMBOLS[cell] : '⬛')).join(''))
        .join('\n');
    }

    function checkWin(slot) {
      return WIN_LINES.some((line) => line.every((index) => board[index] === slot));
    }

    function boardFull() {
      return board.every((cell) => cell !== null);
    }

    function waitingRow(forSlot) {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(ctx.makeId({ player: forSlot, action: 'wait' }))
          .setLabel('Waiting for other player…')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
    }

    function buildBoardComponents() {
      const components = [];

      for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
        const row = new ActionRowBuilder();
        for (let colIndex = 0; colIndex < 3; colIndex += 1) {
          const index = rowIndex * 3 + colIndex;
          const filled = board[index];
          if (filled) {
            row.addComponents(
              new ButtonBuilder()
                .setCustomId(ctx.makeId({ player: current, action: `filled-${index}` }))
                .setLabel(markFor(filled))
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
            );
          } else {
            row.addComponents(
              new ButtonBuilder()
                .setCustomId(
                  ctx.registerAction({ player: current, action: `cell-${index}` }, async (interaction) => {
                    const expectedUserId = current === 'p1' ? ctx.challengerId : ctx.opponentId;
                    if (interaction.user.id !== expectedUserId) {
                      await interaction.reply({
                        ephemeral: true,
                        content: 'Only the active player can make a move.',
                      });
                      return;
                    }

                    ctx.clearTimeout(`ttt-${turnCounter}`);
                    board[index] = current;
                    await interaction.deferUpdate();

                    const playerMention = current === 'p1' ? `<@${ctx.challengerId}>` : `<@${ctx.opponentId}>`;
                    const moveMessage = `✨ ${playerMention} claims a tile!`;

                    if (checkWin(current)) {
                      await presentGame(ctx, {
                        title: '⚔️ Tic Tac Toe',
                        description: `${moveMessage}\n\n🟩 ${playerMention} connects three!`,
                        extraLines: [renderBoardLines()],
                        status: 'victory',
                      });
                      const winnerId = current === 'p1' ? ctx.challengerId : ctx.opponentId;
                      const loserId = current === 'p1' ? ctx.opponentId : ctx.challengerId;
                      await ctx.end(winnerId, loserId, { summary: 'Three in a row!' });
                      return;
                    }

                    if (boardFull()) {
                      await presentGame(ctx, {
                        title: '⚔️ Tic Tac Toe',
                        description: `${moveMessage}\n\n🤝 Stalemate! Resetting the board for another clash.`,
                        extraLines: [renderBoardLines()],
                        status: 'neutral',
                      });
                      board = Array(9).fill(null);
                      current = current === 'p1' ? 'p2' : 'p1';
                      turnCounter += 1;
                      await render('🎬 Fresh board! React fast.');
                      return;
                    }

                    current = current === 'p1' ? 'p2' : 'p1';
                    turnCounter += 1;
                    await render(moveMessage);
                  })
                )
                .setLabel('⬛')
                .setStyle(ButtonStyle.Primary)
            );
          }
        }
        components.push(row);
      }

      const waitingFor = current === 'p1' ? 'p2' : 'p1';
      components.push(waitingRow(waitingFor));

      return components;
    }

    async function render(message) {
      ctx.clearActions();
      ctx.clearTimeout(`ttt-${turnCounter - 1}`);

      const components = buildBoardComponents();
      await presentGame(ctx, {
        title: '⚔️ Tic Tac Toe',
        description: message ?? '🌀 The grid hums with energy. Claim your tiles!',
        extraLines: [renderBoardLines()],
        components,
        turnUserId: current === 'p1' ? ctx.challengerId : ctx.opponentId,
        status: 'neutral',
      });

      ctx.setTimeout(`ttt-${turnCounter}`, TURN_TIMEOUT_MS, async () => {
        const winnerKey = current === 'p1' ? 'p2' : 'p1';
        const winnerId = winnerKey === 'p1' ? ctx.challengerId : ctx.opponentId;
        const loserId = winnerKey === 'p1' ? ctx.opponentId : ctx.challengerId;
        await presentGame(ctx, {
          title: '⚔️ Tic Tac Toe',
          description: '⏳ Time drained away! Opponent seizes victory.',
          extraLines: [renderBoardLines()],
          status: 'defeat',
        });
        await ctx.end(winnerId, loserId, { summary: 'Win by timeout.' });
      });
    }

    await render('🎬 The board materializes. P1 takes the first strike!');
  },
};
