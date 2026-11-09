import { z } from 'zod';
import { USER_ROLES } from '../models/User.js';

export const createAdminUserSchema = z.object({
  email: z.string().trim().email('Email không đúng định dạng.').max(254),
  displayName: z.string().trim().min(2, 'Tên hiển thị tối thiểu 2 ký tự.').max(80),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự.').max(100),
  role: z.enum(USER_ROLES),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(USER_ROLES),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'disabled']),
});

export const resetUserPasswordSchema = z.object({
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự.').max(100),
});
