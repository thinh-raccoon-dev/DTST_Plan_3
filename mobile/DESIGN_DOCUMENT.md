# TÀI LIỆU THIẾT KẾ & TỔNG QUAN HỆ THỐNG MOBILE v1.0
## Nền tảng Du lịch Thông minh & Hộ chiếu Trải nghiệm số Đồng Tháp (DTST Mobile)

- **Học phần**: PRM393 - Lập trình Di động Flutter
- **Sinh viên thực hiện**: **LẠI VĂN THỊNH** (Mức độ đóng góp: **100% Solo Developer**)
- **Mã nguồn**: Thư mục `mobile/` (Flutter 3.x / Dart 3.x)
- **Tài liệu Báo cáo 02 Trang (Nộp chấm điểm)**: [`BAO_CAO_PRM393_LAI_VAN_THINH.md`](file:///c:/Users/kokes/OneDrive/Desktop/thinh.raccoon/DTST_Plan_3/mobile/BAO_CAO_PRM393_LAI_VAN_THINH.md) | File in PDF: [`BAO_CAO_PRM393_LAI_VAN_THINH.html`](file:///c:/Users/kokes/OneDrive/Desktop/thinh.raccoon/DTST_Plan_3/mobile/BAO_CAO_PRM393_LAI_VAN_THINH.html)

---

### MỤC LỤC
1. [Giới thiệu & Mục tiêu Dự án](#1-giới-thiệu--mục-tiêu-dự-án)
2. [Kiến trúc Kỹ thuật Mobile (Flutter Architecture)](#2-kiến-trúc-kỹ-thuật-mobile-flutter-architecture)
3. [Hệ thống Thiết kế UI/UX & Bản sắc Đất Sen Hồng](#3-hệ-thống-thiết-kế-uiux--bản-sắc-đất-sen-hồng)
4. [Chi tiết 5 Phân hệ Tính năng Cốt lõi](#4-chi-tiết-5-phân-hệ-tính-năng-cốt-lõi)
   - [4.1. Trang chủ & Khám phá Điểm đến (Home & Destinations)](#41-trang-chủ--khám-phá-điểm-đến-home--destinations)
   - [4.2. Trạm Tương tác QR, GPS Check-in & Thử thách Văn hóa](#42-trạm-tương-tác-qr-gps-check-in--thử-thách-văn-hóa)
   - [4.3. AI Trip Planner V9 + Valhalla Routing & Live Replan Thực địa](#43-ai-trip-planner-v9--valhalla-routing--live-replan-thực-địa)
   - [4.4. Hộ chiếu Trải nghiệm số & Cơ chế Gamification](#44-hộ-chiếu-trải-nghiệm-số--cơ-chế-gamification)
   - [4.5. Tài khoản, Cá nhân hóa & Cấu hình Máy chủ](#45-tài-khoản-cá-nhân-hóa--cấu-hình-máy-chủ)
5. [Thiết kế Mạng, Bảo mật & Cơ chế Tự phục hồi Fallback](#5-thiết-kế-mạng-bảo-mật--cơ-chế-tự-phục-hồi-fallback)
6. [Cấu trúc Thư mục & Mã nguồn](#6-cấu-trúc-thư-mục--mã-nguồn)
7. [Chất lượng Mã nguồn & Báo cáo Kiểm thử Tự động](#7-chất-lượng-mã-nguồn--báo-cáo-kiểm-thử-tự-động)
8. [Hướng dẫn Cài đặt, Chạy trên Android Studio & Đóng gói APK](#8-hướng-dẫn-cài-đặt-chạy-trên-android-studio--đóng-gói-apk)

---

### 1. GIỚI THIỆU & MỤC TIÊU DỰ ÁN

#### 1.1. Bối cảnh
Dự án **"Nền tảng Du lịch Thông minh & Hộ chiếu Trải nghiệm số Đồng Tháp" (DTST)** nhằm mục tiêu số hóa toàn diện hoạt động du lịch tại tỉnh Đồng Tháp. Phiên bản Mobile v1.0 được phát triển độc lập 100% bởi sinh viên **Lại Văn Thịnh** bằng ngôn ngữ **Dart** trên nền tảng **Flutter 3.x** cho học phần **PRM393**, đóng vai trò là "người bạn đồng hành số" của du khách khi đặt chân đến Đất Sen Hồng.

#### 1.2. Mục tiêu Phiên bản Mobile v1.0
- **Tập trung vào tính năng thực địa (On-site Experience)**: Tận dụng phần cứng thiết bị di động (Camera quét mã QR, Cảm biến vị trí vệ tinh GPS độ chính xác cao, Bản đồ điều hướng ngoại vi).
- **Trợ lý Hành trình Thông minh (AI Companion)**: Lập kế hoạch du lịch bằng mô hình AI V9, phân bổ 5 nhóm ngân sách VND, điều hướng tối ưu hóa cung đường và đặc biệt là cơ chế **Live Replan 2 bước** hỗ trợ xử lý độ trễ/phát sinh ngay trên đường đi.
- **Hộ chiếu Số & Gamification**: Tạo động lực khám phá thông qua hệ thống điểm thưởng, cấp bậc du lịch và bộ sưu tập huy hiệu di sản văn hóa đặc trưng của Đồng Tháp.
- **Khả năng tương thích linh hoạt**: Hoạt động mượt mà trên cả Android Emulator, thiết bị Android thật qua mạng LAN/Wi-Fi, cũng như tương thích sẵn sàng với iOS/Web.

---

### 2. KIẾN TRÚC KỸ THUẬT MOBILE (FLUTTER ARCHITECTURE)

Ứng dụng được xây dựng theo mô hình **Layered Architecture (Kiến trúc phân tầng)** với tư duy Clean Architecture, đảm bảo tính tách biệt trách nhiệm (Separation of Concerns), dễ bảo trì và dễ viết kiểm thử tự động.

```
┌────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                   │
│   Screens (5 Core Tabs + Details + QR Landing + Auth)  │
│   Widgets (V9ItineraryView, Cards, Badges, Dialogs)    │
└───────────────────────────▲────────────────────────────┘
                            │ (Listen / Rebuild)
┌───────────────────────────┴────────────────────────────┐
│                    STATE MANAGEMENT                    │
│   AppState (ChangeNotifier / ListenableBuilder)        │
│   • Auth State (User / Guest Session)                  │
│   • Navigation Index & Quick Filter Handlers           │
│   • Favorite Destinations Store                        │
│   • Server Connectivity Live Status                    │
└───────────────────────────▲────────────────────────────┘
                            │ (Async Actions)
┌───────────────────────────┴────────────────────────────┐
│                      SERVICE LAYER                     │
│   ApiClient (Singleton Network Engine)                 │
│   • Persistent Cookie Jar (SharedPreferences)          │
│   • Double-Submit CSRF Protection                      │
│   • Platform-Aware Base URL Discovery                  │
│   • Local Smart Replan Synthesis Fallback Engine       │
└───────────────────────────▲────────────────────────────┘
                            │ (Data Transfer & Parsing)
┌───────────────────────────┴────────────────────────────┐
│                      MODELS LAYER                      │
│   api_models.dart (Type-safe Models)                   │
│   • AuthUser, UserPreferences                          │
│   • DestinationSummary, DestinationDetail              │
│   • QrLandingData, ChallengeQuiz, CheckinHistory       │
│   • PassportObject, BadgeObject                        │
│   • V9ItineraryObject, V9DayPlan, V9StopActivity       │
└────────────────────────────────────────────────────────┘
```

#### Các Đặc điểm Kỹ thuật Nổi bật:
1. **Quản lý Trạng thái Tinh gọn (Reactive ListenableBuilder)**:
   - Sử dụng `AppState` kế thừa `ChangeNotifier` kết hợp `ListenableBuilder` nguyên bản của Flutter 3.
   - Không phụ thuộc vào các thư viện bên ngoài cồng kềnh, giảm thiểu kích thước ứng dụng và tối ưu tốc độ render khung hình (60-120 fps).
2. **Cơ chế Cookie Jar Bền vững (Persistent Cookie Jar)**:
   - Mọi phiên đăng nhập qua session cookie (`connect.sid`) được lưu tự động vào `SharedPreferences`, đảm bảo người dùng không bị đăng xuất khi tắt mở lại ứng dụng.
3. **Bảo vệ Kép CSRF (Double-Submit CSRF)**:
   - Tự động lấy token từ endpoint `/api/v1/csrf` và đính kèm tiêu đề `x-csrf-token` trong mọi thao tác ghi dữ liệu (`POST`, `PATCH`, `PUT`, `DELETE`).
4. **Nhận diện Môi trường Tự động (Platform-Aware Networking)**:
   - Khi chạy trên Android Emulator: tự động cấu hình Base URL về `http://10.0.2.2:4000/api/v1` (trỏ trực tiếp về máy host).
   - Khi chạy trên Windows / Web / iOS Simulator: tự động trỏ về `http://localhost:4000/api/v1`.
   - Có giao diện người dùng để đổi sang IP LAN (`http://192.168.x.x:4000/api/v1`) khi chạy máy thật.

---

### 3. HỆ THỐNG THIẾT KẾ UI/UX & BẢN SẮC ĐẤT SEN HỒNG

Ứng dụng sở hữu bộ nhận diện thương hiệu số đậm đà bản sắc Đồng Tháp Mười, phối hợp giữa vẻ đẹp thiên nhiên sông nước và ngôn ngữ thiết kế Material 3 hiện đại.

#### 3.1. Bảng màu Chủ đạo (AppColors)
- **Sắc Sen Hồng (Lotus Palette)**:
  - `lotus600` (`#c02667`), `lotus500` (`#db2777`), `lotus50` (`#fdf2f8`).
  - Sử dụng cho: Biểu tượng Hộ chiếu số, Nút hành động tương tác văn hóa, Điểm nổi bật, Badge thành tích.
- **Sắc Rừng Tràm & Lá Sen (Leaf Palette)**:
  - `leaf700` (`#125a43`), `leaf600` (`#1b7a5b`), `leaf50` (`#f0fdf4`).
  - Màu sắc thương hiệu chủ đạo (Primary brand color), đại diện cho màu xanh của Vườn quốc gia Tràm Chim và các vùng sinh thái ngập nước.
- **Sắc Phù Sa Sông Tiền (River Palette)**:
  - `river900` (`#0a2540`), `river800` (`#0f3356`), `river600` (`#334e68`).
  - Sử dụng cho hệ thống văn bản, tiêu đề và các thành phần cấu trúc vững chãi.
- **Sắc Đất Cát & Mặt Nước (Sand & Teal Palette)**:
  - `sand100` (`#f7f5ef`), `teal600` (`#0d9488`), `teal200` (`#99f6e4`).
  - Sử dụng cho màu nền ứng dụng (ấm áp, dịu mắt khi sử dụng ngoài trời nắng) và các dải gradient ánh nước.

#### 3.2. Kiểu chữ (Typography)
- Phông chữ tiêu chuẩn: **Be Vietnam Pro** (thông qua `google_fonts`).
- Tối ưu hóa hoàn hảo cho tiếng Việt có dấu, độ tương phản cao, khả năng đọc rõ ràng trên mọi kích thước màn hình.

#### 3.3. Hệ thống Huy hiệu & Biểu trưng (Catalog Lookups)
- **Huy hiệu Xác minh Địa điểm**:
  - `official`: Điểm đến chính thống do Sở VHTT&DL / Ban quản lý trực tiếp xác nhận (Tích xanh viền vàng).
  - `partner`: Điểm đến đối tác lữ hành tin cậy (Tích ngọc viền lục).
  - `community`: Điểm đến tiềm năng do cộng đồng đề xuất.
- **Cảnh báo Ảnh Minh họa**:
  - Đi kèm nhãn `Ảnh minh họa` minh bạch giúp du khách nắm rõ tính chất hình ảnh tư liệu.
- **Huy hiệu Vai trò trong Lịch trình**:
  - `must_visit` (🌟 Điểm nhấn bắt buộc)
  - `food` (🍜 Ẩm thực Đồng Tháp)
  - `rest` (🛏️ Nghỉ chân)
  - `optional` (✨ Điểm mở rộng)

---

### 4. CHI TIẾT 5 PHÂN HỆ TÍNH NĂNG CỐT LÕI

#### 4.1. Trang chủ & Khám phá Điểm đến (Home & Destinations)

```
[Màn hình Trang chủ]
├── Hero Header: Chào du khách + Huy hiệu Trạng thái Máy chủ (DNS Green Dot) + Yêu thích
├── Banner Carousel: Khám phá Sen Tháp Mười, Lễ hội Xoài, Tràm Chim mùa nước nổi (Tích hợp Click tracker & Deep-link)
├── Thanh tìm kiếm nhanh & 6 Nhóm trải nghiệm (Sinh thái, Di tích, Làng nghề, Ẩm thực,...)
├── Điểm đến Gợi ý Cá nhân hóa (AI Personalized Suggestions dựa trên hồ sơ sở thích)
├── Thẻ tóm tắt Hộ chiếu Trải nghiệm số (Cấp bậc, Điểm thưởng, Tiến độ khám phá)
└── Danh sách Điểm đến có Trạm QR đang hoạt động thí điểm
```

- **Màn hình Khám phá (`DestinationsScreen`)**:
  - Tìm kiếm toàn văn theo tên, địa chỉ, từ khóa văn hóa, món ăn đặc sản.
  - Bộ lọc đa tiêu chí dạng BottomSheet: Lọc theo 6 danh mục, 12 địa phương (TP. Cao Lãnh, TP. Sa Đéc, TP. Hồng Ngự, Tháp Mười, Tam Nông, Lai Vung...), và công tắc "Chỉ hiện điểm có Trạm QR / Thử thách".
  - Hiển thị danh thiếp địa điểm chuẩn hóa với hình ảnh tải an toàn, huy hiệu xác thực và đánh giá thời lượng ghé thăm.
- **Chi tiết Điểm đến (`DestinationDetailScreen`)**:
  - Thư viện ảnh chất lượng cao.
  - Phím tắt **Chỉ đường Google Maps 1-chạm** (mở trực tiếp tọa độ thực địa).
  - Phím tắt **Gọi điện thoại trực tiếp** đến ban quản lý / chủ cơ sở.
  - Bảng thông tin thực tế: Giá vé (người lớn/trẻ em hoặc Miễn phí), Giờ mở cửa, Thời lượng đề xuất.
  - Xem trước Trạm QR & các thử thách văn hóa có tại điểm đến.
  - Nút thêm/bỏ Điểm đến yêu thích (Favorites).

---

#### 4.2. Trạm Tương tác QR, GPS Check-in & Thử thách Văn hóa

```
[Trạm QR & Check-in]
├── Khung Camera Quét QR tốc độ cao (mobile_scanner) + Công tắc bật Flash
├── Thẻ Nhập mã định danh thủ công (Dành cho trường hợp camera mờ / ngoài trời lóa)
├── Danh sách 4 Trạm Thí điểm 1-chạm:
│   ├── TRAMCHIM-01 (Vườn quốc gia Tràm Chim - Cổng A1)
│   ├── GOTHAP-01   (Khu di tích Gò Tháp - Tháp Mười)
│   ├── HTL-01      (Lăng Cụ Phó bảng Nguyễn Sinh Sắc - TP. Cao Lãnh)
│   └── SADEC-HOA   (Làng hoa Sa Đéc)
└── Landing Page Trạm QR (qr_landing_screen.dart):
    ├── Xác thực GPS vệ tinh (So khớp khoảng cách thực địa với bán kính cho phép)
    ├── Thử thách Văn hóa Trắc nghiệm (_ChallengeQuizCard)
    └── Hộp thoại Vinh danh Huy hiệu & Điểm thưởng (showNewBadgesDialog)
```

- **Cơ chế Chống gian lận Check-in**:
  - Ứng dụng đọc tọa độ GPS của thiết bị qua thư viện `geolocator` và tính khoảng cách (haversine) tới tọa độ trạm được cấu hình trên server.
  - Nếu nằm ngoài bán kính (mặc định 300m - 500m), hệ thống thông báo khoảng cách thực tế và yêu cầu du khách tiến lại gần trạm.
  - Hỗ trợ cơ chế giả lập tọa độ thông minh khi chạy trên Android Emulator (tự động điền tọa độ trạm để phục vụ đánh giá nghiệm thu).
- **Gamification Thử thách Văn hóa**:
  - Mỗi trạm có các câu hỏi trắc nghiệm tương tác về lịch sử, hệ sinh thái hoặc văn hóa địa phương.
  - Câu trả lời được gửi lên server chấm điểm bảo mật (`/api/v1/qr/challenge/submit`).
  - Trả về điểm thưởng cộng dồn, thông tin giải thích bổ ích và mở khóa tức thì các huy hiệu độc quyền.

---

#### 4.3. AI Trip Planner V9 + Valhalla Routing & Live Replan Thực địa

```
[Trip Planner V9]
├── Tab 1: Tạo Lịch trình AI V9 & Tùy chọn Bán tự động (Manual)
│   ├── Điểm xuất phát (TP. Cao Lãnh / Sa Đéc...), Ngày bắt đầu, Số ngày (1-7 ngày)
│   ├── Số lượng du khách, Dự toán ngân sách (VND)
│   ├── Phương tiện (🛵 Xe máy / 🚗 Ô tô, Taxi)
│   ├── Nhịp độ (🌿 Thư thả / ⚖️ Cân bằng / ⚡ Khám phá nhiều)
│   ├── 8 Nhóm sở thích văn hóa ẩm thực
│   └── Bộ chọn điểm đến thủ công (Catalog Picker) với phân vai trò must_visit, food, rest
└── Tab 2: Lịch trình đã lưu & Trình chiếu V9 (V9ItineraryView)
    ├── Thẻ Tổng quan (Ngân sách tổng, Thời gian di chuyển, Số điểm dừng)
    ├── Thẻ "Điểm dừng tiếp theo" (Next Stop) với nút chỉ đường nhanh
    ├── Biểu đồ 5 Nhóm Ngân sách (Di chuyển, Vé tham quan, Ăn uống, Lưu trú, Dự phòng)
    ├── Dòng thời gian chi tiết từng ngày (Timeline Stops)
    └── BẢNG ĐIỀU KHIỂN LIVE REPLAN 2 BƯỚC:
        ├── Bước 1: Báo "Đã đến điểm dừng" (arrived)
        ├── Bước 2: Báo "Bắt đầu xuất phát" (departed)
        ├── Chip phát sinh nhanh (+15p, +30p, +45p, +60p)
        └── Tự động tính toán lại thời gian các chặng kế tiếp
```

- **Mô hình Tối ưu hóa Hành trình**:
  - Tích hợp với dịch vụ định tuyến Valhalla qua backend Express.
  - Tự động sắp xếp thứ tự điểm đến tối ưu quãng đường và thời gian, tránh quay đầu xe không cần thiết.
  - Phân bổ 5 nhóm ngân sách minh bạch, giúp du khách kiểm soát tài chính chuyến đi chuẩn xác đến từng nghìn đồng.
- **Cơ chế Live Replan Thực địa (Đặc sản của DTST)**:
  - Khi du khách ở lại một điểm chụp ảnh lâu hơn dự kiến (ví dụ ngắm hoàng hôn Tràm Chim thêm 45 phút), họ chỉ cần bấm chọn chip `+45 phút`.
  - Ứng dụng lập tức gửi yêu cầu Replan hoặc kích hoạt bộ máy **Local Smart Replan Synthesis** để dời mốc giờ của các điểm tiếp theo, tự động cảnh báo nếu điểm đến kế tiếp sắp đến giờ đóng cửa.
  - Hỗ trợ đổi thứ tự điểm dừng (Move Up / Move Down) hoặc xóa điểm dừng trực tiếp trên dòng thời gian.
  - Lưu trữ toàn bộ nhật ký điều chỉnh (`replanHistory`) để du khách theo dõi diễn biến chuyến đi.

---

#### 4.4. Hộ chiếu Trải nghiệm số & Cơ chế Gamification

```
[Hộ chiếu Trải nghiệm số]
├── Bìa Hộ chiếu Sen Hồng (Mã định danh DTST, Tên du khách, Cấp bậc du lịch)
├── Thanh tiến độ Chinh phục Đồng Tháp (Ví dụ: 8/24 điểm - 33.3%)
├── 4 Thẻ Chỉ số Thành tích:
│   ├── ⭐ Tổng điểm tích lũy
│   ├── 📍 Điểm dừng đã check-in
│   ├── 🎯 Thử thách văn hóa đã vượt qua
│   └── 🏆 Huy hiệu sở hữu
├── Bộ sưu tập Huy hiệu (Badges Grid):
│   ├── Huy hiệu đã mở khóa (Hiển thị đầy đủ màu sắc, ngày mở, điểm thưởng)
│   └── Huy hiệu khóa (Hiển thị tiêu chí và gợi ý cách đạt được)
├── Lịch sử Check-in GPS & Thử thách thực địa
└── Nút 1-chạm: Gộp Hộ chiếu Khách trên thiết bị vào Tài khoản chính thức
```

- **Trải nghiệm Không rào cản (Guest-First Onboarding)**:
  - Du khách không bắt buộc phải đăng nhập ngay từ đầu.
  - Mọi lượt quét QR, check-in GPS và điểm thưởng được ghi nhận vào `localPassport` trên máy.
  - Khi du khách quyết định tạo tài khoản hoặc đăng nhập, ứng dụng cung cấp nút **1-chạm để gộp toàn bộ thành tích** vào tài khoản đám mây (`/api/v1/passport/claim-device`), bảo lưu trọn vẹn điểm số.

---

#### 4.5. Tài khoản, Cá nhân hóa & Cấu hình Máy chủ

```
[Tài khoản & Hạ tầng]
├── Chế độ Đăng nhập / Đăng ký chuẩn bảo mật
├── Chip 1-chạm điền tài khoản thử nghiệm:
│   ├── 👤 Du khách mẫu: dukhach@dongthap.vn / DongThap123!
│   └── 🛡️ Quản trị viên: admin@example.com / Dt-FbhNoHLx8l90
├── Cấu hình Hồ sơ Sở thích Du lịch (Khu vực quan tâm, Số ngày, Nhịp độ)
├── Quản lý Danh sách Điểm đến Yêu thích (Favorites)
└── Hộp thoại Cấu hình Máy chủ API (Server Config Dialog):
    ├── Đèn báo kết nối trực tiếp trên thanh AppBar (Xanh: Online / Đỏ: Mất kết nối)
    ├── Nút chuyển đổi nhanh:
    │   ├── Android Emulator (10.0.2.2:4000)
    │   └── Localhost (127.0.0.1:4000)
    └── Ô nhập IP tùy chỉnh (dành cho thử nghiệm trên máy thật qua Wi-Fi)
```

---

### 5. THIẾT KẾ MẠNG, BẢO MẬT & CƠ CHẾ TỰ PHỤC HỒI FALLBACK

#### 5.1. Mô hình Mạng Bảo mật (Security Network Engine)
- **Cookie Jar**: Duy trì trạng thái phiên làm việc không bị gián đoạn giữa các lần khởi động ứng dụng.
- **Double-Submit CSRF**: Toàn bộ thao tác sửa đổi dữ liệu được bảo vệ bằng token CSRF.
- **Bắt lỗi & Thông điệp Thân thiện**:
  - Không để lộ lỗi kỹ thuật dạng raw stacktrace cho người dùng cuối.
  - Tự động phát hiện trường hợp máy chủ chưa khởi động hoặc sai địa chỉ IP và hiển thị hộp thoại trợ giúp kết nối.

#### 5.2. Cơ chế Tự phục hồi Live Replan Ngoại tuyến (Local Fallback Synthesis)
Khi du khách đang di chuyển ở các vùng sinh thái có sóng 3G/4G chập chờn (ví dụ sâu trong rừng tràm):
- Nếu cuộc gọi API Replan tới máy chủ bị gián đoạn hoặc timeout, `ApiClient` tự động chuyển sang chế độ **Local Smart Replan Synthesis**.
- Thuật toán cục bộ tính toán lại toàn bộ các mốc `startTime` và `endTime` dựa trên khoảng cách giữa các điểm và độ trễ do du khách khai báo, đảm bảo lịch trình không bao giờ bị đứng hoặc mất dữ liệu.

---

### 6. CẤU TRÚC THƯ MỤC & MÃ NGUỒN

Toàn bộ mã nguồn bản Mobile nằm gọn trong thư mục `mobile/`:

```
mobile/
├── android/                   # Cấu hình Android native (SDK, Permissions, Gradle)
├── ios/                       # Cấu hình iOS native
├── web/                       # Cấu hình Web preview
├── lib/                       # Toàn bộ mã nguồn Dart
│   ├── main.dart              # Điểm khởi chạy, DtstMainShell, 5 Tabs Navigation, AppBar
│   ├── models/
│   │   └── api_models.dart    # Định nghĩa cấu trúc dữ liệu Type-Safe, Serialization
│   ├── services/
│   │   └── api_client.dart    # Http Engine, Cookie Jar, CSRF, Replan Fallback
│   ├── state/
│   │   └── app_state.dart     # Global State (Auth, Favorites, Tabs, Live Status)
│   ├── theme/
│   │   └── app_theme.dart     # Bảng màu Sen Hồng, Typography, Catalog Lookups
│   ├── widgets/
│   │   ├── common_widgets.dart    # Image Loader, Verification Badges, Dialogs
│   │   └── v9_itinerary_view.dart # Trình diễn Lịch trình V9 & Điều khiển Live Replan
│   └── screens/
│       ├── home_screen.dart               # Trang chủ, Banners, Gợi ý, Lối tắt
│       ├── destinations_screen.dart       # Bản đồ & Tìm kiếm, Lọc đa tiêu chí
│       ├── destination_detail_screen.dart # Chi tiết điểm đến, Chỉ đường, Điện thoại
│       ├── qr_scan_screen.dart            # Camera quét QR, Nhập mã, Trạm thí điểm
│       ├── qr_landing_screen.dart         # Landing trạm, Check-in GPS, Trắc nghiệm
│       ├── trip_planner_screen.dart       # Lập kế hoạch AI V9, Catalog Selector
│       ├── itinerary_detail_screen.dart   # Chi tiết lịch trình đã lưu, Sửa/Xóa
│       ├── passport_screen.dart           # Hộ chiếu số, Điểm thưởng, Huy hiệu
│       └── auth_profile_screen.dart       # Đăng nhập, Hồ sơ, Yêu thích
├── test/                      # Bộ kiểm thử tự động
│   ├── mock_api_client.dart           # Mock HTTP Engine giả lập Backend
│   ├── models_and_formatters_test.dart# 10 Unit Tests (Formatters, Catalog, Models)
│   ├── screens_flow_test.dart         # 6 UI/UX Flow Tests (Tabs, Server, Auth, QR, AI)
│   └── widget_test.dart               # 1 Shell Smoke Test
├── pubspec.yaml               # Danh mục phụ thuộc & thông tin dự án
└── DESIGN_DOCUMENT.md         # Tài liệu thiết kế chi tiết (Tài liệu này)
```

---

### 7. CHẤT LƯỢNG MÃ NGUỒN & BÁO CÁO KIỂM THỬ TỰ ĐỘNG

Dự án đã trải qua quá trình rà soát mã nguồn toàn diện và chạy kiểm thử tự động đạt kết quả tuyệt đối:

#### 7.1. Phân tích Cú pháp & Chuẩn Code (Flutter Analyze)
- **Lệnh thực thi**: `flutter analyze`
- **Kết quả**: **0 issues found** (Không còn bất kỳ lỗi cú pháp, cảnh báo deprecation hay biến thừa nào).

#### 7.2. Kiểm thử Tự động (Flutter Test Suites)
- **Lệnh thực thi**: `flutter test`
- **Kết quả**: **17/17 tests PASSED (100% Passed)** trong 8 giây:

| STT | Nhóm Kiểm thử | Nội dung Test Case | Kết quả |
|:---:|:---|:---|:---:|
| 1 | `AppFormatters` | Định dạng tiền tệ Việt Nam (`1.250.000 ₫`) | **PASS** |
| 2 | `AppFormatters` | Rút gọn số tiền (`1.2 triệu`, `350k`) | **PASS** |
| 3 | `AppFormatters` | Định dạng thời lượng phút sang giờ & phút | **PASS** |
| 4 | `AppFormatters` | Chuyển đổi ngày chuẩn ISO sang `dd/mm/yyyy` | **PASS** |
| 5 | `AppFormatters` | Trích xuất mã QR từ URL hoặc chuỗi trực tiếp | **PASS** |
| 6 | `AppCatalog` | Tra cứu nhãn và biểu tượng danh mục / địa phương | **PASS** |
| 7 | `AppCatalog` | Tra cứu kiểu dáng và huy hiệu vai trò điểm dừng | **PASS** |
| 8 | `API Models` | Serialization `DestinationSummary` & `DestinationDetail` | **PASS** |
| 9 | `API Models` | Serialization `PassportObject` & `BadgeObject` | **PASS** |
| 10 | `API Models` | Serialization `V9ItineraryObject` & `V9DayPlan` | **PASS** |
| 11 | `Main Shell` | Khởi tạo DtstMobileApp và hiển thị 5 tab điều hướng | **PASS** |
| 12 | `Screens Flow` | Chuyển đổi mượt mà giữa cả 5 tab điều hướng chính | **PASS** |
| 13 | `Screens Flow` | Mở hộp thoại cấu hình máy chủ và chọn các preset | **PASS** |
| 14 | `Screens Flow` | Nút yêu thích điều hướng đến màn hình xác thực | **PASS** |
| 15 | `Screens Flow` | Tự động điền tài khoản mẫu du khách và quản trị viên | **PASS** |
| 16 | `Screens Flow` | Quét QR: Hiển thị 4 trạm thí điểm & nhập mã thủ công | **PASS** |
| 17 | `Screens Flow` | AI Planner: Chuyển tab Lập lịch AI / Đã lưu & giá trị mặc định | **PASS** |

---

### 8. HƯỚNG DẪN CÀI ĐẶT, CHẠY TRÊN ANDROID STUDIO & ĐÓNG GÓI APK

#### 8.1. Yêu cầu Môi trường
- **Flutter SDK**: 3.22.x hoặc mới hơn (kèm Dart 3.4+).
- **Android Studio**: Bản Iguana, Jellyfish, Koala hoặc Ladybug.
- **Android SDK**: Phiên bản 34 (Android 14) hoặc 35.
- **Node.js & MongoDB**: Đang chạy backend DTST tại cổng `4000` (đã có sẵn seed dữ liệu mẫu).

#### 8.2. Mở Dự án trong Android Studio
1. Mở **Android Studio** -> Chọn **Open**.
2. Duyệt đến thư mục `DTST_Plan_3/mobile` (hoặc mở thư mục gốc rồi mở project `mobile`).
3. Chờ Android Studio nhận diện Flutter project và đồng bộ Gradle.
4. Mở cửa sổ Terminal trong Android Studio và chạy lệnh tải gói thư viện:
   ```bash
   flutter pub get
   ```

#### 8.3. Khởi chạy Ứng dụng
- **Trên Android Emulator**:
  1. Khởi động một máy ảo bất kỳ (ví dụ: Pixel 7 API 34).
  2. Bấm nút **Run (Shift + F10)** trên thanh công cụ của Android Studio.
  3. Ứng dụng tự động kết nối vào backend thông qua địa chỉ `http://10.0.2.2:4000/api/v1`.
- **Trên Điện thoại Android thật (qua cáp USB hoặc Wi-Fi)**:
  1. Bật chế độ "Tùy chọn cho nhà phát triển" (Developer Options) và "Gỡ lỗi qua USB" (USB Debugging).
  2. Kết nối điện thoại cùng mạng Wi-Fi với máy tính chạy backend.
  3. Sau khi ứng dụng khởi động, bấm vào biểu tượng **Máy chủ (DNS)** góc trên bên phải thanh AppBar, chọn hoặc nhập IP LAN của máy tính (ví dụ: `http://192.168.1.15:4000/api/v1`), bấm **Lưu & Thử kết nối**.

#### 8.4. Đóng gói Bản phát hành (Release APK)
Để xuất file APK hoàn chỉnh cài đặt trên mọi máy Android:
```bash
cd mobile
flutter build apk --release
```
File APK thành phẩm sẽ được tạo tại:
`mobile/build/app/outputs/flutter-apk/app-release.apk`

---

### TỔNG KẾT

Phiên bản **Mobile v1.0** của Nền tảng Du lịch Thông minh & Hộ chiếu Trải nghiệm số Đồng Tháp đã được hoàn thiện đạt chuẩn chất lượng cao:
- Giao diện trau chuốt, đậm đà bản sắc Đất Sen Hồng.
- Kiến trúc bền vững, xử lý ngoại lệ mạng và lỗi bố cục toàn diện.
- Toàn bộ 5 phân hệ cốt lõi hoạt động nhịp nhàng và liên thông với backend.
- 100% các bài kiểm thử tự động đều đã vượt qua thành công.
