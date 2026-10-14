import { expect, test, type Page } from '@playwright/test';

interface AnalyticsTotals {
  qrLandingViews: number;
  challengeCompletions: number;
  destinationPageViews: number;
}

async function analyticsTotals(page: Page): Promise<AnalyticsTotals> {
  const res = await page.request.get('/api/v1/admin/analytics');
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { totals: AnalyticsTotals }).totals;
}

test('MVP flow: admin publishes content, tourist scans QR, completes challenge once, admin sees stats and disables QR', async ({ browser }) => {
  const stamp = Date.now().toString(36);
  const destinationName = `Điểm kiểm thử E2E ${stamp}`;
  const challengeTitle = `Thử thách E2E ${stamp}`;
  const adminEmail = process.env.E2E_ADMIN_EMAIL!;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD!;

  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const touristContext = await browser.newContext();
  const tourist = await touristContext.newPage();

  let slug = '';
  let qrCode = '';
  let baseline: AnalyticsTotals;

  await test.step('1. Admin đăng nhập', async () => {
    await admin.goto('/admin/login');
    await admin.getByLabel('Email').fill(adminEmail);
    await admin.getByLabel('Mật khẩu').fill(adminPassword);
    await admin.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(admin.getByRole('heading', { name: 'Tổng quan hoạt động' })).toBeVisible();
    baseline = await analyticsTotals(admin);
  });

  await test.step('2. Admin tạo và xuất bản địa điểm', async () => {
    await admin.goto('/admin/destinations/new');
    await admin.getByLabel('Tên địa điểm').fill(destinationName);
    await admin.getByLabel('Loại hình').selectOption('culture');
    await admin.getByLabel('Khu vực').selectOption('sa-dec');
    await admin.getByLabel('Tóm tắt').fill('Địa điểm tạo tự động để kiểm thử luồng MVP.');
    await admin.getByRole('textbox', { name: 'Mô tả', exact: true }).fill('Nội dung mô tả dành cho kiểm thử đầu-cuối, không phải dữ liệu thật.');
    await admin.getByLabel('Thời lượng tham quan (phút)').fill('60');
    await admin.getByRole('button', { name: 'Tạo địa điểm' }).click();
    await expect(admin).toHaveURL(/\/admin\/destinations\/[a-f0-9]{24}\/edit$/);
    slug = await admin.getByLabel('Slug (đường dẫn)').inputValue();
    expect(slug).toMatch(/^diem-kiem-thu-e2e-/);

    await admin.goto(`/admin/destinations?q=${encodeURIComponent(stamp)}`);
    const row = admin.getByRole('listitem').filter({ hasText: destinationName });
    await expect(row.getByText('Bản nháp')).toBeVisible();
    await row.getByRole('button', { name: 'Xuất bản' }).click();
    await expect(row.getByText('Đã xuất bản')).toBeVisible();
  });

  await test.step('3. Admin tạo thử thách cho địa điểm', async () => {
    await admin.goto('/admin/challenges/new');
    await admin.getByLabel('Tên thử thách').fill(challengeTitle);
    await admin.getByLabel('Địa điểm').selectOption({ label: destinationName });
    await admin.getByLabel('Điểm thưởng').fill('25');
    await admin.getByLabel('Số câu đúng tối thiểu').fill('1');
    await admin.getByLabel('Trạng thái').selectOption('active');
    await admin.getByLabel('Nội dung câu hỏi').fill('Câu hỏi kiểm thử: chọn đáp án đúng?');
    await admin.getByRole('textbox', { name: 'Lựa chọn 1', exact: true }).fill('Đáp án đúng');
    await admin.getByRole('textbox', { name: 'Lựa chọn 2', exact: true }).fill('Đáp án sai');
    await admin.getByRole('radio', { name: 'Đáp án đúng là lựa chọn 1' }).check();
    await admin.getByRole('button', { name: 'Tạo thử thách' }).click();
    await expect(admin).toHaveURL(/\/admin\/challenges\/[a-f0-9]{24}\/edit$/);
  });

  await test.step('4. Admin tạo mã QR trỏ tới địa điểm', async () => {
    await admin.goto('/admin/qr/new');
    await admin.getByLabel('Nhãn').fill(`Bảng QR ${stamp}`);
    await admin.getByLabel('Loại nội dung đích').selectOption('destination');
    await admin.getByRole('combobox', { name: 'Nội dung đích', exact: true }).selectOption({ label: destinationName });
    await admin.getByRole('button', { name: 'Tạo mã QR' }).click();
    await expect(admin).toHaveURL(/\/admin\/qr\/[a-f0-9]{24}$/);
    const headingLocator = admin.getByRole('heading', { level: 1 });
    await expect(headingLocator).toHaveText(/^Mã DT-/);
    const heading = await headingLocator.innerText();
    qrCode = heading.replace(/^Mã\s+/, '').trim();
    expect(qrCode).toMatch(/^DT-[A-Z0-9]{6}$/);
    await expect(admin.getByRole('img', { name: `Mã QR ${qrCode}` })).toBeVisible();
  });

  await test.step('5. Du khách đăng ký và xem trang địa điểm', async () => {
    await tourist.goto('/register');
    await tourist.getByLabel('Tên hiển thị').fill('Du khách E2E');
    await tourist.getByLabel('Email').fill(`tourist-${stamp}@example.com`);
    await tourist.getByLabel(/^Mật khẩu\*?$/).fill('Mat-khau-e2e-123');
    await tourist.getByLabel('Nhập lại mật khẩu').fill('Mat-khau-e2e-123');
    await tourist.getByRole('checkbox').check();
    await tourist.getByRole('button', { name: 'Đăng ký' }).click();
    await expect(tourist).toHaveURL(/\/passport$/);

    await tourist.goto(`/destinations/${slug}`);
    await expect(tourist.getByRole('heading', { level: 1, name: destinationName })).toBeVisible();
    await expect(tourist.getByText('Chưa có thông tin xác minh').first()).toBeVisible();
  });

  await test.step('6. Du khách mở trang từ mã QR', async () => {
    await tourist.goto(`/qr/${qrCode}`);
    await expect(tourist.getByRole('heading', { level: 1, name: destinationName })).toBeVisible();
    await expect(tourist.getByRole('heading', { name: challengeTitle })).toBeVisible();
  });

  await test.step('7. Du khách check-in và hoàn thành thử thách', async () => {
    await tourist.getByRole('button', { name: 'Check-in vào hộ chiếu' }).click();
    await expect(tourist.getByText('Bạn đã check-in tại điểm này')).toBeVisible();
    await tourist.getByRole('radio', { name: 'Đáp án đúng', exact: true }).check();
    await tourist.getByRole('button', { name: 'Gửi đáp án' }).click();
    await expect(tourist.getByText('Hoàn thành! +25 điểm')).toBeVisible();
  });

  await test.step('8. Phần thưởng chỉ được cấp một lần', async () => {
    await tourist.reload();
    await expect(tourist.getByText('Đã hoàn thành', { exact: true })).toBeVisible();
    await tourist.getByRole('radio', { name: 'Đáp án đúng', exact: true }).check();
    await tourist.getByRole('button', { name: 'Gửi đáp án' }).click();
    await expect(tourist.getByText('Bạn đã hoàn thành thử thách này trước đó')).toBeVisible();
    const passport = await (await tourist.request.get('/api/v1/passport/me')).json();
    expect(passport.totals.points).toBe(35);
    expect(passport.totals.completedChallenges).toBe(1);
  });

  await test.step('9. Hộ chiếu hiển thị kết quả', async () => {
    await tourist.goto('/passport');
    const totalCard = tourist.getByText('Tổng điểm', { exact: true }).locator('xpath=../..');
    await expect(totalCard).toContainText('35');
    await expect(tourist.getByText('Bước chân đầu tiên').locator('xpath=..')).toContainText('Đạt');
    const checkIns = tourist.getByRole('heading', { name: 'Địa điểm đã check-in' }).locator('xpath=..');
    await expect(checkIns.getByRole('link', { name: destinationName })).toBeVisible();
    await expect(tourist.getByText(challengeTitle)).toBeVisible();
  });

  await test.step('10. Dashboard cập nhật, admin tắt mã QR và du khách thấy thông báo', async () => {
    const after = await analyticsTotals(admin);
    expect(after.qrLandingViews).toBeGreaterThan(baseline.qrLandingViews);
    expect(after.challengeCompletions).toBe(baseline.challengeCompletions + 1);
    expect(after.destinationPageViews).toBeGreaterThan(baseline.destinationPageViews);
    await admin.goto('/admin');
    await expect(admin.getByText('Lượt mở trang từ QR').first()).toBeVisible();

    await admin.goto(`/admin/qr?q=${qrCode}`);
    const row = admin.getByRole('listitem').filter({ hasText: qrCode });
    await row.getByRole('button', { name: 'Tắt' }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Tắt mã' }).click();
    await expect(row.getByText('Đã tắt')).toBeVisible();

    await tourist.goto(`/qr/${qrCode}`);
    await expect(tourist.getByRole('heading', { name: 'Mã QR tạm ngừng hoạt động' })).toBeVisible();
  });

  await adminContext.close();
  await touristContext.close();
});
