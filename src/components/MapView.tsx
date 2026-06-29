import { useEffect, useRef, useCallback, useState } from "react";
import { MapProperty } from "@/data/mapProperties";
import { loadKakaoMaps } from "@/lib/kakaoMapsLoader";
import { RadiusCircle, haversineMeters, formatRadius } from "@/lib/geoDistance";
import mapPinAsset from "@/assets/map-pin.png.asset.json";

const MAP_PIN_URL = mapPinAsset.url;
const MOBILE_QUERY = "(max-width: 767px)";
const TAP_MOVE_THRESHOLD_PX = 10;
const TAP_MAX_DURATION_MS = 420;
const GESTURE_SETTLE_MS = 80;
const MOBILE_MAX_RENDER_PROPS = 260;
const DESKTOP_MAX_RENDER_PROPS = 900;

const TYPE_COLORS: Record<string, string> = {
  "상가": "#1e40af",
  "사무실": "#6d28d9",
  "식당·카페": "#ea580c",
  "공장·창고": "#166534",
  "병원·학원": "#9f1239",
  "지식산업": "#0e7490",
  "아파트": "#1e40af",
  "원룸": "#0369a1",
  "빌라": "#0284c7",
  "오피스텔": "#7c3aed",
  "토지": "#166534",
  "투룸": "#0369a1",
  "쓰리룸+": "#0369a1",
  "투베이": "#0369a1",
};

const TYPE_ACCENT: Record<string, string> = {
  "상가": "#3b82f6",
  "사무실": "#a78bfa",
  "식당·카페": "#fb923c",
  "공장·창고": "#4ade80",
  "병원·학원": "#fb7185",
  "지식산업": "#22d3ee",
  "아파트": "#60a5fa",
  "원룸": "#38bdf8",
  "빌라": "#38bdf8",
  "오피스텔": "#a78bfa",
  "토지": "#4ade80",
  "투룸": "#38bdf8",
  "쓰리룸+": "#38bdf8",
  "투베이": "#38bdf8",
};

/** 줌 레벨 → 핀 크기(px) 매핑 */
function getPinSize(zoomLevel: number, isMobile = false): number {
  if (isMobile) {
    if (zoomLevel <= 2) return 74;
    if (zoomLevel <= 3) return 66;
    if (zoomLevel <= 4) return 58;
    if (zoomLevel <= 5) return 50;
    if (zoomLevel <= 6) return 44;
    if (zoomLevel <= 7) return 40;
    return 36;
  }
  if (zoomLevel <= 2) return 100;
  if (zoomLevel <= 3) return 90;
  if (zoomLevel <= 4) return 80;
  if (zoomLevel <= 5) return 72;
  if (zoomLevel <= 6) return 64;
  if (zoomLevel <= 7) return 58;
  if (zoomLevel <= 8) return 52;
  return 46;
}

/** 첨부 이미지 핀(원형) + 가운데 숫자 — 체크 시 색상만 변경 */
function createPinImageHtml(count: number, size: number, isSelected = false) {
  const digits = String(count).length;
  const ratio = digits >= 4 ? 0.28 : digits === 3 ? 0.34 : digits === 2 ? 0.42 : 0.48;
  const fontSize = Math.max(11, Math.round(size * ratio));
  const hitPad = Math.max(10, Math.round(size * 0.18));
  // 체크 상태일 때 hue-rotate 로 색상만 변경 (크기/배지 변경 없음)
  const imgFilter = isSelected
    ? "hue-rotate(140deg) saturate(1.6) brightness(1.05)"
    : "none";
  return `
    <div data-pin-hitbox="true" style="
      position:relative;
      width:${size + hitPad * 2}px;height:${size + hitPad * 2}px;
      padding:${hitPad}px;
      transform-origin:center center;
      cursor:pointer;
      pointer-events:auto;
      background:rgba(255,255,255,0.001);
      filter:${isSelected ? "drop-shadow(0 3px 5px rgba(0,0,0,0.35))" : "none"};
    ">
      <div style="position:relative;width:${size}px;height:${size}px;pointer-events:auto;">
        <img src="${MAP_PIN_URL}" alt="" draggable="false"
          style="width:100%;height:100%;display:block;pointer-events:none;-webkit-user-drag:none;filter:${imgFilter};" />
        <div style="
          position:absolute;inset:0;
          display:flex;align-items:center;justify-content:center;
          color:#fff;font-weight:800;
          font-size:${fontSize}px;line-height:1;
          text-shadow:0 1px 2px rgba(0,0,0,0.55);
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
          pointer-events:auto;
          background:transparent;
          transform:translateY(-0.12em);
          z-index:1;
        ">${count}</div>
      </div>
      <div style="
        position:absolute;inset:0;
        pointer-events:auto;
        background:rgba(255,255,255,0.001);
        z-index:3;
        cursor:pointer;
      "></div>
    </div>
  `;
}

