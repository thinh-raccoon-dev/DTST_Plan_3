import clsx from 'clsx';
import {
  Camera,
  Download,
  ImagePlus,
  Loader2,
  MapPin,
  RotateCcw,
  Send,
  Sparkles,
  SwitchCamera,
  Trash2,
  VideoOff,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, toApiError } from '../../lib/api';
import { preparePhotoForUpload, type PreparedPhotoUpload } from '../../lib/exifReader';
import { haversineDistanceKm } from '../../lib/footprintOfflineStore';
import {
  formatPhotoClock,
  type FootprintPhotoItem,
  type GeofenceTargetItem,
  type LiveUserLocation,
} from '../../lib/footprintPhotoStore';
import { toast } from '../../stores/toastStore';
import type { BadgeInfo } from '../../types/api';
import { announceBadges } from '../challenge/ChallengeQuiz';

export type PhotoCaptureInitialMode = 'default' | 'camera' | 'upload';

interface PhotoCaptureModalProps {
  open: boolean;
  onClose: () => void;
  userLocation: LiveUserLocation | null;
  initialCoords?: { lat: number; lng: number } | null;
  initialPlaceName?: string;
  initialMode?: PhotoCaptureInitialMode;
  initialFiles?: File[] | null;
  geofenceTargets: GeofenceTargetItem[];
  activeTrackClientId?: string;
  onUploaded: (photos: FootprintPhotoItem[]) => void;
  onRequestLocation: () => void;
}

interface QueuedPhotoItem extends PreparedPhotoUpload {
  localId: string;
  takenAtIso: string;
}

