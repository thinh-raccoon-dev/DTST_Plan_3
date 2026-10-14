# Nền tảng Du lịch Thông minh & Hộ chiếu Trải nghiệm số Đồng Tháp (MVP)

Ứng dụng full-stack cho du khách khám phá Đồng Tháp: tìm địa điểm, lập lịch trình theo quy tắc, quét mã QR tại điểm thí
điểm để đọc câu chuyện, check-in, làm thử thách và sưu tầm huy hiệu trong "hộ chiếu số". Quản trị viên quản lý địa điểm,
mã QR, thử thách, banner/quảng cáo đầu trang chủ và xem thống kê thực từ cơ sở dữ liệu.

> Dữ liệu seed là **dữ liệu minh họa** (gắn nhãn rõ trên giao diện). Giờ mở cửa, giá vé, số điện thoại để trống vì chưa
> được xác minh; một số tọa độ là gần đúng. Hãy kiểm tra và cập nhật bằng nguồn chính thức trước khi dùng thực tế.

| Thành phần | Công nghệ |
| --- | --- |
| Frontend | React 19, Vite 8, TypeScript strict, Tailwind CSS 4, React Router 7, Zustand, Axios, React Hook Form + Zod, Recharts, qr-scanner, Lucide |
| Backend | Node.js ≥ 20, Express 5, TypeScript, MongoDB + Mongoose 8, Zod, bcrypt, JWT trong cookie HttpOnly, Helmet, CORS, rate limit, pino |
| Kiểm thử | Vitest + Supertest (API), Vitest (logic client), Playwright (E2E) |

Tài liệu chi tiết: [Kiến trúc & dữ liệu](docs/ARCHITECTURE.md) · [API](docs/API.md) · [Triển khai](docs/DEPLOYMENT.md)

## 1. Yêu cầu

- Node.js 20 LTS trở lên (đã chạy với Node 22) và npm 10+
- MongoDB 6+ chạy local (MongoDB Community Server) **hoặc** một cluster MongoDB Atlas
- (Tùy chọn) MongoDB Compass để xem dữ liệu

## 2. Cài đặt

```bash
npm install                      # cài cho cả server và client (npm workspaces)
cp server/.env.example server/.env
```

Mở `server/.env` và điền:

- `JWT_SECRET`: chuỗi ngẫu nhiên ≥ 32 ký tự, tạo bằng
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `MONGODB_URI`: mặc định `mongodb://127.0.0.1:27017/dtst`; với Atlas dùng chuỗi `mongodb+srv://...`
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (≥ 10 ký tự): tài khoản admin ban đầu. **Không commit file `.env`.**

## 3. Seed dữ liệu

```bash
npm run seed
```

- Tạo admin từ biến môi trường (không có mật khẩu mặc định nào trong mã nguồn), 12 địa điểm minh họa, 3 thử thách, 4 mã QR
  (`TRAMCHIM-01`, `HTL-01`, `GOTHAP-01`, `SADEC-HOA` đang tắt) và 1 banner bìa minh họa cho trang chủ (chỉ khi chưa có banner nào).
- **Idempotent và không phá dữ liệu**: chạy lại không tạo trùng, không ghi đè nội dung đã sửa, không xóa database hay collection.
- Đổi mật khẩu admin đã có theo `.env`: `npm run seed -w server -- --reset-admin-password`
- Không có trang đăng ký admin công khai; tài khoản đăng ký qua `/register` luôn là du khách.

## 4. Chạy ứng dụng (development)

```bash
npm run dev
```

- Frontend: <http://localhost:5173> (Vite proxy `/api` → <http://localhost:4000>, nên cookie hoạt động cùng origin)
- API: <http://localhost:4000/api/v1/health>
- Trang quản trị: <http://localhost:5173/admin/login> (đăng nhập bằng `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`)
- Thử luồng QR không cần camera: mở <http://localhost:5173/qr/TRAMCHIM-01> hoặc nhập mã tại `/scan`.

Camera trình duyệt chỉ hoạt động trên HTTPS hoặc `localhost`. Khi thử bằng điện thoại qua IP LAN (http) camera sẽ bị chặn —
trang `/scan` hiển thị hướng dẫn và luôn có ô nhập mã thủ công.

