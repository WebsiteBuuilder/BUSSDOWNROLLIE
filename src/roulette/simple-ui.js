import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { formatVP } from '../lib/utils.js';

/**
 * Simple, reliable roulette UI using VP currency
 */

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

export function getNumberColor(num) {
  if (num === 0) return 'green';
  return RED_NUMBERS.includes(num) ? 'red' : 'black';
}

/**
 * Create roulette prompt embed (betting screen)
 */
export function createRoulettePromptEmbed(displayName, totalBet, bets = {}, currentBalance = null) {
  const embed = new EmbedBuilder()
    .setColor(0x27ae60) // GUHD EATS green
    .setTitle('🎰 **GUHD EATS Roulette**')
    .setDescription('🎡 *European Roulette - Place your bets!*\n✨ **"STILL GUUHHHD!"** ✨')
    .addFields(
      {
        name: '👤 **Player**',
        value: `${displayName}`,
        inline: true
      },
      {
        name: '💰 **Current Balance**',
        value: currentBalance !== null ? `${formatVP(currentBalance)} VP` : 'Loading...',
        inline: true
      },
      {
        name: '🎯 **Total Bet**',
        value: `${formatVP(totalBet)} VP`,
        inline: true
      },
      {
        name: '🎲 **Your Bets**',
        value: formatBetsDisplay(bets),
        inline: false
      }
    )
    .setFooter({ 
      text: '🎰 Place your bets and spin the wheel! • GUHD EATS Casino',
      iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
    })
    .setTimestamp();

  return embed;
}

/**
 * Format bets for display
 */
function formatBetsDisplay(bets) {
  if (Object.keys(bets).length === 0) {
    return 'No bets placed yet. Use the buttons below to place your bets!';
  }

  const lines = [];
  for (const [betType, betAmount] of Object.entries(bets)) {
    const displayName = formatBetName(betType);
    lines.push(`• ${displayName}: **${formatVP(betAmount)} VP**`);
  }
  
  return lines.join('\n');
}

/**
 * Format bet type name for display
 */
function formatBetName(betType) {
  const names = {
    'red': '🔴 RED',
    'black': '⚫ BLACK',
    'green': '🟢 GREEN',
    'even': 'EVEN',
    'odd': 'ODD',
    '1-18': '1-18',
    '19-36': '19-36',
    '1st-12': '1ST 12',
    '2nd-12': '2ND 12',
    '3rd-12': '3RD 12'
  };
  
  return names[betType] || betType.toUpperCase().replace(/_/g, ' ');
}

/**
 * Create cinematic spin embed for GUHD EATS roulette
 */
export function createCinematicSpinEmbed(displayName, totalBet) {
  return new EmbedBuilder()
    .setColor(0x00FF75) // GUHD EATS neon green
    .setTitle('🎰 **STILL GUUHHHD ROULETTE**')
    .setDescription('✨ *The wheel is spinning with cinematic realism...* ✨\n\n🎡 **3D Perspective Animation** • 💫 **Motion Blur** • 🌟 **Lighting Effects**')
    .addFields(
      {
        name: '👤 Player',
        value: displayName,
        inline: true
      },
      {
        name: '💰 Total Bet',
        value: `${formatVP(totalBet)} VP`,
        inline: true
      },
      {
        name: '🎬 Animation',
        value: 'Watch the wheel spin below!',
        inline: false
      }
    )
    .setFooter({ text: 'Powered by GUHD EATS • STILL GUUHHHD 🎰' })
    .setTimestamp()
    .setImage('attachment://roulette-spin.gif');
}

/**
 * Create spin animation embed (supports image or text frame)
 */
export function createSpinEmbed(displayName, frame, caption, totalBet, imageUrl = null) {
  const embed = new EmbedBuilder()
    .setColor(0xfaa61a)
    .setTitle('🎰 **GUHD EATS Roulette**')
    .setDescription('🎡 *European Roulette - Spinning...*\n✨ **"STILL GUUHHHD!"** ✨');

  // Add wheel image if provided
  if (imageUrl) {
    embed.setImage(imageUrl);
  }

  embed.addFields(
    {
      name: '🎡 **Wheel Status**',
      value: imageUrl ? caption : `${frame}\n\n${caption}`,
      inline: false
    },
    {
      name: '💰 **Total Bet**',
      value: `${formatVP(totalBet)} VP`,
      inline: true
    },
    {
      name: '👤 **Player**',
      value: `${displayName}`,
      inline: true
    }
  );

  embed.setFooter({ 
    text: '🎰 The wheel is spinning... • GUHD EATS Casino',
    iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
  });
  
  embed.setTimestamp();

  return embed;
}

