import type { NextFunction, Request, Response } from 'express';
import { getEffectiveSystemSettings } from '../services/systemSettings.service.js';

const BYPASS_PREFIXES = ['/health', '/csrf', '/auth', '/system', '/admin'];

/**
 * Enforces SystemSettings.general.maintenanceMode at API level.
 * Admins, auth routes, healthchecks, system announcements, and admin routes stay accessible
 * so administrators can always log in, operate, and disable maintenance mode.
 */
export async function enforceMaintenanceMode(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.user?.role === 'admin') {
    return next();
  }
  const path = req.path || '';
  if (BYPASS_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return next();
  }

  const settings = await getEffectiveSystemSettings();
  if (settings.general.maintenanceMode) {
    res.status(503).json({
      error: {
        code: 'MAINTENANCE_MODE',
        message:
          'Hệ thống Đồng Tháp Smart Travel đang bảo trì nâng cấp định kỳ. Vui lòng quay lại sau ít phút!',
      },
    });
    return;
  }

  next();
}

/**
 * Enforces SystemSettings.general.enableAiPlanner on AI Copilot & AI Trip Planner routes.
 */
export async function requireAiPlannerEnabled(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.user?.role === 'admin') {
    return next();
  }
  const settings = await getEffectiveSystemSettings();
  if (!settings.general.enableAiPlanner) {
    res.status(503).json({
      error: {
        code: 'AI_PLANNER_DISABLED',
        message: 'Tính năng AI Lập lịch trình & Trợ lý ảo đang tạm dừng bảo trì theo cấu hình quản trị.',
      },
    });
    return;
  }
  next();
}
