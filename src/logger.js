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
    // [FIX]: Print full error stack BEFORE serialization to ensure visibility
    if (meta?.err instanceof Error) {
      const { err, ...rest } = meta;
      
      // Print the full error with stack trace directly to console.error
      // This ensures we see the complete stack, not JSON.stringify'd version
      console.error(`[ERROR] ${message}: ${err.message}`);
      console.error('Stack trace:');
      console.error(err.stack);
      
      // Also log with metadata for structured logging
      const errorInfo = {
        name: err.name,
        message: err.message,
        code: err.code,
        // Include Prisma-specific properties if they exist
        clientVersion: err.clientVersion,
        meta: err.meta,
        ...rest
      };
      
      log('error', message, errorInfo);
    } else {
      log('error', message, meta);
    }
  },
};
