import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ChevronDown, ChevronUp, Pencil, Plus, Power, Save, Trash2, Trophy, X } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch, type FieldPath, type UseFormReturn } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { StatusBadge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField, Input, Select, Textarea } from '../../components/ui/Field';
import { ConfirmDialog } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Navigation';
import { EmptyState, ErrorState, Notice, PageLoader } from '../../components/ui/States';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, toApiError } from '../../lib/api';
import { PUBLICATION_LABELS } from '../../lib/catalog';
import { formatNumber } from '../../lib/format';
import { toast } from '../../stores/toastStore';
import type { AdminChallenge, AdminDestination, Paginated } from '../../types/api';

const STATUS_LABELS = { active: 'Đang mở', inactive: 'Đang tắt' } as const;

export function AdminChallengesPage() {
  useDocumentTitle('Quản lý thử thách');
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AdminChallenge | null>(null);
  const query = useApiQuery(
    (signal) => api.get<Paginated<AdminChallenge>>('/admin/challenges', { params: { status: status || undefined, page }, signal }).then((r) => r.data),
    [status, page],
  );
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: key !== 'page' });
  };

  const toggle = async (c: AdminChallenge) => {
    setBusyId(c.id);
    const next = c.status === 'active' ? 'inactive' : 'active';
    try {
      await api.patch(`/admin/challenges/${c.id}/status`, { status: next });
      toast.success(next === 'active' ? `Đã mở “${c.title}”` : `Đã tắt “${c.title}”`);
      query.reload();
    } catch (error) {
      toast.error('Không cập nhật được', toApiError(error).message);
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusyId(toDelete.id);
    try {
      await api.delete(`/admin/challenges/${toDelete.id}`);
      toast.success(`Đã xóa “${toDelete.title}”`);
      query.reload();
    } catch (error) {
      toast.error('Không xóa được', toApiError(error).message);
    } finally {
      setToDelete(null);
      setBusyId(null);
    }
  };

  const data = query.data;
  return (
    <>
      <AdminPageHeader
        title="Thử thách"
        description="Câu hỏi trắc nghiệm gắn với địa điểm. Đáp án chỉ lưu trên máy chủ; máy chủ chấm điểm và cấp thưởng một lần."
        actions={<ButtonLink to="/admin/challenges/new" icon={<Plus className="size-4" aria-hidden />}>Tạo thử thách</ButtonLink>}
      />
      <Card className="mb-4 flex p-4">
        <Select aria-label="Lọc theo trạng thái" value={status} onChange={(e) => update('status', e.target.value)} className="sm:max-w-60">
          <option value="">Tất cả trạng thái</option>
          <option value="active">{STATUS_LABELS.active}</option>
          <option value="inactive">{STATUS_LABELS.inactive}</option>
        </Select>
      </Card>
      {query.loading && !data ? (
        <PageLoader />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.reload} />
      ) : data && data.items.length === 0 ? (
        <EmptyState icon={<Trophy className="size-6" aria-hidden />} title="Chưa có thử thách" action={<ButtonLink to="/admin/challenges/new">Tạo thử thách</ButtonLink>} />
      ) : data ? (
        <>
          <ul className="space-y-3" aria-busy={query.loading}>
            {data.items.map((c) => (
              <li key={c.id}>
                <Card className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/admin/challenges/${c.id}/edit`} className="font-semibold text-river-900 hover:text-leaf-700">{c.title}</Link>
                      <StatusBadge status={c.status} label={STATUS_LABELS[c.status]} />
                    </div>
                    <p className="mt-1 text-xs text-river-500">
                      {c.destination?.name ?? 'Địa điểm đã bị xóa'} · {c.questions.length} câu · cần đúng {c.scoringRules.minCorrect} · {c.scoringRules.rewardPoints} điểm
                    </p>
                    <p className="mt-1 text-xs text-river-500">
                      {formatNumber(c.attempts)} lượt gửi đáp án · {formatNumber(c.completions)} lượt hoàn thành
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ButtonLink to={`/admin/challenges/${c.id}/edit`} size="sm" variant="secondary" icon={<Pencil className="size-4" aria-hidden />}>Sửa</ButtonLink>
                    <Button size="sm" variant="ghost" icon={<Power className="size-4" aria-hidden />} loading={busyId === c.id} onClick={() => toggle(c)}>
                      {c.status === 'active' ? 'Tắt' : 'Mở'}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-700 hover:bg-red-50" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setToDelete(c)} aria-label={`Xóa ${c.title}`}>
                      Xóa
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Pagination page={data.page} totalPages={data.totalPages} onChange={(p) => update('page', String(p))} />
          </div>
        </>
      ) : null}
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Xóa thử thách?"
        message={
          <>
            Xóa vĩnh viễn <strong>{toDelete?.title}</strong>. Nếu đã có người hoàn thành hoặc có mã QR trỏ tới, hệ thống sẽ từ chối — khi đó hãy tắt thử thách.
          </>
        }
        confirmLabel="Xóa vĩnh viễn"
        loading={Boolean(toDelete && busyId === toDelete.id)}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

const questionSchema = z
  .object({
    prompt: z.string().trim().min(5, 'Câu hỏi cần ít nhất 5 ký tự').max(500),
    options: z.array(z.object({ value: z.string().trim().min(1, 'Không được để trống').max(200) })).min(2, 'Cần ít nhất 2 lựa chọn').max(6),
    correctOptionIndex: z.coerce.number().int().min(0),
    explanation: z.string().trim().max(600),
  })
  .refine((q) => q.correctOptionIndex < q.options.length, { message: 'Chọn đáp án đúng', path: ['correctOptionIndex'] });

const challengeFormSchema = z
  .object({
    destinationId: z.string().min(1, 'Chọn địa điểm'),
    title: z.string().trim().min(3, 'Tên cần ít nhất 3 ký tự').max(160),
    description: z.string().trim().max(1000),
    story: z.string().trim().max(4000),
    rewardPoints: z.coerce.number({ invalid_type_error: 'Nhập số' }).int('Phải là số nguyên').min(0, 'Tối thiểu 0').max(1000, 'Tối đa 1000'),
    minCorrect: z.coerce.number({ invalid_type_error: 'Nhập số' }).int().min(1, 'Tối thiểu 1'),
    status: z.enum(['active', 'inactive']),
    questions: z.array(questionSchema).min(1, 'Cần ít nhất 1 câu hỏi').max(20),
  })
  .refine((v) => v.minCorrect <= v.questions.length, { message: 'Không được lớn hơn số câu hỏi', path: ['minCorrect'] });

type ChallengeFormInput = z.input<typeof challengeFormSchema>;
type ChallengeFormValues = z.output<typeof challengeFormSchema>;

const blankQuestion = () => ({ prompt: '', options: [{ value: '' }, { value: '' }], correctOptionIndex: 0, explanation: '' });

function toFormValues(c: AdminChallenge): ChallengeFormInput {
  return {
    destinationId: c.destinationId,
    title: c.title,
    description: c.description,
    story: c.story,
    rewardPoints: c.scoringRules.rewardPoints,
    minCorrect: c.scoringRules.minCorrect,
    status: c.status,
    questions: c.questions.map((q) => ({
      prompt: q.prompt,
      options: q.options.map((value) => ({ value })),
      correctOptionIndex: q.correctOptionIndex,
      explanation: q.explanation,
    })),
  };
}

function serverPathToField(path: string): FieldPath<ChallengeFormInput> | null {
  if (path === 'scoringRules.rewardPoints') return 'rewardPoints';
  if (path === 'scoringRules.minCorrect') return 'minCorrect';
  const option = /^questions\.(\d+)\.options\.(\d+)$/.exec(path);
  if (option) return `questions.${Number(option[1])}.options.${Number(option[2])}.value`;
  if (/^questions\.\d+\.(prompt|correctOptionIndex|explanation|options)$/.test(path)) return path as FieldPath<ChallengeFormInput>;
  if (['destinationId', 'title', 'description', 'story', 'status', 'questions'].includes(path)) return path as FieldPath<ChallengeFormInput>;
  return null;
}

function OptionsEditor({ index, form, errors }: {
  index: number;
  form: UseFormReturn<ChallengeFormInput, unknown, ChallengeFormValues>;
  errors: { options?: { message?: string; root?: { message?: string } } & Array<{ value?: { message?: string } } | undefined>; correctOptionIndex?: { message?: string } } | undefined;
}) {
  const { control, register, setValue } = form;
  const options = useFieldArray({ control, name: `questions.${index}.options` });
  const correct = Number(useWatch({ control, name: `questions.${index}.correctOptionIndex` }));
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium text-river-800">Lựa chọn (đánh dấu đáp án đúng)</legend>
      {options.fields.map((field, optionIndex) => (
        <div key={field.id} className="flex items-start gap-2">
          <label className="mt-3 flex shrink-0 items-center">
            <input
              type="radio"
              name={`correct-${index}`}
              className="size-4 accent-leaf-600"
              checked={correct === optionIndex}
              onChange={() => setValue(`questions.${index}.correctOptionIndex`, optionIndex, { shouldDirty: true, shouldValidate: true })}
            />
            <span className="sr-only">Đáp án đúng là lựa chọn {optionIndex + 1}</span>
          </label>
          <div className="min-w-0 flex-1">
            <Input
              aria-label={`Lựa chọn ${optionIndex + 1}`}
              aria-invalid={Boolean(errors?.options?.[optionIndex]?.value) || undefined}
              {...register(`questions.${index}.options.${optionIndex}.value`)}
            />
            {errors?.options?.[optionIndex]?.value?.message && (
              <p role="alert" className="mt-1 text-xs font-medium text-red-700">{errors.options[optionIndex]?.value?.message}</p>
            )}
          </div>
          <button
            type="button"
            className="mt-1.5 rounded-full p-2 text-river-500 hover:bg-sand-100 disabled:opacity-30"
            onClick={() => {
              options.remove(optionIndex);
              if (correct >= optionIndex) {
                setValue(`questions.${index}.correctOptionIndex`, correct === optionIndex ? 0 : correct - 1, { shouldDirty: true });
              }
            }}
            disabled={options.fields.length <= 2}
            aria-label={`Bỏ lựa chọn ${optionIndex + 1}`}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
      {(errors?.options?.message || errors?.options?.root?.message || errors?.correctOptionIndex?.message) && (
        <p role="alert" className="text-xs font-medium text-red-700">
          {errors.options?.message ?? errors.options?.root?.message ?? errors.correctOptionIndex?.message}
        </p>
      )}
      <Button size="sm" variant="ghost" icon={<Plus className="size-4" aria-hidden />} disabled={options.fields.length >= 6} onClick={() => options.append({ value: '' })}>
        Thêm lựa chọn
      </Button>
    </fieldset>
  );
}

function ChallengeForm({ initial, id }: { initial?: AdminChallenge; id?: string }) {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const destinations = useApiQuery(
    (signal) => api.get<Paginated<AdminDestination>>('/admin/destinations', { params: { limit: 100 }, signal }).then((r) => r.data.items),
    [],
  );
  const form = useForm<ChallengeFormInput, unknown, ChallengeFormValues>({
    resolver: zodResolver(challengeFormSchema),
    defaultValues: initial
      ? toFormValues(initial)
      : { destinationId: '', title: '', description: '', story: '', rewardPoints: 30, minCorrect: 1, status: 'inactive', questions: [blankQuestion()] },
  });
  const questions = useFieldArray({ control: form.control, name: 'questions' });
  const { errors, isSubmitting, isDirty } = form.formState;

  const onSubmit = async (v: ChallengeFormValues) => {
    setFormError(null);
    const body = {
      destinationId: v.destinationId,
      title: v.title,
      description: v.description,
      story: v.story,
      status: v.status,
      scoringRules: { rewardPoints: v.rewardPoints, minCorrect: v.minCorrect },
      questions: v.questions.map((q) => ({
        prompt: q.prompt,
        options: q.options.map((o) => o.value),
        correctOptionIndex: q.correctOptionIndex,
        ...(q.explanation ? { explanation: q.explanation } : {}),
      })),
    };
    try {
      const res = id
        ? await api.put<{ challenge: AdminChallenge }>(`/admin/challenges/${id}`, body)
        : await api.post<{ challenge: AdminChallenge }>('/admin/challenges', body);
      toast.success(id ? 'Đã lưu thử thách' : 'Đã tạo thử thách', res.data.challenge.title);
      if (id) form.reset(toFormValues(res.data.challenge));
      else navigate(`/admin/challenges/${res.data.challenge.id}/edit`, { replace: true });
    } catch (error) {
      const apiError = toApiError(error);
      const unplaced = apiError.fieldIssues.filter((issue) => {
        const field = serverPathToField(issue.path);
        if (field) form.setError(field, { type: 'server', message: issue.message });
        return !field;
      });
      setFormError(unplaced.length ? unplaced.map((i) => i.message).join('; ') : apiError.message);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit, () => setFormError('Vui lòng kiểm tra các trường được đánh dấu.'))} noValidate className="space-y-5">
      {formError && <Notice tone="warning" title="Chưa lưu được">{formError}</Notice>}
      {initial && initial.completions > 0 && (
        <Notice tone="info">
          Đã có {initial.completions} lượt hoàn thành. Thay đổi câu hỏi không ảnh hưởng điểm đã cấp; người đã hoàn thành sẽ không được cộng điểm lần nữa.
        </Notice>
      )}
      <Card className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <FormField label="Tên thử thách" required error={errors.title?.message} className="sm:col-span-2">
          <Input {...form.register('title')} />
        </FormField>
        <FormField label="Địa điểm" required error={errors.destinationId?.message ?? (destinations.error ? 'Không tải được danh sách địa điểm' : undefined)} className="sm:col-span-2">
          <Select {...form.register('destinationId')} disabled={destinations.loading}>
            <option value="">{destinations.loading ? 'Đang tải…' : '— Chọn địa điểm —'}</option>
            {destinations.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.publicationStatus !== 'published' ? ` (${PUBLICATION_LABELS[d.publicationStatus].toLowerCase()})` : ''}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Mô tả ngắn" error={errors.description?.message} className="sm:col-span-2">
          <Textarea rows={2} {...form.register('description')} />
        </FormField>
        <FormField label="Câu chuyện / nội dung trước câu hỏi" error={errors.story?.message} className="sm:col-span-2">
          <Textarea rows={4} {...form.register('story')} />
        </FormField>
        <FormField label="Điểm thưởng" required hint="Chỉ cấp một lần cho mỗi tài khoản/trình duyệt." error={errors.rewardPoints?.message}>
          <Input type="number" min={0} max={1000} inputMode="numeric" {...form.register('rewardPoints')} />
        </FormField>
        <FormField label="Số câu đúng tối thiểu" required error={errors.minCorrect?.message}>
          <Input type="number" min={1} inputMode="numeric" {...form.register('minCorrect')} />
        </FormField>
        <FormField label="Trạng thái" hint="Thử thách chỉ hiển thị khi đang mở và địa điểm đã xuất bản." error={errors.status?.message}>
          <Select {...form.register('status')}>
            <option value="inactive">{STATUS_LABELS.inactive}</option>
            <option value="active">{STATUS_LABELS.active}</option>
          </Select>
        </FormField>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg">Câu hỏi ({questions.fields.length})</h2>
        <Button size="sm" variant="secondary" icon={<Plus className="size-4" aria-hidden />} disabled={questions.fields.length >= 20} onClick={() => questions.append(blankQuestion())}>
          Thêm câu hỏi
        </Button>
      </div>
      {errors.questions?.root?.message && <Notice tone="warning">{errors.questions.root.message}</Notice>}
      <ol className="space-y-4">
        {questions.fields.map((field, index) => (
          <li key={field.id}>
            <Card className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base">Câu {index + 1}</h3>
                <div className="flex gap-1">
                  <button type="button" className="rounded-full p-2 hover:bg-sand-100 disabled:opacity-30" disabled={index === 0} onClick={() => questions.move(index, index - 1)} aria-label={`Đưa câu ${index + 1} lên`}>
                    <ChevronUp className="size-4" aria-hidden />
                  </button>
                  <button type="button" className="rounded-full p-2 hover:bg-sand-100 disabled:opacity-30" disabled={index === questions.fields.length - 1} onClick={() => questions.move(index, index + 1)} aria-label={`Đưa câu ${index + 1} xuống`}>
                    <ChevronDown className="size-4" aria-hidden />
                  </button>
                  <button type="button" className="rounded-full p-2 text-red-700 hover:bg-red-50 disabled:opacity-30" disabled={questions.fields.length <= 1} onClick={() => questions.remove(index)} aria-label={`Xóa câu ${index + 1}`}>
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
              <FormField label="Nội dung câu hỏi" required error={errors.questions?.[index]?.prompt?.message}>
                <Textarea rows={2} {...form.register(`questions.${index}.prompt`)} />
              </FormField>
              <OptionsEditor index={index} form={form} errors={errors.questions?.[index] as never} />
              <FormField label="Giải thích (hiển thị sau khi hoàn thành)" error={errors.questions?.[index]?.explanation?.message}>
                <Textarea rows={2} {...form.register(`questions.${index}.explanation`)} />
              </FormField>
            </Card>
          </li>
        ))}
      </ol>

      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t border-sand-200 bg-sand-50/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <Button type="submit" loading={isSubmitting} disabled={Boolean(id) && !isDirty} icon={<Save className="size-4" aria-hidden />}>
          {id ? 'Lưu thay đổi' : 'Tạo thử thách'}
        </Button>
      </div>
    </form>
  );
}

export function AdminChallengeFormPage() {
  const { id } = useParams();
  useDocumentTitle(id ? 'Sửa thử thách' : 'Tạo thử thách');
  const query = useApiQuery(
    (signal) => (id ? api.get<{ challenge: AdminChallenge }>(`/admin/challenges/${id}`, { signal }).then((r) => r.data.challenge) : Promise.resolve(null)),
    [id],
  );
  return (
    <>
      <Link to="/admin/challenges" className="mb-3 inline-flex items-center gap-1 text-sm text-river-600 hover:text-leaf-700">
        <ArrowLeft className="size-4" aria-hidden /> Danh sách thử thách
      </Link>
      <AdminPageHeader
        title={id ? query.data?.title ?? 'Sửa thử thách' : 'Tạo thử thách'}
        description={query.data ? `${formatNumber(query.data.attempts)} lượt gửi đáp án · ${formatNumber(query.data.completions)} lượt hoàn thành` : undefined}
      />
      {id && query.loading ? (
        <PageLoader />
      ) : id && (query.error || !query.data) ? (
        <ErrorState error={query.error} onRetry={query.reload} />
      ) : (
        <ChallengeForm key={id ?? 'new'} id={id} initial={query.data ?? undefined} />
      )}
    </>
  );
}
