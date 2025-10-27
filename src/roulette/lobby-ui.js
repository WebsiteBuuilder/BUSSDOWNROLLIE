import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { formatVP } from '../lib/utils.js';
import { houseEdgeConfig } from '../config/casino.js';

/**
 * Roulette Lobby UI System
 * GUHD EATS themed lobby with player stats and table selection
 */

/**
 * Create the main lobby embed
 * @param {Object} user - User database object with VP balance
 * @param {string} displayName - User's display name
 * @param {Object} stats - Optional player stats (wins, losses, etc.)
 * @returns {EmbedBuilder} Lobby embed
 */
export function createLobbyEmbed(user, displayName, stats = null) {
  const embed = new EmbedBuilder()
    .setColor(0x27ae60) // GUHD EATS green
    .setTitle('🎰 **GUHD EATS CASINO** 🎰')
    .setDescription(
      '**🎡 European Roulette Lounge**\n\n' +
      '✨ *"STILL GUUHHHD"* ✨\n\n' +
      'Welcome to the premium roulette experience!\n' +
      'Place your bets and spin the wheel of fortune.'
    )
    .addFields(
      {
        name: '👤 **Player**',
        value: displayName,
        inline: true
      },
      {
        name: '💰 **Balance**',
        value: `${formatVP(user.vp)} VP`,
        inline: true
      },
      {
        name: '🎯 **Status**',
        value: user.vp >= 1 ? '✅ Ready to Play' : '❌ Insufficient VP',
        inline: true
      }
    );

  // Add stats if available
  if (stats) {
    const winRate = stats.totalGames > 0 
      ? ((stats.wins / stats.totalGames) * 100).toFixed(1) 
      : '0.0';
    
    embed.addFields({
      name: '📊 **Your Stats**',
      value: 
        `**Games Played:** ${stats.totalGames}\n` +
        `**Wins:** ${stats.wins} 🏆\n` +
        `**Losses:** ${stats.losses}\n` +
        `**Win Rate:** ${winRate}%`,
      inline: false
    });
  }

  // Add house info
  const houseEdge = (houseEdgeConfig.roulette.baseEdge * 100).toFixed(2);
  embed.addFields(
    {
      name: '🏛️ **House Edge**',
      value: `${houseEdge}% (European Rules)`,
      inline: true
    },
    {
      name: '🎲 **Table Limits**',
      value: `**Min:** 1 VP\n**Max:** Unlimited`,
      inline: true
    },
    {
      name: '💎 **Payouts**',
      value: 
        '🔴/⚫ Red/Black: **2:1**\n' +
        '🟢 Green (0): **35:1**\n' +
        'Even/Odd, Ranges: **2:1**',
      inline: false
    }
  );

  embed.setFooter({ 
    text: '🎰 GUHD EATS Casino • Premium Gaming Experience',
    iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
  });
  
  embed.setTimestamp();
  embed.setThumbnail('https://cdn.discordapp.com/emojis/1234567890123456789.png');

  return embed;
}

/**
 * Create lobby action buttons
 * @param {string} commandId - Unique command ID for button namespacing
 * @param {boolean} canPlay - Whether user has sufficient balance
 * @returns {Array<ActionRowBuilder>} Button rows
 */
export function createLobbyButtons(commandId, canPlay = true) {
  const row = new ActionRowBuilder();

  // Join Table button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_join_${commandId}`)
      .setLabel('🎰 Join Table')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!canPlay)
  );

  // View Rules button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_viewrules_${commandId}`)
      .setLabel('📖 View Rules')
      .setStyle(ButtonStyle.Primary)
  );

  // Refresh Balance button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_refresh_${commandId}`)
      .setLabel('🔄 Refresh Balance')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row];
}

/**
 * Create rules embed (detailed version for lobby)
 * @returns {EmbedBuilder} Rules embed
 */
