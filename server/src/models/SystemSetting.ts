import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const systemSettingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    announcement: {
      enabled: { type: Boolean, default: false },
      message: { type: String, default: '', trim: true, maxlength: 500 },
      tone: { type: String, enum: ['info', 'warning', 'success', 'lotus'], default: 'info' },
      linkUrl: { type: String, default: '', trim: true },
    },
    general: {
      maintenanceMode: { type: Boolean, default: false },
      defaultCheckInPoints: { type: Number, default: 20, min: 0, max: 1000 },
      defaultQuizPoints: { type: Number, default: 30, min: 0, max: 1000 },
      enablePublicRegistration: { type: Boolean, default: true },
      enableAiPlanner: { type: Boolean, default: true },
    },
    contact: {
      hotline: { type: String, default: '1900 6868', trim: true },
      supportEmail: { type: String, default: 'hotro@dongthaptravel.vn', trim: true },
      organizationName: { type: String, default: 'Sở Văn hóa, Thể thao và Du lịch tỉnh Đồng Tháp', trim: true },
    },
  },
  { timestamps: true },
);

export type SystemSetting = InferSchemaType<typeof systemSettingSchema>;
export type SystemSettingDocument = HydratedDocument<SystemSetting>;
export const SystemSettingModel = model('SystemSetting', systemSettingSchema, 'systemSettings');
