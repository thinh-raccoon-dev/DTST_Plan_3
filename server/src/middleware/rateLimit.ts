import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';

function limiter(windowMs: number, limit: number, message: string): RequestHandler {
  if (!env.rateLimitEnabled) return (_req, _res, next) => next();
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'RATE_LIMITED', message } });
    },
  });
}

export const apiLimiter = limiter(60_000, 300, 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.');
export const loginLimiter = limiter(15 * 60_000, 10, 'Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.');
export const registerLimiter = limiter(60 * 60_000, 10, 'Bạn đã tạo quá nhiều tài khoản. Vui lòng thử lại sau.');
export const challengeLimiter = limiter(10 * 60_000, 30, 'Bạn gửi đáp án quá nhiều lần. Vui lòng thử lại sau.');
export const eventLimiter = limiter(60_000, 60, 'Quá nhiều yêu cầu ghi nhận. Vui lòng thử lại sau.');
