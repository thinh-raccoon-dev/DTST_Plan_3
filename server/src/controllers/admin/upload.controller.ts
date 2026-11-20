import crypto from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { logAuditEvent } from '../../services/audit.service.js';

// Ensure root uploads folder exists
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

const ALLOWED_MIME_TYPES = new Set(Object.keys(MIME_TO_EXT));

/**
 * Verifies real binary magic bytes on disk so spoofed HTML/SVG/JS files claiming image/jpeg
 * are immediately rejected and deleted (OWASP Unrestricted File Upload defense).
 */
function hasValidImageMagicBytes(filePath: string): boolean {
  let fd: number | null = null;
  try {
    fd = openSync(filePath, 'r');
    const buf = Buffer.alloc(16);
    const bytesRead = readSync(fd, buf, 0, 16, 0);
    if (bytesRead < 8) return false;

    // JPEG: FF D8 FF
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
    // PNG: 89 50 4E 47 0D 0A 1A 0A
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
    // GIF: GIF87a or GIF89a
    const header6 = buf.subarray(0, 6).toString('ascii');
    if (header6 === 'GIF87a' || header6 === 'GIF89a') return true;
    // WebP: RIFF....WEBP
    if (
      bytesRead >= 12 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return true;
    }
    // AVIF: ....ftypavif / ftypavis
    if (bytesRead >= 12 && buf.subarray(4, 8).toString('ascii') === 'ftyp') {
      const brand = buf.subarray(8, 12).toString('ascii');
      if (brand === 'avif' || brand === 'avis' || brand === 'mif1') return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

function safeUnlink(filePath: string) {
  try {
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch {
    // ignore cleanup failure
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype.toLowerCase()] || '.jpg';
    const randomHex = crypto.randomBytes(8).toString('hex');
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
  if (!hasValidImageMagicBytes(file.path)) {
    safeUnlink(file.path);
    return res.status(400).json({
      error: {
        code: 'INVALID_IMAGE_SIGNATURE',
        message: 'Nội dung tệp không phải hình ảnh hợp lệ (JPG/PNG/WebP/GIF/AVIF). Đã từ chối vì lý do bảo mật.',
      },
    });
  }

  const relativeUrl = `/uploads/${file.filename}`;

  await logAuditEvent({
    req,
    action: 'media.upload',
    targetType: 'media',
    targetId: file.filename,
    targetName: file.originalname || file.filename,
    details: { size: file.size, mimetype: file.mimetype, url: relativeUrl },
  });

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

  const invalidFiles = files.filter((f) => !hasValidImageMagicBytes(f.path));
  if (invalidFiles.length > 0) {
    files.forEach((f) => safeUnlink(f.path));
    return res.status(400).json({
      error: {
        code: 'INVALID_IMAGE_SIGNATURE',
        message: 'Một hoặc nhiều tệp không có chữ ký nhị phân hình ảnh hợp lệ. Toàn bộ lô tải lên đã bị hủy.',
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

  await logAuditEvent({
    req,
    action: 'media.upload',
    targetType: 'media',
    targetId: uploaded.map((u) => u.filename).join(',').slice(0, 120),
    targetName: `Tải lên ${uploaded.length} hình ảnh`,
    details: { count: uploaded.length },
  });

  return res.status(201).json({
    success: true,
    items: uploaded,
    count: uploaded.length,
  });
}
