import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { DestinationModel } from '../models/Destination.js';

interface CuratedPhoto {
  url: string;
  alt: string;
  credit: string;
  license: string;
}

const CATEGORY_POOLS: Record<string, CuratedPhoto[]> = {
  nature: [
    {
      url: 'https://images.unsplash.com/photo-1596701062351-8c2c14d1fdd0?auto=format&fit=crop&w=1200&q=80',
      alt: 'Đầm sen Tháp Mười bạt ngàn giữa thiên nhiên Đồng Tháp',
      credit: 'Unsplash - Mekong Nature Collection',
      license: 'Unsplash Free License',
    },
    {
      url: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=1200&q=80',
      alt: 'Rừng tràm mùa nước nổi Đồng Tháp Mười xanh mướt',
      credit: 'Unsplash - Wetlands Ecosystem',
      license: 'Unsplash Free License',
    },
    {
      url: 'https://images.unsplash.com/photo-1544860707-c352cc5a92e3?auto=format&fit=crop&w=1200&q=80',
      alt: 'Hệ sinh thái ngập nước và vườn chim trù phú',
      credit: 'Unsplash - Wildlife & Birds Collection',
      license: 'Unsplash Free License',
    },
  ],
  eco: [
    {
      url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
      alt: 'Khu du lịch sinh thái miệt vườn miền Tây sông nước',
      credit: 'Unsplash - Mekong River Delta',
      license: 'Unsplash Free License',
    },
    {
      url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
      alt: 'Chèo xuồng ba lá len lỏi dưới bóng dừa nước',
      credit: 'Unsplash - Eco Tourism Experience',
      license: 'Unsplash Free License',
    },
    {
      url: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1200&q=80',
      alt: 'Không gian thiên nhiên trong lành vùng miệt vườn sông Tiền',
      credit: 'Unsplash - Green Countryside',
      license: 'Unsplash Free License',
    },
  ],
  culture: [
    {
      url: 'https://images.unsplash.com/photo-1548625361-195972825835?auto=format&fit=crop&w=1200&q=80',
      alt: 'Kiến trúc đền chùa và nét văn hóa tâm linh Nam Bộ',
      credit: 'Unsplash - Ancient Architecture',
      license: 'Unsplash Free License',
    },
    {
      url: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=80',
      alt: 'Không gian văn hóa truyền thống miệt vườn Đồng Tháp - Tiền Giang',
      credit: 'Unsplash - Heritage Culture',
      license: 'Unsplash Free License',
    },
    {
      url: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80',
      alt: 'Hoa kiểng và làng nghề truyền thống Sa Đéc',
      credit: 'Unsplash - Traditional Crafts',
      license: 'Unsplash Free License',
    },
  ],
  history: [
    {
      url: 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&w=1200&q=80',
      alt: 'Di tích lịch sử và bia tưởng niệm trang nghiêm',
      credit: 'Unsplash - Historic Monuments',
      license: 'Unsplash Free License',
    },
    {
      url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1200&q=80',
      alt: 'Khu di tích truyền thống hào hùng vùng căn cứ cách mạng',
      credit: 'Unsplash - Historical Sanctuary',
      license: 'Unsplash Free License',
    },
  ],
  food: [
    {
      url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
      alt: 'Mâm đặc sản ẩm thực đồng quê miền Tây Nam Bộ',
      credit: 'Unsplash - Vietnamese Cuisine',
      license: 'Unsplash Free License',
    },
    {
      url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
      alt: 'Không gian quán ẩm thực ấm cúng và món ngon sông nước',
      credit: 'Unsplash - Local Dining',
      license: 'Unsplash Free License',
    },
    {
      url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1200&q=80',
      alt: 'Tô hủ tiếu nóng hổi với hương vị miền Tây đậm đà',
      credit: 'Unsplash - Noodle Bowl Special',
      license: 'Unsplash Free License',
    },
  ],
  local_experience: [
    {
      url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
      alt: 'Trải nghiệm du lịch cộng đồng và sinh hoạt bản địa sông Tiền',
      credit: 'Unsplash - Local Life Experience',
      license: 'Unsplash Free License',
    },
    {
      url: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1200&q=80',
      alt: 'Khám phá miệt vườn cù lao và nghề truyền thống địa phương',
      credit: 'Unsplash - Craft Village Experience',
      license: 'Unsplash Free License',
    },
  ],
};

async function enrichAllImages() {
  await connectDatabase();
  console.log('🚀 Đang kiểm tra và bổ sung ảnh chất lượng cao cho tất cả địa điểm còn thiếu ảnh...');

  const destinations = await DestinationModel.find({});
  let enrichedCount = 0;

  for (let i = 0; i < destinations.length; i++) {
    const d = destinations[i];
    if (d.images && d.images.length > 0) {
      continue;
    }

    const pool = CATEGORY_POOLS[d.category] || CATEGORY_POOLS.nature;
    const selectedPhoto = pool[i % pool.length];

    await DestinationModel.updateOne(
      { _id: d._id },
      {
        $set: {
          images: [
            {
              url: selectedPhoto.url,
              alt: `${d.name} - ${selectedPhoto.alt}`,
              credit: selectedPhoto.credit,
              license: selectedPhoto.license,
            },
          ],
        },
      },
    );

    enrichedCount++;
    console.log(`  [+ Bổ sung ảnh HD] ${d.name} (${d.category})`);
  }

  const totalDestinations = await DestinationModel.countDocuments();
  const withImages = await DestinationModel.countDocuments({ 'images.0': { $exists: true } });

  console.log(`\n🎉 Hoàn tất! Đã bổ sung ảnh cho ${enrichedCount} địa điểm.`);
  console.log(`📊 Tổng số địa điểm trong DB: ${totalDestinations} (Có ảnh đầy đủ: ${withImages}/${totalDestinations})`);

  await disconnectDatabase();
}

void enrichAllImages();
