import { SlashCommandBuilder, MessageFlags, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { generateCinematicSpin } from '../roulette/cinematic-animation.js';
import { safeReply } from '../utils/interaction.js';

/**
 * Roulette Performance Benchmark Command
 * Tests animation generation performance and file sizes
 */

export const data = new SlashCommandBuilder()
  .setName('roulette-test')
  .setDescription('[ADMIN] Benchmark roulette animation performance')
  .addIntegerOption(option =>
    option
      .setName('number')
      .setDescription('Winning number to test (0-36)')
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(36)
  )
  .addIntegerOption(option =>
    option
      .setName('fps')
      .setDescription('Frames per second (default: 20)')
      .setRequired(false)
      .setMinValue(10)
      .setMaxValue(30)
  )
  .addIntegerOption(option =>
    option
      .setName('quality')
      .setDescription('GIF quality 1-20 (higher = smaller file, default: 15)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(20)
  );

export async function execute(interaction) {
  // Check if user is admin (you can add admin role check here)
  const isAdmin = interaction.member?.permissions?.has('Administrator');
  
  if (!isAdmin) {
    return safeReply(interaction, {
      content: '❌ This command is only available to administrators.',
      flags: MessageFlags.Ephemeral
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const testNumber = interaction.options.getInteger('number') ?? Math.floor(Math.random() * 37);
  const fps = interaction.options.getInteger('fps') ?? 20;
  const quality = interaction.options.getInteger('quality') ?? 15;

  const statusEmbed = new EmbedBuilder()
    .setColor(0xfaa61a)
    .setTitle('🎬 Roulette Animation Benchmark')
    .setDescription('🔄 **Generating test animation...**')
    .addFields(
      { name: '🎯 Test Number', value: testNumber.toString(), inline: true },
      { name: '🎞️ FPS', value: fps.toString(), inline: true },
      { name: '⚙️ Quality', value: quality.toString(), inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [statusEmbed] });

  try {
    console.log(`🧪 [BENCHMARK] Starting test for number ${testNumber} (${fps}fps, Q${quality})`);
    const benchmarkStart = Date.now();

    const job = await generateCinematicSpin(testNumber, {
      duration: 3500,
      fps,
      quality
    });

    const previewAttachment = new AttachmentBuilder(job.preview.buffer, {
      name: 'roulette-preview.png',
      description: `Preview frame for number ${testNumber}`
    });

    statusEmbed
      .setDescription('🖼️ **Preview ready!** Encoding cinematic spin...')
      .setImage('attachment://roulette-preview.png');

    await interaction.editReply({ embeds: [statusEmbed], files: [previewAttachment] });

    const result = await job.final;
    const totalTime = ((Date.now() - benchmarkStart) / 1000).toFixed(2);
    const metadata = result.metadata;

    // Performance rating
    let rating = '⭐⭐⭐⭐⭐'; // Excellent
    let status = '✅ Excellent';
    
    if (metadata.encodeTimeSeconds > 2) {
      rating = '⭐⭐⭐⭐'; // Good
      status = '✅ Good';
    }
    if (metadata.encodeTimeSeconds > 3) {
      rating = '⭐⭐⭐'; // Fair
      status = '⚠️ Fair';
    }
    if (metadata.encodeTimeSeconds > 4) {
      rating = '⭐⭐'; // Slow
      status = '⚠️ Slow';
    }
    if (metadata.sizeMB > 2.5) {
      status = '⚠️ Large File';
    }
    if (metadata.sizeMB >= 3) {
      status = '❌ TOO LARGE';
    }

    const finalAttachment = new AttachmentBuilder(result.buffer, {
      name: 'roulette-spin.gif',
      description: `STILL GUUHHHD Roulette - Number ${metadata.winningNumber}`
    });

    const resultEmbed = new EmbedBuilder()
      .setColor(metadata.sizeMB < 3 ? 0x00FF75 : 0xf04747)
      .setTitle('🎬 Roulette Animation Benchmark Results')
      .setDescription(`${rating}\n**Performance:** ${status}`)
      .addFields(
        {
          name: '📊 Generation Stats',
          value: `**Encode Time:** ${metadata.encodeTimeSeconds}s\n` +
                 `**Total Time:** ${totalTime}s\n` +
                 `**Frames:** ${metadata.frames}\n` +
                 `**FPS:** ${metadata.fps}`,
          inline: true
        },
        {
          name: '💾 File Stats',
          value: `**Size:** ${metadata.sizeMB}MB (${metadata.sizeKB}KB)\n` +
                 `**Resolution:** ${metadata.resolution}\n` +
                 `**Duration:** ${metadata.duration}ms\n` +
                 `**Quality:** ${quality}`,
          inline: true
        },
        {
          name: '🎯 Test Parameters',
          value: `**Winning #:** ${metadata.winningNumber}\n` +
                 `**Frame Rate:** ${metadata.fps} fps\n` +
                 `**Dimensions:** ${metadata.resolution}`,
          inline: false
        },
        {
          name: '📈 Performance Metrics',
          value: `**FPS During Encode:** ${(metadata.frames / metadata.encodeTimeSeconds).toFixed(1)} fps\n` +
                 `**Size Per Frame:** ${(metadata.sizeKB / metadata.frames).toFixed(1)} KB\n` +
                 `**Discord Limit:** ${((metadata.sizeMB / 3) * 100).toFixed(1)}% used`,
          inline: false
        }
      )
      .setFooter({
        text: metadata.sizeMB < 3
          ? '✅ File size is within Discord 3MB limit'
          : '❌ File size EXCEEDS Discord 3MB limit!'
      })
      .setTimestamp();

    resultEmbed.setImage('attachment://roulette-spin.gif');

    // Recommendations
    let recommendations = [];
    if (metadata.encodeTimeSeconds > 3) {
      recommendations.push('• Consider reducing FPS or frame count');
    }
    if (metadata.sizeMB > 2.5) {
      recommendations.push('• Increase quality setting (higher number = smaller file)');
      recommendations.push('• Reduce resolution or frame count');
    }
    if (metadata.encodeTimeSeconds < 1.5 && metadata.sizeMB < 2) {
      recommendations.push('• Performance is excellent! Consider increasing quality for better visuals.');
    }

    if (recommendations.length > 0) {
      resultEmbed.addFields({
        name: '💡 Recommendations',
        value: recommendations.join('\n'),
        inline: false
      });
    }

    await interaction.editReply({ embeds: [resultEmbed], files: [finalAttachment] });

    console.log(`✅ [BENCHMARK] Test complete: ${metadata.sizeMB}MB, ${metadata.encodeTimeSeconds}s, ${metadata.frames} frames`);

  } catch (error) {
    console.error('❌ [BENCHMARK] Test failed:', error);

    const errorEmbed = new EmbedBuilder()
      .setColor(0xf04747)
      .setTitle('❌ Benchmark Failed')
      .setDescription('The animation generation test encountered an error.')
      .addFields(
        { name: 'Error', value: error.message || 'Unknown error', inline: false },
        { name: 'Test Number', value: testNumber.toString(), inline: true },
        { name: 'FPS', value: fps.toString(), inline: true },
        { name: 'Quality', value: quality.toString(), inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