export function PhotoCaptureModal({
  open,
  onClose,
  userLocation,
  initialCoords,
  initialPlaceName = '',
  initialMode = 'camera',
  initialFiles = null,
  geofenceTargets,
  activeTrackClientId,
  onUploaded,
  onRequestLocation,
}: PhotoCaptureModalProps) {
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const queueRef = useRef<QueuedPhotoItem[]>([]);
  const wasOpenRef = useRef(false);

  const [queue, setQueue] = useState<QueuedPhotoItem[]>([]);
  queueRef.current = queue;
  const [activePreviewIdx, setActivePreviewIdx] = useState(0);

  const [parsing, setParsing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ done: number; total: number } | null>(null);
  const [caption, setCaption] = useState('');

  // Live Locket Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [shutterFlash, setShutterFlash] = useState(false);

  // Silent automatic coordinate resolution (zero manual inputs required!)
  const activePhoto = queue[activePreviewIdx] || queue[0] || null;

  const resolvedCoords = useMemo(() => {
    if (activePhoto?.exif.hasExifGps && activePhoto.exif.lat !== undefined && activePhoto.exif.lng !== undefined) {
      return { lat: activePhoto.exif.lat, lng: activePhoto.exif.lng, source: 'exif' as const };
    }
    if (initialCoords) {
      return { lat: initialCoords.lat, lng: initialCoords.lng, source: 'manual' as const };
    }
    if (userLocation) {
      return { lat: userLocation.lat, lng: userLocation.lng, source: 'gps' as const };
    }
    return { lat: 10.3125, lng: 105.7468, source: 'manual' as const };
  }, [activePhoto, initialCoords, userLocation]);

  // Auto-resolve nearest destination within 500m purely for display & automatic tagging
  const autoMatchedDest = useMemo(() => {
    let best: { dest: GeofenceTargetItem; distKm: number } | null = null;
    for (const d of geofenceTargets) {
      const distKm = haversineDistanceKm(resolvedCoords, d.coordinates);
      if (distKm <= 0.5 && (!best || distKm < best.distKm)) {
        best = { dest: d, distKm };
      }
    }
    return best?.dest ?? null;
  }, [geofenceTargets, resolvedCoords]);

  const displayLocationLabel =
    initialPlaceName ||
    autoMatchedDest?.name ||
    (resolvedCoords.source === 'exif'
      ? `EXIF · ${resolvedCoords.lat.toFixed(4)}, ${resolvedCoords.lng.toFixed(4)}`
      : userLocation
        ? `Vị trí hiện tại`
        : `${resolvedCoords.lat.toFixed(4)}, ${resolvedCoords.lng.toFixed(4)}`);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startLiveCamera = useCallback(
    async (facing: 'environment' | 'user' = facingMode) => {
      stopCameraStream();
      setCameraError(null);

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraActive(true);
        setCameraError('Trình duyệt không hỗ trợ mở camera trực tiếp.');
        return;
      }

      setCameraActive(true);
      setCameraStarting(true);
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facing }, width: { ideal: 1440 }, height: { ideal: 1440 } },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        const denied =
          err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
        setCameraError(
          denied ? 'Chưa cấp quyền Camera cho trình duyệt.' : 'Không tìm thấy Camera trên thiết bị này.',
        );
      } finally {
        setCameraStarting(false);
      }
    },
    [facingMode, stopCameraStream],
  );

  // Bind active MediaStream when video mounts
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  const processFiles = useCallback(async (filesArray: File[]) => {
    if (filesArray.length === 0) return;
    setParsing(true);
    try {
      const remaining = Math.max(0, 10 - queueRef.current.length);
      const slice = filesArray.slice(0, remaining);
      const prepared: QueuedPhotoItem[] = [];

      for (const f of slice) {
        const res = await preparePhotoForUpload(f);
        const fallbackDate = f.lastModified ? new Date(f.lastModified) : new Date();
        const takenAtDate = res.exif.takenAt || fallbackDate;
        prepared.push({
          ...res,
          localId: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          takenAtIso: takenAtDate.toISOString(),
        });
      }

      setQueue((prev) => {
        const next = [...prev, ...prepared];
        setActivePreviewIdx(next.length - 1);
        return next;
      });
    } catch {
      toast.error('Không thể đọc ảnh vừa chọn', 'Vui lòng chọn ảnh JPG, PNG hoặc WebP.');
    } finally {
      setParsing(false);
    }
  }, []);

  // Initialize cleanly ONLY on open transition
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setCaption('');
      setCameraError(null);
      setActivePreviewIdx(0);
      if (!userLocation) onRequestLocation();

      if (initialFiles && initialFiles.length > 0) {
        setCameraActive(false);
        void processFiles(initialFiles);
      } else {
        void startLiveCamera('environment');
      }
    } else if (!open && wasOpenRef.current) {
      stopCameraStream();
      setCameraActive(false);
      setCameraError(null);
      for (const item of queueRef.current) URL.revokeObjectURL(item.previewUrl);
      setQueue([]);
    }
    wasOpenRef.current = open;
  }, [open, initialMode, initialFiles, userLocation, onRequestLocation, processFiles, startLiveCamera, stopCameraStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
      for (const item of queueRef.current) URL.revokeObjectURL(item.previewUrl);
    };
  }, [stopCameraStream]);

  // Esc key closes cleanly
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) {
        stopCameraStream();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, sending, stopCameraStream, onClose]);

  if (!open) return null;

  const isPreviewState = queue.length > 0 && !cameraActive;

  const handleCloseClean = () => {
    if (sending) return;
    stopCameraStream();
    setCameraActive(false);
    onClose();
  };

  const handleSnapShutter = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    setShutterFlash(true);
    window.setTimeout(() => setShutterFlash(false), 160);

    // Locket crisp square crop centered from camera feed
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const side = Math.min(vw, vh);
    const sx = Math.round((vw - side) / 2);
    const sy = Math.round((vh - side) / 2);
    const outSize = Math.min(1440, side);

    const canvas = document.createElement('canvas');
    canvas.width = outSize;
    canvas.height = outSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (facingMode === 'user') {
      ctx.translate(outSize, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, side, side, 0, 0, outSize, outSize);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return;

    const now = new Date();
    const capturedFile = new File([blob], `locket-${now.getTime()}.jpg`, {
      type: 'image/jpeg',
      lastModified: now.getTime(),
    });
    const previewUrl = URL.createObjectURL(blob);

    // Clear previous single snapped photo if retaking
    for (const prevItem of queueRef.current) URL.revokeObjectURL(prevItem.previewUrl);

    setQueue([
      {
        localId: `cam-${now.getTime()}`,
        file: capturedFile,
        previewUrl,
        exif: { hasExifGps: false, hasExifDate: false, takenAt: now },
        width: outSize,
        height: outSize,
        takenAtIso: now.toISOString(),
      },
    ]);
    setActivePreviewIdx(0);
    stopCameraStream();
    setCameraActive(false);
  };

  const handleRetake = () => {
    for (const item of queueRef.current) URL.revokeObjectURL(item.previewUrl);
    setQueue([]);
    setCaption('');
    if (initialMode === 'upload') {
      handleCloseClean();
    } else {
      void startLiveCamera(facingMode);
    }
  };

  const handleFlipCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    void startLiveCamera(next);
  };

  const handleRemoveSingleFromMulti = (localId: string) => {
    setQueue((prev) => {
      const target = prev.find((p) => p.localId === localId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      const remaining = prev.filter((p) => p.localId !== localId);
      if (remaining.length === 0) {
        if (initialMode === 'upload') handleCloseClean();
        else void startLiveCamera(facingMode);
      } else {
        setActivePreviewIdx((idx) => Math.min(idx, remaining.length - 1));
      }
      return remaining;
    });
  };

  const handleDownloadPreview = () => {
    if (!activePhoto) return;
    const a = document.createElement('a');
    a.href = activePhoto.previewUrl;
    a.download = activePhoto.file.name || `dong-thap-${Date.now()}.jpg`;
    a.click();
  };

  const handleSend = async () => {
    if (queue.length === 0 || sending) return;

    setSending(true);
    setSendProgress({ done: 0, total: queue.length });
    const createdPhotos: FootprintPhotoItem[] = [];
    const earnedBadges: BadgeInfo[] = [];
    let autoCheckInNotice: string | null = null;

    try {
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i]!;
        const hasItemExif =
          item.exif.hasExifGps && item.exif.lat !== undefined && item.exif.lng !== undefined;

        const finalLat = hasItemExif ? item.exif.lat! : resolvedCoords.lat;
        const finalLng = hasItemExif ? item.exif.lng! : resolvedCoords.lng;
        const finalExifSource = hasItemExif
          ? 'exif'
          : userLocation && !initialCoords
            ? 'gps'
            : 'manual';

        const fd = new FormData();
        fd.append('photo', item.file);
        fd.append('clientPhotoId', `web-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`);
        fd.append('lat', String(finalLat));
        fd.append('lng', String(finalLng));
        fd.append('takenAt', item.takenAtIso);
        fd.append('sourceApp', hasItemExif ? 'import' : 'web');
        fd.append('exifSource', finalExifSource);
        if (initialPlaceName.trim()) fd.append('placeName', initialPlaceName.trim());
        else if (autoMatchedDest?.name) fd.append('placeName', autoMatchedDest.name);
        if (autoMatchedDest?.id) fd.append('destinationId', autoMatchedDest.id);
        if (caption.trim()) fd.append('caption', caption.trim());
        if (activeTrackClientId) fd.append('trackClientId', activeTrackClientId);
        if (item.exif.deviceModel) fd.append('deviceModel', item.exif.deviceModel);
        if (userLocation?.accuracyMeters && finalExifSource === 'gps') {
          fd.append('accuracyMeters', String(Math.round(userLocation.accuracyMeters)));
        }
        if (item.width) fd.append('width', String(item.width));
        if (item.height) fd.append('height', String(item.height));

        const res = await api.post<{
          success: boolean;
          photo: FootprintPhotoItem;
          autoCheckIn?: { name: string; pointsAwarded: number } | null;
          newBadges?: BadgeInfo[];
        }>('/footprints/photos', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30_000,
        });

        if (res.data?.photo) createdPhotos.push(res.data.photo);
        if (res.data?.autoCheckIn) {
          autoCheckInNotice = `${res.data.autoCheckIn.name} (+${res.data.autoCheckIn.pointsAwarded} EXP)`;
        }
        if (res.data?.newBadges?.length) earnedBadges.push(...res.data.newBadges);
        setSendProgress({ done: i + 1, total: queue.length });
      }

      if (createdPhotos.length > 0) {
        onUploaded(createdPhotos);
        toast.success(
          createdPhotos.length === 1
            ? 'Đã lưu khoảnh khắc lên bản đồ!'
            : `Đã lưu ${createdPhotos.length} ảnh lên bản đồ!`,
          autoCheckInNotice ? `Tự động đóng dấu Hộ chiếu tại ${autoCheckInNotice}` : undefined,
        );
      }
      if (earnedBadges.length > 0) announceBadges(earnedBadges);

      for (const q of queue) URL.revokeObjectURL(q.previewUrl);
      setQueue([]);
      setCaption('');
      stopCameraStream();
      setCameraActive(false);
      onClose();
    } catch (err) {
      toast.error('Không gửi được ảnh', toApiError(err).message);
    } finally {
      setSending(false);
      setSendProgress(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1150] flex items-center justify-center bg-black/82 p-4 backdrop-blur-2xl"
      role="dialog"
      aria-modal="true"
      aria-label={isPreviewState ? 'Xem trước và gửi ảnh lên bản đồ' : 'Camera chụp ảnh nhanh'}
    >
      {/* Hidden file pickers */}
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = '';
          if (files.length > 0) {
            stopCameraStream();
            setCameraActive(false);
            void processFiles(files);
          }
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = '';
          if (files.length > 0) {
            stopCameraStream();
            setCameraActive(false);
            void processFiles(files);
          }
        }}
      />

      {/* Minimalist Locket Column */}
      <div className="flex w-full max-w-[392px] flex-col items-center gap-5">
        {/* Top Minimal Pill: Auto Location + Close */}
        <div className="flex w-full items-center justify-between gap-2 px-1">
          <div className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 ring-1 ring-white/15 backdrop-blur-md">
            <MapPin className="size-3.5 shrink-0 text-emerald-400" aria-hidden />
            <span className="truncate">{displayLocationLabel}</span>
            {activePhoto?.exif.hasExifGps && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/25 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                <Sparkles className="size-2.5" />
                EXIF
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={sending}
            onClick={handleCloseClean}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-white/12 text-white/90 ring-1 ring-white/15 transition hover:bg-white/22 disabled:opacity-40"
            aria-label="Đóng"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ── Center Locket Squircle Frame (Live Viewfinder OR Frozen Preview) ── */}
        <div className="relative aspect-square w-full overflow-hidden rounded-[36px] bg-slate-950 shadow-[0_28px_70px_-14px_rgba(0,0,0,0.85)] ring-1 ring-white/18">
          {parsing ? (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-white">
              <Loader2 className="size-8 animate-spin text-emerald-400" />
              <span className="text-xs font-semibold text-white/75">Đang chuẩn bị ảnh...</span>
            </div>
          ) : isPreviewState && activePhoto ? (
            <>
              <img
                src={activePhoto.previewUrl}
                alt=""
                className="size-full object-cover"
              />
              {/* Subtle top-right timestamp pill */}
              <span className="pointer-events-none absolute right-3.5 top-3.5 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-bold text-white/95 backdrop-blur-md tabular-nums">
                {formatPhotoClock(activePhoto.takenAtIso)}
              </span>

              {/* Optional single-line Locket caption pill right inside the bottom of the frame */}
              <div className="absolute inset-x-4 bottom-4 flex justify-center">
                <input
                  type="text"
                  maxLength={140}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !sending) void handleSend();
                  }}
                  placeholder="Thêm chú thích..."
                  className="w-full max-w-[280px] rounded-full border border-white/20 bg-black/50 px-4 py-2 text-center text-xs font-semibold text-white placeholder:text-white/65 backdrop-blur-xl transition focus:border-emerald-400 focus:bg-black/68 focus:outline-none"
                />
              </div>
            </>
          ) : cameraError ? (
            <div className="flex size-full flex-col items-center justify-center px-7 text-center text-white">
              <span className="grid size-14 place-items-center rounded-full bg-white/10 text-amber-300">
                <VideoOff className="size-6" />
              </span>
              <p className="mt-3 text-xs font-semibold leading-relaxed text-white/80">
                {cameraError}
              </p>
              <div className="mt-5 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-emerald-400"
                >
                  <Camera className="size-3.5" />
                  Chụp bằng máy
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/25"
                >
                  <ImagePlus className="size-3.5" />
                  Chọn ảnh
                </button>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={clsx(
                  'size-full object-cover',
                  facingMode === 'user' && '-scale-x-100',
                )}
              />
              {cameraStarting && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-white">
                  <Loader2 className="size-8 animate-spin text-emerald-400" />
                </div>
              )}
              {shutterFlash && (
                <div className="pointer-events-none absolute inset-0 bg-white/85 transition-opacity" />
              )}
            </>
          )}
        </div>

        {/* Multi-photo minimal strip ONLY if user uploaded 2+ photos at once */}
        {isPreviewState && queue.length > 1 && (
          <div className="flex max-w-full items-center gap-2 overflow-x-auto px-1 no-scrollbar">
            {queue.map((item, idx) => (
              <div
                key={item.localId}
                className={clsx(
                  'relative size-12 shrink-0 overflow-hidden rounded-xl transition',
                  idx === activePreviewIdx ? 'ring-2 ring-emerald-400' : 'opacity-55 hover:opacity-90',
                )}
              >
                <button
                  type="button"
                  onClick={() => setActivePreviewIdx(idx)}
                  className="size-full"
                  aria-label={`Xem ảnh ${idx + 1}`}
                >
                  <img src={item.previewUrl} alt="" className="size-full object-cover" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveSingleFromMulti(item.localId)}
                  className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-black/75 text-white hover:bg-rose-600"
                  aria-label="Bỏ ảnh này"
                >
                  <Trash2 className="size-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Bottom Locket 3-Button Action Bar (Snap -> Send!) ── */}
        {isPreviewState ? (
          <div className="flex w-full items-center justify-around px-4">
            {/* Left: Retake / Cancel */}
            <button
              type="button"
              disabled={sending}
              onClick={handleRetake}
              className="grid size-12 place-items-center rounded-full bg-white/12 text-white ring-1 ring-white/15 transition hover:bg-white/22 active:scale-90 disabled:opacity-40"
              aria-label={initialMode === 'upload' ? 'Hủy' : 'Chụp lại'}
              title={initialMode === 'upload' ? 'Hủy' : 'Chụp lại'}
            >
              {initialMode === 'upload' ? <X className="size-5" /> : <RotateCcw className="size-5" />}
            </button>

            {/* Center: Giant Locket SEND Button */}
            <button
              type="button"
              disabled={sending}
              onClick={() => void handleSend()}
              className="relative grid size-[76px] place-items-center rounded-full bg-emerald-500 text-white shadow-[0_0_0_5px_rgba(16,185,129,0.28),0_18px_36px_-8px_rgba(16,185,129,0.8)] transition hover:scale-105 hover:bg-emerald-400 active:scale-92 disabled:opacity-65"
              aria-label="Gửi và lưu ảnh lên bản đồ"
              title="Gửi lên bản đồ"
            >
              {sending ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="size-6 animate-spin" />
                  {sendProgress && sendProgress.total > 1 && (
                    <span className="mt-0.5 text-[10px] font-extrabold tabular-nums">
                      {sendProgress.done}/{sendProgress.total}
                    </span>
                  )}
                </div>
              ) : (
                <Send className="size-7 -translate-x-0.5 translate-y-0.5" />
              )}
            </button>

            {/* Right: Add more (when uploading) OR Save copy (when snapped from cam) */}
            {initialMode === 'upload' ? (
              <button
                type="button"
                disabled={sending || queue.length >= 10}
                onClick={() => galleryInputRef.current?.click()}
                className="grid size-12 place-items-center rounded-full bg-white/12 text-white ring-1 ring-white/15 transition hover:bg-white/22 active:scale-90 disabled:opacity-40"
                aria-label="Thêm ảnh khác"
                title="Thêm ảnh khác"
              >
                <ImagePlus className="size-5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={sending}
                onClick={handleDownloadPreview}
                className="grid size-12 place-items-center rounded-full bg-white/12 text-white ring-1 ring-white/15 transition hover:bg-white/22 active:scale-90 disabled:opacity-40"
                aria-label="Tải bản sao về máy"
                title="Tải bản sao về máy"
              >
                <Download className="size-5" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex w-full items-center justify-around px-4">
            {/* Left: Quick switch to Gallery */}
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="grid size-12 place-items-center rounded-full bg-white/12 text-white ring-1 ring-white/15 transition hover:bg-white/22 active:scale-90"
              aria-label="Chọn ảnh từ thư viện"
              title="Chọn ảnh từ thư viện"
            >
              <ImagePlus className="size-5" />
            </button>

            {/* Center: Giant Locket White-Ring Shutter Button */}
            <button
              type="button"
              disabled={cameraStarting || Boolean(cameraError)}
              onClick={() => void handleSnapShutter()}
              className="grid size-[78px] place-items-center rounded-full border-[4px] border-emerald-400 bg-transparent p-1.5 shadow-[0_14px_34px_-6px_rgba(16,185,129,0.55)] transition hover:scale-105 active:scale-90 disabled:opacity-35"
              aria-label="Chụp ảnh"
              title="Chụp ảnh"
            >
              <span className="size-full rounded-full bg-white transition" />
            </button>

            {/* Right: Flip Front / Rear Camera */}
            <button
              type="button"
              disabled={Boolean(cameraError)}
              onClick={handleFlipCamera}
              className="grid size-12 place-items-center rounded-full bg-white/12 text-white ring-1 ring-white/15 transition hover:bg-white/22 active:scale-90 disabled:opacity-35"
              aria-label="Đổi camera trước sau"
              title="Đổi camera trước / sau"
            >
              <SwitchCamera className="size-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
