import type { Request } from 'express';
import { Types } from 'mongoose';

/** Who performs an action: a signed-in account, or else this browser's anonymous session. */
export interface Identity {
  userId?: Types.ObjectId;
  anonymousSessionId?: string;
}

export function identityFromRequest(req: Request): Identity {
  return {
    userId: req.user ? new Types.ObjectId(req.user.id) : undefined,
    anonymousSessionId: req.anonymousSessionId,
  };
}

/** Filter selecting records owned by this identity (accounts take precedence over the device). */
export function ownerFilter(identity: Identity): { userId: Types.ObjectId } | { anonymousSessionId: string } {
  if (identity.userId) return { userId: identity.userId };
  if (identity.anonymousSessionId) return { anonymousSessionId: identity.anonymousSessionId };
  throw new Error('Request has neither a user nor an anonymous session');
}

export function ownerFields(identity: Identity) {
  return identity.userId ? { userId: identity.userId } : { anonymousSessionId: identity.anonymousSessionId };
}
