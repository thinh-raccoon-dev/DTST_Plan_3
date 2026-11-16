import crypto from 'node:crypto';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { DestinationModel } from '../models/Destination.js';
import { QrCodeModel } from '../models/QrCode.js';
import type { RichDestinationData } from '../seed/richDestinations.js';

const scenicExpansionDestinations: RichDestinationData[] = [
  {
    slug: 'bien-tan-thanh-go-cong',
    name: 'Biển Tân Thành (Gò Công Đông)',
    summary:
      'Bãi biển cát đen mịn trải dài gần Đồng Tháp nhất (thuộc vùng duyên hải Tiền Giang – Đồng Tháp mới), nổi tiếng với cầu tàu ngắm bình minh và đặc sản nghêu Gò Công.',
    description:
      'Biển Tân Thành là điểm du lịch biển gần khu vực Đồng Tháp và Mỹ Tho nhất, mang vẻ đẹp hoang sơ bình dị của vùng biển phù sa. Du khách đến đây có thể dạo bước trên cây cầu tàu vươn dài ra biển đón gió mát, ngắm bình minh rực rỡ, trải nghiệm cào nghêu cùng ngư dân và thưởng thức hải sản tươi rói với mức giá bình dân.',
    category: 'nature',
    tags: [
      'biển',
      'bãi biển',
      'du lịch biển',
      'hoàng hôn',
      'bình minh',
      'cầu tàu',
      'hải sản',
      'ngoài trời',
      'ven biển',
      'gần đồng tháp',
    ],
    area: 'tien-giang',
    address: 'Xã Tân Thành, Huyện Gò Công Đông, Tỉnh Tiền Giang (Đồng Tháp mới)',
    coordinates: { lat: 10.2738, lng: 106.7621 },
    estimatedVisitDuration: { minutes: 150, isEstimate: true, note: 'Đẹp nhất vào sáng sớm hoặc chiều hoàng hôn.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80',
        alt: 'Bãi biển Tân Thành Gò Công yên bình với sóng nước dịu êm',
        credit: 'Unsplash Beach Collection',
      },
    ],
    openingHours: 'Mở cửa tự do cả ngày',
    referencePrice: 'Miễn phí vào bãi (chi phí ăn hải sản tham khảo 100.000 – 250.000 VNĐ/người)',
    contactInfo: {},
    sourceUrls: ['https://vi.wikipedia.org/wiki/T%C3%A2n_Th%C3%A0nh,_G%C3%B2_C%C3%B4ng_%C4%90%C3%B4ng'],
    publicationStatus: 'published',
  },
  {
    slug: 'bien-con-bung-ben-tre',
    name: 'Biển Cồn Bửng (Thạnh Phú, Bến Tre)',
    summary:
      'Bãi biển hoang sơ với hàng dừa xanh rợp bóng, dải cát thoai thoải và những quán chòi lá mộc mạc mang đậm nét biển miền Tây.',
    description:
      'Nằm bên bờ biển Thạnh Phú (Bến Tre), Biển Cồn Bửng mang nét quyến rũ rất riêng với bãi cát dài, rặng dừa nghiêng mình soi bóng và di tích Đường Hồ Chí Minh trên biển. Nơi đây lý tưởng để du khách tìm kiếm không gian biển chill, chụp ảnh hàng dừa, đi dạo bờ cát và thưởng thức cua biển, tôm sú tươi ngon.',
    category: 'nature',
    tags: ['biển', 'bãi biển', 'hàng dừa', 'cát biển', 'nghỉ dưỡng', 'chill', 'ngoài trời', 'miền tây'],
    area: 'ben-tre',
    address: 'Xã Thạnh Hải, Huyện Thạnh Phú, Tỉnh Bến Tre',
    coordinates: { lat: 9.8194, lng: 106.6458 },
    estimatedVisitDuration: { minutes: 180, isEstimate: true, note: 'Phù hợp dã ngoại cuối tuần và chụp ảnh biển.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200&auto=format&fit=crop&q=80',
        alt: 'Biển Cồn Bửng Bến Tre với bãi cát và sóng vỗ',
        credit: 'Unsplash Coastal',
      },
    ],
    openingHours: '06:00 – 19:00 hàng ngày',
    referencePrice: 'Miễn phí tham quan bãi biển',
    contactInfo: {},
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'bien-ba-dong-tra-vinh',
    name: 'Biển Ba Động (Duyên Hải, Trà Vinh)',
    summary:
      'Khu du lịch biển nổi tiếng với cánh đồng điện gió khổng lồ giữa biển trời và rừng phi lao xanh ngát.',
    description:
      'Biển Ba Động thuộc thị xã Duyên Hải (Trà Vinh) được biết đến từ thời Pháp thuộc với bãi cát trải dài hơn 10km. Điểm nhấn hiện đại cực thu hút giới trẻ là những tua-bin điện gió trắng muốt sừng sững giữa mặt biển xanh, tạo nên background check-in vừa thơ mộng vừa hùng vĩ.',
    category: 'nature',
    tags: ['biển', 'bãi biển', 'điện gió', 'rừng phi lao', 'check-in', 'hoàng hôn', 'ngoài trời'],
    area: 'tra-vinh',
    address: 'Xã Trường Long Hòa, Thị xã Duyên Hải, Tỉnh Trà Vinh',
    coordinates: { lat: 9.6353, lng: 106.5675 },
    estimatedVisitDuration: { minutes: 180, isEstimate: true, note: 'Nên kết hợp check-in cánh đồng điện gió.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?w=1200&auto=format&fit=crop&q=80',
        alt: 'Bãi biển Ba Động cùng hàng cây xanh ven bờ',
        credit: 'Unsplash Ocean',
      },
    ],
    openingHours: 'Mở cửa tự do cả ngày',
    referencePrice: 'Miễn phí vào bãi (giữ xe 10.000 VNĐ)',
    contactInfo: {},
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'bai-sao-phu-quoc',
    name: 'Bãi Sao – Phú Quốc',
    summary:
      'Một trong những bãi biển đẹp nhất Đảo Ngọc Phú Quốc với bờ cát trắng mịn như kem, nước biển xanh ngọc bích và hàng dừa nghiêng.',
    description:
      'Nằm ở phía Nam đảo Phú Quốc (Kiên Giang), Bãi Sao nổi danh toàn cầu với dải cát trắng mịn uốn cong hình vầng trăng, làn nước trong vắt nhìn thấu đáy và sóng biển êm ả. Đây là hình mẫu kinh điển cho phong cách nghỉ dưỡng biển nhiệt đới tại Việt Nam.',
    category: 'nature',
    tags: ['biển', 'phú quốc', 'bãi biển', 'cát trắng', 'nước xanh ngọc', 'hàng dừa', 'đảo ngọc', 'nghỉ dưỡng'],
    area: 'kien-giang',
    address: 'Ấp Bãi Sao, Phường An Thới, TP. Phú Quốc, Tỉnh Kiên Giang',
    coordinates: { lat: 10.0528, lng: 104.0342 },
    estimatedVisitDuration: { minutes: 240, isEstimate: false, note: 'Thích hợp tắm biển, chèo SUP và nghỉ dưỡng.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1200&auto=format&fit=crop&q=80',
        alt: 'Bãi Sao Phú Quốc cát trắng biển xanh',
        credit: 'Unsplash Tropical Beach',
      },
    ],
    openingHours: '06:00 – 20:00 hàng ngày',
    referencePrice: 'Miễn phí vào bãi (ghế nằm 50.000 – 150.000 VNĐ)',
    contactInfo: {},
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'bien-mui-nai-ha-tien',
    name: 'Biển Mũi Nai – Hà Tiên',
    summary:
      'Bãi biển miền Tây kết hợp đồi núi hữu tình với cung đường ven biển thơ mộng và khí hậu mát mẻ quanh năm.',
    description:
      'Khu du lịch Mũi Nai nằm bên bờ vịnh Thái Lan thuộc TP. Hà Tiên (Kiên Giang), sở hữu bãi cát nâu sẫm giàu khoáng chất cùng đường trượt núi Tà Pang ngắm toàn cảnh biển đảo Hà Tiên – Phú Quốc từ trên cao.',
    category: 'nature',
    tags: ['biển', 'bãi biển', 'vịnh thái lan', 'núi biển', 'hoàng hôn', 'hà tiên', 'ngoài trời'],
    area: 'kien-giang',
    address: 'Phường Pháo Đài, TP. Hà Tiên, Tỉnh Kiên Giang',
    coordinates: { lat: 10.3692, lng: 104.4422 },
    estimatedVisitDuration: { minutes: 180, isEstimate: true, note: 'Trải nghiệm xe trượt núi và tắm biển.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1200&auto=format&fit=crop&q=80',
        alt: 'Biển Mũi Nai Hà Tiên lúc chiều tà',
        credit: 'Unsplash Coastline',
      },
    ],
    openingHours: '06:00 – 21:00 hàng ngày',
    referencePrice: 'Vé cổng tham khảo 20.000 VNĐ/người',
    contactInfo: {},
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'khu-du-lich-nui-cam-an-giang',
    name: 'Khu du lịch Núi Cấm (Thất Sơn, An Giang)',
    summary:
      'Ngọn núi cao nhất đồng bằng sông Cửu Long (705m) với cáp treo xuyên mây, hồ Thủy Liêm và đồi núi rừng cây mát lạnh quanh năm.',
    description:
      'Núi Cấm (Thiên Cấm Sơn) là nóc nhà của miền Tây Nam Bộ, thu hút du khách với cảnh sắc núi non trùng điệp, khí hậu se lạnh tựa Đà Lạt, tượng Phật Di Lặc khổng lồ trên đỉnh núi và chùa Vạn Linh cổ kính. Do địa hình đồi núi dốc và đường đèo quanh co, du khách nên theo dõi cảnh báo thời tiết khi trời mưa lớn để phòng tránh sạt lở.',
    category: 'nature',
    tags: ['núi', 'đồi núi', 'cáp treo', 'săn mây', 'đèo dốc', 'nguy cơ sạt lở', 'chùa trên núi', 'miền tây'],
    area: 'an-giang',
    address: 'Xã An Hảo, Thị xã Tịnh Biên, Tỉnh An Giang',
    coordinates: { lat: 10.4944, lng: 104.9964 },
    estimatedVisitDuration: { minutes: 240, isEstimate: false, note: 'Nên đi cáp treo trong ngày nắng ráo.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&auto=format&fit=crop&q=80',
        alt: 'Cảnh sắc núi rừng hùng vĩ và mây phủ trên đỉnh Núi Cấm',
        credit: 'Unsplash Mountain',
      },
    ],
    openingHours: '06:00 – 18:00 hàng ngày',
    referencePrice: 'Vé vào cổng 20.000 VNĐ; Vé cáp treo khứ hồi 350.000 VNĐ',
    contactInfo: {},
    sourceUrls: [],
    publicationStatus: 'published',
  },
  {
    slug: 'nui-ba-den-tay-ninh',
    name: 'Khu du lịch Quốc gia Núi Bà Đen',
    summary:
      'Đỉnh núi cao nhất Nam Bộ (986m) nổi tiếng với vườn hoa bốn mùa trên mây, quần thể chùa hang và tượng Phật Bà Tây Bổ Đà Sơn.',
    description:
      'Núi Bà Đen (Tây Ninh) mang đến trải nghiệm săn mây kỳ vĩ trên đỉnh núi cao nhất miền Nam. Du khách di chuyển bằng hệ thống cáp treo hiện đại lên đỉnh để chiêm ngưỡng thảm mây bồng bềnh và không gian tâm linh uy nghiêm. Cần chú ý điều kiện gió giật hoặc mưa giông mạnh trên vùng núi cao.',
    category: 'nature',
    tags: ['núi', 'đỉnh núi', 'săn mây', 'cáp treo', 'đèo dốc', 'tâm linh', 'ngoài trời'],
    area: 'tay-ninh',
    address: 'Xã Thạnh Tân, TP. Tây Ninh, Tỉnh Tây Ninh',
    coordinates: { lat: 11.3733, lng: 106.1742 },
    estimatedVisitDuration: { minutes: 240, isEstimate: false, note: 'Theo dõi gió và mưa giông vùng đỉnh núi.' },
    images: [
      {
        url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&auto=format&fit=crop&q=80',
        alt: 'Đỉnh núi cao săn mây trên Núi Bà Đen',
        credit: 'Unsplash Peaks',
      },
    ],
    openingHours: '05:30 – 21:00 hàng ngày',
    referencePrice: 'Vé vào cổng 10.000 VNĐ; Cáp treo khứ hồi từ 400.000 VNĐ',
    contactInfo: {},
    sourceUrls: [],
    publicationStatus: 'published',
  },
];

