import { randomUUID } from 'crypto';
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import prisma, { getOrCreateUser, hasActiveBattle, getConfig } from '../db/index.js';
import { formatVP, calculateBattleRake } from '../lib/utils.js';
import { logTransaction } from '../lib/logger.js';
import {
  createRPSGame,
  createHighCardGame,
  createDiceGame,
  createHiLoGame,
  createReactionGame,
  createCoinFlipGame,
  createOddEvenGame,
  createArcheryGame,
  createSprintGame,
  resolveRPS,
  resolveHighCard,
  resolveDice,
  resolveHiLo,
  resolveReaction,
  resolveCoinFlip,
  resolveOddEven,
  resolveArchery,
  resolveSprint,
  formatCard,
  getGameDisplayName,
} from '../lib/games.js';

const BATTLE_MENU_TTL = 5 * 60 * 1000; // 5 minutes
const battleMenuState = new Map();

const GAME_CHOICES = [
  { value: 'rps', label: 'Rock Paper Scissors', emoji: '🪨' },
  { value: 'highcard', label: 'High Card', emoji: '🃏' },
  { value: 'dice', label: 'Dice Duel', emoji: '🎲' },
  { value: 'hilow', label: 'Hi-Lo', emoji: '📈' },
  { value: 'reaction', label: 'Reaction Duel', emoji: '⚡' },
  { value: 'coinflip', label: 'Coin Flip', emoji: '🪙' },
  { value: 'oddeven', label: 'Odd vs Even', emoji: '➗' },
  { value: 'archery', label: 'Archery Shootout', emoji: '🏹' },
  { value: 'sprint', label: 'Sprint Showdown', emoji: '🏃' },
];

function saveBattleMenuState(menuId, state) {
  battleMenuState.set(menuId, {
    ...state,
    expiresAt: Date.now() + BATTLE_MENU_TTL,
  });
}

function getBattleMenuState(menuId) {
  const state = battleMenuState.get(menuId);

  if (!state) {
    return null;
  }

  if (state.expiresAt && state.expiresAt < Date.now()) {
    battleMenuState.delete(menuId);
    return null;
  }

  return { ...state };
}

function clearBattleMenuState(menuId) {
  battleMenuState.delete(menuId);
}

function buildBattleMenuEmbed({ challenger, opponent, amount }) {
  return new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle('🎮 Battle Hub')
    .setDescription(
      `Select a game below to challenge **${opponent.username}** for ${formatVP(amount)}.`
    )
    .addFields(
      { name: 'Challenger', value: `<@${challenger.id}>`, inline: true },
      { name: 'Opponent', value: `<@${opponent.id}>`, inline: true },
      { name: 'Wager', value: formatVP(amount), inline: true }
    )
    .setFooter({ text: 'Game selections expire after 5 minutes.' })
    .setTimestamp();
}

