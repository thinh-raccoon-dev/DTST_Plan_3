import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  SAFETY_ALERT_TYPES,
  SAFETY_SEVERITIES,
  SafetyAlertModel,
  TERRAIN_IMPACTS,
} from '../models/SafetyAlert.js';
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

  const { hoursValid, ...data } = parsed.data;
  const doc = await SafetyAlertModel.create({
    ...data,
    source: req.user?.role === 'partner' ? 'partner' : 'admin',
    isActive: true,
    expiresAt: new Date(Date.now() + hoursValid * 60 * 60 * 1000),
    createdBy: req.user?.id,
  });

  res.status(201).json({ success: true, alert: doc });
}

export async function deactivateSafetyAlertHandler(req: Request, res: Response): Promise<void> {
  const updated = await SafetyAlertModel.findByIdAndUpdate(
    req.params.id,
    { $set: { isActive: false } },
    { new: true },
  );
  if (!updated) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy cảnh báo.' } });
    return;
  }
  res.json({ success: true, alert: updated });
}
