import type { Request, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';

function limiter(
  windowMs: number,
  limit: number,
  message: string,
  keyGenerator?: (req: Request) => string,
): RequestHandler {
  if (!env.rateLimitEnabled) return (_req, _res, next) => next();
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    ...(keyGenerator ? { keyGenerator, validate: false } : {}),
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'RATE_LIMITED', message } });
    },
  });
}

export const apiLimiter = limiter(60_000, 300, 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.');
export const loginLimiter = limiter(
  15 * 60_000,
  10,
  'Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.',
  (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 120) : '';
    return `${req.ip ?? 'unknown'}:${email}`;
  },
);
export const registerLimiter = limiter(60 * 60_000, 10, 'Bạn đã tạo quá nhiều tài khoản. Vui lòng thử lại sau.');
export const otpRequestLimiter = limiter(
  15 * 60_000,
  6,
  'Bạn yêu cầu mã xác thực OTP quá nhiều lần. Vui lòng thử lại sau 15 phút.',
  (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 120) : '';
    return `otp-req:${req.ip ?? 'unknown'}:${email}`;
  },
);
export const otpVerifyLimiter = limiter(
  15 * 60_000,
  12,
  'Bạn nhập mã xác thực quá nhiều lần. Vui lòng thử lại sau 15 phút.',
  (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 120) : '';
    return `otp-ver:${req.ip ?? 'unknown'}:${email}`;
  },
);
export const challengeLimiter = limiter(10 * 60_000, 30, 'Bạn gửi đáp án quá nhiều lần. Vui lòng thử lại sau.');
export const eventLimiter = limiter(60_000, 60, 'Quá nhiều yêu cầu ghi nhận. Vui lòng thử lại sau.');
export const aiLimiter = limiter(
  60_000,
  18,
  'Bạn đang gửi yêu cầu trợ lý AI quá nhanh. Vui lòng đợi ít giây rồi thử lại.',
);
export const photoUploadLimiter = limiter(
  15 * 60_000,
  15,
  'Bạn đã tải lên quá nhiều ảnh kỷ niệm trong thời gian ngắn. Vui lòng thử lại sau ít phút.',
);
