import { GoogleGenAI } from '@google/genai';
import { getAreaLabel } from '../config/catalog.js';
import { DestinationModel } from '../models/Destination.js';
import { resolveGeminiApiKey } from '../utils/geminiKey.js';
import { haversineKm } from '../utils/geo.js';
import { logger } from '../utils/logger.js';
import { normalizeText } from '../utils/text.js';

export type VisualSceneType =
  | 'beach_coast'
  | 'mountain_hill'
  | 'flower_garden'
  | 'lotus_wetland'
  | 'ancient_temple'
  | 'heritage_house'
  | 'eco_forest'
  | 'river_market'
  | 'food_culinary'
  | 'other';

export interface VisualSceneAnalysis {
  recognizedPlace: string | null;
  sceneType: VisualSceneType;
  sceneLabelVi: string;
  vibeMood: string;
  visualTags: string[];
  searchKeywords: string[];
  mappedCategories: string[];
  usedVisionModel: string;
}

export interface VisualMatchResult {
  id: string;
  slug: string;
  name: string;
  area: string;
  areaLabel: string;
  category: string;
  summary: string;
  imageUrl?: string;
  coordinates?: { lat: number; lng: number };
  vibeScore: number;
  distanceKm?: number;
  matchReason: string;
  isReferencePlace?: boolean;
}

export interface VisualSearchResponse {
  analysis: VisualSceneAnalysis;
  reply: string;
  anchorLabel: string;
  matches: VisualMatchResult[];
  suggestions: string[];
}

const SCENE_KEYWORD_MAP: Record<VisualSceneType, { keywords: string[]; categories: string[]; label: string }> = {
  beach_coast: {
    keywords: ['bien', 'bai bien', 'cat', 'song nuoc', 'ven bien', 'hoang hon', 'hai san', 'du lich bien', 'hang dua'],
    categories: ['nature', 'eco'],
    label: 'Cảnh biển, bãi cát & nghỉ dưỡng duyên hải',
  },
  mountain_hill: {
    keywords: ['nui', 'doi nui', 'san may', 'cap treo', 'deo doc', 'chua tren nui', 'dinh nui', 'rung nui'],
    categories: ['nature', 'culture'],
    label: 'Cảnh núi non hùng vĩ, săn mây & rừng núi',
  },
  flower_garden: {
    keywords: ['hoa', 'lang hoa', 'vuon hoa', 'sac mau', 'check-in', 'man dinh hong', 'sa dec'],
    categories: ['culture', 'local_experience', 'nature'],
    label: 'Làng hoa, vườn hoa rực rỡ sắc màu',
  },
  lotus_wetland: {
    keywords: ['sen', 'dong sen', 'canh dong sen', 'la sen', 'hoa sen', 'thap muoi'],
    categories: ['nature', 'eco'],
    label: 'Đồng sen, đầm lầy sinh thái Sen Hồng',
  },
  ancient_temple: {
    keywords: ['chua', 'co tu', 'thien vien', 'mieu', 'dinh', 'tam linh', 'kien an cung', 'phat'],
    categories: ['culture', 'history'],
    label: 'Chùa cổ, thiền viện & kiến trúc tâm linh',
  },
  heritage_house: {
    keywords: ['nha co', 'kien truc', 'bao tang', 'di tich', 'huynh thuy le', 'co kinh', 'lich su'],
    categories: ['culture', 'history'],
    label: 'Nhà cổ, di tích & kiến trúc di sản',
  },
  eco_forest: {
    keywords: ['sinh thai', 'rung tram', 'tram chim', 'xeo quyt', 'gao giong', 'xuong', 'miet vuon', 'con '],
    categories: ['eco', 'nature'],
    label: 'Khu sinh thái rừng tràm, miệt vườn sông nước',
  },
  river_market: {
    keywords: ['cho', 'cho dem', 'song nuoc', 'cu lao', 'thoi son', 'thuyen', 'ben'],
    categories: ['local_experience', 'food', 'eco'],
    label: 'Chợ sông nước, cù lao & phố đêm ẩm thực',
  },
  food_culinary: {
    keywords: ['hu tieu', 'banh xeo', 'ca loc', 'nem', 'am thuc', 'mon an', 'dac san', 'quan'],
    categories: ['food', 'local_experience'],
    label: 'Ẩm thực đặc sản & món ngon địa phương',
  },
  other: {
    keywords: ['tham quan', 'du lich', 'trai nghiem'],
    categories: ['culture', 'nature', 'eco'],
    label: 'Không gian du lịch & trải nghiệm đặc sắc',
  },
};

