import type { Area, Category } from '../config/catalog.js';

export interface RichDestinationData {
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: Category;
  tags: string[];
  area: Area;
  address: string;
  coordinates: { lat: number; lng: number };
  estimatedVisitDuration: { minutes: number; isEstimate: boolean; note: string };
  images: Array<{ url: string; alt?: string; credit?: string; license?: string; sourceUrl?: string }>;
  openingHours: string;
  referencePrice: string;
  contactInfo: { phone?: string; website?: string; email?: string };
  sourceUrls: string[];
  publicationStatus: 'draft' | 'published';
}

export const richDestinations: RichDestinationData[] = [
  // ===========================================================================
  // I. CỤM DU LỊCH SINH THÁI & VĂN HÓA ĐỒNG THÁP
  // ===========================================================================
  {
    slug: 'vuon-quoc-gia-tram-chim',
    name: 'Vườn quốc gia Tràm Chim',
    summary: 'Khu Ramsar thứ 2.000 của thế giới, xứ sở của sếu đầu đỏ và bạt ngàn đồng cỏ năng mùa nước nổi.',
    description:
      'Vườn quốc gia Tràm Chim (Tam Nông, Đồng Tháp) là vùng đất ngập nước thu nhỏ tiêu biểu của hệ sinh thái Đồng Tháp Mười xưa. Nơi đây bảo tồn hơn 230 loài chim nước quý hiếm, đặc biệt là loài Sếu đầu đỏ (Grus antigone sharpii) được ghi trong Sách Đỏ thế giới. Du khách đến đây sẽ được ngồi tắc ráng lướt trên thảm bèo xanh, len lỏi giữa rừng tràm nguyên sinh ngát hương hoa tràm, chiêm ngưỡng hàng vạn cánh cò chao liệng lúc hoàng hôn.',
    category: 'nature',
    tags: ['sinh thái', 'đất ngập nước', 'sếu đầu đỏ', 'rừng tràm', 'ngắm chim', 'ramsar'],
    area: 'tam-nong',
    address: 'Khóm 4, Thị trấn Tràm Chim, Huyện Tam Nông, Tỉnh Đồng Tháp',
    coordinates: { lat: 10.7167, lng: 105.5167 },
    estimatedVisitDuration: { minutes: 180, isEstimate: false, note: 'Khuyến nghị đi tuyến tắc ráng 12km hoặc 21km.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=1200&auto=format&fit=crop&q=80',
        alt: 'Bình minh trên vùng đất ngập nước Tràm Chim Đồng Tháp',
        credit: 'Unsplash Nature Collection',
      },
      {
        url: 'https://images.unsplash.com/photo-1516214104703-d870798883c5?w=1200&auto=format&fit=crop&q=80',
        alt: 'Rừng tràm và đàn chim nước mùa nước nổi',
        credit: 'Unsplash Wildlife',
      },
    ],
    openingHours: '07:00 – 17:00 hàng ngày',
    referencePrice: 'Vé vào cổng 20.000 VNĐ; Vé tàu/tắc ráng tham quan 500.000 – 800.000 VNĐ/thuyền (chở 10-12 khách)',
    contactInfo: { phone: '0277 3827 307', website: 'https://tramchim.dongthap.gov.vn' },
    sourceUrls: ['https://vi.wikipedia.org/wiki/V%C6%B0%E1%BB%9Dn_qu%E1%BB%91c_gia_Tr%C3%A0m_Chim'],
    publicationStatus: 'published',
  },
  {
    slug: 'khu-di-tich-xeo-quyt',
    name: 'Khu di tích Xẻo Quýt',
    summary: 'Căn cứ kháng chiến giữa rừng tràm nguyên sinh, di tích lịch sử cách mạng hào hùng.',
    description:
      'Khu di tích Xẻo Quýt rộng khoảng 50ha, từng là căn cứ cơ quan Tỉnh ủy Kiến Phong (nay là Đồng Tháp) lãnh đạo nhân dân kháng chiến chống Mỹ từ năm 1960 đến 1975. Nơi đây lưu giữ nguyên vẹn các công sự, hầm chữ A, hầm bí mật, nhà hội trường dã chiến ẩn mình dưới những tán tràm cổ thụ phủ đầy rêu phong và dây bòng bong. Du khách có thể đi bộ theo đường bê tông uốn lượn dưới tán rừng hoặc ngồi xuồng ba lá do các cô thôn nữ mặc áo bà ba chèo lướt trên mặt nước bèo tấm.',
    category: 'history',
    tags: ['di tích lịch sử', 'căn cứ kháng chiến', 'xuồng ba lá', 'rừng tràm', 'sinh thái'],
    area: 'cao-lanh',
    address: 'Ấp 4, Xã Mỹ Hiệp, Huyện Cao Lãnh, Tỉnh Đồng Tháp',
    coordinates: { lat: 10.48, lng: 105.73 },
    estimatedVisitDuration: { minutes: 120, isEstimate: false, note: 'Bao gồm đi bộ tham quan và trải nghiệm xuồng ba lá.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1200&auto=format&fit=crop&q=80',
        alt: 'Xuồng ba lá len lỏi trong rừng tràm xanh ngắt Xẻo Quýt',
        credit: 'Unsplash Forest & Water',
      },
      {
        url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&auto=format&fit=crop&q=80',
        alt: 'Không gian tĩnh lặng rợp bóng mát tại căn cứ Xẻo Quýt',
        credit: 'Unsplash Nature Explorer',
      },
    ],
    openingHours: '07:30 – 17:00 hàng ngày',
    referencePrice: 'Vé vào cổng 20.000 VNĐ; Vé xuồng ba lá len lỏi rừng tràm 25.000 VNĐ/người',
    contactInfo: { phone: '0277 3910 397' },
    sourceUrls: ['https://dongthap.gov.vn'],
    publicationStatus: 'published',
  },
  {
    slug: 'khu-di-tich-go-thap',
    name: 'Khu di tích Gò Tháp & Đồng Sen Tháp Mười',
    summary: 'Di tích quốc gia đặc biệt với dấu tích văn hóa Óc Eo cổ đại và xứ sở sen hồng ngát hương.',
    description:
      'Gò Tháp là di tích khảo cổ học tầm cỡ quốc tế tại trung tâm Đồng Tháp Mười, lưu giữ hệ thống di chỉ nền đền tháp, tượng thần Visnu và các bia ký cổ thuộc vương quốc Phù Nam xưa (thế kỷ II đến VI). Ngoài ra, Gò Tháp còn gắn liền với căn cứ nghĩa quân Đốc Binh Kiều và Thiên Hộ Dương thời chống Pháp. Vào mùa sen nở (từ tháng 5 đến tháng 11), bạt ngàn đồng sen Tháp Mười quanh khu di tích nở rộ rực rỡ, là điểm check-in và thưởng thức trà ướp hoa sen nức tiếng.',
    category: 'culture',
    tags: ['di tích quốc gia đặc biệt', 'Óc Eo', 'khảo cổ', 'hoa sen', 'Đồng Tháp Mười', 'tín ngưỡng'],
    area: 'thap-muoi',
    address: 'Ấp 1, Xã Tân Kiều, Huyện Tháp Mười, Tỉnh Đồng Tháp',
    coordinates: { lat: 10.6333, lng: 105.85 },
    estimatedVisitDuration: { minutes: 150, isEstimate: false, note: 'Khám phá đền tháp Óc Eo và ngắm cánh đồng sen.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&auto=format&fit=crop&q=80',
        alt: 'Hoa sen Đồng Tháp Mười nở rộ tinh khiết',
        credit: 'Unsplash Lotus Flora',
      },
      {
        url: 'https://images.unsplash.com/photo-1596726909477-09d6f082e6d6?w=1200&auto=format&fit=crop&q=80',
        alt: 'Cánh đồng sen Tháp Mười bạt ngàn ngát hương',
        credit: 'Unsplash Vietnam Travel',
      },
    ],
    openingHours: '07:00 – 17:30 hàng ngày',
    referencePrice: 'Vé vào cổng di tích: Miễn phí; Trải nghiệm chèo xuồng ngắm sen: 30.000 – 50.000 VNĐ/người',
    contactInfo: { phone: '0277 3956 123' },
    sourceUrls: ['https://vi.wikipedia.org/wiki/Khu_di_t%C3%ADch_G%C3%B2_Th%C3%A1p'],
    publicationStatus: 'published',
  },
  {
    slug: 'lang-hoa-sa-dec',
    name: 'Làng hoa Sa Đéc (Tân Quy Đông)',
    summary: 'Thủ phủ hoa kiểng hơn 300 năm tuổi của miền Tây với nét độc đáo hoa trồng trên giàn sông Tiền.',
    description:
      'Làng hoa Sa Đéc là một trong những làng hoa kiểng lâu đời và lớn nhất Việt Nam với diện tích hơn 600ha và trên 2.000 loài hoa quý. Điểm độc đáo hiếm có ở Sa Đéc là hoa được trồng trên những giàn tre cao trên mặt nước; người dân chèo xuồng lướt giữa các luống hoa để tưới nước và chăm sóc, tạo nên khung cảnh nên thơ tuyệt đẹp. Du khách có thể dạo bước trên Đường hoa Sa Nhiên – Cai Dao, lên Đài quan sát ngắm toàn cảnh thung lũng hoa và check-in các tiểu cảnh hoa cúc mâm xôi rực rỡ.',
    category: 'culture',
    tags: ['làng hoa', 'check-in', 'cúc mâm xôi', 'làng nghề truyền thống', 'hoa kiểng', 'sông Tiền'],
    area: 'sa-dec',
    address: 'Đường Sa Nhiên – Cai Dao, Phường Tân Quy Đông, TP. Sa Đéc, Tỉnh Đồng Tháp',
    coordinates: { lat: 10.306, lng: 105.748 },
    estimatedVisitDuration: { minutes: 120, isEstimate: false, note: 'Đẹp nhất từ tháng 11 đến Tết Nguyên Đán.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1508615039623-a25605d2b022?w=1200&auto=format&fit=crop&q=80',
        alt: 'Bạt ngàn muôn sắc hoa cúc mâm xôi Làng hoa Sa Đéc',
        credit: 'Unsplash Floral Art',
      },
      {
        url: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1200&auto=format&fit=crop&q=80',
        alt: 'Hoa kiểng khoe sắc rực rỡ bên bến sông Sa Đéc',
        credit: 'Unsplash Garden Collection',
      },
    ],
    openingHours: '06:00 – 18:30 hàng ngày',
    referencePrice: 'Vé vào đường hoa tham quan tự do miễn phí; Các khu du lịch tiểu cảnh tư nhân 50.000 – 100.000 VNĐ/vé',
    contactInfo: { phone: '0277 3861 240' },
    sourceUrls: ['https://sadec.dongthap.gov.vn'],
    publicationStatus: 'published',
  },
  {
    slug: 'nha-co-huynh-thuy-le',
    name: 'Nhà cổ Huỳnh Thủy Lê',
    summary: 'Ngôi nhà cổ lãng mạn bên sông Sa Đéc gắn liền với mối tình trong tác phẩm văn học bất hủ "Người Tình".',
    description:
      'Được xây dựng năm 1895 bởi ông Huỳnh Thuận và trùng tu năm 1917, ngôi nhà cổ là tuyệt tác kiến trúc kết hợp hài hòa giữa phong cách Pháp, Hoa và Nam Bộ. Mặt tiền mang dáng dấp biệt thự La Mã cổ điển, bên trong chạm khắc sơn son thếp vàng tinh xảo hình chim muông hoa lá theo văn hóa phương Đông. Nơi đây là chứng nhân của mối tình lãng mạn giữa chàng công tử họ Huỳnh và nữ văn sĩ người Pháp Marguerite Duras, được bà chấp bút thành tiểu thuyết nổi tiếng "L\'Amant" (đoạt giải Goncourt và chuyển thể thành phim điện ảnh Hollywood).',
    category: 'culture',
    tags: ['nhà cổ', 'kiến trúc Á Âu', 'Người Tình', 'Marguerite Duras', 'lịch sử', 'check-in'],
    area: 'sa-dec',
    address: 'Số 255A Đường Nguyễn Huệ, Phường 2, TP. Sa Đéc, Tỉnh Đồng Tháp',
    coordinates: { lat: 10.2935, lng: 105.7625 },
    estimatedVisitDuration: { minutes: 60, isEstimate: false, note: 'Bao gồm nghe thuyết minh viên kể chuyện và thưởng thức trà mứt.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80',
        alt: 'Kiến trúc cổ kính bên sông Sa Đéc của Nhà cổ Huỳnh Thủy Lê',
        credit: 'Unsplash Vintage Heritage',
      },
    ],
    openingHours: '08:00 – 17:30 hàng ngày',
    referencePrice: '40.000 VNĐ/người (đã bao gồm thuyết minh tiếng Việt/Anh/Pháp và phần trà mứt gừng đón khách)',
    contactInfo: { phone: '0277 3869 966' },
    sourceUrls: ['https://vi.wikipedia.org/wiki/Nh%C3%A0_c%E1%BB%95_Hu%E1%BB%B3nh_Th%E1%BB%A7y_L%C3%AA'],
    publicationStatus: 'published',
  },
  {
    slug: 'khu-di-tich-nguyen-sinh-sac',
    name: 'Khu di tích Cụ Phó bảng Nguyễn Sinh Sắc',
    summary: 'Khu lưu niệm Cụ Phó bảng thân sinh Chủ tịch Hồ Chí Minh và tái hiện làng Hòa An cổ truyền.',
    description:
      'Khu di tích rộng gần 10ha tọa lạc tại trung tâm thành phố Cao Lãnh, là nơi yên nghỉ của Cụ Phó bảng Nguyễn Sinh Sắc – nhà nho yêu nước, thân sinh Chủ tịch Hồ Chí Minh kính yêu. Quần thể gồm vòm mộ Cụ Phó bảng hình cánh sen cách điệu bằng đá cẩm thạch trắng, nhà trưng bày cuộc đời sự nghiệp, khu mô phỏng nhà sàn Bác Hồ tỉ lệ 1:1 và đặc biệt là không gian Làng cổ Hòa An tái hiện nếp sống, rạch nước, vườn cây, nhà gỗ truyền thống của người dân Đồng Tháp đầu thế kỷ XX.',
    category: 'history',
    tags: ['di tích lịch sử', 'Nguyễn Sinh Sắc', 'làng cổ Hòa An', 'Bác Hồ', 'văn hóa'],
    area: 'cao-lanh',
    address: 'Số 123/1 Đường Phạm Hữu Lầu, Phường 4, TP. Cao Lãnh, Tỉnh Đồng Tháp',
    coordinates: { lat: 10.4685, lng: 105.6363 },
    estimatedVisitDuration: { minutes: 90, isEstimate: false, note: 'Viếng lăng mộ, tham quan nhà lưu niệm và làng Hòa An.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200&auto=format&fit=crop&q=80',
        alt: 'Không gian tôn nghiêm và thanh tịnh tại Khu di tích Cụ Phó bảng Nguyễn Sinh Sắc',
        credit: 'Unsplash Heritage Monument',
      },
    ],
    openingHours: '07:00 – 11:30, 13:30 – 17:00 hàng ngày',
    referencePrice: 'Miễn phí vé tham quan toàn bộ khu di tích',
    contactInfo: { phone: '0277 3851 525' },
    sourceUrls: ['https://ditichnguyensinhsac.dongthap.gov.vn'],
    publicationStatus: 'published',
  },
  {
    slug: 'chua-phuoc-kien-la-sen-vua',
    name: 'Chùa Phước Kiển (Chùa Lá Sen Vua)',
    summary: 'Ngôi chùa cổ linh thiêng nổi tiếng với ao sen khổng lồ có lá cõng được người lớn nặng tới 80kg.',
    description:
      'Chùa Phước Kiển (hay còn gọi là Chùa Lá Sen) được xây dựng từ thời vua Thiệu Trị tại huyện Châu Thành, Đồng Tháp. Điểm kỳ lạ và thu hút du khách khắp nơi đổ về chiêm bái là ao sen vua (Victoria Regia). Lá sen có đường kính từ 2 mét đến gần 3 mét, vành lá uốn cong lên 4-5cm như chiếc nón quai thao khổng lồ bập bềnh trên mặt nước. Du khách có thể bước lên tấm mâm gỗ đặt trên lá sen để chụp những bức ảnh độc nhất vô nhị mà lá sen vẫn không hề chìm.',
    category: 'culture',
    tags: ['chùa cổ', 'lá sen vua', 'kỳ quan', 'check-in độc lạ', 'tâm linh', 'Châu Thành'],
    area: 'sa-dec',
    address: 'Xã Hòa Tân, Huyện Châu Thành, Tỉnh Đồng Tháp (cách Sa Đéc khoảng 15km)',
    coordinates: { lat: 10.2312, lng: 105.815 },
    estimatedVisitDuration: { minutes: 60, isEstimate: false, note: 'Thích hợp đi vào ban ngày lúc trời sáng rõ để chụp ảnh lá sen.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1618255904668-3bfb78f4a13d?w=1200&auto=format&fit=crop&q=80',
        alt: 'Lá sen vua khổng lồ cõng được người tại chùa Phước Kiển Đồng Tháp',
        credit: 'Unsplash Giant Water Lily',
      },
    ],
    openingHours: '07:00 – 18:00 hàng ngày',
    referencePrice: 'Vào chùa miễn phí; Phí chụp ảnh đứng lên lá sen: 20.000 – 30.000 VNĐ/người (ủng hộ nhà chùa)',
    contactInfo: { phone: '0277 3842 119' },
    sourceUrls: ['https://dongthap.gov.vn'],
    publicationStatus: 'published',
  },
  {
    slug: 'khu-du-lich-sinh-thai-gao-giong',
    name: 'Khu du lịch sinh thái Gáo Giồng',
    summary: 'Ốc đảo xanh của vùng Đồng Tháp Mười, thưởng thức chợ quê miệt vườn trên chòi tre giữa rừng tràm.',
    description:
      'Gáo Giồng (Cao Lãnh) được ví như "lá phổi xanh" của Đồng Tháp Mười với rừng tràm bạt ngàn rộng 1.700ha. Du khách sẽ leo lên đài quan sát cao 18m ngắm toàn cảnh thảm xanh mênh mông, ngồi xuồng ba lá lướt qua sân chim với hàng chục ngàn con cò trắng, cồng cộc, trích mồng đỏ ríu rít gọi bầy. Đặc biệt, khu ẩm thực nhà chòi giữa rừng tràm phục vụ các món ăn đồng quê chuẩn vị: cá rô kho tộ tộ đất, cá lóc nướng trui cuốn lá sen non, ốc lác hấp sả, canh chua bông điên điển mùa nước nổi.',
    category: 'eco',
    tags: ['sinh thái', 'rừng tràm', 'vườn chim', 'chợ quê', 'xuồng ba lá', 'ẩm thực đồng quê'],
    area: 'cao-lanh',
    address: 'Ấp 6, Xã Gáo Giồng, Huyện Cao Lãnh, Tỉnh Đồng Tháp',
    coordinates: { lat: 10.552, lng: 105.586 },
    estimatedVisitDuration: { minutes: 180, isEstimate: false, note: 'Rất thích hợp cho bữa trưa thưởng thức ẩm thực đồng quê.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=1200&auto=format&fit=crop&q=80',
        alt: 'Cảnh sắc miệt vườn sông nước thanh bình tại Gáo Giồng',
        credit: 'Unsplash River Life',
      },
    ],
    openingHours: '07:00 – 17:30 hàng ngày',
    referencePrice: 'Vé cổng: 20.000 VNĐ; Vé xuồng ba lá ngắm vườn chim: 30.000 VNĐ/người; Ăn uống: 150.000 – 250.000 VNĐ/người',
    contactInfo: { phone: '0277 3926 093' },
    sourceUrls: ['https://dongthap.gov.vn'],
    publicationStatus: 'published',
  },

  // ===========================================================================
  // II. CỤM CÙ LAO THỚI SƠN (CỒN THỚI SƠN - TIỀN GIANG / ĐỒNG THÁP)
  // ===========================================================================
  {
    slug: 'khu-du-lich-sinh-thai-thoi-son',
    name: 'Điểm Du lịch Sinh thái Cù lao Thới Sơn (Cồn Lân)',
    summary: 'Cù lao sông nước hữu tình lớn nhất sông Tiền, chèo xuồng dừa nước và thưởng thức đờn ca tài tử.',
    description:
      'Cù lao Thới Sơn (còn gọi là Cồn Lân) nằm giữa dòng sông Tiền thơ mộng, là viên ngọc quý của du lịch miệt vườn miền Tây. Đến Thới Sơn, du khách sẽ được đi thuyền máy ngắm cầu Rạch Miễu, chuyển sang xuồng chèo ba lá len lỏi dưới bóng râm của những hàng dừa nước xanh ngắt, dạo bước trên đường làng rợp bóng cây ăn trái, ngồi thưởng thức đĩa trái cây tươi ngon vừa hái tại vườn trong tiếng đàn kìm, đàn tranh và giọng ca ngọt ngào của nghệ nhân đờn ca tài tử Nam Bộ.',
    category: 'local_experience',
    tags: ['cù lao Thới Sơn', 'cồn Lân', 'xuồng dừa nước', 'đờn ca tài tử', 'miệt vườn', 'sông Tiền', 'trái cây'],
    area: 'thoi-son',
    address: 'Cù lao Thới Sơn, Xã Thới Sơn, TP. Mỹ Tho (kết nối trực tiếp qua Cầu Rạch Miễu)',
    coordinates: { lat: 10.334, lng: 106.342 },
    estimatedVisitDuration: { minutes: 150, isEstimate: false, note: 'Bao gồm đi thuyền lớn, đò chèo, nghe đờn ca tài tử và ăn trái cây.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1528127269322-539801943592?w=1200&auto=format&fit=crop&q=80',
        alt: 'Trải nghiệm ngồi đò chèo ba lá trong rạch dừa nước Cù lao Thới Sơn',
        credit: 'Unsplash Mekong Delta Paddle Boat',
      },
      {
        url: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=1200&auto=format&fit=crop&q=80',
        alt: 'Khung cảnh làng quê sông nước yên ả trên cù lao Thới Sơn',
        credit: 'Unsplash Delta Journey',
      },
    ],
    openingHours: '07:30 – 17:30 hàng ngày',
    referencePrice: 'Trọn gói tour miệt vườn (thuyền sông Tiền + đò chèo + trái cây + trà mật ong + đờn ca tài tử): 80.000 – 120.000 VNĐ/khách',
    contactInfo: { phone: '0273 3874 444' },
    sourceUrls: ['https://dulichtiengiang.gov.vn'],
    publicationStatus: 'published',
  },
  {
    slug: 'trai-ong-mat-hoa-nhan-thoi-son',
    name: 'Trại Nuôi Ong Mật Hoa Nhãn & Lò Kẹo Dừa Thới Sơn',
    summary: 'Trải nghiệm thưởng thức ly trà mật ong hoa nhãn tắc ấm nồng và ăn kẹo dừa sầu riêng dẻo quánh vừa nung nóng.',
    description:
      'Điểm dừng chân đặc sắc bậc nhất trên cù lao Thới Sơn được hàng loạt vlogger du lịch trên TikTok và YouTube khen ngợi. Du khách được tự tay cầm cầu ong mật chụp ảnh lưu niệm hoàn toàn an toàn, nhâm nhi tách trà nóng pha mật ong hoa nhãn nguyên chất hòa cùng nước tắc và phấn hoa giúp thanh lọc cơ thể. Ngay bên cạnh là lò kẹo dừa truyền thống, nơi du khách tận mắt chứng kiến công đoạn nạo dừa, ép cốt dừa, sên kẹo trên chảo gang đỏ lửa và thưởng thức viên kẹo dừa lá dứa, sầu riêng thơm lừng vừa cắt nóng hổi.',
    category: 'local_experience',
    tags: ['trại ong mật', 'trà mật ong tắc', 'lò kẹo dừa', 'làng nghề thủ công', 'quà tặng miền Tây', 'Thới Sơn'],
    area: 'thoi-son',
    address: 'Ấp Thới Hòa, Xã Thới Sơn, TP. Mỹ Tho (thuộc tuyến tour Cù lao Thới Sơn)',
    coordinates: { lat: 10.3315, lng: 106.345 },
    estimatedVisitDuration: { minutes: 60, isEstimate: false, note: 'Uống trà mật ong, nếm thử kẹo dừa và mua đặc sản làm quà.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=1200&auto=format&fit=crop&q=80',
        alt: 'Trại nuôi ong mật hoa nhãn tự nhiên tại cù lao Thới Sơn',
        credit: 'Unsplash Honey Bee Nature',
      },
    ],
    openingHours: '07:30 – 17:30 hàng ngày',
    referencePrice: 'Vào cổng nếm thử kẹo dừa & uống trà mật ong miễn phí; Hũ mật ong hoa nhãn 120.000 – 200.000 VNĐ; Kẹo dừa 35.000 – 50.000 VNĐ/hộp',
    contactInfo: { phone: '0918 234 567' },
    sourceUrls: ['https://dulichtiengiang.gov.vn'],
    publicationStatus: 'published',
  },
  {
    slug: 'nha-hang-mekong-taste-thoi-son',
    name: 'Nhà hàng Sinh thái Mekong Taste Thới Sơn',
    summary: 'Thưởng thức Cá tai tượng chiên xù dựng đứng giòn rụm, xôi chiên phồng tròn xoe trong không gian ven sông Tiền lộng gió.',
    description:
      'Nằm trên dải đất ấp Thới Thạnh sát mép sông Tiền, Mekong Taste là nhà hàng sinh thái miệt vườn nổi tiếng nhất tại Cù lao Thới Sơn được review triệu view trên mạng xã hội. Món ăn biểu tượng không thể bỏ qua tại đây là Cá tai tượng chiên xù chiên vàng ruộm giòn tan nguyên vảy, được cuốn cùng bánh tráng, khế chua, chuối chát, rau đọt cóc miệt vườn chấm nước mắm tỏi ớt chua ngọt pha chuẩn vị. Thực đơn còn có xôi chiên phồng phồng to như quả bóng, gà ta thả vườn nướng đất sét thơm phức và lẩu mắm cá linh rau nhút.',
    category: 'food',
    tags: ['cá tai tượng chiên xù', 'ẩm thực Thới Sơn', 'xôi chiên phồng', 'nhà hàng ven sông', 'lẩu mắm', 'đặc sản sông Tiền'],
    area: 'thoi-son',
    address: 'Ấp Thới Thạnh, Xã Thới Sơn, TP. Mỹ Tho (ngay ngã ba rạch Thới Sơn nối sông Tiền)',
    coordinates: { lat: 10.337, lng: 106.338 },
    estimatedVisitDuration: { minutes: 90, isEstimate: false, note: 'Khung giờ ăn trưa lý tưởng nhất từ 11:30 đến 13:30.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=1200&auto=format&fit=crop&q=80',
        alt: 'Cá tai tượng chiên xù vàng ruộm đặc sản trứ danh sông nước Thới Sơn',
        credit: 'Unsplash Crispy Fish Cuisine',
      },
      {
        url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&auto=format&fit=crop&q=80',
        alt: 'Mâm cơm miệt vườn đậm chất Nam Bộ tại Mekong Taste Thới Sơn',
        credit: 'Unsplash Vietnamese Table',
      },
    ],
    openingHours: '09:00 – 21:00 hàng ngày',
    referencePrice: 'Mức chi trung bình: 130.000 – 250.000 VNĐ/người; Mẹt cá tai tượng chiên xù nguyên con từ 180.000 VNĐ',
    contactInfo: { phone: '0903 888 999', website: 'https://mekongtaste.com' },
    sourceUrls: ['https://mekongtaste.com'],
    publicationStatus: 'published',
  },

  // ===========================================================================
  // III. CỤM ĐỊA PHƯƠNG MỸ THO (TIỀN GIANG / ĐỒNG THÁP)
  // ===========================================================================
  {
    slug: 'hu-tieu-my-tho-trung-luong',
    name: 'Quán Hủ tiếu Mỹ Tho Cô Dung & Ngã Ba Trung Lương',
    summary: 'Món ngon di sản ẩm thực quốc gia với sợi hủ tiếu dai giòn độc nhất vô nhị, nước lèo tôm khô xương ống ngọt đậm.',
    description:
      'Hủ tiếu Mỹ Tho là niềm tự hào ẩm thực của người dân đồng bằng sông Cửu Long, được chế biến từ loại gạo Gò Cát (Mỹ Phong) cho ra sợi hủ tiếu trắng ngà, dai giòn sần sật không bị bở khi gặp nước sôi. Quán Cô Dung (37A Hùng Vương) và các quán hủ tiếu truyền thống khu vực ngã ba Trung Lương nổi tiếng với tô hủ tiếu khô trộn nước sốt tương đậm đà, bên trên phủ đầy thịt xá xíu thái mỏng, sườn non ninh nhừ, tôm tươi bóc vỏ, gan heo, trứng cút và tóp mỡ hành phi giòn tan, kèm tô nước súp xương hầm với củ cải và mực nướng ngọt thanh.',
    category: 'food',
    tags: ['hủ tiếu Mỹ Tho', 'hủ tiếu khô', 'ẩm thực trứ danh', 'ngon nức tiếng', 'đặc sản miền Tây', 'ăn sáng'],
    area: 'my-tho',
    address: 'Số 37A Đường Hùng Vương, Phường 1, TP. Mỹ Tho (hoặc khu vực vòng xoay Trung Lương)',
    coordinates: { lat: 10.359, lng: 106.362 },
    estimatedVisitDuration: { minutes: 45, isEstimate: false, note: 'Ăn sáng hoặc ăn tối đều rất ngon.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=1200&auto=format&fit=crop&q=80',
        alt: 'Tô hủ tiếu Mỹ Tho đầy đặn tôm thịt nước dùng xương ống ngọt thanh',
        credit: 'Unsplash Asian Noodle Soup',
      },
    ],
    openingHours: '06:00 – 21:30 hàng ngày',
    referencePrice: '40.000 – 65.000 VNĐ/tô thập cẩm đặc biệt',
    contactInfo: { phone: '0273 3872 111' },
    sourceUrls: ['https://dulichtiengiang.gov.vn'],
    publicationStatus: 'published',
  },
  {
    slug: 'chua-vinh-trang-my-tho',
    name: 'Chùa Vĩnh Tràng Mỹ Tho',
    summary: 'Ngôi chùa cổ danh tiếng bậc nhất miền Tây với pho tượng Phật Di Lặc khổng lồ và kiến trúc giao thoa Đông – Tây kỳ vĩ.',
    description:
      'Chùa Vĩnh Tràng (khởi dựng đầu thế kỷ XIX) là ngôi đại tự lớn nhất tỉnh Tiền Giang, được công nhận là Di tích Lịch sử – Văn hóa cấp quốc gia. Kiến trúc ngôi chùa là sự kết hợp tuyệt mỹ giữa nét hoa văn Pháp, vòm cửa La Mã, tháp gốm Phục Hưng hòa cùng hoa văn rồng phượng cung đình Huế và mái ngói uốn cong truyền thống Nam Bộ. Khuôn viên rộng 2ha rợp mát bóng cây cổ thụ nổi bật với 3 pho đại tượng Phật khổng lồ: Phật A Di Đà đứng cao 24m, Phật Thích Ca nhập niết bàn dài 32m và tượng Phật Di Lặc từ bi cười rạng rỡ cao 20m.',
    category: 'culture',
    tags: ['chùa Vĩnh Tràng', 'kiến trúc cổ', 'Phật Di Lặc', 'di tích quốc gia', 'tâm linh', 'Mỹ Tho'],
    area: 'my-tho',
    address: 'Đường Nguyễn Trung Trực, Ấp Mỹ An, Xã Mỹ Phong, TP. Mỹ Tho, Tỉnh Đồng Tháp / Tiền Giang',
    coordinates: { lat: 10.3625, lng: 106.3768 },
    estimatedVisitDuration: { minutes: 75, isEstimate: false, note: 'Tham quan đại điện, vườn tháp và chiêm bái đại tượng Phật.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200&auto=format&fit=crop&q=80',
        alt: 'Kiến trúc tráng lệ của ngôi chùa Vĩnh Tràng tại Mỹ Tho',
        credit: 'Unsplash Ancient Temple Asia',
      },
    ],
    openingHours: '06:30 – 18:30 hàng ngày',
    referencePrice: 'Miễn phí vé vào cổng chiêm bái và vãn cảnh chùa',
    contactInfo: { phone: '0273 3873 427' },
    sourceUrls: ['https://vi.wikipedia.org/wiki/Ch%C3%B9a_V%C4%A9nh_Tr%C3%A0ng'],
    publicationStatus: 'published',
  },
  {
    slug: 'trai-ran-dong-tam',
    name: 'Trại Rắn Đồng Tâm (Trung tâm Dược liệu Quân khu 9)',
    summary: 'Vương quốc bò sát và trung tâm bảo tồn rắn độc lớn nhất Việt Nam phục vụ y học cứu người.',
    description:
      'Cách trung tâm Mỹ Tho khoảng 9km về phía tây bên bờ sông Tiền, Trại rắn Đồng Tâm rộng 12ha là bảo tàng sinh thái bò sát độc nhất vô nhị ở Đông Nam Á. Nơi đây nuôi dưỡng hàng ngàn cá thể rắn thuộc hơn 40 loài khác nhau từ rắn hổ mang chúa dài hơn 4 mét, trăn gấm, rắn lục đuôi đỏ đến các loài chim, vượn và thú quý hiếm. Du khách sẽ được các chiến sĩ hướng dẫn viên giải thích quy trình lấy nọc rắn điều chế huyết thanh cứu người, tham quan bảo tàng mẫu ngâm và vườn thảo dược quý.',
    category: 'eco',
    tags: ['trại rắn', 'bò sát', 'bảo tồn', 'sinh thái', 'khám phá', 'Đồng Tâm'],
    area: 'my-tho',
    address: 'Ấp Tân Thuận B, Xã Bình Đức, Huyện Châu Thành (sát ranh TP. Mỹ Tho)',
    coordinates: { lat: 10.347, lng: 106.289 },
    estimatedVisitDuration: { minutes: 90, isEstimate: false, note: 'Phù hợp gia đình có trẻ em khám phá thế giới sinh học.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1516214104703-d870798883c5?w=1200&auto=format&fit=crop&q=80',
        alt: 'Khuôn viên sinh thái xanh rợp bóng mát tại Trại rắn Đồng Tâm',
        credit: 'Unsplash Eco Wildlife',
      },
    ],
    openingHours: '07:00 – 17:00 hàng ngày',
    referencePrice: 'Vé vào cổng: 30.000 VNĐ/trẻ em, 50.000 VNĐ/người lớn',
    contactInfo: { phone: '0273 3853 205' },
    sourceUrls: ['https://dulichtiengiang.gov.vn'],
    publicationStatus: 'published',
  },
  {
    slug: 'chao-ca-loc-rau-dang-my-tho',
    name: 'Quán Cháo Cá lóc Rau đắng Chợ Vòng Nhỏ',
    summary: 'Thưởng thức tô cháo cá lóc đồng rau đắng đất trứ danh được các YouTuber ẩm thực săn lùng.',
    description:
      'Nằm trên đường Lê Thị Hồng Gấm gần Chợ Vòng Nhỏ (Phường 4, Mỹ Tho), các hàng cháo cá lóc rau đắng ở đây nức tiếng bao thế hệ người sành ăn sông Tiền. Cá lóc đồng tươi sống thịt chắc nịch được luộc chín, lọc sạch xương, xào sơ hành thơm. Tô cháo hoa bung đều nóng rẫy được múc ra bát, rắc thêm tiêu sọ, gừng xắt chỉ và hành hoa. Ăn kèm đĩa rau đắng đất mọc hoang dại giòn giòn nhân nhẫn đầu lưỡi nhưng để lại hậu vị ngọt sâu khó quên, chấm cùng chén nước mắm nhĩ dầm ớt hiểm cay nồng.',
    category: 'food',
    tags: ['cháo cá lóc', 'rau đắng đất', 'chợ Vòng Nhỏ', 'đặc sản Mỹ Tho', 'quán local', 'ẩm thực đêm'],
    area: 'my-tho',
    address: 'Khu vực Chợ Vòng Nhỏ, Đường Lê Thị Hồng Gấm, Phường 4, TP. Mỹ Tho',
    coordinates: { lat: 10.354, lng: 106.353 },
    estimatedVisitDuration: { minutes: 45, isEstimate: false, note: 'Bán ngon nhất vào buổi xế chiều và tối (15:00 – 22:30).' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=1200&auto=format&fit=crop&q=80',
        alt: 'Tô cháo cá lóc đồng rau đắng nóng hổi ngọt đậm đà',
        credit: 'Unsplash Hot Porridge Bowl',
      },
    ],
    openingHours: '15:00 – 23:00 hàng ngày',
    referencePrice: '30.000 – 50.000 VNĐ/tô cháo cá lóc đặc biệt (kèm đầu cá hoặc trứng cá)',
    contactInfo: { phone: '0939 123 456' },
    sourceUrls: ['https://dulichtiengiang.gov.vn'],
    publicationStatus: 'published',
  },
  {
    slug: 'cho-dem-bo-ke-my-tho',
    name: 'Phố Ẩm thực & Chợ đêm Bờ kè Sông Tiền Mỹ Tho',
    summary: 'Không gian ẩm thực đường phố sôi động gió sông lộng mát với món Bánh vá (bánh cóng), bánh bèo và nước mía sầu riêng.',
    description:
      'Kéo dài dọc theo đường 30 Tháng 4 và đường Trưng Trắc sát bờ sông Tiền đối diện cù lao Thới Sơn, phố đêm Mỹ Tho là nơi nhộn nhịp nhất thành phố khi màn đêm buông xuống. Du khách vừa tản bộ hóng gió sông Tiền lồng lộng vừa thưởng thức món Bánh vá Giồng Dứa (bánh cóng tôm thịt giòn rụm), đĩa bánh bèo nước cốt dừa béo bùi, nghêu sò ốc hến tươi rói xào sa tế và ly nước mía sầu riêng thơm nức mũi.',
    category: 'food',
    tags: ['chợ đêm', 'bờ kè sông Tiền', 'bánh cóng', 'bánh vá', 'ẩm thực đêm', 'dạo phố'],
    area: 'my-tho',
    address: 'Đường 30 Tháng 4 & Đường Trưng Trắc, Phường 1, TP. Mỹ Tho',
    coordinates: { lat: 10.352, lng: 106.364 },
    estimatedVisitDuration: { minutes: 90, isEstimate: false, note: 'Đẹp nhất từ 18:30 đến 22:00.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&auto=format&fit=crop&q=80',
        alt: 'Phố đêm ẩm thực bờ sông Tiền lung linh nhộn nhịp',
        credit: 'Unsplash Night Market Scene',
      },
    ],
    openingHours: '17:00 – 23:30 hàng ngày',
    referencePrice: 'Món ăn vặt từ 15.000 – 50.000 VNĐ; Ốc và hải sản từ 50.000 – 120.000 VNĐ/đĩa',
    contactInfo: { phone: '0273 3888 777' },
    sourceUrls: ['https://dulichtiengiang.gov.vn'],
    publicationStatus: 'published',
  },

  // ===========================================================================
  // IV. CỤM LOCAL FOOD & ĐẶC SẢN NỨC TIẾNG ĐỒNG THÁP
  // ===========================================================================
  {
    slug: 'hu-tieu-sa-dec-ba-sam',
    name: 'Quán Hủ tiếu Sa Đéc Bà Sẩm (Hơn 50 năm truyền thống)',
    summary: 'Hàng hủ tiếu bình dân lâu đời nhất Sa Đéc, giữ trọn hương vị bột gạo truyền thống với giá siêu yêu thương.',
    description:
      'Nhắc đến hủ tiếu Sa Đéc trên TikTok và các kênh du lịch miền Tây, tiệm hủ tiếu Bà Sẩm trên đường Trần Hưng Đạo luôn là cái tên đứng đầu danh sách đề xuất. Trải qua hơn nửa thế kỷ cha truyền con nối, quán vẫn giữ mức giá bình dân mộc mạc phục vụ từ người lao động đến du khách thập phương. Điểm đặc trưng làm nên thương hiệu là bánh hủ tiếu sợi to bản vừa phải, làm từ bột gạo lọc Sa Đéc trứ danh nên dẻo thơm tự nhiên, chan nước lèo xương ống ninh trong vắt ngọt thanh tao.',
    category: 'food',
    tags: ['hủ tiếu Sa Đéc', 'bà Sẩm', 'quán gia truyền', 'ẩm thực local', 'bột gạo Sa Đéc', 'ăn sáng'],
    area: 'sa-dec',
    address: 'Số 188 Đường Trần Hưng Đạo, Khóm 1, Phường 1, TP. Sa Đéc, Tỉnh Đồng Tháp',
    coordinates: { lat: 10.2982, lng: 105.7595 },
    estimatedVisitDuration: { minutes: 40, isEstimate: false, note: 'Quán đông vào buổi sáng sớm từ 06:30 đến 08:30.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=1200&auto=format&fit=crop&q=80',
        alt: 'Tô hủ tiếu Sa Đéc Bà Sẩm truyền thống thơm nức mũi',
        credit: 'Unsplash Sa Dec Rice Noodle',
      },
    ],
    openingHours: '06:00 – 21:00 hàng ngày',
    referencePrice: '15.000 – 35.000 VNĐ/tô (siêu bình dân và chất lượng)',
    contactInfo: { phone: '0277 3862 345' },
    sourceUrls: ['https://sadec.dongthap.gov.vn'],
    publicationStatus: 'published',
  },
  {
    slug: 'hu-tieu-phu-thanh-sa-dec',
    name: 'Quán Hủ tiếu Phú Thành Sa Đéc',
    summary: 'Quán hủ tiếu khô nước sốt gia truyền nổi tiếng sang trọng và chuẩn vị bậc nhất thành phố hoa.',
    description:
      'Hủ tiếu Phú Thành là điểm dừng chân ẩm thực cao cấp và danh tiếng tại Sa Đéc, không gian khang trang sạch sẽ với bãi đỗ xe thuận tiện. Món "vedette" của quán là Hủ tiếu khô Sa Đéc: từng sợi hủ tiếu bột tươi được chần qua nước sôi vừa tới, trộn đều với nước sốt chua ngọt màu nâu sẫm bí truyền sánh quyện, bên trên phủ ngập sườn non mềm rục, tim, gan, xá xíu thái mỏng và tôm tươi sông Tiền. Khi ăn rắc thêm cần tây và hẹ hoa, cắn thêm miếng ớt sừng cay xè thì tuyệt đỉnh phong vị.',
    category: 'food',
    tags: ['hủ tiếu khô Phú Thành', 'hủ tiếu Sa Đéc', 'quán nổi tiếng', 'ẩm thực sạch sẽ', 'Sa Đéc'],
    area: 'sa-dec',
    address: 'Số 75 Đường Trần Hưng Đạo, Phường 1, TP. Sa Đéc, Tỉnh Đồng Tháp',
    coordinates: { lat: 10.2965, lng: 105.761 },
    estimatedVisitDuration: { minutes: 45, isEstimate: false, note: 'Rất thích hợp cho gia đình và đoàn khách du lịch.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=1200&auto=format&fit=crop&q=80',
        alt: 'Đĩa hủ tiếu khô Sa Đéc trộn nước sốt đậm đà tại quán Phú Thành',
        credit: 'Unsplash Dry Noodle Special',
      },
    ],
    openingHours: '06:00 – 22:00 hàng ngày',
    referencePrice: '35.000 – 60.000 VNĐ/tô',
    contactInfo: { phone: '0277 3863 777' },
    sourceUrls: ['https://sadec.dongthap.gov.vn'],
    publicationStatus: 'published',
  },
  {
    slug: 'quan-an-tam-yen-sa-dec',
    name: 'Quán ăn Tám Yến Sa Đéc (Đặc sản Đồng quê & Lẩu Mắm)',
    summary: 'Điểm hẹn ẩm thực sân vườn xanh mát chuyên phục vụ lẩu mắm cá linh, cá lóc nướng trui và vịt nướng.',
    description:
      'Tọa lạc trên trục đường lớn Nguyễn Tất Thành, quán ăn Tám Yến là địa chỉ ăn trưa và ăn tối quen thuộc của cả dân bản địa lẫn khách tour sành ăn khi đến Sa Đéc. Quán có khuôn viên sân vườn rợp bóng cây xanh mát mẻ, nổi tiếng với món Lẩu mắm miền Tây nấu từ mắm cá linh cá sặc đặc sánh, ăn kèm đĩa rau rừng hơn 15 loại: bông súng, bông điên điển, rau đắng, cù nèo, cà tím... Ngoài ra, món Cá lóc nướng trui đắp đất và Vịt xiêm nướng muối ớt da giòn rụm cũng là món "tủ" được du khách gọi nhiều nhất.',
    category: 'food',
    tags: ['lẩu mắm', 'cá lóc nướng trui', 'quán Tám Yến', 'vịt nướng Sa Đéc', 'quán sân vườn', 'đặc sản đồng quê'],
    area: 'sa-dec',
    address: 'Số 68 Đường Nguyễn Tất Thành, Phường 1, TP. Sa Đéc, Tỉnh Đồng Tháp',
    coordinates: { lat: 10.291, lng: 105.754 },
    estimatedVisitDuration: { minutes: 90, isEstimate: false, note: 'Thích hợp cho bữa trưa và bữa tối gia đình, nhóm bạn.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&auto=format&fit=crop&q=80',
        alt: 'Nồi lẩu mắm miền Tây ngập tràn tôm cá và rau đồng nội tại quán Tám Yến',
        credit: 'Unsplash Hotpot Cuisine',
      },
    ],
    openingHours: '09:00 – 22:30 hàng ngày',
    referencePrice: 'Chi tiêu trung bình: 100.000 – 220.000 VNĐ/người; Nồi lẩu mắm từ 200.000 VNĐ',
    contactInfo: { phone: '0277 3868 688' },
    sourceUrls: ['https://sadec.dongthap.gov.vn'],
    publicationStatus: 'published',
  },
  {
    slug: 'ca-loc-nuong-trui-la-sen-cao-lanh',
    name: 'Quán Cá lóc Nướng trui Cuốn Lá Sen Non Cao Lãnh',
    summary: 'Món ăn biểu tượng tinh hoa Đất Sen Hồng, cá đồng nướng rơm bọc lá sen non chấm mắm me chua cay.',
    description:
      'Đến Cao Lãnh – thủ phủ tỉnh Đồng Tháp mà chưa thưởng thức Cá lóc nướng trui cuốn lá sen non thì xem như chưa trọn vẹn chuyến đi. Con cá lóc đồng béo tròn được xiên que tre nướng rơm nguyên con thơm lừng mùi khói rạ đồng quê. Điểm tinh tế nhất của món ăn là không cuốn bánh tráng mà dùng chính những chiếc lá sen non bánh tẻ vừa hé nở trên đầm, cuốn cùng lát cá trắng muốt, một nhúm rau thơm, chuối xanh, khế chua rồi chấm ngập vào bát nước mắm me pha đường thốt nốt và ớt xiêm xanh.',
    category: 'food',
    tags: ['cá lóc nướng trui', 'lá sen non', 'đặc sản Cao Lãnh', 'tinh hoa Đất Sen Hồng', 'món ngon Đồng Tháp'],
    area: 'cao-lanh',
    address: 'Khu ẩm thực Bờ hồ Mai Văn Khải, Xã Mỹ Tân, TP. Cao Lãnh, Tỉnh Đồng Tháp',
    coordinates: { lat: 10.485, lng: 105.62 },
    estimatedVisitDuration: { minutes: 75, isEstimate: false, note: 'Ăn tối ven hồ ngắm gió mát Đồng Tháp rất thú vị.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=1200&auto=format&fit=crop&q=80',
        alt: 'Mẹt cá lóc nướng trui cuốn lá sen non đặc sản Cao Lãnh Đồng Tháp',
        credit: 'Unsplash Grilled Fish Lotus',
      },
    ],
    openingHours: '10:00 – 22:30 hàng ngày',
    referencePrice: '120.000 – 190.000 VNĐ/con cá lóc nướng đầy đặn mẹt rau sen',
    contactInfo: { phone: '0277 3899 123' },
    sourceUrls: ['https://dongthap.gov.vn'],
    publicationStatus: 'published',
  },
  {
    slug: 'banh-xeo-cao-lanh-ut-nang',
    name: 'Quán Bánh xèo Cao Lãnh Út Nàng',
    summary: 'Quán bánh xèo thịt vịt củ hủ dừa nức danh Cao Lãnh với viền bánh giòn tan mỏng tang như tờ giấy.',
    description:
      'Bánh xèo Cao Lãnh có nét đặc trưng rất riêng so với bánh xèo miền Tây khác: vỏ bánh được đổ trong chảo gang nhỏ, bột gạo lúa thơm pha nước cốt dừa béo ngậy được tráng mỏng tang giòn rụm màu vàng nghệ. Nhân bánh không dùng thịt heo mà dùng thịt vịt xiêm băm nhỏ cả xương mềm xào thơm, kết hợp củ hủ dừa ngọt giòn hoặc củ sắn thái chỉ và giá đỗ. Ăn kèm rổ rau rừng tươi rói hơn 20 loại hái từ vườn: lá cách, đọt xoài, lá lốt, sao nhái, chấm nước mắm chua ngọt dưa chua củ cải.',
    category: 'food',
    tags: ['bánh xèo Cao Lãnh', 'thịt vịt củ hủ dừa', 'Út Nàng', 'đặc sản Cao Lãnh', 'rau rừng', 'bánh dân gian'],
    area: 'cao-lanh',
    address: 'Số 226 Đường Lê Duẩn, Phường Mỹ Phú, TP. Cao Lãnh, Tỉnh Đồng Tháp',
    coordinates: { lat: 10.462, lng: 105.642 },
    estimatedVisitDuration: { minutes: 50, isEstimate: false, note: 'Nên ăn lúc bánh vừa trút khỏi chảo nóng giòn.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&auto=format&fit=crop&q=80',
        alt: 'Đĩa bánh xèo giòn rụm vàng óng ăn kèm rổ rau rừng Cao Lãnh',
        credit: 'Unsplash Crispy Pancake',
      },
    ],
    openingHours: '08:00 – 21:30 hàng ngày',
    referencePrice: '25.000 – 55.000 VNĐ/cái (nhân thịt vịt củ hủ dừa đặc biệt)',
    contactInfo: { phone: '0277 3871 888' },
    sourceUrls: ['https://dongthap.gov.vn'],
    publicationStatus: 'published',
  },
  {
    slug: 'co-so-nem-lai-vung-ut-thang',
    name: 'Cơ sở Nem Lai Vung Út Thẳng & Giáo Thơ',
    summary: 'Làng nghề di sản văn hóa phi vật thể quốc gia, xem quy trình gói nem lá chuối và nếm thử nem chua ngọt cay the.',
    description:
      '"Lai Vung là xứ lạ lùng / Nem chua một bọc đượm nồng tình quê". Làng nghề làm nem Lai Vung đã tồn tại gần 70 năm và được công nhận là Di sản Văn hóa Phi vật thể Quốc gia. Cơ sở Út Thẳng và Giáo Thơ nằm dọc Quốc lộ 54 là địa chỉ dừng chân mua quà nổi tiếng nhất. Nem được làm từ thịt heo nạc đùi quết nhuyễn trộn bì heo luộc xắt sợi chỉ, gia vị tỏi, tiêu hạt và ớt hiểm xanh, gói bằng lá chùm ruột hoặc lá vông rồi bọc nhiều lớp lá chuối tươi. Sau 3 ngày lên men tự nhiên, nem có màu đỏ hồng đẹp mắt, vị chua thanh ngọt bùi cay nồng cực kỳ bắt miệng.',
    category: 'local_experience',
    tags: ['nem Lai Vung', 'làng nghề di sản', 'đặc sản quà tặng', 'Út Thẳng', 'Lai Vung', 'nem chua'],
    area: 'lai-vung',
    address: 'Quốc lộ 54, Xã Tân Thành, Huyện Lai Vung, Tỉnh Đồng Tháp',
    coordinates: { lat: 10.222, lng: 105.645 },
    estimatedVisitDuration: { minutes: 40, isEstimate: false, note: 'Tham quan làm nem và mua nem chả, bì lụa về làm quà.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=1200&auto=format&fit=crop&q=80',
        alt: 'Chùm nem Lai Vung truyền thống thơm ngon đậm đà phong vị quê hương',
        credit: 'Unsplash Lai Vung Specialty',
      },
    ],
    openingHours: '06:30 – 21:00 hàng ngày',
    referencePrice: '35.000 – 50.000 VNĐ/xâu 10 chiếc nem chua; Nem đòn: 60.000 – 100.000 VNĐ/đòn',
    contactInfo: { phone: '0277 3848 555' },
    sourceUrls: ['https://laivung.dongthap.gov.vn'],
    publicationStatus: 'published',
  },
  {
    slug: 'khu-du-lich-van-hoa-phuong-nam',
    name: 'Khu du lịch Văn hóa Phương Nam',
    summary: 'Công trình kiến trúc đền thờ gỗ lim bề thế bậc nhất Nam Bộ, tôn vinh các bậc tiền nhân khai hoang mở cõi.',
    description:
      'Tọa lạc tại huyện Lấp Vò trên khuôn viên rộng hơn 5ha, Khu du lịch Văn hóa Phương Nam là công trình văn hóa tâm linh tráng lệ. Điểm nhấn trung tâm là Đền thờ Nam Phương Linh Từ được xây dựng hoàn toàn bằng gỗ lim theo phong cách kiến trúc cung đình cổ với 60 cột gỗ quý chạm trổ long lân quy phụng. Nơi đây thờ phụng 125 nhân vật lịch sử lỗi lạc có công khai phá và gìn giữ dải đất phương Nam như Nguyễn Hoàng, Nguyễn Hữu Cảnh, Mạc Cửu, Thoại Ngọc Hầu... Ngoài ra, khu du lịch còn có bảo tàng nông cụ, phố ẩm thực Nam Bộ và hồ sen cầu ngói cổ kính.',
    category: 'culture',
    tags: ['Nam Phương Linh Từ', 'kiến trúc gỗ lim', 'Lấp Vò', 'khai hoang mở cõi', 'văn hóa lịch sử', 'cầu ngói'],
    area: 'cao-lanh',
    address: 'Xã Long Hưng A, Huyện Lấp Vò, Tỉnh Đồng Tháp (giáp ranh TP. Cao Lãnh qua cầu Cao Lãnh)',
    coordinates: { lat: 10.362, lng: 105.578 },
    estimatedVisitDuration: { minutes: 90, isEstimate: false, note: 'Tham quan đền thờ, cầu ngói Nam Phương và chụp ảnh áo dài.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200&auto=format&fit=crop&q=80',
        alt: 'Đền thờ Nam Phương Linh Từ bằng gỗ lim uy nghiêm tráng lệ',
        credit: 'Unsplash Ancient Wooden Temple',
      },
    ],
    openingHours: '07:00 – 17:30 hàng ngày',
    referencePrice: 'Vé vào cổng: 50.000 VNĐ/người lớn; 30.000 VNĐ/trẻ em; Xe điện nội khu: 20.000 VNĐ',
    contactInfo: { phone: '0277 3849 888' },
    sourceUrls: ['https://dongthap.gov.vn'],
    publicationStatus: 'published',
  },
];
