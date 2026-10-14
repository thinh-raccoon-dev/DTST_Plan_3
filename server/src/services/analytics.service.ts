import type { Types } from 'mongoose';
import { AnalyticsEventModel, type EventType } from '../models/AnalyticsEvent.js';
import { logger } from '../utils/logger.js';
import type { Identity } from './identity.js';

export interface EventInput {
  eventType: EventType;
  destinationId?: Types.ObjectId;
  qrCodeId?: Types.ObjectId;
  qrCode?: string;
  challengeId?: Types.ObjectId;
  itineraryId?: Types.ObjectId;
  metadata?: Record<string, string | number | boolean>;
}

interface RecordOptions {
  /** Skip if the same identity produced the same event for the same target within this window. */
  dedupeWindowMs?: number;
}

/**
 * Records an analytics event on the server. Failures are logged and swallowed on purpose:
 * analytics must never block or roll back the user-facing action that triggered it.
 */
export async function recordEvent(input: EventInput, identity: Identity, options: RecordOptions = {}): Promise<boolean> {
  try {
    const actor = identity.userId ? { userId: identity.userId } : { anonymousSessionId: identity.anonymousSessionId };
    if (options.dedupeWindowMs) {
      const recent = await AnalyticsEventModel.exists({
        eventType: input.eventType,
        ...actor,
        ...(input.destinationId ? { destinationId: input.destinationId } : {}),
        ...(input.qrCodeId ? { qrCodeId: input.qrCodeId } : {}),
        timestamp: { $gte: new Date(Date.now() - options.dedupeWindowMs) },
      });
      if (recent) return false;
    }
    await AnalyticsEventModel.create({
      ...input,
      userId: identity.userId,
      anonymousSessionId: identity.anonymousSessionId,
      timestamp: new Date(),
    });
    return true;
  } catch (error) {
    logger.error({ err: error, eventType: input.eventType }, 'Failed to record analytics event');
    return false;
  }
}

export const PAGE_VIEW_DEDUPE_MS = 30 * 60_000;
export const QR_LANDING_DEDUPE_MS = 10 * 60_000;
