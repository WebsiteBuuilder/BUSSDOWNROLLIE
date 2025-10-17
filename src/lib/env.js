export function getEnvVar(name) {
  if (!name) {
    return undefined;
  }

  const directValue = process.env[name];
  if (typeof directValue === 'string') {
    const trimmed = directValue.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  } else if (directValue !== undefined && directValue !== null) {
    return directValue;
  }

  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(process.env)) {
    if (key.toLowerCase() === target) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
        return undefined;
      }
      return value;
    }
  }

  return undefined;
}
