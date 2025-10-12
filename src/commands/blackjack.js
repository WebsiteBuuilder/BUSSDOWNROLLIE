import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import prisma, { getOrCreateUser, hasActiveBlackjack, getConfig } from '../db/index.js';
import { formatVP } from '../lib/utils.js';
import { logTransaction } from '../lib/logger.js';
import {
  createBlackjackGame,
  hit,
  doubleDown,
  playDealer,
  calculateHandValue,
  formatHand,
  isBlackjack,
  isBust,
  canSplit,
  determineResult
} from '../lib/blackjack.js';

export const data = new SlashCommandBuilder()
  .setName('blackjack')
  .setDescription('Play blackjack')
  .addSubcommand(subcommand =>
    subcommand
      .setName('play')
      .setDescription('Start a blackjack game')
      .addIntegerOption(option =>
        option
          .setName('bet')
          .setDescription('Amount to bet')
          .setRequired(true)
          .setMinValue(1)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('rules')
      .setDescription('View blackjack rules and table limits')
  );

export async function execute(interaction, client) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'rules') {
    return showRules(interaction);
  }

  // Check if in casino channel
  if (interaction.channel.id !== process.env.CASINO_CHANNEL_ID) {
    return interaction.reply({
      content: `❌ Blackjack can only be played in <#${process.env.CASINO_CHANNEL_ID}>.`,
      ephemeral: true
    });
  }

  const bet = interaction.options.getInteger('bet');

  try {
    await interaction.deferReply();

    const user = await getOrCreateUser(interaction.user.id);

    // Check blacklist
    if (user.blacklisted) {
      return interaction.editReply({
        content: '❌ You are blacklisted and cannot play blackjack.'
      });
    }

    // Check for active game
    if (await hasActiveBlackjack(interaction.user.id)) {
      return interaction.editReply({
        content: '❌ You already have an active blackjack game. Finish it first.'
      });
    }

    // Get table limits
    const minStr = await getConfig('bj_min', '1');
    const maxStr = await getConfig('bj_max', '50');
    const min = parseInt(minStr);
    const max = parseInt(maxStr);

    if (bet < min || bet > max) {
      return interaction.editReply({
        content: `❌ Bet must be between ${formatVP(min)} and ${formatVP(max)}.`
      });
    }

    // Check balance
    if (user.vp < bet) {
      return interaction.editReply({
        content: `❌ Insufficient balance. You need ${formatVP(bet)}, but you only have ${formatVP(user.vp)}.`
      });
    }

    // Create game
    const gameState = createBlackjackGame(bet);

    // Deduct bet and create round
    const round = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { vp: { decrement: bet } }
      });

      return await tx.blackjackRound.create({
        data: {
          userId: user.id,
          amount: bet,
          state: JSON.stringify(gameState)
        }
      });
    });

    // Check for instant blackjack
    if (isBlackjack(gameState.playerHand)) {
      if (isBlackjack(gameState.dealerHand)) {
        // Push
        await resolveGame(interaction, round, gameState, user);
      } else {
        // Player blackjack!
        await resolveGame(interaction, round, gameState, user);
      }
      return;
    }

    // Show game UI
    await showGameUI(interaction, round, gameState, user);

    // Set timeout for auto-stand
    setTimeout(async () => {
      try {
        const currentRound = await prisma.blackjackRound.findUnique({ 
          where: { id: round.id },
          include: { user: true }
        });
        
        if (currentRound && !currentRound.result) {
          const state = JSON.parse(currentRound.state);
          state.playerStand = true;
          
          await resolveGame(interaction, currentRound, state, currentRound.user);
        }
      } catch (error) {
        console.error('Error in blackjack timeout:', error);
      }
    }, 60000); // 60 second timeout

  } catch (error) {
    console.error('Error in blackjack command:', error);
    await interaction.editReply({
      content: '❌ Failed to start blackjack game. Please try again.'
    });
  }
}

async function showRules(interaction) {
  const minStr = await getConfig('bj_min', '1');
  const maxStr = await getConfig('bj_max', '50');

  const embed = new EmbedBuilder()
    .setColor(0x000000)
    .setTitle('♠️ Blackjack Rules')
    .setDescription('Welcome to the GUHD EATS Blackjack table!')
    .addFields(
      { name: '📊 Table Limits', value: `Min: ${formatVP(minStr)}\nMax: ${formatVP(maxStr)}`, inline: true },
      { name: '💰 Payouts', value: 'Blackjack: 3:2\nWin: 1:1\nPush: Bet Returned', inline: true },
      { name: '🎴 Rules', value: '• Dealer hits on soft 17\n• Blackjack pays 3:2\n• Double down available\n• Split available (same value cards)', inline: false },
      { name: '⏱️ Timeout', value: 'You have 60 seconds per action or the game will auto-stand.', inline: false }
    )
    .setFooter({ text: 'Good luck at the tables!' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function showGameUI(interaction, round, gameState, user) {
  const playerValue = calculateHandValue(gameState.playerHand);
  const dealerValue = calculateHandValue([gameState.dealerHand[0]]);

  const embed = new EmbedBuilder()
    .setColor(0x000000)
    .setTitle('♠️ Blackjack')
    .addFields(
      { name: '🎴 Your Hand', value: `${formatHand(gameState.playerHand)}\n**Value:** ${playerValue}`, inline: false },
      { name: '🃏 Dealer Hand', value: `${formatHand(gameState.dealerHand, true)}\n**Showing:** ${dealerValue}`, inline: false },
      { name: '💰 Bet', value: formatVP(gameState.bet), inline: true },
      { name: '💵 Balance', value: formatVP(user.vp - gameState.bet), inline: true }
    )
    .setTimestamp();

  const row = new ActionRowBuilder();

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`bj_hit_${round.id}`)
      .setLabel('Hit')
      .setStyle(ButtonStyle.Primary)
  );

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`bj_stand_${round.id}`)
      .setLabel('Stand')
      .setStyle(ButtonStyle.Success)
  );

  // Double down only available on first two cards
  if (gameState.playerHand.length === 2 && user.vp >= gameState.bet) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`bj_double_${round.id}`)
        .setLabel('Double')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  // Split only available on matching pairs
  if (canSplit(gameState.playerHand) && user.vp >= gameState.bet && !gameState.split) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`bj_split_${round.id}`)
        .setLabel('Split')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true) // Simplified version doesn't support split yet
    );
  }

  await interaction.editReply({
    embeds: [embed],
    components: [row]
  });
}

