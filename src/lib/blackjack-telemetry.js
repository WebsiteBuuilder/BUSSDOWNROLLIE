const REDACTED_KEYS = new Set(['token', 'auth', 'authorization']);

function sanitize(details = {}) {
  if (!details || typeof details !== 'object') {
    return details;
  }

  return Object.entries(details).reduce((acc, [key, value]) => {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      acc[key] = '[redacted]';
      return acc;
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      acc[key] = sanitize(value);
    } else {
      acc[key] = value;
    }

    return acc;
  }, {});
}

export function logBlackjackEvent(event, details = {}) {
  const payload = {
    scope: 'blackjack',
    event,
    timestamp: new Date().toISOString(),
    ...sanitize(details),
  };

  console.log(JSON.stringify(payload));
}
