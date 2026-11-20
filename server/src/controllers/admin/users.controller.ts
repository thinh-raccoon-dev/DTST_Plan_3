import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { Types, isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { DestinationModel } from '../../models/Destination.js';
import { FavoriteModel } from '../../models/Favorite.js';
import { GroupInquiryModel } from '../../models/GroupInquiry.js';
import { ItineraryModel } from '../../models/Itinerary.js';
import { PassportEntryModel } from '../../models/PassportEntry.js';
import { ReviewModel } from '../../models/Review.js';
import { TravelFootprintModel } from '../../models/TravelFootprint.js';
import { UserModel } from '../../models/User.js';
import { VoucherClaimModel } from '../../models/VoucherClaim.js';
import { logAuditEvent } from '../../services/audit.service.js';
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

  // Aggregate user activity metrics + partner managed destinations
  const [itineraryCounts, checkInCounts, badgeCounts, managedDests] = await Promise.all([
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
    DestinationModel.find({ managedBy: { $in: userIds } })
      .select('_id name slug area managedBy')
      .lean(),
  ]);

  const itinMap = new Map(itineraryCounts.map((i) => [String(i._id), i.count]));
  const checkInMap = new Map(checkInCounts.map((c) => [String(c._id), c.count]));
  const badgeMap = new Map(badgeCounts.map((b) => [String(b._id), b.count]));
  const managedMap = new Map<string, Array<{ id: string; name: string; slug: string; area: string }>>();
  for (const d of managedDests) {
    const owner = String(d.managedBy);
    const list = managedMap.get(owner) ?? [];
    list.push({ id: String(d._id), name: d.name, slug: d.slug, area: d.area });
    managedMap.set(owner, list);
  }

  const items = users.map((u) => {
    const id = String(u._id);
    return {
      id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      status: u.status,
      preferences: u.preferences,
      managedDestinations: managedMap.get(id) ?? [],
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

  await logAuditEvent({
    req,
    action: 'user.create',
    targetType: 'user',
    targetId: user._id,
    targetName: user.displayName || user.email,
    details: { email: user.email, role: user.role },
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

async function assertNotLastActiveAdmin(targetUserId: string) {
  const target = await UserModel.findById(targetUserId).select('role status').lean();
  if (!target) throw notFound('Không tìm thấy người dùng.');
  if (target.role === 'admin' && target.status === 'active') {
    const remainingAdmins = await UserModel.countDocuments({
      role: 'admin',
      status: 'active',
      _id: { $ne: targetUserId },
    });
    if (remainingAdmins < 1) {
      throw badRequest(
        'Hệ thống phải duy trì ít nhất 1 tài khoản Quản trị viên đang hoạt động.',
        'LAST_ADMIN_PROTECTED',
      );
    }
  }
}

export async function updateUserRole(req: Request, res: Response) {
  const id = String(req.params.id || '');
  if (!isValidObjectId(id)) throw notFound('Không tìm thấy người dùng.');

  const input = updateUserRoleSchema.parse(req.body);

  if (req.user?.id === id && input.role !== 'admin') {
    throw badRequest('Không thể tự hạ vai trò quản trị viên của chính mình.');
  }
  if (input.role !== 'admin') {
    await assertNotLastActiveAdmin(id);
  }

  // Increment tokenVersion so existing sessions must re-authenticate with updated privileges.
  const user = await UserModel.findByIdAndUpdate(
    id,
    { $set: { role: input.role }, $inc: { tokenVersion: 1 } },
    { new: true },
  ).lean();
  if (!user) throw notFound('Không tìm thấy người dùng.');

  await logAuditEvent({
    req,
    action: 'user.role.update',
    targetType: 'user',
    targetId: user._id,
    targetName: user.displayName || user.email,
    details: { email: user.email, newRole: user.role },
  });

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
  const id = String(req.params.id || '');
  if (!isValidObjectId(id)) throw notFound('Không tìm thấy người dùng.');

  const input = updateUserStatusSchema.parse(req.body);

  if (req.user?.id === id && input.status === 'disabled') {
    throw badRequest('Không thể tự khóa tài khoản quản trị của chính mình.');
  }
  if (input.status === 'disabled') {
    await assertNotLastActiveAdmin(id);
  }

  const updateOp: Record<string, unknown> = { $set: { status: input.status } };
  if (input.status === 'disabled') {
    updateOp.$inc = { tokenVersion: 1 };
  }

  const user = await UserModel.findByIdAndUpdate(id, updateOp, { new: true }).lean();
  if (!user) throw notFound('Không tìm thấy người dùng.');

  await logAuditEvent({
    req,
    action: 'user.status.update',
    targetType: 'user',
    targetId: user._id,
    targetName: user.displayName || user.email,
    details: { email: user.email, newStatus: user.status },
  });

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
  const id = String(req.params.id || '');
  if (!isValidObjectId(id)) throw notFound('Không tìm thấy người dùng.');

  const input = resetUserPasswordSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  // Immediately revoke all existing JWT sessions via tokenVersion increment
  const user = await UserModel.findByIdAndUpdate(
    id,
    { $set: { passwordHash }, $inc: { tokenVersion: 1 } },
    { new: true },
  ).lean();
  if (!user) throw notFound('Không tìm thấy người dùng.');

  await logAuditEvent({
    req,
    action: 'user.password.reset',
    targetType: 'user',
    targetId: user._id,
    targetName: user.displayName || user.email,
    details: { email: user.email, sessionsRevoked: true },
  });

  res.json({ message: 'Đặt lại mật khẩu thành công (toàn bộ phiên đăng nhập cũ đã bị thu hồi).' });
}

export async function deleteUser(req: Request, res: Response) {
  const id = String(req.params.id || '');
  if (!isValidObjectId(id)) throw notFound('Không tìm thấy người dùng.');

  if (req.user?.id === id) {
    throw badRequest('Không thể tự xóa tài khoản của chính mình.');
  }
  await assertNotLastActiveAdmin(id);

  const user = await UserModel.findByIdAndDelete(id);
  if (!user) throw notFound('Không tìm thấy người dùng.');

  // Nghị định 13/2023/NĐ-CP: Full cascade deletion / anonymization of personal data
  await Promise.all([
    ItineraryModel.deleteMany({ userId: id }),
    PassportEntryModel.deleteMany({ userId: id }),
    FavoriteModel.deleteMany({ userId: id }),
    TravelFootprintModel.deleteMany({ userId: id }),
    VoucherClaimModel.deleteMany({ userId: id }),
    GroupInquiryModel.deleteMany({ userId: id }),
    ReviewModel.updateMany(
      { userId: id },
      { $unset: { userId: 1 }, $set: { authorName: 'Du khách đã xóa tài khoản' } },
    ),
    DestinationModel.updateMany({ managedBy: id }, { $unset: { managedBy: 1 } }),
  ]);

  await logAuditEvent({
    req,
    action: 'user.delete',
    targetType: 'user',
    targetId: user._id,
    targetName: user.displayName || user.email,
    details: { email: user.email, role: user.role, piiCascadeCleaned: true },
  });

  res.status(204).end();
}

const assignDestinationsSchema = z.object({
  destinationIds: z.array(z.string().trim()).max(30),
});

/** Directly assign/unassign managed destinations for a Partner account with full AuditLog. */
export async function assignPartnerDestinations(req: Request, res: Response) {
  const id = String(req.params.id || '');
  if (!isValidObjectId(id)) throw notFound('Không tìm thấy người dùng.');

  const body = assignDestinationsSchema.parse(req.body);
  const partner = await UserModel.findById(id).select('email displayName role status').lean();
  if (!partner) throw notFound('Không tìm thấy người dùng.');
  if (partner.role !== 'partner') {
    throw badRequest('Chỉ có thể gán quyền quản lý KDL cho tài khoản có vai trò Đối tác (partner).');
  }

  const validIds: Types.ObjectId[] = [];
  for (const rawId of body.destinationIds) {
    if (!Types.ObjectId.isValid(rawId)) {
      throw badRequest(`Mã địa điểm không hợp lệ: ${rawId}`);
    }
    validIds.push(new Types.ObjectId(rawId));
  }

  const partnerObjId = new Types.ObjectId(id);
  // Unassign destinations that were owned by this partner but removed from the selection
  await DestinationModel.updateMany(
    {
      managedBy: { $in: [id, partnerObjId] },
      _id: { $nin: validIds },
    },
    { $unset: { managedBy: 1 } },
  );

  // Assign selected destinations to this partner
  if (validIds.length > 0) {
    await DestinationModel.updateMany(
      { _id: { $in: validIds } },
      { $set: { managedBy: partnerObjId } },
    );
  }

  const assigned = await DestinationModel.find({ managedBy: partnerObjId })
    .select('_id name slug area')
    .lean();

  await logAuditEvent({
    req,
    action: 'user.destinations.assign',
    targetType: 'user',
    targetId: partner._id,
    targetName: partner.displayName || partner.email,
    details: {
      email: partner.email,
      assignedCount: assigned.length,
      destinationNames: assigned.map((d) => d.name),
    },
  });

  res.json({
    success: true,
    managedDestinations: assigned.map((d) => ({
      id: String(d._id),
      name: d.name,
      slug: d.slug,
      area: d.area,
    })),
    message: `Đã cập nhật ${assigned.length} điểm đến thuộc quyền quản lý của ${partner.displayName}.`,
  });
}
