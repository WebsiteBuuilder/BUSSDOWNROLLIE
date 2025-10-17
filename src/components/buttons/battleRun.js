import { ackButton, ackWithin3s } from '../../utils/interaction.js';
import { BattleStatus } from '../../types.js';
import { logger } from '../../logger.js';

export async function handleBattleRunButton({
  allowedUserIds,
  battleId,
  interaction,
  getBattle,
  endBattle,
}) {
  const markAck = ackWithin3s(interaction, {
    scope: 'battle-button',
    action: 'run',
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

  const opponentId = userId === battle.initiatorId ? battle.opponentId : battle.initiatorId;
  battle.status = BattleStatus.Ended;
  battle.log.push(`🏃 <@${userId}> fled the battle. <@${opponentId}> wins by default.`);

  try {
    await endBattle(battleId, 'run');
  } catch (err) {
    logger.error('failed to end battle after run', {
      err,
      battleId,
      interactionId: interaction.id,
    });
    await interaction.followUp({
      ephemeral: true,
      content: 'We couldn’t update the battle. Try again.',
    });
  }
}