function buildBattleMenuComponents(menuId, { disabled = false } = {}) {
  const rows = [];

  for (let index = 0; index < GAME_CHOICES.length; index += 5) {
    const slice = GAME_CHOICES.slice(index, index + 5);
    const row = new ActionRowBuilder();

    for (const choice of slice) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`battle-menu:${menuId}:${choice.value}`)
          .setLabel(`${choice.emoji} ${choice.label}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled)
      );
    }

    rows.push(row);
  }

  const cancelRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`battle-menu:${menuId}:cancel`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );

  rows.push(cancelRow);

  return rows;
}

async function notifyInactiveBattleMenu(interaction) {
  const payload = {
    content: '❌ This battle menu is no longer active. Use `/battle` to start a new challenge.',
    embeds: [],
    components: [],
  };

  if (!interaction.deferred && !interaction.replied) {
    try {
      if (interaction.isMessageComponent()) {
        await interaction.update(payload);
      } else {
        await interaction.reply({ content: payload.content, ephemeral: true });
      }
      return;
    } catch (error) {
      try {
        await interaction.reply({ content: payload.content, ephemeral: true });
        return;
      } catch (replyError) {
        console.error('Failed to notify about inactive battle menu:', replyError);
      }
    }
  }

  try {
    await interaction.followUp({ content: payload.content, ephemeral: true });
  } catch (followError) {
    console.error('Failed to send follow-up for inactive battle menu:', followError);
  }
}

async function handleBattleMenuButton(interaction, menuId, action) {
  const state = getBattleMenuState(menuId);

  if (!state || state.messageId !== interaction.message.id || state.channelId !== interaction.channelId) {
    await notifyInactiveBattleMenu(interaction);
    return true;
  }

  if (interaction.user.id !== state.challengerId) {
    await interaction.reply({
      content: '❌ Only the original challenger can use this menu.',
      ephemeral: true,
    });
    return true;
  }

  if (action === 'cancel') {
    clearBattleMenuState(menuId);

    await interaction.update({
      content: '❌ Battle challenge canceled.',
      embeds: [],
      components: [],
    });

    return true;
  }

  if (!interaction.channel) {
    await interaction.reply({
      content: '❌ Unable to locate the channel for this challenge. Try again in a guild channel.',
      ephemeral: true,
    });
    return true;
  }

  await interaction.deferUpdate();

  try {
    const challenger = await interaction.client.users.fetch(state.challengerId);
    const opponent = await interaction.client.users.fetch(state.opponentId);

    await createBattleChallenge({
      channel: interaction.channel,
      challenger,
      opponent,
      amount: state.amount,
      game: action,
    });

    clearBattleMenuState(menuId);

    const summaryEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Challenge Sent')
      .setDescription(
        `Sent a ${getGameDisplayName(action)} challenge to **${opponent.username}** for ${formatVP(state.amount)}.`
      )
      .addFields(
        { name: 'Opponent', value: `<@${opponent.id}>`, inline: true },
        { name: 'Wager', value: formatVP(state.amount), inline: true },
        { name: 'Game', value: getGameDisplayName(action), inline: true }
      )
      .setTimestamp();

    await interaction.editReply({
      embeds: [summaryEmbed],
      components: [],
    });
  } catch (error) {
    console.error('Error creating battle challenge:', error);
    const message = error instanceof Error ? error.message : 'Failed to create battle. Please try again.';

    try {
      await interaction.followUp({ content: `❌ ${message}`, ephemeral: true });
    } catch (followError) {
      console.error('Failed to send follow-up error message for battle challenge:', followError);
    }
  }

  return true;
}

async function createBattleChallenge({ channel, challenger, opponent, amount, game }) {
  if (opponent.bot) {
    throw new Error('You cannot challenge bots to battles.');
  }

  if (challenger.id === opponent.id) {
    throw new Error('You cannot challenge yourself.');
  }

  const challengerUser = await getOrCreateUser(challenger.id);
  const opponentUser = await getOrCreateUser(opponent.id);

  if (challengerUser.blacklisted) {
    throw new Error('You are blacklisted and cannot participate in battles.');
  }

  if (opponentUser.blacklisted) {
    throw new Error('This user is blacklisted and cannot participate in battles.');
  }

  if (await hasActiveBattle(challenger.id)) {
    throw new Error('You already have an active battle. Finish it first.');
  }

  if (await hasActiveBattle(opponent.id)) {
    throw new Error('This user already has an active battle.');
  }

  if (challengerUser.vp < amount) {
    throw new Error(
      `Insufficient balance. You need ${formatVP(amount)}, but you only have ${formatVP(challengerUser.vp)}.`
    );
  }

  if (opponentUser.vp < amount) {
    throw new Error(
      `Opponent has insufficient balance. They need ${formatVP(amount)}, but they only have ${formatVP(opponentUser.vp)}.`
    );
  }

  const battle = await prisma.battle.create({
    data: {
      challengerId: challengerUser.id,
      opponentId: opponentUser.id,
      game,
      amount,
      status: 'open',
      state: JSON.stringify({}),
    },
  });

  const challengeEmbed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle(`🎮 Battle Challenge: ${getGameDisplayName(game)}`)
    .setDescription(`**${challenger.username}** challenges **${opponent.username}**!`)
    .addFields(
      { name: 'Wager', value: formatVP(amount), inline: true },
      { name: 'Game', value: getGameDisplayName(game), inline: true },
      { name: 'Status', value: '⏳ Awaiting Response', inline: true }
    )
    .setFooter({ text: 'You have 60 seconds to accept or decline' })
    .setTimestamp();

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`battle_accept_${battle.id}`)
      .setLabel('✅ Accept')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`battle_decline_${battle.id}`)
      .setLabel('❌ Decline')
      .setStyle(ButtonStyle.Danger)
  );

  const message = await channel.send({
    content: `<@${opponent.id}>`,
    embeds: [challengeEmbed],
    components: [actionRow],
  });

  setTimeout(async () => {
    try {
      const currentBattle = await prisma.battle.findUnique({ where: { id: battle.id } });

      if (currentBattle && currentBattle.status === 'open') {
        await prisma.battle.update({
          where: { id: battle.id },
          data: { status: 'canceled' },
        });

        const timeoutEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('⏰ Battle Expired')
          .setDescription('The challenge was not accepted in time.')
          .setTimestamp();

        await message.edit({
          embeds: [timeoutEmbed],
          components: [],
        });
      }
    } catch (error) {
      console.error('Error in battle timeout:', error);
    }
  }, 60000);

  return { battle, message };
}

export const data = new SlashCommandBuilder()
  .setName('battle')
  .setDescription('Challenge another user to a 1v1 game')
  .addUserOption((option) =>
    option.setName('user').setDescription('User to challenge').setRequired(true)
  )
  .addIntegerOption((option) =>
    option
      .setName('amount')
      .setDescription('Amount of VP to wager (defaults to 1)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(50)
  );

export async function execute(interaction, _client) {
  const challenger = interaction.user;
  const opponent = interaction.options.getUser('user');
  const amountOption = interaction.options.getInteger('amount');
  const amount = amountOption ?? 1;

  if (amount < 1 || amount > 50) {
    return interaction.reply({
      content: '❌ Wager amount must be between 1 and 50 VP.',
      ephemeral: true,
    });
  }

  if (!opponent) {
    return interaction.reply({
      content: '❌ Please choose an opponent to challenge.',
      ephemeral: true,
    });
  }

  if (opponent.bot) {
    return interaction.reply({
      content: '❌ You cannot challenge bots to battles.',
      ephemeral: true,
    });
  }

  if (opponent.id === challenger.id) {
    return interaction.reply({
      content: '❌ You cannot challenge yourself.',
      ephemeral: true,
    });
  }

  const menuId = randomUUID();

  const embed = buildBattleMenuEmbed({ challenger, opponent, amount });
  const components = buildBattleMenuComponents(menuId);

  const reply = await interaction.reply({
    embeds: [embed],
    components,
    ephemeral: true,
    fetchReply: true,
  });

  saveBattleMenuState(menuId, {
    challengerId: challenger.id,
    opponentId: opponent.id,
    amount,
    channelId: interaction.channelId,
    messageId: reply.id,
  });
}

export async function handleBattleInteraction(interaction) {
  const customId = interaction.customId;

  if (interaction.isButton() && customId.startsWith('battle-menu:')) {
    const [, menuId, action] = customId.split(':');

    if (!menuId || !action) {
      return false;
    }

    return handleBattleMenuButton(interaction, menuId, action);
  }

  if (!interaction.isButton()) {
    return false;
  }

  // Battle accept/decline
  if (customId.startsWith('battle_accept_') || customId.startsWith('battle_decline_')) {
    const battleId = parseInt(customId.split('_')[2]);
    const action = customId.split('_')[1];

    try {
      const battle = await prisma.battle.findUnique({
        where: { id: battleId },
        include: {
          challenger: true,
          opponent: true,
        },
      });

      if (!battle) {
        await interaction.reply({
          content: '❌ Battle not found.',
          ephemeral: true,
        });
        return true;
      }

      // Only opponent can respond
      if (interaction.user.id !== battle.opponent.discordId) {
        await interaction.reply({
          content: '❌ Only the challenged user can respond.',
          ephemeral: true,
        });
        return true;
      }

      if (battle.status !== 'open') {
        await interaction.reply({
          content: '❌ This battle is no longer available.',
          ephemeral: true,
        });
        return true;
      }

      if (action === 'decline') {
        await prisma.battle.update({
          where: { id: battleId },
          data: { status: 'canceled' },
        });

        const declineEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Battle Declined')
          .setDescription(`**${interaction.user.username}** declined the challenge.`)
          .setTimestamp();

        await interaction.update({
          embeds: [declineEmbed],
          components: [],
        });

        return true;
      }

      // Accept battle
      await interaction.deferUpdate();

      // Start game based on type
      await startGame(interaction, battle);

      return true;
    } catch (error) {
      console.error('Error handling battle button:', error);
      await interaction.reply({
        content: '❌ An error occurred. Please try again.',
        ephemeral: true,
      });
      return true;
    }
  }

  // Game-specific button handlers
  if (customId.startsWith('rps_')) {
    await handleRPSButton(interaction);
    return true;
  }

  if (customId.startsWith('hilow_')) {
    await handleHiLoButton(interaction);
    return true;
  }

  if (customId.startsWith('reaction_')) {
    await handleReactionButton(interaction);
    return true;
  }

  return false;
}

async function startGame(interaction, battle) {
  switch (battle.game) {
    case 'rps':
      await startRPS(interaction, battle);
      break;
    case 'highcard':
      await startHighCard(interaction, battle);
      break;
    case 'dice':
      await startDice(interaction, battle);
      break;
    case 'hilow':
      await startHiLo(interaction, battle);
      break;
    case 'reaction':
      await startReaction(interaction, battle);
      break;
    case 'coinflip':
      await startCoinFlip(interaction, battle);
      break;
    case 'oddeven':
      await startOddEven(interaction, battle);
      break;
    case 'archery':
      await startArchery(interaction, battle);
      break;
    case 'sprint':
      await startSprint(interaction, battle);
      break;
  }
}

async function startRPS(interaction, battle) {
  const gameState = createRPSGame();

  await prisma.battle.update({
    where: { id: battle.id },
    data: {
      status: 'accepted',
      state: JSON.stringify(gameState),
    },
  });

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('🪨📄✂️ Rock Paper Scissors')
    .setDescription('Both players, make your choice!')
    .addFields({ name: 'Wager', value: formatVP(battle.amount), inline: true })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rps_rock_${battle.id}`)
      .setLabel('🪨 Rock')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`rps_paper_${battle.id}`)
      .setLabel('📄 Paper')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`rps_scissors_${battle.id}`)
      .setLabel('✂️ Scissors')
      .setStyle(ButtonStyle.Primary)
  );

  await interaction.editReply({
    embeds: [embed],
    components: [row],
  });
}

