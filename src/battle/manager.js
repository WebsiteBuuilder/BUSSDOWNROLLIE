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
import { battleGames, getGameByKey } from './registry.js';
import { logger } from '../logger.js';
import { labelForUser } from '../ui/labelForUser.js';

const nowMs = () => Date.now();

async function fetchMemberSafe(guild, userId) {
  if (!guild || !userId) return null;
  const cached = guild.members?.cache?.get(userId);
  if (cached) return cached;
  try {
    return await guild.members.fetch(userId);
  } catch (error) {
    logger.debug?.('battle manager: failed to fetch guild member', { userId, guildId: guild.id, err: error });
    return null;
  }
}

async function fetchUserSafe(client, userId) {
  if (!client || !userId) return null;
  const cached = client.users?.cache?.get(userId);
  if (cached) return cached;
  try {
    return await client.users.fetch(userId);
  } catch (error) {
    logger.debug?.('battle manager: failed to fetch user', { userId, err: error });
    return null;
  }
}

function formatTag(user, userId) {
  if (!user) return userId ?? 'unknown#0000';
  if (user.tag) return user.tag;
  const username = user.username ?? 'unknown';
  const discriminator = user.discriminator ?? '0000';
  return `${username}#${discriminator}`;
}

function formatDisplayName(member, user) {
  if (member?.displayName) return member.displayName;
  if (user?.username) return user.username;
  if (user?.tag) return user.tag;
  return 'Unknown';
}

async function buildPlayerInfo({ guild, client, userId, fallbackMember, fallbackUser }) {
  if (!userId) {
    return { id: null, tag: 'unknown#0000', displayName: 'Unknown' };
  }

  const member = fallbackMember ?? (await fetchMemberSafe(guild, userId));
  const user = fallbackUser ?? member?.user ?? (await fetchUserSafe(client, userId));

  return {
    id: userId,
    tag: formatTag(user, userId),
    displayName: formatDisplayName(member, user),
  };
}

async function resolveBattlePlayers(battle, guild) {
  if (!battle) {
    return { p1: null, p2: null };
  }

  const resolvedGuild = guild ?? battle.guild ?? null;
  if (resolvedGuild && !battle.guild) {
    battle.guild = resolvedGuild;
    battle.guildId = resolvedGuild.id;
  }

  const client = battle.interaction?.client ?? battle.client ?? resolvedGuild?.client ?? null;

  let challengerMember =
    battle.challengerMember ?? resolvedGuild?.members?.cache?.get(battle.challengerId) ?? null;
  if (!challengerMember && resolvedGuild) {
    challengerMember = await fetchMemberSafe(resolvedGuild, battle.challengerId);
  }
  if (challengerMember && !battle.challengerMember) {
    battle.challengerMember = challengerMember;
  }

  let opponentMember =
    battle.opponentMember && battle.opponentId
      ? battle.opponentMember
      : battle.opponentId
      ? resolvedGuild?.members?.cache?.get(battle.opponentId) ?? null
      : null;
  if (!opponentMember && resolvedGuild && battle.opponentId) {
    opponentMember = await fetchMemberSafe(resolvedGuild, battle.opponentId);
  }
  if (opponentMember && !battle.opponentMember) {
    battle.opponentMember = opponentMember;
  }

  const p1 = await buildPlayerInfo({
    guild: resolvedGuild,
    client,
    userId: battle.challengerId,
    fallbackMember: challengerMember,
    fallbackUser: battle.challengerUser,
  });

  const p2 = battle.opponentId
    ? await buildPlayerInfo({
        guild: resolvedGuild,
        client,
        userId: battle.opponentId,
        fallbackMember: opponentMember,
        fallbackUser: battle.opponentUser,
      })
    : null;

  battle.p1 = p1;
  battle.p2 = p2;

  return { p1, p2 };
}

const ACTIVE_BATTLES = new Map();
export const BATTLE_CUSTOM_ID_PREFIX = 'b';
const DEFAULT_TIMEOUT_MS = 20_000;

function randomId() {
  return crypto.randomBytes(6).toString('hex');
}

class BattleState {
  constructor({ interaction, opponent, opponentUser, opponentMember, amount, type }) {
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
    this.client = interaction.client;
    this.guildId = interaction.guildId ?? null;
    this.guild = interaction.guild ?? null;
    this.challengerMember = interaction.member ?? null;
    this.challengerUser = interaction.user;
    this.opponentMember = opponentMember ?? null;
    this.opponentUser = opponentUser ?? null;
    this.p1 = null;
    this.p2 = null;
  }

  makeId({ player = 'sys', action = 'noop' }) {
    this.turn += 1;
    return `${BATTLE_CUSTOM_ID_PREFIX}:${this.id}:${player}:${action}:${this.turn}`;
  }

