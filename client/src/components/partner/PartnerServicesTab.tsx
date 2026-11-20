import clsx from 'clsx';
import { CheckCircle2, Clock, PenLine, Plus, Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useApiQuery } from '../../hooks/useApiQuery';
import { api, toApiError } from '../../lib/api';
import { toast } from '../../stores/toastStore';
import type { DestinationServiceItem, ServiceCategory } from '../../types/api';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input, Select } from '../ui/Field';
import { ConfirmDialog, Modal } from '../ui/Modal';
import { ErrorState, PageLoader } from '../ui/States';

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  ticket: '🎟️ Vé vào cổng',
  combo: '🎁 Combo trọn gói',
  activity: '🚣 Hoạt động / Xuồng / Trải nghiệm',
  food: '🍲 Ẩm thực đặc sản',
  guide: '🧭 Hướng dẫn viên / Thuyết minh',
  other: '✨ Dịch vụ khác',
};

function formatVnd(amount: number): string {
  if (amount === 0) return 'Miễn phí';
  return `${amount.toLocaleString('vi-VN')} đ`;
}

export function PartnerServicesTab({
  destinationId,
  destinationName,
  onChanged,
}: {
  destinationId: string;
  destinationName: string;
  onChanged: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DestinationServiceItem | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('ticket');
  const [priceVnd, setPriceVnd] = useState(50000);
  const [unit, setUnit] = useState('người');
  const [durationMinutes, setDurationMinutes] = useState<string>('');
  const [description, setDescription] = useState('');
  const [includesVat, setIncludesVat] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DestinationServiceItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const query = useApiQuery<{ success: boolean; items: DestinationServiceItem[] }>(
    (signal) =>
      api
        .get('/admin/partner/services', { params: { destinationId }, signal })
        .then((r) => r.data),
    [destinationId],
  );

  const items = query.data?.items || [];

  const openCreate = () => {
    setEditing(null);
    setName('');
    setCategory('combo');
    setPriceVnd(120000);
    setUnit('người');
    setDurationMinutes('90');
    setDescription('');
    setIncludesVat(true);
    setIsAvailable(true);
    setModalOpen(true);
  };

  const openEdit = (item: DestinationServiceItem) => {
    setEditing(item);
    setName(item.name);
    setCategory(item.category);
    setPriceVnd(item.priceVnd);
    setUnit(item.unit);
    setDurationMinutes(item.durationMinutes ? String(item.durationMinutes) : '');
    setDescription(item.description);
    setIncludesVat(item.includesVat);
    setIsAvailable(item.isAvailable);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        destinationId,
        name: name.trim(),
        category,
        priceVnd: Number(priceVnd) || 0,
        unit: unit.trim() || 'người',
        durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        description: description.trim(),
        includesVat,
        isAvailable,
      };
      if (editing) {
        await api.patch(`/admin/partner/services/${editing.id}`, {
          ...payload,
          durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        });
        toast.success('Đã cập nhật bảng giá dịch vụ!');
      } else {
        await api.post('/admin/partner/services', payload);
        toast.success('Đã niêm yết dịch vụ mới lên trang du khách!');
      }
      setModalOpen(false);
      query.reload();
      onChanged();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/partner/services/${deleteTarget.id}`);
      toast.success('Đã gỡ hạng mục khỏi bảng giá.');
      setDeleteTarget(null);
      query.reload();
      onChanged();
    } catch (err) {
      toast.error(toApiError(err).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="mt-6 p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sand-200 pb-4">
        <div className="space-y-1">
          <h3 className="font-bold text-lg text-river-900 flex items-center gap-2">
            <Tag className="size-5 text-leaf-700" />
            Bảng Giá Vé, Combo & Dịch Vụ Niêm Yết ({items.length}/30)
          </h3>
          <p className="text-xs text-river-600 max-w-2xl">
            Công khai giá vé, thuê xuồng, ẩm thực và combo trải nghiệm của <strong>{destinationName}</strong> theo Luật Giá 2023 & Luật Du lịch 2017. Bảng giá hiển thị trực tiếp trên trang chi tiết điểm đến.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          disabled={items.length >= 30}
          onClick={openCreate}
          icon={<Plus className="size-4" />}
        >
          Thêm dịch vụ / Combo
        </Button>
      </div>

      {query.loading ? (
        <PageLoader />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.reload} />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sand-300 bg-sand-50/50 py-10 text-center space-y-2">
          <Tag className="size-10 mx-auto text-leaf-600/60" />
          <p className="text-sm font-bold text-river-800">Chưa niêm yết danh mục giá dịch vụ chi tiết</p>
          <p className="text-xs text-river-500 max-w-md mx-auto">
            Thêm vé vào cổng, vé xuồng ba lá, combo ẩm thực để du khách và đoàn khách dễ dàng dự trù kinh phí minh bạch!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => (
            <div
              key={s.id}
              className={clsx(
                'rounded-2xl border p-4 flex flex-col justify-between gap-3 transition',
                s.isAvailable ? 'border-sand-200 bg-white shadow-xs' : 'border-sand-200 bg-sand-50/70 opacity-70',
              )}
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-[11px] font-bold text-river-700 bg-sand-100 rounded-full px-2.5 py-0.5">
                    {CATEGORY_LABELS[s.category] || s.category}
                  </span>
                  <Badge tone={s.isAvailable ? 'leaf' : 'neutral'}>
                    {s.isAvailable ? 'Đang phục vụ' : 'Tạm ngưng'}
                  </Badge>
                </div>

                <h4 className="font-bold text-river-900 text-sm">{s.name}</h4>

                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-black text-leaf-800">{formatVnd(s.priceVnd)}</span>
                  <span className="text-xs text-river-500">/ {s.unit}</span>
                </div>

                {s.description && (
                  <p className="text-xs text-river-600 leading-relaxed line-clamp-2">{s.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-river-500">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-leaf-600" />
                    {s.includesVat ? 'Đã gồm thuế/phí' : 'Chưa gồm VAT'}
                  </span>
                  {s.durationMinutes && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" /> ~{s.durationMinutes} phút
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2.5 border-t border-sand-200 flex items-center gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => openEdit(s)} icon={<PenLine className="size-3.5" />}>
                  Sửa
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteTarget(s)}
                  icon={<Trash2 className="size-3.5 text-red-600" />}
                >
                  Xóa
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        size="md"
        title={editing ? 'Chỉnh sửa Hạng mục Giá Dịch vụ' : 'Thêm Vé / Combo / Dịch vụ Niêm yết'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-river-700 mb-1">
              Tên vé / dịch vụ / combo *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Combo Vé cổng + Xuồng ba lá + Trà sen"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Phân loại *
              </label>
              <Select value={category} onChange={(e) => setCategory(e.target.value as ServiceCategory)}>
                {Object.entries(CATEGORY_LABELS).map(([k, lbl]) => (
                  <option key={k} value={k}>
                    {lbl}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Giá niêm yết (VNĐ — nhập 0 nếu miễn phí) *
              </label>
              <Input
                type="number"
                min={0}
                max={50000000}
                step={1000}
                value={priceVnd}
                onChange={(e) => setPriceVnd(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Đơn vị tính *
              </label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="VD: người, xuồng 4 khách, đoàn"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-river-700 mb-1">
                Thời lượng dự kiến (phút)
              </label>
              <Input
                type="number"
                min={5}
                max={1440}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="VD: 60"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-river-700 mb-1">
              Mô tả chi tiết quyền lợi bao gồm
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bao gồm áo phao, nón lá, 1 phần trà sen nóng và hướng dẫn viên chèo xuồng..."
              className="w-full rounded-control border border-sand-300 bg-white p-2.5 text-sm text-river-800 focus:border-leaf-600 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-4 text-xs font-medium text-river-800">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includesVat}
                onChange={(e) => setIncludesVat(e.target.checked)}
                className="size-4 accent-leaf-600"
              />
              Giá đã bao gồm thuế/phí (VAT)
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="size-4 accent-leaf-600"
              />
              Đang mở bán công khai
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              {editing ? 'Lưu cập nhật' : 'Niêm yết ngay'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Gỡ hạng mục khỏi bảng giá?"
        message={
          <p>
            Bạn có chắc muốn xóa <strong>{deleteTarget?.name}</strong> khỏi bảng giá công khai của {destinationName}?
          </p>
        }
        confirmLabel="Xóa hạng mục"
        tone="danger"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Card>
  );
}
