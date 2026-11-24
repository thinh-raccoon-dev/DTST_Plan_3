export interface CopilotAuthHandoff {
  mode: 'login' | 'register';
  email: string;
  password: string;
  displayName?: string;
  runId: string;
  expiresAt: number;
}

const HANDOFF_TTL_MS = 15_000;
let pendingHandoff: CopilotAuthHandoff | null = null;

/**
 * Stages a one-time, short-lived credential handoff in volatile JS memory only.
 * Never touches URL query strings, browser history, localStorage, or sessionStorage.
 */
export function stageCopilotAuthHandoff(input: {
  mode: 'login' | 'register';
  email: string;
  password: string;
  displayName?: string;
}): void {
  pendingHandoff = {
    ...input,
    runId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    expiresAt: Date.now() + HANDOFF_TTL_MS,
  };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pe-meko:auth-handoff'));
  }
}

export function hasPendingCopilotAuth(mode?: 'login' | 'register'): boolean {
  if (!pendingHandoff) return false;
  if (Date.now() > pendingHandoff.expiresAt) {
    pendingHandoff = null;
    return false;
  }
  return mode ? pendingHandoff.mode === mode : true;
}

export function consumeCopilotAuthHandoff(mode: 'login' | 'register'): CopilotAuthHandoff | null {
  if (!pendingHandoff) return null;
  if (Date.now() > pendingHandoff.expiresAt) {
    pendingHandoff = null;
    return null;
  }
  if (pendingHandoff.mode !== mode) return null;
  const captured = pendingHandoff;
  pendingHandoff = null;
  return captured;
}
