import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Bot,
  Camera,
  Check,
  Eye,
  EyeOff,
  Gift,
  KeyRound,
  Lock,
  Mail,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../components/ui/Button';
import { FormField, Input } from '../components/ui/Field';
import { Notice } from '../components/ui/States';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api, applyFieldErrors, toApiError } from '../lib/api';
import { consumeCopilotAuthHandoff, hasPendingCopilotAuth } from '../lib/copilotAuthHandoff';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';

type AuthMode = 'login' | 'register';

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
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Mật khẩu nhập lại không khớp',
    path: ['confirmPassword'],
  });
type RegisterValues = z.infer<typeof registerSchema>;

function safeRedirect(from: unknown, fallback: string): string {
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : fallback;
}

function defaultHomeForRole(role: string | undefined): string {
  if (role === 'admin') return '/admin';
  if (role === 'partner') return '/admin/partner';
  return '/passport';
}

/** Smart post-login route: respects `from` when permitted for the signed-in role, otherwise sends each role straight to its workspace. */
function resolvePostLoginPath(role: string | undefined, from: unknown): string {
  const fallback = defaultHomeForRole(role);
  const candidate = safeRedirect(from, '');
  if (!candidate || candidate === '/login' || candidate === '/register' || candidate === '/admin/login') {
    return fallback;
  }
  if (candidate.startsWith('/admin')) {
    if (role === 'admin') return candidate;
    if (role === 'partner') return candidate === '/admin' ? '/admin/partner' : candidate;
    return fallback;
  }
  return candidate;
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

function evaluatePasswordStrength(password: string): { score: 0 | 1 | 2 | 3; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: 'bg-sand-200' };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;

  if (password.length < 8) {
    return { score: 1, label: 'Cần thêm ký tự (tối thiểu 8)', color: 'bg-amber-500' };
  }
  if (score <= 1) return { score: 1, label: 'Đủ độ dài tối thiểu', color: 'bg-amber-500' };
  if (score === 2) return { score: 2, label: 'Mật khẩu khá tốt', color: 'bg-leaf-500' };
  return { score: 3, label: 'Mật khẩu mạnh', color: 'bg-emerald-600' };
}

/** Keeps inactive slide-out form non-focusable for keyboard & screen readers. */
function useInertRef(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current as (HTMLDivElement & { inert?: boolean }) | null;
    if (node) node.inert = !active;
  }, [active]);
  return ref;
}

/** Input with crisp leading icon and optional show/hide password toggle. */
const IconInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    icon: ReactNode;
    invalid?: boolean;
    passwordToggle?: boolean;
  }
>(function IconInput({ icon, className, invalid, passwordToggle, type, ...rest }, ref) {
  const [visible, setVisible] = useState(false);
  const resolvedType = passwordToggle ? (visible ? 'text' : 'password') : type;

  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-river-400"
        aria-hidden
      >
        {icon}
      </span>
      <Input
        ref={ref}
        type={resolvedType}
        invalid={invalid}
        className={clsx(
          'bg-sand-50/85 pl-10 transition-colors focus:bg-white',
          passwordToggle ? 'pr-11' : 'pr-4',
          className,
        )}
        {...rest}
      />
      {passwordToggle && (
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          className="absolute inset-y-0 right-1.5 my-auto inline-flex size-9 items-center justify-center rounded-xl text-river-400 transition-colors hover:bg-sand-100 hover:text-river-700 focus-visible:outline-2 focus-visible:outline-leaf-600"
        >
          {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      )}
    </div>
  );
});

const LOGIN_HIGHLIGHTS = [
  {
    icon: Award,
    title: 'Hộ chiếu Trải nghiệm Số',
    desc: 'Lưu dấu chân GPS, tích điểm & mở khóa bộ huy hiệu Đất Sen Hồng.',
  },
  {
    icon: Camera,
    title: 'Bản đồ Ký ức & Locket',
    desc: 'Chụp nhanh khoảnh khắc gắn tọa độ trực tiếp lên bản đồ cá nhân.',
  },
  {
    icon: Bot,
    title: 'Trợ lý du lịch AI Pé Meko',
    desc: 'Lập lịch trình V9 thông minh và gợi ý điểm đến theo thời gian thực.',
  },
];

const REGISTER_HIGHLIGHTS = [
  {
    icon: RefreshCw,
    title: 'Đồng bộ xuyên thiết bị',
    desc: 'Tự động gộp dấu chân & ảnh kỷ niệm bạn đã chụp trên trình duyệt này.',
  },
  {
    icon: Gift,
    title: 'Ưu đãi điểm đến hấp dẫn',
    desc: 'Nhận mã giảm giá độc quyền tại các khu du lịch & nhà vườn Đồng Tháp.',
  },
  {
    icon: ShieldCheck,
    title: 'Riêng tư & an toàn',
    desc: 'Toàn quyền quản lý lịch trình, hộ chiếu và ảnh kỷ niệm cá nhân.',
  },
];

