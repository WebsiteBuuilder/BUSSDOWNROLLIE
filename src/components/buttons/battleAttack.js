import { ackButton, ackWithin3s } from '../../utils/interaction.js';
import { BattleStatus } from '../../types.js';
import { logger } from '../../logger.js';

export async function handleBattleAttackButton({
  allowedUserIds,
  battleId,
  interaction,
  getBattle,
  setBattle,
  endBattle,
  buildBattleControls,
  renderBattleState,
}) {
  const markAck = ackWithin3s(interaction, {
    scope: 'battle-button',
    action: 'attack',
    battleId,
  });

  await ackButton(interaction);
  markAck();

  const userId = interaction.user.id;

  if (!allowedUserIds.includes(userId)) {
    await interaction.followUp({
      ephemeral: true,
      content: 'You aren’t part of this battle.',
    });
    return;
  }

  const battle = getBattle(battleId);

  if (!battle || battle.message?.id !== interaction.message.id) {
    await interaction.followUp({
      ephemeral: true,
      content: 'This battle is no longer active.',
    });
    return;
  }

  if (battle.status !== BattleStatus.Active) {
    await interaction.followUp({
      ephemeral: true,
      content: 'This battle has already ended.',
    });
    return;
  }

  if (!battle.participants.includes(userId)) {
    await interaction.followUp({
      ephemeral: true,
      content: 'You aren’t part of this battle.',
    });
    return;
  }

  battle.message = interaction.message;

  const opponentId = userId === battle.initiatorId ? battle.opponentId : battle.initiatorId;
  const damage = Math.floor(Math.random() * 21) + 10;
  const newHp = Math.max(0, (battle.hp[opponentId] ?? 0) - damage);

  battle.hp[opponentId] = newHp;
  battle.lastActionAt = Date.now();
  battle.log.push(`💥 <@${userId}> dealt **${damage}** damage to <@${opponentId}>!`);

  if (newHp <= 0) {
    battle.status = BattleStatus.Ended;
    battle.log.push(`🏆 <@${userId}> defeated <@${opponentId}>!`);

    try {
      await endBattle(battleId, 'victory');
    } catch (err) {
      logger.error('failed to end battle after attack', {
        err,
        battleId,
        interactionId: interaction.id,
      });
    }
    return;
  }

  try {
    setBattle(battleId, battle);
    await interaction.message.edit({
      content: renderBattleState(battle),
      components: buildBattleControls(battle),
    });
  } catch (err) {
    logger.error('failed to persist battle update', {
      err,
      battleId,
      interactionId: interaction.id,
    });
    await interaction.followUp({
      ephemeral: true,
      content: 'We couldn’t process that attack. Please try again.',
    });
  }
}
