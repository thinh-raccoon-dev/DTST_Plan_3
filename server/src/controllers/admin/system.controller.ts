import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { isDatabaseReady } from '../../config/db.js';
import { AnalyticsEventModel } from '../../models/AnalyticsEvent.js';
import { BadgeModel } from '../../models/Badge.js';
import { BannerModel } from '../../models/Banner.js';
import { ChallengeModel } from '../../models/Challenge.js';
import { DestinationModel } from '../../models/Destination.js';
import { FavoriteModel } from '../../models/Favorite.js';
import { ItineraryModel } from '../../models/Itinerary.js';
import { PassportEntryModel } from '../../models/PassportEntry.js';
import { QrCodeModel } from '../../models/QrCode.js';
import { SystemSettingModel } from '../../models/SystemSetting.js';
import { UserModel } from '../../models/User.js';
import { updateSystemSettingsSchema } from '../../schemas/system.schemas.js';
import { getPlannerHealth } from '../../services/tripPlannerV9.service.js';

export async function getSystemStatus(_req: Request, res: Response) {
  const mem = process.memoryUsage();
  const dbReady = isDatabaseReady();

  const [
    plannerHealth,
    usersCount,
    destinationsCount,
    itinerariesCount,
    passportEntriesCount,
    challengesCount,
    qrCodesCount,
    badgesCount,
    bannersCount,
    favoritesCount,
    analyticsCount,
  ] = await Promise.all([
    getPlannerHealth(),
    UserModel.countDocuments().catch(() => 0),
    DestinationModel.countDocuments().catch(() => 0),
    ItineraryModel.countDocuments().catch(() => 0),
    PassportEntryModel.countDocuments().catch(() => 0),
    ChallengeModel.countDocuments().catch(() => 0),
    QrCodeModel.countDocuments().catch(() => 0),
    BadgeModel.countDocuments().catch(() => 0),
    BannerModel.countDocuments().catch(() => 0),
    FavoriteModel.countDocuments().catch(() => 0),
    AnalyticsEventModel.countDocuments().catch(() => 0),
  ]);

  res.json({
    status: dbReady && plannerHealth.online ? 'healthy' : 'degraded',
    services: {
      backend: {
        status: 'online',
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsageMB: {
          rss: Math.round(mem.rss / 1024 / 1024),
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        },
      },
      database: {
        status: dbReady ? 'connected' : 'disconnected',
        name: mongoose.connection.name || 'dong-thap-smart-travel',
        readyState: mongoose.connection.readyState,
        counts: {
          destinations: destinationsCount,
          users: usersCount,
          itineraries: itinerariesCount,
          passportEntries: passportEntriesCount,
          challenges: challengesCount,
          qrCodes: qrCodesCount,
          badges: badgesCount,
          banners: bannersCount,
          favorites: favoritesCount,
          analyticsEvents: analyticsCount,
        },
      },
      aiEngine: {
        status: plannerHealth.status,
        online: plannerHealth.online,
        routingStatus: plannerHealth.routing_status ?? 'unknown',
        targetUrl: 'http://127.0.0.1:8010',
      },
    },
    systemTime: new Date().toISOString(),
  });
}

export async function getSystemSettings(_req: Request, res: Response) {
  let settings = await SystemSettingModel.findOne({ key: 'global' }).lean();
  if (!settings) {
    settings = await SystemSettingModel.create({ key: 'global' });
  }

  res.json({ settings });
}

export async function updateSystemSettings(req: Request, res: Response) {
  const input = updateSystemSettingsSchema.parse(req.body);

  const update: Record<string, unknown> = {};
  if (input.announcement) update.announcement = input.announcement;
  if (input.general) update.general = input.general;
  if (input.contact) update.contact = input.contact;

  const settings = await SystemSettingModel.findOneAndUpdate(
    { key: 'global' },
    { $set: update },
    { upsert: true, new: true },
  ).lean();

  res.json({ settings, message: 'Cập nhật cấu hình hệ thống thành công.' });
}

export async function getPublicAnnouncement(_req: Request, res: Response) {
  const settings = await SystemSettingModel.findOne({ key: 'global' }).select('announcement contact').lean();
  if (!settings || !settings.announcement?.enabled) {
    return res.json({ announcement: null, contact: settings?.contact ?? null });
  }

  res.json({
    announcement: settings.announcement,
    contact: settings.contact,
  });
}
