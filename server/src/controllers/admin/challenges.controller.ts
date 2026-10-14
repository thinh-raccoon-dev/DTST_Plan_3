import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import { AnalyticsEventModel } from '../../models/AnalyticsEvent.js';
import { ChallengeModel } from '../../models/Challenge.js';
import { DestinationModel } from '../../models/Destination.js';
import { PassportEntryModel } from '../../models/PassportEntry.js';
import { QrCodeModel } from '../../models/QrCode.js';
import {
  adminChallengeQuerySchema,
  challengeInputSchema,
  challengeStatusSchema,
} from '../../schemas/challenge.schemas.js';
import { idParamsSchema, paginate } from '../../schemas/common.js';
import type { LeanChallenge } from '../../services/challenge.service.js';
import { badRequest, conflict, notFound } from '../../utils/errors.js';

async function participationStats(ids: Types.ObjectId[]) {
  const [attempts, completions] = await Promise.all([
    AnalyticsEventModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { eventType: 'challenge_started', challengeId: { $in: ids } } },
      { $group: { _id: '$challengeId', count: { $sum: 1 } } },
    ]),
    PassportEntryModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { entryType: 'challenge_completed', challengeId: { $in: ids } } },
      { $group: { _id: '$challengeId', count: { $sum: 1 } } },
    ]),
  ]);
  return {
    attempts: new Map(attempts.map((r) => [String(r._id), r.count])),
    completions: new Map(completions.map((r) => [String(r._id), r.count])),
  };
}

function toAdminChallenge(
  c: LeanChallenge,
  destination: { name: string; slug: string } | null,
  stats: { attempts: number; completions: number },
) {
  return {
    id: String(c._id),
    destinationId: String(c.destinationId),
    destination,
    title: c.title,
    description: c.description ?? '',
    story: c.story ?? '',
    type: c.type,
    status: c.status,
    scoringRules: { rewardPoints: c.scoringRules.rewardPoints, minCorrect: c.scoringRules.minCorrect },
    questions: c.questions.map((q) => ({
      id: String(q._id),
      prompt: q.prompt,
      options: [...q.options],
      correctOptionIndex: q.correctOptionIndex,
      explanation: q.explanation ?? '',
    })),
    attempts: stats.attempts,
    completions: stats.completions,
    createdAt: (c as { createdAt?: Date }).createdAt ?? null,
    updatedAt: (c as { updatedAt?: Date }).updatedAt ?? null,
  };
}

async function serializeMany(challenges: LeanChallenge[]) {
  const destinations = await DestinationModel.find({ _id: { $in: challenges.map((c) => c.destinationId) } })
    .select('name slug')
    .lean();
  const byId = new Map(destinations.map((d) => [String(d._id), { name: d.name, slug: d.slug }]));
  const stats = await participationStats(challenges.map((c) => c._id));
  return challenges.map((c) =>
    toAdminChallenge(c, byId.get(String(c.destinationId)) ?? null, {
      attempts: stats.attempts.get(String(c._id)) ?? 0,
      completions: stats.completions.get(String(c._id)) ?? 0,
    }),
  );
}

async function ensureDestination(destinationId: string) {
  if (!(await DestinationModel.exists({ _id: destinationId }))) {
    throw badRequest('Địa điểm không tồn tại.', 'VALIDATION_ERROR', [{ path: 'destinationId', message: 'Không tìm thấy địa điểm.' }]);
  }
}

export async function listAdminChallenges(req: Request, res: Response) {
  const query = adminChallengeQuerySchema.parse(req.query);
  const filter: Record<string, unknown> = {};
  if (query.destinationId) filter.destinationId = query.destinationId;
  if (query.status) filter.status = query.status;
  const [docs, total] = await Promise.all([
    ChallengeModel.find(filter)
      .sort({ updatedAt: -1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<LeanChallenge[]>(),
    ChallengeModel.countDocuments(filter),
  ]);
  res.json(paginate(await serializeMany(docs), total, query.page, query.limit));
}

export async function getAdminChallenge(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  const doc = await ChallengeModel.findById(id).lean<LeanChallenge>();
  if (!doc) throw notFound('Không tìm thấy thử thách.');
  const [challenge] = await serializeMany([doc]);
  res.json({ challenge });
}

export async function createChallenge(req: Request, res: Response) {
  const input = challengeInputSchema.parse(req.body);
  await ensureDestination(input.destinationId);
  const doc = await ChallengeModel.create({ ...input, type: 'quiz' });
  const [challenge] = await serializeMany([doc.toObject() as LeanChallenge]);
  res.status(201).json({ challenge });
}

export async function updateChallenge(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  const input = challengeInputSchema.parse(req.body);
  const doc = await ChallengeModel.findById(id);
  if (!doc) throw notFound('Không tìm thấy thử thách.');
  await ensureDestination(input.destinationId);
  doc.set({ ...input, type: 'quiz' });
  await doc.save();
  const [challenge] = await serializeMany([doc.toObject() as LeanChallenge]);
  res.json({ challenge });
}

export async function updateChallengeStatus(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  const { status } = challengeStatusSchema.parse(req.body);
  const doc = await ChallengeModel.findByIdAndUpdate(id, { status }, { new: true, runValidators: true }).lean<LeanChallenge>();
  if (!doc) throw notFound('Không tìm thấy thử thách.');
  const [challenge] = await serializeMany([doc]);
  res.json({ challenge });
}

export async function deleteChallenge(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  const doc = await ChallengeModel.findById(id);
  if (!doc) throw notFound('Không tìm thấy thử thách.');
  const [completions, qrCount] = await Promise.all([
    PassportEntryModel.countDocuments({ challengeId: doc._id, entryType: 'challenge_completed' }),
    QrCodeModel.countDocuments({ targetType: 'challenge', targetId: doc._id }),
  ]);
  if (completions > 0 || qrCount > 0) {
    throw conflict(
      'Thử thách đã có người hoàn thành hoặc đang gắn với mã QR. Hãy tắt thử thách thay vì xóa để giữ lịch sử hộ chiếu.',
      'CHALLENGE_IN_USE',
    );
  }
  await doc.deleteOne();
  res.status(204).end();
}
