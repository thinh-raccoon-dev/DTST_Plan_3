import { zodResolver } from '@hookform/resolvers/zod';
import { Save, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { CategoryIcon } from '../components/destination/CategoryIcon';
import { PageContainer } from '../components/layout/PublicLayout';
import { Button } from '../components/ui/Button';
import { Card, SectionHeading } from '../components/ui/Card';
import { ChipToggle, FormField, Input, Select } from '../components/ui/Field';
import { Notice } from '../components/ui/States';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { AREA_OPTIONS, CATEGORY_OPTIONS } from '../lib/catalog';
import { applyFieldErrors, toApiError } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import type { Area, Category } from '../types/api';

const schema = z
  .object({
    displayName: z.string().trim().min(2, 'Tên hiển thị cần ít nhất 2 ký tự').max(80),
    numberOfDays: z.coerce.number().int().min(1).max(7),
    hoursPerDay: z.coerce.number().min(2).max(12),
    areas: z.array(z.string()),
    interests: z.array(z.string()),
    currentPassword: z.string().max(128),
    newPassword: z.string().max(128),
    confirmPassword: z.string().max(128),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword) {
      if (value.newPassword.length < 8) {
        ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'Mật khẩu mới cần ít nhất 8 ký tự' });
      }
      if (!value.currentPassword) {
        ctx.addIssue({ code: 'custom', path: ['currentPassword'], message: 'Nhập mật khẩu hiện tại để đổi mật khẩu' });
      }
      if (value.newPassword !== value.confirmPassword) {
        ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Mật khẩu nhập lại không khớp' });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

function toggle(list: string[], value: string, on: boolean) {
  return on ? [...new Set([...list, value])] : list.filter((v) => v !== value);
}

export function ProfilePage() {
  useDocumentTitle('Trang cá nhân');
  const user = useAuthStore((s) => s.user)!;
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<z.input<typeof schema>, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: user.displayName,
      numberOfDays: user.preferences?.numberOfDays ?? 2,
      hoursPerDay: user.preferences?.hoursPerDay ?? 8,
      areas: user.preferences?.areas ?? [],
      interests: user.preferences?.interests ?? [],
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    try {
      await updateProfile({
        displayName: values.displayName,
        preferences: {
          areas: values.areas as Area[],
          interests: values.interests as Category[],
          numberOfDays: values.numberOfDays,
          hoursPerDay: values.hoursPerDay,
        },
        ...(values.newPassword
          ? { currentPassword: values.currentPassword, newPassword: values.newPassword }
          : {}),
      });
      form.setValue('currentPassword', '');
      form.setValue('newPassword', '');
      form.setValue('confirmPassword', '');
      toast.success('Đã cập nhật trang cá nhân');
    } catch (error) {
      const apiError = toApiError(error);
      const unplaced = applyFieldErrors(apiError, form.setError, [
        'displayName',
        'currentPassword',
        'newPassword',
      ]);
      if (apiError.fieldIssues.length === 0 || unplaced.length > 0) setFormError(apiError.message);
    }
  };

  return (
    <PageContainer width="narrow">
      <SectionHeading
        as="h1"
        title="Trang cá nhân"
        description="Tên hiển thị, sở thích du lịch mặc định cho lịch trình, và đổi mật khẩu."
      />
      <Card className="mt-6 p-5 sm:p-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
          {formError && <Notice tone="warning">{formError}</Notice>}
          <FormField label="Tên hiển thị" required error={form.formState.errors.displayName?.message}>
            <Input autoComplete="name" {...form.register('displayName')} />
          </FormField>
          <FormField label="Email">
            <Input value={user.email} disabled readOnly />
          </FormField>
          <p className="inline-flex items-center gap-2 text-sm text-river-600">
            <UserRound className="size-4" aria-hidden />
            Vai trò: {user.role === 'admin' ? 'Quản trị viên' : user.role === 'partner' ? 'Đối tác' : 'Du khách'}
          </p>

          <div>
            <h2 className="text-base font-semibold text-river-900">Sở thích mặc định</h2>
            <p className="mt-1 text-sm text-river-600">Dùng khi tạo lịch trình mới và gợi ý điểm đến trên trang chủ.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Số ngày" error={form.formState.errors.numberOfDays?.message}>
              <Input type="number" min={1} max={7} inputMode="numeric" {...form.register('numberOfDays')} />
            </FormField>
            <FormField label="Giờ tham quan mỗi ngày">
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
                <legend className="mb-2 text-sm font-medium text-river-800">Loại hình yêu thích</legend>
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
                <legend className="mb-2 text-sm font-medium text-river-800">Khu vực thường đi</legend>
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

          <div>
            <h2 className="text-base font-semibold text-river-900">Đổi mật khẩu</h2>
            <p className="mt-1 text-sm text-river-600">Để trống nếu không muốn đổi.</p>
          </div>
          <FormField label="Mật khẩu hiện tại" error={form.formState.errors.currentPassword?.message}>
            <Input type="password" autoComplete="current-password" {...form.register('currentPassword')} />
          </FormField>
          <FormField label="Mật khẩu mới" error={form.formState.errors.newPassword?.message}>
            <Input type="password" autoComplete="new-password" {...form.register('newPassword')} />
          </FormField>
          <FormField label="Nhập lại mật khẩu mới" error={form.formState.errors.confirmPassword?.message}>
            <Input type="password" autoComplete="new-password" {...form.register('confirmPassword')} />
          </FormField>

          <Button type="submit" size="lg" loading={form.formState.isSubmitting} icon={<Save className="size-5" aria-hidden />}>
            Lưu thay đổi
          </Button>
        </form>
      </Card>
    </PageContainer>
  );
}
