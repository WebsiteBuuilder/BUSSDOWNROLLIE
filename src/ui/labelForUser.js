export function labelForUser(player, viewerId, { fallback = 'Unknown', emphasize = false } = {}) {
  if (!player) {
    return fallback;
  }

  const baseName = player.displayName ?? player.tag ?? fallback;
  const isViewer = viewerId && player.id === viewerId;
  const label = `${baseName}${isViewer ? ' (you)' : ''}`;

  if (emphasize) {
    return `**${label}**`;
  }

  return label;
}

export function turnStatusLabel(player, viewerId) {
  if (!player) {
    return 'Unknown turn';
  }

  return `${labelForUser(player, viewerId, { fallback: 'Unknown' })}`;
}
