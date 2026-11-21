export interface ExtractedPhotoExif {
  lat?: number;
  lng?: number;
  takenAt?: Date;
  deviceModel?: string;
  hasExifGps: boolean;
  hasExifDate: boolean;
}

export interface PreparedPhotoUpload {
  file: File;
  previewUrl: string;
  exif: ExtractedPhotoExif;
  width?: number;
  height?: number;
}

function readAscii(view: DataView, offset: number, length: number): string {
  let out = '';
  const end = Math.min(view.byteLength, offset + length);
  for (let i = offset; i < end; i++) {
    const code = view.getUint8(i);
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out.trim();
}

function readRational(view: DataView, offset: number, littleEndian: boolean): number {
  if (offset + 8 > view.byteLength) return 0;
  const num = view.getUint32(offset, littleEndian);
  const den = view.getUint32(offset + 4, littleEndian);
  return den === 0 ? 0 : num / den;
}

function parseExifDateString(raw: string): Date | undefined {
  // Standard EXIF format: "YYYY:MM:DD HH:MM:SS"
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return undefined;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const min = Number(m[5]);
  const sec = Number(m[6]);
  const d = new Date(year, month, day, hour, min, sec);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function readIfdEntries(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  littleEndian: boolean,
): Map<number, { type: number; count: number; valueOffset: number }> {
  const map = new Map<number, { type: number; count: number; valueOffset: number }>();
  const start = tiffStart + ifdOffset;
  if (start + 2 > view.byteLength) return map;
  const count = view.getUint16(start, littleEndian);
  for (let i = 0; i < count; i++) {
    const entryOffset = start + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;
    const tag = view.getUint16(entryOffset, littleEndian);
    const type = view.getUint16(entryOffset + 2, littleEndian);
    const valCount = view.getUint32(entryOffset + 4, littleEndian);
    map.set(tag, { type, count: valCount, valueOffset: entryOffset + 8 });
  }
  return map;
}

function readTagString(
  view: DataView,
  tiffStart: number,
  entry: { count: number; valueOffset: number } | undefined,
  littleEndian: boolean,
): string | undefined {
  if (!entry || entry.count === 0) return undefined;
  if (entry.count <= 4) {
    return readAscii(view, entry.valueOffset, entry.count);
  }
  const ptr = view.getUint32(entry.valueOffset, littleEndian);
  if (tiffStart + ptr >= view.byteLength) return undefined;
  return readAscii(view, tiffStart + ptr, Math.min(entry.count, 128));
}

function readGpsDms(
  view: DataView,
  tiffStart: number,
  entry: { count: number; valueOffset: number } | undefined,
  littleEndian: boolean,
): number | undefined {
  if (!entry || entry.count < 3) return undefined;
  const ptr = view.getUint32(entry.valueOffset, littleEndian);
  const base = tiffStart + ptr;
  if (base + 24 > view.byteLength) return undefined;
  const deg = readRational(view, base, littleEndian);
  const min = readRational(view, base + 8, littleEndian);
  const sec = readRational(view, base + 16, littleEndian);
  const decimal = deg + min / 60 + sec / 3600;
  return Number.isFinite(decimal) ? decimal : undefined;
}

/**
 * Pure client-side JPEG EXIF extractor (0 dependencies, <2ms).
 * Extracts GPS coordinates, DateTimeOriginal, and Camera Make/Model from real phone photos.
 */
export async function extractExifFromFile(file: File): Promise<ExtractedPhotoExif> {
  const empty: ExtractedPhotoExif = { hasExifGps: false, hasExifDate: false };
  try {
    // Only scan first 256 KB where JPEG APP1 EXIF header lives
    const slice = file.slice(0, 262_144);
    const buf = await slice.arrayBuffer();
    const view = new DataView(buf);
    if (view.byteLength < 12 || view.getUint16(0, false) !== 0xffd8) {
      return empty;
    }

    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      if (marker === 0xffe1) {
        // APP1 EXIF segment
        const segLen = view.getUint16(offset, false);
        const header = readAscii(view, offset + 2, 6);
        if (header === 'Exif') {
          const tiffStart = offset + 8;
          if (tiffStart + 8 > view.byteLength) return empty;
          const byteOrder = view.getUint16(tiffStart, false);
          const littleEndian = byteOrder === 0x4949;
          if (!littleEndian && byteOrder !== 0x4d4d) return empty;

          const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
          const ifd0 = readIfdEntries(view, tiffStart, firstIfdOffset, littleEndian);

          const make = readTagString(view, tiffStart, ifd0.get(0x010f), littleEndian);
          const model = readTagString(view, tiffStart, ifd0.get(0x0110), littleEndian);
          let deviceModel: string | undefined;
          if (make && model) {
            deviceModel = model.toLowerCase().startsWith(make.toLowerCase()) ? model : `${make} ${model}`;
          } else {
            deviceModel = model || make;
          }

          let takenAt = parseExifDateString(
            readTagString(view, tiffStart, ifd0.get(0x0132), littleEndian) || '',
          );

          // Exif SubIFD (0x8769) -> DateTimeOriginal (0x9003) / DateTimeDigitized (0x9004)
          const exifPtrEntry = ifd0.get(0x8769);
          if (exifPtrEntry) {
            const exifIfdOffset = view.getUint32(exifPtrEntry.valueOffset, littleEndian);
            const exifIfd = readIfdEntries(view, tiffStart, exifIfdOffset, littleEndian);
            const origStr =
              readTagString(view, tiffStart, exifIfd.get(0x9003), littleEndian) ||
              readTagString(view, tiffStart, exifIfd.get(0x9004), littleEndian);
            const parsedOrig = origStr ? parseExifDateString(origStr) : undefined;
            if (parsedOrig) takenAt = parsedOrig;
          }

          // GPS SubIFD (0x8825) -> Lat/Lng
          let lat: number | undefined;
          let lng: number | undefined;
          const gpsPtrEntry = ifd0.get(0x8825);
          if (gpsPtrEntry) {
            const gpsIfdOffset = view.getUint32(gpsPtrEntry.valueOffset, littleEndian);
            const gpsIfd = readIfdEntries(view, tiffStart, gpsIfdOffset, littleEndian);
            const latRef = (readTagString(view, tiffStart, gpsIfd.get(0x0001), littleEndian) || 'N').toUpperCase();
            const rawLat = readGpsDms(view, tiffStart, gpsIfd.get(0x0002), littleEndian);
            const lngRef = (readTagString(view, tiffStart, gpsIfd.get(0x0003), littleEndian) || 'E').toUpperCase();
            const rawLng = readGpsDms(view, tiffStart, gpsIfd.get(0x0004), littleEndian);

            if (rawLat !== undefined && rawLng !== undefined) {
              lat = Number((latRef === 'S' ? -rawLat : rawLat).toFixed(6));
              lng = Number((lngRef === 'W' ? -rawLng : rawLng).toFixed(6));
              if (lat < -90 || lat > 90 || lng < -180 || lng > 180 || (lat === 0 && lng === 0)) {
                lat = undefined;
                lng = undefined;
              }
            }
          }

          return {
            lat,
            lng,
            takenAt,
            deviceModel,
            hasExifGps: lat !== undefined && lng !== undefined,
            hasExifDate: Boolean(takenAt),
          };
        }
        offset += segLen;
      } else if ((marker & 0xff00) !== 0xff00) {
        break;
      } else if (marker === 0xffda || marker === 0xffd9) {
        break;
      } else {
        const segLen = view.getUint16(offset, false);
        offset += segLen;
      }
    }
  } catch {
    // Graceful fallback for non-EXIF files
  }
  return empty;
}

/**
 * Extracts EXIF metadata FIRST (before any canvas resize strips EXIF), then optimizes
 * oversized camera images (>2.2 MB or >2048px) to crisp fast-uploading JPEG.
 */
export async function preparePhotoForUpload(rawFile: File): Promise<PreparedPhotoUpload> {
  const exif = await extractExifFromFile(rawFile);
  const previewUrl = URL.createObjectURL(rawFile);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = previewUrl;
    });

    const maxDim = 2048;
    const needsResize =
      rawFile.size > 2.2 * 1024 * 1024 || img.naturalWidth > maxDim || img.naturalHeight > maxDim;

    if (!needsResize) {
      return {
        file: rawFile,
        previewUrl,
        exif,
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
    }

    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const targetW = Math.max(1, Math.round(img.naturalWidth * scale));
    const targetH = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { file: rawFile, previewUrl, exif, width: img.naturalWidth, height: img.naturalHeight };
    }
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.86),
    );
    if (!blob) {
      return { file: rawFile, previewUrl, exif, width: img.naturalWidth, height: img.naturalHeight };
    }

    const baseName = rawFile.name.replace(/\.[^.]+$/, '') || 'photo';
    const optimizedFile = new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: rawFile.lastModified,
    });

    return {
      file: optimizedFile,
      previewUrl,
      exif,
      width: targetW,
      height: targetH,
    };
  } catch {
    return { file: rawFile, previewUrl, exif };
  }
}
