import { z } from 'zod';
import { AREAS, INTERESTS } from '../config/catalog.js';

export const registerSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Email không hợp lệ.').max(254),
    password: z.string().min(8, 'Mật khẩu cần ít nhất 8 ký tự.').max(128),
    displayName: z.string().trim().min(2, 'Tên hiển thị cần ít nhất 2 ký tự.').max(80),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Email không hợp lệ.').max(254),
    password: z.string().min(1, 'Vui lòng nhập mật khẩu.').max(128),
  })
  .strict();

export const profilePreferencesSchema = z
  .object({
    areas: z.array(z.enum(AREAS)).max(AREAS.length).default([]),
    interests: z.array(z.enum(INTERESTS)).max(INTERESTS.length).default([]),
    numberOfDays: z.number().int().min(1, 'Tối thiểu 1 ngày.').max(7, 'Tối đa 7 ngày.').default(2),
    hoursPerDay: z.number().min(2, 'Tối thiểu 2 giờ mỗi ngày.').max(12, 'Tối đa 12 giờ mỗi ngày.').default(8),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(2, 'Tên hiển thị cần ít nhất 2 ký tự.').max(80).optional(),
    preferences: profilePreferencesSchema.optional(),
    currentPassword: z.string().min(1).max(128).optional(),
    newPassword: z.string().min(8, 'Mật khẩu mới cần ít nhất 8 ký tự.').max(128).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Không có dữ liệu cần cập nhật.')
  .refine((value) => !value.newPassword || Boolean(value.currentPassword), {
    message: 'Nhập mật khẩu hiện tại để đổi mật khẩu.',
    path: ['currentPassword'],
  });
