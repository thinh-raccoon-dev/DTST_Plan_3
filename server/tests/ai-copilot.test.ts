import { describe, expect, it } from 'vitest';
import { createDestination, newClient, useTestDatabase } from './helpers.js';

useTestDatabase();

async function seedTestCatalog() {
  const tramChim = await createDestination({
    name: 'Vườn quốc gia Tràm Chim',
    slug: 'vuon-quoc-gia-tram-chim',
    area: 'tam-nong',
    category: 'nature',
    coordinates: { lat: 10.6749, lng: 105.5653 },
    summary: 'Khu Ramsar bảo tồn sếu đầu đỏ và hệ sinh thái đất ngập nước.',
  });
  const gaoGiong = await createDestination({
    name: 'Khu du lịch sinh thái Gáo Giồng',
    slug: 'khu-du-lich-sinh-thai-gao-giong',
    area: 'cao-lanh',
    category: 'eco',
    coordinates: { lat: 10.5318, lng: 105.6894 },
    summary: 'Rừng tràm xanh mát và sân chim tự nhiên giữa Đồng Tháp Mười.',
  });
  const nuiCam = await createDestination({
    name: 'Khu du lịch Núi Cấm',
    slug: 'khu-du-lich-nui-cam',
    area: 'cao-lanh',
    category: 'nature',
    coordinates: { lat: 10.498, lng: 105.002 },
    summary: 'Khám phá núi non thiên nhiên và săn mây.',
  });
  const huTieuSaDec = await createDestination({
    name: 'Quán Hủ tiếu Bà Sẩm Sa Đéc',
    slug: 'quan-hu-tieu-ba-sam-sa-dec',
    area: 'sa-dec',
    category: 'food',
    coordinates: { lat: 10.2942, lng: 105.7581 },
    summary: 'Đặc sản hủ tiếu Sa Đéc trứ danh hơn 50 năm.',
  });
  const chuaVinhTrang = await createDestination({
    name: 'Chùa Vĩnh Tràng',
    slug: 'chua-vinh-trang',
    area: 'my-tho',
    category: 'culture',
    coordinates: { lat: 10.3623, lng: 106.3735 },
    summary: 'Ngôi cổ tự kiến trúc Á Âu nổi tiếng tại Mỹ Tho.',
  });
  const baoTang = await createDestination({
    name: 'Bảo tàng Tổng hợp Đồng Tháp',
    slug: 'bao-tang-tong-hop-dong-thap',
    area: 'cao-lanh',
    category: 'culture',
    coordinates: { lat: 10.4562, lng: 105.6324 },
    summary: 'Trưng bày lịch sử văn hóa Óc Eo và Đồng Tháp.',
  });
  const langHoa = await createDestination({
    name: 'Làng hoa Sa Đéc (Tân Quy Đông)',
    slug: 'lang-hoa-sa-dec',
    area: 'sa-dec',
    category: 'local_experience',
    coordinates: { lat: 10.3125, lng: 105.7468 },
    summary: 'Làng hoa trăm năm rực rỡ bên bờ sông Tiền.',
  });
  const bienTanThanh = await createDestination({
    name: 'Biển Tân Thành (Gò Công Đông)',
    slug: 'bien-tan-thanh',
    area: 'my-tho',
    category: 'nature',
    coordinates: { lat: 10.2738, lng: 106.7315 },
    summary: 'Bãi biển cát đen mịn và cầu tàu ngắm bình minh gần Đồng Tháp.',
  });

  return { tramChim, gaoGiong, nuiCam, huTieuSaDec, chuaVinhTrang, baoTang, langHoa, bienTanThanh };
}

