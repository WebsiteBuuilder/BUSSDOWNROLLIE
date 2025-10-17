import { randomUUID } from 'crypto';
import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { ackButton, ackWithin3s, safeReply } from '../utils/interaction.js';
import { BATTLE_NAMESPACE, BattleStatus } from '../types.js';
import { logger } from '../logger.js';
import { handleBattleAttackButton } from '../components/buttons/battleAttack.js';
import { handleBattleRunButton } from '../components/buttons/battleRun.js';

const BATTLE_TIMEOUT_MS = 60_000;

const battles = new Map();

const buttonHandlers = {
  attack: handleBattleAttackButton,
  run: handleBattleRunButton,
};

export const data = new SlashCommandBuilder()
  .setName('battle')
  .setDescription('Challenge another user to a quick battle!')
  .addUserOption((option) =>
    option
      .setName('opponent')
      .setDescription('Who do you want to challenge?')
      .setRequired(true)
  );

export async function handleBattle(interaction) {
  const opponent = interaction.options.getUser('opponent', true);
  const markAck = ackWithin3s(interaction, { scope: 'battle-command' });

  if (opponent.bot) {
    markAck();
    await safeReply(interaction, {
      content: '🤖 You cannot battle a bot. Choose a real opponent!',
      ephemeral: true,
    });
    return;
  }

  if (opponent.id === interaction.user.id) {
    markAck();
    await safeReply(interaction, {
      content: '🪞 Battling yourself is not allowed. Pick someone else!',
      ephemeral: true,
    });
    return;
  }

  const battleId = randomUUID();
  const participants = [interaction.user.id, opponent.id];
  const participantsKey = participants.join(',');
  const battle = {
    id: battleId,
    initiatorId: interaction.user.id,
    opponentId: opponent.id,
    participants,
    participantsKey,
    status: BattleStatus.Active,
    hp: {
      [interaction.user.id]: 100,
      [opponent.id]: 100,
    },
    log: [`⚔️ **${interaction.user.username}** challenged **${opponent.username}**!`],
    createdAt: Date.now(),
    lastActionAt: Date.now(),
    timeout: null,
    message: null,
  };

  const message = await safeReply(interaction, {
    content: renderBattleState(battle),
    components: buildBattleControls(battle),
    fetchReply: true,
  });

  markAck();

  battle.message = message;
  battles.set(battleId, battle);
  scheduleBattleTimeout(battleId);

  logger.info('battle started', {
    battleId,
    initiatorId: interaction.user.id,
    opponentId: opponent.id,
  });
}

export async function execute(interaction) {
  return handleBattle(interaction);
}

export function getBattle(battleId) {
  return battles.get(battleId);
}

export function setBattle(battleId, state) {
  battles.set(battleId, state);
  scheduleBattleTimeout(battleId);
}

export function deleteBattle(battleId) {
  const battle = battles.get(battleId);
  if (battle?.timeout) {
    clearTimeout(battle.timeout);
  }
  battles.delete(battleId);
}

export async function endBattle(battleId, reason) {
  const battle = battles.get(battleId);
  if (!battle) return;

  if (battle.timeout) {
    clearTimeout(battle.timeout);
    battle.timeout = null;
  }

  battle.status = BattleStatus.Ended;
  battle.endedAt = Date.now();
  battle.endedReason = reason;
  battles.set(battleId, battle);

  if (battle.message) {
    try {
      await battle.message.edit({
        content: renderBattleState(battle),
        components: buildBattleControls(battle),
      });
    } catch (err) {
      logger.warn('failed to edit battle message on end', {
        err,
        battleId,
      });
    }
  }

  battles.delete(battleId);
}

function scheduleBattleTimeout(battleId) {
  const battle = battles.get(battleId);
  if (!battle) return;

  if (battle.timeout) {
    clearTimeout(battle.timeout);
  }

  battle.timeout = setTimeout(() => {
    handleBattleTimeout(battleId).catch((err) =>
      logger.error('battle timeout error', { err, battleId })
    );
  }, BATTLE_TIMEOUT_MS);
  battle.timeout.unref?.();
}

async function handleBattleTimeout(battleId) {
  const battle = battles.get(battleId);
  if (!battle || battle.status !== BattleStatus.Active) {
    return;
  }

  battle.status = BattleStatus.Ended;
  battle.log.push('⌛ The battle ended due to inactivity.');

  if (battle.message) {
    try {
      await battle.message.edit({
        content: renderBattleState(battle),
        components: buildBattleControls(battle),
      });
    } catch (err) {
      logger.warn('failed to edit battle message after timeout', {
        err,
        battleId,
      });
    }
  }

  deleteBattle(battleId);
}

export function buildBattleControls(battle) {
  const disabled = battle.status !== BattleStatus.Active;
  const idSuffix = `${battle.id}:${battle.participantsKey}`;

  if (disabled) {
    return [];
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${BATTLE_NAMESPACE}:attack:${idSuffix}`)
      .setLabel('Attack')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`${BATTLE_NAMESPACE}:run:${idSuffix}`)
      .setLabel('Run')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled)
  );

  return [row];
}

export function renderBattleState(battle) {
  const initiatorHp = battle.hp[battle.initiatorId];
  const opponentHp = battle.hp[battle.opponentId];
  const latestEvent = battle.log[battle.log.length - 1] ?? 'The battle continues.';

  const lines = [
    `**${latestEvent}**`,
    '',
    `🛡️ <@${battle.initiatorId}> — HP: ${initiatorHp}`,
    `🛡️ <@${battle.opponentId}> — HP: ${opponentHp}`,
  ];

  if (battle.status === BattleStatus.Ended) {
    lines.push('', 'The battle has concluded.');
  } else {
    lines.push('', 'Press **Attack** to strike or **Run** to flee.');
  }

  return lines.join('\n');
}

export async function routeBattleButton(action, battleId, allowedUserId, interaction) {
  const handler = buttonHandlers[action];

  if (!handler) {
    logger.warn('unknown battle button action', {
      action,
      battleId,
      customId: interaction.customId,
    });
    await ackButton(interaction);
    await interaction.followUp({
      ephemeral: true,
      content: 'That battle action is no longer available.',
    });
    return;
  }

  const allowedUserIds = allowedUserId
    ? allowedUserId.split(',').filter(Boolean)
    : [];

  try {
    await handler({
      action,
      allowedUserIds,
      battleId,
      interaction,
      getBattle,
      setBattle,
      endBattle,
      buildBattleControls,
      renderBattleState,
    });
  } catch (err) {
    logger.error('battle button handler error', {
      err,
      action,
      battleId,
      interactionId: interaction.id,
      userId: interaction.user?.id,
    });
    if (!interaction.deferred && !interaction.replied) {
      await ackButton(interaction);
    }
    await interaction.followUp({
      ephemeral: true,
      content: 'Something went wrong processing this battle action.',
    });
  }
}
