import { createServer } from 'http';
import { logger } from './logger.js';

const HEALTH_PATHS = new Set(['/', '/health', '/healthz', '/status']);
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 1500;
let activeServer = null;

function normalizePort(value) {
  if (!value) {
    return DEFAULT_PORT;
  }

  const port = Number.parseInt(String(value), 10);
  return Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT;
}

function buildHealthResponse(startedAt) {
  return JSON.stringify({
    status: 'ok',
    uptime: process.uptime(),
    startedAt,
  });
}

export async function startNetworkServer(options = {}) {
  const preferredPort = normalizePort(options.port ?? process.env.PORT ?? process.env.SERVER_PORT);
  const host = options.host ?? DEFAULT_HOST;
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? RETRY_DELAY_MS;
  const serverStartedAt = new Date().toISOString();
  const bootStartedAt = options.bootStartedAt ?? Date.now();

  let attempt = 0;
  let remainingRetries = Math.max(0, maxRetries);
  let shutdownRegistered = false;

  const createRequestListener = () => (req, res) => {
    const method = req.method ?? 'GET';
    const url = req.url ?? '/';

    const path = (() => {
      try {
        const parsed = new URL(url, `http://${req.headers.host ?? 'localhost'}`);
        return parsed.pathname;
      } catch (error) {
        logger.warn('health server received malformed URL', { url, err: error });
        return '/';
      }
    })();

    if (HEALTH_PATHS.has(path) && (method === 'GET' || method === 'HEAD')) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, max-age=0');

      if (method === 'HEAD') {
        res.end();
        return;
      }

      res.end(buildHealthResponse(serverStartedAt));
      return;
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ status: 'not-found', path }));
  };

  const installShutdownHooks = (server) => {
    if (shutdownRegistered) {
      return;
    }
    shutdownRegistered = true;

    const shutdown = (signal) => {
      logger.info('received shutdown signal, closing network server', { signal });
      server.close((error) => {
        if (error) {
          logger.error('failed to close network server gracefully', { err: error });
        } else {
          logger.info('network server closed');
        }
      });
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  };

  const startAttempt = (resolve, reject) => {
    attempt += 1;
    const attemptStart = Date.now();

    logger.info('starting network health server', {
      attempt,
      host,
      port: preferredPort,
    });

    const server = createServer(createRequestListener());
    activeServer = server;

    server.once('error', (error) => {
      const retryable =
        error &&
        typeof error === 'object' &&
        'code' in error &&
        ['EADDRINUSE', 'EACCES', 'EADDRNOTAVAIL'].includes(error.code);

      if (retryable && remainingRetries > 0) {
        remainingRetries -= 1;
        logger.warn('network server failed to bind, retrying', {
          attempt,
          remainingRetries,
          errorCode: error.code,
        });
        setTimeout(() => startAttempt(resolve, reject), retryDelayMs);
        return;
      }

      activeServer = null;
      logger.error('network server failed to start', { err: error, attempt });
      reject(error);
    });

    server.listen(preferredPort, host, () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : preferredPort;
      const duration = Date.now() - attemptStart;

      logger.info(`Server running on port ${actualPort}`, { durationMs: duration });
      logger.info('network health server ready', {
        attempt,
        totalTimeMs: Date.now() - bootStartedAt,
      });

      installShutdownHooks(server);
      resolve(server);
    });
  };

  return new Promise((resolve, reject) => {
    startAttempt(resolve, reject);
  });
}

export function getActiveNetworkServer() {
  return activeServer;
}
