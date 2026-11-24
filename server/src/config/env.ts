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
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).optional(),
  RATE_LIMIT_ENABLED: booleanString.default('true'),
  SERVE_CLIENT_DIR: z.string().optional(),
  TRIP_PLANNER_API_URL: z.string().url().default('http://127.0.0.1:8010'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  GEMINI_API_KEY: z.string().optional(),
  // Email / OTP delivery (supports Brevo API, Resend API, or standard SMTP for @dongthapgo.com)
  MAIL_FROM: z.string().trim().min(3).default('Đồng Tháp Smart Travel <support@dongthapgo.com>'),
  MAIL_REPLY_TO: z.string().trim().email().default('support@dongthapgo.com'),
  BREVO_API_KEY: z.string().trim().optional(),
  RESEND_API_KEY: z.string().trim().optional(),
  SMTP_HOST: z.string().trim().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanString.optional(),
  SMTP_USER: z.string().trim().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_OTP_REQUIRED: booleanString.optional(),
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
  TRUST_PROXY: raw.TRUST_PROXY ?? (isProduction ? 1 : 0),
  isProduction,
  isTest,
  mongoUri: isTest ? raw.MONGODB_URI_TEST : raw.MONGODB_URI,
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  cookieSecure: raw.COOKIE_SECURE ?? isProduction,
  rateLimitEnabled: isProduction ? true : raw.RATE_LIMIT_ENABLED,
  publicAppUrl: raw.PUBLIC_APP_URL.replace(/\/+$/, ''),
  tripPlannerApiUrl: raw.TRIP_PLANNER_API_URL.replace(/\/+$/, ''),
  logLevel: raw.LOG_LEVEL ?? (isTest ? 'silent' : isProduction ? 'info' : 'debug'),
  hasRealMailTransport: Boolean(
    raw.BREVO_API_KEY || raw.RESEND_API_KEY || (raw.SMTP_HOST && raw.SMTP_USER && raw.SMTP_PASS),
  ),
  smtpSecure: raw.SMTP_SECURE ?? raw.SMTP_PORT === 465,
  requireEmailOtp:
    raw.EMAIL_OTP_REQUIRED ??
    (!isTest && (isProduction || Boolean(raw.BREVO_API_KEY || raw.RESEND_API_KEY || raw.SMTP_HOST))),
};

if (env.COOKIE_SAMESITE === 'none' && !env.cookieSecure) {
  console.error('COOKIE_SAMESITE=none yêu cầu COOKIE_SECURE=true (HTTPS).');
  process.exit(1);
}
