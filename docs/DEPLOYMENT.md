# Triển khai

## Khuyến nghị: một origin (API phục vụ luôn frontend)

Cách đơn giản và an toàn nhất cho cookie HttpOnly: build frontend rồi để Express phục vụ thư mục `client/dist`.

```bash
npm ci
npm run build                     # server/dist + client/dist
cd server
NODE_ENV=production \
MONGODB_URI="mongodb+srv://..." \
JWT_SECRET="<chuỗi ngẫu nhiên ≥ 32 ký tự>" \
PUBLIC_APP_URL="https://dulich.example.vn" \
CORS_ORIGINS="https://dulich.example.vn" \
SERVE_CLIENT_DIR=../client/dist \
TRUST_PROXY=1 \
node dist/server.js
```

- Chạy seed lần đầu trên môi trường thật: `SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npm run seed:prod -w server`
  (đặt biến tạm thời trong shell/secret manager, không lưu vào repo). Seed không xóa dữ liệu hiện có.
- `TRUST_PROXY=1` khi chạy sau một reverse proxy (Render, Railway, Nginx) để rate limit nhận đúng IP và cookie `Secure` hoạt động.
- `NODE_ENV=production` tự bật cookie `Secure`, luôn bật rate limit, ẩn chi tiết lỗi, ghi log mức `info`.
- Bắt buộc HTTPS: cookie `Secure`, CSP `upgrade-insecure-requests` và camera quét QR đều cần HTTPS.
- Health check: `GET /api/v1/health` (503 khi mất kết nối DB).

## Frontend và API khác domain

Ví dụ frontend trên Vercel/Netlify, API trên Render:

- Build frontend với `VITE_API_URL=https://api.example.vn/api/v1` (xem `client/.env.example`) và cấu hình SPA fallback
  (mọi đường dẫn → `index.html`).
- API: `CORS_ORIGINS=https://app.example.vn`, `PUBLIC_APP_URL=https://app.example.vn`, `COOKIE_SAMESITE=none`,
  `COOKIE_SECURE=true` (server từ chối khởi động nếu `none` mà không `Secure`).
- Lưu ý: một số trình duyệt chặn cookie bên thứ ba; nếu được, hãy dùng subdomain cùng site (`app.` và `api.` cùng
  domain gốc) để giữ `COOKIE_SAMESITE=lax`.

## MongoDB

- Atlas: tạo user riêng quyền `readWrite` trên database ứng dụng, giới hạn IP truy cập, bật backup.
- Index được tạo khi khởi động (Mongoose `autoIndex`) và khi chạy seed (`createIndexes`, không xóa index khác).
- Không dùng chung database với `dtst_test` / `dtst_e2e`: test tự động xóa sạch database test.

## Mã QR

Nội dung QR là `{PUBLIC_APP_URL}/qr/{code}`. Đặt `PUBLIC_APP_URL` đúng domain chính thức **trước khi in** mã; sau khi in, có
thể đổi nội dung đích trong trang quản trị mà không cần in lại, nhưng không nên đổi domain.

## Danh sách kiểm tra trước khi công khai

- [ ] `JWT_SECRET` mới, mạnh, chỉ lưu trong secret manager
- [ ] Mật khẩu admin mạnh; đổi bằng `--reset-admin-password` nếu cần
- [ ] HTTPS và domain chính thức; `PUBLIC_APP_URL` đúng
- [ ] Rà soát và xác minh dữ liệu địa điểm (giờ mở cửa, giá, liên hệ, tọa độ, nguồn); bỏ nhãn minh họa khi đã thay bằng dữ liệu thật
- [ ] Ảnh có giấy phép sử dụng, ghi nguồn đầy đủ
- [ ] Nội dung trang Quyền riêng tư / Điều khoản được nhóm và đơn vị chủ quản duyệt
- [ ] Thử quét QR bằng camera trên điện thoại thật (iOS Safari, Android Chrome)
