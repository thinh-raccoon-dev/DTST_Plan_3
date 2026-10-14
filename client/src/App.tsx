import { useEffect, type ComponentType } from 'react';
import { createBrowserRouter, Outlet, RouterProvider, useRouteError } from 'react-router-dom';
import { RequireAuth, RequireStaff } from './components/layout/Guards';
import { PublicLayout } from './components/layout/PublicLayout';
import { Button } from './components/ui/Button';
import { EmptyState, PageLoader } from './components/ui/States';
import { Toaster } from './components/ui/Toaster';
import { AdminLoginPage, LoginPage, RegisterPage } from './pages/AuthPages';
import { DestinationDetailPage } from './pages/DestinationDetailPage';
import { DestinationsPage } from './pages/DestinationsPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { HomePage } from './pages/HomePage';
import { ItineraryCreatePage } from './pages/ItineraryCreatePage';
import { ItineraryDetailPage, MyItinerariesPage } from './pages/ItineraryPages';
import { PassportPage } from './pages/PassportPage';
import { ProfilePage } from './pages/ProfilePage';
import { QrLandingPage } from './pages/QrLandingPage';
import { NotFoundPage, PrivacyPage, TermsPage } from './pages/StaticPages';
import { useAuthStore } from './stores/authStore';

function RouteError() {
  const error = useRouteError();
  const chunkFailed = error instanceof Error && /dynamically imported module|Failed to fetch/i.test(error.message);
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <EmptyState
        title="Trang gặp sự cố"
        description={chunkFailed ? 'Ứng dụng vừa được cập nhật hoặc mạng không ổn định. Tải lại trang để tiếp tục.' : 'Đã có lỗi khi hiển thị trang này.'}
        action={<Button onClick={() => window.location.reload()}>Tải lại trang</Button>}
      />
    </div>
  );
}

/** Code-split route: resolves a named export into the router's `Component`. */
function lazyPage<M>(load: () => Promise<M>, pick: (module: M) => ComponentType) {
  return async () => ({ Component: pick(await load()) });
}

const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    hydrateFallbackElement: <PageLoader />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/destinations', element: <DestinationsPage /> },
          { path: '/destinations/:slug', element: <DestinationDetailPage /> },
          { path: '/itinerary/create', element: <ItineraryCreatePage /> },
          { path: '/itinerary/:id', element: <RequireAuth><ItineraryDetailPage /></RequireAuth> },
          { path: '/scan', lazy: lazyPage(() => import('./pages/ScanPage'), (m) => m.ScanPage) },
          { path: '/qr/:code', element: <QrLandingPage /> },
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
          { path: '/privacy', element: <PrivacyPage /> },
          { path: '/terms', element: <TermsPage /> },
          { path: '/passport', element: <PassportPage /> },
          { path: '/favorites', element: <RequireAuth><FavoritesPage /></RequireAuth> },
          { path: '/my-itineraries', element: <RequireAuth><MyItinerariesPage /></RequireAuth> },
          { path: '/account', element: <RequireAuth><ProfilePage /></RequireAuth> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      { path: '/admin/login', element: <AdminLoginPage /> },
      {
        path: '/admin',
        element: (
          <RequireStaff>
            <Outlet />
          </RequireStaff>
        ),
        children: [
          {
            lazy: lazyPage(() => import('./components/layout/AdminLayout'), (m) => m.AdminLayout),
            children: [
              { index: true, lazy: lazyPage(() => import('./pages/admin/AdminDashboardPage'), (m) => m.AdminDashboardPage) },
              { path: 'analytics', lazy: lazyPage(() => import('./pages/admin/AdminDashboardPage'), (m) => m.AdminDashboardPage) },
              { path: 'destinations', lazy: lazyPage(() => import('./pages/admin/AdminDestinationsPage'), (m) => m.AdminDestinationsPage) },
              { path: 'destinations/new', lazy: lazyPage(() => import('./pages/admin/AdminDestinationFormPage'), (m) => m.AdminDestinationFormPage) },
              { path: 'destinations/:id/edit', lazy: lazyPage(() => import('./pages/admin/AdminDestinationFormPage'), (m) => m.AdminDestinationFormPage) },
              { path: 'qr', lazy: lazyPage(() => import('./pages/admin/AdminQrPages'), (m) => m.AdminQrListPage) },
              { path: 'qr/new', lazy: lazyPage(() => import('./pages/admin/AdminQrPages'), (m) => m.AdminQrNewPage) },
              { path: 'qr/:id', lazy: lazyPage(() => import('./pages/admin/AdminQrPages'), (m) => m.AdminQrDetailPage) },
              { path: 'challenges', lazy: lazyPage(() => import('./pages/admin/AdminChallengePages'), (m) => m.AdminChallengesPage) },
              { path: 'challenges/new', lazy: lazyPage(() => import('./pages/admin/AdminChallengePages'), (m) => m.AdminChallengeFormPage) },
              { path: 'challenges/:id/edit', lazy: lazyPage(() => import('./pages/admin/AdminChallengePages'), (m) => m.AdminChallengeFormPage) },
              { path: 'banners', lazy: lazyPage(() => import('./pages/admin/AdminBannerPages'), (m) => m.AdminBannersPage) },
              { path: 'banners/new', lazy: lazyPage(() => import('./pages/admin/AdminBannerPages'), (m) => m.AdminBannerFormPage) },
              { path: 'banners/:id/edit', lazy: lazyPage(() => import('./pages/admin/AdminBannerPages'), (m) => m.AdminBannerFormPage) },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]);

export function App() {
  const loadSession = useAuthStore((s) => s.loadSession);
  useEffect(() => {
    void loadSession();
  }, [loadSession]);
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}
