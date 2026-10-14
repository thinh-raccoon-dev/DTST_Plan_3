import { ChallengeModel } from '../models/Challenge.js';
import { DestinationModel } from '../models/Destination.js';
import { QrCodeModel, type QrCode } from '../models/QrCode.js';
import type { Types } from 'mongoose';
import { AppError, notFound } from '../utils/errors.js';
import type { LeanChallenge } from './challenge.service.js';
import { PUBLIC_DESTINATION_FILTER, type LeanDestination } from './destination.service.js';
import { env } from '../config/env.js';

export type LeanQrCode = QrCode & { _id: Types.ObjectId; createdAt?: Date; updatedAt?: Date };

export function qrPublicUrl(code: string): string {
  return `${env.publicAppUrl}/qr/${encodeURIComponent(code)}`;
}

/**
 * Maps a printed code to its current target. The code is stable; the target can be changed by
 * admins without reprinting. Only supported internal content types are allowed (no open redirect).
 */
export async function resolveQr(code: string): Promise<{
  qr: LeanQrCode;
  destination: LeanDestination;
  featuredChallenge: LeanChallenge | null;
}> {
  const qr = await QrCodeModel.findOne({ code }).lean<LeanQrCode>();
  if (!qr) throw notFound('Mã QR không tồn tại.', 'QR_NOT_FOUND');
  if (qr.status !== 'active') throw new AppError(410, 'QR_INACTIVE', 'Mã QR này hiện đã ngừng hoạt động.');

  let destinationId = qr.targetId;
  let featuredChallenge: LeanChallenge | null = null;
  if (qr.targetType === 'challenge') {
    const challenge = await ChallengeModel.findById(qr.targetId).lean<LeanChallenge>();
    if (!challenge) throw new AppError(410, 'QR_TARGET_UNAVAILABLE', 'Nội dung của mã QR này hiện không khả dụng.');
    destinationId = challenge.destinationId;
    featuredChallenge = challenge.status === 'active' ? challenge : null;
  }

  const destination = await DestinationModel.findOne({ _id: destinationId, ...PUBLIC_DESTINATION_FILTER }).lean<LeanDestination>();
  if (!destination) throw new AppError(410, 'QR_TARGET_UNAVAILABLE', 'Nội dung của mã QR này hiện không khả dụng.');
  return { qr, destination, featuredChallenge };
}
/** Destination a QR code currently points at, for admin listings (no publication checks). */
export async function qrDestinationId(qr: Pick<LeanQrCode, 'targetType' | 'targetId'>): Promise<Types.ObjectId | null> {
  if (qr.targetType === 'destination') return qr.targetId;
  const challenge = await ChallengeModel.findById(qr.targetId).select('destinationId').lean();
  return challenge?.destinationId ?? null;
}

