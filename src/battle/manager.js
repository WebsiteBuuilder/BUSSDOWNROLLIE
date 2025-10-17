import crypto from 'crypto';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import prisma, { getOrCreateUser } from '../db/index.js';
import { formatVP } from '../lib/utils.js';
import { battleGames, getGameByKey } from './registry.js';
import { logger } from '../logger.js';

const ACTIVE_BATTLES = new Map();
export const BATTLE_CUSTOM_ID_PREFIX = 'battle';
const DEFAULT_TIMEOUT_MS = 20_000;

function randomId() {
  return crypto.randomBytes(6).toString('hex');
}

class BattleState {
  constructor({ interaction, opponent, amount, type }) {
    this.id = randomId();
    this.interaction = interaction;
    this.channelId = interaction.channelId;
    this.message = null;
    this.turn = 0;
    this.amount = amount;
    this.type = type;
    this.challengerId = interaction.user.id;
    this.opponentId = opponent ?? null;
    this.status = type === 'open' ? 'open' : 'pending';
    this.actionHandlers = new Map();
    this.timeouts = new Map();
    this.resolved = false;
    this.game = null;
    this.snapshot = null;
  }

  makeId(suffix) {
    this.turn += 1;
    return `${BATTLE_CUSTOM_ID_PREFIX}:${this.id}:${this.turn}:${suffix}`;
  }

  registerAction(suffix, handler) {
    const id = this.makeId(suffix);
    this.actionHandlers.set(id, handler);
    return id;
  }

  clearActions() {
    this.actionHandlers.clear();
  }

  setTimeout(key, ms, handler) {
    this.clearTimeout(key);
    const timer = setTimeout(() => {
      this.timeouts.delete(key);
      handler?.();
    }, ms);
    timer.unref?.();
    this.timeouts.set(key, timer);
  }

  clearTimeout(key) {
    const existing = this.timeouts.get(key);
    if (existing) {
      clearTimeout(existing);
      this.timeouts.delete(key);
    }
  }

  clearAllTimeouts() {
    for (const timer of this.timeouts.values()) {
      clearTimeout(timer);
    }
    this.timeouts.clear();
  }
}

function challengeEmbed({ challengerId, opponentId, amount, footer }) {
  const embed = new EmbedBuilder()
    .setTitle('Battle Challenge')
    .setColor(0xff9f43)
    .setDescription(
      [
        `Challenger: <@${challengerId}>`,
        `Opponent: <@${opponentId}>`,
        `Stake: ${formatVP(amount)}`,
        '',
        'Waiting for a response…',
      ].join('\n')
    );

  if (footer) {
    embed.setFooter({ text: footer });
  }

  return embed;
}

function openInviteEmbed({ challengerId, amount, footer }) {
  const embed = new EmbedBuilder()
    .setTitle('Open Battle Invite')
    .setColor(0x5865f2)
    .setDescription(
      [
        `<@${challengerId}> is ready to battle anyone!`,
        `Stake: ${formatVP(amount)}`,
        '',
        'Press **Join** to accept this duel.',
      ].join('\n')
    );

  if (footer) {
    embed.setFooter({ text: footer });
  }

  return embed;
}

function resultsEmbed({ winnerId, loserId, gameName, amount, summary }) {
  return new EmbedBuilder()
    .setTitle('Battle Results')
    .setColor(0x57f287)
    .setDescription(
      [
        `🏆 Winner: <@${winnerId}>`,
        `💀 Loser: <@${loserId}>`,
        `🎮 Game: ${gameName}`,
        `💰 Stake: ${formatVP(amount)}`,
        '',
        summary ?? 'GGs!'
      ].join('\n')
    )
    .setTimestamp();
}

async function settleBattle(battle, winnerId, loserId) {
  try {
    await prisma.$transaction(async (tx) => {
      const winner = await getOrCreateUser(winnerId);
      const loser = await getOrCreateUser(loserId);

      await tx.user.update({
        where: { id: winner.id },
        data: { vp: { increment: battle.amount } },
      });

      await tx.user.update({
        where: { id: loser.id },
        data: { vp: { decrement: battle.amount } },
      });
    });
  } catch (error) {
    logger.error('battle settlement error', { err: error, battleId: battle.id });
  }
}

