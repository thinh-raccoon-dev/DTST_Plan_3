import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Info, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { CategoryIcon } from '../components/destination/CategoryIcon';
import { ItineraryEditor, toSaveBody } from '../components/itinerary/ItineraryEditor';
import { PageContainer } from '../components/layout/PublicLayout';
import { Button } from '../components/ui/Button';
import { Card, SectionHeading } from '../components/ui/Card';
import { ChipToggle, FormField, Input, Select } from '../components/ui/Field';
import { ConfirmDialog } from '../components/ui/Modal';
import { EmptyState, Notice } from '../components/ui/States';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api, toApiError } from '../lib/api';
import { AREA_OPTIONS, CATEGORY_OPTIONS } from '../lib/catalog';
import { useAuthStore } from '../stores/authStore';
import { useItineraryDraft } from '../stores/itineraryDraftStore';
import { toast } from '../stores/toastStore';
import type { Area, Category, PlanAlternative, PlanResult, PlannerScenario, Preferences, SavedItinerary } from '../types/api';

const formSchema = z.object({
  numberOfDays: z.coerce.number().int().min(1, 'Tối thiểu 1 ngày').max(7, 'Tối đa 7 ngày'),
  hoursPerDay: z.coerce.number().min(2).max(12),
  areas: z.array(z.string()),
  interests: z.array(z.string()),
  scenario: z.enum(['balanced', 'indoor', 'compact']),
});
type FormValues = z.infer<typeof formSchema>;

function toggle(list: string[], value: string, on: boolean) {
  return on ? [...new Set([...list, value])] : list.filter((v) => v !== value);
}

