import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { ItineraryModel } from '../../models/Itinerary.js';
import { PassportEntryModel } from '../../models/PassportEntry.js';
import { UserModel } from '../../models/User.js';
import {
  createAdminUserSchema,
  resetUserPasswordSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from '../../schemas/adminUser.schemas.js';
import { badRequest, conflict, notFound } from '../../utils/errors.js';

const BCRYPT_ROUNDS = 12;

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export async function listUsers(req: Request, res: Response) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const role = typeof req.query.role === 'string' ? req.query.role.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';

  const filter: Record<string, unknown> = {};

  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ email: rx }, { displayName: rx }];
  }

  if (role && role !== 'all') {
    filter.role = role;
  }

  if (status && status !== 'all') {
    filter.status = status;
  }

  const [total, users, totalUsers, tourists, partners, admins, disabled] = await Promise.all([
    UserModel.countDocuments(filter),
    UserModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    UserModel.countDocuments(),
    UserModel.countDocuments({ role: 'tourist' }),
    UserModel.countDocuments({ role: 'partner' }),
    UserModel.countDocuments({ role: 'admin' }),
    UserModel.countDocuments({ status: 'disabled' }),
  ]);

  const userIds = users.map((u) => u._id);

  // Aggregate user activity metrics
  const [itineraryCounts, checkInCounts, badgeCounts] = await Promise.all([
    ItineraryModel.aggregate<{ _id: unknown; count: number }>([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]),
    PassportEntryModel.aggregate<{ _id: unknown; count: number }>([
      { $match: { userId: { $in: userIds }, entryType: 'check_in' } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]),
    PassportEntryModel.aggregate<{ _id: unknown; count: number }>([
      { $match: { userId: { $in: userIds }, entryType: 'badge_awarded' } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]),
  ]);

  const itinMap = new Map(itineraryCounts.map((i) => [String(i._id), i.count]));
  const checkInMap = new Map(checkInCounts.map((c) => [String(c._id), c.count]));
  const badgeMap = new Map(badgeCounts.map((b) => [String(b._id), b.count]));

  const items = users.map((u) => {
    const id = String(u._id);
    return {
      id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      status: u.status,
      preferences: u.preferences,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      stats: {
        itinerariesCount: itinMap.get(id) ?? 0,
        checkInsCount: checkInMap.get(id) ?? 0,
        badgesCount: badgeMap.get(id) ?? 0,
      },
    };
  });

  res.json({
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    stats: {
      totalUsers,
      tourists,
      partners,
      admins,
      disabled,
    },
  });
}

export async function createUser(req: Request, res: Response) {
  const input = createAdminUserSchema.parse(req.body);

  if (await UserModel.exists({ email: input.email })) {
    throw conflict('Email này đã được sử dụng trong hệ thống.', 'EMAIL_TAKEN');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const user = await UserModel.create({
    email: input.email,
    displayName: input.displayName,
    passwordHash,
    role: input.role,
    status: 'active',
  });

  res.status(201).json({
    user: {
      id: String(user._id),
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    },
  });
}

export async function updateUserRole(req: Request, res: Response) {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw notFound('Không tìm thấy người dùng.');

  const input = updateUserRoleSchema.parse(req.body);

  if (req.user?.id === id && input.role !== 'admin') {
    throw badRequest('Không thể tự hạ vai trò quản trị viên của chính mình.');
  }

  const user = await UserModel.findByIdAndUpdate(id, { $set: { role: input.role } }, { new: true }).lean();
  if (!user) throw notFound('Không tìm thấy người dùng.');

  res.json({
    user: {
      id: String(user._id),
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
    },
  });
}

export async function updateUserStatus(req: Request, res: Response) {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw notFound('Không tìm thấy người dùng.');

  const input = updateUserStatusSchema.parse(req.body);

  if (req.user?.id === id && input.status === 'disabled') {
    throw badRequest('Không thể tự khóa tài khoản quản trị của chính mình.');
  }

  const user = await UserModel.findByIdAndUpdate(id, { $set: { status: input.status } }, { new: true }).lean();
  if (!user) throw notFound('Không tìm thấy người dùng.');

  res.json({
    user: {
      id: String(user._id),
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
    },
  });
}

export async function resetUserPassword(req: Request, res: Response) {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw notFound('Không tìm thấy người dùng.');

  const input = resetUserPasswordSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const user = await UserModel.findByIdAndUpdate(id, { $set: { passwordHash } }, { new: true }).lean();
  if (!user) throw notFound('Không tìm thấy người dùng.');

  res.json({ message: 'Đặt lại mật khẩu thành công.' });
}

export async function deleteUser(req: Request, res: Response) {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw notFound('Không tìm thấy người dùng.');

  if (req.user?.id === id) {
    throw badRequest('Không thể tự xóa tài khoản của chính mình.');
  }

  const user = await UserModel.findByIdAndDelete(id);
  if (!user) throw notFound('Không tìm thấy người dùng.');

  // Clean up user itineraries and user passport entries
  await Promise.all([
    ItineraryModel.deleteMany({ userId: id }),
    PassportEntryModel.deleteMany({ userId: id }),
  ]);

  res.status(204).end();
}
