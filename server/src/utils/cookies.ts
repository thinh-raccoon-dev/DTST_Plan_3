import type { CookieOptions } from 'express';
import { env } from '../config/env.js';

export const AUTH_COOKIE = 'dtst_access';
export const CSRF_COOKIE = 'dtst_csrf';
export const ANON_COOKIE = 'dtst_anon';

export function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.COOKIE_SAMESITE,
    path: '/',
  };
}
