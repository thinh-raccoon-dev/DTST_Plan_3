import type { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { processCopilotMessage, type PageContextSnapshot } from '../services/aiCopilot.service.js';
import { searchDestinationsByImage } from '../services/visualSearch.service.js';
import { logger } from '../utils/logger.js';

const ALLOWED_VISUAL_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/** OWASP binary magic-byte inspection for uploaded visual search buffers. */
function hasValidVisualImageMagicBytes(buf: Buffer): boolean {
  if (!buf || buf.length < 8) return false;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return true;
  }
  // GIF
  const header6 = buf.subarray(0, 6).toString('ascii');
  if (header6 === 'GIF87a' || header6 === 'GIF89a') return true;
  // WebP
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return true;
  }
  return false;
}

export const visualUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 6 * 1024 * 1024, // 6 MB
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_VISUAL_MIMES.has(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Vui lòng chọn tệp ảnh JPG, PNG, WebP hoặc GIF (tối đa 6MB).'));
    }
  },
});

const domControlSchema = z
  .object({
    id: z.string().max(80).optional(),
    targetId: z.string().max(80).optional(),
    tag: z.string().max(40),
    label: z.string().max(250),
    type: z.string().max(60).optional(),
    placeholder: z.string().max(200).optional(),
    value: z.string().max(300).optional(),
  })
  .passthrough()
  .transform((ctrl) => ({
    id: ctrl.id || ctrl.targetId || 'ctrl-0',
    tag: ctrl.tag,
    label: ctrl.label,
    type: ctrl.type,
    value: ctrl.value,
  }));

const draftItineraryStopSchema = z
  .object({
    stopId: z.string().max(100).optional(),
    placeId: z.string().max(120).optional(),
    name: z.string().max(250),
    type: z.string().max(40).optional(),
    start: z.string().max(30).optional(),
    end: z.string().max(30).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  })
  .passthrough();

const draftItineraryDaySchema = z
  .object({
    day: z.number().int().min(1).max(14),
    date: z.string().max(40).optional(),
    stops: z.array(draftItineraryStopSchema).max(30),
  })
  .passthrough();

const pendingSwapCandidateSchema = z
  .object({
    id: z.string().max(100).optional(),
    slug: z.string().max(160),
    name: z.string().max(250),
    area: z.string().max(120).optional(),
    category: z.string().max(80).optional(),
    summary: z.string().max(600).optional(),
    coordinates: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .optional(),
  })
  .passthrough();

const pendingSwapSchema = z
  .object({
    dayNumber: z.number().int().min(1).max(14),
    targetStopId: z.string().max(100).optional(),
    targetStopName: z.string().max(250),
    candidates: z.array(pendingSwapCandidateSchema).max(12).optional(),
  })
  .passthrough();

const lastDiscussedDestinationSchema = z
  .object({
    id: z.string().max(100).optional(),
    slug: z.string().max(160),
    name: z.string().max(250),
    area: z.string().max(120).optional(),
    category: z.string().max(80).optional(),
    coordinates: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .optional(),
  })
  .passthrough();

const pageContextSchema = z
  .object({
    currentPath: z.string().max(500).optional(),
    pageTitle: z.string().max(300).optional(),
    currentUser: z
      .object({
        displayName: z.string().max(120),
        email: z.string().max(254),
        role: z.string().max(40),
      })
      .passthrough()
      .nullable()
      .optional(),
    hasDraftItinerary: z.boolean().optional(),
    draftTitle: z.string().max(300).optional(),
    draftItinerary: z
      .object({
        title: z.string().max(300).optional(),
        totalDays: z.number().int().min(0).max(14).optional(),
        days: z.array(draftItineraryDaySchema).max(14),
      })
      .passthrough()
      .nullable()
      .optional(),
    pendingSwap: pendingSwapSchema.nullable().optional(),
    lastDiscussedDestination: lastDiscussedDestinationSchema.nullable().optional(),
    controls: z.array(domControlSchema).max(80).optional(),
  })
  .passthrough()
  .optional();

const copilotChatSchema = z.object({
  message: z.string().trim().min(1, 'Tin nhắn không được để trống').max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000),
      }),
    )
    .max(16)
    .optional()
    .default([]),
  pageContext: pageContextSchema,
});

export async function handleCopilotChat(req: Request, res: Response): Promise<void> {
  const parsed = copilotChatSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.issues }, 'Dữ liệu AI Copilot không hợp lệ');
    res.status(400).json({
      error: 'Dữ liệu yêu cầu không hợp lệ',
      details: parsed.error.issues,
    });
    return;
  }

  try {
    const { message, history, pageContext } = parsed.data;
    const result = await processCopilotMessage(message, history, pageContext as PageContextSnapshot | undefined);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Lỗi xử lý AI Copilot chat');
    res.status(500).json({
      error: 'Không thể xử lý yêu cầu trợ lý AI vào lúc này. Vui lòng thử lại.',
    });
  }
}

export async function handleVisualSearch(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Vui lòng chọn hoặc chụp một bức ảnh để Pé Meko phân tích tìm điểm tương đồng.',
      },
    });
    return;
  }

  if (!hasValidVisualImageMagicBytes(req.file.buffer)) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Nội dung tệp không phải ảnh hợp lệ (JPG, PNG, WebP hoặc GIF).',
      },
    });
    return;
  }

  try {
    const rawPrompt = typeof req.body?.prompt === 'string' ? req.body.prompt.slice(0, 500) : '';
    const parsedLat = req.body?.userLat !== undefined ? Number(req.body.userLat) : NaN;
    const parsedLng = req.body?.userLng !== undefined ? Number(req.body.userLng) : NaN;

    const result = await searchDestinationsByImage({
      imageBuffer: req.file.buffer,
      mimeType: req.file.mimetype || 'image/jpeg',
      originalName: req.file.originalname,
      userPrompt: rawPrompt,
      userLat: Number.isFinite(parsedLat) && parsedLat >= -90 && parsedLat <= 90 ? parsedLat : undefined,
      userLng: Number.isFinite(parsedLng) && parsedLng >= -180 && parsedLng <= 180 ? parsedLng : undefined,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Lỗi xử lý AI Visual Search');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Không thể phân tích hình ảnh vào lúc này. Vui lòng thử lại.',
      },
    });
  }
}
