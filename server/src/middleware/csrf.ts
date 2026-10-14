import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { CSRF_COOKIE, baseCookieOptions } from '../utils/cookies.js';
import { AppError } from '../utils/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CSRF_HEADER = 'x-csrf-token';

/**
 * Double-submit token: the token lives in an HttpOnly cookie and is also returned in the
 * body of GET /csrf, so it works even when the SPA and API sit on different domains.
 */
export function issueCsrfToken(req: Request, res: Response): string {
  const existing: unknown = req.cookies?.[CSRF_COOKIE];
  const token = typeof existing === 'string' && /^[a-f0-9]{64}$/.test(existing) ? existing : randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, token, { ...baseCookieOptions(), maxAge: 1000 * 60 * 60 * 24 * 7 });
  return token;
}

export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();
  const cookieToken: unknown = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get(CSRF_HEADER);
  if (
    typeof cookieToken === 'string' &&
    typeof headerToken === 'string' &&
    cookieToken.length === headerToken.length &&
    timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
  ) {
    return next();
  }
  next(new AppError(403, 'CSRF_INVALID', 'Phiên làm việc không hợp lệ. Vui lòng tải lại trang và thử lại.'));
}
