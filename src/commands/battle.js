import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createDirectBattle, createOpenBattle, handleBattleComponent, handleBattleSelect, isBattleInteraction } from '../battle/manager.js';
import { safeReply } from '../utils/interaction.js';

export const data = new SlashCommandBuilder()
  .setName('battle')
  .setDescription('Challenge another user or open a vouch battle invite.')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('challenge')
      .setDescription('Challenge a specific opponent to a battle.')
      .addUserOption((option) =>
        option.setName('opponent').setDescription('Who do you want to battle?').setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('amount')
          .setDescription('Vouch points at stake')
          .setRequired(true)
          .setMinValue(1)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('open')
      .setDescription('Create an open 60 second invite for anyone to join.')
      .addIntegerOption((option) =>
        option
          .setName('amount')
          .setDescription('Vouch points at stake')
          .setRequired(true)
          .setMinValue(1)
      )
  );

async function handleChallenge(interaction) {
  const opponent = interaction.options.getUser('opponent', true);
  const amount = interaction.options.getInteger('amount', true);

  if (opponent.bot) {
    await safeReply(interaction, {
      content: '🤖 You cannot battle a bot. Choose a real opponent!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (opponent.id === interaction.user.id) {
    await safeReply(interaction, {
      content: '🪞 Battling yourself is not allowed. Pick someone else!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await createDirectBattle(interaction, opponent, amount);
}

async function handleOpen(interaction) {
  const amount = interaction.options.getInteger('amount', true);
  await createOpenBattle(interaction, amount);
}

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'open') {
    await handleOpen(interaction);
    return;
  }

  await handleChallenge(interaction);
}

export { handleBattleComponent, handleBattleSelect, isBattleInteraction };
