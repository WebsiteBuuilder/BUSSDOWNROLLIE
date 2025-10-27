import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { formatVP } from '../lib/utils.js';

/**
 * Enhanced Discord-style roulette UI components
 * Inspired by modern casino interfaces with Discord theming
 */

// European roulette wheel order (0-36)
const WHEEL_NUMBERS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

/**
 * Get the color of a roulette number
 */
export function getNumberColor(num) {
  if (num === 0) return 'green';
  return RED_NUMBERS.includes(num) ? 'red' : 'black';
}

/**
 * Create a visual representation of a roulette number
 */
export function createNumberDisplay(num, isHighlighted = false) {
  const color = getNumberColor(num);
  const colorEmoji = color === 'red' ? '🔴' : color === 'black' ? '⚫' : '🟢';
  const highlight = isHighlighted ? '**' : '';
  return `${colorEmoji} ${highlight}${num}${highlight}`;
}

/**
 * Create betting grid display
 */
export function createBettingGrid(bets = {}) {
  const lines = [];
  
  // Numbers grid (1-36)
  lines.push('**🎯 Numbers Grid:**');
  for (let row = 0; row < 3; row++) {
    const rowNumbers = [];
    for (let col = 0; col < 12; col++) {
      const num = row * 12 + col + 1;
      const betAmount = bets[`number-${num}`] || 0;
      const display = betAmount > 0 ? `**${num}**` : `${num}`;
      rowNumbers.push(display);
    }
    lines.push(rowNumbers.join(' | '));
  }
  
  // Zero
  const zeroBet = bets['number-0'] || 0;
  lines.push(`**0:** ${zeroBet > 0 ? `**0**` : '0'}`);
  
  // Outside bets
  lines.push('\n**🎲 Outside Bets:**');
  const outsideBets = [
    { key: 'red', name: 'RED', emoji: '🔴' },
    { key: 'black', name: 'BLACK', emoji: '⚫' },
    { key: 'even', name: 'EVEN', emoji: '🔢' },
    { key: 'odd', name: 'ODD', emoji: '🔢' },
    { key: '1-18', name: '1-18', emoji: '📉' },
    { key: '19-36', name: '19-36', emoji: '📈' },
    { key: '1st-12', name: '1ST 12', emoji: '1️⃣' },
    { key: '2nd-12', name: '2ND 12', emoji: '2️⃣' },
    { key: '3rd-12', name: '3RD 12', emoji: '3️⃣' }
  ];
  
  outsideBets.forEach(bet => {
    const betAmount = bets[bet.key] || 0;
    const display = betAmount > 0 ? `**${bet.name}**` : bet.name;
    lines.push(`${bet.emoji} ${display}`);
  });
  
  return lines.join('\n');
}

/**
 * Create enhanced roulette prompt embed
 */
export function createRoulettePromptEmbed(displayName, amount, bets = {}) {
  const totalBet = Object.values(bets).reduce((sum, val) => sum + val, 0);
  const bettingGrid = totalBet > 0 ? createBettingGrid(bets) : 'No bets placed yet';
  
  const embed = new EmbedBuilder()
    .setColor(0x2f3136) // Discord dark gray
    .setTitle('🎰 **GUHD EATS Roulette**')
    .setDescription('🎡 *European Roulette Table*')
    .addFields(
      {
        name: '👤 **Player**',
        value: `${displayName}`,
        inline: true
      },
      {
        name: '💰 **Total Bet**',
        value: `${formatVP(totalBet || amount)}`,
        inline: true
      },
      {
        name: '🎯 **Betting Grid**',
        value: bettingGrid,
        inline: false
      }
    )
    .setFooter({ 
      text: '🎰 Place your bets and spin the wheel! • Good luck!',
      iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
    })
    .setTimestamp();

  return embed;
}

/**
 * Create enhanced spin animation embed
 */
export function createSpinEmbed(displayName, amount, frame, caption, bets = {}) {
  const totalBet = Object.values(bets).reduce((sum, val) => sum + val, 0);
  
  const embed = new EmbedBuilder()
    .setColor(0xfaa61a) // Discord yellow for spinning
    .setTitle('🎰 **GUHD EATS Roulette**')
    .setDescription('🎡 *European Roulette Table*')
    .addFields(
      {
        name: '🎡 **Wheel Animation**',
        value: `${frame}\n\n${caption}`,
        inline: false
      },
      {
        name: '💰 **Total Bet**',
        value: `${formatVP(totalBet || amount)}`,
        inline: true
      },
      {
        name: '👤 **Player**',
        value: `${displayName}`,
        inline: true
      }
    )
    .setFooter({ 
      text: '🎰 The wheel is spinning... • Good luck!',
      iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
    })
    .setTimestamp();

  return embed;
}

/**
 * Create enhanced result embed
 */
