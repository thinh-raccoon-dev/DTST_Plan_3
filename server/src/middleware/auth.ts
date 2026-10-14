import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { isValidObjectId } from 'mongoose';
import { env } from '../config/env.js';
import { UserModel } from '../models/User.js';
import { AUTH_COOKIE, baseCookieOptions } from '../utils/cookies.js';
import { forbidden, unauthorized } from '../utils/errors.js';

interface TokenPayload {
  sub: string;
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId } satisfies TokenPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

function readUserId(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'object' && typeof payload.sub === 'string' && isValidObjectId(payload.sub)) {
      return payload.sub;
    }
    return null;
  } catch {
    // Expired or tampered tokens simply mean "not signed in".
    return null;
  }
}

/** Resolves the current user from the HttpOnly cookie. Role and status always come from the DB. */
export async function attachUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token: unknown = req.cookies?.[AUTH_COOKIE];
  if (typeof token !== 'string' || token.length === 0) return next();

  const userId = readUserId(token);
  if (!userId) {
    res.clearCookie(AUTH_COOKIE, baseCookieOptions());
    return next();
  }

  const user = await UserModel.findById(userId).select('email displayName role status preferences').lean();
  if (!user || user.status !== 'active') {
    res.clearCookie(AUTH_COOKIE, baseCookieOptions());
    return next();
  }

  req.user = {
    id: String(user._id),
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    preferences: {
      areas: user.preferences?.areas ?? [],
      interests: user.preferences?.interests ?? [],
      numberOfDays: user.preferences?.numberOfDays ?? 2,
      hoursPerDay: user.preferences?.hoursPerDay ?? 8,
    },
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
