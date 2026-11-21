import {
  ArrowRight,
  ArrowRightLeft,
  Camera,
  CheckCircle2,
  Compass,
  Eye,
  HelpCircle,
  MapPin,
  Mic,
  MicOff,
  Minimize2,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, toApiError } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useItineraryDraft } from '../../stores/itineraryDraftStore';
import { toast } from '../../stores/toastStore';
import { useUiComfortStore } from '../../stores/uiComfortStore';
import type { Area, Category, SavedItinerary } from '../../types/api';

interface MatchedDestination {
  id?: string;
  name: string;
  slug: string;
  summary?: string;
  category?: string;
  categoryLabel?: string;
  area?: string;
  areaLabel?: string;
  vibeScore?: number;
  distanceKm?: number;
  matchReason?: string;
  coordinates?: { lat: number; lng: number };
}

interface SwapSelectionPayload {
  dayNumber: number;
  targetStopId?: string;
  targetStopName: string;
  criteriaLabel?: string;
  notFoundQuery?: string;
  candidates: MatchedDestination[];
}

interface DomAutomationStep {
  op?: 'click' | 'fill' | 'scroll';
  action?: 'click' | 'fill' | 'scroll';
  targetId?: string;
  targetText?: string;
  selector?: string;
  value?: string;
  description?: string;
}

interface CopilotAction {
  type:
    | 'NAVIGATE'
    | 'FILTER'
    | 'OPEN_PAGE'
    | 'PLAN_ITINERARY'
    | 'REGISTER_ACCOUNT'
    | 'LOGIN_ACCOUNT'
    | 'LOGOUT_ACCOUNT'
    | 'UPDATE_PROFILE'
    | 'SAVE_ITINERARY'
    | 'TOGGLE_FAVORITE'
    | 'SYNC_PASSPORT'
    | 'DOM_AUTOMATION'
    | 'SECURITY_BLOCKED'
    | 'SWAP_ITINERARY_STOP'
    | 'CHOOSE_SWAP_CANDIDATE'
    | 'ADD_ITINERARY_STOP'
    | 'REMOVE_ITINERARY_STOP'
    | 'ASK_CLARIFICATION';
  payload: {
    path?: string;
    label?: string;
    params?: Record<string, string>;
    days?: number;
    people?: number;
    budgetVnd?: number;
    email?: string;
    password?: string;
    displayName?: string;
    newDisplayName?: string;
    currentPassword?: string;
    newPassword?: string;
    preferences?: {
      numberOfDays?: number;
      hoursPerDay?: number;
      areas?: string[];
      interests?: string[];
    };
    destinationId?: string;
    destinationName?: string;
    destinationSlug?: string;
    favoriteMode?: 'add' | 'remove';
    itineraryTitle?: string;
    domSteps?: DomAutomationStep[];
    securityReason?: string;
    dayNumber?: number;
    targetStopId?: string;
    targetStopName?: string;
    newDestination?: MatchedDestination;
    swapSelection?: SwapSelectionPayload;
    missingFields?: string[];
    contextType?: string;
  };
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  imageUrl?: string;
  action?: CopilotAction;
  matchedDestinations?: MatchedDestination[];
  suggestions?: string[];
  timestamp: string;
}

const INITIAL_MESSAGE: Message = {
  id: 'welcome',
  sender: 'assistant',
  text:
    `Chào bạn! Mình là **Pé Meko** 🦊 — trợ lý du lịch thông minh kiêm hướng dẫn viên của Đồng Tháp Smart Travel.\n\n` +
    `Bạn có thể hỏi mình về **dự án**, **cách dùng Hộ chiếu số**, **ẩm thực đặc sản**, hoặc nhờ mình **tự lập lịch trình** và **điều khiển web** giúp bạn nhé!`,
  suggestions: [
    'Dự án này là gì?',
    'Hộ chiếu số là gì và cách tích điểm?',
    'Lập lịch trình 2 ngày 2 người chi phí 2 triệu',
    'Đặc sản Đồng Tháp có gì ngon?',
  ],
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
};

/**
 * Scan visible interactive elements on the current page and assign `data-meko-target="ctrl-N"`
 * so Pé Meko can automatically understand and operate UI features without hardcoding.
 * Security rule: Never read or transmit password field values or hidden tokens.
 */