function inferFallbackFromTextHints(userPrompt: string, fileName?: string): VisualSceneAnalysis {
  const hint = normalizeText(`${userPrompt} ${fileName || ''}`);
  let sceneType: VisualSceneType = 'eco_forest';
  let recognizedPlace: string | null = null;

  if (hint.includes('phu quoc')) recognizedPlace = 'Biển Phú Quốc';

  if (
    hint.includes('bien') ||
    hint.includes('beach') ||
    hint.includes('sea') ||
    hint.includes('ocean') ||
    hint.includes('phu quoc') ||
    hint.includes('vung tau') ||
    hint.includes('nha trang')
  ) {
    sceneType = 'beach_coast';
  } else if (hint.includes('nui') || hint.includes('mountain') || hint.includes('hill') || hint.includes('da lat')) {
    sceneType = 'mountain_hill';
  } else if (hint.includes('sen') || hint.includes('lotus')) {
    sceneType = 'lotus_wetland';
  } else if (hint.includes('hoa') || hint.includes('flower') || hint.includes('garden')) {
    sceneType = 'flower_garden';
  } else if (hint.includes('chua') || hint.includes('pagoda') || hint.includes('temple')) {
    sceneType = 'ancient_temple';
  } else if (hint.includes('nha co') || hint.includes('bao tang') || hint.includes('museum')) {
    sceneType = 'heritage_house';
  } else if (hint.includes('food') || hint.includes('mon') || hint.includes('an ') || hint.includes('hu tieu')) {
    sceneType = 'food_culinary';
  }

  const preset = SCENE_KEYWORD_MAP[sceneType];
  return {
    recognizedPlace,
    sceneType,
    sceneLabelVi: preset.label,
    vibeMood: 'Khung cảnh giàu bản sắc thiên nhiên & thư giãn',
    visualTags: preset.keywords.slice(0, 6),
    searchKeywords: preset.keywords,
    mappedCategories: preset.categories,
    usedVisionModel: 'heuristic-fallback',
  };
}

async function analyzeImageWithGeminiVision(
  imageBuffer: Buffer,
  mimeType: string,
  userPrompt: string,
  fileName?: string,
): Promise<VisualSceneAnalysis> {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    return inferFallbackFromTextHints(userPrompt, fileName);
  }

  const ai = new GoogleGenAI({ apiKey });
  const promptText = `Bạn là chuyên gia AI phân tích hình ảnh du lịch Việt Nam cho nền tảng Đồng Tháp Smart Travel.
Hãy quan sát bức ảnh người dùng tải lên${userPrompt ? ` (kèm ghi chú của người dùng: "${userPrompt}")` : ''} và trích xuất thông tin cảnh quan để tìm các địa điểm có khung cảnh / vibe tương tự trong hệ thống.

Trả về DUY NHẤT một JSON object hợp lệ với cấu trúc chính xác:
{
  "recognizedPlace": "Tên địa danh cụ thể nếu nhận ra (ví dụ: 'Bãi biển Phú Quốc', 'Chùa Vĩnh Tràng', 'Đà Lạt'), hoặc null nếu không chắc chắn",
  "sceneType": "Chọn đúng 1 giá trị trong: beach_coast | mountain_hill | flower_garden | lotus_wetland | ancient_temple | heritage_house | eco_forest | river_market | food_culinary | other",
  "sceneLabelVi": "Mô tả ngắn bằng tiếng Việt về khung cảnh chính trong ảnh (1 câu ngắn)",
  "vibeMood": "Cảm giác / phong cách trải nghiệm của bức ảnh (ví dụ: 'Thư giãn biển xanh cát mịn nắng vàng')",
  "visualTags": ["5-8 từ khóa tiếng Việt không dấu hoặc có dấu mô tả đặc trưng nhìn thấy trong ảnh"],
  "searchKeywords": ["5-8 từ khóa tiếng Việt gợi ý tìm kiếm địa điểm tương tự"],
  "mappedCategories": ["1-2 mã trong: nature, eco, culture, history, food, local_experience"]
}`;

  const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-2.5-flash'];

  for (const model of modelsToTry) {
    try {
      const response = (await Promise.race([
        ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                { text: promptText },
                {
                  inlineData: {
                    mimeType,
                    data: imageBuffer.toString('base64'),
                  },
                },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Vision timeout')), 9000)),
      ])) as any;

      const rawText = response?.text;
      if (!rawText) continue;

      const parsed = JSON.parse(rawText);
      const validTypes: VisualSceneType[] = [
        'beach_coast',
        'mountain_hill',
        'flower_garden',
        'lotus_wetland',
        'ancient_temple',
        'heritage_house',
        'eco_forest',
        'river_market',
        'food_culinary',
        'other',
      ];
      const sceneType: VisualSceneType = validTypes.includes(parsed.sceneType) ? parsed.sceneType : 'other';
      const fallbackPreset = SCENE_KEYWORD_MAP[sceneType];

      return {
        recognizedPlace: typeof parsed.recognizedPlace === 'string' && parsed.recognizedPlace.trim() ? parsed.recognizedPlace.trim() : null,
        sceneType,
        sceneLabelVi: String(parsed.sceneLabelVi || fallbackPreset.label),
        vibeMood: String(parsed.vibeMood || 'Khung cảnh du lịch ấn tượng'),
        visualTags: Array.isArray(parsed.visualTags) ? parsed.visualTags.map(String).slice(0, 10) : fallbackPreset.keywords,
        searchKeywords: Array.isArray(parsed.searchKeywords)
          ? parsed.searchKeywords.map(String).slice(0, 10)
          : fallbackPreset.keywords,
        mappedCategories: Array.isArray(parsed.mappedCategories)
          ? parsed.mappedCategories.map(String)
          : fallbackPreset.categories,
        usedVisionModel: model,
      };
    } catch (err: any) {
      logger.warn({ model, err: err?.message || err }, 'Visual search model attempt failed, trying fallback');
    }
  }

  return inferFallbackFromTextHints(userPrompt, fileName);
}

