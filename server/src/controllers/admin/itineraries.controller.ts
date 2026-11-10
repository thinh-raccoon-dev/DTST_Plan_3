import type { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { ItineraryModel } from '../../models/Itinerary.js';
import { UserModel } from '../../models/User.js';
import { logAuditEvent } from '../../services/audit.service.js';
import { notFound } from '../../utils/errors.js';

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export async function listAdminItineraries(req: Request, res: Response) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const daysFilter = parseInt(String(req.query.days ?? '0'), 10) || 0;

  const filter: Record<string, unknown> = {};

  if (daysFilter > 0) {
    if (daysFilter >= 3) {
      filter.numberOfDays = { $gte: 3 };
    } else {
      filter.numberOfDays = daysFilter;
    }
  }

  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    // Also search users matching name or email
    const matchedUsers = await UserModel.find({
      $or: [{ email: rx }, { displayName: rx }],
    })
      .select('_id')
      .lean();
    const matchedUserIds = matchedUsers.map((u) => u._id);

    filter.$or = [{ title: rx }, { userId: { $in: matchedUserIds } }];
  }

  const [total, itineraries, totalItineraries, oneDayCount, twoDayCount, multiDayCount] = await Promise.all([
    ItineraryModel.countDocuments(filter),
    ItineraryModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'email displayName role')
      .lean(),
    ItineraryModel.countDocuments(),
    ItineraryModel.countDocuments({ numberOfDays: 1 }),
    ItineraryModel.countDocuments({ numberOfDays: 2 }),
    ItineraryModel.countDocuments({ numberOfDays: { $gte: 3 } }),
  ]);

  const items = itineraries.map((it) => {
    const user = it.userId as { _id?: unknown; email?: string; displayName?: string; role?: string } | null;
    const totalStops = it.days?.reduce((sum, d) => sum + (d.items?.length ?? 0), 0) ?? 0;
    const destinationNames = it.days?.flatMap((d) => d.items?.map((item) => item.nameSnapshot) ?? []) ?? [];

    return {
      id: String(it._id),
      title: it.title,
      numberOfDays: it.numberOfDays,
      totalStops,
      estimatedDurationMinutes: it.estimatedDurationMinutes,
      preferences: it.preferences,
      plannerVersion: it.plannerVersion,
      itineraryVersion: it.itineraryVersion,
      user: user
        ? {
            id: String(user._id ?? ''),
            email: user.email ?? 'Ẩn danh',
            displayName: user.displayName ?? 'Ẩn danh',
            role: user.role ?? 'tourist',
          }
        : null,
      destinationNames: destinationNames.slice(0, 5),
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
    };
  });

  res.json({
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    stats: {
      totalItineraries,
      oneDayCount,
      twoDayCount,
      multiDayCount,
    },
  });
}

export async function getAdminItinerary(req: Request, res: Response) {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw notFound('Không tìm thấy lịch trình.');

  const itinerary = await ItineraryModel.findById(id)
    .populate('userId', 'email displayName role')
    .populate('days.items.destinationId', 'name slug category area image coordinates address')
    .lean();

  if (!itinerary) throw notFound('Không tìm thấy lịch trình.');

  res.json({
    itinerary: {
      id: String(itinerary._id),
      title: itinerary.title,
      numberOfDays: itinerary.numberOfDays,
      days: itinerary.days,
      preferences: itinerary.preferences,
      estimatedDurationMinutes: itinerary.estimatedDurationMinutes,
      plannerVersion: itinerary.plannerVersion,
      v9Itinerary: itinerary.v9Itinerary,
      v9Meta: itinerary.v9Meta,
      replanHistory: itinerary.replanHistory,
      user: itinerary.userId,
      createdAt: itinerary.createdAt,
      updatedAt: itinerary.updatedAt,
    },
  });
}

export async function deleteAdminItinerary(req: Request, res: Response) {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw notFound('Không tìm thấy lịch trình.');

  const itinerary = await ItineraryModel.findByIdAndDelete(id);
  if (!itinerary) throw notFound('Không tìm thấy lịch trình.');

  await logAuditEvent({
    req,
    action: 'itinerary.delete',
    targetType: 'itinerary',
    targetId: itinerary._id,
    targetName: itinerary.title,
    details: { numberOfDays: itinerary.numberOfDays, userId: String(itinerary.userId) },
  });

  res.status(204).end();
}
