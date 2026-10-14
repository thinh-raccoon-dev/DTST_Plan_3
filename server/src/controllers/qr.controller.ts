import type { Request, Response } from 'express';
import { ChallengeModel } from '../models/Challenge.js';
import { DestinationModel } from '../models/Destination.js';
import { completeChallengeSchema } from '../schemas/challenge.schemas.js';
import { idParamsSchema } from '../schemas/common.js';
import { checkInBodySchema, qrCodeParamSchema } from '../schemas/qr.schemas.js';
import { QR_LANDING_DEDUPE_MS, recordEvent } from '../services/analytics.service.js';
import { gradeAnswers, toPublicChallenge, type LeanChallenge } from '../services/challenge.service.js';
import { PUBLIC_DESTINATION_FILTER, toDestinationDetail } from '../services/destination.service.js';
import { identityFromRequest } from '../services/identity.js';
import { checkIn, getDestinationProgress, recordChallengeCompletion } from '../services/passport.service.js';
import { resolveQr } from '../services/qr.service.js';
import { AppError, notFound } from '../utils/errors.js';
import { haversineMeters, MAX_CHECKIN_METERS } from '../utils/geo.js';

/** Read-only: viewing the QR content never records a scan (admins can preview safely). */
export async function getQrContent(req: Request, res: Response) {
  const { code } = qrCodeParamSchema.parse(req.params);
  const { qr, destination, featuredChallenge } = await resolveQr(code);

  const challenges = await ChallengeModel.find({ destinationId: destination._id, status: 'active' })
    .sort({ createdAt: 1 })
    .lean<LeanChallenge[]>();
  if (featuredChallenge) {
    challenges.sort((a, b) => Number(String(b._id) === String(featuredChallenge._id)) - Number(String(a._id) === String(featuredChallenge._id)));
  }

  res.set('Cache-Control', 'no-store');
  res.json({
    qr: { code: qr.code, label: qr.label, targetType: qr.targetType },
    destination: toDestinationDetail(destination),
    challenges: challenges.map(toPublicChallenge),
    featuredChallengeId: featuredChallenge ? String(featuredChallenge._id) : null,
    progress: await getDestinationProgress(identityFromRequest(req), destination._id),
  });
}

/** qr_landing_view: the QR landing page was opened (not proof of physical presence). */
export async function recordQrScan(req: Request, res: Response) {
  const { code } = qrCodeParamSchema.parse(req.params);
  const { qr, destination, featuredChallenge } = await resolveQr(code);
  const recorded = await recordEvent(
    {
      eventType: 'qr_landing_view',
      qrCodeId: qr._id,
      qrCode: qr.code,
      destinationId: destination._id,
      challengeId: featuredChallenge?._id,
    },
    identityFromRequest(req),
    { dedupeWindowMs: QR_LANDING_DEDUPE_MS },
  );
  res.status(202).json({ recorded });
}

function verifyCheckInLocation(
  destination: { coordinates?: { lat: number; lng: number } | null },
  body: { lat?: number; lng?: number },
): boolean {
  const coords = destination.coordinates;
  if (!coords) return false;
  if (body.lat === undefined || body.lng === undefined) {
    throw new AppError(
      400,
      'LOCATION_REQUIRED',
      `Điểm đến này yêu cầu vị trí GPS để check-in. Hãy cho phép trình duyệt truy cập vị trí và đứng trong phạm vi ${MAX_CHECKIN_METERS} m.`,
    );
  }
  const meters = haversineMeters({ lat: body.lat, lng: body.lng }, { lat: coords.lat, lng: coords.lng });
  if (meters > MAX_CHECKIN_METERS) {
    throw new AppError(
      403,
      'LOCATION_TOO_FAR',
      `Bạn đang cách điểm đến khoảng ${Math.round(meters)} m. Hãy check-in khi ở gần hơn ${MAX_CHECKIN_METERS} m.`,
    );
  }
  return true;
}

/** Check-in at the QR point. GPS is required only when the destination has coordinates. Location is never stored. */
export async function checkInAtQr(req: Request, res: Response) {
  const { code } = qrCodeParamSchema.parse(req.params);
  const body = checkInBodySchema.parse(req.body ?? {});
  const { qr, destination } = await resolveQr(code);
  const locationVerified = verifyCheckInLocation(destination, body);
  const result = await checkIn(identityFromRequest(req), destination._id, qr._id);
  res.status(result.created ? 201 : 200).json({ ...result, locationVerified });
}

async function findPlayableChallenge(id: string) {
  const challenge = await ChallengeModel.findOne({ _id: id, status: 'active' }).lean<LeanChallenge>();
  if (!challenge) throw notFound('Thử thách không tồn tại hoặc đã ngừng hoạt động.', 'CHALLENGE_NOT_FOUND');
  const destination = await DestinationModel.exists({ _id: challenge.destinationId, ...PUBLIC_DESTINATION_FILTER });
  if (!destination) throw notFound('Thử thách không tồn tại hoặc đã ngừng hoạt động.', 'CHALLENGE_NOT_FOUND');
  return challenge;
}

export async function getChallenge(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  const challenge = await findPlayableChallenge(id);
  res.json({ challenge: toPublicChallenge(challenge) });
}

/**
 * Grades on the server, then rewards at most once (unique index). Requires an active QR code
 * that belongs to the same destination, so the quiz is tied to the on-site QR experience.
 */
export async function completeChallenge(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  const input = completeChallengeSchema.parse(req.body);
  const challenge = await findPlayableChallenge(id);
  const { qr, destination } = await resolveQr(input.qrCode);
  if (String(destination._id) !== String(challenge.destinationId)) {
    throw new AppError(400, 'QR_CHALLENGE_MISMATCH', 'Mã QR không thuộc điểm đến của thử thách này.');
  }

  const grade = gradeAnswers(challenge, input.answers);
  const identity = identityFromRequest(req);
  await recordEvent(
    {
      eventType: 'challenge_started',
      challengeId: challenge._id,
      destinationId: destination._id,
      qrCodeId: qr._id,
      metadata: { correctCount: grade.correctCount, totalQuestions: grade.totalQuestions, passed: grade.passed },
    },
    identity,
  );

  let reward = { alreadyCompleted: false, pointsAwarded: 0, newBadges: [] as Array<{ key: string; name: string; description: string; icon: string }> };
  if (grade.passed) {
    reward = await recordChallengeCompletion(identity, {
      challengeId: challenge._id,
      destinationId: destination._id,
      qrCodeId: qr._id,
      rewardPoints: challenge.scoringRules.rewardPoints,
      correctCount: grade.correctCount,
      totalQuestions: grade.totalQuestions,
    });
  }

  res.json({
    ...grade,
    minCorrect: challenge.scoringRules.minCorrect,
    ...reward,
    savedTo: req.user ? 'account' : 'device',
  });
}
