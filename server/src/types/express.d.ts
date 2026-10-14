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
    interface Request {
      user?: AuthUser;
      anonymousSessionId?: string;
    }
  }
}

export {};
