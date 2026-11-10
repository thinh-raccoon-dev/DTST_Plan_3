import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';

// Ensure root uploads folder exists
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const randomHex = crypto.randomBytes(6).toString('hex');
    const safeName = `img-${Date.now()}-${randomHex}${ext}`;
    cb(null, safeName);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per file
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Định dạng tệp không được hỗ trợ. Vui lòng chọn ảnh JPG, PNG, WebP hoặc GIF.'));
    }
  },
});

export async function handleSingleUpload(req: Request, res: Response, _next: NextFunction) {
  if (!req.file) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Vui lòng chọn một tệp hình ảnh để tải lên.',
      },
    });
  }

  const file = req.file;
  const relativeUrl = `/uploads/${file.filename}`;

  return res.status(201).json({
    success: true,
    url: relativeUrl,
    filename: file.filename,
    originalName: file.originalname,
    size: file.size,
    mimetype: file.mimetype,
  });
}

export async function handleMultipleUpload(req: Request, res: Response, _next: NextFunction) {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (files.length === 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Vui lòng chọn ít nhất một tệp hình ảnh để tải lên.',
      },
    });
  }

  const uploaded = files.map((file) => ({
    url: `/uploads/${file.filename}`,
    filename: file.filename,
    originalName: file.originalname,
    size: file.size,
    mimetype: file.mimetype,
  }));

  return res.status(201).json({
    success: true,
    items: uploaded,
    count: uploaded.length,
  });
}