  registerAction({ player = 'sys', action = 'noop' }, handler) {
    const id = this.makeId({ player, action });
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

const EMBED_COLORS = {
  neutral: 0x2b2d31,
  victory: 0x57f287,
  defeat: 0xed4245,
};

function playerLine(battle) {
  const challenger = battle.p1 ?? { id: battle.challengerId, displayName: `<@${battle.challengerId}>` };
  const opponent = battle.p2
    ? battle.p2
    : battle.opponentId
    ? { id: battle.opponentId, displayName: `<@${battle.opponentId}>` }
    : null;

  const left = labelForUser(challenger, challenger.id);
  const right = opponent ? labelForUser(opponent, opponent.id) : 'Awaiting opponent…';
  return `${left} 🆚 ${right}`;
}

function challengeEmbed(battle, { statusText = 'Waiting for a response…', status = 'neutral' } = {}) {
  return new EmbedBuilder()
    .setTitle('⚔️ Battle Challenge')
    .setColor(EMBED_COLORS[status] ?? EMBED_COLORS.neutral)
    .setDescription([
      playerLine(battle),
      '',
      `Stake: ${battle.amount} points`,
      statusText,
    ].join('\n'))
    .setFooter({ text: `💰 Total Wager: ${battle.amount} points` });
}

function openInviteEmbed(battle) {
  return new EmbedBuilder()
    .setTitle('⚔️ Open Battle Invite')
    .setColor(EMBED_COLORS.neutral)
    .setDescription([
      playerLine(battle),
      '',
      `Stake: ${battle.amount} points`,
      'Press **Join** to accept this duel.',
    ].join('\n'))
    .setFooter({ text: `💰 Total Wager: ${battle.amount} points` });
}

function resultsEmbed(battle, { winnerId, loserId, gameName, amount, summary }) {
  const winner = winnerId === battle.challengerId ? battle.p1 : battle.p2;
  const loser = loserId === battle.challengerId ? battle.p1 : battle.p2;
  const winnerLabel = labelForUser(winner ?? { id: winnerId, displayName: `<@${winnerId}>` }, winnerId);
  const loserLabel = labelForUser(loser ?? { id: loserId, displayName: `<@${loserId}>` }, loserId);

  return new EmbedBuilder()
    .setTitle('🏁 Battle Results')
    .setColor(EMBED_COLORS.victory)
    .setDescription(
      [
        `🏆 ${winnerLabel}`,
        `💀 ${loserLabel}`,
        `🎮 Game: ${gameName}`,
        summary ?? 'GGs!',
      ].join('\n\n')
    )
    .setFooter({ text: `💰 Total Wager: ${amount} points` })
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
    await resolveBattlePlayers(battle, battle.guild ?? null);
    const embed = resultsEmbed(battle, {
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
      .setCustomId(battle.registerAction({ player: 'p2', action: 'accept' }, handleAccept))
      .setLabel('Accept')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(battle.registerAction({ player: 'p2', action: 'decline' }, handleDecline))
      .setLabel('Decline')
      .setStyle(ButtonStyle.Danger)
  );

  return [row];
}

function joinButton(battle) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(battle.registerAction({ player: 'p2', action: 'join' }, handleJoin))
      .setLabel('Join')
      .setStyle(ButtonStyle.Primary)
  );

  return [row];
}

function gameSelectRow(battle) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(battle.makeId({ player: 'sys', action: 'select' }))
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
  // Check challenger has enough points
  const challenger = await getOrCreateUser(interaction.user.id);
  if (challenger.vp < amount) {
    await interaction.reply({
      ephemeral: true,
      content: `❌ You don't have enough points to start this battle. You need ${amount} points, but you only have ${challenger.vp} points.`,
    });
    return null;
  }

  const opponentMember = interaction.guild?.members?.cache?.get(opponent.id) ?? null;
  const battle = new BattleState({
    interaction,
    opponent: opponent.id,
    opponentUser: opponent,
    opponentMember,
    amount,
    type: 'direct',
  });
  ACTIVE_BATTLES.set(battle.id, battle);

  await interaction.deferReply();
  await resolveBattlePlayers(battle, interaction.guild);
  battle.message = await interaction.editReply({
    embeds: [challengeEmbed(battle)],
    components: acceptButtons(battle),
  });

  battle.setTimeout('accept', DEFAULT_TIMEOUT_MS, async () => {
    if (battle.status !== 'pending' || battle.resolved) return;
    battle.status = 'expired';
    battle.clearActions();
    if (battle.message) {
      await resolveBattlePlayers(battle, interaction.guild);
      await battle.message.edit({
        embeds: [challengeEmbed(battle, { statusText: 'Challenge expired — no response.', status: 'defeat' })],
        components: [],
      });
    }
    ACTIVE_BATTLES.delete(battle.id);
  });

