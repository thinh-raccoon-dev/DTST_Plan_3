import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { signAccessToken } from '../middleware/auth.js';
import { EmailOtpModel } from '../models/EmailOtp.js';
import { UserModel } from '../models/User.js';
import {
  loginSchema,
  registerSchema,
  requestRegisterOtpSchema,
  updateProfileSchema,
  verifyRegisterOtpSchema,
} from '../schemas/auth.schemas.js';
import { sendEmail } from '../services/email.service.js';
import { renderRegisterOtpEmail } from '../services/emailTemplates.js';
import { getEffectiveSystemSettings } from '../services/systemSettings.service.js';
import { AUTH_COOKIE, baseCookieOptions } from '../utils/cookies.js';
import { AppError, conflict, unauthorized } from '../utils/errors.js';

const BCRYPT_ROUNDS = 12;
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const OTP_TTL_MINUTES = 5;
const OTP_TTL_MS = OTP_TTL_MINUTES * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

// Compared against when the email does not exist, so response time does not reveal accounts.
const DUMMY_HASH = bcrypt.hashSync('dtst-timing-equalizer', BCRYPT_ROUNDS);

function setSessionCookie(res: Response, userId: string, tokenVersion = 0): void {
  const token = signAccessToken(userId, tokenVersion);
  res.cookie(AUTH_COOKIE, token, { ...baseCookieOptions(), maxAge: SESSION_MAX_AGE_MS });
}

function hashRegisterOtp(email: string, otp: string): string {
  return crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(`register:${email.toLowerCase()}:${otp}`)
    .digest('hex');
}

