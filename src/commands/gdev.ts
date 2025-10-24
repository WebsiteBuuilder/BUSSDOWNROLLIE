import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { getGiveawayScheduler, getGiveawayService } from '../features/giveaways/router.ts';

export const data = new SlashCommandBuilder()
  .setName('gdev')
  .setDescription('Giveaway QA utilities')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('fast_end')
      .setDescription('Force a giveaway to end within a number of seconds')
      .addStringOption((option) => option.setName('giveaway_id').setDescription('Giveaway ID').setRequired(true))
      .addIntegerOption((option) =>
        option.setName('seconds').setDescription('Seconds until completion').setRequired(true).setMinValue(1)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('mock_entries')
      .setDescription('Populate mock entries for testing')
      .addStringOption((option) => option.setName('giveaway_id').setDescription('Giveaway ID').setRequired(true))
      .addIntegerOption((option) =>
        option.setName('count').setDescription('Number of mock entries').setRequired(true).setMinValue(1)
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  const service = getGiveawayService();
  const scheduler = getGiveawayScheduler();
  const sub = interaction.options.getSubcommand();

  if (sub === 'fast_end') {
    const giveawayId = interaction.options.getString('giveaway_id', true);
    const seconds = interaction.options.getInteger('seconds', true);
    const success = await service.fastForward(giveawayId, seconds);
    if (!success) {
      await interaction.reply({ content: 'Giveaway not found.', ephemeral: true });
      return;
    }
    await scheduler.refreshGiveaway(giveawayId);
    await interaction.reply({ content: `Giveaway will end in ${seconds} second(s).`, ephemeral: true });
    return;
  }

  if (sub === 'mock_entries') {
    const giveawayId = interaction.options.getString('giveaway_id', true);
    const count = interaction.options.getInteger('count', true);
    const added = await service.addMockEntries(giveawayId, count);
    if (added === 0) {
      await interaction.reply({ content: 'Giveaway not found.', ephemeral: true });
      return;
    }
    await interaction.reply({ content: `Added ${added} mock entries.`, ephemeral: true });
    return;
  }

  await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
}