const sampleDraftItinerary = {
  title: 'Hành trình Mỹ Tho – Đồng Tháp 2 ngày',
  totalDays: 2,
  days: [
    {
      day: 1,
      date: '2026-11-22',
      stops: [
        {
          stopId: 'stop-1',
          placeId: 'tra-mat-ong-ky-lan',
          name: 'Trà mật ong Kỳ Lân',
          type: 'visit',
          start: '08:30',
          end: '10:00',
          lat: 10.341,
          lng: 106.356,
        },
        {
          stopId: 'stop-2',
          placeId: 'chua-vinh-trang',
          name: 'Chùa Vĩnh Tràng',
          type: 'visit',
          start: '10:30',
          end: '11:30',
          lat: 10.3623,
          lng: 106.3735,
        },
      ],
    },
    {
      day: 2,
      date: '2026-11-23',
      stops: [
        {
          stopId: 'stop-3',
          placeId: 'lang-hoa-sa-dec',
          name: 'Làng hoa Sa Đéc (Tân Quy Đông)',
          type: 'visit',
          start: '09:00',
          end: '11:00',
          lat: 10.3125,
          lng: 105.7468,
        },
      ],
    },
  ],
};

describe('Pé Meko Brain 2.0 — Ground-Truth Stop Swap, Smart Filtering & Multi-Turn Context', () => {
  it('never hallucinates "điểm khác" and opens CHOOSE_SWAP_CANDIDATE with real DB destinations excluding existing stops', async () => {
    await seedTestCatalog();
    const client = await newClient();

    const res = await client.post('/api/v1/ai/copilot', {
      message: 'đổi điểm trà mật ong sang điểm khác',
      pageContext: {
        currentPath: '/itinerary/create',
        hasDraftItinerary: true,
        draftTitle: sampleDraftItinerary.title,
        draftItinerary: sampleDraftItinerary,
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.action?.type).toBe('CHOOSE_SWAP_CANDIDATE');
    const sel = res.body.action.payload.swapSelection;
    expect(sel.targetStopName).toBe('Trà mật ong Kỳ Lân');
    expect(sel.targetStopId).toBe('stop-1');
    expect(sel.dayNumber).toBe(1);
    expect(sel.candidates.length).toBeGreaterThanOrEqual(4);

    // Must never contain fake name "điểm khác" or stops already in the itinerary
    const candidateNames = sel.candidates.map((c: { name: string }) => c.name);
    expect(candidateNames).not.toContain('điểm khác');
    expect(candidateNames).not.toContain('Chùa Vĩnh Tràng');
    expect(candidateNames).not.toContain('Làng hoa Sa Đéc (Tân Quy Đông)');
    expect(typeof sel.candidates[0].distanceKm).toBe('number');
  });

  it('proposes real nature/eco destinations when user asks to swap to "một địa điểm thiên nhiên"', async () => {
    await seedTestCatalog();
    const client = await newClient();

    const res = await client.post('/api/v1/ai/copilot', {
      message: 'đổi điểm trà mật ong sang một địa điểm thiên nhiên',
      pageContext: {
        currentPath: '/itinerary/create',
        hasDraftItinerary: true,
        draftItinerary: sampleDraftItinerary,
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.action?.type).toBe('CHOOSE_SWAP_CANDIDATE');
    const sel = res.body.action.payload.swapSelection;
    expect(sel.criteriaLabel).toContain('Thiên nhiên');
    expect(sel.candidates.length).toBeGreaterThanOrEqual(2);
    // Top candidates must be nature / eco from real DB
    expect(['nature', 'eco']).toContain(sel.candidates[0].category);
    expect(sel.candidates.some((c: { slug: string }) => c.slug === 'vuon-quoc-gia-tram-chim')).toBe(true);
  });

  it('refuses to fabricate an out-of-DB place like "Đà Lạt" and offers real DB alternatives instead', async () => {
    await seedTestCatalog();
    const client = await newClient();

    const res = await client.post('/api/v1/ai/copilot', {
      message: 'đổi trà mật ong sang Đà Lạt',
      pageContext: {
        currentPath: '/itinerary/create',
        hasDraftItinerary: true,
        draftItinerary: sampleDraftItinerary,
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.action?.type).toBe('CHOOSE_SWAP_CANDIDATE');
    expect(res.body.reply).toContain('chưa có địa điểm "Đà Lạt"');
    const sel = res.body.action.payload.swapSelection;
    expect(sel.notFoundQuery).toBe('Đà Lạt');
    expect(sel.candidates.every((c: { name: string }) => c.name !== 'Đà Lạt')).toBe(true);
  });

  it('supports multi-turn selection ("chọn số 2") and criteria refinement ("đổi sang điểm ẩm thực") via pendingSwap', async () => {
    await seedTestCatalog();
    const client = await newClient();

    // Turn 1: open swap picker
    const turn1 = await client.post('/api/v1/ai/copilot', {
      message: 'đổi trà mật ong sang điểm thiên nhiên',
      pageContext: {
        hasDraftItinerary: true,
        draftItinerary: sampleDraftItinerary,
      },
    });
    const pendingSwap = turn1.body.action.payload.swapSelection;
    expect(pendingSwap.candidates.length).toBeGreaterThanOrEqual(2);

    // Turn 2a: refine to food without repeating targetStopName
    const turnRefine = await client.post('/api/v1/ai/copilot', {
      message: 'đổi sang điểm ẩm thực ở Sa Đéc',
      pageContext: {
        hasDraftItinerary: true,
        draftItinerary: sampleDraftItinerary,
        pendingSwap,
      },
    });
    expect(turnRefine.status).toBe(200);
    expect(turnRefine.body.action?.type).toBe('CHOOSE_SWAP_CANDIDATE');
    expect(turnRefine.body.action.payload.swapSelection.targetStopName).toBe('Trà mật ong Kỳ Lân');
    expect(turnRefine.body.action.payload.swapSelection.candidates[0].slug).toBe('quan-hu-tieu-ba-sam-sa-dec');

    // Turn 2b: pick candidate #2 by number -> executes SWAP_ITINERARY_STOP directly!
    const expectedPicked = pendingSwap.candidates[1];
    const turnPick = await client.post('/api/v1/ai/copilot', {
      message: 'chọn số 2',
      pageContext: {
        hasDraftItinerary: true,
        draftItinerary: sampleDraftItinerary,
        pendingSwap,
      },
    });
    expect(turnPick.status).toBe(200);
    expect(turnPick.body.action?.type).toBe('SWAP_ITINERARY_STOP');
    expect(turnPick.body.action.payload.targetStopId).toBe('stop-1');
    expect(turnPick.body.action.payload.newDestination.slug).toBe(expectedPicked.slug);
  });

  it('executes direct SWAP_ITINERARY_STOP for a real DB place, supports REMOVE_ITINERARY_STOP, and inspects draft itinerary', async () => {
    await seedTestCatalog();
    const client = await newClient();

    // Direct exact real destination swap
    const directSwap = await client.post('/api/v1/ai/copilot', {
      message: 'đổi trà mật ong sang Vườn quốc gia Tràm Chim',
      pageContext: {
        hasDraftItinerary: true,
        draftItinerary: sampleDraftItinerary,
      },
    });
    expect(directSwap.status).toBe(200);
    expect(directSwap.body.action?.type).toBe('SWAP_ITINERARY_STOP');
    expect(directSwap.body.action.payload.targetStopName).toBe('Trà mật ong Kỳ Lân');
    expect(directSwap.body.action.payload.newDestination.slug).toBe('vuon-quoc-gia-tram-chim');

    // Open swap without target -> lists real stops from draftItinerary
    const missingTarget = await client.post('/api/v1/ai/copilot', {
      message: 'đổi 1 địa điểm trong lịch trình',
      pageContext: {
        hasDraftItinerary: true,
        draftItinerary: sampleDraftItinerary,
      },
    });
    expect(missingTarget.status).toBe(200);
    expect(missingTarget.body.action?.type).toBe('ASK_CLARIFICATION');
    expect(missingTarget.body.reply).toContain('Trà mật ong Kỳ Lân');
    expect(missingTarget.body.reply).toContain('Chùa Vĩnh Tràng');

    // Remove stop
    const removeRes = await client.post('/api/v1/ai/copilot', {
      message: 'bỏ điểm Trà mật ong khỏi lịch trình',
      pageContext: {
        hasDraftItinerary: true,
        draftItinerary: sampleDraftItinerary,
      },
    });
    expect(removeRes.status).toBe(200);
    expect(removeRes.body.action?.type).toBe('REMOVE_ITINERARY_STOP');
    expect(removeRes.body.action.payload.targetStopId).toBe('stop-1');

    // Inspect itinerary
    const inspectRes = await client.post('/api/v1/ai/copilot', {
      message: 'lịch trình hiện tại của tôi gồm những điểm nào?',
      pageContext: {
        hasDraftItinerary: true,
        draftItinerary: sampleDraftItinerary,
      },
    });
    expect(inspectRes.status).toBe(200);
    expect(inspectRes.body.reply).toContain('Trà mật ong Kỳ Lân');
    expect(inspectRes.body.reply).toContain('Làng hoa Sa Đéc');
  });

  it('handles natural Vietnamese negation, place names with "Thành" ("Biển Tân Thành"), candidate replies, and anaphoric typos ("dổi nó")', async () => {
    const { bienTanThanh } = await seedTestCatalog();
    const client = await newClient();

    const museumItinerary = {
      title: 'Hành trình Mỹ Tho – Bảo tàng 2 ngày',
      totalDays: 2,
      days: [
        {
          day: 1,
          date: '2026-11-22',
          stops: [
            {
              stopId: 'm-1',
              placeId: 'bao-tang-tong-hop-dong-thap',
              name: 'Bảo tàng Tổng hợp Đồng Tháp',
              type: 'visit',
              start: '09:24',
              end: '11:00',
              lat: 10.4562,
              lng: 105.6324,
            },
            {
              stopId: 'm-2',
              placeId: 'tra-mat-ong-ky-lan',
              name: 'Khu Du Lịch Công Đoàn Thới Sơn Mỹ Tho Tiền Giang',
              type: 'visit',
              start: '13:08',
              end: '15:00',
              lat: 10.341,
              lng: 106.356,
            },
          ],
        },
        {
          day: 2,
          date: '2026-11-23',
          stops: [
            {
              stopId: 'm-3',
              placeId: 'chua-vinh-trang',
              name: 'Chùa Vĩnh Tràng Mỹ Tho',
              type: 'visit',
              start: '09:35',
              end: '11:00',
              lat: 10.3623,
              lng: 106.3735,
            },
          ],
        },
      ],
    };

    // Scenario 1: Negation + target before "đổi": "tôi không muốn tham quan bảo tàng đổi qua một địa điểm thiên nhiên khác"
    const s1 = await client.post('/api/v1/ai/copilot', {
      message: 'tôi không muốn tham quan bảo tàng đổi qua một địa điểm thiên nhiên khác',
      pageContext: {
        hasDraftItinerary: true,
        draftItinerary: museumItinerary,
      },
    });
    expect(s1.status).toBe(200);
    expect(s1.body.action?.type).toBe('CHOOSE_SWAP_CANDIDATE');
    expect(s1.body.action.payload.swapSelection.targetStopName).toBe('Bảo tàng Tổng hợp Đồng Tháp');
    expect(s1.body.action.payload.swapSelection.targetStopId).toBe('m-1');
    const pendingSwap = s1.body.action.payload.swapSelection;

    // Scenario 2: "đổi qua biển tân thành đi" must NOT split at "Thành" into target "qua biển tân" -> "đi"!
    const s2 = await client.post('/api/v1/ai/copilot', {
      message: 'đổi qua biển tân thành đi',
      pageContext: {
        hasDraftItinerary: true,
        draftItinerary: museumItinerary,
        pendingSwap,
      },
    });
    expect(s2.status).toBe(200);
    expect(s2.body.action?.type).toBe('SWAP_ITINERARY_STOP');
    expect(s2.body.action.payload.targetStopName).toBe('Bảo tàng Tổng hợp Đồng Tháp');
    expect(s2.body.action.payload.newDestination.slug).toBe('bien-tan-thanh');

    // Scenario 3: "đây nè Biển Tân Thành (Gò Công Đông)" while pendingSwap is active must swap directly (not navigate away)
    const s3 = await client.post('/api/v1/ai/copilot', {
      message: 'đây nè Biển Tân Thành (Gò Công Đông)',
      pageContext: {
        hasDraftItinerary: true,
        draftItinerary: museumItinerary,
        pendingSwap,
      },
    });
    expect(s3.status).toBe(200);
    expect(s3.body.action?.type).toBe('SWAP_ITINERARY_STOP');
    expect(s3.body.action.payload.targetStopName).toBe('Bảo tàng Tổng hợp Đồng Tháp');
    expect(s3.body.action.payload.newDestination.slug).toBe('bien-tan-thanh');

    // Scenario 4: Typo "dổi" + anaphora "nó" + inverted order: "ừa dổi nó với địa điểm bảo tàng ở ngày 1 đi"
    const s4 = await client.post('/api/v1/ai/copilot', {
      message: 'ừa dổi nó với địa điểm bảo tàng ở ngày 1 đi',
      pageContext: {
        hasDraftItinerary: true,
        draftItinerary: museumItinerary,
        lastDiscussedDestination: {
          id: bienTanThanh.id,
          slug: 'bien-tan-thanh',
          name: 'Biển Tân Thành (Gò Công Đông)',
          area: 'Mỹ Tho',
          coordinates: { lat: 10.2738, lng: 106.7315 },
        },
      },
    });
    expect(s4.status).toBe(200);
    expect(s4.body.action?.type).toBe('SWAP_ITINERARY_STOP');
    expect(s4.body.action.payload.dayNumber).toBe(1);
    expect(s4.body.action.payload.targetStopName).toBe('Bảo tàng Tổng hợp Đồng Tháp');
    expect(s4.body.action.payload.newDestination.slug).toBe('bien-tan-thanh');
  });

  it('prevents Vietnamese diacritic homographs ("cho/chỗ" ≠ "chợ", "chưa" ≠ "chùa"), never flags old target stop as notFound, and excludes parenthetical duplicates', async () => {
    await seedTestCatalog();
    // Seed nearby food/market venues (which used to pollute "đổi cho tôi ... thiên nhiên") and parenthetical eco duplicate
    await createDestination({
      name: 'Quán Cháo Cá lóc Rau đắng Chợ Vòng Nhỏ',
      slug: 'quan-chao-ca-loc-cho-vong-nho',
      area: 'my-tho',
      category: 'food',
      coordinates: { lat: 10.351, lng: 106.361 },
      summary: 'Quán cháo cá lóc ngon gần Chợ Vòng Nhỏ, thích hợp cho gia đình.',
    });
    await createDestination({
      name: 'Chợ Mỹ Tho',
      slug: 'cho-my-tho',
      area: 'my-tho',
      category: 'food',
      coordinates: { lat: 10.356, lng: 106.365 },
      summary: 'Chợ trung tâm Mỹ Tho nhộn nhịp với nhiều đặc sản miền Tây.',
    });
    await createDestination({
      name: 'Trại Rắn Đồng Tâm (Trung tâm Dược liệu Quân khu 9)',
      slug: 'trai-ran-dong-tam',
      area: 'my-tho',
      category: 'eco',
      coordinates: { lat: 10.349, lng: 106.292 },
      summary: 'Khu bảo tồn sinh thái rắn và dược liệu nổi tiếng thích hợp cho gia đình.',
    });

    const client = await newClient();
    const richDraft = {
      title: 'Hành trình Mỹ Tho 2 ngày',
      totalDays: 2,
      days: [
        {
          day: 1,
          date: '2026-11-22',
          stops: [
            {
              stopId: 'r-1',
              placeId: 'tra-mat-ong-ky-lan',
              name: 'Trà mật ong Kỳ Lân',
              type: 'visit',
              start: '08:30',
              end: '10:00',
              lat: 10.341,
              lng: 106.356,
            },
            {
              stopId: 'r-2',
              placeId: 'trai-ran',
              name: 'Trại rắn Đồng Tâm',
              type: 'visit',
              start: '13:30',
              end: '15:00',
              lat: 10.349,
              lng: 106.292,
            },
            {
              stopId: 'r-3',
              placeId: 'bao-tang-tong-hop-dong-thap',
              name: 'Bảo tàng Tổng hợp Đồng Tháp',
              type: 'visit',
              start: '15:30',
              end: '17:00',
              lat: 10.4562,
              lng: 105.6324,
            },
          ],
        },
      ],
    };

    // Exact user bug report prompt: "cho tôi" must NOT trigger "Chợ & Phố đêm", and "Trà mật ong Kỳ Lân" must NOT be flagged notFound!
    const res1 = await client.post('/api/v1/ai/copilot', {
      message: 'tôi không muốn đi Trà mật ong đổi cho tôi một địa điểm tham quan về thiên nhiên khác đi',
      pageContext: {
        currentPath: '/itinerary/create',
        hasDraftItinerary: true,
        draftItinerary: richDraft,
      },
    });

    expect(res1.status).toBe(200);
    expect(res1.body.action?.type).toBe('CHOOSE_SWAP_CANDIDATE');
    expect(res1.body.reply).not.toContain('chưa có địa điểm');
    const sel1 = res1.body.action.payload.swapSelection;
    expect(sel1.targetStopName).toBe('Trà mật ong Kỳ Lân');
    expect(sel1.notFoundQuery).toBeUndefined();
    expect(sel1.criteriaLabel).toContain('Thiên nhiên');
    expect(sel1.criteriaLabel).not.toContain('Chợ');
    expect(sel1.candidates.length).toBeGreaterThanOrEqual(3);
    // 100% nature/eco — ZERO food/market venues!
    expect(sel1.candidates.every((c: { category?: string }) => c.category === 'nature' || c.category === 'eco')).toBe(
      true,
    );
    // Parenthetical variant "Trại Rắn Đồng Tâm (...)" must be excluded because "Trại rắn Đồng Tâm" is already in Day 1!
    expect(sel1.candidates.some((c: { slug: string }) => c.slug === 'trai-ran-dong-tam')).toBe(false);

    // Homograph test: "chưa" ≠ "chùa", "chỗ" ≠ "chợ"
    const res2 = await client.post('/api/v1/ai/copilot', {
      message: 'tôi chưa đi chỗ nào thiên nhiên, đổi bảo tàng qua đó đi',
      pageContext: {
        currentPath: '/itinerary/create',
        hasDraftItinerary: true,
        draftItinerary: richDraft,
      },
    });
    expect(res2.status).toBe(200);
    expect(res2.body.action?.type).toBe('CHOOSE_SWAP_CANDIDATE');
    const sel2 = res2.body.action.payload.swapSelection;
    expect(sel2.targetStopName).toBe('Bảo tàng Tổng hợp Đồng Tháp');
    expect(sel2.criteriaLabel).toContain('Thiên nhiên');
    expect(sel2.criteriaLabel).not.toContain('Chùa');
    expect(sel2.criteriaLabel).not.toContain('Chợ');
    expect(sel2.candidates.every((c: { category?: string }) => c.category === 'nature' || c.category === 'eco')).toBe(
      true,
    );
  });
});