async function finalizeBattle(battle, winnerId, loserId, { summary } = {}) {
  if (battle.resolved) return;
  battle.resolved = true;
  battle.clearActions();
  battle.clearAllTimeouts();
  battle.snapshot = null;

  await settleBattle(battle, winnerId, loserId);

  if (battle.message) {
    const embed = resultsEmbed({
      winnerId,
      loserId,
      gameName: battle.game?.name ?? 'Battle',
      amount: battle.amount,
      summary,
    });

    await battle.message.edit({ embeds: [embed], components: [] });
  }

  ACTIVE_BATTLES.delete(battle.id);
}

function ensureParticipant(interaction, battle) {
  const userId = interaction.user?.id;
  if (![battle.challengerId, battle.opponentId].includes(userId)) {
    interaction.reply({ ephemeral: true, content: '❌ Not your battle.' }).catch(() => {});
    return false;
  }
  return true;
}

function acceptButtons(battle) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(battle.registerAction('accept', handleAccept))
      .setLabel('Accept')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(battle.registerAction('decline', handleDecline))
      .setLabel('Decline')
      .setStyle(ButtonStyle.Danger)
  );

  return [row];
}

function joinButton(battle) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(battle.registerAction('join', handleJoin))
      .setLabel('Join')
      .setStyle(ButtonStyle.Primary)
  );

  return [row];
}

function gameSelectRow(battle) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(battle.makeId('select'))
    .setPlaceholder('Pick a battle game');

  for (const game of battleGames) {
    select.addOptions(
      new StringSelectMenuOptionBuilder().setLabel(game.name).setValue(game.key)
    );
  }

  select.addOptions(new StringSelectMenuOptionBuilder().setLabel('Random Game').setValue('random'));

  return [new ActionRowBuilder().addComponents(select)];
}

export async function createDirectBattle(interaction, opponent, amount) {
  const battle = new BattleState({ interaction, opponent: opponent.id, amount, type: 'direct' });
  ACTIVE_BATTLES.set(battle.id, battle);

  await interaction.deferReply();
  battle.message = await interaction.editReply({
    embeds: [challengeEmbed({ challengerId: battle.challengerId, opponentId: battle.opponentId, amount })],
    components: acceptButtons(battle),
  });

  battle.setTimeout('accept', DEFAULT_TIMEOUT_MS, async () => {
    if (battle.status !== 'pending' || battle.resolved) return;
    battle.status = 'expired';
    battle.clearActions();
    if (battle.message) {
      await battle.message.edit({
        embeds: [
          challengeEmbed({
            challengerId: battle.challengerId,
            opponentId: battle.opponentId,
            amount,
            footer: 'Challenge expired — no response.',
          }),
        ],
        components: [],
      });
    }
    ACTIVE_BATTLES.delete(battle.id);
  });

  return battle;
}

export async function createOpenBattle(interaction, amount) {
  const battle = new BattleState({ interaction, opponent: null, amount, type: 'open' });
  ACTIVE_BATTLES.set(battle.id, battle);

  await interaction.deferReply();
  battle.message = await interaction.editReply({
    embeds: [openInviteEmbed({ challengerId: battle.challengerId, amount })],
    components: joinButton(battle),
  });

  battle.setTimeout('open', 60_000, async () => {
    if (battle.status !== 'open' || battle.resolved) return;
    battle.status = 'expired';
    battle.clearActions();
    if (battle.message) {
      await battle.message.edit({
        embeds: [openInviteEmbed({ challengerId: battle.challengerId, amount, footer: 'Invite expired after 60 seconds.' })],
        components: [],
      });
    }
    ACTIVE_BATTLES.delete(battle.id);
  });

  return battle;
}

