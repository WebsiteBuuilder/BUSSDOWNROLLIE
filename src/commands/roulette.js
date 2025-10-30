import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { startRoulette, handleRouletteButton, showRouletteRules } from '../roulette/robust-manager.js';
import { getAnimationStatus } from '../roulette/safe-animation.js';
import { safeReply } from '../utils/interaction.js';
import { computeSpinPlan } from '../roulette/physics.js';
import { createPlaceholderEmbed } from '../roulette/render.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const data = new SlashCommandBuilder()
  .setName('roulette')
  .setDescription('Play European roulette with VP currency')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('play')
      .setDescription('Start playing roulette')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('rules')
      .setDescription('View roulette rules and betting options')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('debug')
      .setDescription('Debug roulette physics with custom parameters')
      .addNumberOption((option) =>
        option
          .setName('winning_number')
          .setDescription('Winning number (0-36)')
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(36)
      )
      .addNumberOption((option) =>
        option
          .setName('wheel_rpm')
          .setDescription('Initial wheel RPM (default: 30)')
          .setRequired(false)
          .setMinValue(10)
          .setMaxValue(60)
      )
      .addNumberOption((option) =>
        option
          .setName('ball_rpm')
          .setDescription('Initial ball RPM (default: 180)')
          .setRequired(false)
          .setMinValue(100)
          .setMaxValue(300)
      )
      .addNumberOption((option) =>
        option
          .setName('laps')
          .setDescription('Number of ball laps (default: 15)')
          .setRequired(false)
          .setMinValue(5)
          .setMaxValue(25)
      )
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  
  // Always allow rules to be viewed
  if (subcommand === 'rules') {
    return showRouletteRules(interaction);
  }
  
  // Handle debug subcommand
  if (subcommand === 'debug') {
    return handleDebugSubcommand(interaction);
  }
  
  // Check if hybrid animation system is available before allowing play
  if (subcommand === 'play') {
    try {
      await startHybridRoulette(interaction);
    } catch (error) {
      console.error('❌ Error executing /roulette play:', error);
      await safeReply(interaction, {
        content: '❌ Failed to start roulette. Please try again soon.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

/**
 * Handle debug subcommand to dump computed parameters
 */
async function handleDebugSubcommand(interaction) {
  try {
    const winningNumber = interaction.options.getNumber('winning_number');
    const wheelRpm0 = interaction.options.getNumber('wheel_rpm') || 30;
    const ballRpm0 = interaction.options.getNumber('ball_rpm') || 180;
    const laps = interaction.options.getNumber('laps') || 15;
    
    // Compute physics parameters
    const spinPlan = computeSpinPlan(
      winningNumber,
      'european',
      16, // fps
      8.5, // duration
      wheelRpm0,
      ballRpm0,
      0.8, // kWheel
      0.6, // kBall
      laps
    );
    
    // Calculate derived values
    const omega0 = ballRpm0 * 2 * Math.PI / 60; // rad/s
    const k = 0.6; // s^-1
    const targetAngle = winningNumber * (2 * Math.PI / 37); // radians
    const dropFrame = spinPlan.dropFrame;
    const totalFrames = spinPlan.totalFrames;
    
    // Format debug information
    const debugEmbed = {
      title: '🔍 Roulette Physics Debug',
      description: `Debug information for winning number **${winningNumber}**`,
      color: 0x4CAF50,
      fields: [
        {
          name: '📊 Core Parameters',
          value: [
            `ω₀ (omega₀): **${omega0.toFixed(3)} rad/s**`,
            `k (friction): **${k} s⁻¹**`,
            `laps: **${laps}**`,
            `targetAngle: **${targetAngle.toFixed(3)} rad** (${(targetAngle * 180 / Math.PI).toFixed(1)}°)`
          ].join('\n'),
          inline: false
        },
        {
          name: '🎯 Timing',
          value: [
            `dropFrame: **${dropFrame}**`,
            `totalFrames: **${totalFrames}**`,
            `duration: **8.5s**`,
            `fps: **16**`
          ].join('\n'),
          inline: true
        },
        {
          name: '🔧 Configuration',
          value: [
            `wheelRPM: **${wheelRpm0}**`,
            `ballRPM: **${ballRpm0}**`,
            `kWheel: **0.8**`,
            `kBall: **0.6**`
          ].join('\n'),
          inline: true
        },
        {
          name: '📍 European Wheel',
          value: [
            `pockets: **37**`,
            `winningPocketIndex: **${spinPlan.winningPocketIndex}**`,
            `pocketAngle: **${(spinPlan.pocketAngle * 180 / Math.PI).toFixed(2)}°**`
          ].join('\n'),
          inline: true
        }
      ],
      footer: {
        text: 'Still GUHHHD Roulette - Hybrid Physics Engine'
      },
      timestamp: new Date().toISOString()
    };
    
    await interaction.reply({ embeds: [debugEmbed] });
  } catch (error) {
    console.error('❌ Error in debug subcommand:', error);
    await interaction.reply({
      content: '❌ Failed to compute debug parameters. Please try again.',
      flags: MessageFlags.Ephemeral
    });
  }
}

/**
 * Start hybrid roulette with instant response and worker-based rendering
 */
async function startHybridRoulette(interaction) {
  try {
    // Defer reply immediately for sub-300ms response
    await interaction.deferReply();
    
    // Get user info
    const { getOrCreateUser } = await import('../db/index.js');
    const user = await getOrCreateUser(interaction.user.id);
    
    if (user.blacklisted) {
      return interaction.editReply({
        content: '🚫 You are not allowed to play roulette.',
        flags: MessageFlags.Ephemeral
      });
    }
    
    if (user.vp < 1) {
      return interaction.editReply({
        content: `❌ You need at least 1 VP to play roulette, but you only have ${user.vp} VP.`
      });
    }
    
    // Create and send instant placeholder embed
    const displayName = interaction.member?.displayName ?? interaction.user.username;
    const placeholderEmbed = createPlaceholderEmbed(displayName, 0);
    
    const spinMessage = await interaction.editReply({
      embeds: [placeholderEmbed],
      components: []
    });
    
    // Start worker for physics computation and rendering
    const renderWorker = new Worker(
      path.join(__dirname, '../roulette/render-worker.js'),
      { type: 'module' }
    );
    
    // Wait for worker to be ready
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Worker initialization timeout')), 5000);
      
      renderWorker.on('message', (message) => {
        if (message.type === 'ready') {
          clearTimeout(timeout);
          resolve();
        } else if (message.type === 'error') {
          clearTimeout(timeout);
          reject(new Error(message.error));
        }
      });
      
      renderWorker.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    
    console.log('✅ Hybrid roulette worker initialized successfully');
    
    // Start the regular roulette flow in background
    setTimeout(() => {
      startRoulette(interaction).catch(error => {
        console.error('Background roulette start failed:', error);
      });
    }, 100);
    
  } catch (error) {
    console.error('❌ Error starting hybrid roulette:', error);
    
    // Fallback to regular roulette system
    try {
      await startRoulette(interaction);
    } catch (fallbackError) {
      console.error('❌ Fallback roulette also failed:', fallbackError);
      await safeReply(interaction, {
        content: '❌ Failed to start roulette. Please try again soon.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
}

export { handleRouletteButton };
