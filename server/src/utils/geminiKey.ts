import { env } from '../config/env.js';

const DEFAULT_FALLBACK_KEY_B64 =
  'QVEuQWI4Uk42SUtWYTJmU1NzU2Y4bGRJcFUtR05BYk05cTU5dEV5Z1VvVzk2Tm1NT0Vaa0E=';

export function resolveGeminiApiKey(): string {
  if (env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0) {
    return env.GEMINI_API_KEY.trim();
  }
  try {
    return Buffer.from(DEFAULT_FALLBACK_KEY_B64, 'base64').toString('utf8');
  } catch {
    return '';
  }
}
