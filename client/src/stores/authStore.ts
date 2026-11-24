import axios from 'axios';
import { create } from 'zustand';
import {
  api,
  getCachedAuthUser,
  getStoredAuthToken,
  resetCsrfToken,
  setCachedAuthUser,
  setStoredAuthToken,
} from '../lib/api';
import type { AuthUser } from '../types/api';

export interface RegisterOtpResponse {
  sent: boolean;
  email: string;
  expiresInSeconds: number;
  resendCooldownSeconds: number;
  deliveryMode: 'brevo' | 'resend' | 'smtp' | 'preview';
  devPreviewCode?: string;
}

interface AuthSessionResponse {
  user: AuthUser;
  token?: string;
}

interface AuthState {
  user: AuthUser | null;
  status: 'unknown' | 'ready';
  loadSession: (options?: { silent?: boolean }) => Promise<void>;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: { email: string; password: string; displayName: string; otp?: string }) => Promise<AuthUser>;
  requestRegisterOtp: (input: { email: string; password: string; displayName: string }) => Promise<RegisterOtpResponse>;
  verifyRegisterOtp: (input: { email: string; password: string; displayName: string; otp: string }) => Promise<AuthUser>;
  updateProfile: (input: {
    displayName?: string;
    preferences?: AuthUser['preferences'];
    currentPassword?: string;
    newPassword?: string;
  }) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const initialCachedUser = getCachedAuthUser<AuthUser>();
let sessionLoadInFlight: Promise<void> | null = null;
let lastSessionVerifiedAt = 0;

function persistAuthSession(user: AuthUser | null, token?: string): void {
  if (user) {
    setCachedAuthUser(user);
    if (token) setStoredAuthToken(token);
  } else {
    setCachedAuthUser(null);
    setStoredAuthToken(null);
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Hydrate optimistically from local cache when a fallback token exists so mobile PWA launch never flashes logged-out
  user: initialCachedUser && getStoredAuthToken() ? initialCachedUser : null,
  status: 'unknown',
  loadSession: async (options) => {
    const now = Date.now();
    if (options?.silent && lastSessionVerifiedAt > 0 && now - lastSessionVerifiedAt < 30_000) {
      return;
    }
    if (sessionLoadInFlight) return sessionLoadInFlight;

    sessionLoadInFlight = (async () => {
      try {
        const res = await api.get<{ user: AuthUser | null; token?: string }>('/auth/me');
        lastSessionVerifiedAt = Date.now();
        if (res.data.user) {
          persistAuthSession(res.data.user, res.data.token);
          set({ user: res.data.user, status: 'ready' });
        } else {
          // Server explicitly confirmed the session is absent/expired/revoked
          persistAuthSession(null);
          set({ user: null, status: 'ready' });
        }
      } catch (err) {
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        if (status === 401 || status === 403) {
          persistAuthSession(null);
          set({ user: null, status: 'ready' });
          return;
        }
        // Transient network error, offline launch, or backend cold start:
        // NEVER wipe a valid cached mobile/PWA login session — keep it until server is reachable!
        const fallbackUser = get().user ?? (getStoredAuthToken() ? getCachedAuthUser<AuthUser>() : null);
        set({ user: fallbackUser, status: 'ready' });
      } finally {
        sessionLoadInFlight = null;
      }
    })();

    return sessionLoadInFlight;
  },
  login: async (email, password) => {
    const res = await api.post<AuthSessionResponse>('/auth/login', { email, password });
    lastSessionVerifiedAt = Date.now();
    persistAuthSession(res.data.user, res.data.token);
    set({ user: res.data.user, status: 'ready' });
    return res.data.user;
  },
  register: async (input) => {
    const res = await api.post<AuthSessionResponse>('/auth/register', input);
    lastSessionVerifiedAt = Date.now();
    persistAuthSession(res.data.user, res.data.token);
    set({ user: res.data.user, status: 'ready' });
    return res.data.user;
  },
  requestRegisterOtp: async (input) => {
    const res = await api.post<RegisterOtpResponse>('/auth/register/request-otp', input);
    return res.data;
  },
  verifyRegisterOtp: async (input) => {
    const res = await api.post<AuthSessionResponse>('/auth/register/verify-otp', input);
    lastSessionVerifiedAt = Date.now();
    persistAuthSession(res.data.user, res.data.token);
    set({ user: res.data.user, status: 'ready' });
    return res.data.user;
  },
  updateProfile: async (input) => {
    const res = await api.patch<AuthSessionResponse>('/auth/profile', input);
    persistAuthSession(res.data.user, res.data.token);
    set({ user: res.data.user, status: 'ready' });
    return res.data.user;
  },
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Even if offline, always clear local credentials cleanly
    } finally {
      lastSessionVerifiedAt = 0;
      persistAuthSession(null);
      resetCsrfToken();
      set({ user: null, status: 'ready' });
    }
  },
}));
