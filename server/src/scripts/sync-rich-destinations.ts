import crypto from 'node:crypto';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { DestinationModel } from '../models/Destination.js';
import { QrCodeModel } from '../models/QrCode.js';
import { richDestinations } from '../seed/richDestinations.js';

async function syncRichDestinations() {
  await connectDatabase();
  console.log('🚀 Đang bắt đầu đồng bộ hóa dữ liệu địa điểm chất lượng cao vào MongoDB...');

  let updatedCount = 0;
  let createdCount = 0;

  for (const item of richDestinations) {
    const existing = await DestinationModel.findOne({ slug: item.slug });

    const updatePayload = {
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
    };

    let targetDocId = existing?._id;

    if (existing) {
      await DestinationModel.updateOne({ _id: existing._id }, { $set: updatePayload });
      updatedCount += 1;
      console.log(`  [Cập nhật ảnh & thông tin] ${item.name} (${item.slug})`);
    } else {
      const created = await DestinationModel.create(updatePayload);
      targetDocId = created._id;
      createdCount += 1;
      console.log(`  [Thêm mới địa điểm local] ${item.name} (${item.slug})`);
    }

    // Đảm bảo có mã QR check-in cho địa điểm này
    if (targetDocId) {
      const existingQr = await QrCodeModel.findOne({ targetId: targetDocId });
      if (!existingQr) {
        const cleanSlug = item.slug.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
        const randStr = crypto.randomBytes(3).toString('hex').toUpperCase();
        const qrCode = `DT-${cleanSlug}-${randStr}`;
        await QrCodeModel.create({
          code: qrCode,
          label: `Check-in ${item.name}`,
          targetType: 'destination',
          targetId: targetDocId,
          status: 'active',
          notes: 'Mã QR thực địa tạo tự động cho địa điểm',
        });
        console.log(`    └─ Tạo mã QR check-in: ${qrCode}`);
      }
    }
  }

  const totalDestinations = await DestinationModel.countDocuments();
  console.log(
    `\n✅ Hoàn tất! Đã cập nhật ${updatedCount} điểm, thêm mới ${createdCount} điểm local. Tổng số địa điểm trong DB: ${totalDestinations}`,
  );

  await disconnectDatabase();
}

void syncRichDestinations();
