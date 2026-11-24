import { create } from 'zustand';
import { api } from '../lib/api';
import type { AuthUser } from '../types/api';

export interface RegisterOtpResponse {
  sent: boolean;
  email: string;
  expiresInSeconds: number;
  resendCooldownSeconds: number;
  deliveryMode: 'brevo' | 'resend' | 'smtp' | 'preview';
  devPreviewCode?: string;
}

interface AuthState {
  user: AuthUser | null;
  status: 'unknown' | 'ready';
  loadSession: () => Promise<void>;
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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'unknown',
  loadSession: async () => {
    try {
      const res = await api.get<{ user: AuthUser | null }>('/auth/me');
      set({ user: res.data.user, status: 'ready' });
    } catch {
      // Network failure: treat as signed out; protected screens will ask to sign in.
      set({ user: null, status: 'ready' });
    }
  },
  login: async (email, password) => {
    const res = await api.post<{ user: AuthUser }>('/auth/login', { email, password });
    set({ user: res.data.user, status: 'ready' });
    return res.data.user;
  },
  register: async (input) => {
    const res = await api.post<{ user: AuthUser }>('/auth/register', input);
    set({ user: res.data.user, status: 'ready' });
    return res.data.user;
  },
  requestRegisterOtp: async (input) => {
    const res = await api.post<RegisterOtpResponse>('/auth/register/request-otp', input);
    return res.data;
  },
  verifyRegisterOtp: async (input) => {
    const res = await api.post<{ user: AuthUser }>('/auth/register/verify-otp', input);
    set({ user: res.data.user, status: 'ready' });
    return res.data.user;
  },
  updateProfile: async (input) => {
    const res = await api.patch<{ user: AuthUser }>('/auth/profile', input);
    set({ user: res.data.user, status: 'ready' });
    return res.data.user;
  },
  logout: async () => {
    await api.post('/auth/logout');
    set({ user: null, status: 'ready' });
  },
}));
