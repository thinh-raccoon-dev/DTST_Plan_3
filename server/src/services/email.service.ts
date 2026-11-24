import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface SendEmailResult {
  deliveryMode: 'brevo' | 'resend' | 'smtp' | 'preview';
  messageId: string;
  previewPath?: string;
}

function stripHeaderCrlf(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function parseFromAddress(rawFrom: string): { name: string; email: string } {
  const clean = stripHeaderCrlf(rawFrom);
  const match = clean.match(/^(.*?)<([^>]+)>$/);
  if (match) {
    return {
      name: match[1]!.trim().replace(/^["']|["']$/g, '') || 'Đồng Tháp Smart Travel',
      email: match[2]!.trim(),
    };
  }
  return { name: 'Đồng Tháp Smart Travel', email: clean };
}

async function sendViaBrevo(input: SendEmailInput): Promise<SendEmailResult> {
  const sender = parseFromAddress(env.MAIL_FROM);
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY!,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: [{ email: input.to }],
      replyTo: { email: input.replyTo ?? env.MAIL_REPLY_TO, name: sender.name },
      subject: input.subject,
      htmlContent: input.html,
      textContent: input.text,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    logger.error({ status: response.status, errText }, 'Brevo email delivery failed');
    throw new AppError(
      502,
      'EMAIL_DELIVERY_FAILED',
      'Không thể gửi email xác thực qua Brevo lúc này. Vui lòng kiểm tra khóa Brevo hoặc thử lại sau.',
    );
  }

  const data = (await response.json()) as { messageId?: string };
  return {
    deliveryMode: 'brevo',
    messageId: data.messageId ?? `brevo-${Date.now()}`,
  };
}

let cachedSmtpTransporter: Transporter | null = null;

function getSmtpTransporter(): Transporter {
  if (!cachedSmtpTransporter) {
    cachedSmtpTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.smtpSecure,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return cachedSmtpTransporter;
}

async function sendViaResend(input: SendEmailInput): Promise<SendEmailResult> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [input.to],
      reply_to: input.replyTo ?? env.MAIL_REPLY_TO,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    logger.error({ status: response.status, errText }, 'Resend email delivery failed');
    throw new AppError(
      502,
      'EMAIL_DELIVERY_FAILED',
      'Không thể gửi email xác thực lúc này. Vui lòng thử lại sau ít phút.',
    );
  }

  const data = (await response.json()) as { id?: string };
  return {
    deliveryMode: 'resend',
    messageId: data.id ?? `resend-${Date.now()}`,
  };
}

async function sendViaSmtp(input: SendEmailInput): Promise<SendEmailResult> {
  try {
    const transporter = getSmtpTransporter();
    const info = await transporter.sendMail({
      from: env.MAIL_FROM,
      to: input.to,
      replyTo: input.replyTo ?? env.MAIL_REPLY_TO,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return {
      deliveryMode: 'smtp',
      messageId: info.messageId || `smtp-${Date.now()}`,
    };
  } catch (error) {
    logger.error({ err: error }, 'SMTP email delivery failed');
    throw new AppError(
      502,
      'EMAIL_DELIVERY_FAILED',
      'Không thể kết nối máy chủ gửi mail lúc này. Vui lòng kiểm tra cấu hình SMTP hoặc thử lại sau.',
    );
  }
}

/**
 * Unified transactional email sender for @dongthapgo.com:
 * 1. Brevo Transactional HTTPS API when BREVO_API_KEY is configured.
 * 2. Resend HTTPS API when RESEND_API_KEY is configured.
 * 3. Nodemailer SMTP when SMTP_HOST + SMTP_USER + SMTP_PASS are configured (e.g. smtp-relay.brevo.com).
 * 4. Safe local HTML preview mode in development/test when no real mail transport is configured yet.
 */
export async function sendEmail(rawInput: SendEmailInput): Promise<SendEmailResult> {
  if (env.isTest) {
    return {
      deliveryMode: 'preview',
      messageId: `test-preview-${Date.now()}`,
    };
  }

  const input: SendEmailInput = {
    ...rawInput,
    to: stripHeaderCrlf(rawInput.to),
    subject: stripHeaderCrlf(rawInput.subject),
    ...(rawInput.replyTo ? { replyTo: stripHeaderCrlf(rawInput.replyTo) } : {}),
  };

  if (env.BREVO_API_KEY) {
    return sendViaBrevo(input);
  }

  if (env.RESEND_API_KEY) {
    return sendViaResend(input);
  }

  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    return sendViaSmtp(input);
  }

  if (env.isProduction) {
    logger.error('Production email attempted without RESEND_API_KEY or SMTP credentials configured');
    throw new AppError(
      503,
      'MAIL_NOT_CONFIGURED',
      'Hệ thống gửi email xác thực chưa được cấu hình máy chủ gửi thư (Resend/SMTP).',
    );
  }

  // Development/test preview fallback
  let previewPath: string | undefined;
  if (!env.isTest) {
    try {
      const tmpDir = path.resolve(process.cwd(), 'tmp');
      mkdirSync(tmpDir, { recursive: true });
      previewPath = path.join(tmpDir, 'last-otp-email.html');
      writeFileSync(previewPath, input.html, 'utf8');
    } catch {
      // Non-fatal in dev
    }
    logger.info(
      { to: input.to, subject: input.subject, previewPath },
      'Email OTP preview generated (configure RESEND_API_KEY or SMTP_* in server/.env to deliver real emails)',
    );
  }

  return {
    deliveryMode: 'preview',
    messageId: `preview-${Date.now()}`,
    previewPath,
  };
}
