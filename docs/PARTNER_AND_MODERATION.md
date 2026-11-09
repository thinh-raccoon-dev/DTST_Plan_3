# CHUYÊN ĐỀ: CỔNG ĐỐI TÁC & KIỂM DUYỆT NỘI DUNG DOANH NGHIỆP
#partner #rbac #content_moderation #approval_workflow #analytics

Tài liệu này ghi lại kiến trúc phân quyền RBAC 3 cấp, quy trình kiểm duyệt nội dung điểm đến và cơ chế phân vùng thống kê cho các cơ sở kinh doanh du lịch Đồng Tháp.

---

## 1. Phân quyền Người dùng 3 Cấp (Role-Based Access Control)

| Vai trò (`role`) | Phạm vi quyền hạn | Giao diện điều hướng |
| :--- | :--- | :--- |
| **`tourist`** | Du khách khám phá, xem điểm đến công khai, lập lịch trình, quét QR, lưu hộ chiếu số. | Giao diện công khai, thanh điều hướng du khách. |
| **`partner`** | Đại diện cơ sở du lịch, homestay, làng nghề, điểm tham quan. Chỉ được quản lý các điểm đến do mình phụ trách (`managedBy: req.user.id`). Không xem/sửa điểm của đối tác khác. | `/admin` (Cổng Đối tác): Chỉ thấy menu Điểm đến & Thống kê scoped riêng. |
| **`admin`** | Cán bộ Sở Văn hóa, Thể thao và Du lịch tỉnh Đồng Tháp. Toàn quyền quản trị điểm đến, phê duyệt nội dung, quản lý mã QR, câu hỏi thử thách, banner, huy hiệu và xem phễu phân tích toàn tỉnh. | `/admin` (Trung tâm Quản trị Tổng thể): Đầy đủ các module quản trị. |

---

## 2. Quy trình Kiểm duyệt Điểm đến (Content Moderation Workflow)

Để bảo đảm tính chính xác và uy tín của Cổng thông tin du lịch tỉnh Đồng Tháp, đối tác không được tự ý xuất bản nội dung công khai lên hệ thống mà phải qua quy trình kiểm duyệt:

```
[Bản nháp (draft)]
        │
        │ Đối tác chỉnh sửa thông tin & gửi duyệt
        ▼
[Chờ duyệt (pending_review)] ── Lưu ghi chú gửi duyệt reviewNote
        │
        ├─────────────────────────────────────┐
        │ Quản trị viên duyệt                 │ Quản trị viên yêu cầu sửa
        ▼                                     ▼
[Đã xuất bản (published)]             [Bản nháp (draft)]
(Hiển thị công khai cho du khách)    (Kèm reviewNote phản hồi lỗi cần sửa)
```

### Các trạng thái xuất bản (`publicationStatus`):
1. `draft`: Bản nháp nội bộ, chỉ người tạo và admin xem được.
2. `pending_review`: Đã gửi lên Quản trị viên chờ kiểm tra tính xác thực (hình ảnh, giấy phép, giá cả).
3. `published`: Đã được duyệt xuất bản chính thức trên website và bản đồ du lịch.
4. `archived`: Đã lưu trữ hoặc ngưng hiển thị công khai.

---

## 3. Thống kê Phân vùng cho Đối tác (Scoped Analytics)

Endpoint `/api/v1/admin/analytics`:
- Khi người gọi là `admin`: Tính toán số liệu tổng thể trên toàn bộ cơ sở dữ liệu tỉnh Đồng Tháp (tổng lượt xem, tổng lượt quét QR, phễu chuyển đổi du khách toàn tỉnh).
- Khi người gọi là `partner`: Máy chủ tự động gắn bộ lọc phân vùng:
  ```typescript
  const partnerDestinations = await DestinationModel.find({ managedBy: req.user.id }).select('_id');
  const partnerDestIds = partnerDestinations.map(d => d._id);
  // Chỉ tổng hợp các sự kiện Analytics có destinationId nằm trong danh sách của đối tác
  ```
  → Đối tác xem được chính xác hiệu quả kinh doanh của cơ sở mình mà không bị lộ dữ liệu nhạy cảm của các đối tác cạnh tranh khác.
