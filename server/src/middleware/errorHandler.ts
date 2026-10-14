import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === 11000;
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: `Không tìm thấy API ${req.method} ${req.originalUrl.split('?')[0]}` } });
}

export function errorHandler(error: unknown, req: Request, res: Response<ErrorBody>, _next: NextFunction): void {
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details } });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu gửi lên không hợp lệ.',
        details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      },
    });
    return;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu không hợp lệ.',
        details: Object.values(error.errors).map((issue) => ({ path: issue.path, message: issue.message })),
      },
    });
    return;
  }

  if (error instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Mã định danh không hợp lệ.' } });
    return;
  }

  if (isDuplicateKeyError(error)) {
    res.status(409).json({ error: { code: 'DUPLICATE', message: 'Dữ liệu đã tồn tại.' } });
    return;
  }

  if (typeof error === 'object' && error !== null && 'type' in error && (error as { type: unknown }).type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Nội dung JSON không hợp lệ.' } });
    return;
  }

  if (
    error instanceof mongoose.Error.MongooseServerSelectionError ||
    (error instanceof Error && error.name.startsWith('MongoNetwork'))
  ) {
    logger.error({ err: error }, 'Database unavailable');
    res.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Hệ thống dữ liệu tạm thời gián đoạn. Vui lòng thử lại sau.' } });
    return;
  }

  logger.error({ err: error, path: req.path, method: req.method }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Đã có lỗi xảy ra. Vui lòng thử lại sau.',
      ...(env.isProduction || !(error instanceof Error) ? {} : { details: error.message }),
    },
  });
}
