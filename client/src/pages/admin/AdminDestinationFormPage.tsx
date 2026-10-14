import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Eye, ImagePlus, Save, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useFieldArray, useForm, type FieldPath } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { DestinationFacts } from '../../components/destination/DestinationInfo';
import { DestinationImage } from '../../components/destination/DestinationImage';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Checkbox, FormField, Input, Select, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { ErrorState, Notice, PageLoader } from '../../components/ui/States';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, toApiError, type ApiError } from '../../lib/api';
import {
  AREA_OPTIONS,
  CATEGORY_OPTIONS,
  OPERATIONAL_LABELS,
  PUBLICATION_LABELS,
  VERIFICATION_LEVEL_LABELS,
} from '../../lib/catalog';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import type { AdminDestination, Area, Category, DestinationDetail, OperationalStatus, PublicationStatus, VerificationLevel } from '../../types/api';

const level = z.enum(['verified', 'unverified', 'unknown']);
const optionalUrl = z.string().trim().refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'URL phải bắt đầu bằng http:// hoặc https://');
const optionalNumber = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= min && Number(v) <= max), message);

const formSchema = z
  .object({
    name: z.string().trim().min(2, 'Tên cần ít nhất 2 ký tự').max(160),
    slug: z
      .string()
      .trim()
      .refine((v) => v === '' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), 'Chỉ gồm chữ thường không dấu, số và dấu gạch ngang'),
    summary: z.string().trim().max(300, 'Tối đa 300 ký tự'),
    description: z.string().trim().min(20, 'Mô tả cần ít nhất 20 ký tự').max(8000),
    category: z.enum(['nature', 'eco', 'culture', 'history', 'food', 'local_experience']),
    area: z.enum(['cao-lanh', 'sa-dec', 'thap-muoi', 'tam-nong', 'lai-vung', 'hong-ngu', 'my-tho', 'cai-be']),
    tagsText: z.string(),
    address: z.string().trim().max(300),
    lat: optionalNumber(8, 24, 'Vĩ độ phải nằm trong khoảng 8–24 (Việt Nam)'),
    lng: optionalNumber(102, 110, 'Kinh độ phải nằm trong khoảng 102–110 (Việt Nam)'),
    openingHours: z.string().trim().max(300),
    referencePrice: z.string().trim().max(300),
    phone: z.string().trim().refine((v) => v === '' || /^[0-9+ ().-]{6,20}$/.test(v), 'Số điện thoại không hợp lệ'),
    website: optionalUrl,
    email: z.string().trim().refine((v) => v === '' || z.string().email().safeParse(v).success, 'Email không hợp lệ'),
    durationMinutes: optionalNumber(15, 720, 'Thời lượng phải từ 15 đến 720 phút'),
    durationIsEstimate: z.boolean(),
    durationNote: z.string().trim().max(200),
    sourceUrlsText: z.string(),
    images: z.array(
      z.object({
        url: z
          .string()
          .trim()
          .min(1, 'Nhập URL ảnh')
          .refine((v) => /^https?:\/\/\S+$/i.test(v) || /^\/[a-zA-Z0-9/_.-]+$/.test(v), 'URL ảnh phải là http(s) hoặc đường dẫn bắt đầu bằng /'),
        alt: z.string().trim().max(200),
        credit: z.string().trim().max(200),
        license: z.string().trim().max(120),
        sourceUrl: optionalUrl,
      }),
    ),
    verification: z.object({ location: level, openingHours: level, referencePrice: level, contactInfo: level }),
    isIllustrative: z.boolean(),
    lastVerifiedAt: z.string(),
    publicationStatus: z.enum(['draft', 'published', 'hidden']),
    operationalStatus: z.enum(['active', 'temporarily_closed', 'closed']),
    managedByEmail: z.string().trim().refine((v) => v === '' || z.string().email().safeParse(v).success, 'Email đối tác không hợp lệ'),
  })
  .superRefine((v, ctx) => {
    if ((v.lat === '') !== (v.lng === '')) {
      ctx.addIssue({ code: 'custom', path: [v.lat === '' ? 'lat' : 'lng'], message: 'Cần nhập đủ cả vĩ độ và kinh độ' });
    }
    const sources = splitLines(v.sourceUrlsText);
    if (sources.some((s) => !/^https?:\/\/\S+$/i.test(s))) {
      ctx.addIssue({ code: 'custom', path: ['sourceUrlsText'], message: 'Mỗi dòng phải là một URL http(s)' });
    }
    const hasData = {
      location: v.address !== '' || v.lat !== '',
      openingHours: v.openingHours !== '',
      referencePrice: v.referencePrice !== '',
      contactInfo: v.phone !== '' || v.website !== '' || v.email !== '',
    };
    let anyVerified = false;
    for (const key of Object.keys(hasData) as Array<keyof typeof hasData>) {
      if (v.verification[key] !== 'verified') continue;
      anyVerified = true;
      if (!hasData[key]) ctx.addIssue({ code: 'custom', path: ['verification', key], message: 'Không thể “đã xác minh” khi chưa có dữ liệu' });
    }
    if (anyVerified && sources.length === 0) ctx.addIssue({ code: 'custom', path: ['sourceUrlsText'], message: 'Cần ít nhất một nguồn khi có thông tin đã xác minh' });
    if (anyVerified && v.lastVerifiedAt === '') ctx.addIssue({ code: 'custom', path: ['lastVerifiedAt'], message: 'Cần ngày xác minh khi có thông tin đã xác minh' });
  });