/** Mobile-only single switcher pill inside compact emerald header. */
function MobileModeSwitcher({
  mode,
  onSwitch,
}: {
  mode: AuthMode;
  onSwitch: (next: AuthMode) => void;
}) {
  const isRegister = mode === 'register';
  return (
    <div
      role="tablist"
      aria-label="Chuyển giữa đăng nhập và đăng ký"
      className="relative grid grid-cols-2 rounded-full bg-white/12 p-1 ring-1 ring-white/18 backdrop-blur-sm"
    >
      <span
        aria-hidden
        style={{ transform: isRegister ? 'translate3d(100%, 0, 0)' : 'translate3d(0%, 0, 0)' }}
        className="auth-tab-pill pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-sm"
      />
      <button
        type="button"
        role="tab"
        aria-selected={!isRegister}
        onClick={() => onSwitch('login')}
        className={clsx(
          'relative z-10 min-h-9 rounded-full px-3 text-sm font-semibold transition-colors duration-200',
          !isRegister ? 'text-leaf-900' : 'text-white/85 hover:text-white',
        )}
      >
        Đăng nhập
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={isRegister}
        onClick={() => onSwitch('register')}
        className={clsx(
          'relative z-10 min-h-9 rounded-full px-3 text-sm font-semibold transition-colors duration-200',
          isRegister ? 'text-leaf-900' : 'text-white/85 hover:text-white',
        )}
      >
        Đăng ký
      </button>
    </div>
  );
}

