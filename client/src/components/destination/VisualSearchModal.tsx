import { Camera, Compass, ExternalLink, ImagePlus, Loader2, MapPin, Sparkles, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, toApiError } from '../../lib/api';

interface VisualMatchResult {
  id: string;
  slug: string;
  name: string;
  area: string;
  areaLabel: string;
  category: string;
  summary: string;
  imageUrl?: string;
  vibeScore: number;
  distanceKm?: number;
  matchReason: string;
  isReferencePlace?: boolean;
}

interface VisualSearchApiResponse {
  success: boolean;
  analysis: {
    recognizedPlace: string | null;
    sceneType: string;
    sceneLabelVi: string;
    vibeMood: string;
    visualTags: string[];
  };
  reply: string;
  anchorLabel: string;
  matches: VisualMatchResult[];
}

export function VisualSearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [useGps, setUseGps] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<VisualSearchApiResponse | null>(null);

  if (!open) return null;

  const handleSelectFile = (file?: File | null) => {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setErrorMsg(null);
  };

  const getCurrentCoords = (): Promise<{ lat: number; lng: number } | null> =>
    new Promise((resolve) => {
      if (!useGps || !('geolocation' in navigator)) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 3500 },
      );
    });

  const handleSearch = async () => {
    if (!selectedFile || loading) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const coords = await getCurrentCoords();
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append(
        'prompt',
        prompt.trim() || 'Tìm địa điểm có khung cảnh hoặc trải nghiệm tương tự gần tôi',
      );
      if (coords) {
        formData.append('userLat', String(coords.lat));
        formData.append('userLng', String(coords.lng));
      }

      const res = await api.post<VisualSearchApiResponse>('/ai/visual-search', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      setResult(res.data);
    } catch (err) {
      setErrorMsg(toApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="tp-scale-up flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-sand-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sand-200 bg-gradient-to-r from-leaf-900 via-leaf-800 to-teal-800 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-white/15">
              <Camera className="size-5 text-teal-200" />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-white">Tìm điểm đến bằng Hình ảnh (AI Vibe Search)</h2>
              <p className="text-xs text-leaf-100">
                Tải ảnh biển, núi, chùa, vườn hoa... AI sẽ tìm địa điểm có khung cảnh tương đồng gần bạn
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-white/80 hover:bg-white/15 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {/* Upload Dropzone */}
          <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative flex h-44 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-leaf-300 bg-leaf-50/40 p-3 text-center transition hover:border-leaf-500 hover:bg-leaf-50"
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Ảnh đã chọn" className="size-full rounded-xl object-cover" />
              ) : (
                <>
                  <ImagePlus className="size-8 text-leaf-600 transition group-hover:scale-110" />
                  <span className="mt-2 text-xs font-bold text-leaf-800">Chọn ảnh hoặc chụp mới</span>
                  <span className="mt-0.5 text-[11px] text-river-500">JPG, PNG, WebP (≤ 6MB)</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleSelectFile(e.target.files?.[0])}
            />

            <div className="flex flex-col justify-between gap-3">
              <div>
                <label className="block text-xs font-bold text-river-700">
                  Mô tả thêm mong muốn của bạn (tùy chọn)
                </label>
                <textarea
                  rows={2}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ví dụ: Đây là biển Phú Quốc, tìm giúp mình bãi biển tương tự gần Đồng Tháp nhất..."
                  className="mt-1.5 w-full rounded-xl border border-sand-300 bg-sand-50/60 px-3 py-2 text-xs text-river-900 placeholder:text-river-400 focus:border-leaf-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-leaf-100"
                />
                <label className="mt-2.5 flex items-center gap-2 text-xs font-medium text-river-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useGps}
                    onChange={(e) => setUseGps(e.target.checked)}
                    className="size-4 rounded border-sand-300 text-leaf-600 focus:ring-leaf-500"
                  />
                  Ưu tiên tìm địa điểm tương tự gần vị trí GPS hiện tại của tôi
                </label>
              </div>

              <button
                type="button"
                disabled={!selectedFile || loading}
                onClick={() => void handleSearch()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-leaf-700 to-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-105 disabled:opacity-45"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Đang phân tích ảnh bằng AI Vision...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 text-amber-300" /> Phân tích ảnh & Tìm điểm tương đồng
                  </>
                )}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-800">
              {errorMsg}
            </div>
          )}

          {/* Analysis & Results */}
          {result && (
            <div className="space-y-3 border-t border-sand-200 pt-4">
              <div className="rounded-2xl bg-leaf-50/70 p-4 ring-1 ring-leaf-200">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-leaf-700 px-2.5 py-0.5 text-[11px] font-bold text-white">
                    <Sparkles className="size-3" /> {result.analysis.sceneLabelVi}
                  </span>
                  {result.analysis.recognizedPlace && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-river-800 ring-1 ring-sand-300">
                      📍 Nhận diện: {result.analysis.recognizedPlace}
                    </span>
                  )}
                  <span className="text-[11px] font-medium text-river-600">
                    Đo khoảng cách từ: <strong>{result.anchorLabel}</strong>
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-river-700">
                  <strong>Vibe cảm nhận:</strong> {result.analysis.vibeMood}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {result.matches.map((item) => (
                  <Link
                    key={item.slug}
                    to={`/destinations/${item.slug}`}
                    onClick={onClose}
                    className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-sand-200 bg-white p-3.5 shadow-2xs transition hover:-translate-y-0.5 hover:border-leaf-400 hover:shadow-md"
                  >
                    <div>
                      {item.imageUrl && (
                        <div className="relative -mx-3.5 -mt-3.5 mb-2.5 h-28 overflow-hidden bg-sand-100">
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="size-full object-cover transition duration-300 group-hover:scale-105"
                          />
                          <span className="absolute right-2 top-2 rounded-full bg-emerald-600/95 px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow">
                            {item.vibeScore}% hợp vibe
                          </span>
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-river-900 group-hover:text-leaf-700">{item.name}</h4>
                        {!item.imageUrl && (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            {item.vibeScore}%
                          </span>
                        )}
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-river-600">
                        <MapPin className="size-3 text-leaf-600" />
                        <span>{item.areaLabel}</span>
                        {item.distanceKm !== undefined && (
                          <span className="text-teal-700">· ~{item.distanceKm} km</span>
                        )}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11px] text-river-500">{item.matchReason}</p>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between border-t border-sand-100 pt-2 text-[11px] font-bold text-leaf-700">
                      <span className="inline-flex items-center gap-1">
                        <Compass className="size-3" /> Xem chi tiết & bản đồ
                      </span>
                      <ExternalLink className="size-3" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