function createPinHtml(property: MapProperty, isSelected: boolean, zoomLevel: number, isMobile = false) {
  return createPinImageHtml(1, getPinSize(zoomLevel, isMobile), isSelected);
}

/** 클러스터: 같은 원형 핀에 숫자만 크게 */
function createClusterHtml(count: number, zoomLevel: number, isSelected = false, isMobile = false) {
  const base = getPinSize(zoomLevel, isMobile);
  const size = count >= 100 ? Math.round(base * 1.35) : count >= 10 ? Math.round(base * 1.2) : Math.round(base * 1.05);
  return createPinImageHtml(count, size, isSelected);
}

interface Cluster {
  key: string;
  lat: number;
  lng: number;
  items: MapProperty[];
}

/** 픽셀 기반 그리디 클러스터링 — 시각적으로 겹치는 핀은 모두 묶어서 표시 */
function buildClusters(
  props: MapProperty[],
  zoom: number,
  _selSet: Set<number>,
  map?: any,
  isMobile = false,
): { clusters: Cluster[]; singles: MapProperty[] } {
  const valid = props.filter(p => p.lat && p.lng);
  const pinPx = getPinSize(zoom, isMobile);
  // 핀 직경 + 약간의 여백을 클러스터 반경으로 사용 → 절대 겹치지 않음
  const radiusPx = pinPx * 1.05;

  // 픽셀 좌표 계산
  const proj = map?.getProjection?.();
  type Pt = { p: MapProperty; x: number; y: number };
  const pts: Pt[] = [];
  if (proj?.pointFromCoords) {
    valid.forEach(p => {
      try {
        const pt = proj.pointFromCoords(new window.kakao.maps.LatLng(p.lat, p.lng));
        pts.push({ p, x: pt.x, y: pt.y });
      } catch (_) {}
    });
  } else {
    // 폴백: 위경도 → 근사 픽셀 (kakao 줌 z 에서 1px ≈ 2^(z-1) * 0.00008°)
    const degPerPx = 0.00008 * Math.pow(2, Math.max(0, zoom - 1));
    valid.forEach(p => {
      pts.push({ p, x: p.lng / degPerPx, y: -p.lat / degPerPx });
    });
  }

  const singles: MapProperty[] = [];
  const clusters: Cluster[] = [];
  const used = new Array(pts.length).fill(false);
  const r2 = radiusPx * radiusPx;
  const cellSize = Math.max(radiusPx, 1);
  const grid = new Map<string, number[]>();
  const cellKey = (x: number, y: number) => `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`;

  pts.forEach((pt, idx) => {
    const key = cellKey(pt.x, pt.y);
    const bucket = grid.get(key);
    if (bucket) bucket.push(idx);
    else grid.set(key, [idx]);
  });

  // id 기준 순회 + 공간 그리드로 주변 셀만 검사해 모바일 줌/드래그 중 O(n²) 렉 방지
  const order = pts.map((_, i) => i).sort((a, b) => pts[a].p.id - pts[b].p.id);
  for (const i of order) {
    if (used[i]) continue;
    const base = pts[i];
    used[i] = true;
    const group: Pt[] = [base];
    const cx = Math.floor(base.x / cellSize);
    const cy = Math.floor(base.y / cellSize);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const bucket = grid.get(`${gx}:${gy}`);
        if (!bucket) continue;
        for (const j of bucket) {
          if (j === i || used[j]) continue;
          const dx = pts[j].x - base.x;
          const dy = pts[j].y - base.y;
          if (dx * dx + dy * dy <= r2) {
            used[j] = true;
            group.push(pts[j]);
          }
        }
      }
    }
    if (group.length === 1) {
      singles.push(group[0].p);
    } else {
      let sLat = 0, sLng = 0;
      group.forEach(g => { sLat += g.p.lat; sLng += g.p.lng; });
      const ids = group.map(g => g.p.id).sort((a, b) => a - b).join(",");
      clusters.push({
        key: `g:${ids}`,
        lat: sLat / group.length,
        lng: sLng / group.length,
        items: group.map(g => g.p),
      });
    }
  }
  return { clusters, singles };
}

export interface MapBounds {
  swLat: number; swLng: number; neLat: number; neLng: number;
}