async function handleRPSButton(interaction) {
  const parts = interaction.customId.split('_');
  const choice = parts[1];
  const battleId = parseInt(parts[2]);

  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: { challenger: true, opponent: true },
  });

  if (!battle || battle.status === 'resolved') {
    return interaction.reply({
      content: '❌ This battle is no longer active.',
      ephemeral: true,
    });
  }

  const gameState = JSON.parse(battle.state);
  const userId = interaction.user.id;

  // Determine if user is challenger or opponent
  if (userId === battle.challenger.discordId) {
    if (gameState.challengerChoice) {
      return interaction.reply({
        content: '❌ You already made your choice!',
        ephemeral: true,
      });
    }
    gameState.challengerChoice = choice;
  } else if (userId === battle.opponent.discordId) {
    if (gameState.opponentChoice) {
      return interaction.reply({
        content: '❌ You already made your choice!',
        ephemeral: true,
      });
    }
    gameState.opponentChoice = choice;
  } else {
    return interaction.reply({
      content: '❌ You are not part of this battle.',
      ephemeral: true,
    });
  }

  await interaction.reply({
    content: `✅ You chose **${choice}**!`,
    ephemeral: true,
  });

  // Check if both players have chosen
  if (gameState.challengerChoice && gameState.opponentChoice) {
    await resolveRPSBattle(interaction, battle, gameState);
  } else {
    await prisma.battle.update({
      where: { id: battleId },
      data: { state: JSON.stringify(gameState) },
    });
  }
}

