import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { formatVP } from './utils.js';
import { calculateHandValue } from './blackjack.js';

/**
 * Enhanced Discord-style blackjack UI components
 */

/**
 * Create a visual playing card representation
 */
export function createCardDisplay(card, isHidden = false) {
  if (isHidden) {
    return '🂠'; // Face-down card
  }
  
  const suitSymbols = {
    '♠️': '♠',
    '♥️': '♥', 
    '♦️': '♦',
    '♣️': '♣'
  };
  
  const suit = suitSymbols[card.suit] || card.suit;
  const rank = card.rank;
  
  // Color coding for red suits
  const isRed = card.suit === '♥️' || card.suit === '♦️';
  const color = isRed ? '🔴' : '⚫';
  
  return `${color} **${rank}${suit}**`;
}

/**
 * Create hand display with visual cards
 */
export function createHandDisplay(hand, hideFirst = false, handName = 'Hand') {
  if (hideFirst && hand.length > 1) {
    const visibleCards = hand.slice(1).map(card => createCardDisplay(card));
    return `🂠 ${visibleCards.join(' ')}`;
  }
  
  const cards = hand.map(card => createCardDisplay(card));
  return cards.join(' ');
}

/**
 * Create enhanced game UI embed
 */
export function createGameUIEmbed(gameState, user, playerValue, dealerShowingValue, hasPeeked = false) {
  const dealerHandDisplay = hasPeeked 
    ? createHandDisplay(gameState.dealerHand, false) // Show all cards if peeked
    : createHandDisplay(gameState.dealerHand, true);  // Hide first card if not peeked
  
  const dealerValueText = hasPeeked 
    ? `**Total:** \`${calculateHandValue(gameState.dealerHand)}\``
    : `**Showing:** \`${dealerShowingValue}\` (🂠 hidden)`;

  const embed = new EmbedBuilder()
    .setColor(0x2f3136) // Discord dark gray
    .setTitle('♠️ **GUHD EATS Blackjack**')
    .setDescription('🎰 *Tournament Blackjack Table*')
    .addFields(
      {
        name: '🎴 **Your Hand**',
        value: `${createHandDisplay(gameState.playerHand)}\n**Total:** \`${playerValue}\``,
        inline: false
      },
      {
        name: '🃏 **Dealer Hand**',
        value: `${dealerHandDisplay}\n${dealerValueText}`,
        inline: false
      },
      {
        name: '💰 **Game Info**',
        value: `**Bet:** ${formatVP(gameState.bet)}\n**Balance:** ${formatVP(user.vp - gameState.bet)}`,
        inline: true
      }
    )
    .setFooter({ 
      text: '⚡ You have 60 seconds per action • Good luck!',
      iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png' // Optional icon
    })
    .setTimestamp();

  return embed;
}

/**
 * Create enhanced result UI embed
 */
