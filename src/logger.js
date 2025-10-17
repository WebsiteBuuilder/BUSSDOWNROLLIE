const LEVELS = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
};

function serializeMeta(meta) {
  if (!meta) return '';
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch (error) {
    return ` ${String(meta)}`;
  }
}

function log(level, message, meta) {
  const timestamp = new Date().toISOString();
  const tag = LEVELS[level] ?? 'LOG';
  const output = `[${timestamp}] [${tag}] ${message}${serializeMeta(meta)}`;

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug(message, meta) {
    log('debug', message, meta);
  },
  info(message, meta) {
    log('info', message, meta);
  },
  warn(message, meta) {
    log('warn', message, meta);
  },
  error(message, meta) {
    if (meta?.err instanceof Error) {
      const { err, ...rest } = meta;
      log('error', `${message}: ${err.message}`, { ...rest, stack: err.stack });
    } else {
      log('error', message, meta);
    }
  },
};
