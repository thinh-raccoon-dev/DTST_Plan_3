import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Logo } from '../components/layout/Logo';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField, Input } from '../components/ui/Field';
import { Notice } from '../components/ui/States';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api, applyFieldErrors, toApiError } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});
type LoginValues = z.infer<typeof loginSchema>;

const registerSchema = z
  .object({
    displayName: z.string().trim().min(2, 'Tên hiển thị cần ít nhất 2 ký tự').max(80),
    email: z.string().trim().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
    password: z.string().min(8, 'Mật khẩu cần ít nhất 8 ký tự').max(128),
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Bạn cần đồng ý điều khoản để tiếp tục' }) }),
  })
  .refine((v) => v.password === v.confirmPassword, { message: 'Mật khẩu nhập lại không khớp', path: ['confirmPassword'] });
type RegisterValues = z.infer<typeof registerSchema>;

function safeRedirect(from: unknown, fallback: string): string {
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : fallback;
}

/** Offers to move guest passport entries into the account right after sign-in. */
async function offerDeviceSync() {
  try {
    const res = await api.get<{ pendingDeviceEntries: number }>('/passport/me');
    if (res.data.pendingDeviceEntries > 0) {
      toast.info('Có dữ liệu hộ chiếu trên trình duyệt này', 'Mở trang Hộ chiếu để đồng bộ vào tài khoản.');
    }
  } catch {
    // Optional hint only.
  }
}

function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-10 sm:py-16">
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl">{title}</h1>
        <p className="mt-1 text-sm text-river-600">{description}</p>
        <div className="mt-6">{children}</div>
      </Card>
    </div>
  );
}

function LoginForm({ admin }: { admin: boolean }) {
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const from = (location.state as { from?: string } | null)?.from;

  const onSubmit = async (values: LoginValues) => {
    setFormError(null);
    try {
      const user = await login(values.email, values.password);
      if (admin && user.role !== 'admin' && user.role !== 'partner') {
        await logout();
        setFormError('Tài khoản này không có quyền quản trị hoặc đối tác.');
        return;
      }
      toast.success(`Xin chào, ${user.displayName}`);
      if (!admin) void offerDeviceSync();
      navigate(safeRedirect(from, admin ? '/admin' : '/passport'), { replace: true });
    } catch (error) {
      const apiError = toApiError(error);
      const unplaced = applyFieldErrors(apiError, form.setError, ['email', 'password']);
      if (apiError.fieldIssues.length === 0 || unplaced.length > 0) setFormError(apiError.message);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {formError && <Notice tone="warning">{formError}</Notice>}
      <FormField label="Email" required error={form.formState.errors.email?.message}>
        <Input type="email" autoComplete="email" {...form.register('email')} />
      </FormField>
      <FormField label="Mật khẩu" required error={form.formState.errors.password?.message}>
        <Input type="password" autoComplete="current-password" {...form.register('password')} />
      </FormField>
      <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
        Đăng nhập
      </Button>
    </form>
  );
}

export function LoginPage() {
  useDocumentTitle('Đăng nhập');
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (user) return <Navigate to={safeRedirect((location.state as { from?: string } | null)?.from, '/passport')} replace />;
  return (
    <AuthShell title="Đăng nhập" description="Đăng nhập để lưu hộ chiếu, lịch trình và địa điểm yêu thích vào tài khoản.">
      <LoginForm admin={false} />
      <p className="mt-6 text-center text-sm text-river-600">
        Chưa có tài khoản?{' '}
        <Link to="/register" state={location.state} className="font-semibold text-leaf-700 hover:underline">
          Đăng ký
        </Link>
      </p>
    </AuthShell>
  );
}

export function RegisterPage() {
  useDocumentTitle('Đăng ký');
  const user = useAuthStore((s) => s.user);
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' },
  });
  if (user) return <Navigate to="/passport" replace />;

  const onSubmit = async (values: RegisterValues) => {
    setFormError(null);
    try {
      const created = await register({ email: values.email, password: values.password, displayName: values.displayName });
      toast.success(`Chào mừng, ${created.displayName}!`);
      void offerDeviceSync();
      navigate(safeRedirect((location.state as { from?: string } | null)?.from, '/passport'), { replace: true });
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === 'EMAIL_TAKEN') form.setError('email', { message: apiError.message });
      else {
        const unplaced = applyFieldErrors(apiError, form.setError, ['email', 'password', 'displayName']);
        if (apiError.fieldIssues.length === 0 || unplaced.length > 0) setFormError(apiError.message);
      }
    }
  };

  const errors = form.formState.errors;
  return (
    <AuthShell title="Tạo tài khoản du khách" description="Tài khoản giúp đồng bộ hộ chiếu và lịch trình giữa các thiết bị.">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {formError && <Notice tone="warning">{formError}</Notice>}
        <FormField label="Tên hiển thị" required error={errors.displayName?.message}>
          <Input autoComplete="nickname" {...form.register('displayName')} />
        </FormField>
        <FormField label="Email" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...form.register('email')} />
        </FormField>
        <FormField label="Mật khẩu" required hint="Tối thiểu 8 ký tự." error={errors.password?.message}>
          <Input type="password" autoComplete="new-password" {...form.register('password')} />
        </FormField>
        <FormField label="Nhập lại mật khẩu" required error={errors.confirmPassword?.message}>
          <Input type="password" autoComplete="new-password" {...form.register('confirmPassword')} />
        </FormField>
        <div>
          <label className="flex items-start gap-2 text-sm text-river-700">
            <input type="checkbox" className="mt-0.5 size-4 accent-leaf-600" {...form.register('acceptTerms')} aria-invalid={Boolean(errors.acceptTerms) || undefined} />
            <span>
              Tôi đồng ý với <Link to="/terms" className="font-semibold text-leaf-700 underline">Điều khoản</Link> và{' '}
              <Link to="/privacy" className="font-semibold text-leaf-700 underline">Chính sách quyền riêng tư</Link>.
            </span>
          </label>
          {errors.acceptTerms && <p role="alert" className="mt-1 text-xs font-medium text-red-700">{errors.acceptTerms.message}</p>}
        </div>
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Đăng ký
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-river-600">
        Đã có tài khoản?{' '}
        <Link to="/login" state={location.state} className="font-semibold text-leaf-700 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </AuthShell>
  );
}

export function AdminLoginPage() {
  useDocumentTitle('Đăng nhập quản trị');
  const user = useAuthStore((s) => s.user);
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-river-950 px-4">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <Logo subtitle="QUẢN TRỊ" stacked={false} />
        <h1 className="mt-6 flex items-center gap-2 text-2xl">
          <ShieldCheck className="size-6 text-leaf-600" aria-hidden />
          Đăng nhập quản trị
        </h1>
        <p className="mt-1 text-sm text-river-600">Dành cho quản trị viên và đối tác nội dung.</p>
        <div className="mt-6">
          <LoginForm admin />
        </div>
        <p className="mt-6 text-center text-sm">
          <Link to="/" className="text-river-600 hover:text-leaf-700">← Về trang du khách</Link>
        </p>
      </Card>
    </div>
  );
}
