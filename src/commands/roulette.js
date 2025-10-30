import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { canvasAvailable, sharpAvailable, getNativeDependencyStatus } from '../roulette/native-deps.js';
import { computeSpinPlan } from '../roulette/physics.js';
import { createPlaceholderEmbed } from '../roulette/render.js';
import { safeReply } from '../utils/interaction.js';
import { logger } from '../logger.js';

const dependencyStatus = getNativeDependencyStatus();

let robustManagerModule = null;
let robustManagerPromise = null;
let robustManagerError = null;

async function loadRobustManager() {
  if (robustManagerModule || robustManagerError) {
    return robustManagerModule;
  }

  if (!canvasAvailable || !sharpAvailable) {
    robustManagerError = new Error('Required native dependencies are unavailable.');
    return null;
  }

  if (!robustManagerPromise) {
    robustManagerPromise = import('../roulette/robust-manager.js')
      .then((module) => {
        robustManagerModule = module;
        return module;
      })
      .catch((error) => {
        robustManagerError = error;
        logger.error('Failed to load roulette manager module', { err: error });
        return null;
      });
  }

  return robustManagerPromise;
}

function buildUnavailableMessage() {
  const reasons = [];
  if (!dependencyStatus.canvasAvailable) {
    reasons.push('native canvas bindings');
  }
  if (!dependencyStatus.sharpAvailable) {
    reasons.push('sharp encoder');
  }

  if (reasons.length) {
    const suffix = reasons.length > 1 ? 'modules are' : 'module is';
    return `🎰 Roulette animations are disabled because the ${reasons.join(' and ')} ${suffix} missing. Install the optional native dependencies to enable this feature.`;
  }

  if (robustManagerError) {
    return `🎰 Roulette system failed to load: ${robustManagerError.message}`;
  }

  return '🎰 Roulette system is currently unavailable. Please try again later.';
}

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

  if (subcommand === 'rules') {
    return handleRules(interaction);
  }

  if (subcommand === 'debug') {
    return handleDebugSubcommand(interaction);
  }

  if (subcommand === 'play') {
    return handlePlay(interaction);
  }
}

async function handlePlay(interaction) {
  const manager = await loadRobustManager();

  if (!manager?.startRoulette) {
    const content = buildUnavailableMessage();
    await safeReply(interaction, { content, flags: MessageFlags.Ephemeral });
    return;
  }

  try {
    await manager.startRoulette(interaction);
  } catch (error) {
    logger.error('Error executing /roulette play', { err: error });
    await safeReply(interaction, {
      content: '❌ Failed to start roulette. Please try again soon.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleRules(interaction) {
  const manager = await loadRobustManager();

  if (manager?.showRouletteRules) {
    return manager.showRouletteRules(interaction);
  }

  const content = buildUnavailableMessage();
  await safeReply(interaction, { content, flags: MessageFlags.Ephemeral });
}

async function handleDebugSubcommand(interaction) {
  try {
    const winningNumber = interaction.options.getNumber('winning_number');
    const wheelRpm0 = interaction.options.getNumber('wheel_rpm') || 30;
    const ballRpm0 = interaction.options.getNumber('ball_rpm') || 180;
    const laps = interaction.options.getNumber('laps') || 15;

    const spinPlan = computeSpinPlan(
      winningNumber,
      'european',
      16,
      8.5,
      wheelRpm0,
      ballRpm0,
      0.8,
      0.6,
      laps
    );

    const omega0 = ballRpm0 * 2 * Math.PI / 60;
    const k = 0.6;
    const dropFrame = spinPlan.dropFrame;
    const totalFrames = spinPlan.totalFrames;

    const embed = createPlaceholderEmbed({
      title: 'Roulette Physics Debug',
      description: 'Computed spin plan parameters',
      fields: [
        { name: 'Winning Number', value: `${winningNumber}`, inline: true },
        { name: 'Wheel RPM₀', value: `${wheelRpm0}`, inline: true },
        { name: 'Ball RPM₀', value: `${ballRpm0}`, inline: true },
        { name: 'Omega₀', value: `${omega0.toFixed(2)} rad/s`, inline: true },
        { name: 'k', value: `${k}`, inline: true },
        { name: 'Drop Frame', value: `${dropFrame}`, inline: true },
        { name: 'Total Frames', value: `${totalFrames}`, inline: true },
      ],
    });

    await safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (error) {
    logger.error('Error handling roulette debug command', { err: error });
    await safeReply(interaction, {
      content: '❌ Failed to compute roulette physics.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

export async function handleRouletteButton(interaction) {
  const manager = await loadRobustManager();

  if (!manager?.handleRouletteButton) {
    const content = buildUnavailableMessage();
    await safeReply(interaction, { content, flags: MessageFlags.Ephemeral });
    return;
  }

  return manager.handleRouletteButton(interaction);
}
