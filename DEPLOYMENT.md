# HƯỚNG DẪN TRIỂN KHAI DOANH NGHIỆP & VẬN HÀNH HỆ THỐNG
**Nền tảng Du lịch Thông minh và Hộ chiếu Trải nghiệm số Đồng Tháp & Trip Planner V9**

---

## 1. Kiến trúc Tổng thể (Enterprise Architecture)

Hệ thống được thiết kế theo mô hình vi dịch vụ container hóa độc lập, phân tách rõ ràng giữa tầng dữ liệu, tầng tính toán AI & định tuyến, tầng API nghiệp vụ và tầng giao diện SPA:

```
[ Trình duyệt / Di động (Du khách & Cán bộ Sở) ]
                      │ (HTTP / HTTPS: Cổng 80/443)
                      ▼
        ┌─────────────────────────────┐
        │   dtst-client-web (Nginx)   │ (Phục vụ SPA & Cache 1 năm)
        └──────────────┬──────────────┘
                       │ /api/ reverse-proxy
                       ▼
        ┌─────────────────────────────┐
        │   dtst-server-api (Node.js) │ (Express 5, JWT, Mongoose, Zod)
        └───────┬──────────────┬──────┘
                │              │
      (TCP:27017)              │ (HTTP:8010)
                ▼              ▼
  ┌───────────────────┐  ┌──────────────────────┐
  │ dtst-mongodb (DB) │  │ dtst-planner-v9 (Py) │ (Thuật toán V9 scoring & replan)
  └───────────────────┘  └──────────┬───────────┘
                                    │ (HTTP:8002)
                                    ▼
                         ┌──────────────────────┐
                         │  dtst-valhalla (OSM) │ (Routing ma trận đường bộ ĐT)
                         └──────────────────────┘
```

---

## 2. Danh mục 5 Services Container

| Service Container | Image / Dockerfile | Cổng nội bộ / Ngoài | Chức năng chính |
| :--- | :--- | :--- | :--- |
| **`mongodb`** | `mongo:7.0` | `27017:27017` | Lưu trữ dữ liệu destinations, passports, badges, users, itineraries |
| **`valhalla`** | `ghcr.io/gis-ops/docker-valhalla` | `8002:8002` | Định tuyến khoảng cách đường bộ thực tế tỉnh Đồng Tháp |
| **`planner-v9`** | `documents/trip_planner_17_v9/Dockerfile` | `8010:8010` | AI scoring, tối ưu hóa đa ràng buộc, live replan |
| **`server-api`** | `server/Dockerfile` (Node 20 Alpine) | `4000:4000` | Backend API, phân quyền Partner/Admin, check-in QR, Hộ chiếu |
| **`client-web`** | `client/Dockerfile` (Nginx Alpine) | `80:80` (hoặc 443) | Giao diện React SPA, gzip compression, reverse proxy bảo mật |

---

## 3. Triển khai Nhanh với 1 Lệnh (One-Click Production Launch)

### Bước 1: Chuẩn bị biến môi trường
Tạo file `.env` từ file mẫu:
```bash
cp .env.production.example .env
```
Điều chỉnh `JWT_SECRET` và `MONGO_ROOT_PASS` thành chuỗi mật khẩu mạnh của đơn vị.

### Bước 2: Khởi động toàn bộ cụm dịch vụ
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Bước 3: Kiểm tra trạng thái hoạt động (Healthcheck)
```bash
docker compose -f docker-compose.prod.yml ps
```
Tất cả các container sẽ hiển thị trạng thái `Up (healthy)`.

---

## 4. Quản trị Dữ liệu & Backup Khôi phục (Backup & Disaster Recovery)

### Sao lưu dữ liệu MongoDB (Backup):
```bash
docker exec -t dtst-mongodb mongodump --username dtst_admin --password <YOUR_PASSWORD> --authenticationDatabase admin --db dong_thap_tourism --out /data/db/backup_$(date +%Y%m%d)
```

### Khôi phục dữ liệu (Restore):
```bash
docker exec -t dtst-mongodb mongorestore --username dtst_admin --password <YOUR_PASSWORD> --authenticationDatabase admin --db dong_thap_tourism /data/db/backup_20261104/dong_thap_tourism
```

---

## 5. Giám sát & Logs Hệ thống (Observability)

- Xem log toàn bộ hệ thống:
  ```bash
  docker compose -f docker-compose.prod.yml logs -f
  ```
- Xem log riêng biệt của backend:
  ```bash
  docker compose -f docker-compose.prod.yml logs -f server-api
  ```
- Xem log của AI Trip Planner V9:
  ```bash
  docker compose -f docker-compose.prod.yml logs -f planner-v9
  ```