## 5. Xem dữ liệu bằng MongoDB Compass

1. Mở Compass → **New connection** → dán đúng chuỗi `MONGODB_URI` trong `server/.env` (ví dụ `mongodb://127.0.0.1:27017`).
2. Chọn database `dtst`. Các collection chính:
   - `destinations` – địa điểm (`publicationStatus`: draft/published/hidden; `verification` theo từng nhóm thông tin)
   - `challenges` – thử thách (chứa đáp án; chỉ API admin mới trả về)
   - `qrcodes` – mã QR ổn định và nội dung đích (`targetType`, `targetId`)
   - `banners` – banner/quảng cáo đầu trang chủ (`kind`, `status`, lịch `startAt`/`endAt`, bộ đếm `impressions`/`clicks`)
   - `passportentries` – check-in, hoàn thành thử thách, huy hiệu (có unique index chống cộng điểm hai lần)
   - `analyticsevents` – sự kiện thống kê (không lưu IP/user agent)
   - `users`, `itineraries`, `favorites`
3. Tab **Indexes** của `passportentries` cho thấy các unique partial index dùng để bảo đảm thưởng một lần.
4. Database `dtst_test` (Vitest) và `dtst_e2e` (Playwright) là database riêng của kiểm thử; không dùng chúng cho dữ liệu thật.

Nên sửa nội dung qua trang quản trị thay vì sửa trực tiếp trong Compass, vì API tự tính `verificationStatus`, `searchText`
và kiểm tra ràng buộc dữ liệu.

## 6. Kiểm thử

```bash
npm run typecheck     # TypeScript strict cho server và client
npm test              # Vitest: API (MongoDB thật, database dtst_test) + logic client
npx playwright install chromium   # lần đầu
npm run test:e2e      # Playwright: tự khởi động API :4100 + web :5174 với database dtst_e2e
```

- Test API **xóa sạch** database test trước khi chạy và từ chối chạy nếu tên database không kết thúc bằng `_test`.
- E2E dùng database `dtst_e2e`, tự seed và tạo mật khẩu admin ngẫu nhiên cho mỗi lần chạy; không đụng tới `dtst`.
- Kịch bản E2E chính (`e2e/mvp-flow.spec.ts`): admin đăng nhập → tạo & xuất bản địa điểm → tạo thử thách → tạo QR → du khách
  đăng ký, xem địa điểm → mở trang QR → check-in & hoàn thành thử thách → gửi lại không được cộng điểm → hộ chiếu hiển thị
  đúng → dashboard tăng số liệu → admin tắt QR và du khách thấy thông báo mã tạm ngừng.
- `e2e/responsive.spec.ts`: kiểm tra không tràn ngang và không lỗi console ở 375px và 1366px cho các trang chính.

## 7. Cấu trúc thư mục

```text
server/   Express API (src/config, models, schemas, services, controllers, middleware, routes, seed, scripts) + tests/
client/   React app (src/components/{ui,layout,destination,itinerary,challenge,qr}, pages, pages/admin, stores, lib, hooks)
e2e/      Playwright specs
docs/     ARCHITECTURE.md, API.md, DEPLOYMENT.md
```

## 8. Giới hạn đã biết của MVP

- Check-in là **tự xác nhận** qua mã QR; hệ thống không xác minh vị trí thực tế.
- Hộ chiếu khách (chưa đăng nhập) gắn với cookie ẩn danh của trình duyệt; xóa cookie sẽ mất. Có chức năng đồng bộ vào tài khoản.
- "Người dùng duy nhất" là ước lượng theo tài khoản/cookie, không phải số người thật.
- Lịch trình là gợi ý theo quy tắc; thời gian chuyển điểm là khoảng đệm cố định 30 phút, **không** phải thời gian di chuyển thực tế.
- Chưa có tải ảnh lên (admin nhập URL ảnh có giấy phép), chưa có đặt lại mật khẩu qua email, chưa có tự xóa tài khoản.
- Camera quét QR mới được kiểm tra luồng giao diện/quyền; chưa kiểm thử trên thiết bị thật trong môi trường này.