interface MapViewProps {
  properties: MapProperty[];
  selectedId: number | null;
  /** 다중 선택 유지 — 포함된 모든 핀을 강조 표시 */
  selectedIds?: number[];
  onSelect: (id: number) => void;
  /** 지도 이동/줌 시 현재 화면 범위 콜백 */
  onBoundsChange?: (bounds: MapBounds) => void;
  /** 기존 호출부 호환용: 선택 시 자동 지도 이동은 하지 않음 */
  suppressPan?: boolean;
  /** 반경검색 모드 활성화 — true면 지도 클릭/드래그로 원 그리기 */
  radiusMode?: boolean;
  /** 반경검색 결과 콜백 (null = 해제) */
  radiusCircle?: RadiusCircle | null;
  onRadiusChange?: (c: RadiusCircle | null) => void;
  /** 줌/드래그 시작 시 핀 선택 해제용 콜백 */
  onMapMoveClear?: () => void;
  /** 숫자 클러스터 클릭 시 포함된 매물 id 목록 */
  onClusterSelect?: (ids: number[]) => void;
  /** 깜빡일 핀 id */
  blinkId?: number | null;
  /** 깜빡임 트리거 (변경될 때마다 재실행) */
  blinkTrigger?: number;
}

const MapView = ({ properties, selectedId, selectedIds, onSelect, onBoundsChange, suppressPan, radiusMode, radiusCircle, onRadiusChange, onMapMoveClear, onClusterSelect, blinkId, blinkTrigger }: MapViewProps) => {
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<Map<string, any>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const zoomLevelRef = useRef<number>(5);
  const [mapError, setMapError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const retryTimeoutRef = useRef<number | null>(null);
  const autoRetryCountRef = useRef(0);
  const resizeFrameRef = useRef<number | null>(null);
  const lastMapSizeRef = useRef({ width: 0, height: 0 });
  const isMobileRef = useRef(false);
  const gestureBlockUntilRef = useRef(0);

  // 반경검색 관련 ref
  const circleOverlayRef = useRef<any>(null);
  const radiusLabelRef = useRef<any>(null);
  const markerClickLockUntilRef = useRef(0);
  const markerTouchRef = useRef<{ x: number; y: number; time: number; moved: boolean; touches: number } | null>(null);
  const draggingRef = useRef(false);
  const dragCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const radiusModeRef = useRef<boolean>(!!radiusMode);
  useEffect(() => { radiusModeRef.current = !!radiusMode; }, [radiusMode]);

  const stopMarkerEvent = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    (event as any).stopImmediatePropagation?.();
  };
  const isGestureBlocked = () => Date.now() < gestureBlockUntilRef.current;
  const getTouchPoint = (event: TouchEvent) => {
    const touch = event.changedTouches[0] ?? event.touches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  // 최신 props를 ref로 유지 (zoom 이벤트 핸들러에서 사용)
  const propsRef = useRef({ properties, selectedId, selectedIds, onSelect, onBoundsChange, onRadiusChange, onMapMoveClear, onClusterSelect });
  useEffect(() => {
    propsRef.current = { properties, selectedId, selectedIds, onSelect, onBoundsChange, onRadiusChange, onMapMoveClear, onClusterSelect };
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const updateMobile = () => { isMobileRef.current = mql.matches; };
    updateMobile();
    mql.addEventListener("change", updateMobile);
    return () => mql.removeEventListener("change", updateMobile);
  }, []);

  const waitForContainerReady = useCallback(async () => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (!mountedRef.current || !containerRef.current) return false;
      if (containerRef.current.clientWidth > 0 && containerRef.current.clientHeight > 0) {
        return true;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    }
    return Boolean(containerRef.current?.clientWidth && containerRef.current?.clientHeight);
  }, []);

  const boundsTimerRef = useRef<number | null>(null);
  const fireBounds = useCallback((map: any) => {
    if (boundsTimerRef.current) window.clearTimeout(boundsTimerRef.current);
    boundsTimerRef.current = window.setTimeout(() => {
      try {
        const b = map.getBounds();
        const sw = b.getSouthWest();
        const ne = b.getNorthEast();
        propsRef.current.onBoundsChange?.({
          swLat: sw.getLat(), swLng: sw.getLng(),
          neLat: ne.getLat(), neLng: ne.getLng(),
        });
      } catch (_) {}
    }, 120);
  }, []);

  const clearOverlays = useCallback(() => {
    overlaysRef.current.forEach((o) => {
      try { o.setMap(null); } catch (_) {}
    });
    overlaysRef.current.clear();
  }, []);

  const clearRadiusCircle = useCallback(() => {
    if (circleOverlayRef.current) {
      try { circleOverlayRef.current.setMap(null); } catch (_) {}
      circleOverlayRef.current = null;
    }
    if (radiusLabelRef.current) {
      try { radiusLabelRef.current.setMap(null); } catch (_) {}
      radiusLabelRef.current = null;
    }
  }, []);

  const drawCircle = useCallback((center: { lat: number; lng: number }, radius: number) => {
    const map = mapRef.current;
    if (!map || !window.kakao?.maps) return;
    const pos = new window.kakao.maps.LatLng(center.lat, center.lng);

    if (!circleOverlayRef.current) {
      circleOverlayRef.current = new window.kakao.maps.Circle({
        center: pos,
        radius: Math.max(radius, 1),
        strokeWeight: 2,
        strokeColor: "#1e40af",
        strokeOpacity: 0.9,
        strokeStyle: "solid",
        fillColor: "#3b82f6",
        fillOpacity: 0.18,
      });
      circleOverlayRef.current.setMap(map);
    } else {
      circleOverlayRef.current.setPosition(pos);
      circleOverlayRef.current.setRadius(Math.max(radius, 1));
    }

    // 반경 라벨
    const labelHtml = `
      <div style="
        background:#1e40af;color:#fff;font-size:11px;font-weight:700;
        padding:3px 8px;border-radius:999px;white-space:nowrap;
        box-shadow:0 2px 6px rgba(0,0,0,0.25);transform:translate(-50%,-50%);
      ">반경 ${formatRadius(radius)}</div>
    `;
    const labelDiv = document.createElement("div");
    labelDiv.innerHTML = labelHtml;
    if (!radiusLabelRef.current) {
      radiusLabelRef.current = new window.kakao.maps.CustomOverlay({
        position: pos,
        content: labelDiv,
        map,
        zIndex: 2000,
      });
    } else {
      radiusLabelRef.current.setPosition(pos);
      radiusLabelRef.current.setContent(labelDiv);
    }
  }, []);

  const resetMapInstance = useCallback(() => {
    clearOverlays();
    clearRadiusCircle();
    mapRef.current = null;
  }, [clearOverlays, clearRadiusCircle]);

  const renderOverlays = useCallback(
    (map: any, props: MapProperty[], selId: number | null, onSelectFn: (id: number) => void, zoom: number) => {
      const existing = overlaysRef.current;
      const nextKeys = new Set<string>();
      const selSet = new Set<number>();
      (propsRef.current.selectedIds ?? []).forEach((id) => selSet.add(id));
      if (selId !== null && selId !== undefined) {
        selSet.add(selId);
      }

      const isMobile = isMobileRef.current;
      let renderProps = props;
      try {
        const bounds = map.getBounds?.();
        const sw = bounds?.getSouthWest?.();
        const ne = bounds?.getNorthEast?.();
        if (sw && ne) {
          const latPad = Math.max((ne.getLat() - sw.getLat()) * (isMobile ? 0.35 : 0.2), 0.002);
          const lngPad = Math.max((ne.getLng() - sw.getLng()) * (isMobile ? 0.35 : 0.2), 0.002);
          renderProps = props.filter((p) =>
            selSet.has(p.id) ||
            (p.lat && p.lng &&
              p.lat >= sw.getLat() - latPad && p.lat <= ne.getLat() + latPad &&
              p.lng >= sw.getLng() - lngPad && p.lng <= ne.getLng() + lngPad)
          );
        }
      } catch (_) {}

      const maxRenderProps = isMobile ? MOBILE_MAX_RENDER_PROPS : DESKTOP_MAX_RENDER_PROPS;
      if (renderProps.length > maxRenderProps) {
        try {
          const center = map.getCenter?.();
          const cLat = center?.getLat?.() ?? 36.6285;
          const cLng = center?.getLng?.() ?? 127.4568;
          const selectedProps = renderProps.filter((p) => selSet.has(p.id));
          const selectedSet = new Set(selectedProps.map((p) => p.id));
          const nearest = renderProps
            .filter((p) => !selectedSet.has(p.id))
            .sort((a, b) => {
              const da = (a.lat - cLat) ** 2 + (a.lng - cLng) ** 2;
              const db = (b.lat - cLat) ** 2 + (b.lng - cLng) ** 2;
              return da - db;
            })
            .slice(0, Math.max(0, maxRenderProps - selectedProps.length));
          renderProps = [...selectedProps, ...nearest];
        } catch (_) {
          renderProps = renderProps.slice(0, maxRenderProps);
        }
      }

      const { clusters, singles } = buildClusters(renderProps, zoom, selSet, map, isMobile);

      // 개별 핀 렌더
      singles.forEach((prop) => {
        const key = `p:${prop.id}`;
        nextKeys.add(key);
        const isSelected = selSet.has(prop.id);
        const prev = existing.get(key);

        if (prev) {
          try {
            const curPos = prev.getPosition?.();
            if (curPos?.getLat?.() !== prop.lat || curPos?.getLng?.() !== prop.lng) {
              prev.setPosition(new window.kakao.maps.LatLng(prop.lat, prop.lng));
            }
          } catch (_) {}
          const content = prev.getContent() as HTMLDivElement;
          if (content && content.dataset) {
            const sig = `pin|${isSelected ? 1 : 0}|${zoom}|${prop.type}|${isMobile ? 1 : 0}`;
            if (content.dataset.sig !== sig) {
              content.innerHTML = createPinHtml(prop, isSelected, zoom, isMobile);
              content.dataset.sig = sig;
            }
            content.dataset.mapMarkerIds = String(prop.id);
          }
          try { prev.setZIndex(isSelected ? 1000 : 0); } catch (_) {}
          return;
        }

        const content = document.createElement("div");
        content.innerHTML = createPinHtml(prop, isSelected, zoom, isMobile);
        content.style.cssText = `cursor:pointer;touch-action:${isMobile ? "auto" : "manipulation"};`;
        content.dataset.sig = `pin|${isSelected ? 1 : 0}|${zoom}|${prop.type}|${isMobile ? 1 : 0}`;
        content.dataset.mapMarkerIds = String(prop.id);

        const overlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(prop.lat, prop.lng),
          content,
          map,
          yAnchor: 0.5,
          xAnchor: 0.5,
          zIndex: isSelected ? 1000 : 0,
        });
        existing.set(key, overlay);
      });

      // 클러스터 렌더 (숫자 원형)
      clusters.forEach((c) => {
        const key = `c:${c.key}`;
        nextKeys.add(key);
        const count = c.items.length;
        const isClusterSelected = c.items.some((it) => selSet.has(it.id));
        const prev = existing.get(key);
        // 단일 항목 클러스터는 정확한 매물 좌표로 표시 (centroid 편차 제거)
        const posLat = count === 1 ? c.items[0].lat : c.lat;
        const posLng = count === 1 ? c.items[0].lng : c.lng;

        if (prev) {
          try {
            const curPos = prev.getPosition?.();
            if (curPos?.getLat?.() !== posLat || curPos?.getLng?.() !== posLng) {
              prev.setPosition(new window.kakao.maps.LatLng(posLat, posLng));
            }
          } catch (_) {}
          const content = prev.getContent() as HTMLDivElement;
          if (content && content.dataset) {
            const sig = `cluster|${count}|${zoom}|${isClusterSelected ? 1 : 0}|${isMobile ? 1 : 0}`;
            if (content.dataset.sig !== sig) {
              content.innerHTML = createClusterHtml(count, zoom, isClusterSelected, isMobile);
              content.dataset.sig = sig;
            }
            content.dataset.ids = c.items.map(it => it.id).join(",");
            content.dataset.mapMarkerIds = c.items.map(it => it.id).join(",");
          }
          try { prev.setZIndex(isClusterSelected ? 1000 : 500); } catch (_) {}
          return;
        }

        const content = document.createElement("div");
        content.innerHTML = createClusterHtml(count, zoom, isClusterSelected, isMobile);
        content.style.cssText = `cursor:pointer;touch-action:${isMobile ? "auto" : "manipulation"};`;
        content.dataset.sig = `cluster|${count}|${zoom}|${isClusterSelected ? 1 : 0}|${isMobile ? 1 : 0}`;
        content.dataset.ids = c.items.map(it => it.id).join(",");
        content.dataset.mapMarkerIds = c.items.map(it => it.id).join(",");

        const overlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(posLat, posLng),
          content,
          map,
          yAnchor: 0.5,
          xAnchor: 0.5,
          zIndex: isClusterSelected ? 1000 : 500,
        });
        existing.set(key, overlay);
      });

      // 사라진 오버레이 제거
      existing.forEach((overlay, key) => {
        if (!nextKeys.has(key)) {
          try { overlay.setMap(null); } catch (_) {}
          existing.delete(key);
        }
      });
    },
    []
  );



  // 지도 초기화 + zoom_changed / drag_end 이벤트 등록
  useEffect(() => {
    mountedRef.current = true;

    let cancelled = false;
    let cleanupDocumentMarkerEvents = () => {};
    setMapError(false);

    (async () => {
      try {
        await loadKakaoMaps({ retries: 4, timeoutMs: 10000 });
        if (cancelled || !mountedRef.current || !containerRef.current || mapRef.current) return;

        const containerReady = await waitForContainerReady();
        if (!containerReady) throw new Error("map_container_not_ready");
        if (cancelled || !mountedRef.current || !containerRef.current || mapRef.current) return;

        const map = new window.kakao.maps.Map(containerRef.current, {
          center: new window.kakao.maps.LatLng(36.6285, 127.4568),
          level: 5,
        });

        mapRef.current = map;
        zoomLevelRef.current = map.getLevel();
        autoRetryCountRef.current = 0;
        renderOverlays(map, propsRef.current.properties, propsRef.current.selectedId, propsRef.current.onSelect, zoomLevelRef.current);

        setTimeout(() => {
          if (!cancelled) {
            try { map.relayout(); } catch (_) {}
            fireBounds(map);
          }
        }, 300);

        setTimeout(() => {
          if (!cancelled) {
            try { map.relayout(); } catch (_) {}
          }
        }, 900);

        let zoomRenderTimer: number | null = null;
        window.kakao.maps.event.addListener(map, "zoom_changed", () => {
          if (!mountedRef.current) return;
          const newZoom = map.getLevel();
          zoomLevelRef.current = newZoom;
          gestureBlockUntilRef.current = Date.now() + GESTURE_SETTLE_MS;
          // 줌 변경 시 체크된 핀들 모두 해제
          propsRef.current.onMapMoveClear?.();
          if (zoomRenderTimer) window.clearTimeout(zoomRenderTimer);
          zoomRenderTimer = window.setTimeout(() => {
            if (!mountedRef.current) return;
            renderOverlays(map, propsRef.current.properties, propsRef.current.selectedId, propsRef.current.onSelect, zoomLevelRef.current);
          }, isMobileRef.current ? 180 : 60);
          fireBounds(map);
        });

        window.kakao.maps.event.addListener(map, "dragstart", () => {
          if (!mountedRef.current) return;
          if (radiusModeRef.current) return;
          gestureBlockUntilRef.current = Date.now() + GESTURE_SETTLE_MS;
          // 드래그(이동) 시작 시 체크된 핀들 모두 해제
          propsRef.current.onMapMoveClear?.();
        });

        window.kakao.maps.event.addListener(map, "dragend", () => {
          if (!mountedRef.current) return;
          gestureBlockUntilRef.current = Date.now() + GESTURE_SETTLE_MS;
          window.setTimeout(() => {
            if (!mountedRef.current) return;
            renderOverlays(map, propsRef.current.properties, propsRef.current.selectedId, propsRef.current.onSelect, zoomLevelRef.current);
          }, isMobileRef.current ? 120 : 0);
          fireBounds(map);
        });

        const getPointerPoint = (event: MouseEvent | TouchEvent) => {
          if ("changedTouches" in event) {
            const touch = event.changedTouches[0] ?? event.touches[0];
            return touch ? { x: touch.clientX, y: touch.clientY } : null;
          }
          return { x: event.clientX, y: event.clientY };
        };

        const getMarkerTarget = (event: Event) => {
          const target = event.target as HTMLElement | null;
          return target?.closest?.("[data-map-marker-ids]") as HTMLElement | null;
        };

        const findMarkerTargetAtPoint = (event: MouseEvent | TouchEvent) => {
          const point = getPointerPoint(event);
          const container = containerRef.current;
          if (!point || !container) return null;

          let best: { el: HTMLElement; distance: number; area: number } | null = null;
          container.querySelectorAll<HTMLElement>("[data-map-marker-ids]").forEach((el) => {
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const pad = Math.max(12, Math.min(rect.width, rect.height) * 0.18);
            if (
              point.x < rect.left - pad || point.x > rect.right + pad ||
              point.y < rect.top - pad || point.y > rect.bottom + pad
            ) return;
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const distance = Math.hypot(point.x - cx, point.y - cy);
            const area = rect.width * rect.height;
            if (!best || distance < best.distance || (distance === best.distance && area < best.area)) {
              best = { el, distance, area };
            }
          });
          return best?.el ?? null;
        };

        const runMarkerTargetClick = (event: Event, target: HTMLElement) => {
          const ids = (target.dataset.mapMarkerIds ?? "")
            .split(",")
            .map((id) => Number(id))
            .filter(Number.isFinite);
          if (ids.length === 0) return;
          stopMarkerEvent(event);
          markerClickLockUntilRef.current = Date.now() + 450;
          if (ids.length > 1 && propsRef.current.onClusterSelect) {
            propsRef.current.onClusterSelect(ids);
          } else {
            propsRef.current.onSelect(ids[0]);
          }
        };

        const mouseDownRef = { x: 0, y: 0, time: 0, valid: false };
        const MOUSE_DRAG_THRESHOLD_PX = 6;

        const handleDocumentMouseDownCapture = (event: MouseEvent) => {
          if (!containerRef.current?.contains(event.target as Node)) return;
          mouseDownRef.x = event.clientX;
          mouseDownRef.y = event.clientY;
          mouseDownRef.time = Date.now();
          mouseDownRef.valid = true;
        };

        const handleDocumentClickCapture = (event: MouseEvent) => {
          if (!containerRef.current?.contains(event.target as Node)) return;
          if (Date.now() < markerClickLockUntilRef.current) {
            stopMarkerEvent(event);
            return;
          }
          // 마우스를 누른 위치에서 일정 거리 이상 이동했다면 드래그로 간주 — 클릭 무시
          if (mouseDownRef.valid) {
            const dx = event.clientX - mouseDownRef.x;
            const dy = event.clientY - mouseDownRef.y;
            mouseDownRef.valid = false;
            if (Math.hypot(dx, dy) > MOUSE_DRAG_THRESHOLD_PX) return;
          }
          const target = getMarkerTarget(event) ?? findMarkerTargetAtPoint(event);
          if (!target) return;
          if (isMobileRef.current && isGestureBlocked()) return;
          runMarkerTargetClick(event, target);
        };

        const handleDocumentTouchStartCapture = (event: TouchEvent) => {
          if (!containerRef.current?.contains(event.target as Node)) return;
          const target = getMarkerTarget(event) ?? findMarkerTargetAtPoint(event);
          if (!target) return;
          const point = getTouchPoint(event);
          if (!point) return;
          markerTouchRef.current = { x: point.x, y: point.y, time: Date.now(), moved: false, touches: event.touches.length };
        };

        const handleDocumentTouchMoveCapture = (event: TouchEvent) => {
          const touch = markerTouchRef.current;
          if (!touch) return;
          const point = getTouchPoint(event);
          if (!point) return;
          touch.touches = Math.max(touch.touches, event.touches.length);
          if (event.touches.length > 1 || Math.hypot(point.x - touch.x, point.y - touch.y) > TAP_MOVE_THRESHOLD_PX) {
            touch.moved = true;
          }
        };

        const handleDocumentTouchEndCapture = (event: TouchEvent) => {
          const touch = markerTouchRef.current;
          markerTouchRef.current = null;
          if (!touch || !containerRef.current?.contains(event.target as Node)) return;
          const target = getMarkerTarget(event) ?? findMarkerTargetAtPoint(event);
          if (!target) return;
          const point = getTouchPoint(event);
          const distance = point ? Math.hypot(point.x - touch.x, point.y - touch.y) : 999;
          const isTap = touch.touches === 1 && !touch.moved && distance <= TAP_MOVE_THRESHOLD_PX && Date.now() - touch.time <= TAP_MAX_DURATION_MS && !isGestureBlocked();
          if (isTap) runMarkerTargetClick(event, target);
        };

        document.addEventListener("mousedown", handleDocumentMouseDownCapture, true);
        document.addEventListener("click", handleDocumentClickCapture, true);
        document.addEventListener("touchstart", handleDocumentTouchStartCapture, true);
        document.addEventListener("touchmove", handleDocumentTouchMoveCapture, true);
        document.addEventListener("touchend", handleDocumentTouchEndCapture, true);
        cleanupDocumentMarkerEvents = () => {
          document.removeEventListener("mousedown", handleDocumentMouseDownCapture, true);
          document.removeEventListener("click", handleDocumentClickCapture, true);
          document.removeEventListener("touchstart", handleDocumentTouchStartCapture, true);
          document.removeEventListener("touchmove", handleDocumentTouchMoveCapture, true);
          document.removeEventListener("touchend", handleDocumentTouchEndCapture, true);
        };



        // 반경검색 — 마우스 down → 중심 설정, move → 반경 확장, up → 확정
        window.kakao.maps.event.addListener(map, "mousedown", (mouseEvent: any) => {
          if (!radiusModeRef.current) return;
          const latlng = mouseEvent.latLng;
          dragCenterRef.current = { lat: latlng.getLat(), lng: latlng.getLng() };
          draggingRef.current = true;
          // 지도 드래그 비활성 (원 그리기 우선)
          try { map.setDraggable(false); } catch (_) {}
          drawCircle(dragCenterRef.current, 0);
        });

        window.kakao.maps.event.addListener(map, "mousemove", (mouseEvent: any) => {
          if (!radiusModeRef.current || !draggingRef.current || !dragCenterRef.current) return;
          const latlng = mouseEvent.latLng;
          const r = haversineMeters(
            dragCenterRef.current.lat, dragCenterRef.current.lng,
            latlng.getLat(), latlng.getLng()
          );
          drawCircle(dragCenterRef.current, r);
        });

        const finishDrag = (mouseEvent?: any) => {
          if (!radiusModeRef.current || !draggingRef.current || !dragCenterRef.current) return;
          draggingRef.current = false;
          try { map.setDraggable(true); } catch (_) {}
          let r = 0;
          if (mouseEvent?.latLng) {
            r = haversineMeters(
              dragCenterRef.current.lat, dragCenterRef.current.lng,
              mouseEvent.latLng.getLat(), mouseEvent.latLng.getLng()
            );
          }
          // 클릭만 한 경우(반경=0) 기본 500m
          if (r < 30) r = 500;
          const center = dragCenterRef.current;
          drawCircle(center, r);
          propsRef.current.onRadiusChange?.({ lat: center.lat, lng: center.lng, radius: r });
        };
        window.kakao.maps.event.addListener(map, "mouseup", finishDrag);
      } catch (_) {
        if (!cancelled) {
          setMapError(true);
          resetMapInstance();

          if (autoRetryCountRef.current < 2) {
            autoRetryCountRef.current += 1;
            if (retryTimeoutRef.current) window.clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = window.setTimeout(() => {
              setRetryKey((prev) => prev + 1);
            }, autoRetryCountRef.current * 1200);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      cleanupDocumentMarkerEvents();
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      resetMapInstance();
    };
  }, [fireBounds, renderOverlays, resetMapInstance, retryKey, waitForContainerReady]);

  // 핀 업데이트 (properties/selectedId 변경 시)
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;
    renderOverlays(mapRef.current, properties, selectedId, onSelect, zoomLevelRef.current);
  }, [properties, selectedId, selectedIds, onSelect, renderOverlays]);

  // 외부에서 radiusCircle 변경(해제 등) 동기화
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;
    if (radiusCircle) {
      drawCircle({ lat: radiusCircle.lat, lng: radiusCircle.lng }, radiusCircle.radius);
    } else {
      clearRadiusCircle();
    }
  }, [radiusCircle, drawCircle, clearRadiusCircle]);

  // 반경검색 모드 진입/해제 시 커서 변경
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.cursor = radiusMode ? "crosshair" : "";
    }
  }, [radiusMode]);

  // 깜빡임 — 매물카드 클릭 시에만 (blinkTrigger 변경 시) 동작
  const blinkTriggerRef = useRef(blinkTrigger);
  useEffect(() => {
    if (blinkTrigger === blinkTriggerRef.current) return;
    blinkTriggerRef.current = blinkTrigger;
    if (blinkId == null) return;
    const tryBlink = (attempts = 0) => {
      const existing = overlaysRef.current;
      let target: any = existing.get(`p:${blinkId}`);
      if (!target) {
        existing.forEach((ov, key) => {
          if (!target && key.startsWith("c:")) {
            const content = ov.getContent?.() as HTMLElement | undefined;
            if (content?.dataset?.ids?.split(",").includes(String(blinkId))) target = ov;
          }
        });
      }
      if (!target) {
        if (attempts < 5) window.setTimeout(() => tryBlink(attempts + 1), 120);
        return;
      }
      const content = target.getContent?.() as HTMLElement | undefined;
      if (!content) return;
      content.style.animation = "none";
      void content.offsetWidth;
      content.style.animation = "pin-blink 0.5s ease-in-out 4";
    };
    tryBlink();
  }, [blinkId, blinkTrigger]);


  // 선택/깜빡임은 지도 위치를 자동 이동하지 않음
  const suppressPanRef = useRef(suppressPan);
  useEffect(() => { suppressPanRef.current = suppressPan; }, [suppressPan]);

  // 컨테이너 크기 변경 시 지도 relayout 호출
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (resizeFrameRef.current !== null) return;
      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        const width = el.clientWidth;
        const height = el.clientHeight;
        if (!mapRef.current || !window.kakao?.maps || width === 0 || height === 0) return;
        if (lastMapSizeRef.current.width === width && lastMapSizeRef.current.height === height) return;
        lastMapSizeRef.current = { width, height };
        mapRef.current.relayout();
      });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const recoverMapLayout = () => {
      if (mapRef.current && window.kakao?.maps) {
        try {
          mapRef.current.relayout();
          fireBounds(mapRef.current);
        } catch (_) {
          resetMapInstance();
          setMapError(true);
          setRetryKey((prev) => prev + 1);
        }
        return;
      }

      if (!mapError) return;
      setRetryKey((prev) => prev + 1);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") recoverMapLayout();
    };

    window.addEventListener("pageshow", recoverMapLayout);
    window.addEventListener("online", recoverMapLayout);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("pageshow", recoverMapLayout);
      window.removeEventListener("online", recoverMapLayout);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fireBounds, mapError, resetMapInstance]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {mapError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-toolbar-bg/95 px-6 text-center">
          <strong className="text-sm font-extrabold text-foreground">지도를 불러오지 못했습니다.</strong>
          <span className="text-xs font-medium text-muted-foreground">네트워크 상태를 확인한 뒤 다시 시도해주세요.</span>
          <button
            type="button"
            onClick={() => setRetryKey((prev) => prev + 1)}
            className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            다시 불러오기
          </button>
        </div>
      )}
    </div>
  );
};

export default MapView;