export function createResultUIEmbed(gameState, user, playerValue, dealerValue, result, payout, updatedUser) {
  let color, title, description, icon;
  
  switch (result) {
    case 'blackjack':
      color = 0xffd700; // Gold
      title = '♠️ **BLACKJACK!**';
      description = '🎉 **Natural 21!** You hit the jackpot!';
      icon = '♠️';
      break;
    case 'win':
      color = 0x43b581; // Discord green
      title = '🎉 **You Win!**';
      description = '✨ **Victory!** Your hand beats the dealer!';
      icon = '✅';
      break;
    case 'push':
      color = 0xfaa61a; // Discord yellow
      title = '🤝 **Push**';
      description = '⚖️ **Tie Game!** Your bet is returned.';
      icon = '🤝';
      break;
    case 'lose':
    default:
      color = 0xf04747; // Discord red
      title = '😔 **You Lost**';
      description = '💔 **Better luck next time!**';
      icon = '❌';
      break;
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${icon} ${title}`)
    .setDescription(description)
    .addFields(
      {
        name: '🎴 **Your Hand**',
        value: `${createHandDisplay(gameState.playerHand)}\n**Total:** \`${playerValue}\``,
        inline: false
      },
      {
        name: '🃏 **Dealer Hand**',
        value: `${createHandDisplay(gameState.dealerHand)}\n**Total:** \`${dealerValue}\``,
        inline: false
      },
      {
        name: '📊 **Game Results**',
        value: `**Outcome:** ${icon} ${title.replace(/\*\*/g, '')}\n**Bet:** ${formatVP(gameState.bet)}\n**Payout:** ${formatVP(payout)}`,
        inline: true
      },
      {
        name: '💳 **Balance**',
        value: `**Previous:** ${formatVP(user.vp)}\n**New:** ${formatVP(updatedUser.vp)}\n**Change:** ${payout > 0 ? '+' : ''}${formatVP(payout)}`,
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
 * Create enhanced action buttons
 */
export function createActionButtons(round, gameState, user, hasPeeked = false) {
  const row = new ActionRowBuilder();

  // Hit button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`bj_hit_${round.id}`)
      .setLabel('🎯 Hit')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎯')
  );

  // Stand button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`bj_stand_${round.id}`)
      .setLabel('✋ Stand')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✋')
  );

  // Double down button (only on first two cards)
  if (gameState.playerHand.length === 2 && user.vp >= gameState.bet) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`bj_double_${round.id}`)
        .setLabel('💎 Double')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('💎')
    );
  }

  // Peek button (only if not already peeked and user has enough VP)
  const peekCost = Math.max(1, Math.floor(gameState.bet * 0.1)); // 10% of bet, minimum 1 VP
  if (!hasPeeked && user.vp >= peekCost) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`bj_peek_${round.id}`)
        .setLabel(`👁️ Peek (${formatVP(peekCost)})`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👁️')
    );
  }

  // Split button (simplified version - disabled for now)
  if (canSplit(gameState.playerHand) && user.vp >= gameState.bet && !gameState.split) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`bj_split_${round.id}`)
        .setLabel('🔄 Split')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔄')
        .setDisabled(true) // Simplified version doesn't support split yet
    );
  }

  return row;
}

/**
 * Create enhanced rules embed
 */
export function createRulesEmbed(minBet) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2) // Discord blurple
    .setTitle('♠️ **GUHD EATS Blackjack Rules**')
    .setDescription('🎰 *Welcome to the premium blackjack table!*')
    .addFields(
      {
        name: '📊 **Table Limits**',
        value: `**Minimum Bet:** ${formatVP(minBet)}\n**Maximum Bet:** No Limit\n**Decks:** 6 Shoe`,
        inline: true
      },
      {
        name: '💰 **Payouts**',
        value: '**Blackjack:** 3:2 (150%)\n**Win:** 1:1 (100%)\n**Push:** Bet Returned',
        inline: true
      },
      {
        name: '🎴 **Game Rules**',
        value: '• Dealer hits on soft 17\n• Blackjack pays 3:2\n• Double down available\n• Split available (same value cards)\n• Insurance not offered',
        inline: false
      },
      {
        name: '⏱️ **Time Limits**',
        value: '• 60 seconds per action\n• Auto-stand on timeout\n• Game expires after 10 minutes',
        inline: false
      },
      {
        name: '🎯 **Tips**',
        value: '• Always split Aces and 8s\n• Double down on 11\n• Stand on 17+ vs dealer 7+\n• Hit on soft 17 or less',
        inline: false
      }
    )
    .setFooter({ text: '🎰 Good luck at the tables! • GUHD EATS Casino' })
    .setTimestamp();

  return embed;
}

/**
 * Helper function to check if hand can be split
 */
function canSplit(hand) {
  if (hand.length !== 2) return false;
  
  const value1 = hand[0].rank === 'A' ? 11 : 
                 ['K', 'Q', 'J'].includes(hand[0].rank) ? 10 : 
                 parseInt(hand[0].rank, 10);
                 
  const value2 = hand[1].rank === 'A' ? 11 : 
                 ['K', 'Q', 'J'].includes(hand[1].rank) ? 10 : 
                 parseInt(hand[1].rank, 10);
                 
  return value1 === value2;
}
