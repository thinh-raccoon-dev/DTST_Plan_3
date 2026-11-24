import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { isValidObjectId } from 'mongoose';
import { env } from '../config/env.js';
import { UserModel } from '../models/User.js';
import { AUTH_COOKIE, baseCookieOptions } from '../utils/cookies.js';
import { forbidden, unauthorized } from '../utils/errors.js';

interface TokenPayload {
  sub: string;
  tv?: number;
}

export function signAccessToken(userId: string, tokenVersion = 0): string {
  return jwt.sign({ sub: userId, tv: tokenVersion } satisfies TokenPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

function readTokenClaims(token: string): { userId: string; tokenVersion: number; issuedAtSec?: number } | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'object' && typeof payload.sub === 'string' && isValidObjectId(payload.sub)) {
      const tv = typeof payload.tv === 'number' ? payload.tv : 0;
      const iat = typeof payload.iat === 'number' ? payload.iat : undefined;
      return { userId: payload.sub, tokenVersion: tv, issuedAtSec: iat };
    }
    return null;
  } catch {
    // Expired or tampered tokens simply mean "not signed in".
    return null;
  }
}

/** Resolves the current user from the HttpOnly cookie or Authorization Bearer token. Role, status and tokenVersion always come from the DB. */
export async function attachUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const cookieToken = typeof req.cookies?.[AUTH_COOKIE] === 'string' && req.cookies[AUTH_COOKIE].length > 0
    ? req.cookies[AUTH_COOKIE]
    : undefined;
  const bearerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7).trim() || undefined
    : undefined;

  if (!cookieToken && !bearerToken) return next();

  // Try cookie first; if stale/expired, fall back cleanly to a fresh Bearer token (mobile / PWA / cross-origin).
  const candidates: Array<{ token: string; via: 'cookie' | 'bearer' }> = [];
  if (cookieToken) candidates.push({ token: cookieToken, via: 'cookie' });
  if (bearerToken && bearerToken !== cookieToken) candidates.push({ token: bearerToken, via: 'bearer' });

  let matchedUser: {
    _id: unknown;
    email: string;
    displayName: string;
    role: 'tourist' | 'partner' | 'admin';
    status: string;
    tokenVersion?: number;
    preferences?: {
      areas?: string[];
      interests?: string[];
      numberOfDays?: number;
      hoursPerDay?: number;
    } | null;
  } | null = null;
  let matchedClaims: { userId: string; tokenVersion: number; issuedAtSec?: number } | null = null;
  let matchedVia: 'cookie' | 'bearer' = 'cookie';

  for (const candidate of candidates) {
    const claims = readTokenClaims(candidate.token);
    if (!claims) continue;
    const user = await UserModel.findById(claims.userId)
      .select('email displayName role status tokenVersion preferences')
      .lean();
    if (user && user.status === 'active' && (user.tokenVersion ?? 0) === claims.tokenVersion) {
      matchedUser = user;
      matchedClaims = claims;
      matchedVia = candidate.via;
      break;
    }
  }

  if (!matchedUser || !matchedClaims) {
    if (cookieToken) res.clearCookie(AUTH_COOKIE, baseCookieOptions());
    return next();
  }

  req.user = {
    id: String(matchedUser._id),
    email: matchedUser.email,
    displayName: matchedUser.displayName,
    role: matchedUser.role,
    preferences: {
      areas: matchedUser.preferences?.areas ?? [],
      interests: matchedUser.preferences?.interests ?? [],
      numberOfDays: matchedUser.preferences?.numberOfDays ?? 2,
      hoursPerDay: matchedUser.preferences?.hoursPerDay ?? 8,
    },
  };
  req.authMeta = {
    tokenVersion: matchedClaims.tokenVersion,
    issuedAtSec: matchedClaims.issuedAtSec,
    via: matchedVia,
  };
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(unauthorized());
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(unauthorized('Vui lòng đăng nhập bằng tài khoản quản trị.'));
  if (req.user.role !== 'admin') return next(forbidden('Tài khoản không có quyền quản trị.'));
  next();
}

export function requireStaff(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(unauthorized('Vui lòng đăng nhập bằng tài khoản quản trị hoặc đối tác.'));
  if (req.user.role !== 'admin' && req.user.role !== 'partner') {
    return next(forbidden('Tài khoản không có quyền quản trị nội dung.'));
  }
  next();
}