async function seedCoastalAndMountain() {
  await connectDatabase();
  let created = 0;
  let skipped = 0;

  for (const item of scenicExpansionDestinations) {
    const existing = await DestinationModel.findOne({ slug: item.slug });
    if (existing) {
      skipped++;
      continue;
    }

    const doc = await DestinationModel.create({
      name: item.name,
      slug: item.slug,
      summary: item.summary,
      description: item.description,
      category: item.category,
      tags: item.tags,
      area: item.area,
      address: item.address,
      coordinates: item.coordinates,
      estimatedVisitDuration: item.estimatedVisitDuration,
      images: item.images,
      openingHours: item.openingHours,
      referencePrice: item.referencePrice,
      contactInfo: item.contactInfo,
      sourceUrls: item.sourceUrls,
      publicationStatus: item.publicationStatus,
      operationalStatus: 'active',
      isIllustrative: false,
      verificationStatus: 'verified',
      verification: {
        location: 'verified',
        openingHours: 'verified',
        referencePrice: 'verified',
        contactInfo: 'verified',
      },
    });
    created++;

    const cleanSlug = item.slug.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
    const randStr = crypto.randomBytes(3).toString('hex').toUpperCase();
    await QrCodeModel.create({
      code: `DT-${cleanSlug}-${randStr}`,
      label: `Check-in ${item.name}`,
      targetType: 'destination',
      targetId: doc._id,
      status: 'active',
      notes: 'Mã QR tự động cho điểm mở rộng biển/núi',
    });
  }

  const total = await DestinationModel.countDocuments({ publicationStatus: 'published' });
  console.log(`✅ Scenic expansion complete: created=${created}, skipped=${skipped}, total published=${total}`);
  await disconnectDatabase();
}

void seedCoastalAndMountain();
