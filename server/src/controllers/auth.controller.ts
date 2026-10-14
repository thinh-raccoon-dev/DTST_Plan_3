import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { signAccessToken } from '../middleware/auth.js';
import { UserModel } from '../models/User.js';
import { loginSchema, registerSchema, updateProfileSchema } from '../schemas/auth.schemas.js';
import { AUTH_COOKIE, baseCookieOptions } from '../utils/cookies.js';
import { AppError, conflict, unauthorized } from '../utils/errors.js';

const BCRYPT_ROUNDS = 12;
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
// Compared against when the email does not exist, so response time does not reveal accounts.
const DUMMY_HASH = bcrypt.hashSync('dtst-timing-equalizer', BCRYPT_ROUNDS);

function setSessionCookie(res: Response, userId: string) {
  res.cookie(AUTH_COOKIE, signAccessToken(userId), { ...baseCookieOptions(), maxAge: SESSION_MAX_AGE_MS });
}

function defaultPreferences(prefs?: {
  areas?: string[];
  interests?: string[];
  numberOfDays?: number;
  hoursPerDay?: number;
} | null) {
  return {
    areas: prefs?.areas ?? [],
    interests: prefs?.interests ?? [],
    numberOfDays: prefs?.numberOfDays ?? 2,
    hoursPerDay: prefs?.hoursPerDay ?? 8,
  };
}

function toAuthUser(user: {
  _id: unknown;
  email: string;
  displayName: string;
  role: string;
  preferences?: {
    areas?: string[];
    interests?: string[];
    numberOfDays?: number;
    hoursPerDay?: number;
  } | null;
}) {
  return {
    id: String(user._id),
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    preferences: defaultPreferences(user.preferences),
  };
}

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  if (await UserModel.exists({ email: input.email })) throw conflict('Email này đã được sử dụng.', 'EMAIL_TAKEN');

  // Role is never taken from the request: public sign-up always creates a tourist.
  const user = await UserModel.create({
    email: input.email,
    displayName: input.displayName,
    passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
    role: 'tourist',
  });
  setSessionCookie(res, String(user._id));
  res.status(201).json({ user: toAuthUser(user) });
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const user = await UserModel.findOne({ email: input.email }).select('+passwordHash');
  const passwordOk = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) throw new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
  if (user.status !== 'active') throw new AppError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị vô hiệu hóa.');

  setSessionCookie(res, String(user._id));
  res.json({ user: toAuthUser(user) });
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(AUTH_COOKIE, baseCookieOptions());
  res.status(204).end();
}

export function me(req: Request, res: Response) {
  res.json({ user: req.user ?? null });
}

export async function updateProfile(req: Request, res: Response) {
  if (!req.user) throw unauthorized();
  const input = updateProfileSchema.parse(req.body);
  const user = await UserModel.findById(req.user.id).select('+passwordHash');
  if (!user || user.status !== 'active') throw unauthorized();

  if (input.displayName) user.displayName = input.displayName;
  if (input.preferences) user.preferences = input.preferences;
  if (input.newPassword) {
    const currentOk = await bcrypt.compare(input.currentPassword ?? '', user.passwordHash);
    if (!currentOk) throw new AppError(400, 'INVALID_PASSWORD', 'Mật khẩu hiện tại không đúng.');
    user.passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  }

  await user.save();
  const payload = toAuthUser(user);
  req.user = { ...payload, role: user.role };
  res.json({ user: payload });
}