async function handleAccept(interaction, battle) {
  if (battle.status !== 'pending') {
    await interaction.reply({ ephemeral: true, content: 'This challenge is no longer active.' });
    return;
  }

  if (interaction.user.id !== battle.opponentId) {
    await interaction.reply({ ephemeral: true, content: 'Only the challenged opponent can accept.' });
    return;
  }

  await interaction.deferUpdate();

  battle.status = 'selecting';
  battle.clearActions();
  battle.clearTimeout('accept');

  if (battle.message) {
    await battle.message.edit({
      embeds: [
        challengeEmbed({
          challengerId: battle.challengerId,
          opponentId: battle.opponentId,
          amount: battle.amount,
          footer: 'Challenge accepted! Choose a game.',
        }),
      ],
      components: gameSelectRow(battle),
    });
  }
}

async function handleDecline(interaction, battle) {
  if (battle.status !== 'pending') {
    await interaction.reply({ ephemeral: true, content: 'This challenge is no longer active.' });
    return;
  }

  if (![battle.challengerId, battle.opponentId].includes(interaction.user.id)) {
    await interaction.reply({ ephemeral: true, content: 'You are not part of this battle.' });
    return;
  }

  await interaction.deferUpdate();

  battle.status = 'declined';
  battle.clearActions();
  battle.clearTimeout('accept');

  if (battle.message) {
    await battle.message.edit({
      embeds: [
        challengeEmbed({
          challengerId: battle.challengerId,
          opponentId: battle.opponentId,
          amount: battle.amount,
          footer: 'Challenge declined.',
        }),
      ],
      components: [],
    });
  }

  ACTIVE_BATTLES.delete(battle.id);
}

async function handleJoin(interaction, battle) {
  if (battle.status !== 'open') {
    await interaction.reply({ ephemeral: true, content: 'This invite is no longer active.' });
    return;
  }

  if (interaction.user.id === battle.challengerId) {
    await interaction.reply({ ephemeral: true, content: 'You cannot join your own invite.' });
    return;
  }

  if (interaction.user.bot) {
    await interaction.reply({ ephemeral: true, content: 'Bots cannot join battles.' });
    return;
  }

  const confirmId = battle.registerAction(`join-confirm-${interaction.user.id}`, async (i, b) => {
    b.clearTimeout(`join-wait-${interaction.user.id}`);
    if (i.user.id !== interaction.user.id) {
      await i.reply({ ephemeral: true, content: 'This confirmation is not for you.' });
      return;
    }

    if (b.status !== 'open') {
      await i.reply({ ephemeral: true, content: 'The invite is no longer active.' });
      return;
    }

    b.opponentId = interaction.user.id;
    b.status = 'selecting';
    b.clearActions();
    b.clearAllTimeouts();

    await i.deferUpdate();
    await i.editReply({
      embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('Joined!').setDescription('Get ready to battle.')],
      components: [],
    });

    if (b.message) {
      await b.message.edit({
        embeds: [
          challengeEmbed({
            challengerId: b.challengerId,
            opponentId: b.opponentId,
            amount: b.amount,
            footer: 'Opponent joined! Choose a game to begin.',
          }),
        ],
        components: gameSelectRow(b),
      });
    }
  });

  const cancelId = battle.registerAction(`join-cancel-${interaction.user.id}`, async (i) => {
    battle.clearTimeout(`join-wait-${interaction.user.id}`);
    if (i.user.id !== interaction.user.id) {
      await i.reply({ ephemeral: true, content: 'This action is not for you.' });
      return;
    }
    await i.deferUpdate();
    await i.editReply({
      embeds: [new EmbedBuilder().setColor(0xffa500).setTitle('Canceled').setDescription('You decided not to join.')],
      components: [],
    });
  });

  await interaction.reply({
    ephemeral: true,
    embeds: [
      new EmbedBuilder()
        .setTitle('Join Battle?')
        .setColor(0x5865f2)
        .setDescription(
          [
            `Confirm you want to face <@${battle.challengerId}> for ${formatVP(battle.amount)}.`,
            'You have 20 seconds to decide.',
          ].join('\n')
        ),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(confirmId).setLabel('Confirm').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(cancelId).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
      ),
    ],
  });

  battle.setTimeout(`join-wait-${interaction.user.id}`, DEFAULT_TIMEOUT_MS, async () => {
    if (battle.status !== 'open') {
      return;
    }

    try {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('Invite Timed Out')
            .setDescription('You did not confirm in time.'),
        ],
        components: [],
      });
    } catch (error) {
      logger.warn('failed to edit join timeout prompt', { err: error, battleId: battle.id });
    }
  });
}

