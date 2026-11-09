# Thư mục lưu trữ hình ảnh địa điểm (DTST - Đồng Tháp Smart Tourism)

Thư mục này được đặt tại `client/public/images/destinations/`, được phục vụ trực tiếp bởi Vite dev server và bản build production.

## Cách đặt tên & đường dẫn truy cập (URL)

Khi thêm hình ảnh vào thư mục con tương ứng, đường dẫn URL được lưu trong CSDL MongoDB hoặc cấu hình JSON sẽ có định dạng:
```text
/images/destinations/<khu-vuc>/<ten-dia-diem>.<jpg|png|webp>
```

### Ví dụ:
- Ảnh Chùa Vĩnh Tràng (Mỹ Tho):
  - File trên máy: `client/public/images/destinations/my-tho/chua-vinh-trang.jpg`
  - URL trong hệ thống / CSDL: `/images/destinations/my-tho/chua-vinh-trang.jpg`
- Ảnh Mekong Taste (Thới Sơn):
  - File trên máy: `client/public/images/destinations/thoi-son/mekong-taste.jpg`
  - URL trong hệ thống / CSDL: `/images/destinations/thoi-son/mekong-taste.jpg`
- Ảnh Hủ tiếu Bà Sẩm (Sa Đéc):
  - File trên máy: `client/public/images/destinations/sa-dec/hu-tieu-ba-sam.jpg`
  - URL trong hệ thống / CSDL: `/images/destinations/sa-dec/hu-tieu-ba-sam.jpg`

## Phân chia thư mục theo khu vực:
- `cao-lanh/`: Địa điểm tại TP. Cao Lãnh và lân cận
- `sa-dec/`: Địa điểm tại TP. Sa Đéc
- `my-tho/`: Địa điểm tại TP. Mỹ Tho
- `thoi-son/`: Địa điểm tại Cù lao Thới Sơn (Cồn Lân, Mekong Taste, Trà mật ong,...)
- `thap-muoi/`: Khu di tích Gò Tháp, Đồng sen Tháp Mười,...
- `lai-vung/`: Làng nem Lai Vung, vườn quýt hồng,...
- `tam-nong/`: Vườn quốc gia Tràm Chim,...
- `cai-be/`: Chợ nổi Cái Bè, Làng cổ Đông Hòa Hiệp,...
- `dong-thap/`: Các điểm văn hóa, sinh thái chung của tỉnh
