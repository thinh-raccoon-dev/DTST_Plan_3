import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { DestinationModel } from '../models/Destination.js';
import {
  SAFETY_ALERT_TYPES,
  SAFETY_SEVERITIES,
  SafetyAlertModel,
  TERRAIN_IMPACTS,
} from '../models/SafetyAlert.js';
import { logAuditEvent } from '../services/audit.service.js';
import { assessItinerarySafety } from '../services/safetyGuardian.service.js';
import { logger } from '../utils/logger.js';

const checkItinerarySchema = z.object({
  days: z
    .array(
      z.object({
        day: z.coerce.number().int().min(1).max(14),
        date: z.string().optional(),
        activities: z.array(
          z
            .object({
              stop_id: z.string().optional(),
              type: z.string(),
              name: z.string(),
              place_id: z.string().optional(),
              latitude: z.number().optional(),
              longitude: z.number().optional(),
              start: z.string().optional(),
              end: z.string().optional(),
            })
            .passthrough(),
        ),
      }),
    )
    .min(1)
    .max(14),
  simulatePreset: z
    .enum(['heavy_storm', 'route_accident', 'mountain_landslide'])
    .nullable()
    .optional(),
});

const createAlertSchema = z.object({
  type: z.enum(SAFETY_ALERT_TYPES),
  severity: z.enum(SAFETY_SEVERITIES).default('warning'),
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().min(10).max(800),
  areaLabel: z.string().trim().max(120).optional(),
  coordinates: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  radiusKm: z.coerce.number().min(0.5).max(150).default(8),
  terrainImpact: z.enum(TERRAIN_IMPACTS).default('outdoor'),
  hoursValid: z.coerce.number().min(1).max(168).default(24),
  destinationId: z.string().optional(),
});

export async function checkItinerarySafetyHandler(req: Request, res: Response): Promise<void> {
  const parsed = checkItinerarySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Dữ liệu lịch trình kiểm tra an toàn không hợp lệ', details: parsed.error.issues },
    });
    return;
  }

  try {
    const report = await assessItinerarySafety({
      days: parsed.data.days,
      simulatePreset: parsed.data.simulatePreset ?? null,
    });
    res.json({ success: true, report });
  } catch (error) {
    logger.error({ err: error }, 'Failed to assess itinerary safety');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Không thể kiểm tra thời tiết và sự cố lúc này.' },
    });
  }
}

export async function listActiveAlertsHandler(_req: Request, res: Response): Promise<void> {
  const now = new Date();
  const alerts = await SafetyAlertModel.find({
    isActive: true,
    $or: [{ expiresAt: { $gt: now } }, { expiresAt: null }],
  })
    .sort({ severity: -1, createdAt: -1 })
    .limit(50)
    .lean();

  res.set('Cache-Control', 'no-store');
  res.json({ success: true, items: alerts });
}

export async function createSafetyAlertHandler(req: Request, res: Response): Promise<void> {
  const parsed = createAlertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Thông tin cảnh báo không hợp lệ', details: parsed.error.issues },
    });
    return;
  }

  const isPartner = req.user?.role === 'partner';
  const { hoursValid, destinationId, ...data } = parsed.data;
  let resolvedDestinationId: Types.ObjectId | undefined;

  if (isPartner) {
    const userObjectId = new Types.ObjectId(req.user!.id);
    const filter: Record<string, unknown> = { managedBy: { $in: [req.user!.id, userObjectId] } };
    if (destinationId) {
      if (!Types.ObjectId.isValid(destinationId)) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Mã địa điểm không hợp lệ.' } });
        return;
      }
      filter._id = new Types.ObjectId(destinationId);
    }
    const ownedDest = await DestinationModel.findOne(filter).select('_id name').lean();
    if (!ownedDest) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Đối tác chỉ được đăng cảnh báo cho địa điểm thuộc quyền quản lý.' },
      });
      return;
    }
    resolvedDestinationId = ownedDest._id;
  } else if (destinationId && Types.ObjectId.isValid(destinationId)) {
    resolvedDestinationId = new Types.ObjectId(destinationId);
  }

  const clampedRadiusKm = isPartner ? Math.min(data.radiusKm, 15) : data.radiusKm;

  const doc = await SafetyAlertModel.create({
    ...data,
    radiusKm: clampedRadiusKm,
    destinationId: resolvedDestinationId,
    source: isPartner ? 'partner' : 'admin',
    isActive: true,
    expiresAt: new Date(Date.now() + hoursValid * 60 * 60 * 1000),
    createdBy: req.user?.id,
  });

  await logAuditEvent({
    req,
    action: 'safety_alert.create',
    targetType: 'safety_alert',
    targetId: doc._id,
    targetName: doc.title,
    destinationId: resolvedDestinationId,
    details: { type: doc.type, severity: doc.severity, radiusKm: doc.radiusKm, hoursValid },
  });

  res.status(201).json({ success: true, alert: doc });
}

export async function deactivateSafetyAlertHandler(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id || '');
  if (!Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Mã cảnh báo không hợp lệ.' } });
    return;
  }

  const existing = await SafetyAlertModel.findById(id);
  if (!existing) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy cảnh báo.' } });
    return;
  }

  if (req.user?.role === 'partner') {
    const userObjectId = new Types.ObjectId(req.user.id);
    const createdBySelf = existing.createdBy && String(existing.createdBy) === req.user.id;
    let ownsDest = false;
    if (existing.destinationId) {
      ownsDest = Boolean(
        await DestinationModel.exists({
          _id: existing.destinationId,
          managedBy: { $in: [req.user.id, userObjectId] },
        }),
      );
    }
    if (!createdBySelf && !ownsDest) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Bạn không có quyền gỡ cảnh báo của đơn vị khác.' },
      });
      return;
    }
  }

  existing.isActive = false;
  await existing.save();

  await logAuditEvent({
    req,
    action: 'safety_alert.deactivate',
    targetType: 'safety_alert',
    targetId: existing._id,
    targetName: existing.title,
    destinationId: existing.destinationId ?? undefined,
    details: { type: existing.type, severity: existing.severity },
  });

  res.json({ success: true, alert: existing });
}