// Handle button interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (!interaction.customId.startsWith('bj_')) return;

  const parts = interaction.customId.split('_');
  const action = parts[1];
  const roundId = parseInt(parts[2]);

  try {
    const round = await prisma.blackjackRound.findUnique({
      where: { id: roundId },
      include: { user: true }
    });

    if (!round) {
      return interaction.reply({
        content: '❌ Game not found.',
        ephemeral: true
      });
    }

    // Only the player can interact
    if (interaction.user.id !== round.user.discordId) {
      return interaction.reply({
        content: '❌ This is not your game.',
        ephemeral: true
      });
    }

    // Game already resolved
    if (round.result) {
      return interaction.reply({
        content: '❌ This game has already ended.',
        ephemeral: true
      });
    }

    await interaction.deferUpdate();

    let gameState = JSON.parse(round.state);

    switch (action) {
      case 'hit':
        gameState = hit(gameState);
        
        // Check for bust
        if (isBust(gameState.playerHand)) {
          await resolveGame(interaction, round, gameState, round.user);
        } else {
          // Update state and show UI
          await prisma.blackjackRound.update({
            where: { id: roundId },
            data: { state: JSON.stringify(gameState) }
          });
          await showGameUI(interaction, round, gameState, round.user);
        }
        break;

      case 'stand':
        gameState.playerStand = true;
        await resolveGame(interaction, round, gameState, round.user);
        break;

      case 'double':
        // Check balance
        if (round.user.vp < gameState.bet) {
          return interaction.followUp({
            content: '❌ Insufficient balance to double down.',
            ephemeral: true
          });
        }

        gameState = doubleDown(gameState);
        
        // Deduct additional bet
        await prisma.user.update({
          where: { id: round.user.id },
          data: { vp: { decrement: gameState.bet / 2 } }
        });

        await resolveGame(interaction, round, gameState, round.user);
        break;
    }

  } catch (error) {
    console.error('Error handling blackjack button:', error);
    await interaction.followUp({
      content: '❌ An error occurred. Please try again.',
      ephemeral: true
    });
  }
});

async function resolveGame(interaction, round, gameState, user) {
  // Play dealer's hand
  gameState = playDealer(gameState);

  // Determine result
  const { result, payout } = determineResult(gameState);

  // Update round
  await prisma.$transaction(async (tx) => {
    await tx.blackjackRound.update({
      where: { id: round.id },
      data: {
        result,
        state: JSON.stringify(gameState)
      }
    });

    // Credit payout if any
    if (payout > 0) {
      await tx.user.update({
        where: { id: user.id },
        data: { vp: { increment: payout } }
      });
    }
  });

  // Get updated balance
  const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });

  // Build result embed
  const playerValue = calculateHandValue(gameState.playerHand);
  const dealerValue = calculateHandValue(gameState.dealerHand);

  let color = 0xFF0000;
  let title = '😔 You Lost';
  
  if (result === 'win') {
    color = 0x00FF00;
    title = '🎉 You Won!';
  } else if (result === 'blackjack') {
    color = 0xFFD700;
    title = '♠️ BLACKJACK!';
  } else if (result === 'push') {
    color = 0xFFFF00;
    title = '🤝 Push';
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .addFields(
      { name: '🎴 Your Hand', value: `${formatHand(gameState.playerHand)}\n**Value:** ${playerValue}`, inline: false },
      { name: '🃏 Dealer Hand', value: `${formatHand(gameState.dealerHand)}\n**Value:** ${dealerValue}`, inline: false },
      { name: '💰 Bet', value: formatVP(gameState.bet), inline: true },
      { name: '💵 Payout', value: formatVP(payout), inline: true },
      { name: '💳 New Balance', value: formatVP(updatedUser.vp), inline: true }
    )
    .setTimestamp();

  await interaction.message.edit({
    embeds: [embed],
    components: []
  });

  // Log transaction
  if (result !== 'lose') {
    await logTransaction('blackjack', {
      userId: user.discordId,
      amount: gameState.bet,
      result,
      payout
    });
  }
}

