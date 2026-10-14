import { BarChart3, Eye, Info, MousePointerClick, QrCode, Route, Trophy, Users } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AdminPageHeader } from '../../components/layout/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Card, StatCard } from '../../components/ui/Card';
import { FormField, Input } from '../../components/ui/Field';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/States';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api } from '../../lib/api';
import { formatDate, formatNumber, vnDateString } from '../../lib/format';
import type { AnalyticsReport } from '../../types/api';

const DAY = 24 * 60 * 60 * 1000;
const presets = [
  { label: '7 ngày', days: 7 },
  { label: '30 ngày', days: 30 },
  { label: '90 ngày', days: 90 },
];

function rangeFor(days: number) {
  const now = new Date();
  return { from: vnDateString(new Date(now.getTime() - (days - 1) * DAY)), to: vnDateString(now) };
}

function TopList({ title, items, unit }: { title: string; items: Array<{ id: string; label: string; sub?: string; count: number }>; unit: string }) {
  return (
    <Card className="p-5">
      <h2 className="text-base">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-river-500">Chưa có dữ liệu trong khoảng thời gian này.</p>
      ) : (
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={items} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e9e4d6" />
              <XAxis type="number" allowDecimals={false} fontSize={12} />
              <YAxis type="category" dataKey="label" width={130} fontSize={12} tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)} />
              <Tooltip formatter={(value) => [`${value} ${unit}`, '']} />
              <Bar dataKey="count" fill="#176b50" radius={[0, 4, 4, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export function AdminDashboardPage() {
  useDocumentTitle('Tổng quan quản trị');
  const [range, setRange] = useState(() => rangeFor(30));
  const [draft, setDraft] = useState(range);
  const query = useApiQuery(
    (signal) => api.get<AnalyticsReport>('/admin/analytics', { params: range, signal }).then((r) => r.data),
    [range.from, range.to],
  );
  const report = query.data;
  const hasActivity = report ? report.daily.some((d) => d.pageViews + d.qrLandings + d.interactions + d.completions > 0) : false;

  return (
    <>
      <AdminPageHeader
        title="Tổng quan hoạt động"
        description={report ? `Thống kê từ ${formatDate(report.range.from)} đến ${formatDate(report.range.to)} (giờ Việt Nam, ${report.range.days} ngày).` : 'Số liệu lấy trực tiếp từ cơ sở dữ liệu.'}
      />

      <Card className="mb-6 p-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.from && draft.to && draft.from <= draft.to) setRange(draft);
          }}
        >
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Button
                key={p.days}
                size="sm"
                variant="secondary"
                onClick={() => {
                  const r = rangeFor(p.days);
                  setDraft(r);
                  setRange(r);
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <FormField label="Từ ngày">
            <Input type="date" value={draft.from} max={draft.to} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
          </FormField>
          <FormField label="Đến ngày">
            <Input type="date" value={draft.to} min={draft.from} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
          </FormField>
          <Button type="submit" disabled={!draft.from || !draft.to || draft.from > draft.to}>
            Áp dụng
          </Button>
        </form>
      </Card>

      {query.loading && !report ? (
        <PageLoader />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.reload} />
      ) : report ? (
        <div className="space-y-6" aria-busy={query.loading}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Địa điểm đã xuất bản" value={report.current.publishedDestinations} hint="Hiện tại" />
            <StatCard label="QR đang hoạt động" value={report.current.activeQrCodes} hint="Hiện tại" icon={<QrCode className="size-5" aria-hidden />} />
            <StatCard label="Lượt xem trang địa điểm" value={formatNumber(report.totals.destinationPageViews)} icon={<Eye className="size-5" aria-hidden />} />
            <StatCard label="Lượt mở trang từ QR" value={formatNumber(report.totals.qrLandingViews)} hint="Không phải số khách thực tế" icon={<QrCode className="size-5" aria-hidden />} />
            <StatCard
              label="Lượt tương tác"
              value={formatNumber(report.totals.interactions)}
              hint={`${report.totals.challengeAttempts} lượt gửi đáp án · ${report.totals.checkIns} check-in`}
              icon={<MousePointerClick className="size-5" aria-hidden />}
            />
            <StatCard label="Hoàn thành thử thách" value={formatNumber(report.totals.challengeCompletions)} hint={`${report.totals.badgesAwarded} huy hiệu được cấp`} icon={<Trophy className="size-5" aria-hidden />} />
            <StatCard label="Lịch trình được tạo" value={formatNumber(report.totals.itinerariesGenerated)} hint={`${report.totals.itinerariesSaved} đã lưu vào tài khoản`} icon={<Route className="size-5" aria-hidden />} />
            <StatCard label="Người dùng duy nhất (ước tính)" value={formatNumber(report.totals.uniqueVisitors)} hint={`${report.totals.uniqueAccounts} tài khoản đăng nhập`} icon={<Users className="size-5" aria-hidden />} />
          </div>

          {report.funnel && (
            <Card className="p-5">
              <h2 className="text-base">Phễu chuyển đổi (ước lượng)</h2>
              <p className="mt-1 text-sm text-river-600">{report.definitions.funnel}</p>
              <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {report.funnel.steps.map((step, index) => (
                  <li key={step.key} className="rounded-card bg-sand-50 p-3 ring-1 ring-sand-200">
                    <p className="text-xs font-semibold uppercase tracking-wide text-river-500">
                      Bước {index + 1}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-river-900">{step.label}</p>
                    <p className="mt-1 text-2xl font-bold text-leaf-800">{formatNumber(step.count)}</p>
                  </li>
                ))}
              </ol>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Xem trang → mở QR', report.funnel.rates.pageViewToQr],
                  ['Mở QR → check-in', report.funnel.rates.qrToCheckIn],
                  ['Check-in → gửi đáp án', report.funnel.rates.checkInToChallengeAttempt],
                  ['Gửi đáp án → hoàn thành', report.funnel.rates.attemptToCompletion],
                  ['Tạo lịch trình → lưu', report.funnel.rates.generateToSave],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-3 rounded-control bg-white px-3 py-2 ring-1 ring-sand-200">
                    <dt className="text-river-600">{label}</dt>
                    <dd className="font-semibold text-river-900">{value === null ? '—' : `${value}%`}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="text-base">Hoạt động theo ngày</h2>
            {hasActivity ? (
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={report.daily.map((d) => ({ ...d, label: d.date.slice(5).split('-').reverse().join('/') }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e9e4d6" />
                    <XAxis dataKey="label" fontSize={12} minTickGap={16} />
                    <YAxis allowDecimals={false} fontSize={12} width={32} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="pageViews" name="Xem trang địa điểm" stroke="#153f32" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="qrLandings" name="Mở từ QR" stroke="#176b50" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="interactions" name="Tương tác" stroke="#8ebf83" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="completions" name="Hoàn thành" stroke="#efa4b5" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState className="mt-4" icon={<BarChart3 className="size-6" aria-hidden />} title="Chưa có hoạt động" description="Chưa có sự kiện nào được ghi nhận trong khoảng thời gian đã chọn." />
            )}
          </Card>

          <div className="grid gap-6 xl:grid-cols-3">
            <TopList title="Địa điểm được xem nhiều" unit="lượt xem" items={report.topDestinations.map((d) => ({ id: d.id, label: d.name, count: d.count }))} />
            <TopList title="Mã QR được mở nhiều" unit="lượt mở" items={report.topQrCodes.map((q) => ({ id: q.id, label: q.code, count: q.count }))} />
            <TopList title="Thử thách hoàn thành nhiều" unit="lượt" items={report.topChallenges.map((c) => ({ id: c.id, label: c.title, count: c.count }))} />
          </div>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-base">
              <Info className="size-4 text-river-500" aria-hidden />
              Cách tính số liệu
            </h2>
            <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
              {Object.entries({
                'Lượt xem trang địa điểm': report.definitions.destinationPageViews,
                'Lượt mở trang từ QR': report.definitions.qrLandingViews,
                'Lượt tương tác': report.definitions.interactions,
                'Hoàn thành thử thách': report.definitions.challengeCompletions,
                'Người dùng duy nhất': report.definitions.uniqueVisitors,
                'Phễu chuyển đổi': report.definitions.funnel,
              }).map(([label, text]) => (
                <div key={label}>
                  <dt className="font-semibold text-river-800">{label}</dt>
                  <dd className="text-river-600">{text}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      ) : null}
    </>
  );
}
