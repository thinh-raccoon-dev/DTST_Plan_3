/**
 * CLI script to preview or send a real OTP verification email via @dongthapgo.com.
 * Usage:
 *   npx tsx src/scripts/send-test-otp-email.ts thinh.raccoon@gmail.com
 */
import crypto from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { sendEmail } from '../services/email.service.js';
import { renderRegisterOtpEmail } from '../services/emailTemplates.js';

async function main() {
  const targetEmail = process.argv[2]?.trim() || 'thinh.raccoon@gmail.com';
  const sampleCode = String(crypto.randomInt(100000, 1000000));
  const rendered = renderRegisterOtpEmail({
    displayName: 'Thịnh',
    email: targetEmail,
    otpCode: sampleCode,
    expiresMinutes: 5,
    appUrl: 'https://dongthapgo.com',
  });

  // Always save an inspectable HTML copy if requested via --out <path>
  const outFlagIdx = process.argv.indexOf('--out');
  if (outFlagIdx !== -1 && process.argv[outFlagIdx + 1]) {
    const outPath = path.resolve(process.argv[outFlagIdx + 1]!);
    writeFileSync(outPath, rendered.html, 'utf8');
    console.log(`Saved HTML email preview to: ${outPath}`);
  }

  const activeTransport = env.BREVO_API_KEY
    ? 'Brevo HTTPS API'
    : env.RESEND_API_KEY
      ? 'Resend API'
      : env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS
        ? `SMTP (${env.SMTP_HOST})`
        : 'PREVIEW ONLY (no BREVO_API_KEY, RESEND_API_KEY, or SMTP_* in server/.env)';
  console.log(`Mail transport configured: ${activeTransport}`);
  console.log(`From: ${env.MAIL_FROM}`);
  console.log(`To:   ${targetEmail}`);
  console.log(`OTP:  ${sampleCode}`);

  const result = await sendEmail({
    to: targetEmail,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });

  console.log('Result:', JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('Failed to send test OTP email:', err);
  process.exit(1);
});
