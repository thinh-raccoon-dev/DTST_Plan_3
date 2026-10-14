import { existsSync } from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { anonymousSession } from './middleware/anonymousSession.js';
import { attachUser } from './middleware/auth.js';
import { CSRF_HEADER, csrfProtection } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { buildApiRouter } from './routes/index.js';
import { logger } from './utils/logger.js';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.set('query parser', 'extended');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          frameSrc: ["'self'", 'https://www.openstreetmap.org'],
          connectSrc: ["'self'"],
          mediaSrc: ["'self'", 'blob:'],
          workerSrc: ["'self'", 'blob:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
      // API is called from the Vercel site (a different registrable domain), so the
      // browser must be allowed to read these responses.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        // Same-origin and non-browser requests have no Origin header.
        if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
        callback(null, false);
      },
      credentials: true,
      allowedHeaders: ['Content-Type', CSRF_HEADER],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    }),
  );
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/v1/health' } }));
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());

  app.use('/api/v1', apiLimiter, anonymousSession, csrfProtection, attachUser, buildApiRouter());
  app.use('/api', notFoundHandler);

  if (env.SERVE_CLIENT_DIR) {
    const clientDir = path.resolve(process.cwd(), env.SERVE_CLIENT_DIR);
    if (existsSync(path.join(clientDir, 'index.html'))) {
      app.use(express.static(clientDir, { index: false, maxAge: '1h' }));
      app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));
      logger.info({ clientDir }, 'Serving client build');
    } else {
      logger.warn({ clientDir }, 'SERVE_CLIENT_DIR set but index.html not found');
    }
  }

  app.use(errorHandler);
  return app;
}