export function createResultEmbed({
  displayName,
  amount,
  winningNumber,
  winningColor,
  frame,
  didWin,
  net,
  chosenColor,
  bets = {},
  houseEdge
}) {
  const totalBet = Object.values(bets).reduce((sum, val) => sum + val, 0);
  const actualBet = totalBet || amount;
  
  let color, title, description, icon;
  
  if (didWin) {
    color = 0x43b581; // Discord green
    title = '🎉 **WINNER!**';
    description = '✨ **Congratulations!** You hit the jackpot!';
    icon = '🎉';
  } else {
    color = 0xf04747; // Discord red
    title = '😔 **Better Luck Next Time**';
    description = '💔 **The house wins this round!**';
    icon = '💔';
  }

  const colorEmoji = winningColor === 'red' ? '🔴' : winningColor === 'black' ? '⚫' : '🟢';
  const chosenEmoji = chosenColor === 'red' ? '🔴' : chosenColor === 'black' ? '⚫' : '🟢';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${icon} ${title}`)
    .setDescription(description)
    .addFields(
      {
        name: '🎡 **Wheel Result**',
        value: `${frame}\n\n**Winning Number:** ${createNumberDisplay(winningNumber, true)}\n**Color:** ${colorEmoji} **${winningColor.toUpperCase()}**`,
        inline: false
      },
      {
        name: '🎯 **Your Bet**',
        value: `**Chosen:** ${chosenEmoji} **${chosenColor.toUpperCase()}**\n**Amount:** ${formatVP(actualBet)}`,
        inline: true
      },
      {
        name: '💰 **Payout**',
        value: `**Result:** ${didWin ? 'WIN' : 'LOSS'}\n**Net:** ${didWin ? '+' : ''}${formatVP(net)}`,
        inline: true
      }
    )
    .setFooter({ 
      text: '🎰 Round settled • GUHD EATS Casino',
      iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
    })
    .setTimestamp();

  return embed;
}

/**
 * Create betting buttons
 */
export function createBettingButtons(commandId, selectedChip = 10) {
  const chipValues = [1, 5, 10, 25, 100, 500];
  
  // Chip selection row
  const chipRow = new ActionRowBuilder();
  chipValues.forEach(value => {
    chipRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`roulette_chip_${commandId}_${value}`)
        .setLabel(`$${value}`)
        .setStyle(selectedChip === value ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setEmoji('🪙')
    );
  });

  // Color betting row
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

  // Number betting rows (1-36)
  const numberRows = [];
  for (let row = 0; row < 3; row++) {
    const numberRow = new ActionRowBuilder();
    for (let col = 0; col < 12; col++) {
      const num = row * 12 + col + 1;
      const color = getNumberColor(num);
      const style = color === 'red' ? ButtonStyle.Danger : 
                   color === 'black' ? ButtonStyle.Secondary : 
                   ButtonStyle.Success;
      
      numberRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`roulette_bet_${commandId}_number_${num}`)
          .setLabel(`${num}`)
          .setStyle(style)
      );
    }
    numberRows.push(numberRow);
  }

  // Zero row
  const zeroRow = new ActionRowBuilder();
  zeroRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_bet_${commandId}_number_0`)
      .setLabel('0')
      .setStyle(ButtonStyle.Success)
  );

  // Outside bets row
  const outsideRow = new ActionRowBuilder();
  outsideRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_bet_${commandId}_even`)
      .setLabel('EVEN')
      .setStyle(ButtonStyle.Primary)
  );
  outsideRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_bet_${commandId}_odd`)
      .setLabel('ODD')
      .setStyle(ButtonStyle.Primary)
  );
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

  // Dozens row
  const dozensRow = new ActionRowBuilder();
  dozensRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_bet_${commandId}_1st-12`)
      .setLabel('1ST 12')
      .setStyle(ButtonStyle.Primary)
  );
  dozensRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_bet_${commandId}_2nd-12`)
      .setLabel('2ND 12')
      .setStyle(ButtonStyle.Primary)
  );
  dozensRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_bet_${commandId}_3rd-12`)
      .setLabel('3RD 12')
      .setStyle(ButtonStyle.Primary)
  );

  // Action buttons row
  const actionRow = new ActionRowBuilder();
  actionRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_spin_${commandId}`)
      .setLabel('🎡 SPIN')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🎡')
  );
  actionRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`roulette_clear_${commandId}`)
      .setLabel('🗑️ CLEAR')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🗑️')
  );

  return [
    chipRow,
    colorRow,
    ...numberRows,
    zeroRow,
    outsideRow,
    dozensRow,
    actionRow
  ];
}

/**
 * Create rules embed
 */
export function createRouletteRulesEmbed() {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2) // Discord blurple
    .setTitle('🎰 **GUHD EATS Roulette Rules**')
    .setDescription('🎡 *European Roulette Table*')
    .addFields(
      {
        name: '🎯 **Betting Options**',
        value: '**Numbers:** 0-36 (35:1 payout)\n**Colors:** Red/Black (2:1 payout)\n**Green:** 0 only (35:1 payout)\n**Even/Odd:** 2:1 payout\n**1-18/19-36:** 2:1 payout\n**Dozens:** 1st/2nd/3rd 12 (2:1 payout)',
        inline: false
      },
      {
        name: '🎡 **Game Rules**',
        value: '• European roulette (0-36)\n• Single zero wheel\n• All bets must be placed before spin\n• Minimum bet: 1 VP\n• Maximum bet: No limit',
        inline: false
      },
      {
        name: '💰 **Payouts**',
        value: '**Straight (single number):** 35:1\n**Red/Black:** 2:1\n**Even/Odd:** 2:1\n**1-18/19-36:** 2:1\n**Dozens:** 2:1\n**Green (0):** 35:1',
        inline: false
      },
      {
        name: '🎯 **Tips**',
        value: '• Red/Black bets have best odds\n• Green (0) pays highest but lowest chance\n• Outside bets are safer\n• Inside bets pay more but riskier',
        inline: false
      }
    )
    .setFooter({ text: '🎰 Good luck at the tables! • GUHD EATS Casino' })
    .setTimestamp();

  return embed;
}
