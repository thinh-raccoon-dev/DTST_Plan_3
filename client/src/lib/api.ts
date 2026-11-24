import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const baseURL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';

/** Resolves `/api/...` and `/uploads/...` media paths against cross-origin API host when frontend & backend sit on separate domains (e.g. Vercel + Render). */
export function resolveMediaUrl(url: string): string {
  if (!url) return url;
  if ((url.startsWith('/uploads/') || url.startsWith('/api/')) && /^https?:\/\//i.test(baseURL)) {
    try {
      return `${new URL(baseURL).origin}${url}`;
    } catch {
      return url;
    }
  }
  return url;
}

export const api = axios.create({ baseURL, withCredentials: true, timeout: 25_000 });

const SESSION_TOKEN_KEY = 'dtst_session_token_v1';
const CACHED_USER_KEY = 'dtst_cached_user_v1';

export function getStoredAuthToken(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SESSION_TOKEN_KEY);
    return raw && raw.length > 20 ? raw : null;
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (token && token.length > 20) {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // ignore storage restrictions (e.g. private browsing quota)
  }
}

export function getCachedAuthUser<T>(): T | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(CACHED_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setCachedAuthUser(user: unknown | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (user) {
      localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CACHED_USER_KEY);
    }
  } catch {
    // ignore
  }
}

let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  csrfRequest ??= axios
    .get<{ csrfToken: string }>(`${baseURL}/csrf`, { withCredentials: true })
    .then((res) => {
      csrfToken = res.data.csrfToken;
      return csrfToken;
    })
    .finally(() => {
      csrfRequest = null;
    });
  return csrfRequest;
}

const SAFE_METHODS = new Set(['get', 'head', 'options']);

api.interceptors.request.use(async (config) => {
  // Ask server to also return a sliding-renewed fallback session token so Mobile Safari ITP,
  // iOS/Android Home Screen PWAs, and cross-origin deployments never lose login state.
  config.headers.set('x-auth-persistence', 'token');
  const storedToken = getStoredAuthToken();
  if (storedToken && !config.headers.has('Authorization')) {
    config.headers.set('Authorization', `Bearer ${storedToken}`);
  }
  if (!SAFE_METHODS.has((config.method ?? 'get').toLowerCase())) {
    config.headers.set('x-csrf-token', await getCsrfToken());
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _csrfRetried?: boolean };

api.interceptors.response.use(undefined, async (error: AxiosError<ApiErrorBody>) => {
  const config = error.config as RetriableConfig | undefined;
  if (config && !config._csrfRetried && error.response?.data?.error?.code === 'CSRF_INVALID') {
    csrfToken = null;
    config._csrfRetried = true;
    return api.request(config);
  }
  throw error;
});

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

export interface FieldIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly fieldIssues: FieldIssue[] = [],
  ) {
    super(message);
  }
}

function isFieldIssueList(value: unknown): value is FieldIssue[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'object' && v !== null && 'path' in v && 'message' in v);
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) {
      return new ApiError('Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.', 0, 'NETWORK_ERROR');
    }
    const body = error.response.data?.error;
    return new ApiError(
      body?.message ?? 'Đã có lỗi xảy ra. Vui lòng thử lại.',
      error.response.status,
      body?.code ?? 'UNKNOWN',
      isFieldIssueList(body?.details) ? body.details : [],
    );
  }
  return new ApiError('Đã có lỗi không xác định.', 0, 'UNKNOWN');
}

/** Maps server validation issues onto react-hook-form fields; returns issues it could not place. */
export function applyFieldErrors(
  error: ApiError,
  setError: (name: never, value: { type: string; message: string }) => void,
  knownFields: readonly string[],
): FieldIssue[] {
  const unplaced: FieldIssue[] = [];
  for (const issue of error.fieldIssues) {
    const field = knownFields.find((name) => issue.path === name || issue.path.startsWith(`${name}.`));
    if (field) setError(issue.path as never, { type: 'server', message: issue.message });
    else unplaced.push(issue);
  }
  return unplaced;
}
export function resetCsrfToken() {
  csrfToken = null;
}

