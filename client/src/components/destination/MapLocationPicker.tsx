import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, LocateFixed, MapPin, Maximize2, Minimize2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from '../../stores/toastStore';

interface MapLocationPickerProps {
  lat?: number | string | null;
  lng?: number | string | null;
  onChange: (coords: { lat: number; lng: number }) => void;
  addressHint?: string;
}

const DONG_THAP_PRESETS = [
  { name: 'Chọn điểm mốc nhanh...', lat: 0, lng: 0 },
  { name: 'TP. Sa Đéc (Làng hoa Sa Đéc)', lat: 10.306, lng: 105.748 },
  { name: 'TP. Sa Đéc (Nhà cổ Huỳnh Thủy Lê)', lat: 10.2989, lng: 105.7583 },
  { name: 'TP. Cao Lãnh (Khu di tích Nguyễn Sinh Sắc)', lat: 10.4578, lng: 105.6331 },
  { name: 'TP. Cao Lãnh (Bảo tàng Tổng hợp)', lat: 10.4608, lng: 105.6318 },
  { name: 'Cao Lãnh (Khu di tích Xẻo Quýt)', lat: 10.3955, lng: 105.8091 },
  { name: 'Cao Lãnh (Khu du lịch Gáo Giồng)', lat: 10.5518, lng: 105.5862 },
  { name: 'Tam Nông (Vườn quốc gia Tràm Chim)', lat: 10.7061, lng: 105.5186 },
  { name: 'Tháp Mười (Khu di tích Gò Tháp)', lat: 10.6015, lng: 105.8193 },
  { name: 'Tháp Mười (Đồng sen Tháp Mười)', lat: 10.5752, lng: 105.8367 },
  { name: 'Lai Vung (Làng nghề nem Lai Vung)', lat: 10.2312, lng: 105.6698 },
  { name: 'Lấp Vò (Làng chiếu Định Yên)', lat: 10.2742, lng: 105.6175 },
  { name: 'Tiền Giang (Cù lao Thới Sơn)', lat: 10.3392, lng: 106.3355 },
  { name: 'Mỹ Tho (Chùa Vĩnh Tràng)', lat: 10.3622, lng: 106.3742 },
];

function createLotusPinIcon() {
  return L.divIcon({
    className: 'custom-lotus-marker',
    html: `
      <div style="position: relative; width: 34px; height: 42px; transform: translate(-50%, -100%);">
        <svg viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; filter: drop-shadow(0 4px 6px rgba(15, 23, 42, 0.4));">
          <path d="M18 43C18 43 34 26.5 34 17C34 7.6 26.8 0 18 0C9.2 0 2 7.6 2 17C2 26.5 18 43 18 43Z" fill="#15803d" stroke="#ffffff" stroke-width="2"/>
          <circle cx="18" cy="17" r="7.5" fill="#f43f5e" stroke="#ffffff" stroke-width="1.5"/>
          <circle cx="18" cy="17" r="3" fill="#ffffff"/>
        </svg>
      </div>
    `,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
    popupAnchor: [0, -38],
  });
}

