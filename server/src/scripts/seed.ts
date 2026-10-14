import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { BannerModel } from '../models/Banner.js';
import { ChallengeModel } from '../models/Challenge.js';
import { DestinationModel } from '../models/Destination.js';
import { QrCodeModel } from '../models/QrCode.js';
import { UserModel } from '../models/User.js';
import { seedChallenges, seedDestinations, seedQrCodes } from '../seed/data.js';
import { logger } from '../utils/logger.js';
import { normalizeText } from '../utils/text.js';

/**
 * Idempotent seed. Existing records (matched by slug / code / title) are never overwritten, so
 * admin edits survive re-running it. Nothing is ever deleted.
 *
 *   npm run seed                        create missing pilot data + admin
 *   npm run seed -- --reset-admin-password   also update the admin password from env
 */
const adminEnvSchema = z.object({
  SEED_ADMIN_EMAIL: z.string().trim().toLowerCase().email(),
  SEED_ADMIN_PASSWORD: z.string().min(10, 'SEED_ADMIN_PASSWORD cần ít nhất 10 ký tự'),
  SEED_ADMIN_NAME: z.string().trim().min(2).default('Quản trị viên'),
});

async function seedAdmin(resetPassword: boolean) {
  const parsed = adminEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    logger.warn(
      { issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
      'Bỏ qua tạo admin: hãy đặt SEED_ADMIN_EMAIL và SEED_ADMIN_PASSWORD trong server/.env',
    );
    return;
  }
  const { SEED_ADMIN_EMAIL: email, SEED_ADMIN_PASSWORD: password, SEED_ADMIN_NAME: displayName } = parsed.data;
  const existing = await UserModel.findOne({ email });
  if (!existing) {
    await UserModel.create({ email, displayName, role: 'admin', passwordHash: await bcrypt.hash(password, 12) });
    logger.info({ email }, 'Đã tạo tài khoản admin');
    return;
  }
  existing.role = 'admin';
  existing.status = 'active';
  if (resetPassword) existing.passwordHash = await bcrypt.hash(password, 12);
  await existing.save();
  logger.info({ email, passwordReset: resetPassword }, 'Tài khoản admin đã tồn tại, đảm bảo quyền admin');
}

async function seedContent() {
  let created = 0;
  let skipped = 0;
  const existing = await DestinationModel.find({}).select('slug name').lean();
  const existingSlugs = new Set(existing.map((d) => d.slug));
  const existingNames = new Set(existing.map((d) => normalizeText(d.name)));

  for (const item of seedDestinations) {
    if (existingSlugs.has(item.slug) || existingNames.has(normalizeText(item.name))) {
      skipped += 1;
      continue;
    }
    await new DestinationModel({
      ...item,
      isIllustrative: true,
      verification: { location: 'unverified', openingHours: 'unknown', referencePrice: 'unknown', contactInfo: 'unknown' },
      verificationStatus: 'unverified',
      operationalStatus: 'active',
    }).save();
    existingSlugs.add(item.slug);
    existingNames.add(normalizeText(item.name));
    created += 1;
  }
  logger.info({ created, skipped, total: seedDestinations.length }, 'Destinations seeded');

  const challengeIdsByKey = new Map<string, string>();
  for (const item of seedChallenges) {
    const destination = await DestinationModel.findOne({ slug: item.destinationSlug }).select('_id').lean();
    if (!destination) continue;
    const existing = await ChallengeModel.findOne({ destinationId: destination._id, title: item.title }).select('_id').lean();
    let challengeId = existing?._id;
    if (!challengeId) {
      const doc = await ChallengeModel.create({
        destinationId: destination._id,
        title: item.title,
        description: item.description,
        story: item.story,
        type: 'quiz',
        questions: item.questions,
        scoringRules: { rewardPoints: item.rewardPoints, minCorrect: item.minCorrect },
        status: 'active',
      });
      challengeId = doc._id;
    }
    challengeIdsByKey.set(item.key, String(challengeId));
  }
  logger.info({ total: challengeIdsByKey.size }, 'Challenges seeded');

  for (const item of seedQrCodes) {
    if (await QrCodeModel.exists({ code: item.code })) continue;
    const targetId =
      item.targetType === 'destination'
        ? (await DestinationModel.findOne({ slug: item.target }).select('_id').lean())?._id
        : challengeIdsByKey.get(item.target);
    if (!targetId) continue;
    await QrCodeModel.create({
      code: item.code,
      label: item.label,
      targetType: item.targetType,
      targetId,
      status: 'status' in item ? item.status : 'active',
    });
  }
  logger.info({ total: seedQrCodes.length }, 'QR codes seeded');
}

/** One illustrative cover so the homepage banner is visible out of the box. Skipped if any banner already exists. */
async function seedBanner() {
  if ((await BannerModel.countDocuments()) > 0) {
    logger.info('Banners already present, skipping');
    return;
  }
  await BannerModel.create({
    placement: 'home_top',
    kind: 'cover',
    theme: 'forest',
    eyebrow: 'Mùa sen 2026',
    title: 'Về Đồng Tháp mùa nước nổi',
    subtitle: 'Banner minh họa – quản trị viên có thể chỉnh sửa hoặc thay bằng nội dung quảng cáo trong mục Banner.',
    linkUrl: '/destinations',
    linkLabel: 'Xem điểm đến',
    status: 'active',
    sortOrder: 0,
  });
  logger.info('Illustrative banner seeded');
}

async function main() {
  const resetPassword = process.argv.includes('--reset-admin-password');
  await connectDatabase();
  await Promise.all([
    UserModel.createIndexes(),
    DestinationModel.createIndexes(),
    ChallengeModel.createIndexes(),
    QrCodeModel.createIndexes(),
    BannerModel.createIndexes(),
  ]);
  await seedAdmin(resetPassword);
  await seedContent();
  await seedBanner();
  await disconnectDatabase();
}

main().catch(async (error: unknown) => {
  logger.fatal({ err: error }, 'Seed failed');
  await disconnectDatabase();
  process.exit(1);
});
