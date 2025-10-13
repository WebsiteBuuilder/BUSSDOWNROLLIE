/**
 * Format VP amount with emoji
 */
export function formatVP(amount) {
  return `${amount} VP 💰`;
}

/**
 * Format Discord timestamp
 */
export function formatTimestamp(date, style = 'F') {
  const timestamp = Math.floor(date.getTime() / 1000);
  return `<t:${timestamp}:${style}>`;
}

/**
 * Parse message link to extract guild, channel, and message IDs
 */
export function parseMessageLink(link) {
  const match = link.match(/https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
  if (!match) return null;
  
  return {
    guildId: match[1],
    channelId: match[2],
    messageId: match[3]
  };
}

/**
 * Check if message has image attachments
 */
export function hasImageAttachment(message) {
  if (!message.attachments || message.attachments.size === 0) {
    return false;
  }

  const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  return message.attachments.some(attachment => {
    const ext = attachment.name?.toLowerCase().split('.').pop();
    return imageExtensions.includes(ext) || attachment.contentType?.startsWith('image/');
  });
}

/**
 * Get first image URL from message
 */
export function getFirstImageUrl(message) {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  const imageAttachment = message.attachments.find(attachment => {
    const ext = attachment.name?.toLowerCase().split('.').pop();
    return imageExtensions.includes(ext) || attachment.contentType?.startsWith('image/');
  });
  
  return imageAttachment?.url || null;
}

/**
 * Check if message mentions role
 */
export function mentionsRole(message, roleId) {
  return message.mentions.roles.has(roleId);
}

/**
 * Calculate transfer fee
 */
export function calculateTransferFee(amount, feePercent) {
  if (feePercent <= 0) {
    return 0;
  }

  const fee = Math.floor((amount * feePercent) / 100);
  return Math.max(fee, 1); // Minimum 1 VP fee when a fee is enabled
}

/**
 * Calculate battle rake (house cut)
 */
export function calculateBattleRake(amount, rakePercent) {
  return Math.floor((amount * 2 * rakePercent) / 100);
}

/**
 * Get random element from array
 */
export function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Shuffle array
 */
export function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generate random number between min and max (inclusive)
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep for ms milliseconds
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Export users to CSV format
 */
export function exportToCSV(users) {
  let csv = 'Discord ID,VP Balance,Streak Days,Blacklisted,Created At\n';
  
  for (const user of users) {
    csv += `${user.discordId},${user.vp},${user.streakDays},${user.blacklisted},${user.createdAt}\n`;
  }
  
  return csv;
}

/**
 * Get medal emoji for rank
 */
export function getMedalEmoji(rank) {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return '';
  }
}

/**
 * Create error embed
 */
export function createErrorEmbed(message) {
  return {
    color: 0xFF0000,
    title: '❌ Error',
    description: message,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create success embed
 */
export function createSuccessEmbed(title, description) {
  return {
    color: 0x00FF00,
    title: `✅ ${title}`,
    description,
    timestamp: new Date().toISOString()
  };
}