export function ItineraryCreatePage() {
  useDocumentTitle('Lập lịch trình');
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const draft = useItineraryDraft();
  const priorityId = (location.state as { priorityDestinationId?: string } | null)?.priorityDestinationId;
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unscheduled, setUnscheduled] = useState<PlanResult['unscheduled']>([]);
  const [dailyLimit, setDailyLimit] = useState<number | undefined>(draft.preferences ? draft.preferences.hoursPerDay * 60 : undefined);
  const [confirmClear, setConfirmClear] = useState(false);
  const [alternatives, setAlternatives] = useState<PlanAlternative[]>([]);
  const [activeScenario, setActiveScenario] = useState<PlannerScenario>('balanced');

  const form = useForm<z.input<typeof formSchema>, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      numberOfDays: draft.preferences?.numberOfDays ?? user?.preferences?.numberOfDays ?? 2,
      hoursPerDay: draft.preferences?.hoursPerDay ?? user?.preferences?.hoursPerDay ?? 8,
      areas: draft.preferences?.areas ?? user?.preferences?.areas ?? [],
      interests: draft.preferences?.interests ?? user?.preferences?.interests ?? [],
      scenario: 'balanced',
    },
  });

  useEffect(() => {
    if (draft.preferences || !user?.preferences) return;
    form.reset({
      numberOfDays: user.preferences.numberOfDays,
      hoursPerDay: user.preferences.hoursPerDay,
      areas: user.preferences.areas,
      interests: user.preferences.interests,
      scenario: 'balanced',
    });
  }, [user, draft.preferences, form]);

  const generate = async (values: FormValues) => {
    setGenerating(true);
    const preferences: Preferences = {
      numberOfDays: values.numberOfDays,
      hoursPerDay: values.hoursPerDay,
      areas: values.areas as Area[],
      interests: values.interests as Category[],
      priorityDestinationIds: priorityId ? [priorityId] : [],
      scenario: values.scenario,
    };
    try {
      const res = await api.post<{ preferences: Preferences; plan: PlanResult; alternatives: PlanAlternative[] }>(
        '/itineraries/generate',
        preferences,
      );
      const { plan } = res.data;
      draft.setPlan(preferences, plan.days.map((d) => ({ items: d.items })), plan.warnings);
      setUnscheduled(plan.unscheduled);
      setDailyLimit(plan.assumptions.dailyLimitMinutes);
      setAlternatives(res.data.alternatives ?? []);
      setActiveScenario(values.scenario);
      const count = plan.days.reduce((n, d) => n + d.items.length, 0);
      toast.success('Đã tạo gợi ý lịch trình', `${count} địa điểm trong ${plan.days.length} ngày.`);
      window.requestAnimationFrame(() => document.getElementById('plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (error) {
      toast.error('Không tạo được lịch trình', toApiError(error).message);
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const p = draft.preferences;
      const res = await api.post<{ itinerary: SavedItinerary }>(
        '/itineraries',
        toSaveBody(draft.title, draft.days, p ? { areas: p.areas, interests: p.interests, hoursPerDay: p.hoursPerDay } : undefined),
      );
      toast.success('Đã lưu lịch trình vào tài khoản');
      draft.clear();
      navigate(`/itinerary/${res.data.itinerary.id}`);
    } catch (error) {
      toast.error('Không lưu được lịch trình', toApiError(error).message);
    } finally {
      setSaving(false);
    }
  };

  const hasPlan = draft.days.length > 0;
  const hasItems = draft.days.some((d) => d.items.length > 0);

  return (
    <PageContainer>
      <SectionHeading
        as="h1"
        title="Lập lịch trình"
        description="Gợi ý theo khu vực, sở thích và ngân sách thời gian; tinh chỉnh thứ tự trong ngày theo khoảng cách. Có phương án dự phòng khi mưa hoặc khi muốn gom cụm."
      />

      <Card className="mt-6 p-5 sm:p-6">
        <form onSubmit={form.handleSubmit(generate)} className="space-y-6" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Số ngày" required error={form.formState.errors.numberOfDays?.message}>
              <Input type="number" min={1} max={7} inputMode="numeric" {...form.register('numberOfDays')} />
            </FormField>
            <FormField label="Thời gian tham quan mỗi ngày" hint="Giới hạn tổng thời lượng các điểm trong một ngày.">
              <Select {...form.register('hoursPerDay')}>
                {[4, 6, 8, 10].map((h) => (
                  <option key={h} value={h}>
                    {h} giờ
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <Controller
            control={form.control}
            name="interests"
            render={({ field }) => (
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-river-800">Sở thích (bỏ trống để xem tất cả)</legend>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_OPTIONS.map((o) => (
                    <ChipToggle
                      key={o.value}
                      checked={field.value.includes(o.value)}
                      onChange={(on) => field.onChange(toggle(field.value, o.value, on))}
                      icon={<CategoryIcon category={o.value} className="size-4" />}
                    >
                      {o.label}
                    </ChipToggle>
                  ))}
                </div>
              </fieldset>
            )}
          />
          <Controller
            control={form.control}
            name="areas"
            render={({ field }) => (
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-river-800">Khu vực muốn khám phá (bỏ trống để xem tất cả)</legend>
                <div className="flex flex-wrap gap-2">
                  {AREA_OPTIONS.map((o) => (
                    <ChipToggle key={o.value} checked={field.value.includes(o.value)} onChange={(on) => field.onChange(toggle(field.value, o.value, on))}>
                      {o.label}
                    </ChipToggle>
                  ))}
                </div>
              </fieldset>
            )}
          />
          <FormField label="Phương án lập lịch" hint="Trong nhà ưu tiên văn hóa/ẩm thực; gom cụm ưu tiên điểm gần nhau.">
            <Select {...form.register('scenario')}>
              <option value="balanced">Cân bằng sở thích và khoảng cách</option>
              <option value="indoor">Dự phòng — ưu tiên trong nhà</option>
              <option value="compact">Gom cụm — giảm di chuyển</option>
            </Select>
          </FormField>
          {priorityId && <Notice icon={<Info className="size-4" aria-hidden />}>Địa điểm bạn vừa chọn sẽ được ưu tiên xếp vào ngày đầu tiên.</Notice>}
          {user?.preferences && (user.preferences.areas.length > 0 || user.preferences.interests.length > 0) && (
            <Notice icon={<Info className="size-4" aria-hidden />}>
              Đã điền sẵn sở thích từ{' '}
              <Link to="/account" className="font-semibold underline">
                trang cá nhân
              </Link>
              . Bạn vẫn có thể chỉnh trước khi tạo lịch trình.
            </Notice>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="lg" loading={generating} icon={hasPlan ? <RefreshCw className="size-5" aria-hidden /> : <Sparkles className="size-5" aria-hidden />}>
              {hasPlan ? 'Tạo lại lịch trình' : 'Gợi ý lịch trình'}
            </Button>
          </div>
        </form>
      </Card>

      <section id="plan" className="mt-10 scroll-mt-24">
        {!hasPlan ? (
          <EmptyState title="Chưa có lịch trình" description="Chọn tùy chọn ở trên và bấm “Gợi ý lịch trình”. Bạn có thể chỉnh sửa kết quả sau đó." />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="w-full max-w-md">
                <FormField label="Tên lịch trình">
                  <Input value={draft.title} maxLength={120} onChange={(e) => draft.setTitle(e.target.value)} />
                </FormField>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => setConfirmClear(true)} icon={<Trash2 className="size-4" aria-hidden />}>
                  Xóa bản nháp
                </Button>
                {user ? (
                  <Button onClick={save} loading={saving} disabled={!hasItems || draft.title.trim().length < 2} icon={<Save className="size-4" aria-hidden />}>
                    Lưu vào tài khoản
                  </Button>
                ) : null}
              </div>
            </div>

            <Notice tone="info" icon={<Info className="size-4" aria-hidden />} title="Bản nháp trên thiết bị này">
              {user ? (
                'Lịch trình chỉ được lưu vào tài khoản khi bạn bấm “Lưu vào tài khoản”.'
              ) : (
                <>
                  Bản nháp được giữ tạm trong trình duyệt và chưa được lưu lên hệ thống.{' '}
                  <Link to="/login" state={{ from: '/itinerary/create' }} className="font-semibold underline">
                    Đăng nhập
                  </Link>{' '}
                  để lưu và mở lại trên thiết bị khác.
                </>
              )}
            </Notice>

            {draft.warnings.length > 0 && (
              <Notice tone="warning" icon={<AlertTriangle className="size-4" aria-hidden />} title="Lưu ý về độ chính xác">
                <ul className="list-disc space-y-1 pl-4">
                  {draft.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Notice>
            )}
            {alternatives.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {alternatives.map((alt) => (
                  <button
                    key={alt.key}
                    type="button"
                    className="rounded-card border border-sand-200 bg-white p-4 text-left shadow-card hover:border-leaf-400"
                    onClick={() => {
                      const p = draft.preferences;
                      if (!p) return;
                      draft.setPlan({ ...p, scenario: alt.key }, alt.plan.days.map((d) => ({ items: d.items })), alt.plan.warnings);
                      setUnscheduled(alt.plan.unscheduled);
                      setDailyLimit(alt.plan.assumptions.dailyLimitMinutes);
                      setActiveScenario(alt.key);
                      toast.info(alt.label);
                    }}
                  >
                    <p className="text-sm font-semibold text-leaf-800">{alt.label}</p>
                    <p className="mt-1 text-sm text-river-600">{alt.description}</p>
                    <p className="mt-2 text-xs text-river-500">
                      {alt.plan.days.reduce((n, d) => n + d.items.length, 0)} địa điểm
                      {activeScenario === alt.key ? ' · đang xem' : ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
            {unscheduled.length > 0 && (
              <Notice tone="info" title="Địa điểm phù hợp nhưng chưa được xếp">
                <ul className="list-disc space-y-1 pl-4">
                  {unscheduled.map((u) => (
                    <li key={u.destinationId}>
                      {u.name} — {u.reason}
                    </li>
                  ))}
                </ul>
              </Notice>
            )}

            <ItineraryEditor days={draft.days} onChange={draft.setDays} dailyLimitMinutes={dailyLimit} />
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmClear}
        title="Xóa bản nháp lịch trình?"
        message="Bản nháp trên thiết bị này sẽ bị xóa. Lịch trình đã lưu trong tài khoản không bị ảnh hưởng."
        confirmLabel="Xóa bản nháp"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          draft.clear();
          setUnscheduled([]);
          setAlternatives([]);
          setConfirmClear(false);
          toast.info('Đã xóa bản nháp');
        }}
      />
    </PageContainer>
  );
}
