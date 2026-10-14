import { Types } from 'mongoose';
import type { VerificationLevel } from '../config/catalog.js';
import { ChallengeModel } from '../models/Challenge.js';
import { DestinationModel, type Destination } from '../models/Destination.js';
import { QrCodeModel } from '../models/QrCode.js';

export type LeanDestination = Destination & { _id: Types.ObjectId };

export const PUBLIC_DESTINATION_FILTER = { publicationStatus: 'published' } as const;

function cleanObject<T extends Record<string, unknown>>(value: T | null | undefined): T | null {
  if (!value) return null;
  const entries = Object.entries(value).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? (Object.fromEntries(entries) as T) : null;
}

export function toDestinationSummary(d: LeanDestination, extra: { hasChallenge?: boolean } = {}) {
  const firstImage = d.images?.[0];
  return {
    id: String(d._id),
    slug: d.slug,
    name: d.name,
    summary: d.summary ?? '',
    category: d.category,
    area: d.area,
    tags: d.tags ?? [],
    image: firstImage ? { url: firstImage.url, alt: firstImage.alt ?? d.name } : null,
    isIllustrative: Boolean(d.isIllustrative),
    verificationStatus: d.verificationStatus,
    operationalStatus: d.operationalStatus,
    estimatedVisitDuration: d.estimatedVisitDuration
      ? { minutes: d.estimatedVisitDuration.minutes, isEstimate: d.estimatedVisitDuration.isEstimate ?? true }
      : null,
    hasCoordinates: Boolean(d.coordinates),
    hasChallenge: Boolean(extra.hasChallenge),
  };
}

export function toDestinationDetail(d: LeanDestination) {
  return {
    ...toDestinationSummary(d),
    description: d.description,
    address: d.address ?? null,
    coordinates: d.coordinates ? { lat: d.coordinates.lat, lng: d.coordinates.lng } : null,
    images: (d.images ?? []).map((image) => ({
      url: image.url,
      alt: image.alt || d.name,
      credit: image.credit ?? null,
      license: image.license ?? null,
      sourceUrl: image.sourceUrl || null,
    })),
    openingHours: d.openingHours ?? null,
    referencePrice: d.referencePrice ?? null,
    contactInfo: cleanObject(d.contactInfo ?? null),
    estimatedVisitDuration: d.estimatedVisitDuration
      ? {
          minutes: d.estimatedVisitDuration.minutes,
          isEstimate: d.estimatedVisitDuration.isEstimate ?? true,
          note: d.estimatedVisitDuration.note ?? null,
        }
      : null,
    sourceUrls: d.sourceUrls ?? [],
    verification: {
      location: d.verification?.location ?? 'unknown',
      openingHours: d.verification?.openingHours ?? 'unknown',
      referencePrice: d.verification?.referencePrice ?? 'unknown',
      contactInfo: d.verification?.contactInfo ?? 'unknown',
    },
    lastVerifiedAt: d.lastVerifiedAt ?? null,
    updatedAt: (d as { updatedAt?: Date }).updatedAt ?? null,
  };
}

export function toAdminDestination(d: LeanDestination) {
  const manager = d.managedBy as unknown;
  const populated =
    manager && typeof manager === 'object' && '_id' in (manager as object)
      ? (manager as { _id: Types.ObjectId; email?: string; displayName?: string })
      : null;
  return {
    ...toDestinationDetail(d),
    publicationStatus: d.publicationStatus,
    createdAt: (d as { createdAt?: Date }).createdAt ?? null,
    managedById: populated ? String(populated._id) : d.managedBy ? String(d.managedBy) : null,
    managedByEmail: populated?.email ?? null,
    managedByName: populated?.displayName ?? null,
  };
}

interface VerifiableFields {
  address?: string | null;
  coordinates?: unknown;
  openingHours?: string | null;
  referencePrice?: string | null;
  contactInfo?: Record<string, unknown> | null;
  verification: Record<'location' | 'openingHours' | 'referencePrice' | 'contactInfo', VerificationLevel>;
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'object') return Object.values(value).some(hasValue);
  return true;
}

/**
 * The overall badge is derived, never entered: a field only counts as verified when it has data
 * AND an admin marked that group as verified.
 */
export function computeVerificationStatus(fields: VerifiableFields): 'verified' | 'partially_verified' | 'unverified' {
  const groups: Array<[VerificationLevel, boolean]> = [
    [fields.verification.location, hasValue(fields.address) || hasValue(fields.coordinates)],
    [fields.verification.openingHours, hasValue(fields.openingHours)],
    [fields.verification.referencePrice, hasValue(fields.referencePrice)],
    [fields.verification.contactInfo, hasValue(fields.contactInfo)],
  ];
  const present = groups.filter(([, has]) => has);
  const verified = present.filter(([level]) => level === 'verified');
  if (present.length > 0 && verified.length === present.length) return 'verified';
  if (verified.length > 0) return 'partially_verified';
  return 'unverified';
}

/** Validation errors for "verified" claims that have nothing to back them. */
export function verificationIssues(fields: VerifiableFields & { sourceUrls: string[]; lastVerifiedAt?: Date | null }) {
  const issues: Array<{ path: string; message: string }> = [];
  const checks: Array<[keyof VerifiableFields['verification'], boolean, string]> = [
    ['location', hasValue(fields.address) || hasValue(fields.coordinates), 'địa chỉ/tọa độ'],
    ['openingHours', hasValue(fields.openingHours), 'giờ hoạt động'],
    ['referencePrice', hasValue(fields.referencePrice), 'giá tham khảo'],
    ['contactInfo', hasValue(fields.contactInfo), 'thông tin liên hệ'],
  ];
  for (const [key, present, label] of checks) {
    if (fields.verification[key] === 'verified' && !present) {
      issues.push({ path: `verification.${key}`, message: `Không thể đánh dấu "đã xác minh" khi chưa có ${label}.` });
    }
  }
  const anyVerified = Object.values(fields.verification).includes('verified');
  if (anyVerified && fields.sourceUrls.length === 0) {
    issues.push({ path: 'sourceUrls', message: 'Cần ít nhất một nguồn khi đánh dấu thông tin đã xác minh.' });
  }
  if (anyVerified && !fields.lastVerifiedAt) {
    issues.push({ path: 'lastVerifiedAt', message: 'Cần ngày xác minh khi đánh dấu thông tin đã xác minh.' });
  }
  return issues;
}

/** Destination ids reachable through an active QR code (directly or via an active challenge). */
export async function getActiveQrDestinationIds(): Promise<Set<string>> {
  const qrCodes = await QrCodeModel.find({ status: 'active' }).select('targetType targetId').lean();
  const ids = new Set<string>();
  const challengeIds: Types.ObjectId[] = [];
  for (const qr of qrCodes) {
    if (qr.targetType === 'destination') ids.add(String(qr.targetId));
    else challengeIds.push(qr.targetId);
  }
  if (challengeIds.length) {
    const challenges = await ChallengeModel.find({ _id: { $in: challengeIds } }).select('destinationId').lean();
    for (const challenge of challenges) ids.add(String(challenge.destinationId));
  }
  return ids;
}

export async function getDestinationIdsWithActiveChallenges(): Promise<Set<string>> {
  const ids: Types.ObjectId[] = await ChallengeModel.distinct('destinationId', { status: 'active' });
  return new Set(ids.map(String));
}

export async function findPublishedDestinationBySlug(slug: string) {
  return DestinationModel.findOne({ slug, ...PUBLIC_DESTINATION_FILTER }).lean<LeanDestination>();
}