/**
 * Create result embed with enhanced balance and winnings display
 */
export function createResultEmbed({
  displayName,
  winningNumber,
  winningColor,
  frame,
  didWin,
  net,
  bets,
  houseEdge,
  totalWon = 0,
  totalBet = 0,
  newBalance = null,
  imageUrl = null
}) {
  // Gold color for winners, red for losers
  const color = didWin ? 0xffd700 : 0xf04747;
  const title = didWin ? '🎉 **🏆 WINNER! 🏆**' : '😔 **Better Luck Next Time**';
  
  const colorEmoji = winningColor === 'red' ? '🔴' : winningColor === 'black' ? '⚫' : '🟢';
  
  // Gold glow effect for winning number
  const winningDisplay = didWin 
    ? `✨ **✨ ${winningNumber} ✨** ✨` 
    : `**${winningNumber}**`;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(
      didWin 
        ? '✨ **🎊 CONGRATULATIONS! 🎊** ✨\n💰 **"STILL GUUHHHD!"** 🎁' 
        : '💔 **The house wins this round!**\n🔮 Try again for better luck!'
    );

  // Add wheel image if provided
  if (imageUrl) {
    embed.setImage(imageUrl);
  }

  embed.addFields(
    {
      name: '🎡 **Wheel Result**',
      value: imageUrl 
        ? `🎯 **Winning Number:** ${winningDisplay}\n**Color:** ${colorEmoji} **${winningColor.toUpperCase()}**`
        : `${frame}\n\n🎯 **Winning Number:** ${winningDisplay}\n**Color:** ${colorEmoji} **${winningColor.toUpperCase()}**`,
      inline: false
    },
    {
      name: '💰 **Financial Summary**',
      value: 
        `**Total Bet:** ${formatVP(totalBet)} VP\n` +
        `**Total Won:** ${formatVP(totalWon)} VP\n` +
        `**Net ${didWin ? 'Profit' : 'Loss'}:** ${didWin ? '+' : ''}${formatVP(net)} VP`,
      inline: true
    },
    {
      name: '🏦 **Balance**',
      value: newBalance !== null 
        ? `**New Balance:** ${formatVP(newBalance)} VP\n**Status:** ${didWin ? '✅ Winner!' : '❌ Loss'}` 
        : `**Status:** ${didWin ? '✅ Winner!' : '❌ Loss'}`,
      inline: true
    },
    {
      name: '🎯 **Your Bets**',
      value: formatBetsDisplay(bets),
      inline: false
    }
  );

  embed.setFooter({ 
    text: didWin ? '🎰 Round settled • You WON! 🍀 • GUHD EATS Casino' : '🎰 Round settled • Better luck next time! • GUHD EATS Casino',
    iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
  });
  
  embed.setTimestamp();

  return embed;
}

/**
 * Create betting buttons (4 rows max for Discord compatibility)
 */
