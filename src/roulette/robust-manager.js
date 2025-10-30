import { MessageFlags } from 'discord.js';
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { getOrCreateUser, removeVP, addVP } from '../db/index.js';
import { 
  createRoulettePromptEmbed, 
  createSpinEmbed,
  createCinematicSpinEmbed,
  createLoadingSpinEmbed,
  createResultEmbed, 
  createBettingButtons,
  createRouletteRulesEmbed,
  getNumberColor
} from './simple-ui.js';
import { createDetailedRulesEmbed } from './lobby-ui.js';
import { AttachmentBuilder } from 'discord.js';
import { safeReply, ackWithin3s } from '../utils/interaction.js';
import { getRoulettePocket, recordRouletteOutcome } from '../lib/house-edge.js';
import { houseEdgeConfig } from '../config/casino.js';
import { formatVP } from '../lib/utils.js';

// Hybrid system imports
import { computeSpinPlan } from './physics.js';
import { createPlaceholderEmbed, createResultEmbed as createHybridResultEmbed } from './render.js';
import { initializeSpriteCache, preloadEssentialSprites } from './sprites.js';
import { 
  pocketToAngle, 
  angleToPocket, 
  isRed, 
  isBlack, 
  isGreen,
  getTotalPockets 
} from './mapping.js';

// Legacy animation for fallback only
import { 
  generateCinematicSpin, 
  validateCinematicAnimation,
  getAnimationStatus 
} from './safe-animation.js';
import {
  generateStaticRouletteImage,
  getEmergencyFallbackMessage
} from './safe-canvas-utils.js';

/**
 * Hybrid Roulette Manager - Fully Integrated System
 * 
 * This module provides a fully integrated hybrid roulette system that combines:
 * 1. **Physics Engine** - Realistic wheel and ball physics calculations
 * 2. **Mapping System** - European/American roulette pocket mapping
 * 3. **Sprite Cache** - Efficient asset management and caching
 * 4. **Render Worker** - Off-thread WebP animation generation
 * 5. **Legacy Fallback** - GIF-based animation for compatibility
 * 6. **Static Fallback** - Emergency image fallback
 * 
 * Features:
 * - Instant placeholder responses
 * - Worker-based rendering (non-blocking)
 * - WebP animations with size optimization
 * - Automatic fallback chain (Hybrid → Legacy → Static)
 * - 100% Discord command compatibility
 * - Vouch Points integration with house edge
 * - Rate-limited Discord interactions
 * 
 * @author GUHH EATS Development Team
 * @version 2.0.0 - Hybrid System Integration
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ACTIVE_ROULETTE = new Map();

// Rate limiter for Discord edits (max 4 per second)
const EDIT_RATE_LIMITER = {
  lastEdit: 0,
  minInterval: 250, // 4 edits per second
  
  async canEdit() {
    const now = Date.now();
    const timeSinceLastEdit = now - this.lastEdit;
    
    if (timeSinceLastEdit >= this.minInterval) {
      this.lastEdit = now;
      return true;
    }
    
    const waitTime = this.minInterval - timeSinceLastEdit;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    this.lastEdit = Date.now();
    return true;
  },
  
  async editWithRateLimit(message, options) {
    await this.canEdit();
    return await message.edit(options);
  }
};

const PAYOUTS = {
  'red': 2,
  'black': 2,
  'green': 35,
  'even': 2,
  'odd': 2,
  '1-18': 2,
  '19-36': 2,
  '1st-12': 2,
  '2nd-12': 2,
  '3rd-12': 2
};

// Sprite cache initialization state
let spriteCacheInitialized = false;

function formatDisplayName(interaction) {
  return interaction.member?.displayName ?? interaction.user.username;
}

/**
 * Ensure sprite cache is initialized for hybrid system
 */
async function ensureSpriteCacheInitialized() {
  if (!spriteCacheInitialized) {
    try {
      console.log('🎨 Initializing sprite cache for hybrid system...');
      await initializeSpriteCache();
      await preloadEssentialSprites();
      spriteCacheInitialized = true;
      console.log('✅ Sprite cache initialized successfully');
    } catch (error) {
      console.warn('⚠️ Sprite cache initialization failed, continuing without cache:', error.message);
      // Don't throw - continue without sprite cache
      spriteCacheInitialized = true; // Mark as initialized to avoid retry
    }
  }
}

/**
 * Start roulette game directly (entry point for /roulette play)
 */
