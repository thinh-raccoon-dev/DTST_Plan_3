import type { Area, Category } from '../config/catalog.js';

export interface SeedDestination {
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: Category;
  tags: string[];
  area: Area;
  address?: string;
  coordinates?: { lat: number; lng: number };
  images?: Array<{ url: string; alt: string; credit?: string; license?: string }>;
  openingHours?: string;
  referencePrice?: string;
  contactInfo?: { phone?: string; website?: string; email?: string };
  estimatedVisitDuration?: { minutes: number; isEstimate: boolean; note: string };
  sourceUrls: string[];
  publicationStatus: 'draft' | 'published';
}

export const seedDestinations: SeedDestination[] = [
  {
    "slug": "banh-xeo-cao-lanh-ut-nang",
    "name": "Quán Bánh xèo Cao Lãnh Út Nàng",
    "summary": "Quán bánh xèo thịt vịt củ hủ dừa nức danh Cao Lãnh với viền bánh giòn tan mỏng tang như tờ giấy.",
    "description": "Bánh xèo Cao Lãnh có nét đặc trưng rất riêng so với bánh xèo miền Tây khác: vỏ bánh được đổ trong chảo gang nhỏ, bột gạo lúa thơm pha nước cốt dừa béo ngậy được tráng mỏng tang giòn rụm màu vàng nghệ. Nhân bánh không dùng thịt heo mà dùng thịt vịt xiêm băm nhỏ cả xương mềm xào thơm, kết hợp củ hủ dừa ngọt giòn hoặc củ sắn thái chỉ và giá đỗ. Ăn kèm rổ rau rừng tươi rói hơn 20 loại hái từ vườn: lá cách, đọt xoài, lá lốt, sao nhái, chấm nước mắm chua ngọt dưa chua củ cải.",
    "category": "food",
    "tags": [
      "bánh xèo Cao Lãnh",
      "thịt vịt củ hủ dừa",
      "Út Nàng",
      "đặc sản Cao Lãnh",
      "rau rừng",
      "bánh dân gian"
    ],
    "area": "cao-lanh",
    "address": "Số 226 Đường Lê Duẩn, Phường Mỹ Phú, TP. Cao Lãnh, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.462,
      "lng": 105.642
    },
    "images": [
      {
        "url": "/images/destinations/cao-lanh/banh-xeo-cao-lanh-ut-nang.jpg",
        "alt": "Quán Bánh xèo Cao Lãnh Út Nàng — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "08:00 – 21:30 hàng ngày",
    "referencePrice": "25.000 – 55.000 VNĐ/cái (nhân thịt vịt củ hủ dừa đặc biệt)",
    "contactInfo": {
      "phone": "0277 3871 888"
    },
    "estimatedVisitDuration": {
      "minutes": 50,
      "isEstimate": false,
      "note": "Nên ăn lúc bánh vừa trút khỏi chảo nóng giòn."
    },
    "sourceUrls": [
      "https://dongthap.gov.vn"
    ],
    "publicationStatus": "published"
  },
  {
    "slug": "bao-tang-tong-hop-dong-thap",
    "name": "Bảo tàng Tổng hợp Đồng Tháp",
    "summary": "Nơi lưu giữ hơn 30.000 hiện vật quý giá tái hiện lịch sử văn hóa Óc Eo, di sản sen hồng và hai cuộc kháng chiến của vùng đất Đồng Tháp.",
    "description": "Tọa lạc ngay trung tâm TP. Cao Lãnh bên dòng sông Hòa Định hiền hòa, Bảo tàng Tổng hợp Đồng Tháp là điểm đến văn hóa – lịch sử không thể bỏ qua. Bảo tàng sở hữu kiến trúc nhà cổ Nam Bộ kết hợp hiện đại, trưng bày hơn 30.000 hiện vật độc đáo, nổi bật nhất là bộ sưu tập vàng lá chạm khắc và tượng Phật thuộc nền văn hóa Óc Eo (vương quốc Phù Nam cổ đại) được công nhận là Bảo vật Quốc gia. Khuôn viên ngoài trời rợp bóng cây xanh còn trưng bày các hiện vật chiến tranh, máy bay, xe tăng và tái hiện sinh động đời sống sinh hoạt sông nước của cư dân vùng Đồng Tháp Mười.",
    "category": "culture",
    "tags": [
      "bảo tàng",
      "lịch sử",
      "văn hóa",
      "văn hóa Óc Eo",
      "Cao Lãnh"
    ],
    "area": "cao-lanh",
    "address": "Số 226 Đường Nguyễn Thái Học, Phường 4, TP. Cao Lãnh, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.4598,
      "lng": 105.6325
    },
    "images": [
      {
        "url": "/images/destinations/cao-lanh/bao-tang-tong-hop-dong-thap.jpg",
        "alt": "Bảo tàng Tổng hợp Đồng Tháp — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:30 – 11:30, 13:30 – 17:00 (Thứ Ba đến Chủ Nhật)",
    "referencePrice": "Miễn phí vé vào cổng tham quan",
    "estimatedVisitDuration": {
      "minutes": 90,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "ca-loc-nuong-trui-la-sen-cao-lanh",
    "name": "Quán Cá lóc Nướng trui Cuốn Lá Sen Non Cao Lãnh",
    "summary": "Món ăn biểu tượng tinh hoa Đất Sen Hồng, cá đồng nướng rơm bọc lá sen non chấm mắm me chua cay.",
    "description": "Đến Cao Lãnh – thủ phủ tỉnh Đồng Tháp mà chưa thưởng thức Cá lóc nướng trui cuốn lá sen non thì xem như chưa trọn vẹn chuyến đi. Con cá lóc đồng béo tròn được xiên que tre nướng rơm nguyên con thơm lừng mùi khói rạ đồng quê. Điểm tinh tế nhất của món ăn là không cuốn bánh tráng mà dùng chính những chiếc lá sen non bánh tẻ vừa hé nở trên đầm, cuốn cùng lát cá trắng muốt, một nhúm rau thơm, chuối xanh, khế chua rồi chấm ngập vào bát nước mắm me pha đường thốt nốt và ớt xiêm xanh.",
    "category": "food",
    "tags": [
      "cá lóc nướng trui",
      "lá sen non",
      "đặc sản Cao Lãnh",
      "tinh hoa Đất Sen Hồng",
      "món ngon Đồng Tháp"
    ],
    "area": "cao-lanh",
    "address": "Khu ẩm thực Bờ hồ Mai Văn Khải, Xã Mỹ Tân, TP. Cao Lãnh, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.485,
      "lng": 105.62
    },
    "images": [
      {
        "url": "/images/destinations/cao-lanh/ca-loc-nuong-trui-la-sen-cao-lanh.jpg",
        "alt": "Quán Cá lóc Nướng trui Cuốn Lá Sen Non Cao Lãnh — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "10:00 – 22:30 hàng ngày",
    "referencePrice": "120.000 – 190.000 VNĐ/con cá lóc nướng đầy đặn mẹt rau sen",
    "contactInfo": {
      "phone": "0277 3899 123"
    },
    "estimatedVisitDuration": {
      "minutes": 75,
      "isEstimate": false,
      "note": "Ăn tối ven hồ ngắm gió mát Đồng Tháp rất thú vị."
    },
    "sourceUrls": [
      "https://dongthap.gov.vn"
    ],
    "publicationStatus": "published"
  },
  {
    "slug": "chua-hung-thien",
    "name": "Chùa Hưng Thiền",
    "summary": "Ngôi đại tự thanh tịnh nổi tiếng với tượng Phật A Di Đà cao 43m uy nghiêm giữa vùng quê xanh mát huyện Cao Lãnh.",
    "description": "Chùa Hưng Thiền nằm tại xã Mỹ Hội, huyện Cao Lãnh, là một trong những trung tâm tu học Phật giáo lớn nhất vùng Đồng Tháp Mười. Điểm nhấn ấn tượng nhất của ngôi chùa là bảo tượng Đức Phật A Di Đà đứng trên đài sen cao 43m nổi bật giữa nền trời xanh và những cánh đồng lúa, vườn cây ăn trái trù phú. Lối dẫn lên đài tượng được chạm khắc đôi rồng uốn lượn tinh xảo cùng những đóa sen hồng thanh thoát. Không gian chùa vô cùng yên bình, thoáng đãng, thu hút đông đảo Phật tử và du khách thập phương đến chiêm bái, cầu bình an.",
    "category": "culture",
    "tags": [
      "chùa",
      "tâm linh",
      "chùa cổ",
      "văn hóa",
      "tượng Phật"
    ],
    "area": "cao-lanh",
    "address": "Ấp Mỹ Thới, Xã Mỹ Hội, Huyện Cao Lãnh, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.4912,
      "lng": 105.7145
    },
    "images": [
      {
        "url": "/images/destinations/cao-lanh/chua-hung-thien.jpg",
        "alt": "Chùa Hưng Thiền — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "06:00 – 18:00 hàng ngày",
    "referencePrice": "Miễn phí vé tham quan và lễ Phật",
    "estimatedVisitDuration": {
      "minutes": 60,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "diem-du-lich-lang-tre",
    "name": "Điểm du lịch Làng Tre",
    "summary": "Không gian sinh thái mộc mạc được kiến tạo từ hàng ngàn cây tre xanh mát, nơi trải nghiệm trò chơi dân gian và ẩm thực đồng quê.",
    "description": "Điểm du lịch sinh thái Làng Tre mang đến một không gian miền quê Nam Bộ bình dị với những rặng tre xanh rì rào soi bóng xuống mặt hồ phẳng lặng. Toàn bộ cầu đi bộ, chòi nghỉ mát và tiểu cảnh chụp ảnh tại đây đều được chế tác khéo léo từ cây tre và vật liệu tự nhiên. Du khách đến Làng Tre có thể khoác lên mình bộ đồ bà ba truyền thống để chèo xuồng, đi cầu tre lắt lẻo, câu cá thư giãn và thưởng thức các món ăn dân dã như gà đốt, cá lóc nướng trui, lẩu cua đồng ngay trên những chòi lá thoáng mát.",
    "category": "local_experience",
    "tags": [
      "tre",
      "thư giãn",
      "gia đình",
      "sinh thái",
      "làng tre",
      "chụp ảnh",
      "ẩm thực đồng quê"
    ],
    "area": "cao-lanh",
    "address": "Xã Mỹ Tân, TP. Cao Lãnh, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.482,
      "lng": 105.618
    },
    "images": [
      {
        "url": "/images/destinations/cao-lanh/diem-du-lich-lang-tre.jpg",
        "alt": "Điểm du lịch Làng Tre — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "08:00 – 20:00 hàng ngày",
    "referencePrice": "Vé vào cổng chụp ảnh: 30.000 VNĐ/người; Ăn uống từ 100.000 – 200.000 VNĐ/người",
    "estimatedVisitDuration": {
      "minutes": 120,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "du-lich-sinh-thai-thien-phu",
    "name": "Du lịch sinh thái Thiên Phú",
    "summary": "Khu vườn sinh thái miệt vườn kết hợp hồ bơi, câu cá giải trí và thưởng thức trái cây theo mùa tại Cao Lãnh.",
    "description": "Khu du lịch sinh thái Thiên Phú là điểm dã ngoại cuối tuần lý tưởng dành cho gia đình và nhóm bạn tại khu vực Cao Lãnh. Với diện tích rộng rãi được bao phủ bởi vườn cây ăn trái sum suê và hệ thống ao hồ thoáng mát, nơi đây cung cấp đa dạng dịch vụ từ câu cá giải trí, chèo thuyền, khu vui chơi trẻ em cho đến các chòi lá riêng tư bên mặt nước. Thực đơn của Thiên Phú đậm chất đồng quê Đồng Tháp với cá tai tượng chiên xù, chuột đồng quay lu, ốc bươu hấp tiêu và các loại rau vườn tươi ngon.",
    "category": "eco",
    "tags": [
      "sinh thái",
      "gia đình",
      "câu cá",
      "ẩm thực"
    ],
    "area": "cao-lanh",
    "address": "Xã Mỹ Hiệp, Huyện Cao Lãnh, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.4715,
      "lng": 105.721
    },
    "images": [
      {
        "url": "/images/destinations/cao-lanh/du-lich-sinh-thai-thien-phu.jpg",
        "alt": "Du lịch sinh thái Thiên Phú — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:30 – 21:00 hàng ngày",
    "referencePrice": "Vào cổng miễn phí khi dùng bữa; Chi phí ăn uống từ 120.000 – 220.000 VNĐ/người",
    "estimatedVisitDuration": {
      "minutes": 120,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "khu-di-tich-nguyen-sinh-sac",
    "name": "Khu di tích Cụ Phó bảng Nguyễn Sinh Sắc",
    "summary": "Khu lưu niệm Cụ Phó bảng thân sinh Chủ tịch Hồ Chí Minh và tái hiện làng Hòa An cổ truyền.",
    "description": "Khu di tích rộng gần 10ha tọa lạc tại trung tâm thành phố Cao Lãnh, là nơi yên nghỉ của Cụ Phó bảng Nguyễn Sinh Sắc – nhà nho yêu nước, thân sinh Chủ tịch Hồ Chí Minh kính yêu. Quần thể gồm vòm mộ Cụ Phó bảng hình cánh sen cách điệu bằng đá cẩm thạch trắng, nhà trưng bày cuộc đời sự nghiệp, khu mô phỏng nhà sàn Bác Hồ tỉ lệ 1:1 và đặc biệt là không gian Làng cổ Hòa An tái hiện nếp sống, rạch nước, vườn cây, nhà gỗ truyền thống của người dân Đồng Tháp đầu thế kỷ XX.",
    "category": "history",
    "tags": [
      "di tích lịch sử",
      "Nguyễn Sinh Sắc",
      "làng cổ Hòa An",
      "Bác Hồ",
      "văn hóa"
    ],
    "area": "cao-lanh",
    "address": "Số 123/1 Đường Phạm Hữu Lầu, Phường 4, TP. Cao Lãnh, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.4685,
      "lng": 105.6363
    },
    "images": [
      {
        "url": "/images/destinations/cao-lanh/khu-di-tich-nguyen-sinh-sac.jpg",
        "alt": "Khu di tích Cụ Phó bảng Nguyễn Sinh Sắc — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:00 – 11:30, 13:30 – 17:00 hàng ngày",
    "referencePrice": "Miễn phí vé tham quan toàn bộ khu di tích",
    "contactInfo": {
      "phone": "0277 3851 525"
    },
    "estimatedVisitDuration": {
      "minutes": 90,
      "isEstimate": false,
      "note": "Viếng lăng mộ, tham quan nhà lưu niệm và làng Hòa An."
    },
    "sourceUrls": [
      "https://ditichnguyensinhsac.dongthap.gov.vn"
    ],
    "publicationStatus": "published"
  },
  {
    "slug": "khu-di-tich-xeo-quyt",
    "name": "Khu di tích Xẻo Quýt",
    "summary": "Căn cứ kháng chiến giữa rừng tràm nguyên sinh, di tích lịch sử cách mạng hào hùng.",
    "description": "Khu di tích Xẻo Quýt rộng khoảng 50ha, từng là căn cứ cơ quan Tỉnh ủy Kiến Phong (nay là Đồng Tháp) lãnh đạo nhân dân kháng chiến chống Mỹ từ năm 1960 đến 1975. Nơi đây lưu giữ nguyên vẹn các công sự, hầm chữ A, hầm bí mật, nhà hội trường dã chiến ẩn mình dưới những tán tràm cổ thụ phủ đầy rêu phong và dây bòng bong. Du khách có thể đi bộ theo đường bê tông uốn lượn dưới tán rừng hoặc ngồi xuồng ba lá do các cô thôn nữ mặc áo bà ba chèo lướt trên mặt nước bèo tấm.",
    "category": "history",
    "tags": [
      "di tích lịch sử",
      "căn cứ kháng chiến",
      "xuồng ba lá",
      "rừng tràm",
      "sinh thái"
    ],
    "area": "cao-lanh",
    "address": "Ấp 4, Xã Mỹ Hiệp, Huyện Cao Lãnh, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.48,
      "lng": 105.73
    },
    "images": [
      {
        "url": "/images/destinations/cao-lanh/khu-di-tich-xeo-quyt.jpg",
        "alt": "Khu di tích Xẻo Quýt — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:30 – 17:00 hàng ngày",
    "referencePrice": "Vé vào cổng 20.000 VNĐ; Vé xuồng ba lá len lỏi rừng tràm 25.000 VNĐ/người",
    "contactInfo": {
      "phone": "0277 3910 397"
    },
    "estimatedVisitDuration": {
      "minutes": 120,
      "isEstimate": false,
      "note": "Bao gồm đi bộ tham quan và trải nghiệm xuồng ba lá."
    },
    "sourceUrls": [
      "https://dongthap.gov.vn"
    ],
    "publicationStatus": "published"
  },
  {
    "slug": "khu-du-lich-sinh-thai-dong-xanh",
    "name": "Khu du lịch sinh thái Đồng Xanh",
    "summary": "Không gian xanh mướt giữa cánh đồng lúa và đầm sen Cao Lãnh, điểm hẹn lý tưởng để thưởng thức ẩm thực mùa nước nổi.",
    "description": "Nằm giữa khung cảnh đồng quê yên ả của thành phố Cao Lãnh, Khu du lịch sinh thái Đồng Xanh sở hữu tầm nhìn thoáng đãng hướng ra những cánh đồng lúa chín vàng và ao sen thơm ngát. Những lối đi lát gỗ uốn lượn qua hồ súng, cầu khỉ bắt ngang kênh nhỏ và dãy chòi mái lá ven hồ tạo nên khung cảnh check-in đậm chất miền Tây. Đến Đồng Xanh, du khách được hòa mình vào làn gió đồng mát rượi và thưởng thức những món ngon trứ danh như gỏi ngó sen tôm thịt, cơm gói lá sen, cá linh kho mía và lẩu mắm đồng quê.",
    "category": "eco",
    "tags": [
      "vườn cây",
      "nông thôn",
      "thư giãn",
      "sinh thái",
      "đồng quê",
      "sen",
      "ẩm thực"
    ],
    "area": "cao-lanh",
    "address": "Phường Mỹ Phú, TP. Cao Lãnh, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.465,
      "lng": 105.649
    },
    "images": [
      {
        "url": "/images/destinations/cao-lanh/khu-du-lich-sinh-thai-dong-xanh.jpg",
        "alt": "Khu du lịch sinh thái Đồng Xanh — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "08:00 – 21:30 hàng ngày",
    "referencePrice": "Mức chi tiêu ăn uống và trải nghiệm: 100.000 – 200.000 VNĐ/người",
    "estimatedVisitDuration": {
      "minutes": 120,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "khu-du-lich-sinh-thai-gao-giong",
    "name": "Khu du lịch sinh thái Gáo Giồng",
    "summary": "Ốc đảo xanh của vùng Đồng Tháp Mười, thưởng thức chợ quê miệt vườn trên chòi tre giữa rừng tràm.",
    "description": "Gáo Giồng (Cao Lãnh) được ví như \"lá phổi xanh\" của Đồng Tháp Mười với rừng tràm bạt ngàn rộng 1.700ha. Du khách sẽ leo lên đài quan sát cao 18m ngắm toàn cảnh thảm xanh mênh mông, ngồi xuồng ba lá lướt qua sân chim với hàng chục ngàn con cò trắng, cồng cộc, trích mồng đỏ ríu rít gọi bầy. Đặc biệt, khu ẩm thực nhà chòi giữa rừng tràm phục vụ các món ăn đồng quê chuẩn vị: cá rô kho tộ tộ đất, cá lóc nướng trui cuốn lá sen non, ốc lác hấp sả, canh chua bông điên điển mùa nước nổi.",
    "category": "eco",
    "tags": [
      "sinh thái",
      "rừng tràm",
      "vườn chim",
      "chợ quê",
      "xuồng ba lá",
      "ẩm thực đồng quê"
    ],
    "area": "cao-lanh",
    "address": "Ấp 6, Xã Gáo Giồng, Huyện Cao Lãnh, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.552,
      "lng": 105.586
    },
    "images": [
      {
        "url": "/images/destinations/cao-lanh/khu-du-lich-sinh-thai-gao-giong.jpg",
        "alt": "Khu du lịch sinh thái Gáo Giồng — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:00 – 17:30 hàng ngày",
    "referencePrice": "Vé cổng: 20.000 VNĐ; Vé xuồng ba lá ngắm vườn chim: 30.000 VNĐ/người; Ăn uống: 150.000 – 250.000 VNĐ/người",
    "contactInfo": {
      "phone": "0277 3926 093"
    },
    "estimatedVisitDuration": {
      "minutes": 180,
      "isEstimate": false,
      "note": "Rất thích hợp cho bữa trưa thưởng thức ẩm thực đồng quê."
    },
    "sourceUrls": [
      "https://dongthap.gov.vn"
    ],
    "publicationStatus": "published"
  },
  {
    "slug": "khu-du-lich-sinh-thai-nam-huong",
    "name": "Khu du lịch sinh thái Nam Hương",
    "summary": "Khu vườn sinh thái nghỉ dưỡng ven sông với cảnh quan miệt vườn xanh mát, câu cá thư giãn và ẩm thực Nam Bộ.",
    "description": "Khu du lịch sinh thái Nam Hương mang vẻ đẹp thanh bình của vùng đất ven sông Tiền với những hàng dừa nghiêng bóng, vườn cây ăn trái bốn mùa và hồ nước trong xanh. Đây là địa điểm quen thuộc để du khách dừng chân nghỉ ngơi, trải nghiệm cảm giác tự tay câu cá tra, cá lóc dưới ao rồi nhờ đầu bếp chế biến nóng hổi tại chỗ. Không gian thoáng rộng, yên tĩnh cùng cung cách phục vụ hiếu khách của người dân Cao Lãnh giúp Nam Hương trở thành điểm hẹn thư giãn trọn vẹn cho các đoàn khách gia đình.",
    "category": "eco",
    "tags": [
      "sinh thái",
      "vườn",
      "câu cá",
      "miệt vườn",
      "thư giãn"
    ],
    "area": "cao-lanh",
    "address": "Xã Hòa An, TP. Cao Lãnh, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.451,
      "lng": 105.6195
    },
    "images": [
      {
        "url": "/images/destinations/cao-lanh/khu-du-lich-sinh-thai-nam-huong.jpg",
        "alt": "Khu du lịch sinh thái Nam Hương — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "08:00 – 21:00 hàng ngày",
    "referencePrice": "Vào cổng tự do; Thực đơn món đồng quê từ 80.000 – 250.000 VNĐ/món",
    "estimatedVisitDuration": {
      "minutes": 90,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "khu-du-lich-van-hoa-phuong-nam",
    "name": "Khu du lịch Văn hóa Phương Nam",
    "summary": "Công trình kiến trúc đền thờ gỗ lim bề thế bậc nhất Nam Bộ, tôn vinh các bậc tiền nhân khai hoang mở cõi.",
    "description": "Tọa lạc tại huyện Lấp Vò trên khuôn viên rộng hơn 5ha, Khu du lịch Văn hóa Phương Nam là công trình văn hóa tâm linh tráng lệ. Điểm nhấn trung tâm là Đền thờ Nam Phương Linh Từ được xây dựng hoàn toàn bằng gỗ lim theo phong cách kiến trúc cung đình cổ với 60 cột gỗ quý chạm trổ long lân quy phụng. Nơi đây thờ phụng 125 nhân vật lịch sử lỗi lạc có công khai phá và gìn giữ dải đất phương Nam như Nguyễn Hoàng, Nguyễn Hữu Cảnh, Mạc Cửu, Thoại Ngọc Hầu... Ngoài ra, khu du lịch còn có bảo tàng nông cụ, phố ẩm thực Nam Bộ và hồ sen cầu ngói cổ kính.",
    "category": "culture",
    "tags": [
      "Nam Phương Linh Từ",
      "kiến trúc gỗ lim",
      "Lấp Vò",
      "khai hoang mở cõi",
      "văn hóa lịch sử",
      "cầu ngói"
    ],
    "area": "cao-lanh",
    "address": "Xã Long Hưng A, Huyện Lấp Vò, Tỉnh Đồng Tháp (giáp ranh TP. Cao Lãnh qua cầu Cao Lãnh)",
    "coordinates": {
      "lat": 10.362,
      "lng": 105.578
    },
    "images": [
      {
        "url": "/images/destinations/cao-lanh/khu-du-lich-van-hoa-phuong-nam.jpg",
        "alt": "Khu du lịch Văn hóa Phương Nam — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:00 – 17:30 hàng ngày",
    "referencePrice": "Vé vào cổng: 50.000 VNĐ/người lớn; 30.000 VNĐ/trẻ em; Xe điện nội khu: 20.000 VNĐ",
    "contactInfo": {
      "phone": "0277 3849 888"
    },
    "estimatedVisitDuration": {
      "minutes": 90,
      "isEstimate": false,
      "note": "Tham quan đền thờ, cầu ngói Nam Phương và chụp ảnh áo dài."
    },
    "sourceUrls": [
      "https://dongthap.gov.vn"
    ],
    "publicationStatus": "published"
  },
  {
    "slug": "my-nghe-sen-viet",
    "name": "Mỹ nghệ Sen Việt",
    "summary": "Không gian sáng tạo nghệ thuật từ cây sen Đồng Tháp: tranh lá sen khô, nón lá sen, lụa tơ sen và quà lưu niệm thủ công tinh xảo.",
    "description": "Mỹ nghệ Sen Việt là nơi tôn vinh giá trị văn hóa và sức sáng tạo từ cây sen – biểu tượng của Đất Sen Hồng Đồng Tháp. Tại đây, những chiếc lá sen, gương sen và cọng sen bình dị qua bàn tay tài hoa của các nghệ nhân địa phương đã hóa thành những bức tranh lá sen ghép nghệ thuật, nón lá phủ gân sen, túi xách, quạt sen và khăn lụa tơ sen độc bản. Du khách ghé thăm không chỉ được tận mắt xem quy trình xử lý, nhuộm màu lá sen tự nhiên mà còn có thể tự tay làm sản phẩm thủ công hoặc chọn mua những món quà lưu niệm mang đậm hồn quê Đồng Tháp.",
    "category": "local_experience",
    "tags": [
      "làng nghề",
      "thủ công",
      "sen",
      "mua sắm",
      "thủ công mỹ nghệ",
      "quà lưu niệm"
    ],
    "area": "cao-lanh",
    "address": "Đường Lý Thường Kiệt, Phường 1, TP. Cao Lãnh, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.4562,
      "lng": 105.635
    },
    "images": [
      {
        "url": "/images/destinations/cao-lanh/my-nghe-sen-viet.jpg",
        "alt": "Mỹ nghệ Sen Việt — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:30 – 19:00 hàng ngày",
    "referencePrice": "Tham quan miễn phí; Quà lưu niệm từ sen: 50.000 – 500.000 VNĐ/sản phẩm",
    "estimatedVisitDuration": {
      "minutes": 60,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "van-thanh-mieu-cao-lanh",
    "name": "Văn Thánh Miếu Cao Lãnh",
    "summary": "Di tích lịch sử văn hóa hơn 160 năm tuổi tôn vinh truyền thống hiếu học và đạo lý tôn sư trọng đạo của vùng đất Cao Lãnh.",
    "description": "Được khởi dựng từ năm 1857 dưới triều vua Tự Đức, Văn Thánh Miếu Cao Lãnh là một trong số ít văn miếu cổ còn lưu giữ được ở miền Tây Nam Bộ, biểu trưng cho truyền thống hiếu học ngàn đời của người dân Đồng Tháp. Công trình nằm bên bờ hồ sen thơ mộng giữa trung tâm thành phố Cao Lãnh, nổi bật với mái ngói âm dương cổ kính, những hàng cột gỗ quý chạm khắc tinh xảo và tấm hoành phi, liễn đối sơn son thếp vàng. Khuôn viên Văn Thánh Miếu nay được quy hoạch kết hợp Công viên Văn Miếu và Phố đi bộ – Đường sách Cao Lãnh, là điểm dạo mát và tìm hiểu văn hóa tuyệt đẹp.",
    "category": "culture",
    "tags": [
      "văn hóa",
      "Nho học",
      "di tích",
      "lịch sử"
    ],
    "area": "cao-lanh",
    "address": "Đường Lý Thường Kiệt, Phường 1, TP. Cao Lãnh, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.4555,
      "lng": 105.6375
    },
    "images": [
      {
        "url": "/images/destinations/cao-lanh/van-thanh-mieu-cao-lanh.jpg",
        "alt": "Văn Thánh Miếu Cao Lãnh — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "06:00 – 21:00 hàng ngày",
    "referencePrice": "Miễn phí vé tham quan",
    "estimatedVisitDuration": {
      "minutes": 60,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "vuon-tao-ut-nhan",
    "name": "Vườn táo Út Nhàn",
    "summary": "Trải nghiệm tự tay hái những chùm táo xanh giòn ngọt trĩu cành trong nhà lưới sinh thái sạch tại Cao Lãnh.",
    "description": "Vườn táo Út Nhàn là mô hình nông nghiệp công nghệ cao kết hợp du lịch sinh thái nổi tiếng tại Cao Lãnh. Hàng trăm gốc táo hồng, táo Thái được trồng trong nhà lưới khép kín theo tiêu chuẩn VietGAP, cành nào cũng sai trĩu quả căng bóng, giòn rụm và ngọt thanh tự nhiên. Du khách đến vườn được phát giỏ để tự tay lựa chọn, cắt những trái táo tươi ngon nhất ngay trên cành, thưởng thức táo chấm muối ớt tại vườn dưới bóng mát và tìm hiểu kỹ thuật canh tác nông nghiệp hữu cơ bền vững của nhà nông Đồng Tháp.",
    "category": "local_experience",
    "tags": [
      "vườn trái cây",
      "nông nghiệp",
      "nông nghiệp sạch",
      "trải nghiệm địa phương"
    ],
    "area": "cao-lanh",
    "address": "Xã Mỹ Tân, TP. Cao Lãnh, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.4785,
      "lng": 105.629
    },
    "images": [
      {
        "url": "/images/destinations/cao-lanh/vuon-tao-ut-nhan.jpg",
        "alt": "Vườn táo Út Nhàn — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:30 – 17:00 hàng ngày",
    "referencePrice": "Vé vào vườn ăn táo tại chỗ: 30.000 VNĐ/người; Mua táo mang về: 35.000 – 50.000 VNĐ/kg",
    "estimatedVisitDuration": {
      "minutes": 60,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "vuon-thanh-long-ba-vung",
    "name": "Vườn thanh long Ba Vững",
    "summary": "Khám phá vườn thanh long ruột đỏ hữu cơ rực rỡ sắc màu và thưởng thức các món ăn, thức uống độc đáo chế biến từ thanh long.",
    "description": "Vườn thanh long Ba Vững gây ấn tượng với những hàng trụ thanh long ruột đỏ thẳng tắp, xanh mướt trải dài trên vùng đất phù sa màu mỡ huyện Cao Lãnh. Vào mùa trái chín, cả khu vườn rực lên sắc đỏ hồng bắt mắt, trở thành phông nền chụp ảnh check-in cực kỳ ấn tượng. Bên cạnh việc tham quan và tự tay thu hoạch thanh long sạch tại vườn, du khách còn được chủ vườn hiếu khách chiêu đãi nước ép thanh long mát lạnh, rượu vang thanh long lên men tự nhiên và các món ăn sáng tạo từ hoa và trái thanh long.",
    "category": "local_experience",
    "tags": [
      "thanh long",
      "nông nghiệp",
      "vườn",
      "vườn trái cây",
      "trải nghiệm nông thôn"
    ],
    "area": "cao-lanh",
    "address": "Xã Bình Hàng Trung, Huyện Cao Lãnh, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.4612,
      "lng": 105.702
    },
    "images": [
      {
        "url": "/images/destinations/cao-lanh/vuon-thanh-long-ba-vung.jpg",
        "alt": "Vườn thanh long Ba Vững — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:30 – 17:00 hàng ngày",
    "referencePrice": "Vé tham quan & thưởng thức thanh long: 30.000 VNĐ/người; Mua mang về theo giá nhà vườn",
    "estimatedVisitDuration": {
      "minutes": 60,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "co-so-nem-lai-vung-ut-thang",
    "name": "Cơ sở Nem Lai Vung Út Thẳng & Giáo Thơ",
    "summary": "Làng nghề di sản văn hóa phi vật thể quốc gia, xem quy trình gói nem lá chuối và nếm thử nem chua ngọt cay the.",
    "description": "\"Lai Vung là xứ lạ lùng / Nem chua một bọc đượm nồng tình quê\". Làng nghề làm nem Lai Vung đã tồn tại gần 70 năm và được công nhận là Di sản Văn hóa Phi vật thể Quốc gia. Cơ sở Út Thẳng và Giáo Thơ nằm dọc Quốc lộ 54 là địa chỉ dừng chân mua quà nổi tiếng nhất. Nem được làm từ thịt heo nạc đùi quết nhuyễn trộn bì heo luộc xắt sợi chỉ, gia vị tỏi, tiêu hạt và ớt hiểm xanh, gói bằng lá chùm ruột hoặc lá vông rồi bọc nhiều lớp lá chuối tươi. Sau 3 ngày lên men tự nhiên, nem có màu đỏ hồng đẹp mắt, vị chua thanh ngọt bùi cay nồng cực kỳ bắt miệng.",
    "category": "local_experience",
    "tags": [
      "nem Lai Vung",
      "làng nghề di sản",
      "đặc sản quà tặng",
      "Út Thẳng",
      "Lai Vung",
      "nem chua"
    ],
    "area": "lai-vung",
    "address": "Quốc lộ 54, Xã Tân Thành, Huyện Lai Vung, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.222,
      "lng": 105.645
    },
    "images": [
      {
        "url": "/images/destinations/lai-vung/nem-lai-vung-ut-thang.jpg",
        "alt": "Cơ sở Nem Lai Vung Út Thẳng & Giáo Thơ — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "06:30 – 21:00 hàng ngày",
    "referencePrice": "35.000 – 50.000 VNĐ/xâu 10 chiếc nem chua; Nem đòn: 60.000 – 100.000 VNĐ/đòn",
    "contactInfo": {
      "phone": "0277 3848 555"
    },
    "estimatedVisitDuration": {
      "minutes": 40,
      "isEstimate": false,
      "note": "Tham quan làm nem và mua nem chả, bì lụa về làm quà."
    },
    "sourceUrls": [
      "https://laivung.dongthap.gov.vn"
    ],
    "publicationStatus": "published"
  },
  {
    "slug": "happy-land-hung-thy",
    "name": "Happy Land Hùng Thy",
    "summary": "Tổ hợp vui chơi dân gian sông nước sôi động bậc nhất với hàng loạt trò chơi chạy xe qua cầu khỉ, đu dây, chèo xuồng và tiểu cảnh hoa.",
    "description": "Happy Land Hùng Thy là khu du lịch sinh thái kết hợp trò chơi vận động sông nước cực kỳ hút khách giới trẻ và các đoàn team building. Khuôn viên rộng lớn được thiết kế với dòng kênh xanh mát ở giữa, hai bên là những giàn hoa kiểng rực rỡ và các tiểu cảnh miền Tây xưa. Đến đây, du khách có thể thuê áo bà ba để thử sức với hơn 10 trò chơi dân gian đầy ắp tiếng cười như: đi cầu lắc, chạy xe đạp qua cầu ván, đu dây văng xuống nước, tát mương bắt cá, bơi xuồng ba lá và thưởng thức buffet bánh dân gian Nam Bộ.",
    "category": "local_experience",
    "tags": [
      "gia đình",
      "vui chơi",
      "miền quê",
      "trò chơi dân gian",
      "sinh thái",
      "team building",
      "chụp ảnh"
    ],
    "area": "lai-vung",
    "address": "Đường Cai Dao, Khóm Tân Hiệp, Phường Tân Quy Đông (trục du lịch Sa Đéc – Lai Vung), Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.3085,
      "lng": 105.7412
    },
    "images": [
      {
        "url": "/images/destinations/lai-vung/happy-land-hung-thy.jpg",
        "alt": "Happy Land Hùng Thy — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:00 – 18:00 hàng ngày",
    "referencePrice": "Vé vào cổng chụp ảnh: 50.000 VNĐ; Combo trọn gói trò chơi dân gian & áo bà ba: 120.000 – 150.000 VNĐ/người",
    "estimatedVisitDuration": {
      "minutes": 150,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "lang-nghe-chieu-dinh-yen",
    "name": "Làng nghề chiếu Định Yên",
    "summary": "Làng nghề dệt chiếu trăm năm tuổi bên sông Hậu, Di sản văn hóa phi vật thể quốc gia nổi tiếng với ký ức \"chợ ma\" Định Yên.",
    "description": "Nằm bên bờ sông Hậu hiền hòa, làng nghề dệt chiếu Định Yên đã có lịch sử hơn 100 năm và được công nhận là Di sản văn hóa phi vật thể quốc gia. Tản bộ dọc theo các con đường làng ngập tràn sắc đỏ, vàng, xanh của những bó lác phơi nắng, du khách sẽ nghe tiếng thoi đưa lách cách rộn ràng từ hàng trăm khung dệt truyền thống lẫn máy dệt trong mỗi nếp nhà. Nơi đây còn nổi tiếng với giai thoại \"chợ chiếu âm phủ\" (chợ ma Định Yên) họp dưới ánh đèn dầu lúc nửa đêm xưa kia, từng là bối cảnh chính của bộ phim điện ảnh \"Lật Mặt 6\".",
    "category": "local_experience",
    "tags": [
      "làng nghề",
      "dệt chiếu",
      "thủ công",
      "di sản quốc gia",
      "văn hóa"
    ],
    "area": "lai-vung",
    "address": "Xã Định Yên, Huyện Lấp Vò (trục du lịch giáp ranh Lai Vung), Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.3415,
      "lng": 105.592
    },
    "images": [
      {
        "url": "/images/destinations/lai-vung/lang-nghe-chieu-dinh-yen.jpg",
        "alt": "Làng nghề chiếu Định Yên — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "06:00 – 17:30 hàng ngày (đẹp nhất buổi sáng khi người dân phơi lác và dệt chiếu)",
    "referencePrice": "Tham quan hoàn toàn miễn phí; Chiếu truyền thống mua làm quà từ 100.000 – 300.000 VNĐ/đôi",
    "estimatedVisitDuration": {
      "minutes": 90,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "nem-lai-vung",
    "name": "Làng nghề nem Lai Vung",
    "summary": "Thủ phủ nem chua trứ danh miền Tây với hàng chục cơ sở làm nem truyền thống dọc Quốc lộ 54 và hương vị chua cay ngọt giòn khó cưỡng.",
    "description": "Làng nghề nem Lai Vung (xã Tân Thành và thị trấn Lai Vung) là cái nôi của món đặc sản nem chua nổi tiếng khắp cả nước, đã được ghi danh vào danh mục Di sản văn hóa phi vật thể quốc gia. Khác biệt hoàn toàn với nem chua các vùng miền khác, nem Lai Vung có màu hồng đỏ tự nhiên từ thịt đùi heo tươi quết nhuyễn trên cối đá, trộn bì heo thái sợi giòn sần sật, tiêu hạt, tỏi xắt lát và lá vông nem (hoặc lá chùm ruột), gói vuông vức trong lớp lá chuối xanh mướt. Du khách ghé thăm làng nghề sẽ được xem các nghệ nhân gói nem thoăn thoắt và thưởng thức nem chua, bì, chả lụa ngay tại lò.",
    "category": "food",
    "tags": [
      "làng nghề",
      "đặc sản",
      "trải nghiệm địa phương",
      "nem Lai Vung",
      "ẩm thực"
    ],
    "area": "lai-vung",
    "address": "Dọc Quốc lộ 54, Xã Tân Thành & Thị trấn Lai Vung, Huyện Lai Vung, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.2865,
      "lng": 105.661
    },
    "images": [
      {
        "url": "/images/destinations/lai-vung/lang-nghe-nem-lai-vung.jpg",
        "alt": "Làng nghề nem Lai Vung — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "06:00 – 20:30 hàng ngày",
    "referencePrice": "Tham quan và ăn thử miễn phí; Giá nem chua từ 35.000 – 50.000 VNĐ/chùm 10 chiếc",
    "estimatedVisitDuration": {
      "minutes": 45,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "vuon-quyt-hong-ba-lien",
    "name": "Vườn quýt hồng Ba Liên",
    "summary": "Thiên đường quýt hồng trĩu quả vàng cam rực rỡ mỗi độ xuân về tại \"vương quốc quýt hồng\" Lai Vung.",
    "description": "Huyện Lai Vung từ lâu được mệnh danh là \"Vương quốc quýt hồng\" của miền Tây, và Vườn quýt hồng Ba Liên là một trong những nhà vườn tiêu biểu, lâu đời và đẹp nhất khu vực. Nhờ thổ nhưỡng đất sét pha cát ven sông Hậu, những cây quýt hồng tại đây cho trái to tròn, vỏ mỏng bóng mượt chuyển sắc cam đỏ rực rỡ từ tháng 11 âm lịch đến Tết Nguyên Đán. Bước chân vào vườn, du khách như lạc vào mê cung trái ngọt, thỏa sức chụp ảnh dưới những tán quýt trĩu cành và thưởng thức những múi quýt mọng nước, thơm lừng và ngọt đậm đà ngay tại gốc.",
    "category": "local_experience",
    "tags": [
      "quýt hồng",
      "nông nghiệp",
      "đặc sản",
      "vườn trái cây",
      "Lai Vung",
      "chụp ảnh"
    ],
    "area": "lai-vung",
    "address": "Xã Long Hậu, Huyện Lai Vung, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.264,
      "lng": 105.6485
    },
    "images": [
      {
        "url": "/images/destinations/lai-vung/vuon-quyt-hong-ba-lien.jpg",
        "alt": "Vườn quýt hồng Ba Liên — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:00 – 17:00 hàng ngày (mùa quýt chín đẹp nhất từ tháng 12 đến tháng 2 dương lịch)",
    "referencePrice": "Vé vào vườn tham quan & ăn quýt: 50.000 VNĐ/người lớn, 30.000 VNĐ/trẻ em; Quýt mua về: 60.000 – 80.000 VNĐ/kg",
    "estimatedVisitDuration": {
      "minutes": 90,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "chao-ca-loc-rau-dang-my-tho",
    "name": "Quán Cháo Cá lóc Rau đắng Chợ Vòng Nhỏ",
    "summary": "Thưởng thức tô cháo cá lóc đồng rau đắng đất trứ danh được các YouTuber ẩm thực săn lùng.",
    "description": "Nằm trên đường Lê Thị Hồng Gấm gần Chợ Vòng Nhỏ (Phường 4, Mỹ Tho), các hàng cháo cá lóc rau đắng ở đây nức tiếng bao thế hệ người sành ăn sông Tiền. Cá lóc đồng tươi sống thịt chắc nịch được luộc chín, lọc sạch xương, xào sơ hành thơm. Tô cháo hoa bung đều nóng rẫy được múc ra bát, rắc thêm tiêu sọ, gừng xắt chỉ và hành hoa. Ăn kèm đĩa rau đắng đất mọc hoang dại giòn giòn nhân nhẫn đầu lưỡi nhưng để lại hậu vị ngọt sâu khó quên, chấm cùng chén nước mắm nhĩ dầm ớt hiểm cay nồng.",
    "category": "food",
    "tags": [
      "cháo cá lóc",
      "rau đắng đất",
      "chợ Vòng Nhỏ",
      "đặc sản Mỹ Tho",
      "quán local",
      "ẩm thực đêm"
    ],
    "area": "my-tho",
    "address": "Khu vực Chợ Vòng Nhỏ, Đường Lê Thị Hồng Gấm, Phường 4, TP. Mỹ Tho",
    "coordinates": {
      "lat": 10.354,
      "lng": 106.353
    },
    "images": [
      {
        "url": "/images/destinations/my-tho/chao-ca-loc-rau-dang-cho-vong-nho.jpg",
        "alt": "Quán Cháo Cá lóc Rau đắng Chợ Vòng Nhỏ — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "15:00 – 23:00 hàng ngày",
    "referencePrice": "30.000 – 50.000 VNĐ/tô cháo cá lóc đặc biệt (kèm đầu cá hoặc trứng cá)",
    "contactInfo": {
      "phone": "0939 123 456"
    },
    "estimatedVisitDuration": {
      "minutes": 45,
      "isEstimate": false,
      "note": "Bán ngon nhất vào buổi xế chiều và tối (15:00 – 22:30)."
    },
    "sourceUrls": [
      "https://dulichtiengiang.gov.vn"
    ],
    "publicationStatus": "published"
  },
  {
    "slug": "cho-dem-bo-ke-my-tho",
    "name": "Phố Ẩm thực & Chợ đêm Bờ kè Sông Tiền Mỹ Tho",
    "summary": "Không gian ẩm thực đường phố sôi động gió sông lộng mát với món Bánh vá (bánh cóng), bánh bèo và nước mía sầu riêng.",
    "description": "Kéo dài dọc theo đường 30 Tháng 4 và đường Trưng Trắc sát bờ sông Tiền đối diện cù lao Thới Sơn, phố đêm Mỹ Tho là nơi nhộn nhịp nhất thành phố khi màn đêm buông xuống. Du khách vừa tản bộ hóng gió sông Tiền lồng lộng vừa thưởng thức món Bánh vá Giồng Dứa (bánh cóng tôm thịt giòn rụm), đĩa bánh bèo nước cốt dừa béo bùi, nghêu sò ốc hến tươi rói xào sa tế và ly nước mía sầu riêng thơm nức mũi.",
    "category": "food",
    "tags": [
      "chợ đêm",
      "bờ kè sông Tiền",
      "bánh cóng",
      "bánh vá",
      "ẩm thực đêm",
      "dạo phố"
    ],
    "area": "my-tho",
    "address": "Đường 30 Tháng 4 & Đường Trưng Trắc, Phường 1, TP. Mỹ Tho",
    "coordinates": {
      "lat": 10.352,
      "lng": 106.364
    },
    "images": [
      {
        "url": "/images/destinations/my-tho/cho-dem-bo-ke-song-tien-my-tho.jpg",
        "alt": "Phố Ẩm thực & Chợ đêm Bờ kè Sông Tiền Mỹ Tho — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "17:00 – 23:30 hàng ngày",
    "referencePrice": "Món ăn vặt từ 15.000 – 50.000 VNĐ; Ốc và hải sản từ 50.000 – 120.000 VNĐ/đĩa",
    "contactInfo": {
      "phone": "0273 3888 777"
    },
    "estimatedVisitDuration": {
      "minutes": 90,
      "isEstimate": false,
      "note": "Đẹp nhất từ 18:30 đến 22:00."
    },
    "sourceUrls": [
      "https://dulichtiengiang.gov.vn"
    ],
    "publicationStatus": "published"
  },
  {
    "slug": "cho-my-tho",
    "name": "Chợ Mỹ Tho",
    "summary": "Ngôi chợ truyền thống sầm uất hơn trăm năm tuổi bên dòng Bảo Định, thiên đường trái cây miệt vườn và ẩm thực bản địa Mỹ Tho.",
    "description": "Nằm ngay trung tâm phố cổ Mỹ Tho bên bờ sông Bảo Định, Chợ Mỹ Tho (Chợ Lớn Mỹ Tho) là trung tâm giao thương sầm uất gắn liền với lịch sử đô thị Mỹ Tho Đại Phố. Ngôi chợ là nơi hội tụ đủ mọi sản vật tinh túy của vùng sông Tiền: từ các sạp trái cây miệt vườn tươi rói (vú sữa Lò Rèn, sầu riêng Ngũ Hiệp, xoài cát Hòa Lộc, nhãn Thới Sơn) cho đến khu khô mắm, hải sản và bánh dân gian. Đặc biệt, khu ẩm thực trong lòng chợ là thiên đường ăn vặt với hủ tiếu Mỹ Tho, bún gỏi già, bánh bèo chợ Hàng Bông và các loại chè truyền thống thơm béo.",
    "category": "food",
    "tags": [
      "chợ",
      "mua sắm",
      "đặc sản",
      "chợ truyền thống",
      "ẩm thực",
      "Mỹ Tho"
    ],
    "area": "my-tho",
    "address": "Đường Đinh Bộ Lĩnh, Phường 1, TP. Mỹ Tho, Tỉnh Tiền Giang",
    "coordinates": {
      "lat": 10.3558,
      "lng": 106.3642
    },
    "images": [
      {
        "url": "/images/destinations/my-tho/cho-my-tho.jpg",
        "alt": "Chợ Mỹ Tho — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "05:00 – 19:00 hàng ngày",
    "referencePrice": "Vào chợ tự do; Ăn uống bình dân từ 20.000 – 50.000 VNĐ/món",
    "estimatedVisitDuration": {
      "minutes": 60,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "chua-buu-lam-co-tu",
    "name": "Chùa Bửu Lâm Cổ Tự",
    "summary": "Di tích lịch sử văn hóa cấp Quốc gia hơn 200 năm tuổi với nghệ thuật chạm khắc gỗ tinh xảo bậc nhất vùng Mỹ Tho.",
    "description": "Chùa Bửu Lâm (tục gọi là Chùa Tổ) tọa lạc tại Phường 3, TP. Mỹ Tho, được hình thành từ thế kỷ XVIII và đại trùng tu vào năm 1803, là một trong những ngôi cổ tự lâu đời nhất vùng đất Tiền Giang. Ngôi chùa được công nhận là Di tích Lịch sử – Văn hóa cấp Quốc gia nhờ giữ nguyên vẹn kiến trúc chữ Tam cổ kính cùng hệ thống bao lam, hoành phi, liễn đối và tượng Phật bằng gỗ mít chạm trổ hoa văn tứ linh, tứ quý vô cùng sắc sảo. Trong kháng chiến, chùa còn là cơ sở cách mạng bí mật của các chí sĩ yêu nước.",
    "category": "culture",
    "tags": [
      "chùa",
      "tâm linh",
      "văn hóa",
      "chùa cổ",
      "di tích quốc gia",
      "kiến trúc"
    ],
    "area": "my-tho",
    "address": "Số 152 Đường Nguyễn Hội, Phường 3, TP. Mỹ Tho, Tỉnh Tiền Giang",
    "coordinates": {
      "lat": 10.3618,
      "lng": 106.3692
    },
    "images": [
      {
        "url": "/images/destinations/my-tho/chua-buu-lam-co-tu.jpg",
        "alt": "Chùa Bửu Lâm Cổ Tự — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "06:30 – 18:00 hàng ngày",
    "referencePrice": "Miễn phí vé tham quan và chiêm bái",
    "estimatedVisitDuration": {
      "minutes": 60,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "chua-sac-tu-linh-thuu",
    "name": "Chùa Sắc Tứ Linh Thứu",
    "summary": "Ngôi cổ tự danh tiếng được vua Gia Long ban biển \"Sắc Tứ\", lưu giữ đại hồng chung cổ và những pho tượng quý hàng trăm năm.",
    "description": "Chùa Sắc Tứ Linh Thứu nằm bên dòng sông Bảo Định hiền hòa tại huyện Châu Thành (sát ranh TP. Mỹ Tho), được Thiền sư Nguyễn Phước Kiển khai sơn vào giữa thế kỷ XVIII. Tương truyền vào năm 1785, Nguyễn Ánh từng ẩn náu tại chùa và sau khi lên ngôi hoàng đế đã ban tặng tấm biển \"Sắc Tứ Linh Thứu Tự\" sơn son thếp vàng cùng nhiều lễ vật quý. Chùa hiện là Di tích cấp Quốc gia, nổi tiếng với kiến trúc cổ Nam Bộ thâm nghiêm, chiếc đại hồng chung đúc từ thời vua Gia Long và hệ thống tháp mộ cổ bằng đá xanh rêu phong.",
    "category": "culture",
    "tags": [
      "chùa",
      "Phật giáo",
      "kiến trúc",
      "cổ tự",
      "lịch sử",
      "tâm linh",
      "di tích quốc gia"
    ],
    "area": "my-tho",
    "address": "Ấp Chợ, Xã Thạnh Phú, Huyện Châu Thành (giáp ranh TP. Mỹ Tho), Tỉnh Tiền Giang",
    "coordinates": {
      "lat": 10.3785,
      "lng": 106.331
    },
    "images": [
      {
        "url": "/images/destinations/my-tho/chua-sac-tu-linh-thuu.jpg",
        "alt": "Chùa Sắc Tứ Linh Thứu — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "06:30 – 18:00 hàng ngày",
    "referencePrice": "Miễn phí vé tham quan",
    "estimatedVisitDuration": {
      "minutes": 60,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "chua-vinh-trang-my-tho",
    "name": "Chùa Vĩnh Tràng Mỹ Tho",
    "summary": "Ngôi chùa cổ danh tiếng bậc nhất miền Tây với pho tượng Phật Di Lặc khổng lồ và kiến trúc giao thoa Đông – Tây kỳ vĩ.",
    "description": "Chùa Vĩnh Tràng (khởi dựng đầu thế kỷ XIX) là ngôi đại tự lớn nhất tỉnh Tiền Giang, được công nhận là Di tích Lịch sử – Văn hóa cấp quốc gia. Kiến trúc ngôi chùa là sự kết hợp tuyệt mỹ giữa nét hoa văn Pháp, vòm cửa La Mã, tháp gốm Phục Hưng hòa cùng hoa văn rồng phượng cung đình Huế và mái ngói uốn cong truyền thống Nam Bộ. Khuôn viên rộng 2ha rợp mát bóng cây cổ thụ nổi bật với 3 pho đại tượng Phật khổng lồ: Phật A Di Đà đứng cao 24m, Phật Thích Ca nhập niết bàn dài 32m và tượng Phật Di Lặc từ bi cười rạng rỡ cao 20m.",
    "category": "culture",
    "tags": [
      "chùa Vĩnh Tràng",
      "kiến trúc cổ",
      "Phật Di Lặc",
      "di tích quốc gia",
      "tâm linh",
      "Mỹ Tho"
    ],
    "area": "my-tho",
    "address": "Đường Nguyễn Trung Trực, Ấp Mỹ An, Xã Mỹ Phong, TP. Mỹ Tho, Tỉnh Đồng Tháp / Tiền Giang",
    "coordinates": {
      "lat": 10.3625,
      "lng": 106.3768
    },
    "images": [
      {
        "url": "/images/destinations/my-tho/chua-vinh-trang-my-tho.jpg",
        "alt": "Chùa Vĩnh Tràng Mỹ Tho — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "06:30 – 18:30 hàng ngày",
    "referencePrice": "Miễn phí vé vào cổng chiêm bái và vãn cảnh chùa",
    "contactInfo": {
      "phone": "0273 3873 427"
    },
    "estimatedVisitDuration": {
      "minutes": 75,
      "isEstimate": false,
      "note": "Tham quan đại điện, vườn tháp và chiêm bái đại tượng Phật."
    },
    "sourceUrls": [
      "https://vi.wikipedia.org/wiki/Ch%C3%B9a_V%C4%A9nh_Tr%C3%A0ng"
    ],
    "publicationStatus": "published"
  },
  {
    "slug": "con-phung",
    "name": "Cồn Phụng",
    "summary": "Ốc đảo xanh nổi giữa dòng sông Tiền gắn với cụm kiến trúc Đạo Dừa độc đáo và các trò chơi sông nước miệt vườn sôi động.",
    "description": "Nằm song song với Cù lao Thới Sơn ngay dưới chân cầu Rạch Miễu trên dòng sông Tiền, Cồn Phụng (Cù lao Đạo Dừa) là điểm kết nối không thể thiếu trong hành trình du ngoạn tứ linh (Long – Lân – Quy – Phụng) xuất phát từ bến tàu 30/4 Mỹ Tho. Đến Cồn Phụng, du khách được khám phá Di tích Đạo Dừa với sân chín rồng, tháp Hòa Bình ghép từ hàng vạn mảnh sành sứ độc lạ, tham quan xưởng làm kẹo dừa thủ công, trải nghiệm câu cá sấu, cho cá bú bình và tham gia các trò chơi nước vui nhộn.",
    "category": "eco",
    "tags": [
      "sông nước",
      "cần xác minh",
      "cù lao",
      "Đạo Dừa",
      "sinh thái"
    ],
    "area": "my-tho",
    "address": "Bến tàu du lịch 30/4 Mỹ Tho kết nối qua sông Tiền đến Cồn Phụng",
    "coordinates": {
      "lat": 10.3352,
      "lng": 106.3698
    },
    "images": [
      {
        "url": "/images/destinations/my-tho/con-phung.jpg",
        "alt": "Cồn Phụng — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:30 – 18:00 hàng ngày",
    "referencePrice": "Vé cổng Cồn Phụng: 50.000 VNĐ/người; Thường đi kèm tour thuyền từ bến tàu Mỹ Tho",
    "estimatedVisitDuration": {
      "minutes": 120,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "con-thoi-son",
    "name": "Cồn Thới Sơn",
    "summary": "Hòn ngọc sinh thái miệt vườn giữa sông Tiền với những con rạch dừa nước rợp bóng, vườn cây ăn trái bốn mùa và đờn ca tài tử.",
    "description": "Cồn Thới Sơn (Cồn Lân) là cù lao lớn nhất trong bộ tứ cù lao Long – Lân – Quy – Phụng trên sông Tiền, thuộc xã Thới Sơn, TP. Mỹ Tho. Được phù sa sông Tiền bồi đắp quanh năm, Cồn Thới Sơn phủ một màu xanh mướt của những vườn nhãn xuồng, bưởi da xanh, mít và dừa nước. Du khách đến đây sẽ được ngồi xuồng ba lá do các cô gái mặc áo bà ba chèo khéo léo qua con rạch nhỏ uốn lượn, ghé nhà vườn thưởng thức trái cây theo mùa, uống trà mật ong tắc ấm nóng, nghe giai điệu đờn ca tài tử Nam Bộ ngọt ngào và đi xe ngựa dạo quanh đường làng.",
    "category": "eco",
    "tags": [
      "trải nghiệm địa phương",
      "ẩm thực",
      "miệt vườn",
      "đò chèo",
      "đờn ca tài tử",
      "sinh thái"
    ],
    "area": "my-tho",
    "address": "Xã Thới Sơn, TP. Mỹ Tho, Tỉnh Tiền Giang",
    "coordinates": {
      "lat": 10.343,
      "lng": 106.356
    },
    "images": [
      {
        "url": "/images/destinations/my-tho/con-thoi-son.jpg",
        "alt": "Cồn Thới Sơn — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:00 – 18:00 hàng ngày",
    "referencePrice": "Tham quan đường bộ qua cầu Rạch Miễu miễn phí; Trọn gói đò chèo – trái cây – đờn ca tài tử: 80.000 – 120.000 VNĐ/khách",
    "estimatedVisitDuration": {
      "minutes": 150,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "dinh-long-hung",
    "name": "Đình Long Hưng",
    "summary": "Di tích lịch sử quốc gia gắn với cuộc Khởi nghĩa Nam Kỳ 1940, nơi lần đầu tiên lá cờ đỏ sao vàng tung bay trên đất Nam Bộ.",
    "description": "Đình Long Hưng tọa lạc tại xã Long Hưng, huyện Châu Thành (sát TP. Mỹ Tho), là công trình kiến trúc đình làng cổ kính đồng thời là Di tích Lịch sử – Văn hóa cấp Quốc gia đặc biệt quan trọng. Nơi đây từng là trụ sở của Ủy ban Khởi nghĩa tỉnh Mỹ Tho trong cuộc Khởi nghĩa Nam Kỳ lịch sử ngày 23/11/1940 và là nơi lá cờ đỏ sao vàng lần đầu tiên được treo lên ngọn cây bàng cổ thụ trước sân đình. Khu di tích gồm ngôi đình cổ chạm khắc tinh xảo, cây bàng lịch sử hơn trăm năm tuổi, nhà trưng bày hiện vật và ngôi nhà sàn tái hiện không gian sinh hoạt xưa.",
    "category": "history",
    "tags": [
      "đình làng",
      "lịch sử",
      "tín ngưỡng",
      "di tích lịch sử",
      "Khởi nghĩa Nam Kỳ",
      "văn hóa"
    ],
    "area": "my-tho",
    "address": "Ấp Long Thạnh, Xã Long Hưng, Huyện Châu Thành (giáp ranh TP. Mỹ Tho), Tỉnh Tiền Giang",
    "coordinates": {
      "lat": 10.368,
      "lng": 106.298
    },
    "images": [
      {
        "url": "/images/destinations/my-tho/dinh-long-hung.jpg",
        "alt": "Đình Long Hưng — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:30 – 17:00 hàng ngày",
    "referencePrice": "Miễn phí vé tham quan",
    "estimatedVisitDuration": {
      "minutes": 60,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "hu-tieu-my-tho-trung-luong",
    "name": "Quán Hủ tiếu Mỹ Tho Cô Dung & Ngã Ba Trung Lương",
    "summary": "Món ngon di sản ẩm thực quốc gia với sợi hủ tiếu dai giòn độc nhất vô nhị, nước lèo tôm khô xương ống ngọt đậm.",
    "description": "Hủ tiếu Mỹ Tho là niềm tự hào ẩm thực của người dân đồng bằng sông Cửu Long, được chế biến từ loại gạo Gò Cát (Mỹ Phong) cho ra sợi hủ tiếu trắng ngà, dai giòn sần sật không bị bở khi gặp nước sôi. Quán Cô Dung (37A Hùng Vương) và các quán hủ tiếu truyền thống khu vực ngã ba Trung Lương nổi tiếng với tô hủ tiếu khô trộn nước sốt tương đậm đà, bên trên phủ đầy thịt xá xíu thái mỏng, sườn non ninh nhừ, tôm tươi bóc vỏ, gan heo, trứng cút và tóp mỡ hành phi giòn tan, kèm tô nước súp xương hầm với củ cải và mực nướng ngọt thanh.",
    "category": "food",
    "tags": [
      "hủ tiếu Mỹ Tho",
      "hủ tiếu khô",
      "ẩm thực trứ danh",
      "ngon nức tiếng",
      "đặc sản miền Tây",
      "ăn sáng"
    ],
    "area": "my-tho",
    "address": "Số 37A Đường Hùng Vương, Phường 1, TP. Mỹ Tho (hoặc khu vực vòng xoay Trung Lương)",
    "coordinates": {
      "lat": 10.359,
      "lng": 106.362
    },
    "images": [
      {
        "url": "/images/destinations/my-tho/hu-tieu-my-tho-co-dung.jpg",
        "alt": "Quán Hủ tiếu Mỹ Tho Cô Dung & Ngã Ba Trung Lương — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "06:00 – 21:30 hàng ngày",
    "referencePrice": "40.000 – 65.000 VNĐ/tô thập cẩm đặc biệt",
    "contactInfo": {
      "phone": "0273 3872 111"
    },
    "estimatedVisitDuration": {
      "minutes": 45,
      "isEstimate": false,
      "note": "Ăn sáng hoặc ăn tối đều rất ngon."
    },
    "sourceUrls": [
      "https://dulichtiengiang.gov.vn"
    ],
    "publicationStatus": "published"
  },
  {
    "slug": "thien-vien-truc-lam-chanh-giac",
    "name": "Thiền viện Trúc Lâm Chánh Giác",
    "summary": "Được mệnh danh là \"Tiểu Ấn Độ\" giữa vùng Đồng Tháp Mười với bảo tháp Giác Ngộ trắng muốt cao 31m và quần thể Tứ Động Tâm uy nghiêm.",
    "description": "Tọa lạc giữa vùng đất trũng Tân Phước thuộc tiểu vùng Đồng Tháp Mười (cách TP. Mỹ Tho khoảng 30km), Thiền viện Trúc Lâm Chánh Giác là một trong những thiền viện lớn nhất Việt Nam với diện tích hơn 50ha. Điểm nhấn kiến trúc làm say lòng du khách là khu Tứ Động Tâm được xây dựng theo nguyên mẫu bốn thánh tích Phật giáo tại Ấn Độ và Nepal, nổi bật nhất là Tháp Giác Ngộ (Đại Giác Tự) cao 31m sơn trắng tinh khôi chạm khắc hoa văn tinh mỹ. Không gian thiền viện thanh tịnh, trầm mặc giữa bốn bề rừng tràm và đầm sen mang lại cảm giác an nhiên tuyệt đối.",
    "category": "culture",
    "tags": [
      "Phật giáo",
      "thiền viện",
      "tâm linh",
      "kiến trúc",
      "Tứ Động Tâm"
    ],
    "area": "my-tho",
    "address": "Ấp 1, Xã Thạnh Tân, Huyện Tân Phước (cụm du lịch Mỹ Tho – Đồng Tháp Mười), Tỉnh Tiền Giang",
    "coordinates": {
      "lat": 10.5642,
      "lng": 106.185
    },
    "images": [
      {
        "url": "/images/destinations/my-tho/thien-vien-truc-lam-chanh-giac.jpg",
        "alt": "Thiền viện Trúc Lâm Chánh Giác — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:00 – 17:30 hàng ngày",
    "referencePrice": "Miễn phí vé vào cổng và gửi xe",
    "estimatedVisitDuration": {
      "minutes": 120,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "trai-ran-dong-tam",
    "name": "Trại Rắn Đồng Tâm (Trung tâm Dược liệu Quân khu 9)",
    "summary": "Vương quốc bò sát và trung tâm bảo tồn rắn độc lớn nhất Việt Nam phục vụ y học cứu người.",
    "description": "Cách trung tâm Mỹ Tho khoảng 9km về phía tây bên bờ sông Tiền, Trại rắn Đồng Tâm rộng 12ha là bảo tàng sinh thái bò sát độc nhất vô nhị ở Đông Nam Á. Nơi đây nuôi dưỡng hàng ngàn cá thể rắn thuộc hơn 40 loài khác nhau từ rắn hổ mang chúa dài hơn 4 mét, trăn gấm, rắn lục đuôi đỏ đến các loài chim, vượn và thú quý hiếm. Du khách sẽ được các chiến sĩ hướng dẫn viên giải thích quy trình lấy nọc rắn điều chế huyết thanh cứu người, tham quan bảo tàng mẫu ngâm và vườn thảo dược quý.",
    "category": "eco",
    "tags": [
      "trại rắn",
      "bò sát",
      "bảo tồn",
      "sinh thái",
      "khám phá",
      "Đồng Tâm"
    ],
    "area": "my-tho",
    "address": "Ấp Tân Thuận B, Xã Bình Đức, Huyện Châu Thành (sát ranh TP. Mỹ Tho)",
    "coordinates": {
      "lat": 10.347,
      "lng": 106.289
    },
    "images": [
      {
        "url": "/images/destinations/my-tho/trai-ran-dong-tam.jpg",
        "alt": "Trại Rắn Đồng Tâm (Trung tâm Dược liệu Quân khu 9) — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:00 – 17:00 hàng ngày",
    "referencePrice": "Vé vào cổng: 30.000 VNĐ/trẻ em, 50.000 VNĐ/người lớn",
    "contactInfo": {
      "phone": "0273 3853 205"
    },
    "estimatedVisitDuration": {
      "minutes": 90,
      "isEstimate": false,
      "note": "Phù hợp gia đình có trẻ em khám phá thế giới sinh học."
    },
    "sourceUrls": [
      "https://dulichtiengiang.gov.vn"
    ],
    "publicationStatus": "published"
  },
  {
    "slug": "cho-sa-dec",
    "name": "Chợ Sa Đéc",
    "summary": "Khu chợ cổ kính chạy dọc bờ sông Sa Đéc với dãy phố kiến trúc Pháp, trung tâm ẩm thực và nông sản trù phú của thành phố hoa.",
    "description": "Chợ Sa Đéc nằm trải dài bên bờ sông Sa Đéc thơ mộng, ngay cạnh phố cổ Nguyễn Huệ và Nhà cổ Huỳnh Thủy Lê. Đây là một trong những ngôi chợ đẹp và giàu bản sắc nhất miền Tây, nơi những dãy nhà phố cổ thời Pháp thuộc vàng ươm soi bóng xuống dòng sông tấp nập ghe xuồng. Dạo chợ Sa Đéc vào buổi sáng sớm, du khách sẽ bị cuốn hút bởi vô vàn sản vật địa phương: từ các loại cá đồng tươi rói, hoa tươi rực rỡ, bánh phồng tôm Sa Giang cho đến những hàng hủ tiếu Sa Đéc, bánh tằm bì nước cốt dừa và chè bà ba thơm nức mũi.",
    "category": "food",
    "tags": [
      "chợ",
      "đặc sản",
      "mua sắm",
      "chợ truyền thống",
      "phố cổ",
      "ẩm thực",
      "Sa Đéc"
    ],
    "area": "sa-dec",
    "address": "Đường Trần Hưng Đạo & Đường Nguyễn Huệ, Phường 1, TP. Sa Đéc, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.2928,
      "lng": 105.7638
    },
    "images": [
      {
        "url": "/images/destinations/sa-dec/cho-sa-dec.jpg",
        "alt": "Chợ Sa Đéc — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "05:00 – 19:00 hàng ngày",
    "referencePrice": "Tham quan tự do; Ẩm thực chợ từ 15.000 – 45.000 VNĐ/phần",
    "estimatedVisitDuration": {
      "minutes": 60,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "chua-phuoc-kien-la-sen-vua",
    "name": "Chùa Phước Kiển (Chùa Lá Sen Vua)",
    "summary": "Ngôi chùa cổ linh thiêng nổi tiếng với ao sen khổng lồ có lá cõng được người lớn nặng tới 80kg.",
    "description": "Chùa Phước Kiển (hay còn gọi là Chùa Lá Sen) được xây dựng từ thời vua Thiệu Trị tại huyện Châu Thành, Đồng Tháp. Điểm kỳ lạ và thu hút du khách khắp nơi đổ về chiêm bái là ao sen vua (Victoria Regia). Lá sen có đường kính từ 2 mét đến gần 3 mét, vành lá uốn cong lên 4-5cm như chiếc nón quai thao khổng lồ bập bềnh trên mặt nước. Du khách có thể bước lên tấm mâm gỗ đặt trên lá sen để chụp những bức ảnh độc nhất vô nhị mà lá sen vẫn không hề chìm.",
    "category": "culture",
    "tags": [
      "chùa cổ",
      "lá sen vua",
      "kỳ quan",
      "check-in độc lạ",
      "tâm linh",
      "Châu Thành"
    ],
    "area": "sa-dec",
    "address": "Xã Hòa Tân, Huyện Châu Thành, Tỉnh Đồng Tháp (cách Sa Đéc khoảng 15km)",
    "coordinates": {
      "lat": 10.2312,
      "lng": 105.815
    },
    "images": [
      {
        "url": "/images/destinations/sa-dec/chua-la-sen-phuoc-kien.jpg",
        "alt": "Chùa Phước Kiển (Chùa Lá Sen Vua) — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:00 – 18:00 hàng ngày",
    "referencePrice": "Vào chùa miễn phí; Phí chụp ảnh đứng lên lá sen: 20.000 – 30.000 VNĐ/người (ủng hộ nhà chùa)",
    "contactInfo": {
      "phone": "0277 3842 119"
    },
    "estimatedVisitDuration": {
      "minutes": 60,
      "isEstimate": false,
      "note": "Thích hợp đi vào ban ngày lúc trời sáng rõ để chụp ảnh lá sen."
    },
    "sourceUrls": [
      "https://dongthap.gov.vn"
    ],
    "publicationStatus": "published"
  },
  {
    "slug": "diem-am-thuc-hoa-hong-thi-tho",
    "name": "Điểm ẩm thực Hoa hồng Thi Thơ",
    "summary": "Không gian ẩm thực sân vườn giữa lòng Làng hoa Sa Đéc, nơi thưởng thức các món ăn chế biến từ hoa và đặc sản miền Tây.",
    "description": "Nằm trên trục đường hoa nhộn nhịp của TP. Sa Đéc, Điểm ẩm thực Hoa hồng Thi Thơ kết hợp hài hòa giữa vườn hoa hồng kiểng rực rỡ và không gian nhà hàng chòi lá thoáng mát. Sau khi dạo bước chụp ảnh cùng hàng trăm gốc hồng nhung, hồng cổ Sa Đéc ngát hương, du khách có thể dừng chân thưởng thức những món ăn mang hương vị đồng quê đặc sắc như cá tai tượng chiên xù, gỏi cánh hoa hồng tôm thịt, lẩu cua đồng, gà hấp rượu và nhâm nhi tách trà hoa hồng thanh mát.",
    "category": "food",
    "tags": [
      "ẩm thực",
      "hoa hồng",
      "địa phương",
      "nhà vườn",
      "Sa Đéc"
    ],
    "area": "sa-dec",
    "address": "Phường Tân Quy Đông, TP. Sa Đéc, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.3125,
      "lng": 105.7485
    },
    "images": [
      {
        "url": "/images/destinations/sa-dec/diem-am-thuc-hoa-hong-thi-tho.jpg",
        "alt": "Điểm ẩm thực Hoa hồng Thi Thơ — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:30 – 20:30 hàng ngày",
    "referencePrice": "Chi phí ăn uống trung bình: 100.000 – 200.000 VNĐ/người",
    "estimatedVisitDuration": {
      "minutes": 90,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "hu-tieu-phu-thanh-sa-dec",
    "name": "Quán Hủ tiếu Phú Thành Sa Đéc",
    "summary": "Quán hủ tiếu khô nước sốt gia truyền nổi tiếng sang trọng và chuẩn vị bậc nhất thành phố hoa.",
    "description": "Hủ tiếu Phú Thành là điểm dừng chân ẩm thực cao cấp và danh tiếng tại Sa Đéc, không gian khang trang sạch sẽ với bãi đỗ xe thuận tiện. Món \"vedette\" của quán là Hủ tiếu khô Sa Đéc: từng sợi hủ tiếu bột tươi được chần qua nước sôi vừa tới, trộn đều với nước sốt chua ngọt màu nâu sẫm bí truyền sánh quyện, bên trên phủ ngập sườn non mềm rục, tim, gan, xá xíu thái mỏng và tôm tươi sông Tiền. Khi ăn rắc thêm cần tây và hẹ hoa, cắn thêm miếng ớt sừng cay xè thì tuyệt đỉnh phong vị.",
    "category": "food",
    "tags": [
      "hủ tiếu khô Phú Thành",
      "hủ tiếu Sa Đéc",
      "quán nổi tiếng",
      "ẩm thực sạch sẽ",
      "Sa Đéc"
    ],
    "area": "sa-dec",
    "address": "Số 75 Đường Trần Hưng Đạo, Phường 1, TP. Sa Đéc, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.2965,
      "lng": 105.761
    },
    "images": [
      {
        "url": "/images/destinations/sa-dec/hu-tieu-phu-thanh-sa-dec.jpg",
        "alt": "Quán Hủ tiếu Phú Thành Sa Đéc — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "06:00 – 22:00 hàng ngày",
    "referencePrice": "35.000 – 60.000 VNĐ/tô",
    "contactInfo": {
      "phone": "0277 3863 777"
    },
    "estimatedVisitDuration": {
      "minutes": 45,
      "isEstimate": false,
      "note": "Rất thích hợp cho gia đình và đoàn khách du lịch."
    },
    "sourceUrls": [
      "https://sadec.dongthap.gov.vn"
    ],
    "publicationStatus": "published"
  },
  {
    "slug": "hu-tieu-sa-dec-ba-sam",
    "name": "Quán Hủ tiếu Sa Đéc Bà Sẩm (Hơn 50 năm truyền thống)",
    "summary": "Hàng hủ tiếu bình dân lâu đời nhất Sa Đéc, giữ trọn hương vị bột gạo truyền thống với giá siêu yêu thương.",
    "description": "Nhắc đến hủ tiếu Sa Đéc trên TikTok và các kênh du lịch miền Tây, tiệm hủ tiếu Bà Sẩm trên đường Trần Hưng Đạo luôn là cái tên đứng đầu danh sách đề xuất. Trải qua hơn nửa thế kỷ cha truyền con nối, quán vẫn giữ mức giá bình dân mộc mạc phục vụ từ người lao động đến du khách thập phương. Điểm đặc trưng làm nên thương hiệu là bánh hủ tiếu sợi to bản vừa phải, làm từ bột gạo lọc Sa Đéc trứ danh nên dẻo thơm tự nhiên, chan nước lèo xương ống ninh trong vắt ngọt thanh tao.",
    "category": "food",
    "tags": [
      "hủ tiếu Sa Đéc",
      "bà Sẩm",
      "quán gia truyền",
      "ẩm thực local",
      "bột gạo Sa Đéc",
      "ăn sáng"
    ],
    "area": "sa-dec",
    "address": "Số 188 Đường Trần Hưng Đạo, Khóm 1, Phường 1, TP. Sa Đéc, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.2982,
      "lng": 105.7595
    },
    "images": [
      {
        "url": "/images/destinations/sa-dec/hu-tieu-sa-dec-ba-sam.jpg",
        "alt": "Quán Hủ tiếu Sa Đéc Bà Sẩm (Hơn 50 năm truyền thống) — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "06:00 – 21:00 hàng ngày",
    "referencePrice": "15.000 – 35.000 VNĐ/tô (siêu bình dân và chất lượng)",
    "contactInfo": {
      "phone": "0277 3862 345"
    },
    "estimatedVisitDuration": {
      "minutes": 40,
      "isEstimate": false,
      "note": "Quán đông vào buổi sáng sớm từ 06:30 đến 08:30."
    },
    "sourceUrls": [
      "https://sadec.dongthap.gov.vn"
    ],
    "publicationStatus": "published"
  },
  {
    "slug": "khu-du-lich-sinh-thai-my-phuoc-thanh",
    "name": "Khu du lịch sinh thái Mỹ Phước Thành",
    "summary": "Bức tranh đồng quê Nam Bộ thu nhỏ rộng hơn 6,5ha với đầm sen bát ngát, cánh đồng lúa xanh và những món ngon gói trong lá sen.",
    "description": "Khu du lịch sinh thái Mỹ Phước Thành được ví như một miền Tây thu nhỏ yên bình ngay cửa ngõ thành phố Sa Đéc. Trải rộng trên diện tích hơn 6,5ha, toàn bộ không gian nơi đây ngập tràn sắc hồng của đầm sen, sắc xanh của ruộng lúa và những chiếc cầu tre, xuồng gỗ mộc mạc. Điểm hấp dẫn nhất tại Mỹ Phước Thành là trải nghiệm ngồi trong những chòi lá giữa đầm sen gió thổi lồng lộng, thưởng thức mâm cơm quê bày trên mẹt tre gồm: cơm huyết rồng hấp lá sen, cá lóc nướng trui cuốn lá sen non, gỏi ngó sen và lẩu mắm đậm đà.",
    "category": "eco",
    "tags": [
      "sen",
      "đồng quê",
      "ẩm thực",
      "sinh thái",
      "đầm sen",
      "ẩm thực đồng quê",
      "chụp ảnh"
    ],
    "area": "sa-dec",
    "address": "Số 264–266 Đường Tôn Đức Thắng, Ấp Phú Thuận, Xã Tân Phú Đông, TP. Sa Đéc, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.2785,
      "lng": 105.752
    },
    "images": [
      {
        "url": "/images/destinations/sa-dec/khu-du-lich-sinh-thai-my-phuoc-thanh.jpg",
        "alt": "Khu du lịch sinh thái Mỹ Phước Thành — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "08:00 – 21:00 hàng ngày",
    "referencePrice": "Miễn phí vé vào cổng tham quan và chụp ảnh; Ăn uống từ 120.000 – 220.000 VNĐ/người",
    "estimatedVisitDuration": {
      "minutes": 120,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "kien-an-cung-chua-ong-quach",
    "name": "Kiến An Cung – Chùa Ông Quách",
    "summary": "Tuyệt tác kiến trúc hội quán người Hoa trăm năm tuổi giữa trung tâm Sa Đéc với mái ngói ngũ hành uốn lượn như rồng bay.",
    "description": "Kiến An Cung (người dân địa phương quen gọi là Chùa Ông Quách) tọa lạc ngay trung tâm TP. Sa Đéc đối diện dòng rạch Cái Sơn, được cộng đồng người Hoa gốc Phúc Kiến xây dựng từ năm 1924 đến năm 1927. Công trình đã được công nhận là Di tích Lịch sử – Văn hóa cấp Quốc gia. Toàn bộ gạch ngói, đá xanh và gỗ quý đều được vận chuyển từ Phúc Kiến sang, tạo nên kiến trúc chữ Công bề thế với mái ngói ba tầng cong vút như sóng nước và vô số bức phù điêu, chạm lộng sơn son thếp vàng tỉ mỉ đến từng chi tiết.",
    "category": "culture",
    "tags": [
      "tín ngưỡng",
      "người Hoa",
      "Sa Đéc",
      "kiến trúc cổ",
      "di tích quốc gia",
      "văn hóa",
      "chùa Ông Quách"
    ],
    "area": "sa-dec",
    "address": "Số 39 Đường Phan Bội Châu, Phường 1, TP. Sa Đéc, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.2915,
      "lng": 105.7595
    },
    "images": [
      {
        "url": "/images/destinations/sa-dec/kien-an-cung-chua-ong-quach.jpg",
        "alt": "Kiến An Cung – Chùa Ông Quách — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "06:30 – 17:00 hàng ngày",
    "referencePrice": "Miễn phí vé tham quan",
    "estimatedVisitDuration": {
      "minutes": 45,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "lang-hoa-sa-dec",
    "name": "Làng hoa Sa Đéc (Tân Quy Đông)",
    "summary": "Thủ phủ hoa kiểng hơn 300 năm tuổi của miền Tây với nét độc đáo hoa trồng trên giàn sông Tiền.",
    "description": "Làng hoa Sa Đéc là một trong những làng hoa kiểng lâu đời và lớn nhất Việt Nam với diện tích hơn 600ha và trên 2.000 loài hoa quý. Điểm độc đáo hiếm có ở Sa Đéc là hoa được trồng trên những giàn tre cao trên mặt nước; người dân chèo xuồng lướt giữa các luống hoa để tưới nước và chăm sóc, tạo nên khung cảnh nên thơ tuyệt đẹp. Du khách có thể dạo bước trên Đường hoa Sa Nhiên – Cai Dao, lên Đài quan sát ngắm toàn cảnh thung lũng hoa và check-in các tiểu cảnh hoa cúc mâm xôi rực rỡ.",
    "category": "culture",
    "tags": [
      "làng hoa",
      "check-in",
      "cúc mâm xôi",
      "làng nghề truyền thống",
      "hoa kiểng",
      "sông Tiền"
    ],
    "area": "sa-dec",
    "address": "Đường Sa Nhiên – Cai Dao, Phường Tân Quy Đông, TP. Sa Đéc, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.306,
      "lng": 105.748
    },
    "images": [
      {
        "url": "/images/destinations/sa-dec/lang-hoa-sa-dec.jpg",
        "alt": "Làng hoa Sa Đéc (Tân Quy Đông) — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "06:00 – 18:30 hàng ngày",
    "referencePrice": "Vé vào đường hoa tham quan tự do miễn phí; Các khu du lịch tiểu cảnh tư nhân 50.000 – 100.000 VNĐ/vé",
    "contactInfo": {
      "phone": "0277 3861 240"
    },
    "estimatedVisitDuration": {
      "minutes": 120,
      "isEstimate": false,
      "note": "Đẹp nhất từ tháng 11 đến Tết Nguyên Đán."
    },
    "sourceUrls": [
      "https://sadec.dongthap.gov.vn"
    ],
    "publicationStatus": "published"
  },
  {
    "slug": "lang-nghe-bot-sa-dec",
    "name": "Làng nghề bột Sa Đéc",
    "summary": "Làng nghề làm bột gạo trăm năm tuổi bên dòng sông Tiền – linh hồn tạo nên sợi hủ tiếu Sa Đéc và bánh phồng tôm trứ danh.",
    "description": "Bên cạnh hoa kiểng, Sa Đéc còn tự hào với Làng nghề làm bột gạo truyền thống hơn 100 năm tuổi tập trung tại xã Tân Phú Đông và Phường 2, vừa được công nhận là Di sản văn hóa phi vật thể quốc gia. Nhờ nguồn nước ngọt phù sa sông Tiền có độ pH trung tính kết hợp cùng giống gạo Nàng Hương, Châu Hạng Võ chọn lọc, hạt bột Sa Đéc có màu trắng trong, dẻo mịn và thơm dịu không nơi nào sánh kịp. Du khách đến làng nghề sẽ được chiêm ngưỡng những giàn phơi bột trắng xóa dưới nắng vàng và tự tay trải nghiệm tráng bánh, làm hủ tiếu, bánh hỏi, bánh lọt truyền thống.",
    "category": "local_experience",
    "tags": [
      "làng nghề",
      "Sa Đéc",
      "thủ công",
      "bột gạo Sa Đéc",
      "di sản quốc gia",
      "trải nghiệm"
    ],
    "area": "sa-dec",
    "address": "Xã Tân Phú Đông & Phường 2, TP. Sa Đéc, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.283,
      "lng": 105.768
    },
    "images": [
      {
        "url": "/images/destinations/sa-dec/lang-nghe-bot-sa-dec.jpg",
        "alt": "Làng nghề bột Sa Đéc — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "06:30 – 16:30 hàng ngày (nhộn nhịp nhất vào buổi sáng nắng đẹp)",
    "referencePrice": "Tham quan tự do; Trải nghiệm làm bánh dân gian từ bột: 50.000 – 80.000 VNĐ/người",
    "estimatedVisitDuration": {
      "minutes": 90,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "nha-co-huynh-thuy-le",
    "name": "Nhà cổ Huỳnh Thủy Lê",
    "summary": "Ngôi nhà cổ lãng mạn bên sông Sa Đéc gắn liền với mối tình trong tác phẩm văn học bất hủ \"Người Tình\".",
    "description": "Được xây dựng năm 1895 bởi ông Huỳnh Thuận và trùng tu năm 1917, ngôi nhà cổ là tuyệt tác kiến trúc kết hợp hài hòa giữa phong cách Pháp, Hoa và Nam Bộ. Mặt tiền mang dáng dấp biệt thự La Mã cổ điển, bên trong chạm khắc sơn son thếp vàng tinh xảo hình chim muông hoa lá theo văn hóa phương Đông. Nơi đây là chứng nhân của mối tình lãng mạn giữa chàng công tử họ Huỳnh và nữ văn sĩ người Pháp Marguerite Duras, được bà chấp bút thành tiểu thuyết nổi tiếng \"L'Amant\" (đoạt giải Goncourt và chuyển thể thành phim điện ảnh Hollywood).",
    "category": "culture",
    "tags": [
      "nhà cổ",
      "kiến trúc Á Âu",
      "Người Tình",
      "Marguerite Duras",
      "lịch sử",
      "check-in"
    ],
    "area": "sa-dec",
    "address": "Số 255A Đường Nguyễn Huệ, Phường 2, TP. Sa Đéc, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.2935,
      "lng": 105.7625
    },
    "images": [
      {
        "url": "/images/destinations/sa-dec/nha-co-huynh-thuy-le.jpg",
        "alt": "Nhà cổ Huỳnh Thủy Lê — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "08:00 – 17:30 hàng ngày",
    "referencePrice": "40.000 VNĐ/người (đã bao gồm thuyết minh tiếng Việt/Anh/Pháp và phần trà mứt gừng đón khách)",
    "contactInfo": {
      "phone": "0277 3869 966"
    },
    "estimatedVisitDuration": {
      "minutes": 60,
      "isEstimate": false,
      "note": "Bao gồm nghe thuyết minh viên kể chuyện và thưởng thức trà mứt."
    },
    "sourceUrls": [
      "https://vi.wikipedia.org/wiki/Nh%C3%A0_c%E1%BB%95_Hu%E1%BB%B3nh_Th%E1%BB%A7y_L%C3%AA"
    ],
    "publicationStatus": "published"
  },
  {
    "slug": "quan-an-tam-yen-sa-dec",
    "name": "Quán ăn Tám Yến Sa Đéc (Đặc sản Đồng quê & Lẩu Mắm)",
    "summary": "Điểm hẹn ẩm thực sân vườn xanh mát chuyên phục vụ lẩu mắm cá linh, cá lóc nướng trui và vịt nướng.",
    "description": "Tọa lạc trên trục đường lớn Nguyễn Tất Thành, quán ăn Tám Yến là địa chỉ ăn trưa và ăn tối quen thuộc của cả dân bản địa lẫn khách tour sành ăn khi đến Sa Đéc. Quán có khuôn viên sân vườn rợp bóng cây xanh mát mẻ, nổi tiếng với món Lẩu mắm miền Tây nấu từ mắm cá linh cá sặc đặc sánh, ăn kèm đĩa rau rừng hơn 15 loại: bông súng, bông điên điển, rau đắng, cù nèo, cà tím... Ngoài ra, món Cá lóc nướng trui đắp đất và Vịt xiêm nướng muối ớt da giòn rụm cũng là món \"tủ\" được du khách gọi nhiều nhất.",
    "category": "food",
    "tags": [
      "lẩu mắm",
      "cá lóc nướng trui",
      "quán Tám Yến",
      "vịt nướng Sa Đéc",
      "quán sân vườn",
      "đặc sản đồng quê"
    ],
    "area": "sa-dec",
    "address": "Số 68 Đường Nguyễn Tất Thành, Phường 1, TP. Sa Đéc, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.291,
      "lng": 105.754
    },
    "images": [
      {
        "url": "/images/destinations/sa-dec/quan-an-tam-yen-sa-dec.jpg",
        "alt": "Quán ăn Tám Yến Sa Đéc (Đặc sản Đồng quê & Lẩu Mắm) — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "09:00 – 22:30 hàng ngày",
    "referencePrice": "Chi tiêu trung bình: 100.000 – 220.000 VNĐ/người; Nồi lẩu mắm từ 200.000 VNĐ",
    "contactInfo": {
      "phone": "0277 3868 688"
    },
    "estimatedVisitDuration": {
      "minutes": 90,
      "isEstimate": false,
      "note": "Thích hợp cho bữa trưa và bữa tối gia đình, nhóm bạn."
    },
    "sourceUrls": [
      "https://sadec.dongthap.gov.vn"
    ],
    "publicationStatus": "published"
  },
  {
    "slug": "vuon-hoa-man-dinh-hong",
    "name": "Vườn hoa Mãn Đình Hồng",
    "summary": "Thiên đường chụp ảnh ngoại cảnh rực rỡ sắc màu với những luống hoa hướng dương, hoa mào gà, sao nhái và mãn đình hồng trải dài.",
    "description": "Vườn hoa Mãn Đình Hồng là điểm hẹn sống ảo nổi tiếng thu hút hàng ngàn du khách mỗi mùa hoa nở. Khu vườn rộng hơn 1ha được quy hoạch thành nhiều phân khu sắc màu nối tiếp nhau: từ sắc vàng rực của hoa hướng dương, sắc tím mộng mơ của hoa thạch thảo, sắc đỏ nhung của hoa mào gà cho đến những luống hoa mãn đình hồng vươn cao kiêu hãnh. Giữa vườn có lắp đặt các cây cầu gỗ, xích đu và chòi ngắm cảnh, giúp du khách dễ dàng lưu lại những bộ ảnh xuân – hè tuyệt đẹp.",
    "category": "local_experience",
    "tags": [
      "hoa",
      "chụp ảnh",
      "Sa Đéc",
      "vườn hoa",
      "thiên nhiên",
      "hoa kiểng"
    ],
    "area": "sa-dec",
    "address": "Tuyến du lịch hoa kiểng Sa Đéc – Mỹ Tho",
    "coordinates": {
      "lat": 10.3095,
      "lng": 105.746
    },
    "images": [
      {
        "url": "/images/destinations/sa-dec/vuon-hoa-man-dinh-hong.jpg",
        "alt": "Vườn hoa Mãn Đình Hồng — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "06:30 – 18:00 hàng ngày",
    "referencePrice": "Vé vào cổng chụp ảnh: 40.000 – 60.000 VNĐ/người",
    "estimatedVisitDuration": {
      "minutes": 90,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "vuon-hong-tu-ton",
    "name": "Khu du lịch vườn hồng Tư Tôn",
    "summary": "Một trong những điểm du lịch hoa kiểng đầu tiên và quy mô nhất Làng hoa Sa Đéc với cổng trời, hồ sen và hàng trăm giống hồng quý.",
    "description": "Nằm ngay trung tâm Làng hoa Tân Quy Đông bên bờ sông Tiền lộng gió, Vườn hồng Tư Tôn của nghệ nhân Tư Tôn là điểm tham quan lâu đời và nổi tiếng bậc nhất Sa Đéc. Khu vườn quy tụ hàng trăm giống hoa hồng ngoại và hồng cổ Sa Đéc quý hiếm, kết hợp cùng hồ cá Koi, đầm sen súng, bến thuyền hoa và hàng loạt tiểu cảnh kiến trúc như Cổng Trời Bali, đảo Robinson, cầu tình yêu. Đây là địa điểm lý tưởng để du khách vừa thưởng hoa, vừa nhâm nhi cà phê sáng và tìm hiểu nghề trồng hoa trên giàn của người dân Sa Đéc.",
    "category": "local_experience",
    "tags": [
      "hoa hồng",
      "chụp ảnh",
      "vườn",
      "vườn hồng",
      "Làng hoa Sa Đéc",
      "trải nghiệm"
    ],
    "area": "sa-dec",
    "address": "Đường Khánh Hòa, Khóm Tân Khánh, Phường Tân Quy Đông, TP. Sa Đéc, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.3145,
      "lng": 105.744
    },
    "images": [
      {
        "url": "/images/destinations/sa-dec/vuon-hong-tu-ton.jpg",
        "alt": "Khu du lịch vườn hồng Tư Tôn — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "06:30 – 18:30 hàng ngày",
    "referencePrice": "Vé vào cổng: 40.000 – 50.000 VNĐ/người",
    "estimatedVisitDuration": {
      "minutes": 90,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "vuon-quoc-gia-tram-chim",
    "name": "Vườn quốc gia Tràm Chim",
    "summary": "Khu Ramsar thứ 2.000 của thế giới, xứ sở của sếu đầu đỏ và bạt ngàn đồng cỏ năng mùa nước nổi.",
    "description": "Vườn quốc gia Tràm Chim (Tam Nông, Đồng Tháp) là vùng đất ngập nước thu nhỏ tiêu biểu của hệ sinh thái Đồng Tháp Mười xưa. Nơi đây bảo tồn hơn 230 loài chim nước quý hiếm, đặc biệt là loài Sếu đầu đỏ (Grus antigone sharpii) được ghi trong Sách Đỏ thế giới. Du khách đến đây sẽ được ngồi tắc ráng lướt trên thảm bèo xanh, len lỏi giữa rừng tràm nguyên sinh ngát hương hoa tràm, chiêm ngưỡng hàng vạn cánh cò chao liệng lúc hoàng hôn.",
    "category": "nature",
    "tags": [
      "sinh thái",
      "đất ngập nước",
      "sếu đầu đỏ",
      "rừng tràm",
      "ngắm chim",
      "ramsar"
    ],
    "area": "tam-nong",
    "address": "Khóm 4, Thị trấn Tràm Chim, Huyện Tam Nông, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.7167,
      "lng": 105.5167
    },
    "images": [
      {
        "url": "/images/destinations/tam-nong/vuon-quoc-gia-tram-chim.jpg",
        "alt": "Vườn quốc gia Tràm Chim — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:00 – 17:00 hàng ngày",
    "referencePrice": "Vé vào cổng 20.000 VNĐ; Vé tàu/tắc ráng tham quan 500.000 – 800.000 VNĐ/thuyền (chở 10-12 khách)",
    "contactInfo": {
      "phone": "0277 3827 307",
      "website": "https://tramchim.dongthap.gov.vn"
    },
    "estimatedVisitDuration": {
      "minutes": 180,
      "isEstimate": false,
      "note": "Khuyến nghị đi tuyến tắc ráng 12km hoặc 21km."
    },
    "sourceUrls": [
      "https://vi.wikipedia.org/wiki/V%C6%B0%E1%BB%9Dn_qu%E1%BB%91c_gia_Tr%C3%A0m_Chim"
    ],
    "publicationStatus": "published"
  },
  {
    "slug": "canh-dong-sen-my-hoa",
    "name": "Cánh đồng sen Mỹ Hòa",
    "summary": "Không gian sen hồng bạt ngàn tại thủ phủ sen Mỹ Hòa, nơi trải nghiệm chèo xuồng hái gương sen và thưởng thức ẩm thực từ sen.",
    "description": "Xã Mỹ Hòa (huyện Tháp Mười) được mệnh danh là \"thủ phủ hoa sen\" của tỉnh Đồng Tháp với hàng chục hecta đầm sen nối tiếp nhau trải dài đến tận chân trời. Tại Cánh đồng sen Mỹ Hòa, những chiếc cầu tre mộc mạc dẫn lối ra các chòi lá nằm giữa biển sen hồng thơm ngát. Du khách đến đây có thể thuê áo bà ba và nón lá để chụp ảnh, ngồi xuồng ba lá len lỏi giữa rừng lá sen xanh mướt để tận tay hái gương sen tươi ngọt, và thưởng thức các món đặc sản trứ danh như cá lóc nướng cuốn lá sen, gỏi ngó sen, chè hạt sen nhãn nhục.",
    "category": "nature",
    "tags": [
      "sen",
      "ẩm thực",
      "cánh đồng",
      "cánh đồng sen",
      "thiên nhiên",
      "ẩm thực sen",
      "Tháp Mười"
    ],
    "area": "thap-muoi",
    "address": "Xã Mỹ Hòa, Huyện Tháp Mười, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.562,
      "lng": 105.815
    },
    "images": [
      {
        "url": "/images/destinations/thap-muoi/canh-dong-sen-my-hoa.jpg",
        "alt": "Cánh đồng sen Mỹ Hòa — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:00 – 18:00 hàng ngày (sen nở rộ đẹp nhất từ tháng 5 đến tháng 11)",
    "referencePrice": "Vé vào cổng & cầu tre chụp ảnh: 20.000 – 30.000 VNĐ/người; Thuê áo bà ba: 30.000 VNĐ/bộ",
    "estimatedVisitDuration": {
      "minutes": 120,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "dong-sen-thap-muoi",
    "name": "Đồng sen Tháp Mười",
    "summary": "Biểu tượng du lịch sinh thái của Đất Sen Hồng: \"Tháp Mười đẹp nhất bông sen\", điểm check-in và ẩm thực sen nổi tiếng nhất Đồng Tháp.",
    "description": "Khu du lịch sinh thái Đồng sen Tháp Mười tại xã Mỹ Hòa là nơi hiện thực hóa câu ca dao bất hủ \"Tháp Mười đẹp nhất bông sen / Việt Nam đẹp nhất có tên Bác Hồ\". Cách Khu di tích Gò Tháp chỉ vài cây số, nơi đây mở ra một không gian thanh bình tuyệt đối với hơn 11ha đầm sen hồng nở rộ quanh năm, tỏa hương thơm ngát theo làn gió đồng. Du khách có thể dạo bước trên những nhịp cầu gỗ giữa đầm sen, câu cá giải trí, chèo xuồng ngắm sen lúc bình minh và thưởng thức hơn 20 món ăn độc đáo chế biến từ ngó sen, củ sen, hạt sen và lá sen.",
    "category": "nature",
    "tags": [
      "ẩm thực",
      "sen",
      "đồng sen",
      "thiên nhiên",
      "biểu tượng Đồng Tháp",
      "ẩm thực sen"
    ],
    "area": "thap-muoi",
    "address": "Kinh 1, Ấp 1, Xã Mỹ Hòa, Huyện Tháp Mười, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.571,
      "lng": 105.823
    },
    "images": [
      {
        "url": "/images/destinations/thap-muoi/dong-sen-thap-muoi.jpg",
        "alt": "Đồng sen Tháp Mười — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:00 – 18:00 hàng ngày",
    "referencePrice": "Vé vào cổng: 20.000 VNĐ ngày thường, 30.000 VNĐ cuối tuần; Ăn uống từ 100.000 – 200.000 VNĐ/người",
    "estimatedVisitDuration": {
      "minutes": 150,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "khu-bao-ton-sinh-thai-dong-thap-muoi",
    "name": "Khu bảo tồn sinh thái Đồng Tháp Mười",
    "summary": "Khu rừng tràm ngập nước nguyên sinh rộng hơn 100ha với sân chim tự nhiên hàng vạn cá thể cò, diệc, giang sen quý hiếm.",
    "description": "Khu bảo tồn sinh thái Đồng Tháp Mười là vùng lõi sinh thái ngập nước nguyên sơ với hơn 100ha rừng tràm cổ thụ và vùng đệm rộng hơn 1.800ha. Đây là ngôi nhà chung của hơn 150 loài thực vật, 147 loài chim nước (trong đó có nhiều loài quý hiếm nằm trong Sách Đỏ như giang sen, điên điển, cò ốc) và hàng chục loài thủy sản nước ngọt. Ngồi trên xuồng chèo lướt nhẹ qua thảm bèo tấm xanh rì dưới tán rừng tràm mát rượi, lắng nghe bản giao hưởng của hàng vạn cánh chim chiều về tổ là trải nghiệm thiên nhiên kỳ thú khó quên.",
    "category": "eco",
    "tags": [
      "sinh thái",
      "đất ngập nước",
      "bảo tồn",
      "bảo tồn thiên nhiên",
      "rừng tràm",
      "vườn chim"
    ],
    "area": "thap-muoi",
    "address": "Vùng sinh thái ngập nước Đồng Tháp Mười (giáp ranh Tháp Mười – Tân Phước)",
    "coordinates": {
      "lat": 10.585,
      "lng": 106.125
    },
    "images": [
      {
        "url": "/images/destinations/thap-muoi/khu-bao-ton-sinh-thai-dong-thap-muoi.jpg",
        "alt": "Khu bảo tồn sinh thái Đồng Tháp Mười — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:00 – 17:00 hàng ngày",
    "referencePrice": "Vé tham quan & xuồng chèo xuyên rừng tràm: 50.000 – 80.000 VNĐ/người",
    "estimatedVisitDuration": {
      "minutes": 150,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "khu-di-tich-go-thap",
    "name": "Khu di tích Gò Tháp",
    "summary": "Di tích quốc gia đặc biệt lưu giữ dấu tích vương quốc Phù Nam – văn hóa Óc Eo cổ đại và đền thờ hai vị anh hùng dân tộc.",
    "description": "Khu di tích Gò Tháp là Di tích quốc gia đặc biệt tọa lạc tại trung tâm vùng Đồng Tháp Mười, mang giá trị khảo cổ học, lịch sử và tâm linh bậc nhất Nam Bộ. Nơi đây lưu giữ quần thể di chỉ kiến trúc đền tháp, mộ chum, tượng thần Vishnu, tượng Phật bằng gỗ và hàng trăm hiện vật vàng lá thuộc nền văn hóa Óc Eo (thế kỷ I – VII). Bên cạnh dấu tích cổ đại, Gò Tháp còn là căn cứ địa kháng chiến gắn liền với tên tuổi Thiên hộ Võ Duy Dương, Đốc binh Nguyễn Tấn Kiều và lễ hội Miếu Bà Chúa Xứ Gò Tháp thu hút hàng trăm ngàn lượt khách hành hương mỗi năm.",
    "category": "culture",
    "tags": [
      "di tích quốc gia đặc biệt",
      "Óc Eo",
      "khảo cổ",
      "hoa sen",
      "Đồng Tháp Mười",
      "tín ngưỡng",
      "khảo cổ Óc Eo",
      "lịch sử",
      "tâm linh"
    ],
    "area": "thap-muoi",
    "address": "Ấp 1, Xã Tân Kiều, Huyện Tháp Mười, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.6333,
      "lng": 105.85
    },
    "images": [
      {
        "url": "/images/destinations/thap-muoi/khu-di-tich-go-thap.jpg",
        "alt": "Khu di tích Gò Tháp — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:00 – 17:30 hàng ngày",
    "referencePrice": "Miễn phí vé vào cổng tham quan toàn bộ khu di tích",
    "contactInfo": {
      "phone": "0277 3956 123"
    },
    "estimatedVisitDuration": {
      "minutes": 120,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [
      "https://vi.wikipedia.org/wiki/Khu_di_t%C3%ADch_G%C3%B2_Th%C3%A1p"
    ],
    "publicationStatus": "published"
  },
  {
    "slug": "khu-du-lich-sinh-thai-tien-dinh",
    "name": "Khu du lịch sinh thái Tiên Định",
    "summary": "Điểm dừng chân sinh thái miệt vườn tại Tháp Mười với hồ sen, vườn cây ăn trái và không gian ẩm thực dân dã.",
    "description": "Khu du lịch sinh thái Tiên Định tọa lạc tại huyện Tháp Mười, mang phong cách nhà vườn Nam Bộ thân thiện và gần gũi với thiên nhiên. Bao quanh khu du lịch là những ao sen hồng, vườn mít, vườn dừa xanh mát và các chòi nghỉ dựng bằng gỗ, tre ven mặt nước. Đây là điểm dừng chân lý tưởng cho du khách trên hành trình khám phá Gò Tháp – Đồng Sen Tháp Mười để nghỉ trưa, câu cá giải trí, chụp ảnh cùng tiểu cảnh nông thôn và thưởng thức các món cá đồng, lẩu mắm, chuột đồng nướng lu chuẩn vị địa phương.",
    "category": "eco",
    "tags": [
      "sinh thái",
      "tham quan",
      "nhà vườn",
      "ẩm thực đồng quê",
      "Tháp Mười"
    ],
    "area": "thap-muoi",
    "address": "Xã Trường Xuân, Huyện Tháp Mười, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.612,
      "lng": 105.784
    },
    "images": [
      {
        "url": "/images/destinations/thap-muoi/khu-du-lich-sinh-thai-tien-dinh.jpg",
        "alt": "Khu du lịch sinh thái Tiên Định — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:30 – 20:00 hàng ngày",
    "referencePrice": "Vào cổng miễn phí; Chi phí ăn uống từ 90.000 – 180.000 VNĐ/người",
    "estimatedVisitDuration": {
      "minutes": 90,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "thap-linh-co-tu",
    "name": "Tháp Linh Cổ Tự",
    "summary": "Ngôi chùa cổ linh thiêng nằm trên gò đất cao thuộc quần thể Di tích quốc gia đặc biệt Gò Tháp với dấu tích văn hóa Phù Nam.",
    "description": "Tháp Linh Cổ Tự (còn gọi là Chùa Tháp Linh) tọa lạc ngay trên đỉnh gò Tháp Mười thuộc Khu di tích quốc gia đặc biệt Gò Tháp. Ngôi chùa được dựng trên nền một ngôi đền gạch cổ thuộc nền văn hóa Óc Eo (thế kỷ I – VII), nơi các nhà khảo cổ từng phát hiện nhiều tượng Phật gỗ, tượng thần Vishnu và bia đá cổ. Từng bị bom đạn tàn phá trong kháng chiến chống Pháp và chống Mỹ, chùa đã được tôn tạo khang trang với kiến trúc truyền thống uy nghiêm, phía trước là Bảo tháp Hòa Bình 9 tầng vươn cao giữa rừng tràm và đầm sen Tháp Mười.",
    "category": "culture",
    "tags": [
      "tâm linh",
      "Gò Tháp",
      "di tích",
      "chùa cổ",
      "văn hóa Óc Eo"
    ],
    "area": "thap-muoi",
    "address": "Khu di tích Gò Tháp, Ấp 1, Xã Tân Kiều, Huyện Tháp Mười, Tỉnh Đồng Tháp",
    "coordinates": {
      "lat": 10.6345,
      "lng": 105.8512
    },
    "images": [
      {
        "url": "/images/destinations/thap-muoi/thap-linh-co-tu.jpg",
        "alt": "Tháp Linh Cổ Tự — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "06:30 – 17:30 hàng ngày",
    "referencePrice": "Miễn phí vé tham quan và chiêm bái",
    "estimatedVisitDuration": {
      "minutes": 60,
      "isEstimate": false,
      "note": "Thời lượng tham quan trải nghiệm thực tế khuyến nghị."
    },
    "sourceUrls": [],
    "publicationStatus": "published"
  },
  {
    "slug": "khu-du-lich-sinh-thai-thoi-son",
    "name": "Điểm Du lịch Sinh thái Cù lao Thới Sơn (Cồn Lân)",
    "summary": "Cù lao sông nước hữu tình lớn nhất sông Tiền, chèo xuồng dừa nước và thưởng thức đờn ca tài tử.",
    "description": "Cù lao Thới Sơn (còn gọi là Cồn Lân) nằm giữa dòng sông Tiền thơ mộng, là viên ngọc quý của du lịch miệt vườn miền Tây. Đến Thới Sơn, du khách sẽ được đi thuyền máy ngắm cầu Rạch Miễu, chuyển sang xuồng chèo ba lá len lỏi dưới bóng râm của những hàng dừa nước xanh ngắt, dạo bước trên đường làng rợp bóng cây ăn trái, ngồi thưởng thức đĩa trái cây tươi ngon vừa hái tại vườn trong tiếng đàn kìm, đàn tranh và giọng ca ngọt ngào của nghệ nhân đờn ca tài tử Nam Bộ.",
    "category": "local_experience",
    "tags": [
      "cù lao Thới Sơn",
      "cồn Lân",
      "xuồng dừa nước",
      "đờn ca tài tử",
      "miệt vườn",
      "sông Tiền",
      "trái cây"
    ],
    "area": "thoi-son",
    "address": "Cù lao Thới Sơn, Xã Thới Sơn, TP. Mỹ Tho (kết nối trực tiếp qua Cầu Rạch Miễu)",
    "coordinates": {
      "lat": 10.334,
      "lng": 106.342
    },
    "images": [
      {
        "url": "/images/destinations/thoi-son/khu-du-lich-sinh-thai-thoi-son.jpg",
        "alt": "Điểm Du lịch Sinh thái Cù lao Thới Sơn (Cồn Lân) — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:30 – 17:30 hàng ngày",
    "referencePrice": "Trọn gói tour miệt vườn (thuyền sông Tiền + đò chèo + trái cây + trà mật ong + đờn ca tài tử): 80.000 – 120.000 VNĐ/khách",
    "contactInfo": {
      "phone": "0273 3874 444"
    },
    "estimatedVisitDuration": {
      "minutes": 150,
      "isEstimate": false,
      "note": "Bao gồm đi thuyền lớn, đò chèo, nghe đờn ca tài tử và ăn trái cây."
    },
    "sourceUrls": [
      "https://dulichtiengiang.gov.vn"
    ],
    "publicationStatus": "published"
  },
  {
    "slug": "nha-hang-mekong-taste-thoi-son",
    "name": "Nhà hàng Sinh thái Mekong Taste Thới Sơn",
    "summary": "Thưởng thức Cá tai tượng chiên xù dựng đứng giòn rụm, xôi chiên phồng tròn xoe trong không gian ven sông Tiền lộng gió.",
    "description": "Nằm trên dải đất ấp Thới Thạnh sát mép sông Tiền, Mekong Taste là nhà hàng sinh thái miệt vườn nổi tiếng nhất tại Cù lao Thới Sơn được review triệu view trên mạng xã hội. Món ăn biểu tượng không thể bỏ qua tại đây là Cá tai tượng chiên xù chiên vàng ruộm giòn tan nguyên vảy, được cuốn cùng bánh tráng, khế chua, chuối chát, rau đọt cóc miệt vườn chấm nước mắm tỏi ớt chua ngọt pha chuẩn vị. Thực đơn còn có xôi chiên phồng phồng to như quả bóng, gà ta thả vườn nướng đất sét thơm phức và lẩu mắm cá linh rau nhút.",
    "category": "food",
    "tags": [
      "cá tai tượng chiên xù",
      "ẩm thực Thới Sơn",
      "xôi chiên phồng",
      "nhà hàng ven sông",
      "lẩu mắm",
      "đặc sản sông Tiền"
    ],
    "area": "thoi-son",
    "address": "Ấp Thới Thạnh, Xã Thới Sơn, TP. Mỹ Tho (ngay ngã ba rạch Thới Sơn nối sông Tiền)",
    "coordinates": {
      "lat": 10.337,
      "lng": 106.338
    },
    "images": [
      {
        "url": "/images/destinations/thoi-son/nha-hang-mekong-taste-thoi-son.jpg",
        "alt": "Nhà hàng Sinh thái Mekong Taste Thới Sơn — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "09:00 – 21:00 hàng ngày",
    "referencePrice": "Mức chi trung bình: 130.000 – 250.000 VNĐ/người; Mẹt cá tai tượng chiên xù nguyên con từ 180.000 VNĐ",
    "contactInfo": {
      "phone": "0903 888 999",
      "website": "https://mekongtaste.com"
    },
    "estimatedVisitDuration": {
      "minutes": 90,
      "isEstimate": false,
      "note": "Khung giờ ăn trưa lý tưởng nhất từ 11:30 đến 13:30."
    },
    "sourceUrls": [
      "https://mekongtaste.com"
    ],
    "publicationStatus": "published"
  },
  {
    "slug": "trai-ong-mat-hoa-nhan-thoi-son",
    "name": "Trại Nuôi Ong Mật Hoa Nhãn & Lò Kẹo Dừa Thới Sơn",
    "summary": "Trải nghiệm thưởng thức ly trà mật ong hoa nhãn tắc ấm nồng và ăn kẹo dừa sầu riêng dẻo quánh vừa nung nóng.",
    "description": "Điểm dừng chân đặc sắc bậc nhất trên cù lao Thới Sơn được hàng loạt vlogger du lịch trên TikTok và YouTube khen ngợi. Du khách được tự tay cầm cầu ong mật chụp ảnh lưu niệm hoàn toàn an toàn, nhâm nhi tách trà nóng pha mật ong hoa nhãn nguyên chất hòa cùng nước tắc và phấn hoa giúp thanh lọc cơ thể. Ngay bên cạnh là lò kẹo dừa truyền thống, nơi du khách tận mắt chứng kiến công đoạn nạo dừa, ép cốt dừa, sên kẹo trên chảo gang đỏ lửa và thưởng thức viên kẹo dừa lá dứa, sầu riêng thơm lừng vừa cắt nóng hổi.",
    "category": "local_experience",
    "tags": [
      "trại ong mật",
      "trà mật ong tắc",
      "lò kẹo dừa",
      "làng nghề thủ công",
      "quà tặng miền Tây",
      "Thới Sơn"
    ],
    "area": "thoi-son",
    "address": "Ấp Thới Hòa, Xã Thới Sơn, TP. Mỹ Tho (thuộc tuyến tour Cù lao Thới Sơn)",
    "coordinates": {
      "lat": 10.3315,
      "lng": 106.345
    },
    "images": [
      {
        "url": "/images/destinations/thoi-son/trai-ong-mat-hoa-nhan-thoi-son.jpg",
        "alt": "Trại Nuôi Ong Mật Hoa Nhãn & Lò Kẹo Dừa Thới Sơn — Hình ảnh thực tế địa điểm du lịch",
        "credit": "Bộ sưu tập ảnh thực tế DTST",
        "license": "DTST Local Media"
      }
    ],
    "openingHours": "07:30 – 17:30 hàng ngày",
    "referencePrice": "Vào cổng nếm thử kẹo dừa & uống trà mật ong miễn phí; Hũ mật ong hoa nhãn 120.000 – 200.000 VNĐ; Kẹo dừa 35.000 – 50.000 VNĐ/hộp",
    "contactInfo": {
      "phone": "0918 234 567"
    },
    "estimatedVisitDuration": {
      "minutes": 60,
      "isEstimate": false,
      "note": "Uống trà mật ong, nếm thử kẹo dừa và mua đặc sản làm quà."
    },
    "sourceUrls": [
      "https://dulichtiengiang.gov.vn"
    ],
    "publicationStatus": "published"
  }
];

export interface SeedChallenge {
  key: string;
  destinationSlug: string;
  title: string;
  description: string;
  story: string;
  rewardPoints: number;
  minCorrect: number;
  questions: Array<{ prompt: string; options: string[]; correctOptionIndex: number; explanation: string }>;
}

export const seedChallenges: SeedChallenge[] = [
  {
    key: 'tram-chim-quiz',
    destinationSlug: 'vuon-quoc-gia-tram-chim',
    title: 'Khám phá đất ngập nước Tràm Chim',
    description: 'Trả lời đúng ít nhất 2/3 câu để nhận điểm thưởng.',
    story:
      'Mỗi mùa nước nổi, đồng cỏ và rừng tràm nơi đây trở thành nơi sinh sống của nhiều loài chim nước. Hãy quan sát bảng thông tin tại điểm tham quan và trả lời các câu hỏi dưới đây. (Nội dung minh họa)',
    rewardPoints: 50,
    minCorrect: 2,
    questions: [
      {
        prompt: 'Loài chim quý nào thường được nhắc đến gắn với Tràm Chim?',
        options: ['Sếu đầu đỏ', 'Chim cánh cụt', 'Đại bàng đầu trắng', 'Hồng hạc'],
        correctOptionIndex: 0,
        explanation: 'Tràm Chim thường được biết đến là nơi sếu đầu đỏ từng về kiếm ăn.',
      },
      {
        prompt: 'Tràm Chim thuộc kiểu hệ sinh thái nào?',
        options: ['Sa mạc', 'Đất ngập nước', 'Núi đá vôi', 'Rừng lá kim'],
        correctOptionIndex: 1,
        explanation: 'Đây là vùng đất ngập nước đặc trưng của Đồng Tháp Mười.',
      },
      {
        prompt: 'Loài cây nào gắn liền với tên gọi "Tràm Chim"?',
        options: ['Cây thông', 'Cây tràm', 'Cây bạch đàn', 'Cây phong'],
        correctOptionIndex: 1,
        explanation: 'Rừng tràm là cảnh quan tiêu biểu của khu vực.',
      },
    ],
  },
  {
    key: 'huynh-thuy-le-quiz',
    destinationSlug: 'nha-co-huynh-thuy-le',
    title: 'Câu chuyện nhà cổ bên sông Sa Đéc',
    description: 'Trả lời đúng cả 2 câu để nhận điểm thưởng.',
    story:
      'Ngôi nhà cổ bên sông Sa Đéc mang dấu ấn giao thoa kiến trúc Á – Âu và gắn với một tác phẩm văn học nổi tiếng. (Nội dung minh họa)',
    rewardPoints: 40,
    minCorrect: 2,
    questions: [
      {
        prompt: 'Nhà cổ Huỳnh Thủy Lê gắn với tiểu thuyết nào?',
        options: ['Người tình (L\'Amant)', 'Những người khốn khổ', 'Số đỏ', 'Đất rừng phương Nam'],
        correctOptionIndex: 0,
        explanation: 'Tiểu thuyết "Người tình" của Marguerite Duras.',
      },
      {
        prompt: 'Nhà cổ nằm bên dòng sông của đô thị nào?',
        options: ['Cao Lãnh', 'Sa Đéc', 'Hồng Ngự', 'Mỹ Tho'],
        correctOptionIndex: 1,
        explanation: 'Nhà cổ nằm bên sông Sa Đéc.',
      },
    ],
  },
  {
    key: 'go-thap-quiz',
    destinationSlug: 'khu-di-tich-go-thap',
    title: 'Dấu tích cổ ở Gò Tháp',
    description: 'Trả lời đúng câu hỏi để nhận điểm thưởng.',
    story: 'Những dấu tích khảo cổ tại Gò Tháp kể câu chuyện về một nền văn hóa cổ ở Nam Bộ. (Nội dung minh họa)',
    rewardPoints: 30,
    minCorrect: 1,
    questions: [
      {
        prompt: 'Gò Tháp gắn với nền văn hóa khảo cổ nào?',
        options: ['Văn hóa Đông Sơn', 'Văn hóa Óc Eo', 'Văn hóa Sa Huỳnh', 'Văn hóa Hòa Bình'],
        correctOptionIndex: 1,
        explanation: 'Gò Tháp là một trong những địa điểm gắn với văn hóa Óc Eo.',
      },
    ],
  },
];

export const seedQrCodes = [
  { code: 'TRAMCHIM-01', label: 'Cổng Vườn quốc gia Tràm Chim', targetType: 'destination' as const, target: 'vuon-quoc-gia-tram-chim' },
  { code: 'HTL-01', label: 'Sân Nhà cổ Huỳnh Thủy Lê', targetType: 'destination' as const, target: 'nha-co-huynh-thuy-le' },
  { code: 'GOTHAP-01', label: 'Thử thách Gò Tháp', targetType: 'challenge' as const, target: 'go-thap-quiz' },
  { code: 'SADEC-HOA', label: 'Làng hoa Sa Đéc (tạm tắt)', targetType: 'destination' as const, target: 'lang-hoa-sa-dec', status: 'inactive' as const },
];