function captureLivePageContext(
  pendingSwap?: SwapSelectionPayload | null,
  lastDiscussedDestination?: MatchedDestination | null,
) {
  const authUser = useAuthStore.getState().user;
  const draft = useItineraryDraft.getState();

  const primaryCoordsById = new Map<string, { lat: number; lng: number }>();
  for (const pp of draft.v9Response?.primary_places || []) {
    if (
      pp.id &&
      Array.isArray(pp.coordinates) &&
      pp.coordinates.length >= 2 &&
      typeof pp.coordinates[0] === 'number' &&
      typeof pp.coordinates[1] === 'number'
    ) {
      // GeoJSON coordinates are [lng, lat]; auto-normalize safely to { lat, lng }
      const [c0, c1] = pp.coordinates;
      const lat = Math.abs(c0) > 90 || (c0 > 50 && c1 <= 30) ? c1 : c0;
      const lng = Math.abs(c0) > 90 || (c0 > 50 && c1 <= 30) ? c0 : c1;
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        primaryCoordsById.set(pp.id, { lat, lng });
      }
    }
  }

  const draftItinerary = draft.v9Itinerary?.days?.length
    ? {
        title: draft.title || undefined,
        totalDays: draft.v9Itinerary.days.length,
        days: draft.v9Itinerary.days.map((d) => ({
          day: d.day,
          date: d.date,
          stops: (d.activities || [])
            .filter((act) => act.type === 'visit' || act.type === 'meal')
            .map((act) => {
              const fallbackCoord = act.place_id ? primaryCoordsById.get(act.place_id) : undefined;
              return {
                stopId: act.stop_id,
                placeId: act.place_id,
                name: act.name,
                type: act.type,
                start: act.start,
                end: act.end,
                lat: typeof act.latitude === 'number' ? act.latitude : fallbackCoord?.lat,
                lng: typeof act.longitude === 'number' ? act.longitude : fallbackCoord?.lng,
              };
            }),
        })),
      }
    : null;

  const controls: Array<{
    id: string;
    targetId: string;
    tag: string;
    type?: string;
    label: string;
    placeholder?: string;
    value?: string;
  }> = [];

  try {
    const elements = document.querySelectorAll<HTMLElement>(
      'main button, main a, main input:not([type="password"]):not([type="hidden"]), main select, main textarea, main [role="tab"], header nav a, header button',
    );

    let idx = 1;
    elements.forEach((el) => {
      if (idx > 45) return;
      if (el.closest('[data-meko-widget="true"]')) return;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const tag = el.tagName.toLowerCase();
      const inputEl = el as HTMLInputElement;
      const type = inputEl.type ? String(inputEl.type).toLowerCase() : undefined;
      if (type === 'password' || type === 'hidden') return;

      const ariaLabel = el.getAttribute('aria-label') || el.getAttribute('title') || '';
      const placeholder = inputEl.placeholder || '';
      const textContent = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      let associatedLabel = '';
      if (el.id) {
        const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lbl) associatedLabel = (lbl.textContent || '').replace(/\s+/g, ' ').trim();
      }
      if (!associatedLabel) {
        const parentLabel = el.closest('label');
        if (parentLabel) associatedLabel = (parentLabel.textContent || '').replace(/\s+/g, ' ').trim();
      }

      const label = (ariaLabel || associatedLabel || textContent || placeholder || tag).slice(0, 90);
      if (!label) return;

      const targetId = `ctrl-${idx++}`;
      el.setAttribute('data-meko-target', targetId);

      const safeValue =
        tag === 'input' || tag === 'textarea' || tag === 'select'
          ? String(inputEl.value || '').slice(0, 60)
          : undefined;

      controls.push({
        id: targetId,
        targetId,
        tag,
        type,
        label,
        placeholder: placeholder ? placeholder.slice(0, 70) : undefined,
        value: safeValue,
      });
    });
  } catch (err) {
    console.warn('captureLivePageContext warning:', err);
  }

  return {
    currentPath: window.location.pathname + window.location.search,
    pageTitle: document.title,
    currentUser: authUser
      ? {
          id: authUser.id,
          email: authUser.email,
          displayName: authUser.displayName,
          role: authUser.role,
          preferences: authUser.preferences,
        }
      : null,
    hasDraftItinerary: Boolean(draft.v9Itinerary),
    draftTitle: draft.title,
    draftItinerary,
    pendingSwap: pendingSwap
      ? {
          dayNumber: pendingSwap.dayNumber,
          targetStopId: pendingSwap.targetStopId,
          targetStopName: pendingSwap.targetStopName,
          candidates: pendingSwap.candidates.map((c) => ({
            id: c.id,
            slug: c.slug,
            name: c.name,
            area: c.area,
            category: c.category,
            summary: c.summary,
            coordinates: c.coordinates,
          })),
        }
      : null,
    lastDiscussedDestination: lastDiscussedDestination
      ? {
          id: lastDiscussedDestination.id,
          slug: lastDiscussedDestination.slug,
          name: lastDiscussedDestination.name,
          area: lastDiscussedDestination.area || lastDiscussedDestination.areaLabel,
          category: lastDiscussedDestination.category,
          coordinates: lastDiscussedDestination.coordinates,
        }
      : null,
    controls,
  };
}

/**
 * Set value on controlled React input/textarea/select elements so React state updates properly.
 */
function setReactInputValue(el: HTMLElement, value: string) {
  const tag = el.tagName.toLowerCase();
  if (tag === 'input') {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    nativeSetter?.call(el, value);
  } else if (tag === 'textarea') {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    nativeSetter?.call(el, value);
  } else if (tag === 'select') {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
    nativeSetter?.call(el, value);
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Lightweight inline formatter for **bold**, *italic*, and `code` spans inside Pé Meko chat bubbles.
 */
function renderFormattedText(text: string): ReactNode {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    const tokens = line.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
    return (
      <span key={lineIdx}>
        {tokens.map((tok, i) => {
          if (tok.startsWith('**') && tok.endsWith('**')) {
            return (
              <strong key={i} className="font-semibold">
                {tok.slice(2, -2)}
              </strong>
            );
          }
          if (tok.startsWith('`') && tok.endsWith('`')) {
            return (
              <code
                key={i}
                className="rounded bg-leaf-100/80 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-leaf-900"
              >
                {tok.slice(1, -1)}
              </code>
            );
          }
          if (tok.startsWith('*') && tok.endsWith('*') && tok.length > 2) {
            return (
              <em key={i} className="italic opacity-95">
                {tok.slice(1, -1)}
              </em>
            );
          }
          return <span key={i}>{tok}</span>;
        })}
        {lineIdx < lines.length - 1 && <br />}
      </span>
    );
  });
}