type FormValues = z.infer<typeof formSchema>;

function splitLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const emptyValues: FormValues = {
  name: '',
  slug: '',
  summary: '',
  description: '',
  category: 'nature',
  area: 'cao-lanh',
  tagsText: '',
  address: '',
  lat: '',
  lng: '',
  openingHours: '',
  referencePrice: '',
  phone: '',
  website: '',
  email: '',
  durationMinutes: '',
  durationIsEstimate: true,
  durationNote: '',
  sourceUrlsText: '',
  images: [],
  verification: { location: 'unknown', openingHours: 'unknown', referencePrice: 'unknown', contactInfo: 'unknown' },
  isIllustrative: false,
  lastVerifiedAt: '',
  publicationStatus: 'draft',
  operationalStatus: 'active',
  managedByEmail: '',
};

function toFormValues(d: AdminDestination): FormValues {
  return {
    name: d.name,
    slug: d.slug,
    summary: d.summary,
    description: d.description,
    category: d.category,
    area: d.area,
    tagsText: d.tags.join(', '),
    address: d.address ?? '',
    lat: d.coordinates ? String(d.coordinates.lat) : '',
    lng: d.coordinates ? String(d.coordinates.lng) : '',
    openingHours: d.openingHours ?? '',
    referencePrice: d.referencePrice ?? '',
    phone: d.contactInfo?.phone ?? '',
    website: d.contactInfo?.website ?? '',
    email: d.contactInfo?.email ?? '',
    durationMinutes: d.estimatedVisitDuration ? String(d.estimatedVisitDuration.minutes) : '',
    durationIsEstimate: d.estimatedVisitDuration?.isEstimate ?? true,
    durationNote: d.estimatedVisitDuration?.note ?? '',
    sourceUrlsText: d.sourceUrls.join('\n'),
    images: d.images.map((img) => ({ url: img.url, alt: img.alt, credit: img.credit ?? '', license: img.license ?? '', sourceUrl: img.sourceUrl ?? '' })),
    verification: d.verification,
    isIllustrative: d.isIllustrative,
    lastVerifiedAt: d.lastVerifiedAt ? d.lastVerifiedAt.slice(0, 10) : '',
    publicationStatus: d.publicationStatus,
    operationalStatus: d.operationalStatus,
    managedByEmail: d.managedByEmail ?? '',
  };
}

const orNull = (v: string) => (v === '' ? null : v);

