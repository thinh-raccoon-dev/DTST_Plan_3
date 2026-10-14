import 'dotenv/config';
import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/dtst'),
  MONGODB_URI_TEST: z.string().min(1).default('mongodb://127.0.0.1:27017/dtst_test'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET phải có ít nhất 32 ký tự'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  PUBLIC_APP_URL: z.string().url().default('http://localhost:5173'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_SECURE: booleanString.optional(),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  RATE_LIMIT_ENABLED: booleanString.default('true'),
  SERVE_CLIENT_DIR: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
  // Logger depends on env, so fail fast on stderr here.
  console.error(`Cấu hình môi trường không hợp lệ:\n${issues.join('\n')}`);
  process.exit(1);
}

const raw = parsed.data;
const isProduction = raw.NODE_ENV === 'production';
const isTest = raw.NODE_ENV === 'test';

export const env = {
  ...raw,
  isProduction,
  isTest,
  mongoUri: isTest ? raw.MONGODB_URI_TEST : raw.MONGODB_URI,
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  cookieSecure: raw.COOKIE_SECURE ?? isProduction,
  rateLimitEnabled: isProduction ? true : raw.RATE_LIMIT_ENABLED,
  publicAppUrl: raw.PUBLIC_APP_URL.replace(/\/+$/, ''),
  logLevel: raw.LOG_LEVEL ?? (isTest ? 'silent' : isProduction ? 'info' : 'debug'),
};

if (env.COOKIE_SAMESITE === 'none' && !env.cookieSecure) {
  console.error('COOKIE_SAMESITE=none yêu cầu COOKIE_SECURE=true (HTTPS).');
  process.exit(1);
}