/**
 * Performs Multimodal AI Vision analysis + Hybrid Vibe & Geospatial similarity ranking.
 */
export async function searchDestinationsByImage(params: {
  imageBuffer: Buffer;
  mimeType: string;
  originalName?: string;
  userPrompt?: string;
  userLat?: number;
  userLng?: number;
}): Promise<VisualSearchResponse> {
  const { imageBuffer, mimeType, originalName, userPrompt = '', userLat, userLng } = params;

  const analysis = await analyzeImageWithGeminiVision(imageBuffer, mimeType, userPrompt, originalName);
  const hasUserGps = typeof userLat === 'number' && typeof userLng === 'number';
  // Default geographic anchor is Đồng Tháp center (Cao Lãnh) when browser GPS isn't shared
  const anchorCoord = hasUserGps ? { lat: userLat!, lng: userLng! } : { lat: 10.4562, lng: 105.6324 };
  const anchorLabel = hasUserGps ? 'vị trí GPS hiện tại của bạn' : 'trung tâm Đồng Tháp (Cao Lãnh)';

  const catalog = await DestinationModel.find({ publicationStatus: 'published' })
    .select('_id name slug summary description category area tags images coordinates operationalStatus')
    .lean();

  const preset = SCENE_KEYWORD_MAP[analysis.sceneType] || SCENE_KEYWORD_MAP.other;
  const combinedKeywords = Array.from(
    new Set([
      ...preset.keywords.map(normalizeText),
      ...analysis.visualTags.map(normalizeText),
      ...analysis.searchKeywords.map(normalizeText),
    ]),
  ).filter((w) => w.length >= 2);

  const recognizedNorm = analysis.recognizedPlace ? normalizeText(analysis.recognizedPlace) : '';

  const scored: VisualMatchResult[] = catalog
    .filter((d) => d.operationalStatus !== 'closed')
    .map((dest) => {
      const nameNorm = normalizeText(dest.name);
      const hay = normalizeText(
        `${dest.name} ${dest.summary || ''} ${dest.description || ''} ${(dest.tags || []).join(' ')}`,
      );

      let score = 0;
      const reasonParts: string[] = [];

      // 1. Primary Scene-Type structural match (strong weight so beach matches beach, mountain matches mountain)
      const primaryHits = preset.keywords.filter((kw) => hay.includes(kw));
      if (primaryHits.length > 0) {
        score += 36 + Math.min(24, primaryHits.length * 6);
        reasonParts.push(`Cùng cảnh quan "${analysis.sceneLabelVi.toLowerCase()}"`);
      }

      // 2. Semantic visual tag overlap
      const tagHits = combinedKeywords.filter((kw) => hay.includes(kw));
      if (tagHits.length > 0 && primaryHits.length === 0) {
        score += Math.min(35, tagHits.length * 8);
        reasonParts.push('Có nét tương đồng về không gian & trải nghiệm');
      }

      // 3. Category alignment
      if (analysis.mappedCategories.includes(dest.category) || preset.categories.includes(dest.category)) {
        score += 12;
      }

      // 4. Distance calculation & proximity ranking ("gần tôi")
      let distanceKm: number | undefined;
      if (typeof dest.coordinates?.lat === 'number' && typeof dest.coordinates?.lng === 'number') {
        distanceKm = Math.round(haversineKm(anchorCoord, dest.coordinates) * 10) / 10;
        if (score >= 30) {
          if (distanceKm <= 60) {
            score += 24;
            reasonParts.push(`Rất gần ${anchorLabel} (~${distanceKm} km)`);
          } else if (distanceKm <= 150) {
            score += 18;
            reasonParts.push(`Gần khu vực của bạn (~${distanceKm} km)`);
          } else if (distanceKm <= 250) {
            score += 8;
          } else {
            score -= 5;
          }
        }
      }

      // 5. Handle "other places like X" (e.g., user uploaded Phú Quốc photo -> prioritize OTHER nearby beaches!)
      const isReferencePlace = Boolean(
        recognizedNorm &&
          (nameNorm.includes(recognizedNorm) ||
            (recognizedNorm.includes('phu quoc') && nameNorm.includes('phu quoc'))),
      );
      if (isReferencePlace) {
        score -= 18;
        reasonParts.unshift('Địa điểm trùng khớp với ảnh gốc');
      }

      if (reasonParts.length === 0) {
        reasonParts.push('Gợi ý trải nghiệm tương đồng trong hệ thống');
      }

      const clampedScore = Math.max(15, Math.min(98, Math.round(score)));
      return {
        id: String(dest._id),
        slug: dest.slug,
        name: dest.name,
        area: dest.area,
        areaLabel: getAreaLabel(dest.area),
        category: dest.category,
        summary: dest.summary || '',
        imageUrl: dest.images?.[0]?.url,
        coordinates:
          dest.coordinates && typeof dest.coordinates.lat === 'number' && typeof dest.coordinates.lng === 'number'
            ? { lat: dest.coordinates.lat, lng: dest.coordinates.lng }
            : undefined,
        vibeScore: clampedScore,
        distanceKm,
        matchReason: reasonParts.join(' · '),
        isReferencePlace,
      };
    })
    .filter((item) => item.vibeScore >= 32)
    .sort((a, b) => b.vibeScore - a.vibeScore || (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999))
    .slice(0, 6);

  // If no strong scene matches found (rare edge case), gracefully return top 4 nature/culture highlights
  const finalMatches =
    scored.length > 0
      ? scored
      : catalog.slice(0, 4).map((d) => ({
          id: String(d._id),
          slug: d.slug,
          name: d.name,
          area: d.area,
          areaLabel: getAreaLabel(d.area),
          category: d.category,
          summary: d.summary || '',
          imageUrl: d.images?.[0]?.url,
          coordinates:
            d.coordinates && typeof d.coordinates.lat === 'number' && typeof d.coordinates.lng === 'number'
              ? { lat: d.coordinates.lat, lng: d.coordinates.lng }
              : undefined,
          vibeScore: 48,
          distanceKm:
            d.coordinates?.lat && d.coordinates?.lng
              ? Math.round(haversineKm(anchorCoord, d.coordinates) * 10) / 10
              : undefined,
          matchReason: 'Điểm đến nổi bật tại Đồng Tháp gợi ý cho bạn khám phá thêm',
        }));

  const topListText = finalMatches
    .slice(0, 5)
    .map(
      (m, i) =>
        `${i + 1}. **${m.name}** *(${m.areaLabel}${m.distanceKm !== undefined ? ` · ~${m.distanceKm} km` : ''})* — **${m.vibeScore}% tương đồng**`,
    )
    .join('\n');

  const reply =
    `🔍 **Pé Meko đã phân tích khung cảnh từ bức ảnh của bạn!** 🦊📸\n\n` +
    `${analysis.recognizedPlace ? `• 📍 **Nhận diện ảnh**: \`${analysis.recognizedPlace}\`\n` : ''}` +
    `• 🎨 **Cảnh quan & Vibe**: ${analysis.sceneLabelVi} *(${analysis.vibeMood})*\n` +
    `• 🧭 **Tính khoảng cách theo**: ${anchorLabel}\n\n` +
    `**Các địa điểm có khung cảnh tương đồng gợi ý cho bạn:**\n${topListText}\n\n` +
    `Bạn có thể bấm trực tiếp vào thẻ địa điểm bên dưới để xem chi tiết, chỉ đường hoặc đưa vào lịch trình ngay nhé!`;

  return {
    analysis,
    reply,
    anchorLabel,
    matches: finalMatches,
    suggestions: [
      finalMatches[0] ? `Mở ${finalMatches[0].name}` : 'Khám phá địa điểm',
      'Lập lịch trình đi 2 ngày cho 2 người với chi phí 2 tr',
      'Kiểm tra thời tiết và sự cố cho chuyến đi',
    ],
  };
}