function toBody(v: FormValues) {
  const contact = { phone: v.phone, website: v.website, email: v.email };
  return {
    name: v.name,
    slug: v.slug,
    summary: v.summary,
    description: v.description,
    category: v.category,
    area: v.area,
    tags: [...new Set(v.tagsText.split(',').map((t) => t.trim()).filter(Boolean))],
    address: orNull(v.address),
    coordinates: v.lat !== '' && v.lng !== '' ? { lat: Number(v.lat), lng: Number(v.lng) } : null,
    openingHours: orNull(v.openingHours),
    referencePrice: orNull(v.referencePrice),
    contactInfo: Object.values(contact).some(Boolean) ? contact : null,
    estimatedVisitDuration:
      v.durationMinutes !== ''
        ? { minutes: Math.round(Number(v.durationMinutes)), isEstimate: v.durationIsEstimate, ...(v.durationNote ? { note: v.durationNote } : {}) }
        : null,
    sourceUrls: splitLines(v.sourceUrlsText),
    images: v.images.map((img) => ({
      url: img.url,
      alt: img.alt,
      ...(img.credit ? { credit: img.credit } : {}),
      ...(img.license ? { license: img.license } : {}),
      sourceUrl: img.sourceUrl,
    })),
    verification: v.verification,
    isIllustrative: v.isIllustrative,
    lastVerifiedAt: v.lastVerifiedAt ? `${v.lastVerifiedAt}T00:00:00+07:00` : null,
    publicationStatus: v.publicationStatus,
    operationalStatus: v.operationalStatus,
    managedByEmail: v.managedByEmail,
  };
}

/** Server paths (e.g. `coordinates.lat`) mapped onto flat form fields. */
function serverPathToField(path: string): FieldPath<FormValues> | null {
  const direct: Record<string, FieldPath<FormValues>> = {
    'coordinates.lat': 'lat',
    'coordinates.lng': 'lng',
    coordinates: 'lat',
    'contactInfo.phone': 'phone',
    'contactInfo.website': 'website',
    'contactInfo.email': 'email',
    'estimatedVisitDuration.minutes': 'durationMinutes',
    'estimatedVisitDuration.note': 'durationNote',
    tags: 'tagsText',
  };
  if (direct[path]) return direct[path];
  if (path.startsWith('sourceUrls')) return 'sourceUrlsText';
  if (path.startsWith('tags.')) return 'tagsText';
  if (/^images\.\d+\.(url|alt|credit|license|sourceUrl)$/.test(path)) return path as FieldPath<FormValues>;
  if (/^verification\.(location|openingHours|referencePrice|contactInfo)$/.test(path)) return path as FieldPath<FormValues>;
  const flat = ['name', 'slug', 'summary', 'description', 'category', 'area', 'address', 'openingHours', 'referencePrice', 'lastVerifiedAt', 'publicationStatus', 'operationalStatus', 'managedByEmail'];
  return flat.includes(path) ? (path as FieldPath<FormValues>) : null;
}