  return battle;
}

export async function createOpenBattle(interaction, amount) {
  // Check challenger has enough points
  const challenger = await getOrCreateUser(interaction.user.id);
  if (challenger.vp < amount) {
    await interaction.reply({
      ephemeral: true,
      content: `❌ You don't have enough points to start this battle. You need ${amount} points, but you only have ${challenger.vp} points.`,
    });
    return null;
  }

  const battle = new BattleState({
    interaction,
    opponent: null,
    opponentUser: null,
    opponentMember: null,
    amount,
    type: 'open',
  });
  ACTIVE_BATTLES.set(battle.id, battle);

  await interaction.deferReply();
  await resolveBattlePlayers(battle, interaction.guild);
  battle.message = await interaction.editReply({
    embeds: [openInviteEmbed(battle)],
    components: joinButton(battle),
  });

  battle.setTimeout('open', 60_000, async () => {
    if (battle.status !== 'open' || battle.resolved) return;
    battle.status = 'expired';
    battle.clearActions();
    if (battle.message) {
      await resolveBattlePlayers(battle, interaction.guild);
      await battle.message.edit({
        embeds: [challengeEmbed(battle, { statusText: 'Invite expired after 60 seconds.', status: 'defeat' })],
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

  // Check opponent has enough points
  const opponent = await getOrCreateUser(interaction.user.id);
  if (opponent.vp < battle.amount) {
    await interaction.reply({
      ephemeral: true,
      content: `❌ You don't have enough points to accept this battle. You need ${battle.amount} points, but you only have ${opponent.vp} points.`,
    });
    return;
  }

  await interaction.deferUpdate();

  battle.status = 'selecting';
  battle.clearActions();
  battle.clearTimeout('accept');

  if (battle.message) {
    await resolveBattlePlayers(battle, interaction.guild);
    await battle.message.edit({
      embeds: [challengeEmbed(battle, { statusText: 'Challenge accepted! Choose a game.' })],
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
    await resolveBattlePlayers(battle, interaction.guild);
    await battle.message.edit({
      embeds: [challengeEmbed(battle, { statusText: 'Challenge declined.', status: 'defeat' })],
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

  // Check user has enough points
  const user = await getOrCreateUser(interaction.user.id);
  if (user.vp < battle.amount) {
    await interaction.reply({
      ephemeral: true,
      content: `❌ You don't have enough points to join this battle. You need ${battle.amount} points, but you only have ${user.vp} points.`,
    });
    return;
  }

  const confirmId = battle.registerAction({ player: 'p2', action: `join-confirm-${interaction.user.id}` }, async (i, b) => {
    b.clearTimeout(`join-wait-${interaction.user.id}`);
    if (i.user.id !== interaction.user.id) {
      await i.reply({ ephemeral: true, content: 'This confirmation is not for you.' });
      return;
    }

    if (b.status !== 'open') {
      await i.reply({ ephemeral: true, content: 'The invite is no longer active.' });
      return;
    }

    // Re-check balance at confirmation time (race condition protection)
    const joiningUser = await getOrCreateUser(interaction.user.id);
    if (joiningUser.vp < b.amount) {
      await i.reply({
        ephemeral: true,
        content: `❌ You don't have enough points to join this battle. You need ${b.amount} points, but you only have ${joiningUser.vp} points.`,
      });
      return;
    }

    b.opponentMember = interaction.member ?? i.member ?? b.opponentMember ?? null;
    b.opponentUser = interaction.user;
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
      await resolveBattlePlayers(b, interaction.guild);
      await b.message.edit({
        embeds: [challengeEmbed(b, { statusText: 'Opponent joined! Choose a game to begin.' })],
        components: gameSelectRow(b),
      });
    }
  });

  const cancelId = battle.registerAction({ player: 'p2', action: `join-cancel-${interaction.user.id}` }, async (i) => {
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
            `Confirm you want to face <@${battle.challengerId}> for ${battle.amount} points.`,
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

  const { p1, p2 } = await resolveBattlePlayers(battle, interaction.guild);

  const context = {
    battleId: battle.id,
    nowMs,
    p1,
    p2,
    challengerId: battle.challengerId,
    opponentId: battle.opponentId,
    amount: battle.amount,
    interaction,
    makeId: (details) => battle.makeId(details ?? { player: 'sys', action: 'noop' }),
    render: async (payload = {}) => {
      if (battle.message) {
        battle.message = await battle.message.edit(payload);
      }
    },
    registerAction: (details, handler) => battle.registerAction(details, handler),
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

