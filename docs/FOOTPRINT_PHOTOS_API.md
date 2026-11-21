# Shared API Contract — Bản đồ Dấu chân & Ký ức Ảnh (Web + Companion Mobile App)

Tài liệu này mô tả hợp đồng dữ liệu dùng chung giữa **Web Đồng Tháp Smart Travel** và **App Mobile (iOS / Android / Flutter)** cho tính năng chụp ảnh gắn vị trí + thời gian thực trên Bản đồ Dấu chân (`footprint_photos`).

## 1. Xác thực & Headers dùng chung (Mobile App)
- `Authorization: Bearer <access_token>` (lấy từ `POST /api/v1/auth/login` hoặc `POST /api/v1/auth/register`)
- `x-client-platform: ios | android | flutter | mobile`
- `x-csrf-token: <64-hex-token>` (lấy 1 lần từ `GET /api/v1/csrf`)
- Nếu người dùng chưa đăng nhập, app có thể gửi `x-device-session-id: <uuid>` — khi người dùng đăng nhập cùng session hoặc gọi `POST /api/v1/passport/claim`, toàn bộ ảnh & lộ trình sẽ tự động gộp vào tài khoản `userId`.

## 2. Cấu trúc Bản ghi Ảnh (`FootprintPhotoItem`)
```json
{
  "id": "673f8...",
  "clientPhotoId": "ios-photo-uuid-001",
  "imageUrl": "/uploads/footprints/fp-1795272306-a1b2c3d4.jpg",
  "thumbnailUrl": "/uploads/footprints/fp-1795272306-a1b2c3d4.jpg",
  "coordinates": { "lat": 10.3125, "lng": 105.7468 },
  "accuracyMeters": 8.5,
  "altitudeMeters": 4.2,
  "headingDegrees": 145,
  "takenAt": "2026-11-21T12:56:10.000Z",
  "placeName": "Làng hoa Sa Đéc (Tân Quy Đông)",
  "area": "sa-dec",
  "destinationId": "673f...",
  "destinationSlug": "lang-hoa-sa-dec",
  "trackClientId": "track-1795272000",
  "caption": "Hoàng hôn cực đẹp trên giàn cúc mâm xôi",
  "moodEmoji": "📸",
  "sourceApp": "ios",
  "deviceModel": "Apple iPhone 16 Pro",
  "exifSource": "exif",
  "width": 1920,
  "height": 1440,
  "fileSize": 428120,
  "mimeType": "image/jpeg",
  "visibility": "private",
  "createdAt": "2026-11-21T12:56:18.000Z"
}
```

## 3. Các Endpoint

### A. Tải lên 1 ảnh chụp từ Camera / Thư viện (`POST /api/v1/footprints/photos`)
Hỗ trợ **2 chế độ**:
1. **`multipart/form-data`** (upload thẳng file ảnh từ máy, tối đa 12 MB, xác thực magic-bytes JPG/PNG/WebP/GIF/AVIF):
   - `photo`: File binary
   - `lat`, `lng`: Tọa độ GPS (`-90..90`, `-180..180`)
   - `takenAt`: Thời điểm chụp (ISO-8601 hoặc epoch ms)
   - `clientPhotoId`: UUID sinh ở app (chống trùng lặp khi retry mạng yếu!)
   - `placeName`, `area`, `caption`, `moodEmoji`, `destinationId`, `trackClientId` *(tùy chọn — nếu bỏ trống `placeName`/`destinationId`, server tự động khớp điểm du lịch đã xuất bản trong bán kính 500m!)*
   - `sourceApp`: `ios | android | flutter | web | import`
   - `deviceModel`, `accuracyMeters`, `altitudeMeters`, `headingDegrees`, `exifSource` (`exif | gps | manual`)
   - `autoCheckIn`: `true | false` (mặc định `true` — tự động đóng dấu Hộ chiếu GPS nếu chụp trong bán kính 1.000m!)
2. **`application/json`** (nếu App đã upload ảnh lên CDN/S3 riêng và chỉ đồng bộ metadata):
   - Thay field file `photo` bằng `imageUrl` (`https://...` hoặc `/uploads/...`).

### B. Đồng bộ lô ảnh Offline từ App (`POST /api/v1/footprints/photos/sync`)
Idempotent theo `clientPhotoId` (tối đa 100 ảnh/lần):
```json
{
  "autoCheckIn": true,
  "photos": [
    {
      "clientPhotoId": "flutter-20261121-01",
      "imageUrl": "https://cdn.example.com/photos/01.jpg",
      "lat": 10.2923,
      "lng": 105.7592,
      "takenAt": "2026-11-21T08:15:00.000Z",
      "caption": "Check-in Nhà cổ Huỳnh Thủy Lê",
      "sourceApp": "flutter",
      "deviceModel": "iPhone 15 Pro",
      "exifSource": "gps"
    }
  ]
}
```

### C. Lấy danh sách ảnh & nhóm theo địa điểm (`GET /api/v1/footprints/photos`)
Query params hỗ trợ:
- `from`, `to`: Lọc theo khoảng thời gian `takenAt` (ISO-8601)
- `destinationId`, `area`, `sourceApp`: Lọc theo điểm đến / khu vực / nguồn app
- `q`: Tìm kiếm theo tên địa điểm hoặc chú thích
- `bbox`: `minLng,minLat,maxLng,maxLat` (lọc theo khung bản đồ hiện tại)
- `limit`: tối đa `500`

Response trả về `{ success: true, photos: [...], places: [...], stats: { totalPhotos, totalPlaces, latestTakenAt, earliestTakenAt } }`.

### D. Sửa & Xóa ảnh
- `PATCH /api/v1/footprints/photos/:id` — Cập nhật `caption`, `placeName`, `takenAt`, `lat`, `lng`, `visibility` (nhận `_id` hoặc `clientPhotoId`, chỉ chủ sở hữu được sửa).
- `DELETE /api/v1/footprints/photos/:id` — Xóa ảnh và dọn file cục bộ (nhận `_id` hoặc `clientPhotoId`, chỉ chủ sở hữu được xóa).