function previewDetail(v: FormValues, id: string | undefined): DestinationDetail {
  const body = toBody(v);
  return {
    id: id ?? 'preview',
    slug: v.slug || 'xem-truoc',
    name: v.name || 'Tên địa điểm',
    summary: v.summary,
    description: v.description,
    category: v.category as Category,
    area: v.area as Area,
    tags: body.tags,
    image: v.images[0] ? { url: v.images[0].url, alt: v.images[0].alt } : null,
    isIllustrative: v.isIllustrative,
    verificationStatus: 'unverified',
    operationalStatus: v.operationalStatus as OperationalStatus,
    estimatedVisitDuration: body.estimatedVisitDuration,
    hasCoordinates: Boolean(body.coordinates),
    hasChallenge: false,
    address: body.address,
    coordinates: body.coordinates,
    images: [],
    openingHours: body.openingHours,
    referencePrice: body.referencePrice,
    contactInfo: body.contactInfo,
    sourceUrls: body.sourceUrls,
    verification: v.verification as Record<'location' | 'openingHours' | 'referencePrice' | 'contactInfo', VerificationLevel>,
    lastVerifiedAt: body.lastVerifiedAt,
    updatedAt: null,
  };
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg">{title}</h2>
      {description && <p className="mt-1 text-sm text-river-600">{description}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

const verificationGroups: Array<{ key: keyof FormValues['verification']; label: string }> = [
  { key: 'location', label: 'Địa chỉ / tọa độ' },
  { key: 'openingHours', label: 'Giờ mở cửa' },
  { key: 'referencePrice', label: 'Giá tham khảo' },
  { key: 'contactInfo', label: 'Liên hệ' },
];

function DestinationForm({ initial, id }: { initial?: AdminDestination; id?: string }) {
  const navigate = useNavigate();
  const isPartner = useAuthStore((s) => s.user?.role === 'partner');
  const [formError, setFormError] = useState<string | null>(null);
  const [preview, setPreview] = useState<FormValues | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: initial ? toFormValues(initial) : emptyValues });
  const images = useFieldArray({ control: form.control, name: 'images' });
  const { errors, isSubmitting, isDirty } = form.formState;
  const reg = form.register;

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    try {
      const body = toBody(values);
      if (isPartner && body.publicationStatus === 'published') body.publicationStatus = 'draft';
      const res = id
        ? await api.patch<{ destination: AdminDestination }>(`/admin/destinations/${id}`, body)
        : await api.post<{ destination: AdminDestination }>('/admin/destinations', body);
      toast.success(id ? 'Đã lưu thay đổi' : 'Đã tạo địa điểm', res.data.destination.name);
      if (id) form.reset(toFormValues(res.data.destination));
      else navigate(`/admin/destinations/${res.data.destination.id}/edit`, { replace: true });
    } catch (error) {
      const apiError: ApiError = toApiError(error);
      if (apiError.code === 'SLUG_TAKEN') {
        form.setError('slug', { message: apiError.message });
        return;
      }
      const unplaced = apiError.fieldIssues.filter((issue) => {
        const field = serverPathToField(issue.path);
        if (field) form.setError(field, { type: 'server', message: issue.message });
        return !field;
      });
      setFormError(unplaced.length ? unplaced.map((i) => `${i.path}: ${i.message}`).join('; ') : apiError.message);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit, () => setFormError('Vui lòng kiểm tra các trường được đánh dấu.'))} noValidate className="space-y-5">
      {formError && <Notice tone="warning" title="Chưa lưu được">{formError}</Notice>}

      <Section title="Thông tin cơ bản">
        <FormField label="Tên địa điểm" required error={errors.name?.message} className="sm:col-span-2">
          <Input {...reg('name')} />
        </FormField>
        <FormField label="Slug (đường dẫn)" hint="Để trống để tạo tự động từ tên. Đổi slug sẽ làm hỏng liên kết đã chia sẻ." error={errors.slug?.message}>
          <Input {...reg('slug')} placeholder="vd: vuon-quoc-gia-tram-chim" />
        </FormField>
        <FormField label="Tag" hint="Phân tách bằng dấu phẩy." error={errors.tagsText?.message}>
          <Input {...reg('tagsText')} placeholder="sếu đầu đỏ, đi xuồng" />
        </FormField>
        <FormField label="Loại hình" required error={errors.category?.message}>
          <Select {...reg('category')}>
            {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FormField>
        <FormField label="Khu vực" required error={errors.area?.message}>
          <Select {...reg('area')}>
            {AREA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FormField>
        <FormField label="Tóm tắt" hint="Hiển thị trên thẻ địa điểm, tối đa 300 ký tự." error={errors.summary?.message} className="sm:col-span-2">
          <Textarea rows={2} {...reg('summary')} />
        </FormField>
        <FormField label="Mô tả" required error={errors.description?.message} className="sm:col-span-2">
          <Textarea rows={7} {...reg('description')} />
        </FormField>
      </Section>

      <Section title="Vị trí & thông tin thực tế" description="Để trống nếu chưa có thông tin. Không nhập giá 0 hoặc giờ mở cửa phỏng đoán — trang du khách sẽ hiển thị “Chưa có thông tin xác minh”.">
        <FormField label="Địa chỉ" error={errors.address?.message} className="sm:col-span-2">
          <Input {...reg('address')} />
        </FormField>
        <FormField label="Vĩ độ (lat)" hint="Ví dụ 10.67" error={errors.lat?.message}>
          <Input inputMode="decimal" {...reg('lat')} />
        </FormField>
        <FormField label="Kinh độ (lng)" hint="Ví dụ 105.55" error={errors.lng?.message}>
          <Input inputMode="decimal" {...reg('lng')} />
        </FormField>
        <FormField label="Giờ mở cửa" error={errors.openingHours?.message}>
          <Input {...reg('openingHours')} />
        </FormField>
        <FormField label="Giá tham khảo" error={errors.referencePrice?.message}>
          <Input {...reg('referencePrice')} placeholder="vd: Vé người lớn 50.000đ (nguồn …)" />
        </FormField>
        <FormField label="Điện thoại" error={errors.phone?.message}>
          <Input type="tel" {...reg('phone')} />
        </FormField>
        <FormField label="Website" error={errors.website?.message}>
          <Input type="url" {...reg('website')} />
        </FormField>
        <FormField label="Email liên hệ" error={errors.email?.message}>
          <Input type="email" {...reg('email')} />
        </FormField>
        <FormField label="Thời lượng tham quan (phút)" hint="Để trống nếu chưa biết; bộ lập lịch sẽ dùng giá trị mặc định và cảnh báo." error={errors.durationMinutes?.message}>
          <Input inputMode="numeric" {...reg('durationMinutes')} />
        </FormField>
        <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
          <Checkbox label="Thời lượng là ước tính" {...reg('durationIsEstimate')} />
          <FormField label="Ghi chú thời lượng" error={errors.durationNote?.message}>
            <Input {...reg('durationNote')} />
          </FormField>
        </div>
      </Section>

      <Section title="Mức xác minh & nguồn" description="Chỉ chọn “Đã xác minh” khi đã kiểm tra với nguồn chính thức. Trạng thái tổng được hệ thống tự tính.">
        {verificationGroups.map((g) => (
          <FormField key={g.key} label={`Xác minh: ${g.label}`} error={errors.verification?.[g.key]?.message}>
            <Select {...reg(`verification.${g.key}`)}>
              {Object.entries(VERIFICATION_LEVEL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </FormField>
        ))}
        <FormField label="Ngày xác minh gần nhất" error={errors.lastVerifiedAt?.message}>
          <Input type="date" {...reg('lastVerifiedAt')} />
        </FormField>
        <div className="flex items-end">
          <Checkbox label="Dữ liệu minh họa" description="Gắn nhãn “Dữ liệu minh họa” trên trang du khách." {...reg('isIllustrative')} />
        </div>
        <FormField label="Nguồn tham khảo" hint="Mỗi dòng một URL." error={errors.sourceUrlsText?.message} className="sm:col-span-2">
          <Textarea rows={3} {...reg('sourceUrlsText')} />
        </FormField>
      </Section>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg">Hình ảnh</h2>
            <p className="mt-1 text-sm text-river-600">Chỉ dùng ảnh có quyền sử dụng; ghi rõ tác giả và giấy phép. Ảnh đầu tiên là ảnh đại diện.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<ImagePlus className="size-4" aria-hidden />}
            disabled={images.fields.length >= 10}
            onClick={() => images.append({ url: '', alt: '', credit: '', license: '', sourceUrl: '' })}
          >
            Thêm ảnh
          </Button>
        </div>
        {images.fields.length === 0 ? (
          <p className="mt-4 text-sm text-river-500">Chưa có ảnh — trang du khách sẽ hiển thị ảnh minh họa mặc định.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {images.fields.map((field, index) => (
              <li key={field.id} className="grid gap-3 rounded-control border border-sand-200 p-4 sm:grid-cols-[120px_1fr]">
                <DestinationImage
                  key={form.watch(`images.${index}.url`)}
                  image={form.watch(`images.${index}.url`) ? { url: form.watch(`images.${index}.url`), alt: '' } : null}
                  category={form.watch('category')}
                  name="ảnh này"
                  className="aspect-[4/3] w-full rounded-control"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="URL ảnh" required error={errors.images?.[index]?.url?.message} className="sm:col-span-2">
                    <Input {...reg(`images.${index}.url`)} />
                  </FormField>
                  <FormField label="Mô tả ảnh (alt)" error={errors.images?.[index]?.alt?.message}>
                    <Input {...reg(`images.${index}.alt`)} />
                  </FormField>
                  <FormField label="Tác giả / nguồn" error={errors.images?.[index]?.credit?.message}>
                    <Input {...reg(`images.${index}.credit`)} />
                  </FormField>
                  <FormField label="Giấy phép" error={errors.images?.[index]?.license?.message}>
                    <Input {...reg(`images.${index}.license`)} />
                  </FormField>
                  <FormField label="URL nguồn ảnh" error={errors.images?.[index]?.sourceUrl?.message}>
                    <Input {...reg(`images.${index}.sourceUrl`)} />
                  </FormField>
                  <div className="sm:col-span-2">
                    <Button size="sm" variant="ghost" className="text-red-700" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => images.remove(index)}>
                      Bỏ ảnh
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Section title="Xuất bản">
        <FormField label="Trạng thái xuất bản" hint={isPartner ? 'Đối tác không thể tự xuất bản. Quản trị viên sẽ duyệt.' : 'Chỉ “Đã xuất bản” mới hiển thị với du khách.'} error={errors.publicationStatus?.message}>
          <Select {...reg('publicationStatus')} disabled={isPartner && initial?.publicationStatus === 'published'}>
            {(Object.entries(PUBLICATION_LABELS) as Array<[PublicationStatus, string]>)
              .filter(([value]) => !isPartner || value !== 'published' || initial?.publicationStatus === 'published')
              .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </FormField>
        <FormField label="Tình trạng hoạt động" error={errors.operationalStatus?.message}>
          <Select {...reg('operationalStatus')}>
            {(Object.entries(OPERATIONAL_LABELS) as Array<[OperationalStatus, string]>).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </FormField>
        {!isPartner && (
          <FormField label="Email đối tác quản lý" hint="Tài khoản vai trò đối tác sẽ thấy và sửa địa điểm này." error={errors.managedByEmail?.message} className="sm:col-span-2">
            <Input type="email" {...reg('managedByEmail')} placeholder="partner@example.com" />
          </FormField>
        )}
      </Section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap justify-end gap-2 border-t border-sand-200 bg-sand-50/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <Button variant="secondary" icon={<Eye className="size-4" aria-hidden />} onClick={() => setPreview(form.getValues())}>
          Xem trước
        </Button>
        <Button type="submit" loading={isSubmitting} disabled={Boolean(id) && !isDirty} icon={<Save className="size-4" aria-hidden />}>
          {id ? 'Lưu thay đổi' : 'Tạo địa điểm'}
        </Button>
      </div>

      <Modal open={Boolean(preview)} title="Xem trước nội dung du khách" onClose={() => setPreview(null)} size="lg">
        {preview && (
          <div className="space-y-4">
            <Notice tone="info">Bản xem trước theo dữ liệu đang nhập (chưa lưu). Trạng thái xác minh thực tế sẽ được máy chủ tính khi lưu.</Notice>
            <DestinationImage image={preview.images[0] ? { url: preview.images[0].url, alt: preview.images[0].alt } : null} category={preview.category} name={preview.name} className="aspect-[16/9] w-full rounded-card" />
            <h3 className="text-2xl">{preview.name || 'Tên địa điểm'}</h3>
            {preview.summary && <p className="text-river-700">{preview.summary}</p>}
            <p className="whitespace-pre-line text-sm text-river-800">{preview.description}</p>
            <DestinationFacts destination={previewDetail(preview, id)} />
          </div>
        )}
      </Modal>
    </form>
  );
}

export function AdminDestinationFormPage() {
  const { id } = useParams();
  useDocumentTitle(id ? 'Sửa địa điểm' : 'Thêm địa điểm');
  const query = useApiQuery(
    (signal) => (id ? api.get<{ destination: AdminDestination }>(`/admin/destinations/${id}`, { signal }).then((r) => r.data.destination) : Promise.resolve(null)),
    [id],
  );

  return (
    <>
      <Link to="/admin/destinations" className="mb-3 inline-flex items-center gap-1 text-sm text-river-600 hover:text-leaf-700">
        <ArrowLeft className="size-4" aria-hidden /> Danh sách địa điểm
      </Link>
      <AdminPageHeader
        title={id ? query.data?.name ?? 'Sửa địa điểm' : 'Thêm địa điểm'}
        actions={
          query.data?.publicationStatus === 'published' ? (
            <a href={`/destinations/${query.data.slug}`} target="_blank" rel="noopener" className="text-sm font-medium text-leaf-700 hover:underline">
              Mở trang du khách ↗
            </a>
          ) : undefined
        }
      />
      {id && query.loading ? (
        <PageLoader />
      ) : id && (query.error || !query.data) ? (
        <ErrorState error={query.error} onRetry={query.reload} />
      ) : (
        <DestinationForm key={id ?? 'new'} id={id} initial={query.data ?? undefined} />
      )}
    </>
  );
}
