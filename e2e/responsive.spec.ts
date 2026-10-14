import { expect, test } from '@playwright/test';

const publicPages = [
  '/',
  '/destinations',
  '/destinations/vuon-quoc-gia-tram-chim',
  '/itinerary/create',
  '/scan',
  '/qr/TRAMCHIM-01?preview=1',
  '/qr/KHONG-TON-TAI',
  '/passport',
  '/login',
  '/register',
  '/privacy',
  '/terms',
  '/khong-co-trang-nay',
];

const adminPages = ['/admin', '/admin/destinations', '/admin/destinations/new', '/admin/qr', '/admin/qr/new', '/admin/challenges', '/admin/challenges/new', '/admin/banners', '/admin/banners/new'];

for (const viewport of [
  { name: 'mobile', width: 375, height: 740 },
  { name: 'desktop', width: 1366, height: 860 },
]) {
  test.describe(`${viewport.name} ${viewport.width}px`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('public pages render without horizontal overflow or console errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        // 404/410 API responses for the invalid QR page are expected and logged by the browser.
        if (msg.type() === 'error' && !/status of (404|410)/.test(msg.text())) errors.push(`${page.url()}: ${msg.text()}`);
      });
      page.on('pageerror', (err) => errors.push(`${page.url()}: ${err.message}`));

      for (const path of publicPages) {
        await page.goto(path);
        await expect(page.locator('main')).not.toBeEmpty();
        await expect(page.getByText('Đang tải…')).toHaveCount(0);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
      }
      expect(errors).toEqual([]);
    });

    test('admin pages render without horizontal overflow', async ({ page }) => {
      await page.goto('/admin/login');
      await page.getByLabel('Email').fill(process.env.E2E_ADMIN_EMAIL!);
      await page.getByLabel('Mật khẩu').fill(process.env.E2E_ADMIN_PASSWORD!);
      await page.getByRole('button', { name: 'Đăng nhập' }).click();
      await expect(page.getByRole('heading', { name: 'Tổng quan hoạt động' })).toBeVisible();

      for (const path of adminPages) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.getByText('Đang tải…')).toHaveCount(0);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
      }
    });
  });
}
