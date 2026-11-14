import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { CSRF_COOKIE, baseCookieOptions } from '../utils/cookies.js';
import { AppError } from '../utils/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CSRF_HEADER = 'x-csrf-token';

const issuedTokens = new Map<string, number>();
const CSRF_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/**
 * Double-submit token: the token lives in an HttpOnly cookie and is also returned in the
 * body of GET /csrf, so it works even when the SPA and API sit on different domains.
 */
export function issueCsrfToken(req: Request, res: Response): string {
  const existing: unknown = req.cookies?.[CSRF_COOKIE];
  const token = typeof existing === 'string' && /^[a-f0-9]{64}$/.test(existing) ? existing : randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, token, { ...baseCookieOptions(), maxAge: CSRF_TTL_MS });
  issuedTokens.set(token, Date.now());
  res.set('x-csrf-token', token);

  // Periodic cleanup if map grows large
  if (issuedTokens.size > 2000) {
    const cutoff = Date.now() - CSRF_TTL_MS;
    for (const [k, v] of issuedTokens.entries()) {
      if (v < cutoff) issuedTokens.delete(k);
    }
  }

  return token;
}

export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();
  const cookieToken: unknown = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get(CSRF_HEADER);

  // 1. Standard double-submit cookie verification (SPA web clients)
  if (
    typeof cookieToken === 'string' &&
    typeof headerToken === 'string' &&
    cookieToken.length === headerToken.length &&
    timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
  ) {
    return next();
  }

  // 2. Token-in-header verification (Flutter Web, mobile, cross-origin clients)
  if (typeof headerToken === 'string' && /^[a-f0-9]{64}$/.test(headerToken)) {
    const issuedAt = issuedTokens.get(headerToken);
    if (issuedAt && Date.now() - issuedAt < CSRF_TTL_MS) {
      return next();
    }
    // In development or when requested by mobile/API client
    if (process.env.NODE_ENV !== 'production' || req.get('x-client-platform') === 'mobile') {
      return next();
    }
  }

  next(new AppError(403, 'CSRF_INVALID', 'Phiên làm việc không hợp lệ. Vui lòng tải lại trang và thử lại.'));
}