export function createBettingButtons(commandId, selectedChip = 10) {
  // Row 1: Chip selection (1 VP, 5 VP, 10 VP, 25 VP, 100 VP)
  const chipRow = new ActionRowBuilder();
  chipRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_chip_${commandId}_1`)
      .setLabel('1 VP')
      .setStyle(selectedChip === 1 ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );
  chipRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_chip_${commandId}_5`)
      .setLabel('5 VP')
      .setStyle(selectedChip === 5 ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );
  chipRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_chip_${commandId}_10`)
      .setLabel('10 VP')
      .setStyle(selectedChip === 10 ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );
  chipRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_chip_${commandId}_25`)
      .setLabel('25 VP')
      .setStyle(selectedChip === 25 ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );
  chipRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_chip_${commandId}_100`)
      .setLabel('100 VP')
      .setStyle(selectedChip === 100 ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  // Row 2: Color betting (Red, Black, Green) + Even/Odd
  const colorRow = new ActionRowBuilder();
  colorRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_bet_${commandId}_red`)
      .setLabel('🔴 RED')
      .setStyle(ButtonStyle.Danger)
  );
  colorRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_bet_${commandId}_black`)
      .setLabel('⚫ BLACK')
      .setStyle(ButtonStyle.Secondary)
  );
  colorRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_bet_${commandId}_green`)
      .setLabel('🟢 GREEN')
      .setStyle(ButtonStyle.Success)
  );
  colorRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_bet_${commandId}_even`)
      .setLabel('EVEN')
      .setStyle(ButtonStyle.Primary)
  );
  colorRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_bet_${commandId}_odd`)
      .setLabel('ODD')
      .setStyle(ButtonStyle.Primary)
  );

  // Row 3: Outside bets (1-18, 19-36, 1st/2nd/3rd 12)
  const outsideRow = new ActionRowBuilder();
  outsideRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_bet_${commandId}_1-18`)
      .setLabel('1-18')
      .setStyle(ButtonStyle.Primary)
  );
  outsideRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_bet_${commandId}_19-36`)
      .setLabel('19-36')
      .setStyle(ButtonStyle.Primary)
  );
  outsideRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_bet_${commandId}_1st-12`)
      .setLabel('1ST 12')
      .setStyle(ButtonStyle.Primary)
  );
  outsideRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_bet_${commandId}_2nd-12`)
      .setLabel('2ND 12')
      .setStyle(ButtonStyle.Primary)
  );
  outsideRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_bet_${commandId}_3rd-12`)
      .setLabel('3RD 12')
      .setStyle(ButtonStyle.Primary)
  );

  // Row 4: Action buttons (Spin, Clear)
  const actionRow = new ActionRowBuilder();
  actionRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_spin_${commandId}`)
      .setLabel('🎡 SPIN')
      .setStyle(ButtonStyle.Success)
  );
  actionRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_clear_${commandId}`)
      .setLabel('🗑️ CLEAR')
      .setStyle(ButtonStyle.Danger)
  );

  return [chipRow, colorRow, outsideRow, actionRow];
}

/**
 * Create rules embed
 */
export function createRouletteRulesEmbed() {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎰 **GUHD EATS Roulette Rules**')
    .setDescription('🎡 *European Roulette Table*')
    .addFields(
      {
        name: '💰 **Betting with VP**',
        value: 'Select your chip value (1, 5, 10, 25, or 100 VP)\n• Click bet type to place bet\n• Place multiple bets before spinning\n• Minimum bet: 1 VP',
        inline: false
      },
      {
        name: '🎯 **Betting Options**',
        value: '**Colors:** Red/Black (2:1 payout)\n**Green:** 0 only (35:1 payout)\n**Even/Odd:** 2:1 payout\n**Ranges:** 1-18/19-36 (2:1 payout)\n**Dozens:** 1st/2nd/3rd 12 (2:1 payout)',
        inline: false
      },
      {
        name: '🎡 **How to Play**',
        value: '1. Select your chip value (1-100 VP)\n2. Click betting options to place bets\n3. Click SPIN to spin the wheel\n4. Win based on the result!',
        inline: false
      },
      {
        name: '📊 **Payouts**',
        value: '**Red/Black:** 2:1 (bet 10 VP, win 20 VP)\n**Even/Odd:** 2:1\n**1-18/19-36:** 2:1\n**Dozens:** 2:1\n**Green:** 35:1',
        inline: false
      }
    )
    .setFooter({ text: '🎰 Good luck at the tables! • GUHD EATS Casino' })
    .setTimestamp();

  return embed;
}

/**
 * Create "Play Again" button for result screen
 * @param {string} userId - User's Discord ID
 * @returns {Array<ActionRowBuilder>} Button row
 */
export function createPlayAgainButton(userId) {
  const row = new ActionRowBuilder();
  
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_playagain_${userId}`)
      .setLabel('🎰 Play Again')
      .setStyle(ButtonStyle.Success)
  );
  
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_backtolobby_${userId}`)
      .setLabel('🏠 Back to Lobby')
      .setStyle(ButtonStyle.Primary)
  );

  return [row];
}
