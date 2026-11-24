import type { UserRole } from '../models/User.js';

declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      email: string;
      displayName: string;
      role: UserRole;
      preferences: {
        areas: string[];
        interests: string[];
        numberOfDays: number;
        hoursPerDay: number;
      };
    }
    interface AuthMeta {
      tokenVersion: number;
      issuedAtSec?: number;
      via: 'cookie' | 'bearer';
    }
    interface Request {
      user?: AuthUser;
      authMeta?: AuthMeta;
      anonymousSessionId?: string;
    }
  }
}

export {};