function safeHexEqual(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function consumeVerifiedRegisterOtp(email: string, otp: string): Promise<void> {
  const record = await EmailOtpModel.findOne({ email, purpose: 'register' });
  const now = Date.now();

  if (!record || record.consumedAt || record.expiresAt.getTime() <= now) {
    throw new AppError(
      400,
      'OTP_EXPIRED',
      'Mã xác thực không tồn tại hoặc đã hết hạn. Vui lòng gửi lại mã mới.',
    );
  }

  if (record.attempts >= record.maxAttempts) {
    throw new AppError(
      429,
      'OTP_LOCKED',
      'Bạn đã nhập sai mã OTP quá số lần cho phép. Vui lòng yêu cầu gửi lại mã mới.',
    );
  }

  const expectedHash = hashRegisterOtp(email, otp);
  if (!safeHexEqual(record.codeHash, expectedHash)) {
    const updated = await EmailOtpModel.findByIdAndUpdate(
      record._id,
      { $inc: { attempts: 1 } },
      { new: true },
    ).lean();
    const used = updated?.attempts ?? record.attempts + 1;
    const remaining = Math.max(0, record.maxAttempts - used);
    if (remaining === 0) {
      throw new AppError(
        429,
        'OTP_LOCKED',
        'Bạn đã nhập sai mã OTP quá 5 lần. Vui lòng yêu cầu gửi lại mã mới.',
      );
    }
    throw new AppError(
      400,
      'OTP_INVALID',
      `Mã xác thực OTP không đúng (còn ${remaining} lần thử).`,
      { remainingAttempts: remaining },
    );
  }

  // Atomic one-time consumption to prevent concurrent replay
  const consumed = await EmailOtpModel.findOneAndUpdate(
    { _id: record._id, consumedAt: null },
    { $set: { consumedAt: new Date() } },
    { new: true },
  );
  if (!consumed) {
    throw new AppError(
      400,
      'OTP_EXPIRED',
      'Mã xác thực đã được sử dụng. Vui lòng yêu cầu mã mới nếu cần.',
    );
  }
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

async function ensureRegistrationEnabled(): Promise<void> {
  const settings = await getEffectiveSystemSettings();
  if (!settings.general.enablePublicRegistration) {
    throw new AppError(
      403,
      'REGISTRATION_DISABLED',
      'Đăng ký tài khoản công khai hiện đang tạm đóng theo cấu hình quản trị.',
    );
  }
}

export async function requestRegisterOtp(req: Request, res: Response) {
  await ensureRegistrationEnabled();
  const input = requestRegisterOtpSchema.parse(req.body);

  if (await UserModel.exists({ email: input.email })) {
    throw conflict('Email này đã được sử dụng.', 'EMAIL_TAKEN');
  }

  const now = new Date();
  const existing = await EmailOtpModel.findOne({ email: input.email, purpose: 'register' }).lean();
  if (existing && !existing.consumedAt) {
    const elapsedMs = now.getTime() - new Date(existing.lastSentAt).getTime();
    if (elapsedMs < OTP_RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.max(1, Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsedMs) / 1000));
      throw new AppError(
        429,
        'OTP_COOLDOWN',
        `Vui lòng đợi ${retryAfterSeconds} giây trước khi yêu cầu gửi lại mã OTP.`,
        { retryAfterSeconds },
      );
    }
  }

  const otpCode = String(crypto.randomInt(100000, 1000000));
  const codeHash = hashRegisterOtp(input.email, otpCode);
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

  await EmailOtpModel.findOneAndUpdate(
    { email: input.email, purpose: 'register' },
    {
      $set: {
        codeHash,
        displayName: input.displayName,
        attempts: 0,
        maxAttempts: OTP_MAX_ATTEMPTS,
        lastSentAt: now,
        expiresAt,
        consumedAt: null,
        requestedIp: req.ip ?? '',
      },
    },
    { upsert: true, new: true },
  );

  const rendered = renderRegisterOtpEmail({
    displayName: input.displayName,
    email: input.email,
    otpCode,
    expiresMinutes: OTP_TTL_MINUTES,
    appUrl: env.publicAppUrl.startsWith('http://localhost') ? 'https://dongthapgo.com' : env.publicAppUrl,
    requestedAt: now,
  });

  let delivery;
  try {
    delivery = await sendEmail({
      to: input.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  } catch (err) {
    // Roll back pending OTP so user can retry immediately without waiting for cooldown
    await EmailOtpModel.deleteOne({ email: input.email, purpose: 'register', codeHash }).catch(() => {});
    throw err;
  }

  res.status(200).json({
    sent: true,
    email: input.email,
    expiresInSeconds: OTP_TTL_MINUTES * 60,
    resendCooldownSeconds: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
    deliveryMode: delivery.deliveryMode,
    // Strictly only returned in local dev preview when no real mail transport is configured
    ...(env.NODE_ENV === 'development' && delivery.deliveryMode === 'preview' ? { devPreviewCode: otpCode } : {}),
  });
}

export async function verifyRegisterOtp(req: Request, res: Response) {
  await ensureRegistrationEnabled();
  const input = verifyRegisterOtpSchema.parse(req.body);

  if (await UserModel.exists({ email: input.email })) {
    throw conflict('Email này đã được sử dụng.', 'EMAIL_TAKEN');
  }

  await consumeVerifiedRegisterOtp(input.email, input.otp);

  // Role is never taken from the request: public sign-up always creates a tourist.
  const user = await UserModel.create({
    email: input.email,
    displayName: input.displayName,
    passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
    role: 'tourist',
    emailVerified: true,
    emailVerifiedAt: new Date(),
  });
  setSessionCookie(res, String(user._id), user.tokenVersion ?? 0);
  res.status(201).json({ user: toAuthUser(user) });
}

export async function register(req: Request, res: Response) {
  await ensureRegistrationEnabled();
  const input = registerSchema.parse(req.body);
  if (await UserModel.exists({ email: input.email })) throw conflict('Email này đã được sử dụng.', 'EMAIL_TAKEN');

  let emailVerified = false;
  if (env.requireEmailOtp || input.otp) {
    if (!input.otp) {
      throw new AppError(
        400,
        'OTP_REQUIRED',
        'Vui lòng xác thực mã OTP 6 chữ số được gửi tới email trước khi hoàn tất đăng ký.',
      );
    }
    await consumeVerifiedRegisterOtp(input.email, input.otp);
    emailVerified = true;
  }

  // Role is never taken from the request: public sign-up always creates a tourist.
  const user = await UserModel.create({
    email: input.email,
    displayName: input.displayName,
    passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
    role: 'tourist',
    emailVerified,
    ...(emailVerified ? { emailVerifiedAt: new Date() } : {}),
  });
  setSessionCookie(res, String(user._id), user.tokenVersion ?? 0);
  res.status(201).json({ user: toAuthUser(user) });
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const user = await UserModel.findOne({ email: input.email }).select('+passwordHash');
  const passwordOk = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) throw new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
  if (user.status !== 'active') throw new AppError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị vô hiệu hóa.');

  setSessionCookie(res, String(user._id), user.tokenVersion ?? 0);
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
  let passwordChanged = false;
  if (input.newPassword) {
    const currentOk = await bcrypt.compare(input.currentPassword ?? '', user.passwordHash);
    if (!currentOk) throw new AppError(400, 'INVALID_PASSWORD', 'Mật khẩu hiện tại không đúng.');
    user.passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    passwordChanged = true;
  }

  await user.save();
  if (passwordChanged) {
    setSessionCookie(res, String(user._id), user.tokenVersion ?? 0);
  }
  const payload = toAuthUser(user);
  req.user = { ...payload, role: user.role };
  res.json({ user: payload });
}