function getBattleFromInteraction(interaction) {
  const customId = interaction.customId ?? '';
  if (!customId.startsWith(`${BATTLE_CUSTOM_ID_PREFIX}:`)) {
    return null;
  }

  const [, battleId] = customId.split(':');
  return ACTIVE_BATTLES.get(battleId) ?? null;
}

export async function handleBattleComponent(interaction) {
  const battle = getBattleFromInteraction(interaction);
  if (!battle) {
    return false;
  }

  const handler = battle.actionHandlers.get(interaction.customId);
  if (!handler) {
    await interaction.reply({ ephemeral: true, content: 'This action is no longer available.' });
    return true;
  }

  try {
    const result = await handler(interaction, battle);
    return result ?? true;
  } catch (error) {
    logger.error('battle component error', { err: error, battleId: battle.id });
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ ephemeral: true, content: 'Something went wrong handling that action.' });
    }
    return true;
  }
}

export async function handleBattleSelect(interaction) {
  const battle = getBattleFromInteraction(interaction);
  if (!battle) {
    return false;
  }

  const parts = interaction.customId.split(':');
  const action = parts[3];
  if (action !== 'select') {
    const handler = battle.actionHandlers.get(interaction.customId);
    if (handler) {
      try {
        await handler(interaction, battle);
      } catch (error) {
        logger.error('battle select action failed', { err: error, battleId: battle.id });
      }
      return true;
    }
    return false;
  }

  if (!ensureParticipant(interaction, battle)) {
    return true;
  }

  if (battle.status !== 'selecting') {
    await interaction.reply({ ephemeral: true, content: 'Game selection is not available right now.' });
    return true;
  }

  const choice = interaction.values?.[0];
  const game = choice === 'random'
    ? battleGames[crypto.randomInt(battleGames.length)]
    : getGameByKey(choice);

  if (!game) {
    await interaction.reply({ ephemeral: true, content: 'That game is unavailable.' });
    return true;
  }

  battle.game = game;
  battle.status = 'playing';
  battle.clearActions();

  await interaction.deferUpdate();

  const context = {
    challengerId: battle.challengerId,
    opponentId: battle.opponentId,
    amount: battle.amount,
    interaction,
    makeId: (suffix) => battle.makeId(suffix),
    render: async (payload = {}) => {
      if (battle.message) {
        battle.message = await battle.message.edit(payload);
      }
    },
    registerAction: (suffix, handler) => battle.registerAction(suffix, handler),
    clearActions: () => battle.clearActions(),
    setTimeout: (key, ms, handler) => battle.setTimeout(key, ms, handler),
    clearTimeout: (key) => battle.clearTimeout(key),
    onTimeoutWin: async (winnerId) => {
      if (!winnerId) return;
      const loserId = winnerId === battle.challengerId ? battle.opponentId : battle.challengerId;
      await finalizeBattle(battle, winnerId, loserId, { summary: 'Win by timeout.' });
    },
    end: async (winnerId, loserId, options = {}) => finalizeBattle(battle, winnerId, loserId, options),
    ensureParticipant: (i) => ensureParticipant(i, battle),
    saveSnapshot: (snapshot) => {
      battle.snapshot = {
        gameKey: battle.game?.key,
        updatedAt: Date.now(),
        state: snapshot,
      };
    },
    battle,
  };

  try {
    await game.start(context);
  } catch (error) {
    logger.error('battle game start failure', { err: error, battleId: battle.id, game: game.key });
    battle.status = 'errored';
    battle.clearActions();
    await battle.message?.edit({
      content: 'Failed to start the selected game. Battle canceled.',
      embeds: [],
      components: [],
    });
    ACTIVE_BATTLES.delete(battle.id);
  }

  return true;
}

export function isBattleInteraction(customId) {
  return customId?.startsWith(`${BATTLE_CUSTOM_ID_PREFIX}:`);
}

