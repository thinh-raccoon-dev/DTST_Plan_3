import {
  Bell,
  Database,
  Layers,
  RefreshCw,
  Save,
  Server,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField, Input, Select, Textarea } from '../../components/ui/Field';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api } from '../../lib/api';
import { toast } from '../../stores/toastStore';
import type { SystemSettings, SystemStatusResponse } from '../../types/api';

export function AdminSystemPage() {
  useDocumentTitle('Hệ thống & cấu hình dịch vụ');

  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<SystemSettings>({
    announcement: {
      enabled: false,
      message: '',
      tone: 'info',
      linkUrl: '',
    },
    general: {
      maintenanceMode: false,
      defaultCheckInPoints: 20,
      defaultQuizPoints: 30,
      enablePublicRegistration: true,
      enableAiPlanner: true,
    },
    contact: {
      hotline: '1900 6868',
      supportEmail: 'hotro@dongthaptravel.vn',
      organizationName: 'Sở Văn hóa, Thể thao và Du lịch tỉnh Đồng Tháp',
    },
  });

  const statusQuery = useApiQuery<SystemStatusResponse>(
    (signal) => api.get<SystemStatusResponse>('/admin/system/status', { signal }).then((r) => r.data),
    [],
  );

  const settingsQuery = useApiQuery<{ settings: SystemSettings }>(
    (signal) => api.get<{ settings: SystemSettings }>('/admin/system/settings', { signal }).then((r) => r.data),
    [],
  );

  useEffect(() => {
    const timer = setInterval(() => {
      statusQuery.reload();
    }, 15000);
    return () => clearInterval(timer);
  }, [statusQuery]);

  useEffect(() => {
    if (settingsQuery.data?.settings) {
      setFormData(settingsQuery.data.settings);
    }
  }, [settingsQuery.data]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/admin/system/settings', formData);
      toast.success('Đã lưu cấu hình hệ thống thành công.');
      settingsQuery.reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không thể lưu cấu hình.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const services = statusQuery.data?.services;

  return (
    <>
      <AdminPageHeader
        title="Hệ thống & giám sát dịch vụ"
        description="Theo dõi tình trạng hoạt động của các dịch vụ vi mô (Backend Node.js, MongoDB, AI Planner Python, Valhalla Routing) và thiết lập cấu hình toàn hệ thống."
        actions={
          <Button variant="secondary" size="sm" onClick={() => statusQuery.reload()} loading={statusQuery.loading}>
            <RefreshCw className="size-4" /> Làm mới trạng thái
          </Button>
        }
      />

      {/* Services status cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Backend API Service */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 font-semibold text-river-900">
              <Server className="size-5 text-leaf-700" />
              <span>Backend API Server</span>
            </div>
            <StatusBadge status="active" label="Trực tuyến" />
          </div>
          <div className="space-y-2 text-xs text-river-600">
            <div className="flex justify-between py-1 border-b border-sand-100">
              <span>Môi trường / Cổng:</span>
              <span className="font-semibold text-river-800">Node.js {services?.backend?.nodeVersion} (Port 4000)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-sand-100">
              <span>Thời gian hoạt động (Uptime):</span>
              <span className="font-semibold text-river-800">
                {Math.floor((services?.backend?.uptimeSeconds ?? 0) / 3600)}h {Math.floor(((services?.backend?.uptimeSeconds ?? 0) % 3600) / 60)}m
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span>Bộ nhớ RAM (RSS / Heap):</span>
              <span className="font-semibold text-river-800">
                {services?.backend?.memoryUsageMB?.rss ?? 0} MB / {services?.backend?.memoryUsageMB?.heapUsed ?? 0} MB
              </span>
            </div>
          </div>
        </Card>

        {/* MongoDB Database */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 font-semibold text-river-900">
              <Database className="size-5 text-teal-700" />
              <span>Cơ sở dữ liệu MongoDB</span>
            </div>
            <StatusBadge
              status={services?.database?.status === 'connected' ? 'active' : 'closed'}
              label={services?.database?.status === 'connected' ? 'Đã kết nối' : 'Mất kết nối'}
            />
          </div>
          <div className="space-y-2 text-xs text-river-600">
            <div className="flex justify-between py-1 border-b border-sand-100">
              <span>Tên Database:</span>
              <span className="font-semibold text-river-800">{services?.database?.name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-sand-100">
              <span>Địa điểm du lịch:</span>
              <span className="font-semibold text-river-800">{services?.database?.counts?.destinations ?? 0} điểm</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Lịch trình & Lượt check-in:</span>
              <span className="font-semibold text-river-800">
                {services?.database?.counts?.itineraries ?? 0} lịch trình · {services?.database?.counts?.passportEntries ?? 0} check-in
              </span>
            </div>
          </div>
        </Card>

        {/* AI Trip Planner & Valhalla */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 font-semibold text-river-900">
              <Sparkles className="size-5 text-lotus-700" />
              <span>Trip Planner AI V9 & Valhalla</span>
            </div>
            <StatusBadge
              status={services?.aiEngine?.online ? 'active' : 'temporarily_closed'}
              label={services?.aiEngine?.online ? 'Sẵn sàng' : 'Ngoại tuyến'}
            />
          </div>
          <div className="space-y-2 text-xs text-river-600">
            <div className="flex justify-between py-1 border-b border-sand-100">
              <span>Python AI Engine:</span>
              <span className="font-semibold text-river-800">Port 8010 ({services?.aiEngine?.status})</span>
            </div>
            <div className="flex justify-between py-1 border-b border-sand-100">
              <span>Valhalla Routing:</span>
              <span className="font-semibold text-river-800">
                Port 8002 ({services?.aiEngine?.routingStatus})
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span>Thuật toán tối ưu:</span>
              <span className="font-semibold text-leaf-700">Lộ trình động & Replan thời gian thực</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Database Document Collections Summary */}
      <Card className="mb-8 p-5">
        <h3 className="text-sm font-semibold text-river-900 mb-4 flex items-center gap-2">
          <Layers className="size-4 text-leaf-600" /> Thống kê dung lượng dữ liệu hệ thống
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8 text-center text-xs">
          <div className="rounded-control bg-sand-50 p-2.5">
            <div className="font-bold text-base text-leaf-800">{services?.database?.counts?.destinations ?? 0}</div>
            <div className="text-river-600">Địa điểm</div>
          </div>
          <div className="rounded-control bg-sand-50 p-2.5">
            <div className="font-bold text-base text-teal-800">{services?.database?.counts?.users ?? 0}</div>
            <div className="text-river-600">Người dùng</div>
          </div>
          <div className="rounded-control bg-sand-50 p-2.5">
            <div className="font-bold text-base text-river-800">{services?.database?.counts?.itineraries ?? 0}</div>
            <div className="text-river-600">Lịch trình</div>
          </div>
          <div className="rounded-control bg-sand-50 p-2.5">
            <div className="font-bold text-base text-leaf-700">{services?.database?.counts?.passportEntries ?? 0}</div>
            <div className="text-river-600">Check-in QR</div>
          </div>
          <div className="rounded-control bg-sand-50 p-2.5">
            <div className="font-bold text-base text-lotus-800">{services?.database?.counts?.challenges ?? 0}</div>
            <div className="text-river-600">Thử thách</div>
          </div>
          <div className="rounded-control bg-sand-50 p-2.5">
            <div className="font-bold text-base text-leaf-800">{services?.database?.counts?.badges ?? 0}</div>
            <div className="text-river-600">Huy hiệu</div>
          </div>
          <div className="rounded-control bg-sand-50 p-2.5">
            <div className="font-bold text-base text-teal-800">{services?.database?.counts?.qrCodes ?? 0}</div>
            <div className="text-river-600">Mã QR</div>
          </div>
          <div className="rounded-control bg-sand-50 p-2.5">
            <div className="font-bold text-base text-river-800">{services?.database?.counts?.analyticsEvents ?? 0}</div>
            <div className="text-river-600">Sự kiện tương tác</div>
          </div>
        </div>
      </Card>

      {/* System Settings Form */}
      <form onSubmit={handleSaveSettings}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Announcement banner settings */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 font-semibold text-river-900 border-b border-sand-200 pb-3">
              <Bell className="size-5 text-lotus-600" />
              <span>Thông báo phát thanh toàn hệ thống</span>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.announcement.enabled}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    announcement: { ...formData.announcement, enabled: e.target.checked },
                  })
                }
                className="size-4 rounded text-leaf-600 focus:ring-leaf-500"
              />
              <span className="text-sm font-medium text-river-800">
                Kích hoạt hiển thị banner thông báo trên trang chủ
              </span>
            </label>

            <FormField label="Nội dung thông điệp thông báo" hint="Tối đa 500 ký tự.">
              <Textarea
                rows={3}
                value={formData.announcement.message}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    announcement: { ...formData.announcement, message: e.target.value },
                  })
                }
                placeholder="Chào mừng quý khách đến với Tuần lễ Du lịch & Văn hóa Đồng Tháp năm 2026!"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Mức độ thông báo">
                <Select
                  value={formData.announcement.tone}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      announcement: {
                        ...formData.announcement,
                        tone: e.target.value as 'info' | 'warning' | 'success' | 'lotus',
                      },
                    })
                  }
                >
                  <option value="info">Thông tin (Xanh dương)</option>
                  <option value="success">Thành công / Chào mừng (Xanh lá)</option>
                  <option value="warning">Lưu ý / Nhắc nhở (Cam)</option>
                  <option value="lotus">Sự kiện đặc biệt (Sen hồng)</option>
                </Select>
              </FormField>

              <FormField label="Liên kết đính kèm (URL)" hint="Tùy chọn.">
                <Input
                  type="text"
                  value={formData.announcement.linkUrl ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      announcement: { ...formData.announcement, linkUrl: e.target.value },
                    })
                  }
                  placeholder="https://dongthap.gov.vn/..."
                />
              </FormField>
            </div>
          </Card>

          {/* Gamification & Points parameters */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 font-semibold text-river-900 border-b border-sand-200 pb-3">
              <Settings className="size-5 text-leaf-600" />
              <span>Tham số tính năng & điểm thưởng</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Điểm check-in QR mặc định" hint="Điểm cộng khi quét QR tại điểm.">
                <Input
                  type="number"
                  min={0}
                  max={500}
                  value={formData.general.defaultCheckInPoints}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      general: { ...formData.general, defaultCheckInPoints: parseInt(e.target.value, 10) || 0 },
                    })
                  }
                />
              </FormField>

              <FormField label="Điểm hoàn thành thử thách" hint="Điểm thưởng khi trả lời đúng trắc nghiệm.">
                <Input
                  type="number"
                  min={0}
                  max={500}
                  value={formData.general.defaultQuizPoints}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      general: { ...formData.general, defaultQuizPoints: parseInt(e.target.value, 10) || 0 },
                    })
                  }
                />
              </FormField>
            </div>

            <div className="space-y-2 pt-2 border-t border-sand-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.general.enablePublicRegistration}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      general: { ...formData.general, enablePublicRegistration: e.target.checked },
                    })
                  }
                  className="size-4 rounded text-leaf-600 focus:ring-leaf-500"
                />
                <span className="text-sm text-river-800">Cho phép du khách tự do đăng ký tài khoản</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.general.enableAiPlanner}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      general: { ...formData.general, enableAiPlanner: e.target.checked },
                    })
                  }
                  className="size-4 rounded text-leaf-600 focus:ring-leaf-500"
                />
                <span className="text-sm text-river-800">Bật công cụ lập lịch trình thông minh AI V9</span>
              </label>
            </div>

            {/* Contact info */}
            <div className="pt-3 border-t border-sand-200">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Đường dây nóng hỗ trợ">
                  <Input
                    type="text"
                    value={formData.contact.hotline}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contact: { ...formData.contact, hotline: e.target.value },
                      })
                    }
                  />
                </FormField>

                <FormField label="Email tiếp nhận hỗ trợ">
                  <Input
                    type="email"
                    value={formData.contact.supportEmail}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contact: { ...formData.contact, supportEmail: e.target.value },
                      })
                    }
                  />
                </FormField>
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="submit" loading={saving} className="px-6">
            <Save className="size-4" /> Lưu cấu hình hệ thống
          </Button>
        </div>
      </form>
    </>
  );
}
