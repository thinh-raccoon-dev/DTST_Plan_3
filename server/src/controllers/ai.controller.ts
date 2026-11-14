import type { Request, Response } from 'express';
import { z } from 'zod';
import { processCopilotMessage, type PageContextSnapshot } from '../services/aiCopilot.service.js';
import { logger } from '../utils/logger.js';

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