export function AiCopilotWidget() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [activePendingSwap, setActivePendingSwap] = useState<SwapSelectionPayload | null>(null);
  const [lastDiscussedDest, setLastDiscussedDest] = useState<MatchedDestination | null>(null);
  const [pickedSwapSlugByMsg, setPickedSwapSlugByMsg] = useState<Record<string, string>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const sendMessageRef = useRef<(overrideText?: string) => Promise<void> | void>(() => {});
  const seniorMode = useUiComfortStore((s) => s.seniorMode);

  // Listen for external open triggers (AI Vibe Showcase, Hero Story Deck, Senior Quick Launch)
  useEffect(() => {
    const handleExternalOpen = (evt: Event) => {
      const detail = (evt as CustomEvent<{ prompt?: string }>).detail || {};
      setIsOpen(true);
      setIsMinimized(false);
      if (detail.prompt) {
        window.setTimeout(() => {
          void sendMessageRef.current(detail.prompt);
        }, 120);
      }
    };
    window.addEventListener('meko:open', handleExternalOpen);
    return () => window.removeEventListener('meko:open', handleExternalOpen);
  }, []);

  // Auto scroll to bottom of chat
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized, isLoading]);

  // Listen for system notices from Itinerary / Auth / Profile pages
  useEffect(() => {
    const handleBotNotice = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ text?: string }>;
      const noticeText = customEvt.detail?.text;
      if (!noticeText) return;
      setMessages((prev) => [
        ...prev,
        {
          id: `notice-${Date.now()}`,
          sender: 'assistant',
          text: noticeText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    };
    window.addEventListener('pe-meko:bot-notice', handleBotNotice);
    return () => window.removeEventListener('pe-meko:bot-notice', handleBotNotice);
  }, []);

  // Setup Web Speech API (Speech to Text)
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'vi-VN';

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputValue(transcript);
          void handleSendMessage(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setSpeechError('Vui lòng cấp quyền Micro trên trình duyệt để nói chuyện với Pé Meko.');
        } else if (event.error !== 'no-speech') {
          setSpeechError('Pé Meko chưa nghe rõ, bạn thử nói lại nhé.');
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setSpeechError('Trình duyệt chưa hỗ trợ giọng nói. Vui lòng dùng Chrome, Edge hoặc Cốc Cốc.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setSpeechError(null);
      try {
        recognitionRef.current.start();
      } catch {
        recognitionRef.current.stop();
        setTimeout(() => recognitionRef.current?.start(), 150);
      }
    }
  };

  // Execute System / UI Action
  const executeAction = useCallback(
    async (action?: CopilotAction) => {
      if (!action || action.type === 'ASK_CLARIFICATION') {
        return;
      }

      if (action.type === 'CHOOSE_SWAP_CANDIDATE') {
        if (action.payload.swapSelection) {
          setActivePendingSwap(action.payload.swapSelection);
        }
        return;
      }

      if (action.type === 'SECURITY_BLOCKED') {
        toast.error('Từ chối truy cập', 'Yêu cầu liên quan đến dữ liệu bảo mật của hệ thống.');
        return;
      }

      // 1. Profile & Display Name / Preferences / Password Control
      if (action.type === 'UPDATE_PROFILE') {
        const currentUser = useAuthStore.getState().user;
        if (!currentUser) {
          toast.info('Vui lòng đăng nhập trước', 'Pé Meko đang mở trang Đăng nhập cho bạn nhé!');
          navigate('/login');
          return;
        }

        try {
          const updatePayload: {
            displayName?: string;
            preferences?: {
              areas: Area[];
              interests: Category[];
              numberOfDays: number;
              hoursPerDay: number;
            };
            currentPassword?: string;
            newPassword?: string;
          } = {};

          const nextDisplayName = action.payload.newDisplayName || action.payload.displayName;
          if (nextDisplayName) {
            updatePayload.displayName = nextDisplayName;
          }
          if (action.payload.preferences) {
            updatePayload.preferences = {
              areas: (action.payload.preferences.areas as Area[]) ?? currentUser.preferences?.areas ?? [],
              interests:
                (action.payload.preferences.interests as Category[]) ?? currentUser.preferences?.interests ?? [],
              numberOfDays:
                action.payload.preferences.numberOfDays ?? currentUser.preferences?.numberOfDays ?? 2,
              hoursPerDay:
                action.payload.preferences.hoursPerDay ?? currentUser.preferences?.hoursPerDay ?? 8,
            };
          }
          if (action.payload.currentPassword && action.payload.newPassword) {
            updatePayload.currentPassword = action.payload.currentPassword;
            updatePayload.newPassword = action.payload.newPassword;
          }

          const updated = await useAuthStore.getState().updateProfile(updatePayload);
          navigate(action.payload.path || '/account');
          toast.success('Đã cập nhật hồ sơ!', `Tên hiển thị: ${updated.displayName}`);
        } catch (err) {
          const apiErr = toApiError(err);
          toast.error('Không thể cập nhật hồ sơ', apiErr.message);
          window.dispatchEvent(
            new CustomEvent('pe-meko:bot-notice', {
              detail: {
                text: `⚠️ Không thể cập nhật hồ sơ: **${apiErr.message}**`,
              },
            }),
          );
        }
        return;
      }

      // 2. Logout Control
      if (action.type === 'LOGOUT_ACCOUNT') {
        try {
          await useAuthStore.getState().logout();
          toast.info('Đã đăng xuất tài khoản');
          navigate('/');
        } catch (err) {
          toast.error('Lỗi đăng xuất', toApiError(err).message);
        }
        return;
      }

      // 3. Save Draft Itinerary to Account
      if (action.type === 'SAVE_ITINERARY') {
        const currentUser = useAuthStore.getState().user;
        const draft = useItineraryDraft.getState();

        if (!currentUser) {
          toast.info('Cần đăng nhập để lưu lịch trình', 'Pé Meko mở trang Đăng nhập cho bạn nhé!');
          navigate('/login');
          return;
        }

        if (!draft.v9Itinerary) {
          toast.info('Chưa có lịch trình nháp', 'Pé Meko mở trang Lập lịch trình để tạo trước nhé!');
          navigate('/itinerary/create');
          return;
        }

        try {
          const titleToSave =
            action.payload.itineraryTitle?.trim() ||
            draft.title.trim() ||
            'Hành trình Mỹ Tho – Thới Sơn';
          const res = await api.post<{ itinerary: SavedItinerary }>('/itineraries', {
            title: titleToSave,
            v9Itinerary: draft.v9Itinerary,
            v9Meta: draft.v9Response
              ? {
                  mode: draft.v9Response.mode,
                  goal: draft.v9Response.goal,
                  primary_places: draft.v9Response.primary_places,
                  budget_alternative: draft.v9Response.budget_alternative,
                  warnings: draft.v9Response.warnings,
                }
              : undefined,
          });
          toast.success('Đã lưu lịch trình!', `Đã lưu "${titleToSave}" vào tài khoản.`);
          draft.clear();
          navigate(`/itinerary/${res.data.itinerary.id}`);
        } catch (err) {
          toast.error('Không lưu được lịch trình', toApiError(err).message);
        }
        return;
      }

      // 4. Toggle Favorite Destination
      if (action.type === 'TOGGLE_FAVORITE') {
        const currentUser = useAuthStore.getState().user;
        if (!currentUser) {
          toast.info('Cần đăng nhập để lưu Yêu thích', 'Pé Meko mở trang Đăng nhập cho bạn nhé!');
          navigate('/login');
          return;
        }
        const destId = action.payload.destinationId;
        if (destId) {
          try {
            if (action.payload.favoriteMode === 'remove') {
              await api.delete(`/favorites/${destId}`);
              toast.info('Đã bỏ khỏi Yêu thích', action.payload.destinationName || '');
            } else {
              await api.post(`/favorites/${destId}`);
              toast.success('Đã thêm vào Yêu thích!', action.payload.destinationName || '');
            }
            navigate(action.payload.path || '/favorites');
          } catch (err) {
            toast.error('Không thể cập nhật Yêu thích', toApiError(err).message);
          }
        }
        return;
      }

      // 5. Sync Digital Passport to Account
      if (action.type === 'SYNC_PASSPORT') {
        const currentUser = useAuthStore.getState().user;
        if (!currentUser) {
          toast.info('Vui lòng đăng nhập để đồng bộ Hộ chiếu');
          navigate('/login');
          return;
        }
        try {
          await api.post('/passport/claim');
          toast.success('Đã đồng bộ Hộ chiếu số vào tài khoản!');
          navigate('/passport');
        } catch (err) {
          toast.error('Không thể đồng bộ Hộ chiếu', toApiError(err).message);
        }
        return;
      }

      // 6. Live DOM Automation
      if (action.type === 'DOM_AUTOMATION' && action.payload.domSteps?.length) {
        for (const step of action.payload.domSteps) {
          const op = step.op || step.action;
          const desc = step.targetText || step.description;
          let targetEl: HTMLElement | null = null;
          if (step.targetId) {
            targetEl = document.querySelector<HTMLElement>(
              `[data-meko-target="${CSS.escape(step.targetId)}"]`,
            );
          }
          if (!targetEl && step.selector) {
            try {
              targetEl = document.querySelector<HTMLElement>(step.selector);
            } catch {
              // fallback by text match
            }
          }
          if (!targetEl && desc) {
            const needle = desc.toLowerCase();
            const candidates = Array.from(
              document.querySelectorAll<HTMLElement>('main button, main a, main input, main [role="tab"]'),
            );
            targetEl =
              candidates.find((c) => (c.innerText || c.textContent || '').toLowerCase().includes(needle)) ||
              null;
          }

          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const prevOutline = targetEl.style.outline;
            targetEl.style.outline = '3px solid #10b981';
            setTimeout(() => {
              if (targetEl) targetEl.style.outline = prevOutline;
            }, 1500);

            if (op === 'fill' && typeof step.value === 'string') {
              const inputType = (targetEl as HTMLInputElement).type?.toLowerCase();
              if (inputType !== 'password') {
                setReactInputValue(targetEl, step.value);
              }
            } else if (op === 'click') {
              targetEl.click();
            }
          }
        }
        toast.success('Đã thực hiện thao tác trên trang', action.payload.label || '');
        return;
      }

      // 7. Route Stop Swap with Inconvenience Check
      if (action.type === 'SWAP_ITINERARY_STOP') {
        setActivePendingSwap(null);
        sessionStorage.setItem('pe_meko_pending_swap', JSON.stringify(action.payload));
        navigate(action.payload.path || '/itinerary/create#plan');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('pe-meko:swap-stop', { detail: action.payload }));
        }, 200);
        return;
      }

      // 7b. Add Stop to Itinerary
      if (action.type === 'ADD_ITINERARY_STOP') {
        setActivePendingSwap(null);
        sessionStorage.setItem('pe_meko_pending_add', JSON.stringify(action.payload));
        navigate(action.payload.path || '/itinerary/create#plan');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('pe-meko:add-stop', { detail: action.payload }));
        }, 200);
        return;
      }

      // 7c. Remove Stop from Itinerary
      if (action.type === 'REMOVE_ITINERARY_STOP') {
        setActivePendingSwap(null);
        sessionStorage.setItem('pe_meko_pending_remove', JSON.stringify(action.payload));
        navigate(action.payload.path || '/itinerary/create#plan');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('pe-meko:remove-stop', { detail: action.payload }));
        }, 200);
        return;
      }

      // 8. Standard Navigation / Auto-Fill Routes
      if (action.payload?.path) {
        navigate(action.payload.path);
      }
    },
    [navigate],
  );

  const handlePickImage = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Định dạng chưa hỗ trợ', 'Vui lòng chọn tệp hình ảnh JPG, PNG hoặc WebP.');
      return;
    }
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage({ file, previewUrl: URL.createObjectURL(file) });
  };

  const clearPendingImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage(null);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const rawText = (textToSend ?? inputValue).trim();
    const imageToSend = textToSend ? null : pendingImage;
    if ((!rawText && !imageToSend) || isLoading) return;

    const text = rawText || 'Tìm địa điểm có khung cảnh tương tự bức ảnh này gần tôi';
    setInputValue('');
    if (!textToSend) setPendingImage(null);
    setSpeechError(null);

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      imageUrl: imageToSend?.previewUrl,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setIsLoading(true);

    try {
      if (imageToSend) {
        const coords = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
          if (!('geolocation' in navigator)) return resolve(null);
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: false, timeout: 3000 },
          );
        });

        const formData = new FormData();
        formData.append('image', imageToSend.file);
        formData.append('prompt', text);
        if (coords) {
          formData.append('userLat', String(coords.lat));
          formData.append('userLng', String(coords.lng));
        }

        const res = await api.post<{
          success: boolean;
          reply: string;
          matches: MatchedDestination[];
          suggestions?: string[];
        }>('/ai/visual-search', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000,
        });

        const botMsg: Message = {
          id: `bot-${Date.now()}`,
          sender: 'assistant',
          text: res.data.reply,
          matchedDestinations: res.data.matches,
          suggestions: res.data.suggestions,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, botMsg]);
        return;
      }

      const historyPayload = messages.slice(-12).map((m) => ({
        role: m.sender,
        content: m.text,
      }));

      const pageContext = captureLivePageContext(activePendingSwap, lastDiscussedDest);

      let res;
      try {
        res = await api.post<{
          success: boolean;
          reply: string;
          action?: CopilotAction;
          matchedDestinations?: MatchedDestination[];
          suggestions?: string[];
        }>(
          '/ai/copilot',
          {
            message: text,
            history: historyPayload,
            pageContext,
          },
          { timeout: 35000 },
        );
      } catch (firstErr) {
        console.warn('Pé Meko retry lần 2 do mạng trễ...', firstErr);
        res = await api.post<{
          success: boolean;
          reply: string;
          action?: CopilotAction;
          matchedDestinations?: MatchedDestination[];
          suggestions?: string[];
        }>(
          '/ai/copilot',
          {
            message: text,
            history: historyPayload,
            pageContext,
          },
          { timeout: 35000 },
        );
      }

      const data = res.data;

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: data.reply || 'Dạ Pé Meko đã xử lý xong yêu cầu của bạn!',
        action: data.action,
        matchedDestinations: data.matchedDestinations,
        suggestions: data.suggestions,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);

      if (data.matchedDestinations && data.matchedDestinations.length > 0) {
        setLastDiscussedDest(data.matchedDestinations[0]!);
      } else if (
        data.action?.type === 'NAVIGATE' &&
        data.action.payload?.path?.startsWith('/destinations/')
      ) {
        const navSlug = data.action.payload.path.replace('/destinations/', '').split('?')[0] || '';
        if (navSlug) {
          setLastDiscussedDest({
            slug: navSlug,
            name: data.action.payload.label || navSlug,
          });
        }
      } else if (data.action?.payload?.newDestination) {
        setLastDiscussedDest(data.action.payload.newDestination);
      }

      if (data.action) {
        void executeAction(data.action);
      }
    } catch (err: any) {
      console.error('Lỗi gọi Pé Meko AI:', err);
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: 'Dạ hiện kết nối tới máy chủ AI đang bận một chút, bạn bấm gửi lại giúp Pé Meko nhé! 🦊',
        suggestions: [
          'Lập lịch trình 2 ngày 2 người chi phí 2 triệu',
          'Khám phá địa điểm nổi bật',
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  sendMessageRef.current = handleSendMessage;

  const isFootprintsPage = location.pathname === '/footprints';

  // Floating trigger button when closed
  if (!isOpen) {
    return (
      <div
        data-meko-widget="true"
        className={
          isFootprintsPage
            ? 'fixed bottom-[9.5rem] right-3.5 z-[1000] flex items-center gap-2.5 lg:bottom-5 lg:right-5'
            : 'fixed bottom-[5.15rem] right-3.5 z-[1000] flex items-center gap-2.5 lg:bottom-5 lg:right-5'
        }
      >
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className={`group relative flex items-center gap-2.5 rounded-full bg-gradient-to-tr from-leaf-800 via-leaf-700 to-teal-600 text-white shadow-xl ring-2 ring-white/80 transition-all duration-200 hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-leaf-300 sm:py-2.5 sm:pl-3.5 sm:pr-4 sm:ring-0 ${
            seniorMode ? 'py-2 pl-2.5 pr-4' : 'p-1.5'
          }`}
          aria-label="Mở trợ lý Pé Meko"
        >
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xl shadow-inner sm:h-9 sm:w-9">
            🦊
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-leaf-800 bg-emerald-400" />
          </span>
          <div className={seniorMode ? 'text-left' : 'hidden text-left sm:block'}>
            <div className="text-xs font-extrabold leading-tight tracking-tight text-white">
              {seniorMode ? 'Hỏi Trợ lý AI' : 'Pé Meko'}
            </div>
            <div className="text-[10px] font-medium leading-tight text-leaf-100">
              {seniorMode ? 'Nhấn để hỏi Pé Meko' : 'Trợ lý du lịch AI'}
            </div>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div
      data-meko-widget="true"
      className={
        isMinimized
          ? 'fixed bottom-[5.15rem] right-3.5 z-[1000] flex flex-col items-end lg:bottom-6 lg:right-6'
          : 'fixed inset-x-2 bottom-[4.85rem] top-16 z-[1000] flex flex-col items-end sm:inset-auto sm:bottom-[5.15rem] sm:right-4 lg:bottom-6 lg:right-6'
      }
    >
      {/* Minimized Pill */}
      {isMinimized ? (
        <div className="flex items-center gap-3 rounded-full bg-white/95 px-4 py-2.5 shadow-2xl border border-leaf-200 backdrop-blur-md">
          <button
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-2 text-left"
          >
            <span className="text-lg">🦊</span>
            <span className="text-sm font-bold text-river-900">Pé Meko</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </button>
          <div className="flex items-center gap-1 border-l border-sand-200 pl-2">
            <button
              onClick={() => setIsMinimized(false)}
              className="rounded-full p-1 text-river-600 hover:bg-sand-100"
              title="Mở rộng"
            >
              <Sparkles className="h-3.5 w-3.5 text-leaf-600" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 text-river-600 hover:bg-sand-100"
              title="Đóng"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* Main Clean & User-Friendly Pé Meko Window (Full-width bottom sheet on mobile!) */
        <div className="flex h-full w-full flex-col overflow-hidden rounded-3xl border border-sand-200/90 bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 sm:h-[560px] sm:max-h-[82vh] sm:w-[395px]">
          {/* Clean, Minimal Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-leaf-900 via-leaf-800 to-teal-800 px-4 py-3.5 text-white">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 border border-white/20">
                <span className="text-xl leading-none">🦊</span>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-leaf-900 bg-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[15px] leading-tight text-white truncate">
                    Pé Meko
                  </h3>
                  <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-teal-100">
                    Trợ lý AI
                  </span>
                </div>
                <p className="text-[11px] text-leaf-100/90 truncate mt-0.5">
                  {isListening
                    ? '🎙️ Đang lắng nghe bạn nói...'
                    : 'Hỗ trợ tìm điểm đến & lập lịch trình'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-0.5 text-white/80 shrink-0">
              <button
                onClick={() => {
                  setMessages([INITIAL_MESSAGE]);
                  setActivePendingSwap(null);
                  setLastDiscussedDest(null);
                  setPickedSwapSlugByMsg({});
                }}
                className="rounded-xl p-1.5 transition-colors hover:bg-white/15 hover:text-white"
                title="Làm mới cuộc trò chuyện"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsMinimized(true)}
                className="rounded-xl p-1.5 transition-colors hover:bg-white/15 hover:text-white"
                title="Thu nhỏ"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-xl p-1.5 transition-colors hover:bg-white/15 hover:text-white"
                title="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3.5 bg-sand-50/40 text-sm">
            {messages.map((m, msgIndex) => {
              const isUser = m.sender === 'user';
              const isClarification = m.action?.type === 'ASK_CLARIFICATION';
              const isSecurityBlocked = m.action?.type === 'SECURITY_BLOCKED';
              const isLatestBotMessage = !isUser && msgIndex === messages.length - 1;

              return (
                <div key={m.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  {!isUser && (
                    <div className="mb-1 ml-1 flex items-center gap-1.5 text-[11px] font-semibold text-river-600">
                      <span>🦊 Pé Meko</span>
                      {isClarification && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                          <HelpCircle className="h-2.5 w-2.5" /> Cần thêm thông tin
                        </span>
                      )}
                      {isSecurityBlocked && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
                          <ShieldAlert className="h-2.5 w-2.5" /> Đã chặn bảo mật
                        </span>
                      )}
                    </div>
                  )}

                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-2xs leading-relaxed ${
                      isUser
                        ? 'bg-leaf-700 text-white rounded-br-xs'
                        : isSecurityBlocked
                          ? 'bg-rose-50/90 border border-rose-200 text-rose-950 rounded-bl-xs'
                          : isClarification
                            ? 'bg-amber-50/70 border border-amber-200 text-river-900 rounded-bl-xs'
                            : 'bg-white border border-sand-200/90 text-river-900 rounded-bl-xs'
                    }`}
                  >
                    {m.imageUrl && (
                      <div className="mb-2 overflow-hidden rounded-xl border border-white/20">
                        <img
                          src={m.imageUrl}
                          alt="Ảnh đã tải lên"
                          className="max-h-40 w-full object-cover"
                        />
                      </div>
                    )}
                    <div className="text-[13px] leading-relaxed">{renderFormattedText(m.text)}</div>

                    {/* Compact Action Pill inside Bot Message */}
                    {m.action &&
                      m.action.type !== 'ASK_CLARIFICATION' &&
                      m.action.type !== 'CHOOSE_SWAP_CANDIDATE' &&
                      m.action.type !== 'SECURITY_BLOCKED' && (
                        <div className="mt-2.5 pt-2 border-t border-sand-100 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1 truncate">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            <span className="truncate">
                              {m.action.payload.label || 'Đã chuyển trang'}
                            </span>
                          </span>
                          <button
                            onClick={() => void executeAction(m.action)}
                            className="flex shrink-0 items-center gap-1 rounded-full bg-sand-100 px-2.5 py-0.5 text-[11px] font-semibold text-river-700 hover:bg-leaf-50 hover:text-leaf-800 transition"
                          >
                            Mở lại <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                    {/* Interactive Ground-Truth Swap Candidate Picker */}
                    {m.action?.type === 'CHOOSE_SWAP_CANDIDATE' &&
                      m.action.payload.swapSelection &&
                      m.action.payload.swapSelection.candidates.length > 0 && (() => {
                        const sel = m.action.payload.swapSelection!;
                        const pickedSlug = pickedSwapSlugByMsg[m.id];
                        return (
                          <div className="mt-2.5 pt-2.5 border-t border-sand-200/80 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-leaf-800">
                                <ArrowRightLeft className="h-3 w-3 text-leaf-600" />
                                Thay cho "{sel.targetStopName}" · Ngày {sel.dayNumber}
                              </span>
                              {sel.criteriaLabel && (
                                <span className="rounded-full bg-leaf-100 px-2 py-0.5 text-[10px] font-semibold text-leaf-800">
                                  {sel.criteriaLabel}
                                </span>
                              )}
                            </div>

                            <div className="space-y-1.5">
                              {sel.candidates.map((cand, idx) => {
                                const isPicked = pickedSlug === cand.slug;
                                const isNear = cand.distanceKm !== undefined && cand.distanceKm <= 15;
                                return (
                                  <div
                                    key={cand.slug}
                                    className={`rounded-xl border p-2 transition-all ${
                                      isPicked
                                        ? 'border-emerald-400 bg-emerald-50/70'
                                        : 'border-sand-200 bg-sand-50/70 hover:border-leaf-300 hover:bg-leaf-50/40'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-leaf-700 text-[10px] font-bold text-white">
                                            {idx + 1}
                                          </span>
                                          <span className="truncate text-xs font-bold text-river-900">
                                            {cand.name}
                                          </span>
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-river-600">
                                          {cand.area && (
                                            <span className="inline-flex items-center gap-0.5">
                                              <MapPin className="h-2.5 w-2.5 text-leaf-600" />
                                              {cand.area}
                                            </span>
                                          )}
                                          {cand.categoryLabel && (
                                            <span className="rounded bg-white px-1.5 py-0.2 font-medium text-river-700 ring-1 ring-sand-200">
                                              {cand.categoryLabel}
                                            </span>
                                          )}
                                          {cand.distanceKm !== undefined && (
                                            <span
                                              className={`rounded px-1.5 py-0.2 font-semibold ${
                                                isNear
                                                  ? 'bg-emerald-100 text-emerald-800'
                                                  : 'bg-amber-100 text-amber-800'
                                              }`}
                                            >
                                              ~{cand.distanceKm} km
                                            </span>
                                          )}
                                        </div>
                                        {cand.matchReason && (
                                          <p className="mt-0.5 truncate text-[10px] text-leaf-700">
                                            {cand.matchReason}
                                          </p>
                                        )}
                                      </div>

                                      <div className="flex shrink-0 items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void executeAction({
                                              type: 'NAVIGATE',
                                              payload: { path: `/destinations/${cand.slug}`, label: cand.name },
                                            })
                                          }
                                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-sand-200 bg-white text-river-600 hover:bg-sand-100 hover:text-river-900"
                                          title={`Xem chi tiết ${cand.name}`}
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPickedSwapSlugByMsg((prev) => ({ ...prev, [m.id]: cand.slug }));
                                            void executeAction({
                                              type: 'SWAP_ITINERARY_STOP',
                                              payload: {
                                                path: '/itinerary/create#plan',
                                                label: `Đổi "${sel.targetStopName}" → "${cand.name}" (Ngày ${sel.dayNumber})`,
                                                dayNumber: sel.dayNumber,
                                                targetStopId: sel.targetStopId,
                                                targetStopName: sel.targetStopName,
                                                newDestination: cand,
                                              },
                                            });
                                          }}
                                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                                            isPicked
                                              ? 'bg-emerald-600 text-white'
                                              : 'bg-leaf-700 text-white hover:bg-leaf-800 shadow-2xs'
                                          }`}
                                        >
                                          {isPicked ? (
                                            <>
                                              <CheckCircle2 className="h-3 w-3" /> Đã chọn
                                            </>
                                          ) : (
                                            <>
                                              <ArrowRightLeft className="h-3 w-3" /> Chọn đổi
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                    {/* Matched destinations preview cards */}
                    {m.matchedDestinations && m.matchedDestinations.length > 0 && (
                      <div className="mt-2.5 space-y-1.5 pt-2 border-t border-sand-100">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-river-400">
                          Địa điểm liên quan
                        </div>
                        {m.matchedDestinations.map((d) => (
                          <button
                            key={d.slug}
                            onClick={() => {
                              void executeAction({
                                type: 'NAVIGATE',
                                payload: { path: `/destinations/${d.slug}`, label: d.name },
                              });
                            }}
                            className="w-full text-left flex items-center justify-between p-2 rounded-xl bg-sand-50/80 hover:bg-leaf-50 border border-sand-200/80 transition-colors group"
                          >
                            <div className="truncate mr-2 flex items-center gap-2">
                              <Compass className="h-3.5 w-3.5 text-leaf-600 shrink-0" />
                              <div className="truncate">
                                <div className="text-xs font-semibold text-river-900 group-hover:text-leaf-800 truncate flex items-center gap-1.5">
                                  <span className="truncate">{d.name}</span>
                                  {d.vibeScore !== undefined && (
                                    <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                                      {d.vibeScore}%
                                    </span>
                                  )}
                                </div>
                                {(d.areaLabel || d.area || d.distanceKm !== undefined) && (
                                  <div className="text-[10px] text-river-500 truncate">
                                    {d.areaLabel || d.area}
                                    {d.distanceKm !== undefined ? ` · ~${d.distanceKm} km` : ''}
                                  </div>
                                )}
                                {d.matchReason && (
                                  <div className="text-[10px] text-leaf-700 truncate">{d.matchReason}</div>
                                )}
                              </div>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-river-400 group-hover:text-leaf-700 shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Only show suggestion chips on the latest assistant message to keep chat clean */}
                  {isLatestBotMessage && m.suggestions && m.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 max-w-[95%]">
                      {m.suggestions.map((sug, idx) => (
                        <button
                          key={idx}
                          onClick={() => void handleSendMessage(sug)}
                          className="rounded-full bg-white px-3 py-1 text-left text-[11px] font-medium text-river-700 border border-sand-200 shadow-2xs hover:bg-leaf-50 hover:text-leaf-800 hover:border-leaf-300 transition-all"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-river-600 bg-white border border-sand-200 rounded-2xl px-3.5 py-2.5 w-fit shadow-2xs">
                <span className="text-sm animate-bounce">🦊</span>
                <span className="text-xs text-river-600">Pé Meko đang xử lý...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Speech Error Banner */}
          {speechError && (
            <div className="bg-rose-50 px-3.5 py-1.5 text-[11px] text-rose-700 border-t border-rose-200 flex items-center justify-between">
              <span>{speechError}</span>
              <button onClick={() => setSpeechError(null)} className="font-bold ml-2">
                ×
              </button>
            </div>
          )}

          {/* Voice Listening Active Bar */}
          {isListening && (
            <div className="bg-leaf-50 border-t border-leaf-200 px-3.5 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-600" />
                </span>
                <span className="text-xs font-semibold text-leaf-900">
                  Đang nghe... Bạn hãy nói yêu cầu
                </span>
              </div>
              <button
                onClick={toggleListening}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800"
              >
                Dừng
              </button>
            </div>
          )}

          {/* Pending Visual Search Image Preview */}
          {pendingImage && (
            <div className="flex items-center justify-between gap-2 border-t border-leaf-200 bg-leaf-50/70 px-3.5 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src={pendingImage.previewUrl}
                  alt="Ảnh xem trước"
                  className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-leaf-300"
                />
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-bold text-leaf-900">Ảnh tìm điểm tương đồng</p>
                  <p className="truncate text-[10px] text-river-500">Bấm Gửi hoặc nhập thêm ghi chú</p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearPendingImage}
                className="rounded-full p-1 text-river-500 hover:bg-white hover:text-rose-600"
                title="Bỏ ảnh"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Input, Camera & Mic Controls */}
          <div className="p-3 border-t border-sand-200/80 bg-white">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handlePickImage(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendMessage();
              }}
              className="flex items-center gap-1.5"
            >
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={isLoading}
                className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
                  pendingImage
                    ? 'bg-leaf-100 text-leaf-800 ring-1 ring-leaf-400'
                    : 'bg-sand-100 text-river-600 hover:bg-leaf-50 hover:text-leaf-700'
                }`}
                title="Tải ảnh lên để tìm địa điểm giống cảnh trong ảnh"
              >
                <Camera className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={toggleListening}
                className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
                  isListening
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 animate-pulse'
                    : 'bg-sand-100 text-river-600 hover:bg-leaf-50 hover:text-leaf-700'
                }`}
                title={isListening ? 'Dừng nghe' : 'Nói bằng giọng nói'}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onPaste={(e) => {
                  const fileItem = Array.from(e.clipboardData?.items || []).find((it) =>
                    it.type.startsWith('image/'),
                  );
                  if (fileItem) {
                    const imgFile = fileItem.getAsFile();
                    if (imgFile) {
                      e.preventDefault();
                      handlePickImage(imgFile);
                    }
                  }
                }}
                placeholder={
                  isListening
                    ? 'Đang nghe bạn nói...'
                    : pendingImage
                      ? 'Thêm ghi chú (vd: tìm biển gần tôi)...'
                      : 'Nhắn hoặc dán ảnh cho Pé Meko...'
                }
                disabled={isLoading}
                className="flex-1 min-w-0 rounded-full bg-sand-50 px-3.5 py-2 text-base text-river-900 placeholder:text-river-400 border border-sand-200 focus:border-leaf-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-leaf-100 transition-all sm:text-xs"
              />

              <button
                type="submit"
                disabled={isLoading || (!inputValue.trim() && !pendingImage)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-leaf-700 text-white transition-all hover:bg-leaf-800 disabled:opacity-40 shadow-2xs"
                title="Gửi"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
