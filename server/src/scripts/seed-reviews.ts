import mongoose from 'mongoose';
import { config } from 'dotenv';
config({ path: 'server/.env' });
import { DestinationModel } from '../models/Destination.js';
import { ReviewModel } from '../models/Review.js';

interface SeedReview {
  authorName: string;
  authorTier: string;
  rating: number;
  content: string;
  tags: string[];
  isVerifiedVisitor: boolean;
  likesCount: number;
  createdAt: Date;
  response?: {
    content: string;
    respondedAt: Date;
    responderName: string;
  };
}

const sampleReviewsBySlug: Record<string, SeedReview[]> = {
  'bao-tang-tong-hop-dong-thap': [
    {
      authorName: 'Nguyễn Hoàng Nam',
      authorTier: '👑 Huyền Thoại Sen Hồng',
      rating: 5,
      content:
        'Bảo tàng nằm ngay trung tâm TP. Cao Lãnh với kiến trúc Pháp cổ kính tuyệt đẹp. Bên trong trưng bày rất nhiều hiện vật quý về văn hóa Óc Eo, kháng chiến Nam Bộ và đời sống sông nước Đồng Tháp. Không gian râm mát, nhiều cây cổ thụ, nhân viên hướng dẫn rất ân cần và am hiểu lịch sử.',
      tags: ['Kiến trúc Pháp cổ', 'Hiện vật quý', 'Không gian thoáng mát', 'Hướng dẫn viên nhiệt tình'],
      isVerifiedVisitor: true,
      likesCount: 14,
      createdAt: new Date(Date.now() - 3 * 86400000),
      response: {
        content:
          'Ban Quản lý Bảo tàng Đồng Tháp xin chân thành cảm ơn đánh giá quý báu của bạn Nam. Chúc bạn luôn có những chuyến trải nghiệm ý nghĩa tại Đất Sen Hồng!',
        respondedAt: new Date(Date.now() - 2 * 86400000),
        responderName: 'Ban Quản lý Bảo tàng Đồng Tháp',
      },
    },
    {
      authorName: 'Trần Thị Mai Phương',
      authorTier: '⭐ Đại Sứ Đất Sen',
      rating: 5,
      content:
        'Giá vé rất rẻ, học sinh sinh viên còn được ưu đãi. Khuôn viên sạch sẽ, góc chụp ảnh tòa nhà màu vàng lên hình cực kỳ vintage. Rất đáng ghé thăm khi đến Cao Lãnh để hiểu thêm về nguồn cội miền Tây.',
      tags: ['Giá vé hợp lý', 'Chụp ảnh đẹp', 'Phù hợp gia đình'],
      isVerifiedVisitor: true,
      likesCount: 9,
      createdAt: new Date(Date.now() - 7 * 86400000),
    },
    {
      authorName: 'Lê Văn Tuấn',
      authorTier: '🌿 Nhà Du Hành',
      rating: 4,
      content:
        'Trưng bày bài bản và khoa học. Phòng trưng bày thời kỳ văn hóa Óc Eo rất ấn tượng với nhiều tượng gỗ cổ nghìn năm. Nếu có thêm mã audio guide thuyết minh tự động qua điện thoại thì sẽ còn tuyệt vời hơn nữa!',
      tags: ['Hiện vật quý', 'Văn hóa Óc Eo'],
      isVerifiedVisitor: false,
      likesCount: 6,
      createdAt: new Date(Date.now() - 14 * 86400000),
    },
    {
      authorName: 'Đặng Minh Khôi',
      authorTier: '🧭 Du Khách Tập Sự',
      rating: 5,
      content:
        'Không gian thanh bình ngay giữa lòng thành phố. Có bãi đỗ xe ô tô rộng rãi, không khí mát mẻ dễ chịu.',
      tags: ['Không gian thoáng mát', 'Bãi đỗ xe tiện lợi'],
      isVerifiedVisitor: true,
      likesCount: 3,
      createdAt: new Date(Date.now() - 20 * 86400000),
    },
  ],
  'vuon-quoc-gia-tram-chim': [
    {
      authorName: 'Phạm Đức Trọng',
      authorTier: '👑 Huyền Thoại Sen Hồng',
      rating: 5,
      content:
        'Đi xuồng tắc ráng len lỏi vào rừng tràm ngắm sen, hoa hoàng đầu ấn và từng đàn cò trắng bay rợp trời thật sự là trải nghiệm nhớ đời. Mùa nước nổi ở Tràm Chim cảnh sắc hùng vĩ đúng chất thiên nhiên hoang dã Nam Bộ.',
      tags: ['Sinh thái hoang sơ', 'Chụp ảnh chim quý', 'Đi xuồng ngắm cảnh', 'Không khí trong lành'],
      isVerifiedVisitor: true,
      likesCount: 28,
      createdAt: new Date(Date.now() - 2 * 86400000),
      response: {
        content:
          'Vườn Quốc gia Tràm Chim trân trọng cảm ơn bạn Trọng. Hẹn gặp lại bạn vào mùa chim về đẹp nhất năm nay!',
        respondedAt: new Date(Date.now() - 1 * 86400000),
        responderName: 'Trung tâm Du lịch VQG Tràm Chim',
      },
    },
    {
      authorName: 'Võ Thanh Thảo',
      authorTier: '⭐ Đại Sứ Đất Sen',
      rating: 5,
      content:
        'Ẩm thực ở đây rất ngon, cá lóc nướng trui cuốn lá sen non và lẩu cá linh bông điên điển chuẩn vị Đồng Tháp mười điểm không có nhưng!',
      tags: ['Ẩm thực đặc sản', 'Cá lóc nướng lá sen', 'Cảnh đẹp mê ly'],
      isVerifiedVisitor: true,
      likesCount: 19,
      createdAt: new Date(Date.now() - 5 * 86400000),
    },
    {
      authorName: 'Johnathan Miller',
      authorTier: '🌿 Nhà Du Hành',
      rating: 5,
      content:
        'A magnificent ramsar wetland reserve in the Mekong Delta! We saw rare birds and enjoyed the serene boat ride through blooming water lilies. Highly recommended!',
      tags: ['Sinh thái hoang sơ', 'Ramsar quốc tế'],
      isVerifiedVisitor: true,
      likesCount: 11,
      createdAt: new Date(Date.now() - 10 * 86400000),
    },
  ],
  'lang-hoa-sa-dec': [
    {
      authorName: 'Hoàng Yến Nhi',
      authorTier: '👑 Huyền Thoại Sen Hồng',
      rating: 5,
      content:
        'Làng hoa Sa Đéc trăm hoa đua nở rực rỡ sắc màu! Độc đáo nhất là hoa được trồng trên giàn cao phía dưới là rạch nước, người dân chèo xuồng chăm hoa rất đặc trưng miền sông nước. Điểm check-in chụp hình Tết không đâu sánh bằng!',
      tags: ['Ngàn hoa khoe sắc', 'Chụp ảnh siêu đẹp', 'Đậm chất miền Tây', 'Người dân thân thiện'],
      isVerifiedVisitor: true,
      likesCount: 35,
      createdAt: new Date(Date.now() - 1 * 86400000),
    },
    {
      authorName: 'Bùi Gia Huy',
      authorTier: '⭐ Đại Sứ Đất Sen',
      rating: 5,
      content:
        'Cung đường hoa Sa Nhiên - Cai Dao đi xe điện ngắm hoa cực kỳ mát mẻ và tiện lợi. Các nhà vườn rất hiếu khách, cho vào chụp ảnh thoải mái và bán cây kiểng giá rất mềm.',
      tags: ['Giá cả hợp lý', 'Đi xe điện tiện lợi', 'Hiếu khách'],
      isVerifiedVisitor: true,
      likesCount: 15,
      createdAt: new Date(Date.now() - 4 * 86400000),
    },
  ],
};

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI missing');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB. Seeding reviews...');

  let createdCount = 0;
  for (const [slug, reviews] of Object.entries(sampleReviewsBySlug)) {
    const dest = await DestinationModel.findOne({ slug }).lean();
    if (!dest) {
      console.log(`Destination slug not found: ${slug}, skipping...`);
      continue;
    }

    for (const r of reviews) {
      const existing = await ReviewModel.findOne({
        destinationId: dest._id,
        authorName: r.authorName,
      });

      if (!existing) {
        await ReviewModel.create({
          destinationId: dest._id,
          authorName: r.authorName,
          authorTier: r.authorTier,
          rating: r.rating,
          content: r.content,
          tags: r.tags,
          isVerifiedVisitor: r.isVerifiedVisitor,
          likesCount: r.likesCount,
          createdAt: r.createdAt,
          response: r.response,
          status: 'published',
        });
        createdCount++;
      }
    }
  }

  console.log(`Seeding complete. Created ${createdCount} reviews.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
