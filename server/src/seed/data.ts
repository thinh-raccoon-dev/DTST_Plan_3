import type { Area, Category } from '../config/catalog.js';

/**
 * Pilot dataset. These are real, well-known places in Đồng Tháp (including the former Tiền Giang
 * area merged in 07/2025), but the descriptive text was written by the project team and has NOT
 * been verified against official sources. Every record is therefore flagged `isIllustrative`
 * and all verification levels are "unverified"/"unknown".
 *
 * Deliberately left empty: opening hours, ticket prices, phone numbers, exact addresses and images.
 * Coordinates are approximate (city/commune level) and must be checked before any real use.
 */
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
  estimatedVisitDuration?: { minutes: number; isEstimate: true; note: string };
  sourceUrls: string[];
  publicationStatus: 'draft' | 'published';
}

const ESTIMATE_NOTE = 'Ước tính của nhóm dự án, chưa có nguồn chính thức.';

export const seedDestinations: SeedDestination[] = [
  {
    slug: 'vuon-quoc-gia-tram-chim',
    name: 'Vườn quốc gia Tràm Chim',
    summary: 'Vùng đất ngập nước tiêu biểu của Đồng Tháp Mười, nơi gắn với loài sếu đầu đỏ.',
    description:
      'Vườn quốc gia Tràm Chim là một khu đất ngập nước thuộc vùng Đồng Tháp Mười, nổi tiếng với hệ sinh thái rừng tràm, đồng cỏ và nhiều loài chim nước. Nơi đây thường được nhắc đến gắn với loài sếu đầu đỏ. Du khách có thể tìm hiểu về bảo tồn thiên nhiên và hệ sinh thái mùa nước nổi. Nội dung này là dữ liệu minh họa, cần đối chiếu với nguồn chính thức trước khi sử dụng.',
    category: 'nature',
    tags: ['sinh thái', 'đất ngập nước', 'chim'],
    area: 'tam-nong',
    address: 'Huyện Tam Nông (địa danh trước sắp xếp hành chính), tỉnh Đồng Tháp',
    coordinates: { lat: 10.7167, lng: 105.5167 },
    estimatedVisitDuration: { minutes: 180, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: ['https://vi.wikipedia.org/wiki/V%C6%B0%E1%BB%9Dn_qu%E1%BB%91c_gia_Tr%C3%A0m_Chim'],
    publicationStatus: 'published',
  },
  {
    slug: 'khu-di-tich-go-thap',
    name: 'Khu di tích Gò Tháp',
    summary: 'Không gian di tích khảo cổ gắn với văn hóa Óc Eo và tín ngưỡng dân gian vùng Tháp Mười.',
    description:
      'Gò Tháp là khu di tích nằm trong vùng Đồng Tháp Mười, được biết đến với các dấu tích khảo cổ thuộc văn hóa Óc Eo cùng những câu chuyện lịch sử và tín ngưỡng dân gian của địa phương. Đây là điểm phù hợp với du khách quan tâm đến lịch sử và văn hóa. Nội dung này là dữ liệu minh họa, cần đối chiếu với nguồn chính thức.',
    category: 'history',
    tags: ['văn hóa', 'khảo cổ', 'Óc Eo'],
    area: 'thap-muoi',
    address: 'Huyện Tháp Mười (địa danh trước sắp xếp hành chính), tỉnh Đồng Tháp',
    coordinates: { lat: 10.6333, lng: 105.85 },
    estimatedVisitDuration: { minutes: 120, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'khu-di-tich-xeo-quyt',
    name: 'Khu di tích Xẻo Quýt',
    summary: 'Di tích lịch sử giữa rừng tràm, nơi tìm hiểu về căn cứ kháng chiến.',
    description:
      'Xẻo Quýt là khu di tích lịch sử nằm giữa rừng tràm, được biết đến như một căn cứ trong thời kỳ kháng chiến. Du khách có thể kết hợp tìm hiểu lịch sử với không gian sinh thái rừng tràm. Nội dung này là dữ liệu minh họa, cần đối chiếu với nguồn chính thức.',
    category: 'history',
    tags: ['sinh thái', 'rừng tràm'],
    area: 'cao-lanh',
    address: 'Huyện Cao Lãnh (địa danh trước sắp xếp hành chính), tỉnh Đồng Tháp',
    coordinates: { lat: 10.48, lng: 105.73 },
    estimatedVisitDuration: { minutes: 120, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'khu-di-tich-nguyen-sinh-sac',
    name: 'Khu di tích Nguyễn Sinh Sắc',
    summary: 'Khu di tích lưu niệm cụ Phó bảng Nguyễn Sinh Sắc tại Cao Lãnh.',
    description:
      'Khu di tích gắn với cụ Phó bảng Nguyễn Sinh Sắc, thân sinh của Chủ tịch Hồ Chí Minh, là điểm tham quan văn hóa – lịch sử tiêu biểu tại Cao Lãnh. Nội dung này là dữ liệu minh họa, cần đối chiếu với nguồn chính thức.',
    category: 'history',
    tags: ['văn hóa', 'lịch sử'],
    area: 'cao-lanh',
    address: 'Thành phố Cao Lãnh (địa danh trước sắp xếp hành chính), tỉnh Đồng Tháp',
    coordinates: { lat: 10.4685, lng: 105.6363 },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'nha-co-huynh-thuy-le',
    name: 'Nhà cổ Huỳnh Thủy Lê',
    summary: 'Ngôi nhà cổ bên sông Sa Đéc, gắn với tiểu thuyết "Người tình" của Marguerite Duras.',
    description:
      'Nhà cổ Huỳnh Thủy Lê nằm bên sông Sa Đéc, nổi tiếng với kiến trúc kết hợp Á – Âu và gắn với câu chuyện trong tiểu thuyết "Người tình" (L\'Amant) của nhà văn Marguerite Duras. Nội dung này là dữ liệu minh họa, cần đối chiếu với nguồn chính thức.',
    category: 'culture',
    tags: ['lịch sử', 'kiến trúc'],
    area: 'sa-dec',
    address: 'Thành phố Sa Đéc (địa danh trước sắp xếp hành chính), tỉnh Đồng Tháp',
    coordinates: { lat: 10.2935, lng: 105.7625 },
    estimatedVisitDuration: { minutes: 60, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: ['https://vi.wikipedia.org/wiki/Nh%C3%A0_c%E1%BB%95_Hu%E1%BB%B3nh_Th%E1%BB%A7y_L%C3%AA'],
    publicationStatus: 'published',
  },
  {
    slug: 'lang-hoa-sa-dec',
    name: 'Làng hoa Sa Đéc',
    summary: 'Làng nghề trồng hoa kiểng lâu đời, nhộn nhịp nhất vào dịp cuối năm.',
    description:
      'Làng hoa Sa Đéc là vùng trồng hoa kiểng nổi tiếng của Đồng Tháp. Du khách có thể dạo quanh các vườn hoa, tìm hiểu cách người dân canh tác và chụp ảnh. Thời điểm đẹp và giờ tham quan cần kiểm tra trước với địa phương. Nội dung này là dữ liệu minh họa.',
    category: 'local_experience',
    tags: ['thiên nhiên', 'làng nghề', 'hoa kiểng'],
    area: 'sa-dec',
    address: 'Thành phố Sa Đéc (địa danh trước sắp xếp hành chính), tỉnh Đồng Tháp',
    coordinates: { lat: 10.31, lng: 105.745 },
    estimatedVisitDuration: { minutes: 120, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'chua-vinh-trang',
    name: 'Chùa Vĩnh Tràng',
    summary: 'Ngôi chùa có kiến trúc độc đáo tại Mỹ Tho.',
    description:
      'Chùa Vĩnh Tràng tại Mỹ Tho là ngôi chùa được biết đến với lối kiến trúc giao thoa nhiều phong cách và khuôn viên rộng. Du khách cần ăn mặc lịch sự khi tham quan. Nội dung này là dữ liệu minh họa, cần đối chiếu với nguồn chính thức.',
    category: 'culture',
    tags: ['lịch sử', 'kiến trúc', 'tâm linh'],
    area: 'my-tho',
    address: 'Thành phố Mỹ Tho (địa danh trước sắp xếp hành chính), tỉnh Đồng Tháp',
    coordinates: { lat: 10.3585, lng: 106.3795 },
    estimatedVisitDuration: { minutes: 60, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: ['https://vi.wikipedia.org/wiki/Ch%C3%B9a_V%C4%A9nh_Tr%C3%A0ng'],
    publicationStatus: 'published',
  },
  {
    slug: 'con-thoi-son',
    name: 'Cồn Thới Sơn',
    summary: 'Cù lao trên sông Tiền với vườn trái cây, kênh rạch và trải nghiệm miệt vườn.',
    description:
      'Cồn Thới Sơn là cù lao trên sông Tiền gần Mỹ Tho, nơi du khách có thể đi xuồng trong rạch nhỏ, thăm vườn trái cây và nghe đờn ca tài tử. Các dịch vụ và giá cần kiểm tra trực tiếp với đơn vị cung cấp. Nội dung này là dữ liệu minh họa.',
    category: 'eco',
    tags: ['trải nghiệm địa phương', 'ẩm thực', 'miệt vườn'],
    area: 'my-tho',
    coordinates: { lat: 10.335, lng: 106.355 },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'cho-noi-cai-be',
    name: 'Chợ nổi Cái Bè',
    summary: 'Không gian mua bán trên sông đặc trưng miền Tây.',
    description:
      'Chợ nổi Cái Bè là nét sinh hoạt trên sông của miền Tây, thường nhộn nhịp vào sáng sớm. Quy mô chợ có thể thay đổi theo thời gian, du khách nên hỏi thông tin mới nhất trước khi đi. Nội dung này là dữ liệu minh họa.',
    category: 'local_experience',
    tags: ['ẩm thực', 'văn hóa', 'sông nước'],
    area: 'cai-be',
    coordinates: { lat: 10.335, lng: 106.03 },
    estimatedVisitDuration: { minutes: 90, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: ['https://vi.wikipedia.org/wiki/Ch%E1%BB%A3_n%E1%BB%95i_C%C3%A1i_B%C3%A8'],
    publicationStatus: 'published',
  },
  {
    slug: 'nem-lai-vung',
    name: 'Làng nghề nem Lai Vung',
    summary: 'Tìm hiểu đặc sản nem Lai Vung và nghề làm nem truyền thống.',
    description:
      'Lai Vung nổi tiếng với đặc sản nem. Du khách có thể tìm hiểu quy trình làm nem truyền thống và thưởng thức đặc sản địa phương. Chưa có địa điểm cụ thể đã xác minh, vui lòng hỏi thông tin tại địa phương. Nội dung này là dữ liệu minh họa.',
    category: 'food',
    tags: ['làng nghề', 'đặc sản', 'trải nghiệm địa phương'],
    area: 'lai-vung',
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'dong-sen-thap-muoi',
    name: 'Đồng sen Tháp Mười',
    summary: 'Cánh đồng sen đặc trưng của vùng Tháp Mười, đẹp nhất vào mùa sen nở.',
    description:
      'Sen là biểu tượng gắn với vùng đất Tháp Mười. Các cánh đồng sen là nơi du khách có thể ngắm cảnh, chụp ảnh và thưởng thức món ăn từ sen. Địa điểm cụ thể và mùa sen nở cần kiểm tra trước. Nội dung này là dữ liệu minh họa.',
    category: 'nature',
    tags: ['ẩm thực', 'sen'],
    area: 'thap-muoi',
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'khu-du-lich-gao-giong',
    name: 'Khu du lịch sinh thái Gáo Giồng',
    summary: 'Rừng tràm, kênh rạch, ngắm chim và trải nghiệm xuồng ba lá.',
    description:
      'Khu du lịch sinh thái Gáo Giồng là điểm đến gắn với rừng tràm và hệ thống kênh rạch, phù hợp để ngắm chim và trải nghiệm đi xuồng ba lá. Giờ mở cửa, giá vé và tuyến tham quan cần kiểm tra trực tiếp với đơn vị quản lý. Nội dung này là dữ liệu minh họa, cần đối chiếu với nguồn chính thức.',
    category: 'eco',
    tags: ['thiên nhiên', 'rừng tràm', 'chim', 'xuồng'],
    area: 'cao-lanh',
    estimatedVisitDuration: { minutes: 150, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },

  // —— Bổ sung danh mục mở rộng (bỏ qua các điểm đã có phía trên) ——
  {
    slug: 'khu-bao-ton-sinh-thai-dong-thap-muoi',
    name: 'Khu bảo tồn sinh thái Đồng Tháp Mười',
    summary: 'Phù hợp với du lịch sinh thái, khám phá vùng đất ngập nước.',
    description:
      'Khu bảo tồn sinh thái gắn với vùng Đồng Tháp Mười, nơi du khách có thể tìm hiểu hệ sinh thái đất ngập nước và cảnh quan theo mùa. Địa chỉ cụ thể, tuyến tham quan và quy định bảo tồn cần kiểm tra với đơn vị quản lý. Nội dung này là dữ liệu minh họa.',
    category: 'eco',
    tags: ['sinh thái', 'đất ngập nước', 'bảo tồn'],
    area: 'thap-muoi',
    estimatedVisitDuration: { minutes: 150, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'khu-du-lich-sinh-thai-my-phuoc-thanh',
    name: 'Khu du lịch sinh thái Mỹ Phước Thành',
    summary: 'Không gian đồng quê, cảnh quan sen và ẩm thực miền Tây.',
    description:
      'Khu du lịch sinh thái Mỹ Phước Thành mang không gian đồng quê với cảnh quan sen và các trải nghiệm ẩm thực miền Tây. Thông tin giờ mở cửa và dịch vụ cần xác nhận trước chuyến đi. Nội dung này là dữ liệu minh họa.',
    category: 'eco',
    tags: ['sen', 'đồng quê', 'ẩm thực'],
    area: 'sa-dec',
    estimatedVisitDuration: { minutes: 120, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'khu-du-lich-sinh-thai-dong-xanh',
    name: 'Khu du lịch sinh thái Đồng Xanh',
    summary: 'Vườn cây, không gian nông thôn và trải nghiệm thư giãn.',
    description:
      'Khu du lịch sinh thái Đồng Xanh là điểm đến với vườn cây và không gian nông thôn, phù hợp cho trải nghiệm thư giãn theo nhóm nhỏ hoặc gia đình. Nội dung này là dữ liệu minh họa, cần đối chiếu với nguồn chính thức.',
    category: 'eco',
    tags: ['vườn cây', 'nông thôn', 'thư giãn'],
    area: 'cao-lanh',
    estimatedVisitDuration: { minutes: 120, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'khu-du-lich-sinh-thai-tien-dinh',
    name: 'Khu du lịch sinh thái Tiên Định',
    summary: 'Điểm tham quan sinh thái ở khu vực Đồng Tháp.',
    description:
      'Khu du lịch sinh thái Tiên Định là điểm tham quan gắn với cảnh quan sinh thái địa phương. Địa chỉ, giờ mở cửa và dịch vụ cần kiểm tra trước. Nội dung này là dữ liệu minh họa.',
    category: 'eco',
    tags: ['sinh thái', 'tham quan'],
    area: 'thap-muoi',
    estimatedVisitDuration: { minutes: 120, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'bao-tang-tong-hop-dong-thap',
    name: 'Bảo tàng Tổng hợp Đồng Tháp',
    summary: 'Tìm hiểu lịch sử, văn hóa và đời sống địa phương.',
    description:
      'Bảo tàng Tổng hợp Đồng Tháp giới thiệu lịch sử, văn hóa và đời sống người dân địa phương qua các hiện vật và trưng bày. Thời gian mở cửa và giá vé cần kiểm tra trực tiếp. Nội dung này là dữ liệu minh họa.',
    category: 'culture',
    tags: ['bảo tàng', 'lịch sử', 'văn hóa'],
    area: 'cao-lanh',
    address: 'Thành phố Cao Lãnh, tỉnh Đồng Tháp',
    estimatedVisitDuration: { minutes: 90, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'di-tich-khao-co-go-thanh',
    name: 'Di tích khảo cổ Gò Thành',
    summary: 'Di tích khảo cổ thuộc văn hóa Óc Eo ở khu vực Tiền Giang cũ.',
    description:
      'Di tích khảo cổ Gò Thành gắn với văn hóa Óc Eo tại khu vực thuộc tỉnh Tiền Giang trước sắp xếp hành chính. Khi đưa vào lịch trình chính thức cần xác minh đơn vị quản lý và thông tin tham quan hiện hành. Nội dung này là dữ liệu minh họa.',
    category: 'history',
    tags: ['khảo cổ', 'Óc Eo', 'lịch sử'],
    area: 'my-tho',
    address: 'Khu vực Gò Công (địa danh trước sắp xếp hành chính), tỉnh Đồng Tháp',
    estimatedVisitDuration: { minutes: 90, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'nha-co-cai-be',
    name: 'Nhà cổ Cái Bè',
    summary: 'Khám phá kiến trúc nhà cổ Nam Bộ.',
    description:
      'Nhà cổ Cái Bè là điểm đến để tìm hiểu kiến trúc nhà cổ Nam Bộ. Giờ tham quan và quy định chụp ảnh cần hỏi trực tiếp tại điểm. Nội dung này là dữ liệu minh họa.',
    category: 'culture',
    tags: ['kiến trúc', 'nhà cổ', 'văn hóa'],
    area: 'cai-be',
    estimatedVisitDuration: { minutes: 60, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'nha-doc-phu-hai',
    name: 'Nhà Đốc Phủ Hải',
    summary: 'Công trình kiến trúc cổ có giá trị lịch sử tại vùng Gò Công.',
    description:
      'Nhà Đốc Phủ Hải là công trình kiến trúc cổ gắn với lịch sử vùng Gò Công (thuộc tỉnh Tiền Giang trước sắp xếp hành chính). Thông tin mở cửa và quản lý cần xác minh trước chuyến đi. Nội dung này là dữ liệu minh họa.',
    category: 'history',
    tags: ['kiến trúc', 'lịch sử', 'nhà cổ'],
    area: 'my-tho',
    address: 'Khu vực Gò Công (địa danh trước sắp xếp hành chính), tỉnh Đồng Tháp',
    estimatedVisitDuration: { minutes: 60, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'dinh-long-hung',
    name: 'Đình Long Hưng',
    summary: 'Di tích lịch sử và kiến trúc đình làng Nam Bộ.',
    description:
      'Đình Long Hưng là di tích lịch sử với giá trị kiến trúc đình làng Nam Bộ. Du khách nên ăn mặc lịch sự khi tham quan. Nội dung này là dữ liệu minh họa, cần đối chiếu với nguồn chính thức.',
    category: 'history',
    tags: ['đình làng', 'lịch sử', 'tín ngưỡng'],
    area: 'my-tho',
    estimatedVisitDuration: { minutes: 60, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'van-thanh-mieu-cao-lanh',
    name: 'Văn Thánh Miếu Cao Lãnh',
    summary: 'Không gian văn hóa truyền thống gắn với Nho học.',
    description:
      'Văn Thánh Miếu Cao Lãnh là không gian văn hóa truyền thống gắn với Nho học và lịch sử địa phương. Giờ mở cửa cần kiểm tra trước. Nội dung này là dữ liệu minh họa.',
    category: 'culture',
    tags: ['văn hóa', 'Nho học', 'di tích'],
    area: 'cao-lanh',
    address: 'Thành phố Cao Lãnh, tỉnh Đồng Tháp',
    estimatedVisitDuration: { minutes: 60, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'phuoc-kien-tu-chua-la-sen',
    name: 'Phước Kiển Tự – Chùa Lá Sen',
    summary: 'Nổi tiếng với những lá sen lớn đặc biệt.',
    description:
      'Phước Kiển Tự (Chùa Lá Sen) được biết đến với những lá sen có kích thước đặc biệt. Du khách cần ăn mặc lịch sự khi vào chùa. Nội dung này là dữ liệu minh họa.',
    category: 'culture',
    tags: ['chùa', 'tâm linh', 'sen'],
    area: 'cao-lanh',
    estimatedVisitDuration: { minutes: 60, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'kien-an-cung-chua-ong-quach',
    name: 'Kiến An Cung – Chùa Ông Quách',
    summary: 'Công trình tín ngưỡng của cộng đồng người Hoa tại Sa Đéc.',
    description:
      'Kiến An Cung (Chùa Ông Quách) là công trình tín ngưỡng gắn với cộng đồng người Hoa tại Sa Đéc, nổi bật bởi kiến trúc và hoạt động lễ hội. Nội dung này là dữ liệu minh họa, cần đối chiếu với nguồn chính thức.',
    category: 'culture',
    tags: ['tín ngưỡng', 'người Hoa', 'Sa Đéc'],
    area: 'sa-dec',
    address: 'Thành phố Sa Đéc, tỉnh Đồng Tháp',
    estimatedVisitDuration: { minutes: 60, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'thien-vien-truc-lam-chanh-giac',
    name: 'Thiền viện Trúc Lâm Chánh Giác',
    summary: 'Công trình Phật giáo quy mô lớn, cảnh quan thanh tịnh.',
    description:
      'Thiền viện Trúc Lâm Chánh Giác là công trình Phật giáo quy mô lớn với cảnh quan thanh tịnh, thuộc khu vực tỉnh Tiền Giang trước sắp xếp hành chính. Du khách nên giữ im lặng và ăn mặc lịch sự. Nội dung này là dữ liệu minh họa.',
    category: 'culture',
    tags: ['Phật giáo', 'thiền viện', 'tâm linh'],
    area: 'my-tho',
    estimatedVisitDuration: { minutes: 90, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'chua-buu-lam-co-tu',
    name: 'Chùa Bửu Lâm Cổ Tự',
    summary: 'Ngôi chùa cổ có giá trị văn hóa và tín ngưỡng.',
    description:
      'Chùa Bửu Lâm Cổ Tự là ngôi chùa cổ gắn với đời sống tín ngưỡng địa phương. Thông tin tham quan cần kiểm tra trước. Nội dung này là dữ liệu minh họa.',
    category: 'culture',
    tags: ['chùa', 'tâm linh', 'văn hóa'],
    area: 'my-tho',
    estimatedVisitDuration: { minutes: 60, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'chua-sac-tu-linh-thuu',
    name: 'Chùa Sắc Tứ Linh Thứu',
    summary: 'Điểm đến dành cho người quan tâm đến kiến trúc chùa và lịch sử Phật giáo.',
    description:
      'Chùa Sắc Tứ Linh Thứu phù hợp với du khách quan tâm kiến trúc chùa và lịch sử Phật giáo địa phương. Nội dung này là dữ liệu minh họa, cần đối chiếu với nguồn chính thức.',
    category: 'culture',
    tags: ['chùa', 'Phật giáo', 'kiến trúc'],
    area: 'my-tho',
    estimatedVisitDuration: { minutes: 60, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'chua-hung-thien',
    name: 'Chùa Hưng Thiền',
    summary: 'Điểm tham quan tâm linh ở khu vực Đồng Tháp cũ.',
    description:
      'Chùa Hưng Thiền là điểm tham quan tâm linh tại khu vực Đồng Tháp. Du khách cần ăn mặc lịch sự khi tham quan. Nội dung này là dữ liệu minh họa.',
    category: 'culture',
    tags: ['chùa', 'tâm linh'],
    area: 'cao-lanh',
    estimatedVisitDuration: { minutes: 45, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'thap-linh-co-tu',
    name: 'Tháp Linh Cổ Tự',
    summary: 'Công trình tâm linh gắn với quần thể di tích Gò Tháp.',
    description:
      'Tháp Linh Cổ Tự là công trình tâm linh nằm trong quần thể di tích Gò Tháp. Có thể kết hợp tham quan với các hạng mục khảo cổ và tín ngưỡng trong khu vực. Nội dung này là dữ liệu minh họa.',
    category: 'culture',
    tags: ['tâm linh', 'Gò Tháp', 'di tích'],
    area: 'thap-muoi',
    estimatedVisitDuration: { minutes: 60, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'vuon-hong-tu-ton',
    name: 'Khu du lịch vườn hồng Tư Tôn',
    summary: 'Tham quan vườn hoa hồng và chụp ảnh.',
    description:
      'Khu du lịch vườn hồng Tư Tôn phù hợp để tham quan, chụp ảnh và trải nghiệm không gian vườn hoa. Mùa hoa và giờ mở cửa cần kiểm tra trước. Nội dung này là dữ liệu minh họa.',
    category: 'local_experience',
    tags: ['hoa hồng', 'chụp ảnh', 'vườn'],
    area: 'sa-dec',
    estimatedVisitDuration: { minutes: 90, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'vuon-quyt-hong-ba-lien',
    name: 'Vườn quýt hồng Ba Liên',
    summary: 'Tham quan vườn quýt, đặc biệt hấp dẫn vào mùa quýt chín.',
    description:
      'Vườn quýt hồng Ba Liên là điểm trải nghiệm nông nghiệp gắn với đặc sản quýt hồng Lai Vung. Thời điểm đẹp nhất thường vào mùa quýt chín; cần xác nhận lịch đón khách trước. Nội dung này là dữ liệu minh họa.',
    category: 'local_experience',
    tags: ['quýt hồng', 'nông nghiệp', 'đặc sản'],
    area: 'lai-vung',
    estimatedVisitDuration: { minutes: 90, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'vuon-tao-ut-nhan',
    name: 'Vườn táo Út Nhàn',
    summary: 'Trải nghiệm tham quan vườn cây ăn trái.',
    description:
      'Vườn táo Út Nhàn là điểm tham quan vườn cây ăn trái, phù hợp cho gia đình và nhóm nhỏ. Thông tin dịch vụ và mùa trái cần hỏi trực tiếp. Nội dung này là dữ liệu minh họa.',
    category: 'local_experience',
    tags: ['vườn trái cây', 'nông nghiệp'],
    area: 'cao-lanh',
    estimatedVisitDuration: { minutes: 90, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'vuon-thanh-long-ba-vung',
    name: 'Vườn thanh long Ba Vững',
    summary: 'Điểm trải nghiệm nông nghiệp và vườn trái cây.',
    description:
      'Vườn thanh long Ba Vững mang đến trải nghiệm tham quan nông nghiệp và vườn trái cây. Lịch đón khách và giá dịch vụ cần xác nhận trước. Nội dung này là dữ liệu minh họa.',
    category: 'local_experience',
    tags: ['thanh long', 'nông nghiệp', 'vườn'],
    area: 'cao-lanh',
    estimatedVisitDuration: { minutes: 90, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'vuon-hoa-man-dinh-hong',
    name: 'Vườn hoa Mãn Đình Hồng',
    summary: 'Tham quan vườn hoa theo mùa, chụp ảnh ngoài trời.',
    description:
      'Vườn hoa Mãn Đình Hồng phù hợp để tham quan theo mùa hoa và chụp ảnh ngoài trời. Tình trạng hoa nở thay đổi theo thời điểm, nên hỏi trước khi đi. Nội dung này là dữ liệu minh họa.',
    category: 'local_experience',
    tags: ['hoa', 'chụp ảnh', 'Sa Đéc'],
    area: 'sa-dec',
    estimatedVisitDuration: { minutes: 90, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'canh-dong-sen-my-hoa',
    name: 'Cánh đồng sen Mỹ Hòa',
    summary: 'Trải nghiệm cảnh quan sen và văn hóa ẩm thực từ sen.',
    description:
      'Cánh đồng sen Mỹ Hòa là điểm đến gắn với cảnh quan sen và ẩm thực từ sen. Mùa sen nở và điều kiện tham quan cần kiểm tra trước. Nội dung này là dữ liệu minh họa.',
    category: 'nature',
    tags: ['sen', 'ẩm thực', 'cánh đồng'],
    area: 'thap-muoi',
    estimatedVisitDuration: { minutes: 120, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'happy-land-hung-thy',
    name: 'Happy Land Hùng Thy',
    summary: 'Vui chơi dân gian, chụp ảnh và trải nghiệm không gian miền quê.',
    description:
      'Happy Land Hùng Thy mang không gian vui chơi dân gian, chụp ảnh và trải nghiệm miền quê, phù hợp với gia đình. Giá vé và lịch hoạt động cần kiểm tra trực tiếp. Nội dung này là dữ liệu minh họa.',
    category: 'local_experience',
    tags: ['gia đình', 'vui chơi', 'miền quê'],
    area: 'lai-vung',
    estimatedVisitDuration: { minutes: 150, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'trai-ran-dong-tam',
    name: 'Trại rắn Đồng Tâm',
    summary: 'Tham quan cơ sở bảo tồn, nghiên cứu và tìm hiểu các loài rắn.',
    description:
      'Trại rắn Đồng Tâm là điểm tham quan gắn với bảo tồn và nghiên cứu các loài rắn tại khu vực thuộc tỉnh Tiền Giang trước sắp xếp hành chính. Nên tuân thủ hướng dẫn an toàn tại điểm. Nội dung này là dữ liệu minh họa.',
    category: 'local_experience',
    tags: ['gia đình', 'bảo tồn', 'tham quan'],
    area: 'my-tho',
    estimatedVisitDuration: { minutes: 90, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'diem-du-lich-lang-tre',
    name: 'Điểm du lịch Làng Tre',
    summary: 'Không gian tre, cảnh quan xanh và hoạt động thư giãn.',
    description:
      'Điểm du lịch Làng Tre mang không gian tre và cảnh quan xanh, phù hợp cho hoạt động thư giãn. Nội dung này là dữ liệu minh họa, cần đối chiếu với nguồn chính thức.',
    category: 'local_experience',
    tags: ['tre', 'thư giãn', 'gia đình'],
    area: 'cao-lanh',
    estimatedVisitDuration: { minutes: 120, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'du-lich-sinh-thai-thien-phu',
    name: 'Du lịch sinh thái Thiên Phú',
    summary: 'Điểm tham quan sinh thái phù hợp với nhóm bạn và gia đình.',
    description:
      'Du lịch sinh thái Thiên Phú là điểm tham quan sinh thái phù hợp với nhóm bạn và gia đình. Dịch vụ và giờ đón khách cần xác nhận trước. Nội dung này là dữ liệu minh họa.',
    category: 'eco',
    tags: ['sinh thái', 'gia đình'],
    area: 'cao-lanh',
    estimatedVisitDuration: { minutes: 120, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'khu-du-lich-sinh-thai-nam-huong',
    name: 'Khu du lịch sinh thái Nam Hương',
    summary: 'Không gian vườn và trải nghiệm sinh thái.',
    description:
      'Khu du lịch sinh thái Nam Hương mang không gian vườn và các trải nghiệm sinh thái nhẹ nhàng. Nội dung này là dữ liệu minh họa.',
    category: 'eco',
    tags: ['sinh thái', 'vườn'],
    area: 'cao-lanh',
    estimatedVisitDuration: { minutes: 120, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'diem-am-thuc-hoa-hong-thi-tho',
    name: 'Điểm ẩm thực Hoa hồng Thi Thơ',
    summary: 'Trải nghiệm ẩm thực địa phương gắn với không gian hoa hồng.',
    description:
      'Điểm ẩm thực Hoa hồng Thi Thơ có thể kết hợp thưởng thức món địa phương trong không gian gắn với hoa hồng. Thực đơn và giờ phục vụ cần hỏi trực tiếp. Nội dung này là dữ liệu minh họa.',
    category: 'food',
    tags: ['ẩm thực', 'hoa hồng', 'địa phương'],
    area: 'sa-dec',
    estimatedVisitDuration: { minutes: 75, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'bien-tan-thanh',
    name: 'Biển Tân Thành',
    summary: 'Bãi biển phù sa, trải nghiệm cảnh biển và thưởng thức hải sản.',
    description:
      'Biển Tân Thành là bãi biển phù sa tại khu vực Gò Công (thuộc tỉnh Tiền Giang trước sắp xếp hành chính), phù hợp để ngắm cảnh biển và thưởng thức hải sản. Điều kiện tắm biển và dịch vụ thay đổi theo thời điểm. Nội dung này là dữ liệu minh họa.',
    category: 'nature',
    tags: ['biển', 'hải sản', 'gia đình'],
    area: 'my-tho',
    address: 'Khu vực Gò Công (địa danh trước sắp xếp hành chính), tỉnh Đồng Tháp',
    estimatedVisitDuration: { minutes: 180, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'con-phung',
    name: 'Cồn Phụng',
    summary: 'Cần xác minh ranh giới hành chính và đơn vị quản lý trước khi đưa vào danh mục chính thức.',
    description:
      'Cồn Phụng thường được nhắc đến trong các tour sông nước miền Tây. Do ranh giới hành chính và đơn vị quản lý cần được xác minh trước khi đưa vào danh mục chính thức của tỉnh Đồng Tháp mới, bản ghi này được giữ ở trạng thái bản nháp. Nội dung này là dữ liệu minh họa.',
    category: 'eco',
    tags: ['sông nước', 'cần xác minh'],
    area: 'my-tho',
    sourceUrls: [],
    publicationStatus: 'draft',
  },
  {
    slug: 'cu-lao-ngu-hiep',
    name: 'Cù lao Ngũ Hiệp',
    summary: 'Khu vực miệt vườn và cây ăn trái; cần xác minh địa chỉ hành chính hiện hành.',
    description:
      'Cù lao Ngũ Hiệp gắn với không gian miệt vườn và cây ăn trái. Địa chỉ hành chính hiện hành cần được xác minh trước khi xuất bản chính thức, nên bản ghi tạm thời ở trạng thái bản nháp. Nội dung này là dữ liệu minh họa.',
    category: 'eco',
    tags: ['miệt vườn', 'cây ăn trái', 'cần xác minh'],
    area: 'cai-be',
    sourceUrls: [],
    publicationStatus: 'draft',
  },
  {
    slug: 'my-nghe-sen-viet',
    name: 'Mỹ nghệ Sen Việt',
    summary: 'Sản phẩm thủ công và quà tặng gắn với hình tượng sen.',
    description:
      'Mỹ nghệ Sen Việt gắn với sản phẩm thủ công và quà tặng lấy cảm hứng từ hình tượng sen Đồng Tháp. Địa chỉ cửa hàng/xưởng và giờ mở cửa cần xác nhận trước. Nội dung này là dữ liệu minh họa.',
    category: 'local_experience',
    tags: ['làng nghề', 'thủ công', 'sen', 'mua sắm'],
    area: 'cao-lanh',
    estimatedVisitDuration: { minutes: 60, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'lang-nghe-bot-sa-dec',
    name: 'Làng nghề bột Sa Đéc',
    summary: 'Tìm hiểu nghề làm bột truyền thống.',
    description:
      'Làng nghề bột Sa Đéc giúp du khách tìm hiểu nghề làm bột truyền thống của địa phương. Điểm tham quan cụ thể cần hỏi thông tin tại địa phương. Nội dung này là dữ liệu minh họa.',
    category: 'local_experience',
    tags: ['làng nghề', 'Sa Đéc', 'thủ công'],
    area: 'sa-dec',
    estimatedVisitDuration: { minutes: 75, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'lang-nghe-chieu-dinh-yen',
    name: 'Làng nghề chiếu Định Yên',
    summary: 'Nghề dệt chiếu truyền thống.',
    description:
      'Làng nghề chiếu Định Yên nổi tiếng với nghề dệt chiếu truyền thống. Du khách có thể tìm hiểu quy trình và mua sản phẩm địa phương. Nội dung này là dữ liệu minh họa.',
    category: 'local_experience',
    tags: ['làng nghề', 'dệt chiếu', 'thủ công'],
    area: 'lai-vung',
    estimatedVisitDuration: { minutes: 75, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'lang-nghe-det-choang-long-khanh',
    name: 'Làng nghề dệt choàng Long Khánh',
    summary: 'Tìm hiểu nghề dệt khăn choàng.',
    description:
      'Làng nghề dệt choàng Long Khánh gắn với nghề dệt khăn choàng truyền thống. Thông tin điểm tham quan cần xác nhận tại địa phương. Nội dung này là dữ liệu minh họa.',
    category: 'local_experience',
    tags: ['làng nghề', 'dệt', 'thủ công'],
    area: 'hong-ngu',
    estimatedVisitDuration: { minutes: 75, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'cho-sa-dec',
    name: 'Chợ Sa Đéc',
    summary: 'Khám phá đặc sản, thực phẩm và đời sống địa phương.',
    description:
      'Chợ Sa Đéc là nơi khám phá đặc sản, thực phẩm và nhịp sống địa phương. Nên đi vào buổi sáng để trải nghiệm không khí chợ. Nội dung này là dữ liệu minh họa.',
    category: 'food',
    tags: ['chợ', 'đặc sản', 'mua sắm'],
    area: 'sa-dec',
    address: 'Thành phố Sa Đéc, tỉnh Đồng Tháp',
    estimatedVisitDuration: { minutes: 60, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'cho-my-tho',
    name: 'Chợ Mỹ Tho',
    summary: 'Mua sắm và trải nghiệm văn hóa chợ truyền thống.',
    description:
      'Chợ Mỹ Tho mang trải nghiệm văn hóa chợ truyền thống và mua sắm đặc sản khu vực. Nội dung này là dữ liệu minh họa, cần đối chiếu với nguồn chính thức.',
    category: 'food',
    tags: ['chợ', 'mua sắm', 'đặc sản'],
    area: 'my-tho',
    address: 'Thành phố Mỹ Tho, tỉnh Đồng Tháp',
    estimatedVisitDuration: { minutes: 60, isEstimate: true, note: ESTIMATE_NOTE },
    sourceUrls: [],
    publicationStatus: 'published',
  },
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
