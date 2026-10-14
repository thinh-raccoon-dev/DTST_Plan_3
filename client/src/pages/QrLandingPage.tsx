import { ArrowRight, Eye, Info, MapPinCheck, QrCode, Stamp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { announceBadges, ChallengeQuiz } from '../components/challenge/ChallengeQuiz';
import { IllustrativeBadge } from '../components/destination/DataBadges';
import { DestinationFacts, DestinationMap } from '../components/destination/DestinationInfo';
import { DestinationImage } from '../components/destination/DestinationImage';
import { PageContainer } from '../components/layout/PublicLayout';
import { ManualCodeForm } from '../components/qr/ManualCodeForm';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState, ErrorState, Notice, PageLoader } from '../components/ui/States';
import { useApiQuery } from '../hooks/useApiQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api, toApiError } from '../lib/api';
import { areaLabel, categoryLabel } from '../lib/catalog';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import type { CheckInResult, QrContent } from '../types/api';

function QrProblem({ code, title, description }: { code: string; title: string; description: string }) {
  return (
    <PageContainer width="narrow">
      <EmptyState icon={<QrCode className="size-6" aria-hidden />} title={title} description={description} action={<ButtonLink to="/destinations">Khám phá các địa điểm khác</ButtonLink>} />
      <Card className="mt-6 p-5">
        <p className="mb-3 text-sm text-river-600">
          Mã đã mở: <strong className="font-mono">{code}</strong>. Nếu bạn nhập nhầm, hãy thử lại:
        </p>
        <ManualCodeForm />
      </Card>
    </PageContainer>
  );
}

