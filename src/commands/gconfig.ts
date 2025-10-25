import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { getGiveawayService } from '../features/giveaways/router.js';

export const data = new SlashCommandBuilder()
  .setName('gconfig')
  .setDescription('Configure default giveaway settings')
  .addIntegerOption((option) =>
    option.setName('default_buyin_cost').setDescription('Default buy-in cost').setMinValue(1)
  )
  .addIntegerOption((option) =>
    option
      .setName('default_reveal_window_seconds')
      .setDescription('Default reveal window in seconds (30-300)')
      .setMinValue(30)
      .setMaxValue(300)
  )
  .addIntegerOption((option) =>
    option
      .setName('default_payout_ratio_percent')
      .setDescription('Default payout ratio percent (1-100)')
      .setMinValue(1)
      .setMaxValue(100)
  )
  .addIntegerOption((option) =>
    option
      .setName('default_max_entries_per_user')
      .setDescription('Default maximum entries per user')
      .setMinValue(1)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  const service = getGiveawayService();

  const updated = service.updateConfig({
    buyInCost: interaction.options.getInteger('default_buyin_cost') ?? undefined,
    revealWindowSeconds:
      interaction.options.getInteger('default_reveal_window_seconds') ?? undefined,
    payoutRatio: interaction.options.getInteger('default_payout_ratio_percent') ?? undefined,
    maxEntriesPerUser:
      interaction.options.getInteger('default_max_entries_per_user') ?? undefined,
  });

  await interaction.reply({
    content: `Defaults updated:\n• Buy-in: ${updated.buyInCost} VP\n• Max entries/user: ${updated.maxEntriesPerUser}\n• Reveal window: ${updated.revealWindowSeconds}s\n• Payout ratio: ${updated.payoutRatio}%`,
    ephemeral: true,
  });
}
