export function parseDuration(input: string): number | null {
  const pattern = /(?:(\d+)([smhd]))/gi;
  let match: RegExpExecArray | null;
  let total = 0;
  let found = false;
  while ((match = pattern.exec(input)) !== null) {
    const value = Number(match[1]);
    const unit = match[2];
    found = true;
    switch (unit) {
      case 's':
        total += value * 1000;
        break;
      case 'm':
        total += value * 60 * 1000;
        break;
      case 'h':
        total += value * 60 * 60 * 1000;
        break;
      case 'd':
        total += value * 24 * 60 * 60 * 1000;
        break;
      default:
        return null;
    }
  }

  if (!found) {
    return null;
  }

  return total;
}