export function MapLocationPicker({ lat, lng, onChange, addressHint }: MapLocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const numLat = typeof lat === 'number' ? lat : typeof lat === 'string' && lat.trim() !== '' ? Number(lat) : null;
  const numLng = typeof lng === 'number' ? lng : typeof lng === 'string' && lng.trim() !== '' ? Number(lng) : null;
  const hasValidCoords = numLat !== null && numLng !== null && !Number.isNaN(numLat) && !Number.isNaN(numLng);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialCenter: [number, number] = hasValidCoords
      ? [numLat, numLng]
      : [10.45, 105.63]; // Dong Thap center
    const initialZoom = hasValidCoords ? 15 : 10;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    // Click handler to pick location
    map.on('click', (e: L.LeafletMouseEvent) => {
      const pickedLat = Number(e.latlng.lat.toFixed(6));
      const pickedLng = Number(e.latlng.lng.toFixed(6));
      updateMarker(pickedLat, pickedLng, true);
      onChange({ lat: pickedLat, lng: pickedLng });
    });

    mapInstanceRef.current = map;

    if (hasValidCoords) {
      updateMarker(numLat, numLng, false);
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Update marker position when props change from inputs
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (hasValidCoords) {
      updateMarker(numLat, numLng, false);
    }
  }, [numLat, numLng, hasValidCoords]);

  // Invalidate map size when expanded
  useEffect(() => {
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [isExpanded]);

  function updateMarker(targetLat: number, targetLng: number, flyTo: boolean) {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!markerRef.current) {
      const icon = createLotusPinIcon();
      const marker = L.marker([targetLat, targetLng], {
        icon,
        draggable: true,
      }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        const updatedLat = Number(pos.lat.toFixed(6));
        const updatedLng = Number(pos.lng.toFixed(6));
        marker.setPopupContent(`
          <div style="font-family: inherit; font-size: 13px;">
            <b style="color: #15803d;">📍 Vị trí đã chọn:</b><br/>
            <code>${updatedLat}, ${updatedLng}</code>
          </div>
        `);
        onChange({ lat: updatedLat, lng: updatedLng });
      });

      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 13px;">
          <b style="color: #15803d;">📍 Vị trí đã chọn:</b><br/>
          <code>${targetLat}, ${targetLng}</code><br/>
          <span style="color: #64748b; font-size: 11px;">(Kéo thả marker để tinh chỉnh)</span>
        </div>
      `);

      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng([targetLat, targetLng]);
      markerRef.current.setPopupContent(`
        <div style="font-family: inherit; font-size: 13px;">
          <b style="color: #15803d;">📍 Vị trí đã chọn:</b><br/>
          <code>${targetLat}, ${targetLng}</code><br/>
          <span style="color: #64748b; font-size: 11px;">(Kéo thả marker để tinh chỉnh)</span>
        </div>
      `);
    }

    if (flyTo) {
      map.flyTo([targetLat, targetLng], Math.max(map.getZoom(), 14), { duration: 0.8 });
    }
  }

  function handleLocateMe() {
    if (!navigator.geolocation) {
      toast.info('Trình duyệt của bạn không hỗ trợ định vị GPS.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const myLat = Number(pos.coords.latitude.toFixed(6));
        const myLng = Number(pos.coords.longitude.toFixed(6));
        updateMarker(myLat, myLng, true);
        onChange({ lat: myLat, lng: myLng });
        toast.success(`Đã lấy vị trí GPS hiện tại: ${myLat}, ${myLng}`);
      },
      (err) => {
        setIsLocating(false);
        toast.info(`Không thể lấy vị trí GPS: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function handleSelectPreset(e: React.ChangeEvent<HTMLSelectElement>) {
    const idx = Number(e.target.value);
    if (idx === 0) return;
    const preset = DONG_THAP_PRESETS[idx];
    if (preset && preset.lat !== 0) {
      updateMarker(preset.lat, preset.lng, true);
      onChange({ lat: preset.lat, lng: preset.lng });
      toast.info(`Đã chuyển bản đồ đến: ${preset.name}`);
    }
  }

  return (
    <div className="mt-2 rounded-card border border-sand-300 bg-sand-50/70 p-3 shadow-sm sm:p-4">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-leaf-100 text-leaf-700">
            <Crosshair className="size-4" />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-river-900">Chấm điểm trên bản đồ tương tác</h4>
            <p className="text-xs text-river-600">
              Click bất kỳ điểm nào trên bản đồ hoặc kéo thả ghim để tự động điền tọa độ GPS
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Preset Selector */}
          <select
            onChange={handleSelectPreset}
            aria-label="Chọn điểm mốc mẫu Đồng Tháp"
            className="rounded-control border border-sand-300 bg-white px-2.5 py-1 text-xs text-river-700 shadow-sm focus:border-leaf-600 focus:outline-none"
          >
            {DONG_THAP_PRESETS.map((preset, i) => (
              <option key={preset.name} value={i}>
                {preset.name}
              </option>
            ))}
          </select>

          {/* GPS Current Location button */}
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocating}
            title="Lấy vị trí GPS của tôi ngay bây giờ"
            className="inline-flex items-center gap-1.5 rounded-control border border-sand-300 bg-white px-2.5 py-1 text-xs font-medium text-leaf-700 shadow-sm hover:bg-leaf-50 disabled:opacity-50"
          >
            <LocateFixed className="size-3.5" />
            {isLocating ? 'Đang định vị...' : 'GPS của tôi'}
          </button>

          {/* Expand/Collapse Map */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Thu nhỏ bản đồ' : 'Phóng to bản đồ'}
            className="inline-flex items-center gap-1 rounded-control border border-sand-300 bg-white px-2 py-1 text-xs font-medium text-river-700 shadow-sm hover:bg-sand-100"
          >
            {isExpanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            {isExpanded ? 'Thu nhỏ' : 'Mở rộng'}
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div
        ref={mapContainerRef}
        style={{ height: isExpanded ? '460px' : '260px' }}
        className="relative z-0 w-full overflow-hidden rounded-control border border-sand-300 shadow-inner transition-[height] duration-200"
      />

      {/* Status feedback bar */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-river-600">
        <div className="flex items-center gap-1.5">
          <MapPin className="size-3.5 text-leaf-600" />
          {hasValidCoords ? (
            <span>
              Tọa độ đang chọn: <strong className="font-mono text-river-900">{numLat}, {numLng}</strong>
            </span>
          ) : (
            <span className="italic text-amber-700">Chưa có tọa độ — Hãy click lên bản đồ để chấm vị trí điểm đến</span>
          )}
        </div>
        {addressHint && (
          <span className="max-w-md truncate text-river-500" title={addressHint}>
            Địa chỉ tham chiếu: {addressHint}
          </span>
        )}
      </div>
    </div>
  );
}
