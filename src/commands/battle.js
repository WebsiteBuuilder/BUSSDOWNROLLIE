import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
} from 'discord.js';
import { safeReply } from '../utils/interaction.js';
import { formatVP } from '../lib/utils.js';

export const BATTLE_MENU_NAMESPACE = 'battle-menu';

const BATTLE_GAMES = [
  {
    value: 'coinflip',
    label: 'Coin Flip',
    menuDescription: '50/50 toss — quick and decisive.',
    summaryTemplate: 'Flip a single coin; the winner pockets {amount}.',
    instructions: [
      'Decide who will call heads or tails before the flip.',
      'Use `/coinflip` or another verifiable bot to toss once.',
      'Whoever wins the toss receives {amount}.',
    ],
  },
  {
    value: 'rps',
    label: 'Rock Paper Scissors',
    menuDescription: 'Best of three skill check.',
    summaryTemplate: 'Throw hands in chat — first to two wins takes {amount}.',
    instructions: [
      'Count down in chat and reveal your choice at the same time.',
      'Play a best-of-three set. Track wins in the channel to keep things transparent.',
      'The first player to earn two wins claims {amount}.',
    ],
  },
  {
    value: 'dice',
    label: 'Dice Duel',
    menuDescription: 'High roll wins it all.',
    summaryTemplate: 'Roll the dice; higher number grabs {amount}.',
    instructions: [
      'Both players roll with `/roll 1d100` or an agreed dice bot.',
      'If you tie, roll again until someone wins outright.',
      'The higher roll takes home {amount}.',
    ],
  },
  {
    value: 'connect4',
    label: 'Connect Four',
    menuDescription: 'Strategy showdown in a shared lobby.',
    summaryTemplate: 'Battle in a single Connect Four match for {amount}.',
    instructions: [
      'Create a public Connect Four lobby (e.g., playok.com) and share the link.',
      'Play one full game. Keep the chat updated with turns if the site lacks a log.',
      'Winner screenshots the result if needed and receives {amount}.',
    ],
  },
  {
    value: 'trivia',
    label: 'Trivia Faceoff',
    menuDescription: 'Neutral host asks the question.',
    summaryTemplate: 'First correct answer to a hosted question earns {amount}.',
    instructions: [
      'Ping a neutral host or staff member to provide a trivia question.',
      'Both players answer in chat. The host decides who answered correctly first.',
      'Host confirms the winner, who then collects {amount}.',
    ],
  },
];

function renderTemplate(template, context) {
  return template.replace(/\{(amount|challenger|opponent)\}/g, (_, key) => context[key] ?? `{${key}}`);
}

function buildGameSelectRow(challengerId, opponentId, amount) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`${BATTLE_MENU_NAMESPACE}:${challengerId}:${opponentId}:${amount}`)
    .setPlaceholder('Select a game to view how to play')
    .addOptions(
      BATTLE_GAMES.map((game) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(game.label)
          .setValue(game.value)
          .setDescription(game.menuDescription)
      )
    );

  return new ActionRowBuilder().addComponents(select);
}

function buildOverviewEmbed({ challengerId, opponentId, amountLabel }) {
  const embed = new EmbedBuilder()
    .setTitle('Choose Your Battle Game')
    .setColor(0x5865f2)
    .setDescription(
      [
        `Challenger: <@${challengerId}>`,
        `Opponent: <@${opponentId}>`,
        `Wager: ${amountLabel}`,
        '',
        'Pick a game from the menu below to view quick rules and settle your vouch-point duel.',
      ].join('\n')
    );

  embed.addFields(
    BATTLE_GAMES.map((game, index) => ({
      name: `${index + 1}. ${game.label}`,
      value: renderTemplate(game.summaryTemplate, {
        amount: amountLabel,
        challenger: `<@${challengerId}>`,
        opponent: `<@${opponentId}>`,
      }),
    }))
  );

  return embed;
}

export const data = new SlashCommandBuilder()
  .setName('battle')
  .setDescription('Challenge another user and pick a game to wager vouch points.')
  .addUserOption((option) =>
    option
      .setName('opponent')
      .setDescription('Who do you want to challenge?')
      .setRequired(true)
  )
  .addIntegerOption((option) =>
    option
      .setName('amount')
      .setDescription('How many vouch points are on the line?')
      .setRequired(true)
      .setMinValue(1)
  );

export async function handleBattle(interaction) {
  const opponent = interaction.options.getUser('opponent', true);
  const amount = interaction.options.getInteger('amount', true);
  const challengerId = interaction.user.id;

  if (opponent.bot) {
    await safeReply(interaction, {
      content: '🤖 You cannot battle a bot. Choose a real opponent!',
      ephemeral: true,
    });
    return;
  }

  if (opponent.id === challengerId) {
    await safeReply(interaction, {
      content: '🪞 Battling yourself is not allowed. Pick someone else!',
      ephemeral: true,
    });
    return;
  }

  const amountLabel = formatVP(amount);
  const embed = buildOverviewEmbed({
    challengerId,
    opponentId: opponent.id,
    amountLabel,
  });

  const components = [buildGameSelectRow(challengerId, opponent.id, amount)];

  await safeReply(interaction, {
    embeds: [embed],
    components,
  });
}

export async function execute(interaction) {
  return handleBattle(interaction);
}

export async function handleBattleGameSelect(interaction) {
  const customId = interaction.customId ?? '';

  if (!customId.startsWith(`${BATTLE_MENU_NAMESPACE}:`)) {
    return false;
  }

  const [, challengerId, opponentId, amountRaw] = customId.split(':');
  const amount = Number.parseInt(amountRaw, 10);
  const amountLabel = Number.isNaN(amount) ? `${amountRaw} VP` : formatVP(amount);

  if (![challengerId, opponentId].includes(interaction.user?.id)) {
    await interaction.reply({
      ephemeral: true,
      content: '❌ Only the challenger and opponent can view the battle game details.',
    });
    return true;
  }

  const selection = interaction.values?.[0];
  const game = BATTLE_GAMES.find((option) => option.value === selection);

  if (!game) {
    await interaction.reply({
      ephemeral: true,
      content: 'That game is no longer available. Please pick another option.',
    });
    return true;
  }

  const context = {
    amount: amountLabel,
    challenger: `<@${challengerId}>`,
    opponent: `<@${opponentId}>`,
  };

  const embed = new EmbedBuilder()
    .setTitle(`${game.label} — ${amountLabel}`)
    .setColor(0x43b581)
    .setDescription(
      [
        renderTemplate(game.summaryTemplate, context),
        '',
        ...game.instructions.map((line) => `• ${renderTemplate(line, context)}`),
        '',
        '✅ Make sure both players confirm the result so the wager can be paid out.',
      ].join('\n')
    );

  await interaction.reply({
    ephemeral: true,
    embeds: [embed],
  });

  return true;
}
