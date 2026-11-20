import { CHECKIN_POINTS } from '../config/catalog.js';
import { SystemSettingModel } from '../models/SystemSetting.js';

export interface EffectiveSystemSettings {
  announcement: {
    enabled: boolean;
    message: string;
    tone: 'info' | 'warning' | 'success' | 'lotus';
    linkUrl: string;
  };
  general: {
    maintenanceMode: boolean;
    defaultCheckInPoints: number;
    defaultQuizPoints: number;
    enablePublicRegistration: boolean;
    enableAiPlanner: boolean;
  };
  contact: {
    hotline: string;
    supportEmail: string;
    organizationName: string;
  };
}

const DEFAULT_SETTINGS: EffectiveSystemSettings = {
  announcement: {
    enabled: false,
    message: '',
    tone: 'info',
    linkUrl: '',
  },
  general: {
    maintenanceMode: false,
    defaultCheckInPoints: CHECKIN_POINTS,
    defaultQuizPoints: 30,
    enablePublicRegistration: true,
    enableAiPlanner: true,
  },
  contact: {
    hotline: '1900 6868',
    supportEmail: 'hotro@dongthaptravel.vn',
    organizationName: 'Sở Văn hóa, Thể thao và Du lịch tỉnh Đồng Tháp',
  },
};

const CACHE_TTL_MS = process.env.NODE_ENV === 'test' ? 0 : 5_000;
let cached: { value: EffectiveSystemSettings; expiresAt: number } | null = null;

export function invalidateSystemSettingsCache() {
  cached = null;
}

export async function getEffectiveSystemSettings(): Promise<EffectiveSystemSettings> {
  const now = Date.now();
  if (CACHE_TTL_MS > 0 && cached && cached.expiresAt > now) {
    return cached.value;
  }

  const doc = await SystemSettingModel.findOne({ key: 'global' }).lean().catch(() => null);
  const value: EffectiveSystemSettings = doc
    ? {
        announcement: {
          enabled: Boolean(doc.announcement?.enabled),
          message: doc.announcement?.message ?? '',
          tone: doc.announcement?.tone ?? 'info',
          linkUrl: doc.announcement?.linkUrl ?? '',
        },
        general: {
          maintenanceMode: Boolean(doc.general?.maintenanceMode),
          defaultCheckInPoints:
            typeof doc.general?.defaultCheckInPoints === 'number'
              ? doc.general.defaultCheckInPoints
              : CHECKIN_POINTS,
          defaultQuizPoints:
            typeof doc.general?.defaultQuizPoints === 'number' ? doc.general.defaultQuizPoints : 30,
          enablePublicRegistration: doc.general?.enablePublicRegistration !== false,
          enableAiPlanner: doc.general?.enableAiPlanner !== false,
        },
        contact: {
          hotline: doc.contact?.hotline ?? DEFAULT_SETTINGS.contact.hotline,
          supportEmail: doc.contact?.supportEmail ?? DEFAULT_SETTINGS.contact.supportEmail,
          organizationName:
            doc.contact?.organizationName ?? DEFAULT_SETTINGS.contact.organizationName,
        },
      }
    : DEFAULT_SETTINGS;

  if (CACHE_TTL_MS > 0) {
    cached = { value, expiresAt: now + CACHE_TTL_MS };
  }
  return value;
}