export async function startRoulette(interaction) {
  try {
    const userId = interaction.user.id;
    const user = await getOrCreateUser(userId);

    if (user.blacklisted) {
      await safeReply(interaction, {
        content: '🚫 You are not allowed to play roulette.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (user.vp < 1) {
      await safeReply(interaction, {
        content: `❌ You need at least 1 VP to play roulette, but you only have ${formatVP(user.vp)}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const displayName = formatDisplayName(interaction);
    const commandId = interaction.id;

    console.log(`🎰 Starting roulette for user ${userId}`);

    // Initialize hybrid system components
    await ensureSpriteCacheInitialized();

    await interaction.deferReply();

    const message = await interaction.editReply({
      embeds: [createRoulettePromptEmbed(displayName, 0, {}, user.vp)],
      components: createBettingButtons(commandId),
    });

    ACTIVE_ROULETTE.set(commandId, {
      userId,
      messageId: message.id,
      channelId: message.channelId,
      displayName,
      vipScore: user.streakDays ?? 0,
      bets: {},
      selectedChip: 10,
      totalBet: 0
    });

    console.log(`✅ Roulette game started for ${displayName}`);
  } catch (error) {
    console.error('❌ Error starting roulette:', error);
    await safeReply(interaction, {
      content: '❌ Failed to start roulette. Please try again soon.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Handle all roulette button interactions
 */
export async function handleRouletteButton(interaction) {
  const customId = interaction.customId ?? '';
  console.log(`🎰 Button interaction: ${customId}`);

  if (!customId.startsWith('roulette_')) {
    return false;
  }

  const finishAckTimer = ackWithin3s(interaction, {
    game: 'roulette',
    customId,
    userId: interaction.user?.id,
  });

  try {
    const [, action, commandIdOrUserId, ...rawParams] = customId.split('_');
    const params = rawParams.filter(Boolean);
    const commandId = commandIdOrUserId;
    const state = ACTIVE_ROULETTE.get(commandId);

    if (!state) {
      console.log(`⚠️ No active roulette game found for commandId: ${commandId}`);
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ flags: MessageFlags.Ephemeral, content: '⏱️ This roulette game is no longer active.' });
      } else {
        await interaction.followUp({ flags: MessageFlags.Ephemeral, content: '⏱️ This roulette game is no longer active.' });
      }
      return true;
    }

    if (interaction.user.id !== state.userId) {
      console.log(`⚠️ Unauthorized interaction attempt by ${interaction.user.id} on game owned by ${state.userId}`);
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ flags: MessageFlags.Ephemeral, content: '🙅 Only the original player can interact with this game.' });
      } else {
        await interaction.followUp({ flags: MessageFlags.Ephemeral, content: '🙅 Only the original player can interact with this game.' });
      }
      return true;
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }

    console.log(`✅ Processing ${action} action for user ${interaction.user.username}`);

    switch (action) {
      case 'chip': {
        const chipValue = parseInt(params[0], 10);
        if (!Number.isNaN(chipValue)) {
          state.selectedChip = chipValue;
        }
        await updateBettingUI(interaction, state, commandId);
        console.log(`✅ Updated chip selection to ${state.selectedChip} VP`);
        break;
      }

      case 'bet': {
        const betType = params.join('_');
        await placeBet(interaction, state, betType, commandId);
        break;
      }

      case 'spin': {
        await spinWheel(interaction, state, commandId);
        break;
      }

      case 'clear': {
        if (state.totalBet > 0) {
          await addVP(state.userId, state.totalBet);
        }
        state.bets = {};
        state.totalBet = 0;
        await updateBettingUI(interaction, state, commandId);
        console.log(`✅ Cleared all bets for ${interaction.user.username}`);
        break;
      }

      default: {
        console.log(`⚠️ Unknown action: ${action}`);
        await interaction.followUp({ flags: MessageFlags.Ephemeral, content: '❌ Unknown action.' });
      }
    }
  } catch (error) {
    console.error('❌ Roulette button error:', error);

    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ flags: MessageFlags.Ephemeral, content: '❌ An error occurred. Please try again.' });
      } else {
        await interaction.followUp({ flags: MessageFlags.Ephemeral, content: '❌ An error occurred. Please try again.' });
      }
    } catch (followUpError) {
      console.error('❌ Failed to send error message:', followUpError);
    }
  } finally {
    finishAckTimer();
  }

  return true;
}

async function placeBet(interaction, state, betType, commandId) {
  try {
    const user = await getOrCreateUser(state.userId);
    
    if (user.vp < state.selectedChip) {
      console.log(`⚠️ Insufficient VP: user has ${user.vp}, needs ${state.selectedChip}`);
      await interaction.followUp({
        flags: MessageFlags.Ephemeral,
        content: `❌ You need ${formatVP(state.selectedChip)} VP to place this bet, but you only have ${formatVP(user.vp)}.`
      });
      return;
    }

    // Add bet to state
    if (!state.bets[betType]) {
      state.bets[betType] = 0;
    }
    state.bets[betType] += state.selectedChip;
    state.totalBet += state.selectedChip;

    console.log(`💰 Bet placed: ${betType} for ${state.selectedChip} VP (Total: ${state.totalBet} VP)`);

    // Deduct VP from user immediately
    await removeVP(state.userId, state.selectedChip);

    // Fetch updated balance
    const updatedUser = await getOrCreateUser(state.userId);
    await updateBettingUI(interaction, state, commandId, updatedUser.vp);
  } catch (error) {
    console.error('❌ Error placing bet:', error);
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: '❌ Failed to place bet. Please try again.' });
  }
}

async function spinWheel(interaction, state, commandId) {
  if (state.totalBet === 0) {
    console.log('⚠️ Attempted to spin with no bets placed');
    await interaction.followUp({
      flags: MessageFlags.Ephemeral,
      content: '❌ You must place at least one bet before spinning!'
    });
    return;
  }

  console.log(`🎡 Spinning wheel for ${state.displayName} with bets totaling ${state.totalBet} VP`);

  // Remove the game from active games
  ACTIVE_ROULETTE.delete(commandId);

  // Determine winning number
  const primaryBetType = Object.keys(state.bets)[0];
  let betDescriptor = {};
  
  if (['red', 'black', 'green'].includes(primaryBetType)) {
    betDescriptor = { color: primaryBetType };
  }

  const pocket = getRoulettePocket({
    userId: state.userId,
    betAmount: state.totalBet,
    betDescriptor: betDescriptor,
    userProfile: { vipPoints: state.vipScore ?? 0 },
  });

  console.log(`🎯 Winning number: ${pocket.number} (${pocket.color})`);

  // Try hybrid system first, fallback to legacy if needed
  let animationSuccess = false;
  let animationMetadata = null;
  
  try {
    const result = await runHybridSpinAnimation(interaction, state, pocket);
    animationSuccess = true;
    animationMetadata = result.metadata;
  } catch (hybridError) {
    console.error('❌ Hybrid animation failed - attempting LEGACY FALLBACK');
    console.error(`   Error: ${hybridError.message}`);
    
    animationSuccess = await runLegacySpinAnimation(interaction, state, pocket);
  }

  // Calculate winnings
  let totalWinnings = 0;
  let didWin = false;

  for (const [betType, betAmount] of Object.entries(state.bets)) {
    const won = checkBetWin(betType, pocket.number, pocket.color);
    if (won) {
      const multiplier = PAYOUTS[betType] || 2;
      totalWinnings += betAmount * multiplier;
      didWin = true;
      console.log(`✅ Bet ${betType} won! Payout: ${betAmount} × ${multiplier} = ${betAmount * multiplier} VP`);
    }
  }

  const net = totalWinnings - state.totalBet;
  console.log(`💰 Final payout: ${didWin ? '+' : ''}${net} VP (Total winnings: ${totalWinnings} VP)`);

  if (totalWinnings > 0) {
    await addVP(state.userId, totalWinnings);
  }

  recordRouletteOutcome(state.userId, didWin);

  // Fetch updated balance
  const updatedUser = await getOrCreateUser(state.userId);

  // Show final result with rate limiting
  const resultEmbed = createHybridResultEmbed({
    displayName: state.displayName,
    winningNumber: pocket.number,
    winningColor: pocket.color,
    didWin,
    net,
    totalBet: state.totalBet,
    totalWon: totalWinnings,
    newBalance: updatedUser.vp
  }, animationMetadata);

  await EDIT_RATE_LIMITER.editWithRateLimit(
    await interaction.fetchReply(),
    { 
      embeds: [resultEmbed], 
      components: [],
      files: []
    }
  );

  console.log(`✅ Roulette game completed for ${state.displayName}`);
}

/**
 * Run hybrid spin animation with worker-based rendering
 * Uses new physics, mapping, sprites, and render systems
 */
async function runHybridSpinAnimation(interaction, state, pocket) {
  console.log(`🎬 Starting hybrid animation for ${pocket.number} (${pocket.color})`);
  
  // Create and show instant placeholder embed
  const placeholderEmbed = createPlaceholderEmbed(state.displayName, state.totalBet);
  const spinMessage = await interaction.editReply({
    embeds: [placeholderEmbed],
    components: [],
    files: []
  });

  // Initialize worker for rendering
  const renderWorker = new Worker(
    path.join(__dirname, 'render-worker.js'),
    { type: 'module' }
  );

  // Wait for worker ready
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Worker initialization timeout')), 5000);
    
    renderWorker.on('message', (message) => {
      if (message.type === 'ready') {
        clearTimeout(timeout);
        resolve();
      }
    });
    
    renderWorker.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  try {
    // Compute physics in main thread for immediate response
    const spinPlan = computeSpinPlan(
      pocket.number,
      'european',
      16, // fps
      8500, // duration
      30, // wheelRpm0
      180, // ballRpm0
      0.8, // kWheel
      0.6, // kBall
      15 // laps
    );

    console.log(`⚙️ Physics computed: ω₀=${(spinPlan.omega0 || 180 * 2 * Math.PI / 60).toFixed(2)}, k=${(spinPlan.k || 0.6)}`);

    // Update placeholder with loading state
    await EDIT_RATE_LIMITER.editWithRateLimit(spinMessage, {
      embeds: [createLoadingSpinEmbed(state.displayName, state.totalBet)],
      components: [],
      files: []
    });

    // Request rendering from worker
    const renderRequestId = Date.now().toString();
    
    const renderPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        renderWorker.terminate();
        reject(new Error('Render timeout (10s exceeded)'));
      }, 10000);
      
      renderWorker.on('message', (message) => {
        if (message.id === renderRequestId && message.type === 'render-result') {
          clearTimeout(timeout);
          if (message.success) {
            resolve(message);
          } else {
            reject(new Error(message.error || 'Unknown render error'));
          }
        }
      });
    });

    renderWorker.postMessage({
      type: 'render-animation',
      id: renderRequestId,
      spinPlan,
      options: {
        duration: 8500,
        fps: 16,
        quality: 8,
        width: 800,
        height: 600
      }
    });

    // Wait for render completion with timeout
    let renderResult;
    try {
      renderResult = await renderPromise;
      console.log(`✅ Render completed: ${(renderResult.buffer.length / 1024 / 1024).toFixed(2)}MB`);
    } catch (error) {
      renderWorker.terminate();
      throw error;
    }

    // Create WebP attachment (Discord supports WebP animations)
    const attachment = new AttachmentBuilder(renderResult.buffer, {
      name: 'roulette-spin.webp',
      description: `STILL GUUHHHD Roulette - Number ${pocket.number} (${pocket.color}) - Hybrid System`
    });

    // Show animated WebP with rate limiting
    await EDIT_RATE_LIMITER.editWithRateLimit(spinMessage, {
      embeds: [createCinematicSpinEmbed(state.displayName, state.totalBet)],
      files: [attachment],
      components: []
    });

    // Wait for animation to play
    await new Promise(resolve => setTimeout(resolve, 8500));

    // Clean up worker
    renderWorker.terminate();

    return {
      success: true,
      metadata: {
        format: 'webp',
        frames: renderResult.metadata?.frames || 136,
        sizeMB: (renderResult.buffer.length / 1024 / 1024).toFixed(2),
        omega0: spinPlan.omega0 || 180 * 2 * Math.PI / 60,
        k: spinPlan.k || 0.6,
        duration: 8500
      }
    };
    
  } catch (error) {
    renderWorker.terminate();
    console.error(`❌ Hybrid animation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Fallback to legacy animation system (GIF-based)
 * Only used when hybrid system fails
 */
async function runLegacySpinAnimation(interaction, state, pocket) {
  console.log(`🔄 Attempting legacy animation fallback for ${pocket.number}`);
  
  try {
    const spinMessage = await interaction.editReply({
      embeds: [createLoadingSpinEmbed(state.displayName, state.totalBet)],
      components: [],
      files: []
    });

    // Use existing cinematic animation system (GIF-based)
    const result = await generateCinematicSpin(pocket.number, {
      duration: 8500,
      fps: 16,
      quality: 8,
      debugMode: false
    });

    const gifBuffer = result.buffer;
    const animationMetadata = result.metadata;

    const attachment = new AttachmentBuilder(gifBuffer, {
      name: 'roulette-spin.gif',
      description: `STILL GUUHHHD Roulette - Number ${pocket.number} (${pocket.color}) - Legacy GIF System`
    });

    await EDIT_RATE_LIMITER.editWithRateLimit(spinMessage, {
      embeds: [createCinematicSpinEmbed(state.displayName, state.totalBet)],
      files: [attachment],
      components: []
    });

    await new Promise(resolve => setTimeout(resolve, 8500));

    console.log(`✅ Legacy animation successful`);
    return true;
  } catch (error) {
    console.error('❌ Legacy animation also failed:', error);
    
    // Final fallback: static image
    try {
      const fallbackImage = await generateStaticRouletteImage(pocket.number);
      const attachment = new AttachmentBuilder(fallbackImage, {
        name: 'roulette-static.png',
        description: `STILL GUUHHHD Roulette - Number ${pocket.number} (${pocket.color}) - Static Fallback`
      });
      
      await interaction.editReply({
        embeds: [createCinematicSpinEmbed(state.displayName, state.totalBet)],
        files: [attachment],
        components: []
      });
      
      return true;
    } catch (finalError) {
      console.error('❌ Even static fallback failed:', finalError);
      return false;
    }
  }
}

function checkBetWin(betType, winningNumber, winningColor) {
  switch (betType) {
    case 'red':
      return winningColor === 'red';
    case 'black':
      return winningColor === 'black';
    case 'green':
      return winningColor === 'green';
    case 'even':
      return winningNumber !== 0 && winningNumber % 2 === 0;
    case 'odd':
      return winningNumber % 2 === 1;
    case '1-18':
      return winningNumber >= 1 && winningNumber <= 18;
    case '19-36':
      return winningNumber >= 19 && winningNumber <= 36;
    case '1st-12':
      return winningNumber >= 1 && winningNumber <= 12;
    case '2nd-12':
      return winningNumber >= 13 && winningNumber <= 24;
    case '3rd-12':
      return winningNumber >= 25 && winningNumber <= 36;
    default:
      return false;
  }
}

async function updateBettingUI(interaction, state, commandId, currentBalance = null) {
  try {
    if (currentBalance === null) {
      const user = await getOrCreateUser(state.userId);
      currentBalance = user.vp;
    }

    const embed = createRoulettePromptEmbed(state.displayName, state.totalBet, state.bets, currentBalance);
    const components = createBettingButtons(commandId, state.selectedChip);

    // Use rate-limited edit
    await EDIT_RATE_LIMITER.editWithRateLimit(
      await interaction.fetchReply(),
      {
        embeds: [embed],
        components: components,
      }
    );
  } catch (error) {
    console.error('❌ Error updating betting UI:', error);
    // Attempt to recover
    try {
      await EDIT_RATE_LIMITER.editWithRateLimit(
        await interaction.fetchReply(),
        {
          content: '⚠️ There was an error updating the UI. Please try again.',
          embeds: [],
          components: []
        }
      );
    } catch (recoverError) {
      console.error('❌ Failed to recover from UI error:', recoverError);
    }
  }
}

export async function showRouletteRules(interaction) {
  try {
    const embed = createDetailedRulesEmbed();
    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('❌ Error showing roulette rules:', error);
    await interaction.reply({ content: '❌ Failed to load rules. Please try again.', flags: MessageFlags.Ephemeral });
  }
}

/**
 * Get hybrid system health status
 */
export function getHybridSystemStatus() {
  return {
    spriteCache: spriteCacheInitialized,
    activeWorkers: 0, // Could track this if needed
    system: 'hybrid',
    version: '1.0.0'
  };
}

/**
 * Force reinitialize sprite cache (for debugging)
 */
export async function reinitializeSpriteCache() {
  spriteCacheInitialized = false;
  await ensureSpriteCacheInitialized();
}

/**
 * Get system information for debugging
 */
export function getSystemInfo() {
  return {
    activeGames: ACTIVE_ROULETTE.size,
    spriteCacheInitialized,
    hybridSystemEnabled: true,
    discordInterface: 'compatible',
    animationFormats: ['webp', 'gif', 'png'],
    fallbackLevels: ['hybrid', 'legacy-gif', 'static']
  };
}