export function createDetailedRulesEmbed() {
  const embed = new EmbedBuilder()
    .setColor(0xffd700) // Gold
    .setTitle('📖 **Roulette Rules & Betting Guide**')
    .setDescription('🎡 **European Roulette (Single Zero)**\n\nLearn how to play and maximize your winnings!')
    .addFields(
      {
        name: '🎮 **How to Play**',
        value: 
          '1️⃣ Select your chip value (1, 5, 10, 25, or 100 VP)\n' +
          '2️⃣ Place bets on colors, numbers, or ranges\n' +
          '3️⃣ You can place multiple bets before spinning\n' +
          '4️⃣ Click **SPIN** to spin the wheel\n' +
          '5️⃣ Watch the cinematic wheel animation\n' +
          '6️⃣ Collect your winnings if you predicted correctly!',
        inline: false
      },
      {
        name: '🎯 **Betting Options**',
        value: 
          '**🔴 RED / ⚫ BLACK** - Bet on color\n' +
          '**🟢 GREEN** - Bet on zero (highest payout!)\n' +
          '**EVEN / ODD** - Bet on parity\n' +
          '**1-18 / 19-36** - Bet on ranges\n' +
          '**1ST/2ND/3RD 12** - Bet on dozens',
        inline: false
      },
      {
        name: '💰 **Payouts**',
        value: 
          '**Red/Black:** 2:1 (bet 10 VP → win 20 VP)\n' +
          '**Even/Odd:** 2:1\n' +
          '**1-18/19-36:** 2:1\n' +
          '**Dozens (1-12, 13-24, 25-36):** 2:1\n' +
          '**🟢 Green (0 only):** 35:1 (bet 10 VP → win 350 VP!)',
        inline: false
      },
      {
        name: '🎲 **European vs American**',
        value: 
          'European roulette has **only one zero (0)**, giving you better odds!\n' +
          'American roulette has 0 and 00, increasing house edge.\n' +
          '**Our tables use European rules for fairness.**',
        inline: false
      },
      {
        name: '💡 **Pro Tips**',
        value: 
          '• Start with small bets to learn the game\n' +
          '• Red/Black bets give you ~48% chance to win\n' +
          '• Green (0) is risky but pays 35:1\n' +
          '• You can combine multiple bets for strategy\n' +
          '• Set a budget and stick to it!',
        inline: false
      },
      {
        name: '⚖️ **Fair Play**',
        value: 
          'All spins use cryptographically secure randomness.\n' +
          'House edge: 2.70% (standard for European roulette)\n' +
          'VIP players get reduced house edge based on streak!',
        inline: false
      }
    )
    .setFooter({ text: '🎰 GUHD EATS Casino • Play Responsibly' })
    .setTimestamp();

  return embed;
}

/**
 * Create a welcome message for first-time players
 * @param {string} displayName - User's display name
 * @returns {EmbedBuilder} Welcome embed
 */
export function createWelcomeEmbed(displayName) {
  const embed = new EmbedBuilder()
    .setColor(0xffd700) // Gold
    .setTitle('🎉 **Welcome to GUHD EATS Casino!** 🎉')
    .setDescription(
      `Hey **${displayName}**! 👋\n\n` +
      '✨ **"STILL GUUHHHD"** ✨\n\n' +
      'You\'re about to experience the most premium roulette game on Discord!\n\n' +
      '**🎁 First-Time Bonus:**\n' +
      'Use `/daily` to claim your daily VP and start playing!\n\n' +
      '**🎮 Ready to Play?**\n' +
      'Click **Join Table** to place your first bet.'
    )
    .setFooter({ text: '🎰 Good luck at the tables!' })
    .setTimestamp();

  return embed;
}

/**
 * Create insufficient balance warning embed
 * @param {number} currentVP - User's current VP
 * @returns {EmbedBuilder} Warning embed
 */
export function createInsufficientBalanceEmbed(currentVP) {
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c) // Red
    .setTitle('💰 **Insufficient Balance**')
    .setDescription(
      `You need at least **1 VP** to play roulette.\n\n` +
      `**Current Balance:** ${formatVP(currentVP)} VP\n\n` +
      '**💡 How to Get VP:**\n' +
      '• Use `/daily` to claim daily VP\n' +
      '• Participate in community events\n' +
      '• Win battles and other games\n' +
      '• Provide services as a provider'
    )
    .setFooter({ text: '🎰 Come back when you have VP to play!' })
    .setTimestamp();

  return embed;
}

