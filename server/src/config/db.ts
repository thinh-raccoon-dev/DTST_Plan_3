import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

// Query operator injection is prevented by parsing every body/query/param with Zod into
// primitives before it reaches a filter; `sanitizeFilter` is not used because it would also
// neutralise the server's own `$in`/`$regex` operators.
mongoose.set('strictQuery', true);

export async function connectDatabase(uri: string = env.mongoUri): Promise<typeof mongoose> {
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  mongoose.connection.on('error', (error) => logger.error({ err: error }, 'MongoDB error'));

  const connection = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
    autoIndex: true,
  });
  logger.info({ db: connection.connection.name }, 'MongoDB connected');
  return connection;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}