function CurtainSlide({
  eyebrowAccent,
  headlineLead,
  headlineAccent,
  headlineAccentClass,
  subtitle,
  highlights,
  iconBgClass,
  switchLabel,
  switchCta,
  switchIconPos,
  onSwitch,
}: {
  eyebrowAccent: string;
  headlineLead: string;
  headlineAccent: string;
  headlineAccentClass: string;
  subtitle: string;
  highlights: typeof LOGIN_HIGHLIGHTS;
  iconBgClass: string;
  switchLabel: string;
  switchCta: string;
  switchIconPos: 'left' | 'right';
  onSwitch: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col justify-between p-9">
      {/* Top Brand Crest */}
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 p-1.5 ring-1 ring-white/20 backdrop-blur-sm">
          <img src="/images/logo-mark.png" alt="Logo Đồng Tháp Smart Travel" className="size-full object-contain" />
        </div>
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-teal-200">
            <Sparkles className={clsx('size-3.5', eyebrowAccent)} aria-hidden />
            Đất Sen Hồng
          </p>
          <p className="truncate text-sm font-semibold text-white/90">Đồng Tháp Smart Travel</p>
        </div>
      </div>

      {/* Main Story & Highlights */}
      <div className="my-auto flex flex-col gap-5 py-6">
        <div>
          <h2 className="text-[1.75rem] font-extrabold leading-[1.2] tracking-tight text-white">
            {headlineLead}{' '}
            <span className={headlineAccentClass}>{headlineAccent}</span>
          </h2>
          <p className="mt-2.5 text-sm leading-relaxed text-leaf-100/90">{subtitle}</p>
        </div>

        <ul className="space-y-2.5">
          {highlights.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.title}
                className="flex items-start gap-3 rounded-2xl border border-white/12 bg-white/[0.06] px-3.5 py-3 backdrop-blur-xs"
              >
                <span
                  className={clsx(
                    'mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl ring-1',
                    iconBgClass,
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-leaf-100/80">{item.desc}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Single Desktop Switch Control */}
      <div className="border-t border-white/12 pt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-leaf-100/85">{switchLabel}</p>
          <Button
            type="button"
            variant="inverted"
            size="sm"
            onClick={onSwitch}
            className="shrink-0 shadow-sm"
          >
            {switchIconPos === 'left' && <ArrowLeft className="size-3.5" aria-hidden />}
            {switchCta}
            {switchIconPos === 'right' && <ArrowRight className="size-3.5" aria-hidden />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditorialShowcaseCurtain({
  isRegister,
  onSwitch,
}: {
  isRegister: boolean;
  onSwitch: (next: AuthMode) => void;
}) {
  const loginSlideRef = useInertRef(!isRegister);
  const registerSlideRef = useInertRef(isRegister);

  return (
    <aside
      aria-label="Giới thiệu Đồng Tháp Smart Travel"
      className="auth-curtain absolute inset-y-0 left-0 z-20 hidden w-1/2 overflow-hidden bg-gradient-to-br from-[#071f18] via-[#0e392c] to-[#155741] text-white shadow-[0_0_48px_-12px_rgba(7,31,24,0.58)] ring-1 ring-inset ring-white/10 lg:block"
    >
      {/* Subtle botanical Mekong topographic lines — strictly low-contrast & behind content */}
      <svg
        viewBox="0 0 480 640"
        fill="none"
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full opacity-[0.11]"
      >
        <path
          d="M-40 120C60 80 140 170 250 135C360 100 410 35 520 70"
          stroke="#dcebd4"
          strokeWidth="1.25"
        />
        <path
          d="M-30 295C85 245 165 340 285 295C385 258 430 205 525 235"
          stroke="#efa4b5"
          strokeWidth="1"
        />
        <path
          d="M-50 475C75 435 190 520 315 470C410 432 455 390 530 420"
          stroke="#d4bb74"
          strokeWidth="1.2"
        />
        <circle cx="405" cy="540" r="145" stroke="#efa4b5" strokeWidth="1" strokeDasharray="4 7" />
        <circle cx="405" cy="540" r="95" stroke="#dcebd4" strokeWidth="0.9" />
      </svg>

      {/* Soft lotus warmth tucked strictly in bottom-right corner — never washes over text */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-20 size-72 rounded-full bg-lotus-400/20 blur-3xl"
      />
      <img
        src="/images/lotus_flower_3.png"
        alt=""
        aria-hidden
        draggable={false}
        className="pointer-events-none absolute -bottom-8 -right-10 w-56 select-none opacity-[0.16] mix-blend-screen"
      />

      {/* Panoramic 200% track counter-slides cleanly across the curtain viewport */}
      <div className="auth-curtain-track relative z-10">
        <div ref={loginSlideRef} aria-hidden={isRegister} className="h-full w-1/2 shrink-0">
          <CurtainSlide
            eyebrowAccent="text-lotus-300"
            headlineLead="Chào mừng trở lại hành trình"
            headlineAccent="Đất Sen Hồng"
            headlineAccentClass="text-lotus-200"
            subtitle="Mở lại lịch trình, bản đồ ký ức và hộ chiếu trải nghiệm của bạn ngay tại nơi dừng chân gần nhất."
            highlights={LOGIN_HIGHLIGHTS}
            iconBgClass="bg-lotus-400/20 text-lotus-200 ring-lotus-300/25"
            switchLabel="Lần đầu ghé Đồng Tháp Go?"
            switchCta="Tạo tài khoản mới"
            switchIconPos="right"
            onSwitch={() => onSwitch('register')}
          />
        </div>
        <div ref={registerSlideRef} aria-hidden={!isRegister} className="h-full w-1/2 shrink-0">
          <CurtainSlide
            eyebrowAccent="text-teal-200"
            headlineLead="Mở Hộ chiếu Số &"
            headlineAccent="Khám phá Đồng Tháp"
            headlineAccentClass="text-teal-200"
            subtitle="Khởi tạo tài khoản miễn phí trong vài giây để đồng bộ lịch trình V9, bản đồ dấu chân ảnh và ưu đãi điểm đến."
            highlights={REGISTER_HIGHLIGHTS}
            iconBgClass="bg-teal-300/20 text-teal-200 ring-teal-200/25"
            switchLabel="Đã có tài khoản sẵn?"
            switchCta="Đăng nhập ngay"
            switchIconPos="left"
            onSwitch={() => onSwitch('login')}
          />
        </div>
      </div>
    </aside>
  );
}

function LoginFormPanel({ active }: { active: boolean }) {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [aiAutoRunning, setAiAutoRunning] = useState(false);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const from = (location.state as { from?: string } | null)?.from;
  const lastRunRef = useRef<string | null>(null);

  const onSubmit = async (values: LoginValues) => {
    setFormError(null);
    try {
      const user = await login(values.email, values.password);
      toast.success(`Xin chào, ${user.displayName}`);
      if (user.role === 'tourist') void offerDeviceSync();
      navigate(resolvePostLoginPath(user.role, from), { replace: true });
    } catch (error) {
      const apiError = toApiError(error);
      const unplaced = applyFieldErrors(apiError, form.setError, ['email', 'password']);
      if (apiError.fieldIssues.length === 0 || unplaced.length > 0) setFormError(apiError.message);
    } finally {
      setAiAutoRunning(false);
    }
  };

  useEffect(() => {
    if (!active) return;
    const emailParam = searchParams.get('email');
    if (emailParam) form.setValue('email', emailParam);

    // Strip any legacy sensitive query parameters if someone opens an old URL
    if (searchParams.has('password') || searchParams.has('autoSubmit')) {
      navigate('/login', { replace: true });
    }
  }, [active, searchParams, navigate, form]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const applyHandoff = () => {
      const handoff = consumeCopilotAuthHandoff('login');
      if (!handoff || lastRunRef.current === handoff.runId) return;
      form.setValue('email', handoff.email);
      form.setValue('password', handoff.password);
      setAiAutoRunning(true);
      timer = setTimeout(() => {
        if (lastRunRef.current === handoff.runId) return;
        lastRunRef.current = handoff.runId;
        void onSubmit({ email: handoff.email, password: handoff.password });
      }, 250);
    };
    applyHandoff();
    window.addEventListener('pe-meko:auth-handoff', applyHandoff);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('pe-meko:auth-handoff', applyHandoff);
    };
  }, []);

  const HeadingTag = active ? 'h1' : 'h2';

  return (
    <div className="flex h-full flex-col justify-center">
      <div className="mb-7">
        <p className="eyebrow">Chào mừng trở lại</p>
        <HeadingTag className="mt-2 text-2xl font-extrabold tracking-tight text-river-900 sm:text-[1.85rem]">
          Đăng nhập
        </HeadingTag>
        <p className="mt-1.5 text-sm leading-relaxed text-river-600">
          Nhập email và mật khẩu để tiếp tục hành trình khám phá Đồng Tháp.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {aiAutoRunning && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-leaf-300 bg-leaf-50 px-3.5 py-2.5 text-xs font-semibold text-leaf-900">
            <Bot className="size-4 shrink-0 animate-bounce text-leaf-600" />
            <span>Pé Meko đang tự động điền thông tin và đăng nhập cho bạn...</span>
          </div>
        )}
        {formError && <Notice tone="warning">{formError}</Notice>}

        <FormField label="Email" required error={form.formState.errors.email?.message}>
          <IconInput
            type="email"
            autoComplete="email"
            placeholder="ban@example.com"
            icon={<Mail className="size-4" />}
            {...form.register('email')}
          />
        </FormField>

        <FormField label="Mật khẩu" required error={form.formState.errors.password?.message}>
          <IconInput
            passwordToggle
            autoComplete="current-password"
            placeholder="Nhập mật khẩu của bạn"
            icon={<Lock className="size-4" />}
            {...form.register('password')}
          />
        </FormField>

        <Button
          type="submit"
          size="lg"
          className="mt-2 w-full"
          loading={form.formState.isSubmitting || aiAutoRunning}
        >
          Đăng nhập
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </form>
    </div>
  );
}

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function OtpCodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');

  useEffect(() => {
    const timer = setTimeout(() => {
      inputsRef.current[0]?.focus();
    }, 120);
    return () => clearTimeout(timer);
  }, []);

  const updateAt = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) {
      const nextArr = [...digits];
      nextArr[index] = '';
      onChange(nextArr.join(''));
      return;
    }

    // Handle typing or autofill of multiple digits in one box
    const nextArr = [...digits];
    let cursor = index;
    for (const ch of clean) {
      if (cursor >= 6) break;
      nextArr[cursor] = ch;
      cursor += 1;
    }
    const joined = nextArr.join('');
    onChange(joined);

    if (cursor < 6) {
      inputsRef.current[cursor]?.focus();
    } else {
      inputsRef.current[5]?.focus();
      if (joined.length === 6 && onComplete) onComplete(joined);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      e.preventDefault();
      const nextArr = [...digits];
      nextArr[index - 1] = '';
      onChange(nextArr.join(''));
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    const focusIdx = Math.min(5, pasted.length);
    inputsRef.current[focusIdx]?.focus();
    if (pasted.length === 6 && onComplete) onComplete(pasted);
  };

  return (
    <div className="grid grid-cols-6 gap-2 sm:gap-2.5" role="group" aria-label="Mã xác thực OTP 6 chữ số">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Chữ số OTP thứ ${index + 1}`}
          disabled={disabled}
          value={digit}
          onChange={(e) => updateAt(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          className={clsx(
            'h-13 w-full rounded-2xl border bg-sand-50/90 text-center font-mono text-xl font-extrabold text-river-900 shadow-xs transition-all focus:bg-white focus:outline-none focus:ring-2 sm:h-14 sm:text-2xl',
            invalid
              ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
              : digit
                ? 'border-leaf-500 bg-white focus:border-leaf-600 focus:ring-leaf-100'
                : 'border-sand-300 focus:border-leaf-600 focus:ring-leaf-100',
          )}
        />
      ))}
    </div>
  );
}

function RegisterFormPanel({ active }: { active: boolean }) {
  const user = useAuthStore((s) => s.user);
  const requestRegisterOtp = useAuthStore((s) => s.requestRegisterOtp);
  const verifyRegisterOtp = useAuthStore((s) => s.verifyRegisterOtp);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [aiAutoRunning, setAiAutoRunning] = useState(false);
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [pendingValues, setPendingValues] = useState<RegisterValues | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [expiresInSec, setExpiresInSec] = useState(0);
  const [resendCooldownSec, setResendCooldownSec] = useState(0);
  const [devPreviewCode, setDevPreviewCode] = useState<string | null>(null);
  const lastRunRef = useRef<string | null>(null);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' },
  });

  const watchedPassword = form.watch('password') || '';
  const strength = useMemo(() => evaluatePasswordStrength(watchedPassword), [watchedPassword]);

  // Live 1s countdowns for OTP expiry & resend cooldown
  useEffect(() => {
    if (step !== 'otp') return;
    const interval = setInterval(() => {
      setExpiresInSec((s) => (s > 0 ? s - 1 : 0));
      setResendCooldownSec((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  const onRequestOtp = async (values: RegisterValues) => {
    setFormError(null);
    setOtpError(null);
    try {
      const res = await requestRegisterOtp({
        email: values.email,
        password: values.password,
        displayName: values.displayName,
      });
      setPendingValues(values);
      setOtpCode('');
      setExpiresInSec(res.expiresInSeconds);
      setResendCooldownSec(res.resendCooldownSeconds);
      setDevPreviewCode(res.devPreviewCode ?? null);
      setStep('otp');
      toast.success(
        res.deliveryMode === 'preview'
          ? 'Đã tạo mã OTP xem thử cho môi trường local'
          : `Đã gửi mã xác thực 6 số tới ${res.email}`,
      );
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === 'EMAIL_TAKEN') {
        try {
          const loggedIn = await login(values.email, values.password);
          toast.success(`Email đã có tài khoản — đã tự động đăng nhập vào ${loggedIn.displayName}!`);
          window.dispatchEvent(
            new CustomEvent('pe-meko:bot-notice', {
              detail: {
                text: `✅ **Pé Meko báo cáo:** Email \`${values.email}\` đã được đăng ký trước đó — Pé Meko đã tự động đăng nhập thẳng vào tài khoản **${loggedIn.displayName}** cho bạn!`,
              },
            }),
          );
          void offerDeviceSync();
          navigate(safeRedirect((location.state as { from?: string } | null)?.from, '/passport'), { replace: true });
          return;
        } catch {
          form.setError('email', { message: apiError.message });
        }
      } else {
        const unplaced = applyFieldErrors(apiError, form.setError, ['email', 'password', 'displayName']);
        if (apiError.fieldIssues.length === 0 || unplaced.length > 0) setFormError(apiError.message);
      }
    } finally {
      setAiAutoRunning(false);
    }
  };

  const handleVerifyOtp = async (codeOverride?: string) => {
    if (!pendingValues || verifyingOtp) return;
    const code = (codeOverride ?? otpCode).replace(/\D/g, '');
    if (code.length !== 6) {
      setOtpError('Vui lòng nhập đủ 6 chữ số xác thực.');
      return;
    }

    setOtpError(null);
    setVerifyingOtp(true);
    try {
      if (user) {
        await logout();
      }
      const created = await verifyRegisterOtp({
        email: pendingValues.email,
        password: pendingValues.password,
        displayName: pendingValues.displayName,
        otp: code,
      });
      toast.success(`Xác thực thành công! Chào mừng ${created.displayName}!`);
      window.dispatchEvent(
        new CustomEvent('pe-meko:bot-notice', {
          detail: {
            text: `🎉 **Pé Meko báo cáo:** Đã xác thực email và tạo tài khoản thành công cho **${created.displayName}** (\`${pendingValues.email}\`)!`,
          },
        }),
      );
      void offerDeviceSync();
      navigate(safeRedirect((location.state as { from?: string } | null)?.from, '/passport'), { replace: true });
    } catch (error) {
      const apiError = toApiError(error);
      setOtpError(apiError.message);
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (!pendingValues || resendCooldownSec > 0 || resendingOtp) return;
    setOtpError(null);
    setResendingOtp(true);
    try {
      const res = await requestRegisterOtp({
        email: pendingValues.email,
        password: pendingValues.password,
        displayName: pendingValues.displayName,
      });
      setOtpCode('');
      setExpiresInSec(res.expiresInSeconds);
      setResendCooldownSec(res.resendCooldownSeconds);
      setDevPreviewCode(res.devPreviewCode ?? null);
      toast.success(`Đã gửi lại mã OTP mới tới ${res.email}`);
    } catch (error) {
      const apiError = toApiError(error);
      setOtpError(apiError.message);
    } finally {
      setResendingOtp(false);
    }
  };

  useEffect(() => {
    if (!active) return;
    const emailParam = searchParams.get('email');
    const displayNameParam = searchParams.get('displayName');
    if (emailParam) {
      form.setValue('email', emailParam);
      const fallbackName = displayNameParam || emailParam.split('@')[0] || 'Du khách Đồng Tháp';
      form.setValue('displayName', fallbackName.length >= 2 ? fallbackName : `${fallbackName} DT`);
    } else if (displayNameParam) {
      form.setValue('displayName', displayNameParam);
    }

    if (searchParams.has('password') || searchParams.has('autoSubmit')) {
      navigate('/register', { replace: true });
    }
  }, [active, searchParams, navigate, form]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const applyHandoff = () => {
      const handoff = consumeCopilotAuthHandoff('register');
      if (!handoff || lastRunRef.current === handoff.runId) return;
      const derivedName = handoff.displayName || handoff.email.split('@')[0] || 'Du khách Đồng Tháp';
      const safeName = derivedName.length >= 2 ? derivedName : `${derivedName} DT`;
      form.setValue('email', handoff.email);
      form.setValue('displayName', safeName);
      form.setValue('password', handoff.password);
      form.setValue('confirmPassword', handoff.password);
      form.setValue('acceptTerms', true as never);
      setAiAutoRunning(true);
      timer = setTimeout(() => {
        if (lastRunRef.current === handoff.runId) return;
        lastRunRef.current = handoff.runId;
        void onRequestOtp({
          displayName: safeName,
          email: handoff.email,
          password: handoff.password,
          confirmPassword: handoff.password,
          acceptTerms: true,
        });
      }, 250);
    };
    applyHandoff();
    window.addEventListener('pe-meko:auth-handoff', applyHandoff);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('pe-meko:auth-handoff', applyHandoff);
    };
  }, []);

  const errors = form.formState.errors;
  const HeadingTag = active ? 'h1' : 'h2';

  if (step === 'otp' && pendingValues) {
    return (
      <div className="tp-fade-up flex h-full flex-col justify-center">
        <button
          type="button"
          onClick={() => {
            setStep('details');
            setOtpError(null);
          }}
          className="mb-5 inline-flex w-fit items-center gap-1.5 rounded-full border border-sand-200 bg-sand-50 px-3 py-1.5 text-xs font-semibold text-river-700 transition-colors hover:border-leaf-300 hover:bg-leaf-50 hover:text-leaf-800"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Sửa thông tin / Đổi email
        </button>

        <div className="mb-6">
          <div className="mb-3">
            <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-leaf-50 text-leaf-700 ring-1 ring-leaf-200">
              <MailCheck className="size-5" aria-hidden />
            </span>
          </div>
          <p className="eyebrow">Bước 2 / 2 · Xác thực email</p>
          <HeadingTag className="mt-2 text-2xl font-extrabold tracking-tight text-river-900 sm:text-[1.75rem]">
            Nhập mã xác thực OTP
          </HeadingTag>
          <p className="mt-1.5 text-sm leading-relaxed text-river-600">
            Mã xác thực 6 chữ số đã được gửi tới{' '}
            <strong className="font-semibold text-river-900">{pendingValues.email}</strong>. Kiểm tra hộp thư đến hoặc mục Quảng cáo / Spam.
          </p>
        </div>

        <div className="space-y-4">
          {devPreviewCode && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-teal-200 bg-teal-50/75 px-3.5 py-2.5 text-xs text-teal-900">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 shrink-0 text-teal-700" aria-hidden />
                <span>
                  Chế độ xem thử local: <strong className="font-mono text-sm tracking-widest">{devPreviewCode}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOtpCode(devPreviewCode);
                  void handleVerifyOtp(devPreviewCode);
                }}
                className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-leaf-700 ring-1 ring-teal-200 transition-colors hover:bg-leaf-50"
              >
                Điền nhanh
              </button>
            </div>
          )}

          {otpError && <Notice tone="warning">{otpError}</Notice>}

          <OtpCodeInput
            value={otpCode}
            onChange={(next) => {
              setOtpCode(next);
              if (otpError) setOtpError(null);
            }}
            onComplete={(code) => void handleVerifyOtp(code)}
            disabled={verifyingOtp}
            invalid={Boolean(otpError)}
          />

          <div className="flex items-center justify-between gap-2 rounded-2xl bg-sand-50/90 px-3.5 py-2.5 text-xs ring-1 ring-sand-200/80">
            <span
              className={clsx(
                'font-semibold tabular-nums',
                expiresInSec === 0
                  ? 'text-red-700'
                  : expiresInSec <= 60
                    ? 'text-amber-700'
                    : 'text-river-700',
              )}
            >
              {expiresInSec > 0 ? `Hiệu lực còn ${formatCountdown(expiresInSec)}` : 'Mã OTP đã hết hạn'}
            </span>

            <button
              type="button"
              disabled={resendCooldownSec > 0 || resendingOtp}
              onClick={() => void handleResendOtp()}
              className={clsx(
                'font-semibold transition-colors',
                resendCooldownSec > 0 || resendingOtp
                  ? 'cursor-not-allowed text-river-400'
                  : 'text-leaf-700 hover:text-leaf-800 hover:underline',
              )}
            >
              {resendingOtp
                ? 'Đang gửi lại...'
                : resendCooldownSec > 0
                  ? `Gửi lại sau ${resendCooldownSec}s`
                  : 'Gửi lại mã OTP'}
            </button>
          </div>

          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={otpCode.length !== 6 || expiresInSec === 0}
            loading={verifyingOtp}
            onClick={() => void handleVerifyOtp()}
          >
            Xác nhận & Tạo tài khoản
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-center">
      <div className="mb-5">
        <p className="eyebrow">Bước 1 / 2 · Tài khoản mới</p>
        <HeadingTag className="mt-2 text-2xl font-extrabold tracking-tight text-river-900 sm:text-[1.85rem]">
          Tạo tài khoản
        </HeadingTag>
        <p className="mt-1 text-sm leading-relaxed text-river-600">
          Lưu giữ trọn vẹn dấu chân, ảnh kỷ niệm và lịch trình khám phá Đồng Tháp.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onRequestOtp)} className="space-y-3.5" noValidate>
        {aiAutoRunning && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-leaf-300 bg-leaf-50 px-3.5 py-2.5 text-xs font-semibold text-leaf-900">
            <Bot className="size-4 shrink-0 animate-bounce text-leaf-600" />
            <span>Pé Meko đang gửi mã xác thực OTP tới email của bạn...</span>
          </div>
        )}
        {formError && <Notice tone="warning">{formError}</Notice>}

        <FormField label="Tên hiển thị" required error={errors.displayName?.message}>
          <IconInput
            autoComplete="nickname"
            placeholder="Ví dụ: Minh Khôi"
            icon={<User className="size-4" />}
            {...form.register('displayName')}
          />
        </FormField>

        <FormField label="Email" required error={errors.email?.message}>
          <IconInput
            type="email"
            autoComplete="email"
            placeholder="ban@example.com"
            icon={<Mail className="size-4" />}
            {...form.register('email')}
          />
        </FormField>

        <FormField label="Mật khẩu" required error={errors.password?.message}>
          <IconInput
            passwordToggle
            autoComplete="new-password"
            placeholder="Tối thiểu 8 ký tự"
            icon={<Lock className="size-4" />}
            {...form.register('password')}
          />
        </FormField>

        <FormField label="Nhập lại mật khẩu" required error={errors.confirmPassword?.message}>
          <IconInput
            passwordToggle
            autoComplete="new-password"
            placeholder="Nhập lại mật khẩu để xác nhận"
            icon={<Lock className="size-4" />}
            {...form.register('confirmPassword')}
          />
        </FormField>

        {watchedPassword.length > 0 && (
          <div className="space-y-1.5 rounded-xl bg-sand-50/90 px-3 py-2 ring-1 ring-sand-200/80">
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 2, 3].map((bar) => (
                <span
                  key={bar}
                  className={clsx(
                    'h-1.5 rounded-full transition-colors duration-200',
                    strength.score >= bar ? strength.color : 'bg-sand-200',
                  )}
                />
              ))}
            </div>
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-river-600">
              {watchedPassword.length >= 8 && <Check className="size-3.5 text-leaf-600" aria-hidden />}
              <span>{strength.label}</span>
            </p>
          </div>
        )}

        <div>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl py-0.5 text-xs leading-relaxed text-river-700 sm:text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-leaf-600"
              {...form.register('acceptTerms')}
              aria-invalid={Boolean(errors.acceptTerms) || undefined}
            />
            <span>
              Tôi đồng ý với{' '}
              <Link to="/terms" className="font-semibold text-leaf-700 underline">
                Điều khoản
              </Link>{' '}
              và{' '}
              <Link to="/privacy" className="font-semibold text-leaf-700 underline">
                Chính sách quyền riêng tư
              </Link>
              .
            </span>
          </label>
          {errors.acceptTerms && (
            <p role="alert" className="mt-1 text-xs font-medium text-red-700">
              {errors.acceptTerms.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={form.formState.isSubmitting || aiAutoRunning}
        >
          Gửi mã xác thực OTP
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </form>
    </div>
  );
}

/**
 * Shared persistent portal route for `/login` and `/register`.
 * - Mobile (< lg): 200%-wide horizontal page-swipe track with 1 switcher pill in header.
 * - Desktop (>= lg): 50/50 split stage with sweeping double-parallax emerald curtain & 1 switcher button inside curtain.
 */
export function AuthPortalPage({ forcedMode }: { forcedMode?: AuthMode }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const navigate = useNavigate();

  const mode: AuthMode = forcedMode ?? (location.pathname === '/register' ? 'register' : 'login');
  const isRegister = mode === 'register';

  useDocumentTitle(isRegister ? 'Đăng ký' : 'Đăng nhập');

  const loginSlotRef = useInertRef(!isRegister);
  const registerSlotRef = useInertRef(isRegister);

  const handleSwitchMode = (nextMode: AuthMode) => {
    if (nextMode === mode) return;
    navigate(nextMode === 'register' ? '/register' : '/login', { state: location.state });
  };

  if (user && !hasPendingCopilotAuth(mode)) {
    return (
      <Navigate
        to={resolvePostLoginPath(user.role, (location.state as { from?: string } | null)?.from)}
        replace
      />
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-[960px] flex-col justify-center px-3.5 py-5 sm:px-6 sm:py-9 lg:py-12">
      <div
        data-mode={mode}
        className="auth-portal tp-fade-up relative overflow-hidden rounded-[2rem] bg-white/95 shadow-[0_26px_64px_-24px_rgba(15,47,37,0.28)] ring-1 ring-sand-200/90 backdrop-blur-md"
      >
        {/* Mobile & Tablet Compact Editorial Header (the ONLY switcher on < lg) */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#071f18] via-[#0f392c] to-[#165742] px-5 pb-5 pt-5 text-white sm:px-7 lg:hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-16 -right-12 size-44 rounded-full bg-lotus-400/20 blur-2xl"
          />
          <img
            src="/images/lotus_flower_3.png"
            alt=""
            aria-hidden
            draggable={false}
            className="pointer-events-none absolute -bottom-4 -right-5 w-28 select-none opacity-20 mix-blend-screen"
          />
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/12 p-1.5 ring-1 ring-white/20">
              <img src="/images/logo-mark.png" alt="" className="size-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-teal-200">
                <Sparkles className="size-3 text-lotus-300" aria-hidden />
                Du lịch số Đồng Tháp
              </p>
              <p className="text-[15px] font-extrabold leading-snug text-white">
                {isRegister ? 'Mở Hộ chiếu Trải nghiệm Số' : 'Chào mừng trở lại Đất Sen Hồng'}
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-4">
            <MobileModeSwitcher mode={mode} onSwitch={handleSwitchMode} />
          </div>
        </div>

        {/* Unified Sliding Form Stage + Desktop Sweeping Curtain */}
        <div className="relative overflow-hidden lg:min-h-[620px]">
          <div className="auth-forms-track lg:min-h-[620px]">
            {/* SLOT 1 on Mobile (Login 0%) -> Right Column on Desktop (col-start-2) */}
            <div
              ref={loginSlotRef}
              aria-hidden={isRegister}
              className="auth-slot-login px-5 py-6 sm:px-8 sm:py-8 lg:flex lg:flex-col lg:justify-center lg:px-10 lg:py-10"
            >
              <LoginFormPanel active={!isRegister} />
            </div>

            {/* SLOT 2 on Mobile (Register -50%) -> Left Column on Desktop (col-start-1) */}
            <div
              ref={registerSlotRef}
              aria-hidden={!isRegister}
              className="auth-slot-register px-5 py-6 sm:px-8 sm:py-8 lg:flex lg:flex-col lg:justify-center lg:px-10 lg:py-9"
            >
              <RegisterFormPanel active={isRegister} />
            </div>
          </div>

          {/* DESKTOP SWEEPING SHOWCASE CURTAIN (glides 0% <-> 100%, counter-sliding 200% inner track) */}
          <EditorialShowcaseCurtain isRegister={isRegister} onSwitch={handleSwitchMode} />
        </div>
      </div>
    </section>
  );
}

export function LoginPage() {
  return <AuthPortalPage forcedMode="login" />;
}

export function RegisterPage() {
  return <AuthPortalPage forcedMode="register" />;
}