export function QrLandingPage() {
  const { code = '' } = useParams();
  const [params] = useSearchParams();
  const preview = params.get('preview') === '1';
  const user = useAuthStore((s) => s.user);
  const query = useApiQuery((signal) => api.get<QrContent>(`/qr/${encodeURIComponent(code)}`, { signal }).then((r) => r.data), [code, user?.id]);
  const recordedFor = useRef<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  useDocumentTitle(query.data?.destination.name ?? 'Nội dung QR');

  useEffect(() => {
    // qr_landing_view is recorded once per opened code; admin previews are never counted.
    if (!query.data || preview || recordedFor.current === code) return;
    recordedFor.current = code;
    api.post(`/qr/${encodeURIComponent(code)}/scan`).catch(() => {
      // Logging a view must never block the visitor experience.
    });
  }, [query.data, code, preview]);

  if (query.loading && !query.data) return <PageContainer><PageLoader /></PageContainer>;
  if (query.error) {
    const errorCode = query.error.code;
    if (errorCode === 'QR_NOT_FOUND') return <QrProblem code={code} title="Mã QR không tồn tại" description="Không tìm thấy nội dung cho mã này trong hệ thống." />;
    if (errorCode === 'QR_INACTIVE')
      return <QrProblem code={code} title="Mã QR tạm ngừng hoạt động" description="Nội dung của điểm này đang được cập nhật hoặc tạm dừng. Cảm ơn bạn đã ghé thăm, vui lòng quay lại sau." />;
    if (errorCode === 'QR_TARGET_UNAVAILABLE')
      return <QrProblem code={code} title="Nội dung chưa sẵn sàng" description="Nội dung gắn với mã QR này hiện chưa được xuất bản." />;
    return <PageContainer><ErrorState error={query.error} onRetry={query.reload} /></PageContainer>;
  }
  if (!query.data) return null;

  const { destination: d, challenges, progress, qr } = query.data;
  const heroImage = d.images[0] ? { url: d.images[0].url, alt: d.images[0].alt } : null;

  const readLocation = (): Promise<{ lat: number; lng: number } | null> => {
    if (!navigator.geolocation) return Promise.resolve(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
      );
    });
  };

  const checkIn = async () => {
    setCheckingIn(true);
    try {
      const coords = d.hasCoordinates ? await readLocation() : null;
      const res = await api.post<CheckInResult>(`/qr/${encodeURIComponent(code)}/check-in`, coords ?? {});
      if (res.data.created) {
        toast.success(
          `Đã check-in! +${res.data.pointsAwarded} điểm`,
          res.data.locationVerified ? 'Vị trí đã được đối chiếu với tọa độ điểm đến.' : undefined,
        );
        announceBadges(res.data.newBadges);
      } else {
        toast.info('Bạn đã check-in tại điểm này trước đó');
      }
      query.setData((current) => (current ? { ...current, progress: { ...current.progress, checkedIn: true } } : current));
    } catch (error) {
      toast.error('Không check-in được', toApiError(error).message);
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <PageContainer>
      {preview && (
        <div className="mb-5">
          <Notice tone="warning" icon={<Eye className="size-4" aria-hidden />} title="Chế độ xem trước của quản trị viên">
            Lượt mở này không được ghi nhận vào thống kê. Check-in và thử thách bị tắt trong chế độ xem trước.
          </Notice>
        </div>
      )}

      <div className="overflow-hidden rounded-panel border border-sand-200 bg-white shadow-card">
        <div className="grid md:grid-cols-[1.2fr_1fr]">
          <div className="aspect-[16/10] md:aspect-auto">
            <DestinationImage image={heroImage} category={d.category} name={d.name} showPlaceholderNote />
          </div>
          <div className="flex flex-col p-5 sm:p-7">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-600">
              <QrCode className="size-4" aria-hidden />
              {qr.label}
            </p>
            <h1 className="mt-2 text-2xl leading-tight sm:text-3xl">{d.name}</h1>
            <p className="mt-1 text-sm text-river-600">
              {categoryLabel(d.category)} · {areaLabel(d.area)}
            </p>
            {d.isIllustrative && <div className="mt-3"><IllustrativeBadge /></div>}
            <p className="mt-4 text-river-700">{d.summary || d.description.slice(0, 220)}</p>

            <div className="mt-auto pt-6">
              {progress.checkedIn ? (
                <p className="inline-flex items-center gap-2 rounded-control bg-leaf-50 px-4 py-3 text-sm font-semibold text-leaf-800">
                  <MapPinCheck className="size-5" aria-hidden />
                  Bạn đã check-in tại điểm này
                </p>
              ) : (
                <Button variant="primary" size="lg" onClick={checkIn} loading={checkingIn} disabled={preview} icon={<Stamp className="size-5" aria-hidden />}>
                  Check-in vào hộ chiếu
                </Button>
              )}
              <p className="mt-2 text-xs text-river-500">
                {d.hasCoordinates
                  ? 'Check-in cần vị trí GPS trong phạm vi 800 m so với tọa độ điểm đến. Tọa độ của bạn không được lưu.'
                  : 'Điểm này chưa có tọa độ nên check-in là tự xác nhận, không đối chiếu GPS.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <Notice icon={<Info className="size-4" aria-hidden />}>
          {user ? (
            <>Kết quả được lưu vào hộ chiếu của tài khoản <strong>{user.displayName}</strong>.</>
          ) : (
            <>
              Bạn chưa đăng nhập: kết quả được lưu cho trình duyệt này và có thể mất khi xóa dữ liệu trình duyệt.{' '}
              <Link to="/login" state={{ from: `/qr/${code}` }} className="font-semibold underline">Đăng nhập</Link> để đồng bộ vào tài khoản.
            </>
          )}
        </Notice>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="space-y-5" aria-labelledby="challenges-heading">
          <h2 id="challenges-heading" className="text-xl">Câu chuyện & thử thách</h2>
          {challenges.length === 0 ? (
            <Card className="p-5">
              <p className="whitespace-pre-line text-river-800">{d.description}</p>
              <p className="mt-4 text-sm text-river-500">Điểm này hiện chưa có thử thách đang hoạt động.</p>
            </Card>
          ) : (
            challenges.map((challenge) => (
              <ChallengeQuiz
                key={challenge.id}
                challenge={challenge}
                qrCode={qr.code}
                disabled={preview}
                completed={progress.completedChallengeIds.includes(challenge.id)}
                onCompleted={() =>
                  query.setData((current) =>
                    current
                      ? { ...current, progress: { ...current.progress, completedChallengeIds: [...new Set([...current.progress.completedChallengeIds, challenge.id])] } }
                      : current,
                  )
                }
              />
            ))
          )}
          <div className="flex flex-wrap gap-3">
            <ButtonLink to="/passport" variant="secondary" icon={<Stamp className="size-4" aria-hidden />}>
              Xem hộ chiếu
            </ButtonLink>
            <ButtonLink to={`/destinations/${d.slug}`} variant="ghost">
              Thông tin đầy đủ về địa điểm <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
          </div>
        </section>
        <aside className="space-y-6">
          <DestinationFacts destination={d} />
          <DestinationMap destination={d} />
        </aside>
      </div>
    </PageContainer>
  );
}
