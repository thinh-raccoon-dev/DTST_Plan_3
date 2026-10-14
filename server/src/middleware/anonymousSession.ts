import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { ANON_COOKIE, baseCookieOptions } from '../utils/cookies.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;

/**
 * Random per-browser id used for the guest passport and for approximate unique-visitor counts.
 * It carries no personal data and is not a reliable person identifier.
 */
export function anonymousSession(req: Request, res: Response, next: NextFunction): void {
  const current: unknown = req.cookies?.[ANON_COOKIE];
  if (typeof current === 'string' && UUID_PATTERN.test(current)) {
    req.anonymousSessionId = current;
  } else {
    req.anonymousSessionId = randomUUID();
    res.cookie(ANON_COOKIE, req.anonymousSessionId, { ...baseCookieOptions(), maxAge: ONE_YEAR_MS });
  }
  next();
}
