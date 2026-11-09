import { z } from 'zod';

export const updateSystemSettingsSchema = z.object({
  announcement: z
    .object({
      enabled: z.boolean(),
      message: z.string().trim().max(500),
      tone: z.enum(['info', 'warning', 'success', 'lotus']),
      linkUrl: z.string().trim().max(500).optional().default(''),
    })
    .optional(),
  general: z
    .object({
      maintenanceMode: z.boolean(),
      defaultCheckInPoints: z.number().int().min(0).max(1000),
      defaultQuizPoints: z.number().int().min(0).max(1000),
      enablePublicRegistration: z.boolean(),
      enableAiPlanner: z.boolean(),
    })
    .optional(),
  contact: z
    .object({
      hotline: z.string().trim().max(50),
      supportEmail: z.string().trim().email('Email hỗ trợ không hợp lệ.').max(100),
      organizationName: z.string().trim().max(200),
    })
    .optional(),
});