async function resolveRPSBattle(interaction, battle, gameState) {
  const winner = resolveRPS(gameState.challengerChoice, gameState.opponentChoice);

  if (winner === 'tie') {
    // Reset for sudden death
    gameState.challengerChoice = null;
    gameState.opponentChoice = null;

    await prisma.battle.update({
      where: { id: battle.id },
      data: { state: JSON.stringify(gameState) },
    });

    const tieEmbed = new EmbedBuilder()
      .setColor(0xffff00)
      .setTitle("🤝 It's a Tie!")
      .setDescription('Both players chose the same! Sudden death round...')
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rps_rock_${battle.id}`)
        .setLabel('🪨 Rock')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`rps_paper_${battle.id}`)
        .setLabel('📄 Paper')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`rps_scissors_${battle.id}`)
        .setLabel('✂️ Scissors')
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.message.edit({
      embeds: [tieEmbed],
      components: [row],
    });

    return;
  }

  await finalizeBattle(
    interaction,
    battle,
    winner === 'challenger' ? battle.challengerId : battle.opponentId,
    gameState
  );
}

async function startHighCard(interaction, battle) {
  const gameState = createHighCardGame();

  const winnerId =
    resolveHighCard(gameState) === 'challenger'
      ? battle.challengerId
      : resolveHighCard(gameState) === 'opponent'
        ? battle.opponentId
        : null;

  if (winnerId === null) {
    // Tie, redraw
    await startHighCard(interaction, battle);
    return;
  }

  await finalizeBattle(interaction, battle, winnerId, gameState);
}

async function startDice(interaction, battle) {
  const gameState = createDiceGame();

  const result = resolveDice(gameState);

  if (result === 'tie') {
    // Redraw
    await startDice(interaction, battle);
    return;
  }

  const winnerId = result === 'challenger' ? battle.challengerId : battle.opponentId;

  await finalizeBattle(interaction, battle, winnerId, gameState);
}

async function startHiLo(interaction, battle) {
  const gameState = createHiLoGame();
  gameState.challengerChoice = 'high'; // Challenger always gets high
  gameState.opponentChoice = 'low'; // Opponent gets low

  await prisma.battle.update({
    where: { id: battle.id },
    data: {
      status: 'accepted',
      state: JSON.stringify(gameState),
    },
  });

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('🎲 Hi-Lo Number Duel')
    .setDescription(
      `A number between 1-100 has been chosen!\n\n**${interaction.client.users.cache.get(battle.challenger.discordId).username}** guesses **HIGH** (>50)\n**${interaction.client.users.cache.get(battle.opponent.discordId).username}** guesses **LOW** (<50)`
    )
    .addFields({ name: 'Wager', value: formatVP(battle.amount), inline: true })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`hilow_reveal_${battle.id}`)
      .setLabel('🎲 Reveal Number')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.editReply({
    embeds: [embed],
    components: [row],
  });
}

async function handleHiLoButton(interaction) {
  const parts = interaction.customId.split('_');
  const battleId = parseInt(parts[2]);

  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: { challenger: true, opponent: true },
  });

  if (!battle) {
    return interaction.reply({
      content: '❌ Battle not found.',
      ephemeral: true,
    });
  }

  const gameState = JSON.parse(battle.state);
  const result = resolveHiLo(gameState);

  if (result === 'tie') {
    // Exactly 50, reroll
    await interaction.deferUpdate();
    await startHiLo(interaction, battle);
    return;
  }

  await interaction.deferUpdate();

  const winnerId = result === 'challenger' ? battle.challengerId : battle.opponentId;
  await finalizeBattle(interaction, battle, winnerId, gameState);
}

async function startReaction(interaction, battle) {
  const gameState = createReactionGame();

  await prisma.battle.update({
    where: { id: battle.id },
    data: {
      status: 'accepted',
      state: JSON.stringify(gameState),
    },
  });

  const embed = new EmbedBuilder()
    .setColor(0xffff00)
    .setTitle('⚡ Reaction Duel')
    .setDescription('GET READY...\n\nClick the button as fast as you can when it says CLICK!')
    .addFields({ name: 'Wager', value: formatVP(battle.amount), inline: true })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`reaction_ready_${battle.id}`)
      .setLabel('⏳ WAIT...')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );

  await interaction.editReply({
    embeds: [embed],
    components: [row],
  });

  // Wait for the delay
  setTimeout(async () => {
    gameState.startTime = Date.now();

    await prisma.battle.update({
      where: { id: battle.id },
      data: { state: JSON.stringify(gameState) },
    });

    const clickEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('⚡ CLICK NOW!')
      .setDescription('Click the button as fast as you can!')
      .setTimestamp();

    const clickRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`reaction_click_${battle.id}`)
        .setLabel('⚡ CLICK!')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({
      embeds: [clickEmbed],
      components: [clickRow],
    });

    // Auto-resolve after 2 seconds
    setTimeout(async () => {
      const currentBattle = await prisma.battle.findUnique({ where: { id: battle.id } });

      if (currentBattle && currentBattle.status === 'accepted') {
        const state = JSON.parse(currentBattle.state);
        const result = resolveReaction(state);

        let winnerId;
        if (result === 'tie') {
          winnerId = null; // Both missed, restart
          await startReaction(interaction, currentBattle);
          return;
        } else {
          winnerId =
            result === 'challenger' ? currentBattle.challengerId : currentBattle.opponentId;
        }

        await finalizeBattle(interaction, currentBattle, winnerId, state);
      }
    }, 2000);
  }, gameState.delay);
}

async function startCoinFlip(interaction, battle) {
  const gameState = createCoinFlipGame();
  const result = resolveCoinFlip(gameState);

  const winnerId = result === 'challenger' ? battle.challengerId : battle.opponentId;

  await finalizeBattle(interaction, battle, winnerId, gameState);
}

async function startOddEven(interaction, battle) {
  const gameState = createOddEvenGame();
  const result = resolveOddEven(gameState);

  const winnerId = result === 'challenger' ? battle.challengerId : battle.opponentId;

  await finalizeBattle(interaction, battle, winnerId, gameState);
}

async function startArchery(interaction, battle) {
  const gameState = createArcheryGame();
  const result = resolveArchery(gameState);

  if (result === 'tie') {
    await startArchery(interaction, battle);
    return;
  }

  const winnerId = result === 'challenger' ? battle.challengerId : battle.opponentId;

  await finalizeBattle(interaction, battle, winnerId, gameState);
}

async function startSprint(interaction, battle) {
  const gameState = createSprintGame();
  const result = resolveSprint(gameState);

  if (result === 'tie') {
    await startSprint(interaction, battle);
    return;
  }

  const winnerId = result === 'challenger' ? battle.challengerId : battle.opponentId;

  await finalizeBattle(interaction, battle, winnerId, gameState);
}

async function handleReactionButton(interaction) {
  const parts = interaction.customId.split('_');
  const battleId = parseInt(parts[2]);

  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: { challenger: true, opponent: true },
  });

  if (!battle || battle.status !== 'accepted') {
    return interaction.reply({
      content: '❌ This battle is no longer active.',
      ephemeral: true,
    });
  }

  const gameState = JSON.parse(battle.state);
  const userId = interaction.user.id;
  const clickTime = Date.now() - gameState.startTime;

  // Determine which player clicked
  if (userId === battle.challenger.discordId) {
    gameState.clickedAt.challenger = clickTime;
  } else if (userId === battle.opponent.discordId) {
    gameState.clickedAt.opponent = clickTime;
  } else {
    return interaction.reply({
      content: '❌ You are not part of this battle.',
      ephemeral: true,
    });
  }

  await prisma.battle.update({
    where: { id: battleId },
    data: { state: JSON.stringify(gameState) },
  });

  await interaction.reply({
    content: `⚡ You clicked in **${clickTime}ms**!`,
    ephemeral: true,
  });

  // Check if both have clicked
  if (gameState.clickedAt.challenger && gameState.clickedAt.opponent) {
    const result = resolveReaction(gameState);
    const winnerId = result === 'challenger' ? battle.challengerId : battle.opponentId;
    await finalizeBattle(interaction, battle, winnerId, gameState);
  }
}

async function finalizeBattle(interaction, battle, winnerId, gameState) {
  // Get rake percentage
  const rakePercentStr = await getConfig('battle_rake_percent', '2');
  const rakePercent = parseInt(rakePercentStr);
  const rake = calculateBattleRake(battle.amount, rakePercent);
  const payout = battle.amount * 2 - rake;

  // Update battle
  await prisma.battle.update({
    where: { id: battle.id },
    data: {
      status: 'resolved',
      winnerId,
      resolvedAt: new Date(),
      state: JSON.stringify(gameState),
    },
  });

  // Transfer VP
  const loserId = winnerId === battle.challengerId ? battle.opponentId : battle.challengerId;

  await prisma.$transaction(async (tx) => {
    // Deduct from loser
    await tx.user.update({
      where: { id: loserId },
      data: { vp: { decrement: battle.amount } },
    });

    // Add to winner (minus rake)
    await tx.user.update({
      where: { id: winnerId },
      data: { vp: { increment: payout } },
    });
  });

  // Get updated users
  const winner = await prisma.user.findUnique({ where: { id: winnerId } });
  const loser = await prisma.user.findUnique({ where: { id: loserId } });

  // Build result embed
  let resultDescription = '';

  switch (battle.game) {
    case 'rps':
      resultDescription = `**Challenger:** ${gameState.challengerChoice}\n**Opponent:** ${gameState.opponentChoice}`;
      break;
    case 'highcard':
      resultDescription = `**Challenger:** ${formatCard(gameState.challengerCard)}\n**Opponent:** ${formatCard(gameState.opponentCard)}`;
      break;
    case 'dice':
      resultDescription = `**Challenger:** ${gameState.challengerRolls.join(' + ')} = ${gameState.challengerTotal}\n**Opponent:** ${gameState.opponentRolls.join(' + ')} = ${gameState.opponentTotal}`;
      break;
    case 'hilow':
      resultDescription = `**Number:** ${gameState.number}\n**Challenger:** HIGH\n**Opponent:** LOW`;
      break;
    case 'reaction':
      resultDescription = `**Challenger:** ${gameState.clickedAt.challenger || 'No click'}ms\n**Opponent:** ${gameState.clickedAt.opponent || 'No click'}ms`;
      break;
    case 'coinflip':
      resultDescription = `**Coin Result:** ${gameState.flip.toUpperCase()}\n**Challenger:** Heads\n**Opponent:** Tails`;
      break;
    case 'oddeven':
      resultDescription = `**Number:** ${gameState.number}\n**Challenger:** Odd\n**Opponent:** Even`;
      break;
    case 'archery':
      resultDescription = `**Challenger:** ${gameState.challengerShots.join(', ')} (Total ${gameState.challengerTotal})\n**Opponent:** ${gameState.opponentShots.join(', ')} (Total ${gameState.opponentTotal})`;
      break;
    case 'sprint':
      resultDescription = `**Challenger:** ${gameState.challengerTime}ms\n**Opponent:** ${gameState.opponentTime}ms`;
      break;
  }

  const resultEmbed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle(`🏆 ${getGameDisplayName(battle.game)} - Winner!`)
    .setDescription(resultDescription)
    .addFields(
      { name: 'Winner', value: `<@${winner.discordId}>`, inline: true },
      { name: 'Prize', value: formatVP(payout), inline: true },
      { name: 'House Rake', value: formatVP(rake), inline: true }
    )
    .setTimestamp();

  await interaction.message.edit({
    embeds: [resultEmbed],
    components: [],
  });

  // DM both players
  try {
    const winnerUser = await interaction.client.users.fetch(winner.discordId);
    await winnerUser.send({
      embeds: [
        {
          color: 0x00ff00,
          title: '🏆 Battle Won!',
          description: `You won the **${getGameDisplayName(battle.game)}** battle!`,
          fields: [
            { name: 'Prize', value: formatVP(payout), inline: true },
            { name: 'New Balance', value: formatVP(winner.vp), inline: true },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    });
  } catch (error) {
    console.log('Could not DM winner:', error.message);
  }

  try {
    const loserUser = await interaction.client.users.fetch(loser.discordId);
    await loserUser.send({
      embeds: [
        {
          color: 0xff0000,
          title: '😔 Battle Lost',
          description: `You lost the **${getGameDisplayName(battle.game)}** battle.`,
          fields: [
            { name: 'Lost', value: formatVP(battle.amount), inline: true },
            { name: 'New Balance', value: formatVP(loser.vp), inline: true },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    });
  } catch (error) {
    console.log('Could not DM loser:', error.message);
  }

  // Log transaction
  await logTransaction('battle', {
    challengerId: battle.challenger.discordId,
    opponentId: battle.opponent.discordId,
    game: battle.game,
    amount: battle.amount,
    winnerId: winner.discordId,
  });
}
