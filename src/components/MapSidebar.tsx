import { useState, useCallback, useRef, useEffect, useMemo, forwardRef } from "react";
import ReactDOM, { createPortal } from "react-dom";
import { uploadPropertyImages } from "@/lib/uploadPropertyImages";
import {
  MapPin,
  ChevronRight,
  ChevronLeft,
  X,
  ZoomIn,
  Phone,
  KeyRound,
  FileText,
  CheckCircle,
  AlertCircle,
  Camera,
  ClipboardList,
  Send,
  Printer,
  Building2,
  Pencil,
  PenLine,
  Upload,
  Trash2,
  Dog,
  Droplet,
  Tv,
  Wifi,
  Loader2,
  FileSearch,
  Download,
  Star,
  Clock,
  Compass,
} from "lucide-react";
import cctvIcon from "@/assets/cctv_icon-v2-20260427.png";
import remodelingIcon from "@/assets/remodeling_icon-v2-20260427.png";
import tvIcon from "@/assets/tv_icon-v2-20260427.png";
import waterIcon from "@/assets/water_icon-v2-20260427.png";
import elevatorIcon from "@/assets/elevator_icon-v2-20260427.png";
import internetIcon from "@/assets/internet_icon-v2-20260427.png";
import petIcon from "@/assets/pet_icon-v2-20260427.png";
import memoIcon from "@/assets/memo_icon_new-v2-20260427.png";
import femaleOnlyIcon from "@/assets/female_only_icon-v2-20260427.png";
import checkDateIcon from "@/assets/check_date_icon-v2-20260427.png";
import logoTransparent from "@/assets/logo-transparent-zibda-20260427-v2-20260427.png";
import PhotoWatermark from "./PhotoWatermark";
import zibdaPlaceholder from "@/assets/zibda-placeholder-20260427-v2-20260427.png";
import cameraIcon from "@/assets/camera_icon-v2-20260427.png";
import { supabase } from "@/integrations/supabase/client";
import { thumbUrl, originalFromThumb } from "@/lib/imageThumb";
import { MapProperty } from "@/data/mapProperties";
import { shareMultipleToKakao, sharePropertyToKakao, AgencyInfo } from "@/lib/kakaoShare";
import kakaoTalkIcon from "@/assets/kakao-talk-icon-v2-20260427.png";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAuth } from "@/hooks/useAuth";
import { useIsGuest, addressToDong } from "@/hooks/useIsGuest";
import { useFavorites, useFavoritesOnly } from "@/hooks/useFavorites";
import AdminPropertyFormModal from "@/components/AdminPropertyFormModal";
import PublicRecordModal from "@/components/PublicRecordModal";
import { showRoadAddressModal } from "@/lib/showRoadAddressModal";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { customConfirm, customPrompt, customAlert } from "@/lib/customDialogs";

const neonGradientTextStyle = {
  color: "#000",
  fontWeight: 800,
} as const;

const roomPasswordChipStyle = {
  background: "hsl(var(--primary) / 0.10)",
  color: "hsl(var(--primary))",
  border: "1px solid hsl(var(--primary) / 0.35)",
} as const;

/* ── LightboxModal: 호실별 탭 + 여러 장 사진 좌우 탐색 ── */
interface LightboxUnit {
  unitNumber?: string; // 호수 (e.g., "202호")
  roomType?: string;     // 방종류 (e.g., "원룸")
  floor?: string;        // 층수 (게스트용 라벨)
  label?: string;        // legacy fallback (단일 매물명 등)
  images: string[];
  isReference?: boolean; // 참고용 사진 여부
}
function LightboxModal({
  units,
  startUnitIdx = 0,
  startImgIdx = 0,
  onClose,
}: {
  units: LightboxUnit[];
  startUnitIdx?: number;
  startImgIdx?: number;
  onClose: () => void;
}) {
  const [unitIdx, setUnitIdx] = useState(startUnitIdx);
  const [imgIdx, setImgIdx] = useState(startImgIdx);
  // 모바일 감지 — 세로 스크롤 나열 모드
  const [isMobileView, setIsMobileView] = useState(false);
  useEffect(() => {
    const check = () => setIsMobileView(window.matchMedia("(max-width: 767px)").matches);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const currentImages = units[unitIdx]?.images ?? [];
  const prev = useCallback(
    () => setImgIdx((i) => (i - 1 + currentImages.length) % currentImages.length),
    [currentImages.length],
  );
  const next = useCallback(() => setImgIdx((i) => (i + 1) % currentImages.length), [currentImages.length]);

  // 호실 탭 변경 시 사진 인덱스 초기화
  const handleUnitChange = useCallback((i: number) => {
    setUnitIdx(i);
    setImgIdx(0);
  }, []);

  useEffect(() => {
    if (isMobileView) return; // 모바일은 키보드 좌/우 슬라이드 비활성
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next, onClose, isMobileView]);

  // 인접 사진 미리 받아두어 좌우 이동 시 즉시 표시
  useEffect(() => {
    if (isMobileView || currentImages.length <= 1) return;
    const targets = [
      currentImages[(imgIdx + 1) % currentImages.length],
      currentImages[(imgIdx - 1 + currentImages.length) % currentImages.length],
    ];
    targets.forEach((u) => {
      if (!u) return;
      const img = new Image();
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.src = thumbUrl(u, 1600, 78);
    });
  }, [imgIdx, currentImages, isMobileView]);

  const hasTabs = units.length > 1 || units.some((u) => u.isReference);
  const [showMoreUnits, setShowMoreUnits] = useState(false);
  // 모바일에서는 한 줄에 보여줄 탭 수를 제한 — 같은 주소 다른 호실(종료 포함)을 보기 쉽게 4개까지 노출
  const MOBILE_VISIBLE_TABS = 4;

  const visibleUnits = isMobileView && units.length > MOBILE_VISIBLE_TABS
    ? units.slice(0, MOBILE_VISIBLE_TABS)
    : units;
  const hiddenUnits = isMobileView && units.length > MOBILE_VISIBLE_TABS
    ? units.slice(MOBILE_VISIBLE_TABS)
    : [];
  const hiddenCount = hiddenUnits.length;
  // 더보기 드롭다운이 열려있을 때 선택하면 자동으로 닫음 (선택은 handleUnitChange에서 처리)

  const isGuestLightbox = useIsGuest();
  const { user: authUserLb } = useAuth();
  const hideUnitNumber = isGuestLightbox || (isMobileView && authUserLb?.memberType === "일반회원");
  const hideDownload = isGuestLightbox || authUserLb?.memberType === "일반회원";
  const fmtFloor = (f?: string) => {
    const s = (f ?? "").trim();
    if (!s) return "";
    return /[층F]/.test(s) ? s : `${s}층`;
  };
  const renderTabButton = (u: LightboxUnit, i: number, opts?: { stacked?: boolean }) => {
    const isCurrent = i === unitIdx;
    const isRef = u.isReference;
    const unitLabel = hideUnitNumber
      ? fmtFloor(u.floor)
      : (u.unitNumber ?? u.label ?? "");
    const roomLabel = hideUnitNumber ? "" : (u.roomType ?? "");
    const stacked = opts?.stacked;
    return (
      <button
        key={i}
        onClick={() => { handleUnitChange(i); setShowMoreUnits(false); }}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all leading-tight whitespace-nowrap ${stacked ? "flex flex-col items-center gap-0.5" : "flex flex-row items-center gap-1.5"}`}
        style={
          isCurrent
            ? { background: "hsl(var(--primary))", color: "#fff" }
            : { background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }
        }
      >
        <span>[{isRef ? "다른방" : "현재방"}] {unitLabel}</span>
        {roomLabel && <span className="text-[10px] font-normal opacity-80">{roomLabel}</span>}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col" onClick={onClose}>
      {/* 모바일: 상단 고정 바 (닫기 + 탭 + 사진저장) */}
      {isMobileView ? (
        <div
          className="absolute top-0 left-0 right-0 z-30 bg-black/85 backdrop-blur-md px-2 pt-2 pb-2 flex flex-col gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-row gap-1.5 items-start flex-nowrap w-full relative">
            {/* 가운데: 탭 (가로 스크롤) */}
            <div className="flex flex-row gap-1.5 items-center flex-nowrap overflow-x-auto scrollbar-none flex-1 min-w-0">
              {hasTabs && visibleUnits.map((u, i) => renderTabButton(u, i, { stacked: true }))}
              {hasTabs && hiddenCount > 0 && (
                <button
                  onClick={() => setShowMoreUnits((v) => !v)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.25)", color: "#fff" }}
                >
                  더보기...
                </button>
              )}
            </div>
            {/* 더보기 드롭다운 */}
            {showMoreUnits && hiddenCount > 0 && (
              <div
                className="absolute top-full right-0 mt-1 z-40 bg-white rounded-lg shadow-2xl overflow-hidden max-h-[60vh] overflow-y-auto min-w-[180px]"
                onClick={(e) => e.stopPropagation()}
              >
                {hiddenUnits.map((u, idx) => {
                  const realIdx = MOBILE_VISIBLE_TABS + idx;
                  const isCurrent = realIdx === unitIdx;
                  const unitLabel = hideUnitNumber ? fmtFloor(u.floor) : (u.unitNumber ?? u.label ?? "");
                  const roomLabel = hideUnitNumber ? "" : (u.roomType ?? "");
                  return (
                    <button
                      key={realIdx}
                      onClick={() => { handleUnitChange(realIdx); setShowMoreUnits(false); }}
                      className="w-full text-left px-4 py-3 text-sm font-bold border-b last:border-b-0 transition-colors"
                      style={{
                        background: isCurrent ? "hsl(var(--primary))" : "#fff",
                        color: isCurrent ? "#fff" : "#222",
                        borderColor: "rgba(0,0,0,0.08)",
                      }}
                    >
                      {unitLabel} {roomLabel}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {!hideDownload && (
          <div className="flex justify-end">
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (!currentImages.length) return;
                const { downloadPropertyImage } = await import("@/lib/downloadImageWithWatermark");
                await Promise.all(
                  currentImages.map((src, i) => downloadPropertyImage(src, `사진_${i + 1}.jpg`))
                );
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/15 hover:bg-white/30 text-white text-xs font-bold border border-white/30"
              title="사진저장"
            >
              <Download className="w-3.5 h-3.5" />
              <span>사진저장</span>
            </button>
          </div>
          )}
        </div>
      ) : (
        <>
          {/* 데스크톱 — 우측 상단 모두저장 버튼 */}
          {!hideDownload && (
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (!currentImages.length) return;
              const { downloadPropertyImage } = await import("@/lib/downloadImageWithWatermark");
              await Promise.all(
                currentImages.map((src, i) => downloadPropertyImage(src, `사진_${i + 1}.jpg`))
              );
            }}
            className="absolute top-4 right-4 z-30 flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/15 hover:bg-white/30 text-white text-xs font-bold backdrop-blur-md border border-white/30 transition-colors"
            title="사진저장"
          >
            <Download className="w-4 h-4" />
            <span>사진저장</span>
          </button>
          )}
          {hasTabs && (
            <div
              className="absolute top-4 left-1/2 -translate-x-1/2 z-10 max-w-[80vw]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex gap-1.5 flex-wrap justify-center">
                {units.map((u, i) => renderTabButton(u, i))}
              </div>
            </div>
          )}
        </>
      )}

      {/* 모바일: 우측 하단 플로팅 닫기 버튼 */}
      {isMobileView && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-2xl"
          style={{ background: "#fff", color: "hsl(var(--primary))", border: "2px solid hsl(var(--primary))" }}
          aria-label="닫기"
          title="닫기"
        >
          <X className="w-6 h-6" strokeWidth={2.5} />
        </button>
      )}

      {/* ── 모바일: 좌우 가로 스와이프 ── */}
      {isMobileView ? (
        <div
          className="flex-1 flex flex-col w-full overflow-hidden"
          style={{ paddingTop: "112px", paddingBottom: "16px" }}
          onClick={(e) => e.stopPropagation()}
        >
          {units[unitIdx]?.isReference && (
            <div className="text-center mb-2 px-4 flex-shrink-0">
              <span className="text-sm font-bold px-4 py-1.5 rounded-full inline-block bg-white/10" style={{ color: "hsl(var(--accent))" }}>
                다른 호실 사진 참고용
              </span>
            </div>
          )}
          {/* 세로 스크롤 — 사진을 아래로 내리며 봄 */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none">
            <div className="flex flex-col items-center gap-3 px-3 pb-4">
              {currentImages.map((src, i) => (
                <div key={i} className="relative w-full">
                  <img
                    src={thumbUrl(src, 1080, 75)}
                    alt={`사진 ${i + 1}`}
                    className="w-full max-w-full object-contain rounded-lg select-none"
                    draggable={false}
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                    {...(i === 0 ? { fetchpriority: "high" as any } : {})}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const img = e.currentTarget;
                      const orig = originalFromThumb(thumbUrl(src, 1080, 75));
                      if (img.src !== orig) img.src = orig;
                    }}
                  />
                  <PhotoWatermark size="lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 사진 카운터 — 데스크톱 */}
          <div
            className={`absolute bg-black/50 text-white text-sm font-bold px-3 py-1 rounded-full backdrop-blur-sm z-10 ${hasTabs ? "top-14 right-4" : "top-4 left-1/2 -translate-x-1/2"}`}
            onClick={(e) => e.stopPropagation()}
          >
            {imgIdx + 1} / {currentImages.length}
          </div>

          <div
            className="relative w-full h-full overflow-hidden"
            style={{ paddingTop: hasTabs ? "56px" : "0" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 슬라이드 트랙 */}
            <div
              className="flex h-full transition-transform duration-300 ease-in-out"
              style={{ transform: `translateX(-${imgIdx * 100}vw)`, width: `${currentImages.length * 100}vw` }}
            >
              {currentImages.map((src, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 h-full flex items-center justify-center px-16"
                  style={{ width: "100vw" }}
                >
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={thumbUrl(src, 1600, 78)}
                      alt={`사진 ${i + 1}`}
                      className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg select-none"
                      style={{ maxHeight: "calc(100vh - 80px)" }}
                      draggable={false}
                      loading={Math.abs(i - imgIdx) <= 1 ? "eager" : "lazy"}
                      decoding="async"
                      {...(i === imgIdx ? { fetchpriority: "high" as any } : {})}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const img = e.currentTarget;
                        const orig = originalFromThumb(thumbUrl(src, 1600, 78));
                        if (img.src !== orig) img.src = orig;
                      }}
                    />
                    <PhotoWatermark size="lg" />
                  </div>
                </div>
              ))}
            </div>
            {units[unitIdx]?.isReference && (
              <div
                className="absolute left-1/2 -translate-x-1/2 text-center z-10"
                style={{ top: hasTabs ? "72px" : "16px" }}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-sm font-bold px-4 py-1.5 rounded-full bg-black/60" style={{ color: "hsl(var(--accent))" }}>
                  다른 호실 사진 참고용
                </span>
              </div>
            )}
            {currentImages.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center backdrop-blur-sm transition-colors"
                >
                  <ChevronLeft className="w-6 h-6 text-white" />
                </button>
                <button
                  onClick={next}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center backdrop-blur-sm transition-colors"
                >
                  <ChevronRight className="w-6 h-6 text-white" />
                </button>
              </>
            )}
          </div>
          {currentImages.length > 1 && (
            <div
              className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2 px-4 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {currentImages.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all"
                  style={{
                    borderColor: i === imgIdx ? "hsl(var(--primary))" : "transparent",
                    opacity: i === imgIdx ? 1 : 0.5,
                  }}
                >
                  <img src={thumbUrl(src, 120, 60)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" referrerPolicy="no-referrer"
                    onError={(e) => { const img = e.currentTarget; const orig = originalFromThumb(thumbUrl(src, 120, 60)); if (img.src !== orig) img.src = orig; }}
                  />
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {/* 데스크톱 전용 우측 하단 닫기 (모바일은 상단 좌측 닫기 사용) */}
      {!isMobileView && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute bottom-4 right-4 w-11 h-11 rounded-full flex items-center justify-center text-white shadow-xl transition-transform active:scale-95 z-30"
          style={{ background: "rgba(0,0,0,0.7)", border: "1.5px solid rgba(255,255,255,0.5)" }}
          title="닫기"
          aria-label="닫기"
        >
          <X className="w-5 h-5" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

// 주소에서 시/군/구 앞까지 제거 (예: "충북 청주시 서원구 남문로1가 190" → "남문로1가 190")
const shortAddress = (addr: string) => {
  // "시 구" 또는 "시 군" 이후 문자열 추출
  const matchSiGu = addr.match(/(?:시|군)\s+(?:[가-힣]+구\s+)?(.+)/);
  if (matchSiGu) return matchSiGu[1].trim();
  // fallback: 동+번지 패턴
  const matchDong = addr.match(/([가-힣]+동)\s*([\d\-]+)?/);
  if (matchDong) return matchDong[2] ? `${matchDong[1]} ${matchDong[2]}` : matchDong[1];
  return addr;
};

const TYPE_BG: Record<string, string> = {
  상가: "bg-primary/10 text-primary",
  사무실: "bg-purple-50 text-purple-700",
  "식당·카페": "bg-orange-50 text-accent",
  "공장·창고": "bg-green-50 text-green-700",
  "병원·학원": "bg-red-50 text-red-700",
  연립: "bg-blue-50 text-blue-700",
  다세대: "bg-sky-50 text-sky-700",
  단독주택: "bg-amber-50 text-amber-700",
  빌라: "bg-indigo-50 text-indigo-700",
  아파트: "bg-teal-50 text-teal-700",
  오피스텔: "bg-violet-50 text-violet-700",
  원룸: "bg-pink-50 text-pink-700",
  투룸: "bg-rose-50 text-rose-700",
  쓰리룸: "bg-red-50 text-red-700",
  고시원: "bg-gray-100 text-gray-600",
  토지: "bg-lime-50 text-lime-700",
  건물매매: "bg-orange-100 text-orange-800",
  단독매매: "bg-yellow-50 text-yellow-700",
};

/* 모바일: 클릭하면 아이콘 자리에 라벨 텍스트로 토글되는 시설 배지 */
const FacilityBadge = ({
  label, iconSrc, bg, border, badge,
}: {
  label: string;
  iconSrc: string;
  bg: string;
  border: string;
  badge?: JSX.Element; // 추가 오버레이 (예: 반려동물 불가의 X)
}) => {
  const [showLabel, setShowLabel] = useState(false);
  useEffect(() => {
    if (!showLabel) return;
    const t = setTimeout(() => setShowLabel(false), 1800);
    return () => clearTimeout(t);
  }, [showLabel]);
  if (showLabel) {
    return (
      <span
        onClick={(e) => { e.stopPropagation(); setShowLabel(false); }}
        className="flex-shrink-0 inline-flex items-center justify-center h-6 px-2 rounded text-[10px] font-bold whitespace-nowrap cursor-pointer"
        style={{ background: bg, border: `1px solid ${border}`, color: "#1f2937" }}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      onClick={(e) => { e.stopPropagation(); setShowLabel(true); }}
      className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded cursor-pointer relative"
      style={{ background: bg, border: `1px solid ${border}` }}
      title={label}
    >
      <img src={iconSrc} alt="" className="w-5 h-5 object-contain pointer-events-none" style={{ imageRendering: "-webkit-optimize-contrast" as any }} />
      {badge}
    </span>
  );
};

/* 옵션 SVG 아이콘 컴포넌트 */
const OptionSvgIcon = ({ name, size = 11 }: { name: string; size?: number }) => {
  const s = size;
  const icons: Record<string, JSX.Element> = {
    냉장고: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <line x1="5" y1="9" x2="19" y2="9" stroke="currentColor" strokeWidth="1.8" />
        <line x1="10" y1="5.5" x2="10" y2="7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="10" y1="13" x2="10" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    세탁기: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="2" width="18" height="20" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="14" r="4.5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="8" cy="5.5" r="1" fill="currentColor" />
        <circle cx="12" cy="5.5" r="1" fill="currentColor" />
      </svg>
    ),
    드럼세탁기: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="2" width="18" height="20" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="13" r="5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="13" r="2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    건조기: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="2" width="18" height="20" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 12 Q12 8 15 12 Q12 16 9 12Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
    ),
    스타일러: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 8 Q12 6 16 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M8 12h8M8 15h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    TV: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 19 L7 22M15 19 L17 22M7 22 h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    에어컨: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="8" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M6 17 Q9 14 12 17 Q15 14 18 17"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="8" cy="9" r="1" fill="currentColor" />
      </svg>
    ),
    가스레인지: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="8" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="16" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    인덕션: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="8" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1.5" />
        <circle cx="16" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1.5" />
      </svg>
    ),
    전자레인지: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <rect x="5" y="8" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="19" cy="12" r="1.2" fill="currentColor" />
      </svg>
    ),
    침대: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path
          d="M2 18V12C2 10.9 2.9 10 4 10H20C21.1 10 22 10.9 22 12V18"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path d="M2 18H22M3 10V7M21 10V7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="6" y="7" width="5" height="3" rx="1" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
    책상: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M3 8H21V10H3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M5 10V18M19 10V18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    옷장: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" strokeWidth="1.5" />
        <line x1="9.5" y1="12" x2="11" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="13" y1="12" x2="14.5" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    전자키: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="8" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 8V6a4 4 0 1 1 8 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="14.5" r="1.5" fill="currentColor" />
      </svg>
    ),
    인터넷: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M5 12.55a11 11 0 0 1 14.08 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M1.42 9a16 16 0 0 1 21.16 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="20" r="1.2" fill="currentColor" />
      </svg>
    ),
    주차: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M9 17V8h4a3 3 0 0 1 0 6H9"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    애완동물가능: (
      <svg width={s} height={s} viewBox="0 0 64 64" fill="currentColor">
        <ellipse cx="32" cy="44" rx="18" ry="11" />
        <circle cx="32" cy="26" r="12" />
        <ellipse cx="20" cy="14" rx="6" ry="8" transform="rotate(-15 20 14)" />
        <ellipse cx="44" cy="14" rx="6" ry="8" transform="rotate(15 44 14)" />
        <ellipse cx="25" cy="28" rx="2.5" ry="1.8" fill="white" />
        <ellipse cx="39" cy="28" rx="2.5" ry="1.8" fill="white" />
        <circle cx="25.5" cy="28" r="1.2" fill="#333" />
        <circle cx="39.5" cy="28" r="1.2" fill="#333" />
        <ellipse cx="32" cy="33" rx="3.5" ry="2" />
        <rect x="22" y="53" width="6" height="9" rx="3" />
        <rect x="36" y="53" width="6" height="9" rx="3" />
      </svg>
    ),
    반려동물_가능: (
      <svg width={s} height={s} viewBox="0 0 64 64" fill="currentColor">
        <ellipse cx="32" cy="44" rx="18" ry="11" />
        <circle cx="32" cy="26" r="12" />
        <ellipse cx="20" cy="14" rx="6" ry="8" transform="rotate(-15 20 14)" />
        <ellipse cx="44" cy="14" rx="6" ry="8" transform="rotate(15 44 14)" />
        <ellipse cx="25" cy="28" rx="2.5" ry="1.8" fill="white" />
        <ellipse cx="39" cy="28" rx="2.5" ry="1.8" fill="white" />
        <circle cx="25.5" cy="28" r="1.2" fill="#333" />
        <circle cx="39.5" cy="28" r="1.2" fill="#333" />
        <ellipse cx="32" cy="33" rx="3.5" ry="2" />
        <rect x="22" y="53" width="6" height="9" rx="3" />
        <rect x="36" y="53" width="6" height="9" rx="3" />
      </svg>
    ),
    애완동물불가: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  };
  return icons[name] ?? <span className="text-[10px] leading-none">{name.slice(0, 1)}</span>;
};

const OPTION_ICONS: Record<string, string> = {
  냉장고: "냉장고",
  세탁기: "세탁기",
  드럼세탁기: "드럼세탁기",
  건조기: "건조기",
  스타일러: "스타일러",
  TV: "TV",
  유선TV: "유선TV",
  에어컨: "에어컨",
  가스레인지: "가스레인지",
  인덕션: "인덕션",
  전자레인지: "전자레인지",
  침대: "침대",
  책상: "책상",
  옷장: "옷장",
  전자키: "전자키",
  수도: "수도",
  인터넷: "인터넷",
  주차: "주차",
  CCTV: "CCTV",
  애완동물가능: "애완동물가능",
  애완동물불가: "애완동물불가",
  반려동물_가능: "반려동물_가능",
};

const normalizeDisplayOption = (option: string): string => {
  const compact = option.replace(/\s+/g, "");
  if (compact.includes("애완동물") || compact.includes("반려동물")) {
    if (compact.includes("불가")) return "반려동물 불가";
    if (compact.includes("가능")) return "반려동물 가능";
  }
  return option;
};

/* Daily-limit helpers */
const today = () => new Date().toISOString().slice(0, 10);
const revealKey = (id: number, type: string) => `contact_reveal_${id}_${type}`;
const hasRevealedToday = (id: number, type: string) => localStorage.getItem(revealKey(id, type)) === today();
const markRevealed = (id: number, type: string) => localStorage.setItem(revealKey(id, type), today());

/* ── ContactEmojiRow ── */
interface ContactEmojiRowProps {
  propId: number;
  type: "owner" | "manager" | "tenant" | "broker";
  number: string | null;
  number2?: string | null; // 소유주 2번째 연락처
}

/* 카카오 스타일 SVG 아이콘 */

const ContactIcon = forwardRef<SVGSVGElement, { type: string; active?: boolean }>(({ type, active }, ref) => {
  const color = active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))";

  if (type === "owner")
    return (
      <svg ref={ref} width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 10.5L12 3L21 10.5V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V10.5Z"
          fill={color}
        />
      </svg>
    );

  if (type === "manager")
    return (
      <svg ref={ref} width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" fill={color} />
        <path d="M4 20C4 16.686 7.582 14 12 14C16.418 14 20 16.686 20 20" stroke={color} strokeWidth="2" />
      </svg>
    );

  if (type === "tenant")
    return (
      <svg ref={ref} width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="7" r="3.5" fill={color} />
        <path d="M5 20C5 16.134 8.134 13 12 13C15.866 13 19 16.134 19 20H5Z" fill={color} />
      </svg>
    );

  if (type === "broker")
    return (
      <svg ref={ref} width="16" height="16" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="2.5" fill={color} />
      </svg>
    );

  return <svg ref={ref} />; // 🔥 중요 (null 금지)
});

ContactIcon.displayName = "ContactIcon";

const ContactEmojiRow = forwardRef<HTMLDivElement, ContactEmojiRowProps>(({ propId, type, number, number2 }, ref) => {
  const isGuest = useIsGuest();
  if (isGuest) return null;
  const label = type === "owner" ? "소유주" : type === "tenant" ? "세입자" : type === "broker" ? "부동산" : "관리인";

  const [revealed, setRevealed] = useState(() => !!number && hasRevealedToday(propId, type));
  const [showPopup, setShowPopup] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const popupId = useMemo(() => `${propId}-${type}-${Math.random().toString(36).slice(2, 8)}`, [propId, type]);

  // 다른 연락처 팝업이 열리면 이 팝업 닫기
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail !== popupId) setShowPopup(false);
    };
    window.addEventListener("contact-popup-open", handler);
    return () => window.removeEventListener("contact-popup-open", handler);
  }, [popupId]);

  useEffect(() => {
    if (!showPopup) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      setShowPopup(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [showPopup]);

  const typeColor: Record<string, string> = {
    owner: "hsl(var(--primary))",
    manager: "hsl(217 91% 60%)",
    tenant: "hsl(142 71% 45%)",
    broker: "hsl(25 95% 53%)",
  };

  if (!number) {
    return (
      <div
        ref={ref}
        className="flex-1 flex flex-col items-center justify-center border-b border-border/20 last:border-b-0 opacity-25 select-none"
      >
        <ContactIcon type={type} />
        <span className="text-[8px] text-muted-foreground mt-0.5 leading-none">{label}</span>
      </div>
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!revealed) {
      markRevealed(propId, type);
      setRevealed(true);
    }
    if (!showPopup && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPopupPos({ top: rect.top + rect.height / 2, left: rect.right + 4 });
      // 다른 연락처 팝업 닫도록 알림
      window.dispatchEvent(new CustomEvent("contact-popup-open", { detail: popupId }));
    }
    setShowPopup((v) => !v);
  };

  return (
    <div
      ref={ref}
      className="flex-1 flex flex-col items-center justify-center border-b border-border/20 last:border-b-0 relative"
    >
      <button
        ref={btnRef}
        type="button"
        onClick={handleClick}
        title={label}
        className="flex flex-col items-center justify-center w-full h-full rounded transition-colors hover:bg-primary/10 group"
      >
        <span
          className="flex items-center justify-center w-5 h-5 rounded-full transition-all group-hover:scale-110"
          style={{ background: `${typeColor[type]}18` }}
        >
          <ContactIcon type={type} active />
        </span>
        <span className="text-[8px] mt-0.5 leading-none font-semibold" style={{ color: typeColor[type] }}>
          {label}
        </span>
      </button>

      {showPopup && ReactDOM.createPortal(
        <div
          ref={popupRef}
          className="fixed z-[9999] bg-white border border-border rounded-xl shadow-xl px-3 py-2 flex flex-col gap-1.5 whitespace-nowrap"
          style={{ top: popupPos.top, left: popupPos.left, transform: "translateY(-50%)", boxShadow: "0 4px 20px hsl(var(--primary)/0.15)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 첫 번째 연락처 */}
          <div className="flex items-center gap-2">
            <span
              className="flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0"
              style={{ background: `${typeColor[type]}20` }}
            >
              <ContactIcon type={type} active />
            </span>
            <span className="text-[9px] font-bold" style={{ color: typeColor[type] }}>
              {label}
            </span>
            <a
              href={`tel:${number}`}
              className="text-[12px] font-extrabold text-foreground hover:text-primary transition-colors tracking-tight"
            >
              {number}
            </a>
            {!number2 && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowPopup(false); }}
                className="ml-0.5 w-4 h-4 rounded-full bg-muted flex items-center justify-center hover:bg-border transition-colors"
              >
                <X className="w-2.5 h-2.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* 두 번째 연락처 (소유주2) */}
          {number2 && (
            <div className="flex items-center gap-2">
              <span
                className="flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0"
                style={{ background: `${typeColor[type]}20` }}
              >
                <ContactIcon type={type} active />
              </span>
              <span className="text-[9px] font-bold" style={{ color: typeColor[type] }}>
                {label}2
              </span>
              <a
                href={`tel:${number2}`}
                className="text-[12px] font-extrabold text-foreground hover:text-primary transition-colors tracking-tight"
              >
                {number2}
              </a>
              <button
                onClick={(e) => { e.stopPropagation(); setShowPopup(false); }}
                className="ml-0.5 w-4 h-4 rounded-full bg-muted flex items-center justify-center hover:bg-border transition-colors"
              >
                <X className="w-2.5 h-2.5 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
});

ContactEmojiRow.displayName = "ContactEmojiRow";

/* ── MemoNotepad ── DB 기반 사용자별 메모 (같은 사무소+관리자 열람 가능) */
interface MemoNotepadProps {
  propertyDbId: string | undefined; // DB UUID
  propId: number; // fallback for localStorage (non-DB properties)
  memoKey: string; // "building" | "room"
  icon: React.ReactNode;
  label: string;
  initialText: string; // 기존 property 테이블의 메모 (관리자용)
  userId?: string;
  isAdmin?: boolean;
}
const MemoNotepad = forwardRef<HTMLDivElement, MemoNotepadProps>(
  ({ propertyDbId, propId, memoKey, icon, label, initialText, userId, isAdmin }, ref) => {
    const isGuest = useIsGuest();
    const [open, setOpen] = useState(false);
    const [myText, setMyText] = useState("");
    const [otherMemos, setOtherMemos] = useState<Array<{ user_id: string; content: string; name?: string }>>([]);
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // DB에서 메모 로드
    useEffect(() => {
      if (!open || !propertyDbId || !userId) return;
      setLoaded(false);
      (async () => {
        const { data } = await supabase
          .from("property_user_memos")
          .select("user_id, content")
          .eq("property_id", propertyDbId)
          .eq("memo_type", memoKey);

        if (data) {
          const mine = data.find((m) => m.user_id === userId);
          setMyText(mine?.content ?? "");
          const others = data.filter((m) => m.user_id !== userId && m.content.trim());
          // 작성자 이름 가져오기
          if (others.length > 0) {
            const userIds = others.map((m) => m.user_id);
            const { data: profiles } = await supabase
              .from("agent_profiles")
              .select("user_id, name")
              .in("user_id", userIds);
            const nameMap = new Map(profiles?.map((p) => [p.user_id, p.name]) ?? []);
            setOtherMemos(others.map((m) => ({ ...m, name: nameMap.get(m.user_id) ?? "알 수 없음" })));
          } else {
            setOtherMemos([]);
          }
        }
        setLoaded(true);
      })();
    }, [open, propertyDbId, userId, memoKey]);

    // 수동 저장
    const handleSave = async () => {
      if (!propertyDbId || !userId) return;
      setSaving(true);
      await supabase.from("property_user_memos").upsert(
        { property_id: propertyDbId, user_id: userId, memo_type: memoKey, content: myText },
        { onConflict: "property_id,user_id,memo_type" }
      );
      setSaving(false);
      setSaved(true);
    };
    const [saved, setSaved] = useState(false);

    // 비 DB 매물은 localStorage 폴백
    const isDbProp = !!propertyDbId;
    const storageKey = `memo_${propId}_${memoKey}`;
    const fallbackText = !isDbProp ? (localStorage.getItem(storageKey) ?? initialText) : "";

    const hasMemoContent = !!(initialText?.trim()) || !!(myText?.trim());

    if (isGuest) return null;

    return (
      <div ref={ref} className="relative inline-flex">
        <button
          type="button"
          title={label}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="w-5 h-5 flex items-center justify-center hover:scale-125 transition-transform select-none flex-shrink-0 rounded"
          style={{
            background: hasMemoContent ? "hsl(var(--destructive)/0.12)" : "hsl(var(--primary)/0.08)",
            border: hasMemoContent ? "2px solid hsl(var(--destructive))" : "1px solid hsl(var(--primary)/0.2)",
          }}
        >
          {icon}
        </button>
        {hasMemoContent && (
          <span
            className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-white"
            style={{ background: "hsl(var(--destructive))" }}
          />
        )}

        {open && (
          <>
            <div
              className="fixed inset-0 z-[8999]"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
            />

            <div
              className="fixed z-[9000] bg-white border border-border rounded-xl shadow-2xl w-[300px]"
              onClick={(e) => e.stopPropagation()}
              style={{
                boxShadow: "0 8px 32px rgba(10,45,110,0.22)",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-primary/5 rounded-t-xl">
                <div className="flex items-center gap-1.5">
                  <span className="flex items-center gap-1 text-sm leading-none">{icon}</span>
                  <span className="text-[11px] font-bold text-foreground">{label}</span>
                  {saving && <span className="text-[9px] text-muted-foreground ml-1">저장 중...</span>}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                  }}
                  className="w-4 h-4 rounded-full bg-destructive hover:bg-destructive/80 flex items-center justify-center"
                >
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              </div>

              <div className="p-2.5 space-y-2">
                {/* 내 메모 */}
                <div>
                  <p className="text-[10px] font-bold text-primary mb-1">내 메모</p>
                  {isDbProp ? (
                    <textarea
                      autoFocus
                      value={loaded ? myText : "불러오는 중..."}
                      onChange={(e) => setMyText(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder={`${label}를 입력하세요...`}
                      rows={4}
                      disabled={!loaded}
                      className="w-full text-[11px] resize-none outline-none bg-muted/50 border border-border rounded-lg px-2.5 py-2"
                    />
                  ) : (
                    <textarea
                      autoFocus
                      value={fallbackText}
                      onChange={(e) => {
                        localStorage.setItem(storageKey, e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder={`${label}를 입력하세요...`}
                      rows={4}
                      className="w-full text-[11px] resize-none outline-none bg-muted/50 border border-border rounded-lg px-2.5 py-2"
                    />
                  )}
                  {/* 저장 버튼 */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                    if (isDbProp) {
                        handleSave().then(() => setOpen(false));
                      } else {
                        setSaved(true);
                        setTimeout(() => { setSaved(false); setOpen(false); }, 800);
                      }
                    }}
                    disabled={saving}
                    className="w-full mt-1.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                    style={{
                      background: saved ? "hsl(var(--stat-green, 142 71% 45%))" : "hsl(var(--primary))",
                      color: "white",
                    }}
                  >
                    {saving ? "저장 중..." : saved ? "✓ 저장 완료" : "저장"}
                  </button>
                </div>



                {/* 등록된 매물 메모 (관리자/등록자가 입력) */}
                {initialText?.trim() && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground mb-1">등록 메모</p>
                    <div className="text-[11px] text-foreground bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 whitespace-pre-wrap">
                      {initialText}
                    </div>
                  </div>
                )}

                {/* 같은 사무소 다른 회원 메모 */}
                {otherMemos.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground mb-1">사무소 메모</p>
                    {otherMemos.map((m, i) => (
                      <div key={i} className="text-[11px] text-foreground bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-2 mb-1 whitespace-pre-wrap">
                        <span className="text-[10px] font-bold text-blue-600">{m.name}</span>
                        <p className="mt-0.5">{m.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  },
);

MemoNotepad.displayName = "MemoNotepad";

/* ── ErrorReportModal ── */
interface ErrorReportModalProps {
  prop: MapProperty;
  onClose: () => void;
}
const ErrorReportModal = ({ prop, onClose }: ErrorReportModalProps) => {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSend = async () => {
    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;

      let proposerName: string | null = null;
      let proposerCompany: string | null = null;
      let proposerPhone: string | null = null;
      if (userId) {
        const { data: profile } = await supabase
          .from("agent_profiles")
          .select("name, agency_name, phone")
          .eq("user_id", userId)
          .maybeSingle();
        if (profile) {
          proposerName = profile.name;
          proposerCompany = profile.agency_name;
          proposerPhone = profile.phone;
        }
      }

      const propertyId = prop.dbId || String(prop.id);
      const { error } = await supabase.from("property_reports").insert({
        property_id: propertyId,
        property_title: prop.title || prop.address,
        property_address: prop.address,
        report_type: "error_report",
        submitted_by: userId,
        proposer_name: proposerName,
        proposer_company: proposerCompany,
        proposer_phone: proposerPhone,
        error_content: text.trim() || null,
      });
      if (error) throw error;
      setSent(true);
    } catch (e) {
      console.error("제보 저장 실패:", e);
      alert("제보 저장 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[10050] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10051] bg-card rounded-2xl shadow-2xl flex flex-col"
        style={{ width: "min(420px, 92vw)", maxHeight: "88vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-border rounded-t-2xl flex-shrink-0"
          style={{ background: "hsl(var(--destructive)/0.06)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "hsl(var(--destructive)/0.12)" }}
            >
              <AlertCircle className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">오류 제보</p>
              <p className="text-[10px] text-muted-foreground truncate max-w-[280px]">
                {prop.buildingName ?? prop.title} {prop.unitNumber ?? ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {sent ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "hsl(var(--chart-2)/0.1)" }}>
              <CheckCircle className="w-7 h-7" style={{ color: "hsl(var(--chart-2))" }} />
            </div>
            <p className="text-sm font-bold text-foreground">제보가 접수되었습니다</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">관리자가 검토 후 처리할 예정입니다.</p>
            <button
              onClick={onClose}
              className="mt-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
            >
              닫기
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* 매물 정보 요약 */}
            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-[11px] space-y-0.5">
              <p className="font-bold text-foreground">{prop.buildingName ?? prop.title}</p>
              <p className="text-muted-foreground">{prop.address}</p>
              <p className="text-muted-foreground">
                호수: {prop.unitNumber ?? "-"} · {prop.floor} · {prop.area}
              </p>
            </div>

            {/* 내용 (선택사항) */}
            <div>
              <p className="text-[11px] font-semibold text-foreground mb-1.5">
                오류 내용 <span className="text-muted-foreground font-normal">(선택)</span>
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="어떤 오류가 있는지 작성해 주세요."
                rows={4}
                className="w-full text-[12px] text-foreground leading-7 resize-none outline-none px-3 pt-2 pb-2 rounded-xl border border-border placeholder:text-muted-foreground/40"
                style={{ background: "hsl(var(--muted)/0.3)" }}
              />
            </div>

            {/* 전송 버튼 */}
            <button
              onClick={handleSend}
              disabled={saving}
              className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "hsl(var(--destructive))", color: "#fff" }}
            >
              <Send className="w-4 h-4" />
              {saving ? "제출 중..." : "제보하기"}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

/* ── DealCompleteModal ── */
interface DealCompleteModalProps {
  prop: MapProperty;
  onClose: () => void;
  onComplete?: (propId: string) => void;
}
const DealCompleteModal = ({ prop, onClose, onComplete }: DealCompleteModalProps) => {
  const [dealDate, setDealDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;

      // 제보자 프로필 조회
      let proposerName: string | null = null;
      let proposerCompany: string | null = null;
      let proposerPhone: string | null = null;
      if (userId) {
        const { data: profile } = await supabase
          .from("agent_profiles")
          .select("name, agency_name, phone")
          .eq("user_id", userId)
          .maybeSingle();
        if (profile) {
          proposerName = profile.name;
          proposerCompany = profile.agency_name;
          proposerPhone = profile.phone;
        }
      }

      const propertyId = prop.dbId || String(prop.id);
      const { error } = await supabase.from("property_reports").insert({
        property_id: propertyId,
        property_title: prop.title || prop.address,
        property_address: prop.address,
        report_type: "deal_complete",
        deal_date: dealDate,
        deal_memo: memo.trim() || null,
        submitted_by: userId,
        proposer_name: proposerName,
        proposer_company: proposerCompany,
        proposer_phone: proposerPhone,
      });
      if (error) throw error;
      setDone(true);
      const pid = prop.dbId || String(prop.id);
      onComplete?.(pid);
    } catch (e) {
      console.error("거래완료 저장 실패:", e);
      alert("처리 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[10050] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10051] bg-card border border-border rounded-2xl shadow-2xl flex flex-col"
        style={{ width: "min(400px, 92vw)", maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0"
          style={{ background: "hsl(var(--primary) / 0.08)" }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
            <h3 className="text-sm font-bold text-foreground">거래 완료 처리</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted/50">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        {done ? (
          <div className="p-8 flex flex-col items-center gap-3 text-center">
            <CheckCircle className="w-10 h-10" style={{ color: "hsl(var(--primary))" }} />
            <p className="text-sm font-bold text-foreground">거래완료가 접수되었습니다</p>
            <p className="text-xs text-muted-foreground">관리자가 확인 후 매물 상태를 변경합니다.</p>
            <button
              onClick={onClose}
              className="mt-2 px-5 py-2 rounded-full text-xs font-bold text-white"
              style={{ background: "hsl(var(--primary))" }}
            >
              확인
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-[10px] text-muted-foreground mb-0.5">대상 매물</p>
                <p className="text-xs font-semibold text-foreground truncate">{prop.title}</p>
                <p className="text-[11px] text-muted-foreground">{prop.address}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">거래 완료일</label>
                <input
                  type="date"
                  value={dealDate}
                  onChange={(e) => setDealDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground outline-none focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">메모 (선택)</label>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="특이사항이 있다면 입력하세요."
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground resize-none outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="px-5 py-4 flex-shrink-0 border-t border-border">
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="w-full h-10 rounded-full text-sm font-bold text-white transition-all disabled:opacity-50"
                style={{ background: "hsl(var(--primary))" }}
              >
                {saving ? "처리 중..." : "확인"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
};

/* ── PhotoUploadModal ── */
interface PhotoUploadModalProps {
  prop: MapProperty;
  onClose: () => void;
  onImagesUpdated?: (images: string[]) => void;
}

/** 파일을 dataURL로 변환 */
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const PhotoUploadModal = ({ prop, onClose, onImagesUpdated }: PhotoUploadModalProps) => {
  const isDBProperty = !!prop.memo;
  const dbId = prop.memo;
  const storageKey = `photos_${prop.id}`;

  // 이미 저장된 사진
  const [savedPhotos, setSavedPhotos] = useState<string[]>(() => {
    if (isDBProperty) return prop.images ?? (prop.image ? [prop.image] : []);
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    } catch {
      return [];
    }
  });

  // 새로 선택(미리보기)된 파일들 (아직 저장 안 됨)
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState("");
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [pendingDragIdx, setPendingDragIdx] = useState<number | null>(null);
  const [pendingOverIdx, setPendingOverIdx] = useState<number | null>(null);

  // 저장된 사진 드래그 순서 변경
  const handleSavedDragStart = (e: React.DragEvent, i: number) => { setDragIdx(i); e.dataTransfer.effectAllowed = "move"; };
  const handleSavedDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setOverIdx(i); };
  const handleSavedDrop = async (e: React.DragEvent, dropI: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === dropI) { setDragIdx(null); setOverIdx(null); return; }
    const arr = [...savedPhotos];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(dropI, 0, moved);
    if (isDBProperty) {
      await supabase.rpc("update_property_images", { _property_id: dbId, _images: arr });
    } else {
      localStorage.setItem(storageKey, JSON.stringify(arr));
    }
    setSavedPhotos(arr);
    onImagesUpdated?.(arr);
    setDragIdx(null); setOverIdx(null);
  };
  const handleSavedDragEnd = () => { setDragIdx(null); setOverIdx(null); };

  // 대기 사진 드래그 순서 변경
  const handlePendingDragStart = (e: React.DragEvent, i: number) => { setPendingDragIdx(i); e.dataTransfer.effectAllowed = "move"; };
  const handlePendingDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setPendingOverIdx(i); };
  const handlePendingDrop = (e: React.DragEvent, dropI: number) => {
    e.preventDefault();
    if (pendingDragIdx === null || pendingDragIdx === dropI) { setPendingDragIdx(null); setPendingOverIdx(null); return; }
    const arrF = [...pendingFiles]; const [mf] = arrF.splice(pendingDragIdx, 1); arrF.splice(dropI, 0, mf);
    const arrP = [...pendingPreviews]; const [mp] = arrP.splice(pendingDragIdx, 1); arrP.splice(dropI, 0, mp);
    setPendingFiles(arrF); setPendingPreviews(arrP);
    setPendingDragIdx(null); setPendingOverIdx(null);
  };
  const handlePendingDragEnd = () => { setPendingDragIdx(null); setPendingOverIdx(null); };

  // 파일 선택 → 미리보기만 생성
  const handleSelectFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    const previews = await Promise.all(arr.map(readFileAsDataURL));
    setPendingFiles((prev) => [...prev, ...arr]);
    setPendingPreviews((prev) => [...prev, ...previews]);
    setSaved(false);
  };

  // 대기 사진 제거 (저장 전)
  const removePending = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
    setPendingPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  // 대표사진 설정 (해당 사진을 배열 첫 번째로 이동)
  const setMainPhoto = async (idx: number) => {
    if (idx === 0) return;
    const next = [savedPhotos[idx], ...savedPhotos.filter((_, i) => i !== idx)];
    if (isDBProperty) {
      await supabase.rpc("update_property_images", { _property_id: dbId, _images: next });
    } else {
      localStorage.setItem(storageKey, JSON.stringify(next));
    }
    setSavedPhotos(next);
    onImagesUpdated?.(next);
  };

  // 저장된 사진 제거
  const removeSaved = async (idx: number) => {
    const url = savedPhotos[idx];
    if (isDBProperty) {
      const bucketBase = supabase.storage.from("property-images").getPublicUrl("").data.publicUrl.replace(/\/$/, "");
      const filePath = url.replace(bucketBase + "/", "");
      await supabase.storage.from("property-images").remove([filePath]);
      const next = savedPhotos.filter((_, i) => i !== idx);
      await supabase.rpc("update_property_images", { _property_id: dbId, _images: next });
      setSavedPhotos(next);
      onImagesUpdated?.(next);
    } else {
      const next = savedPhotos.filter((_, i) => i !== idx);
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSavedPhotos(next);
    }
  };

  // ── 저장하기 ──
  const handleSave = async () => {
    if (pendingFiles.length === 0) return;
    setSaving(true);
    setSaved(false);

    if (isDBProperty) {
      setSaveProgress(`저장 중 0 / ${pendingFiles.length}…`);
      let done = 0;
      const newUrls = await uploadPropertyImages(pendingFiles, `${dbId}/`);
      done = pendingFiles.length;
      setSaveProgress(`저장 중 ${done} / ${pendingFiles.length}…`);
      const merged = [...savedPhotos, ...newUrls];
      const { error: updateErr } = await supabase.rpc("update_property_images", { _property_id: dbId, _images: merged });
      if (!updateErr) {
        setSavedPhotos(merged);
        onImagesUpdated?.(merged);
        setPendingFiles([]);
        setPendingPreviews([]);
        setSaved(true);
        setSaving(false);
        setSaveProgress("");
        onClose();
        return;
      }
    } else {
      // Static: dataURL을 localStorage에 저장
      const merged = [...savedPhotos, ...pendingPreviews];
      localStorage.setItem(storageKey, JSON.stringify(merged));
      setSavedPhotos(merged);
      setPendingFiles([]);
      setPendingPreviews([]);
      setSaved(true);
      setSaving(false);
      setSaveProgress("");
      onClose();
      return;
    }

    setSaving(false);
    setSaveProgress("");
  };

  const totalCount = savedPhotos.length + pendingPreviews.length;

  return (
    <>
      <div className="fixed inset-0 z-[10050] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10051] bg-white rounded-2xl shadow-2xl flex flex-col"
        style={{ width: "min(560px, 94vw)", maxHeight: "88vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-border rounded-t-2xl flex-shrink-0"
          style={{ background: "hsl(var(--primary)/0.05)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "hsl(var(--primary)/0.1)" }}
            >
              <Camera className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">사진 등록</p>
              <p className="text-[10px] text-muted-foreground truncate max-w-[340px]">
                {prop.buildingName ?? prop.title} · {prop.address}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {/* 파일 선택 드롭존 */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleSelectFiles(e.target.files)}
          />
          <button
            disabled={saving}
            onClick={() => inputRef.current?.click()}
            className="w-full border-2 border-dashed rounded-xl py-5 flex flex-col items-center gap-1.5 transition-colors disabled:opacity-50"
            style={{ borderColor: "hsl(var(--primary)/0.3)" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "hsl(var(--primary)/0.6)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "hsl(var(--primary)/0.3)")}
          >
            <Camera className="w-7 h-7" style={{ color: "hsl(var(--primary)/0.5)" }} />
            <span className="text-sm font-semibold text-primary">사진 선택</span>
            <span className="text-[11px] text-muted-foreground">JPG · PNG · WEBP — 여러 장 동시 선택 가능</span>
          </button>

          {/* 새로 선택된 사진 (미리보기, 미저장) */}
          {pendingPreviews.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold text-foreground">새로 선택한 사진</span>
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: "hsl(var(--accent)/0.12)", color: "hsl(var(--accent))" }}
                >
                  {pendingPreviews.length}장
                </span>
                <span className="text-[10px] text-muted-foreground">— 드래그로 순서 변경</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {pendingPreviews.map((src, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => handlePendingDragStart(e, idx)}
                    onDragOver={(e) => handlePendingDragOver(e, idx)}
                    onDrop={(e) => handlePendingDrop(e, idx)}
                    onDragEnd={handlePendingDragEnd}
                    className="relative aspect-square rounded-xl overflow-hidden group border-2 cursor-grab active:cursor-grabbing"
                    style={{ borderColor: pendingOverIdx === idx ? "hsl(var(--primary))" : "hsl(var(--accent)/0.4)", opacity: pendingDragIdx === idx ? 0.4 : 1 }}
                  >
                    <img src={src} alt="" className="w-full h-full object-cover pointer-events-none" />
                    <button
                      onClick={() => removePending(idx)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                    <span
                      className="absolute bottom-0 inset-x-0 text-center text-[8px] font-semibold text-white py-0.5"
                      style={{ background: "hsl(var(--accent)/0.7)" }}
                    >
                      미저장
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 이미 저장된 사진 */}
          {savedPhotos.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold text-foreground">저장된 사진</span>
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: "hsl(var(--primary)/0.1)", color: "hsl(var(--primary))" }}
                >
                  {savedPhotos.length}장
                </span>
                <span className="text-[10px] text-muted-foreground">— 드래그로 순서 변경</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {savedPhotos.map((src, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => handleSavedDragStart(e, idx)}
                    onDragOver={(e) => handleSavedDragOver(e, idx)}
                    onDrop={(e) => handleSavedDrop(e, idx)}
                    onDragEnd={handleSavedDragEnd}
                    className="relative aspect-square rounded-xl overflow-hidden group border-2 transition-all cursor-grab active:cursor-grabbing"
                    style={{ borderColor: overIdx === idx ? "hsl(var(--accent))" : idx === 0 ? "hsl(var(--primary))" : "hsl(var(--border))", opacity: dragIdx === idx ? 0.4 : 1 }}
                  >
                    {idx === 0 ? (
                      <span
                        className="absolute top-1 left-1 z-10 text-[8px] font-bold text-white px-1.5 py-0.5 rounded-full"
                        style={{ background: "hsl(var(--primary))" }}
                      >
                        ⭐ 대표
                      </span>
                    ) : (
                      <button
                        onClick={() => setMainPhoto(idx)}
                        className="absolute top-1 left-1 z-10 text-[8px] font-bold text-white px-1.5 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.4)" }}
                      >
                        대표설정
                      </button>
                    )}
                    <img src={src} alt="" className="w-full h-full object-cover pointer-events-none" />
                    <button
                      onClick={() => removeSaved(idx)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalCount === 0 && (
            <p className="text-center text-[11px] text-muted-foreground py-4">사진을 선택해 주세요</p>
          )}
        </div>

        {/* 하단 푸터 — 저장 버튼 */}
        <div className="px-4 py-3 border-t border-border flex-shrink-0 flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground flex-1">
            {isDBProperty ? "✓ 서버에 저장됩니다" : "✓ 이 기기에 저장됩니다"}
            {totalCount > 0 && <span className="ml-1 font-semibold text-primary">· 총 {totalCount}장</span>}
          </span>

          {saved && pendingFiles.length === 0 && (
            <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: "hsl(var(--primary))" }}>
              <CheckCircle className="w-3.5 h-3.5" /> 저장 완료
            </span>
          )}

          <button
            onClick={handleSave}
            disabled={pendingFiles.length === 0 || saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "hsl(var(--primary))", color: "white" }}
          >
            {saving ? (
              <>
                <Upload className="w-4 h-4 animate-bounce" />
                {saveProgress || "저장 중…"}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                사진 저장하기
                {pendingFiles.length > 0 && <span className="ml-0.5 text-white/80">({pendingFiles.length})</span>}
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

/* ── LeaseProposalModal ── */
interface UnitRow {
  id: string;
  unitNumber: string;
  type: string;
  floor: string;
  area: string;
  deposit: string;
  monthly: string;
  status: string; // 공실 | 임차중 | 기타
}
interface MortgageRow {
  id: string;
  creditor: string;
  amount: string;
}

interface LeaseProposalModalProps {
  prop: MapProperty;
  allProperties: MapProperty[];
  onClose: () => void;
  isAdmin?: boolean;
  onRefetch?: () => void;
}
const LeaseProposalModal = ({ prop, allProperties, onClose, isAdmin, onRefetch }: LeaseProposalModalProps) => {
  const todayStr = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  const handlePrint = () => window.print();

  // 같은 주소(address)의 모든 호실 — 매매 타입 제외
  const sameBuilding = allProperties
    .filter((p) => p.address === prop.address && !p.type.includes("매매"))
    .sort((a, b) => (a.unitNumber ?? "").localeCompare(b.unitNumber ?? "", "ko"));
  const base = sameBuilding[0] ?? prop;

  // ── 편집 가능 상태 ──
  const [buildingInfoRows, setBuildingInfoRows] = useState<[string, string][]>([
    ["소재지", base.address],
    ["건물명", base.buildingName ?? base.title],
    ["건축연도", base.buildYear ?? ""],
    ["총 층수", base.totalFloors ?? ""],
    ["주차", base.parking ?? ""],
    ["엘리베이터", base.elevator ? "있음" : "없음"],
    ["관리비", base.manageFee ?? ""],
  ]);

  // ── 건축물대장 데이터 자동 로드 ──
  useEffect(() => {
    const loadBuildingSummary = async () => {
      if (!prop.dbId) return;
      try {
        const { data: bs } = await supabase
          .from("building_summary")
          .select("*")
          .eq("property_id", prop.dbId)
          .maybeSingle();
        if (bs) {
          setBuildingInfoRows([
            ["소재지", base.address],
            ["건물명", base.buildingName || bs.building_name || base.title],
            ["주용도", bs.main_purpose || ""],
            ["사용승인일", bs.approval_date || ""],
            ["연면적", bs.total_area ? `${bs.total_area}㎡` : ""],
            ["건축면적", bs.building_area ? `${bs.building_area}㎡` : ""],
            ["대지면적", bs.land_area ? `${bs.land_area}㎡` : ""],
            ["지상층수", bs.floors_above || base.totalFloors || ""],
            ["지하층수", bs.floors_below || ""],
            ["주차대수", bs.parking_count || base.parking || ""],
            ["엘리베이터", bs.elevator ? "있음" : "없음"],
            ["관리비", base.manageFee ?? ""],
          ]);
        }
      } catch (e) {
        console.warn("건축물대장 로드 실패:", e);
      }
    };
    loadBuildingSummary();
  }, [prop.dbId]);

  const PROPOSAL_PREFIX = "__PROPOSAL_JSON__";
  const defaultUnits = (): UnitRow[] =>
    sameBuilding.map((p) => ({
      id: String(p.id),
      unitNumber: p.unitNumber ?? "",
      type: p.type,
      floor: p.floor ?? "",
      area: p.area ?? "",
      deposit: p.deposit ?? "",
      monthly: p.monthly ?? "",
      status: p.availableFrom === "공실" ? "공실" : "임차중",
    }));

  // 저장된 제안서가 있으면 로드, 없으면 sameBuilding 기반 자동 생성
  const initial = (() => {
    const memo = prop.buildingMemoRaw ?? prop.buildingMemo ?? "";
    if (memo.startsWith(PROPOSAL_PREFIX)) {
      try {
        const parsed = JSON.parse(memo.slice(PROPOSAL_PREFIX.length));
        return {
          units: parsed.units ?? [],
          mortgages: parsed.mortgages ?? [{ id: "1", creditor: "", amount: "" }],
          totalDeposit: parsed.totalDeposit ?? "",
          totalMortgage: parsed.totalMortgage ?? "",
          note: parsed.note ?? "",
          loaded: true,
        };
      } catch {
        // fallthrough
      }
    }
    return {
      units: defaultUnits(),
      mortgages: [{ id: "1", creditor: "", amount: "" }] as MortgageRow[],
      totalDeposit: "",
      totalMortgage: "",
      note: memo,
      loaded: false,
    };
  })();

  const [units, setUnits] = useState<UnitRow[]>(initial.units);
  const [mortgages, setMortgages] = useState<MortgageRow[]>(initial.mortgages);
  const [totalDepositInput, setTotalDepositInput] = useState(initial.totalDeposit);
  const [totalMortgageInput, setTotalMortgageInput] = useState(initial.totalMortgage);
  const [note, setNote] = useState(initial.note);
  const [saved, setSaved] = useState(false);

  // prop.buildingMemoRaw가 변경되면(저장 후 refetch 등) 로컬 상태 동기화
  useEffect(() => {
    const memo = prop.buildingMemoRaw ?? prop.buildingMemo ?? "";
    if (memo.startsWith(PROPOSAL_PREFIX)) {
      try {
        const parsed = JSON.parse(memo.slice(PROPOSAL_PREFIX.length));
        setUnits(parsed.units ?? []);
        setMortgages(parsed.mortgages ?? [{ id: "1", creditor: "", amount: "" }]);
        setTotalDepositInput(parsed.totalDeposit ?? "");
        setTotalMortgageInput(parsed.totalMortgage ?? "");
        setNote(parsed.note ?? "");
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prop.buildingMemoRaw]);

  // 호실 편집
  const updateUnit = (idx: number, key: keyof UnitRow, val: string) =>
    setUnits((prev) => prev.map((u, i) => (i === idx ? { ...u, [key]: val } : u)));
  const addUnit = () =>
    setUnits((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        unitNumber: "",
        type: "",
        floor: "",
        area: "",
        deposit: "",
        monthly: "",
        status: "공실",
      },
    ]);
  const removeUnit = (idx: number) => setUnits((prev) => prev.filter((_, i) => i !== idx));

  // 근저당 편집
  const updateMortgage = (idx: number, key: keyof MortgageRow, val: string) =>
    setMortgages((prev) => prev.map((m, i) => (i === idx ? { ...m, [key]: val } : m)));
  const addMortgage = () => setMortgages((prev) => [...prev, { id: Date.now().toString(), creditor: "", amount: "" }]);
  const removeMortgage = (idx: number) => setMortgages((prev) => prev.filter((_, i) => i !== idx));

  // 건물현황 편집
  const updateBuildingRow = (idx: number, val: string) =>
    setBuildingInfoRows((prev) => prev.map((r, i) => (i === idx ? [r[0], val] : r)));

  // 저장 (구조화된 JSON으로 building_memo에 저장)
  const handleSave = async () => {
    if (!prop.dbId) {
      alert("저장할 매물 ID가 없습니다.");
      return;
    }
    const payload = {
      units,
      mortgages,
      totalDeposit: totalDepositInput,
      totalMortgage: totalMortgageInput,
      note,
      buildingInfoRows,
    };
    const content = PROPOSAL_PREFIX + JSON.stringify(payload);
    const { error } = await supabase.from("properties").update({ building_memo: content }).eq("id", prop.dbId);
    if (error) {
      alert("저장 실패: " + error.message);
      return;
    }
    setSaved(true);
    onRefetch?.();
    setTimeout(() => setSaved(false), 2000);
  };

  // 삭제 (DB에서도 완전 초기화)
  const handleDelete = async () => {
    if (!confirm("임대현황 내용을 초기화하시겠습니까?")) return;
    if (!prop.dbId) {
      alert("삭제할 매물 ID가 없습니다.");
      return;
    }
    const { error } = await supabase.from("properties").update({ building_memo: null }).eq("id", prop.dbId);
    if (error) {
      alert("삭제 실패: " + error.message);
      return;
    }
    setUnits([]);
    setMortgages([{ id: "1", creditor: "", amount: "" }]);
    setTotalDepositInput("");
    setTotalMortgageInput("");
    setNote("");
    alert("임대현황이 초기화되었습니다.");
  };

  const ic =
    "px-2 py-1 text-[11px] border border-border rounded bg-background text-foreground outline-none focus:border-primary w-full";

  return (
    <>
      <div className="fixed inset-0 z-[10050] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10051] bg-white rounded-2xl shadow-2xl flex flex-col"
        style={{ width: "min(760px, 96vw)", maxHeight: "94vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5 rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">임대현황</p>
              <p className="text-[10px] text-muted-foreground">{isAdmin ? "직접 수정 후 저장할 수 있습니다" : "열람 전용"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-2.5 py-1.5 text-[11px] font-bold bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
            >
              🖨️ 인쇄
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={handleSave}
                  className="px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1"
                  style={{ background: "hsl(var(--primary))", color: "#fff" }}
                >
                  {saved ? "✓ 저장됨" : "💾 저장"}
                </button>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1"
                  style={{ background: "hsl(var(--destructive) / 0.12)", color: "hsl(var(--destructive))" }}
                  title="저장된 임대현황 초기화"
                >
                  🗑 삭제
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 타이틀 */}
          <div className="bg-primary rounded-xl px-6 py-4 text-center">
            <p className="text-base font-extrabold tracking-widest text-primary-foreground">임 대 제 안 서</p>
            <p className="text-[10px] text-primary-foreground/60 mt-0.5">{todayStr}</p>
          </div>

          {/* ① 건물 현황 - 편집 가능 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-primary rounded-full" />
              <p className="text-[12px] font-extrabold text-foreground">건물 현황</p>
            </div>
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-[11px]">
                <tbody>
                  {buildingInfoRows.map(([label, value], i) => (
                    <tr key={label} className={i % 2 === 0 ? "bg-muted/30" : "bg-white"}>
                      <td className="px-3 py-1.5 font-semibold text-muted-foreground w-[90px] whitespace-nowrap border-r border-border/40">
                        {label}
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => updateBuildingRow(i, e.target.value)}
                          className={ic}
                          readOnly={!isAdmin}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ② 호수별 임대 현황 - 편집 가능 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-accent rounded-full" />
                <p className="text-[12px] font-extrabold text-foreground">호수별 임대 현황</p>
                <span className="text-[10px] text-muted-foreground">총 {units.length}개 호실</span>
              </div>
              {isAdmin && (
              <button
                onClick={addUnit}
                className="text-[10px] font-bold px-2 py-1 rounded-lg transition-colors"
                style={{ background: "hsl(var(--primary)/0.1)", color: "hsl(var(--primary))" }}
              >
                + 호실 추가
              </button>
              )}
            </div>
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="px-2 py-2 text-left font-bold whitespace-nowrap">호수</th>
                    <th className="px-2 py-2 text-left font-bold whitespace-nowrap">유형</th>
                    <th className="px-2 py-2 text-left font-bold whitespace-nowrap">층</th>
                    <th className="px-2 py-2 text-left font-bold whitespace-nowrap">면적</th>
                    <th className="px-2 py-2 text-right font-bold whitespace-nowrap">보증금</th>
                    <th className="px-2 py-2 text-right font-bold whitespace-nowrap">월임대료</th>
                    <th className="px-2 py-2 text-center font-bold whitespace-nowrap w-[28px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u, i) => (
                    <tr key={u.id} className={`border-t border-border/40 ${i % 2 === 0 ? "bg-white" : "bg-muted/20"}`}>
                      <td className="px-1 py-1">
                        <input
                          value={u.unitNumber}
                          onChange={(e) => updateUnit(i, "unitNumber", e.target.value)}
                          className={ic}
                          placeholder="호수"
                          readOnly={!isAdmin}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          value={u.type}
                          onChange={(e) => updateUnit(i, "type", e.target.value)}
                          className={ic}
                          placeholder="유형"
                          readOnly={!isAdmin}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          value={(u.floor || "").replace(/층/g, "")}
                          onChange={(e) => updateUnit(i, "floor", e.target.value)}
                          className={ic}
                          placeholder=""
                          readOnly={!isAdmin}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          value={u.area}
                          onChange={(e) => updateUnit(i, "area", e.target.value)}
                          className={ic}
                          placeholder="면적"
                          readOnly={!isAdmin}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          value={u.deposit}
                          onChange={(e) => updateUnit(i, "deposit", e.target.value)}
                          className={ic + " text-right"}
                          placeholder="보증금"
                          readOnly={!isAdmin}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          value={u.monthly}
                          onChange={(e) => updateUnit(i, "monthly", e.target.value)}
                          className={ic + " text-right"}
                          placeholder="월세"
                          readOnly={!isAdmin}
                        />
                      </td>
                      <td className="px-1 py-1 text-center">
                        {isAdmin && (
                        <button
                          onClick={() => removeUnit(i)}
                          className="w-5 h-5 rounded-full bg-destructive/10 hover:bg-destructive flex items-center justify-center text-destructive hover:text-white transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {/* 보증금 합계 행 */}
                  <tr className="border-t-2 border-primary/30 bg-primary/5">
                    <td colSpan={4} className="px-3 py-2 text-right font-extrabold text-[11px] text-foreground">
                      보증금 합계
                    </td>
                    <td className="px-1 py-1" colSpan={2}>
                      <input
                        type="text"
                        value={totalDepositInput}
                        onChange={(e) => setTotalDepositInput(e.target.value)}
                        placeholder="합계 직접 입력"
                        className={ic + " text-right font-extrabold"}
                        style={{ borderColor: "hsl(var(--primary)/0.5)" }}
                        readOnly={!isAdmin}
                      />
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ③ 근저당 내역 - 편집 가능 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full" style={{ background: "hsl(0 85% 55%)" }} />
                <p className="text-[12px] font-extrabold text-foreground">근저당 내역</p>
              </div>
              {isAdmin && (
              <button
                onClick={addMortgage}
                className="text-[10px] font-bold px-2 py-1 rounded-lg transition-colors"
                style={{ background: "hsl(0 85% 96%)", color: "hsl(0 85% 45%)" }}
              >
                + 내역 추가
              </button>
              )}
            </div>
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-[11px]">
                <thead>
                  <tr style={{ background: "hsl(0 85% 55%)" }} className="text-white">
                    <th className="px-3 py-2 text-left font-bold">채권자</th>
                    <th className="px-3 py-2 text-right font-bold">금액 (만원)</th>
                    <th className="px-2 py-2 w-[28px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {mortgages.map((m, i) => (
                    <tr key={m.id} className={`border-t border-border/40 ${i % 2 === 0 ? "bg-white" : "bg-muted/20"}`}>
                      <td className="px-1 py-1">
                        <input
                          value={m.creditor}
                          onChange={(e) => updateMortgage(i, "creditor", e.target.value)}
                          className={ic}
                          placeholder="채권자명"
                          readOnly={!isAdmin}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          value={m.amount}
                          onChange={(e) => updateMortgage(i, "amount", e.target.value)}
                          className={ic + " text-right"}
                          placeholder="금액"
                          readOnly={!isAdmin}
                        />
                      </td>
                      <td className="px-1 py-1 text-center">
                        {isAdmin && (
                        <button
                          onClick={() => removeMortgage(i)}
                          className="w-5 h-5 rounded-full bg-destructive/10 hover:bg-destructive flex items-center justify-center text-destructive hover:text-white transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {/* 근저당 합계 행 */}
                  <tr className="border-t-2 bg-red-50" style={{ borderColor: "hsl(0 85% 75%)" }}>
                    <td className="px-3 py-2 text-right font-extrabold text-[11px] text-foreground">근저당 합계</td>
                    <td className="px-1 py-1">
                      <input
                        type="text"
                        value={totalMortgageInput}
                        onChange={(e) => setTotalMortgageInput(e.target.value)}
                        placeholder="합계 직접 입력"
                        className={ic + " text-right font-extrabold"}
                        style={{ borderColor: "hsl(0 85% 65%)" }}
                        readOnly={!isAdmin}
                      />
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ④ 특이사항 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-muted-foreground/40 rounded-full" />
              <p className="text-[12px] font-extrabold text-foreground">특이사항</p>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="특이사항 등을 입력하세요"
              className="w-full px-3 py-2 text-[11px] rounded-xl border border-border bg-muted/20 text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary resize-none transition-colors"
              readOnly={!isAdmin}
            />
          </div>

          {/* 하단 저장 버튼 - 관리자만 */}
          {isAdmin && (
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
              style={{ background: "hsl(var(--primary))", color: "#fff" }}
            >
              💾 {saved ? "저장 완료!" : "저장하기"}
            </button>
          </div>
          )}
        </div>
      </div>
    </>
  );
};

/* ── ContactRevealBtn ── 연락처 클릭 시 번호 인라인 표시 */
interface ContactRevealBtnProps {
  propId: number;
  label: string;
  shortLabel: string;
  number: string;
  colorStyle: React.CSSProperties;
  borderStyle: React.CSSProperties;
}
const ContactRevealBtn = ({ propId, label, shortLabel, number, colorStyle, borderStyle }: ContactRevealBtnProps) => {
  const isGuest = useIsGuest();
  const [revealed, setRevealed] = useState(() => hasRevealedToday(propId, label));
  const [showNum, setShowNum] = useState(false);
  if (isGuest) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!revealed) {
      markRevealed(propId, label);
      setRevealed(true);
    }
    setShowNum((v) => !v);
  };

  if (showNum) {
    return (
      <a
        href={`tel:${number}`}
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold border whitespace-nowrap flex-shrink-0 transition-colors"
        style={colorStyle}
      >
        <Phone className="w-2.5 h-2.5 flex-shrink-0" />
        {number}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border whitespace-nowrap flex-shrink-0 transition-all hover:opacity-80"
      style={borderStyle}
    >
      {shortLabel}
    </button>
  );
};

/* ── GuestOptionsButton ── 모바일 게스트/일반회원: 옵션·시설 버튼 (클릭 시 모달로 전체 표시) */
const GuestOptionsButton = ({ chips }: { chips: string[] }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-center">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          className="text-xs text-black font-bold px-2 py-0.5 rounded whitespace-nowrap select-none"
          style={{ background: "hsl(var(--muted))", border: "1.5px solid hsl(var(--border))" }}
        >
          옵션·시설 ▾
        </button>
      </div>
      {open && createPortal(
        <div
          className="fixed inset-x-0 top-0 bottom-[calc(86px+env(safe-area-inset-bottom,0px))] sm:inset-0 z-[10400] flex items-end sm:items-center justify-center bg-black/40"
          onClick={(e) => { e.stopPropagation(); setOpen(false); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-4 w-[calc(100%-16px)] sm:w-auto sm:max-w-md max-h-[calc(100dvh-130px)] sm:max-h-[80dvh] overflow-y-auto mb-2 sm:mb-0"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-extrabold mb-2 pb-1.5 border-b border-border" style={{ color: "hsl(var(--primary))" }}>
              옵션·시설 ({chips.length}개)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5">
              {chips.map((c) => (
                <span key={c} className="text-[12px] text-black font-bold whitespace-nowrap">· {c}</span>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>

  );
};

/* 스크롤 앵커 헬퍼: 확인일 갱신 시 목록 재정렬이 일어나도 화면(시각적 뷰포트)은 그대로 유지 */
type ScrollAnchor = { id: string; offsetFromTop: number } | null;
const captureScrollAnchor = (container: HTMLElement | null | undefined, excludeId: string | number | null | undefined): ScrollAnchor => {
  if (!container) return null;
  const containerRect = container.getBoundingClientRect();
  const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-prop-id]'));
  for (const el of cards) {
    if (excludeId != null && el.dataset.propId === String(excludeId)) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom <= containerRect.top + 1) continue; // 뷰포트 위쪽으로 사라진 카드 스킵
    return { id: el.dataset.propId!, offsetFromTop: r.top - containerRect.top };
  }
  return null;
};
const restoreScrollAnchor = (container: HTMLElement | null | undefined, anchor: ScrollAnchor, maxFrames = 30) => {
  if (!container || !anchor) return;
  let frames = maxFrames;
  const tick = () => {
    if (!container) return;
    const el = container.querySelector<HTMLElement>(`[data-prop-id="${anchor.id}"]`);
    if (el) {
      const containerRect = container.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const currentOffset = r.top - containerRect.top;
      const delta = currentOffset - anchor.offsetFromTop;
      if (Math.abs(delta) > 0.5) {
        container.scrollTop += delta;
      }
    }
    frames -= 1;
    if (frames > 0) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

/* ── MobileCheckBadge ── 모바일 매물카드 펼침 영역의 등록일/확인일 표시 (웹 확인일 아이콘 스타일) */
interface MobileCheckBadgeProps {
  propId: number;
  propertyId?: string;
  registeredDate?: string;
  checkedDate?: string;
  isAdmin?: boolean;
  listScrollRef?: React.RefObject<HTMLDivElement>;
  onCheckedDateUpdated?: (propId: number, checkedDate: string | null) => void;
}
const MobileCheckBadge = ({ propId, propertyId, registeredDate, checkedDate, isAdmin, listScrollRef, onCheckedDateUpdated }: MobileCheckBadgeProps) => {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  if (!registeredDate && !checkedDate) return null;
  const effectiveCheckedDate = checkedDate || registeredDate;
  const isChecked = !!effectiveCheckedDate;
  const chkDays = effectiveCheckedDate ? Math.floor((Date.now() - new Date(effectiveCheckedDate).getTime()) / 86400000) : null;
  const handleIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((v) => {
      const next = !v;
      if (next && btnRef.current) {
        const r = btnRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const popupW = Math.min(vw - 16, 320);
        let left = r.left;
        if (left + popupW > vw - 8) left = vw - popupW - 8;
        if (left < 8) left = 8;
        setPos({ top: r.bottom + 4, left });
      }
      return next;
    });
  };
  const handleReset = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin || !propertyId || busy) return;
    setBusy(true);
    const anchor = captureScrollAnchor(listScrollRef?.current, propId);
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("properties").update({ checked_date: today }).eq("id", propertyId);
    setBusy(false);
    if (error) {
      toast.error("확인일 갱신에 실패했습니다.");
      return;
    }
    onCheckedDateUpdated?.(propId, today);
    setExpanded(false);
    restoreScrollAnchor(listScrollRef?.current, anchor);
  };
  return (
    <div className="relative inline-flex items-center">
      <button
        ref={btnRef}
        type="button"
        onClick={handleIconClick}
        className="flex-shrink-0 flex items-center gap-0.5 px-1 py-0.5 rounded transition-all select-none"
        style={{
          background: isChecked ? "hsl(142 70% 93%)" : "hsl(var(--muted))",
          border: `1.5px solid ${isChecked ? "hsl(142 60% 65%)" : "hsl(var(--border))"}`,
        }}
        title={`확인 ${effectiveCheckedDate} (D+${chkDays})`}
      >
        <img
          src={checkDateIcon}
          alt="확인"
          className="w-5 h-5 object-contain"
          style={{ imageRendering: '-webkit-optimize-contrast' as any, opacity: isChecked ? 1 : 0.4 }}
        />
      </button>
      {expanded && pos && createPortal(
        <>
          {/* 바깥 탭하면 닫기 */}
          <div
            className="fixed inset-0 z-[10000]"
            onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
          />
          <div
            className="fixed z-[10001] flex items-center gap-1.5 flex-wrap text-[11px] p-1.5 rounded-md shadow-lg border border-border bg-card"
            style={{ top: pos.top, left: pos.left, maxWidth: 'min(320px, calc(100vw - 16px))' }}
            onClick={(e) => e.stopPropagation()}
          >
            {registeredDate && (
              <span className="px-1.5 py-0.5 rounded border border-border bg-card text-muted-foreground font-semibold">
                등록일 {registeredDate}
              </span>
            )}
            <span
              className="px-1.5 py-0.5 rounded font-bold"
              style={{
                background: isChecked ? "hsl(142 70% 95%)" : "hsl(var(--muted))",
                color: isChecked ? "hsl(142 60% 30%)" : "hsl(var(--muted-foreground))",
                border: `1px solid ${isChecked ? "hsl(142 60% 65%)" : "hsl(var(--border))"}`,
              }}
            >
              확인일 {effectiveCheckedDate}
            </span>
            {isAdmin && propertyId && (
              <button
                type="button"
                onClick={handleReset}
                disabled={busy}
                className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white disabled:opacity-50"
                style={{ background: "hsl(var(--primary))" }}
                title="확인일을 오늘 날짜로 갱신"
              >
                확인일 갱신
              </button>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

/* ── AddressToggleCard ── 매인정보 레이아웃 (이미지 참고 레이아웃) */
interface AddressToggleCardProps {
  prop: MapProperty;
  idx: number;
  buildingMemo: string | undefined;
  roomMemo: string | undefined;
  buildingPw: string | undefined;
  roomPw: string | undefined;
  regDate: string | undefined;
  chkDate: string | undefined;
  isDealCompleted?: boolean;
}
const AddressToggleCard = forwardRef<HTMLDivElement, AddressToggleCardProps & { isAdmin?: boolean; userId?: string; listScrollRef?: React.RefObject<HTMLDivElement>; agencyInfo?: AgencyInfo; fallbackImage?: string; isMobile?: boolean; onOpenPhotos?: () => void; onOpenContacts?: () => void; hasReferencePhotos?: boolean; onCheckedDateUpdated?: (propId: number, checkedDate: string | null) => void }>(
  ({ prop, idx, buildingMemo, roomMemo, buildingPw, roomPw, regDate, chkDate, isAdmin, userId, isDealCompleted, listScrollRef, agencyInfo, fallbackImage, isMobile, onOpenPhotos, onOpenContacts, hasReferencePhotos, onCheckedDateUpdated }, ref) => {
    const [checking, setChecking] = useState(false);
    const isGuest = useIsGuest();
    const { user: authUserAddr } = useAuth();
    const isGeneralMember = authUserAddr?.memberType === "일반회원";
    const openMemberChat = (e: React.MouseEvent) => {
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent("open-chat-inquiry", {
        detail: {
          agentUserId: null,
          propertyId: prop.dbId,
          propertyTitle: addressToDong(prop.address) + (prop.type ? ` ${prop.type}` : ""),
        },
      }));
    };
    const limitAddress = isGuest || isGeneralMember;
    // 게스트/일반회원에게는 "구 동"까지만 노출. 집합건물(아파트/오피스텔/연립/다세대)은 번지까지.
    const isCollective = /아파트|오피스텔|연립|다세대|공동주택/.test(prop.type || "");
    const guGuDong = (addr?: string | null) => {
      if (!addr) return "";
      const gu = addr.match(/[가-힣]+구(?![가-힣])/)?.[0];
      const dong = addr.match(/[가-힣]+(동|읍|면|리)(?![가-힣])/)?.[0];
      // 번지: 동/읍/면/리 뒤에 나오는 숫자(-숫자) 패턴
      const beonji = addr.match(/(?:동|읍|면|리)\s+(\d+(?:-\d+)?)/)?.[1];
      const tail = isCollective && beonji ? `${dong ?? ""} ${beonji}`.trim() : (dong ?? "");
      return [gu, tail].filter(Boolean).join(" ") || addressToDong(addr);
    };
    const buildYearShortAddr = prop.buildYear ? prop.buildYear.replace(/[^0-9]/g, "").slice(0, 4) : "";
    const isChecked = !!chkDate;

    const handleCheckToggle = async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!isAdmin) return; // 관리자만 체크 가능
      if (!prop.memo) return; // DB 매물만 가능
      if (checking) return;
      setChecking(true);
      // 토글: 확인일이 있으면 null로 초기화, 없으면 오늘로 설정
      const newCheckedDate = isChecked ? null : new Date().toISOString().slice(0, 10);
      // 체크 시 목록이 재정렬되어도 화면(시각적 뷰포트)은 유지
      const anchor = newCheckedDate ? captureScrollAnchor(listScrollRef?.current, prop.id) : null;
      const { error } = await supabase.from("properties").update({ checked_date: newCheckedDate }).eq("id", prop.memo);
      setChecking(false);
      if (error) {
        toast.error("확인일 변경에 실패했습니다.");
        return;
      }
      onCheckedDateUpdated?.(prop.id, newCheckedDate);
      if (newCheckedDate) restoreScrollAnchor(listScrollRef?.current, anchor);
    };
    const [showFullAddr, setShowFullAddr] = useState(false);
    const [showVacateInfo, setShowVacateInfo] = useState(false);
    const [showOptPopup, setShowOptPopup] = useState(false);
    const optBadgeRef = useRef<HTMLDivElement>(null);
    const [optPopupStyle, setOptPopupStyle] = useState<React.CSSProperties>({});

    const optHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleOptMouseEnter = () => {
      if (optHoverTimer.current) clearTimeout(optHoverTimer.current);
      if (optBadgeRef.current) {
        const rect = optBadgeRef.current.getBoundingClientRect();
        const popupHeight = 200; // 팝업 예상 최대 높이
        const popupWidth = 200;
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;

        // 오른쪽 공간 확인 (사이드바 우측이 잘릴 수 있음)
        const sidebarRight = rect.left + 360; // 사이드바 대략 너비
        const overflowRight = rect.left + popupWidth > window.innerWidth;

        let leftPos = rect.left;
        if (overflowRight) {
          leftPos = Math.max(8, window.innerWidth - popupWidth - 8);
        }

        if (spaceAbove >= popupHeight || spaceAbove > spaceBelow) {
          // 위쪽에 표시
          setOptPopupStyle({
            position: "fixed",
            top: rect.top - 4,
            left: leftPos,
            transform: "translateY(-100%)",
          });
        } else {
          // 아래쪽에 표시
          setOptPopupStyle({
            position: "fixed",
            top: rect.bottom + 4,
            left: leftPos,
            transform: "none",
          });
        }
      }
      setShowOptPopup(true);
    };

    const handleOptMouseLeave = () => {
      if (optHoverTimer.current) clearTimeout(optHoverTimer.current);
      setShowOptPopup(false);
    };

    const handleRoadviewOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();

      if (!prop.lat || !prop.lng) {
        window.open(`https://map.kakao.com/?q=${encodeURIComponent(prop.address)}`, "_blank");
        return;
      }

      const payload = JSON.stringify({
        title: prop.buildingName ?? prop.title ?? "로드뷰",
        address: prop.address,
        lat: prop.lat,
        lng: prop.lng,
      }).replace(/</g, "\\u003c");

      const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${prop.buildingName ?? prop.title ?? "로드뷰"}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      height: 100%;
      background: #f8fafc;
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif;
      letter-spacing: -0.01em;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
    }
    body { display: flex; flex-direction: column; }
    .toolbar {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 18px;
      background: rgba(255,255,255,0.85);
      backdrop-filter: saturate(180%) blur(14px);
      -webkit-backdrop-filter: saturate(180%) blur(14px);
      border-bottom: 1px solid rgba(15,23,42,0.06);
      color: #0f172a; z-index: 10; flex-shrink: 0;
    }
    .toolbar h1 {
      font-size: 14px; font-weight: 700; flex: 1;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      color: #0f172a; letter-spacing: -0.02em;
      display: flex; align-items: baseline; gap: 10px;
    }
    .toolbar .addr {
      font-size: 12px; font-weight: 500; color: #94a3b8;
      letter-spacing: -0.01em;
    }
    .seg {
      display: inline-flex; align-items: center;
      padding: 3px; gap: 2px;
      background: #f1f5f9;
      border: 1px solid rgba(15,23,42,0.05);
      border-radius: 999px;
    }
    .toolbar button {
      padding: 6px 14px; border-radius: 999px; border: none;
      font-size: 12.5px; font-weight: 600; cursor: pointer;
      letter-spacing: -0.01em; color: #475569;
      background: transparent;
      transition: color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
    }
    .seg button:hover { color: #0f172a; }
    .btn-rv.active, .btn-map.active {
      background: #ffffff;
      color: #0f172a;
      box-shadow: 0 1px 2px rgba(15,23,42,0.06), 0 4px 10px rgba(15,23,42,0.05);
    }
    .btn-close-rv {
      display: none;
      padding: 6px 12px; border-radius: 999px;
      background: transparent; color: #ea580c;
      border: 1px solid rgba(234,88,12,0.25);
    }
    .btn-close-rv.show { display: inline-flex; align-items: center; }
    .btn-close-rv:hover {
      background: #fff7ed;
      border-color: rgba(234,88,12,0.45);
    }
    .btn-close {
      padding: 6px 14px; border-radius: 999px;
      background: #0f172a; color: #fff;
      box-shadow: 0 1px 2px rgba(15,23,42,0.2);
    }
    .btn-close:hover { background: #1e293b; }
    .content { flex: 1; display: flex; flex-direction: column; position: relative; min-height: 0; background: #0f172a; }
    .panel { flex: 1; min-width: 0; min-height: 0; width: 100%; position: relative; }
    .panel.hidden { display: none; }
    #mapPanel:not(.hidden) { border-top: 2px solid #334155; }
    #roadview, #map { width: 100%; height: 100%; }
    #status {
      position: absolute; inset: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 10px;
      background: rgba(15,23,42,0.94);
      backdrop-filter: blur(8px);
      color: #fff; text-align: center; padding: 24px; z-index: 5;
    }
    #status strong { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; }
    #status span { font-size: 13px; color: #94a3b8; font-weight: 500; }
    .divider { width: 4px; background: #334155; cursor: col-resize; flex-shrink: 0; }
    .rv-pin {
      position: relative;
      display: flex; flex-direction: column; align-items: center;
      pointer-events: none;
      filter: drop-shadow(0 8px 18px rgba(15,23,42,0.55));
      animation: rv-pin-float 2.4s ease-in-out infinite;
    }
    @keyframes rv-pin-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }
    .rv-pin .pin-label {
      background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%);
      color: #fff;
      padding: 7px 14px 7px 12px;
      border-radius: 999px;
      font-size: 12px; font-weight: 700;
      letter-spacing: 0.02em;
      white-space: nowrap;
      border: 2px solid rgba(255,255,255,0.95);
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
      display: inline-flex; align-items: center; gap: 6px;
      box-shadow: 0 4px 14px rgba(59,130,246,0.45);
    }
    .rv-pin .pin-label .pin-ico {
      display: inline-flex; align-items: center; justify-content: center;
      width: 16px; height: 16px;
      border-radius: 50%;
      background: rgba(255,255,255,0.25);
      font-size: 10px;
    }
    .rv-pin .pin-tail {
      width: 0; height: 0;
      border-left: 9px solid transparent;
      border-right: 9px solid transparent;
      border-top: 13px solid #6366f1;
      margin-top: -1px;
    }
    .rv-pin .pin-dot {
      width: 16px; height: 16px;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, #c4b5fd, #6366f1 60%, #4338ca);
      border: 3px solid #fff;
      margin-top: 3px;
      box-shadow: 0 0 0 4px rgba(99,102,241,0.25);
    }
    @media (max-width: 640px) {
      .toolbar { padding: 10px 14px; gap: 6px; }
      .toolbar h1 { font-size: 13px; }
      .toolbar .addr { display: none; }
      .toolbar button { padding: 7px 12px; font-size: 12px; border-radius: 8px; }
      .rv-pin .pin-label { font-size: 11px; padding: 6px 12px; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <h1>${prop.buildingName ?? prop.title ?? "로드뷰"}<span class="addr">${prop.address}</span></h1>
    <div class="seg">
      <button class="btn-rv active" id="btnRv" onclick="toggleView('rv')">로드뷰</button>
      <button class="btn-map" id="btnMap" onclick="toggleView('map')">지도</button>
    </div>
    <button class="btn-close-rv" id="btnCloseRv" onclick="toggleView('closeRv')">로드뷰 닫기</button>
    <button class="btn-close" onclick="window.parent.postMessage({type:'close-roadview'},'*')">닫기</button>
  </div>
  <div class="content">
    <div class="panel" id="rvPanel">
      <div id="roadview"></div>
      <div id="status"><strong>가장 가까운 로드뷰를 찾는 중입니다.</strong><span>주변 도로를 자동 탐색하고 있습니다.</span></div>
    </div>
    <div class="panel hidden" id="mapPanel">
      <div id="map"></div>
    </div>
  </div>
  <script>
    var data, radii, statusEl, roadviewEl, mapEl, rvPanel, mapPanel, btnRv, btnMap, btnCloseRv, mapInstance, currentView, roadview;
    var sdkLoadAttempts = 0;
    var roadviewInitAttempts = 0;
    var MAX_SDK_ATTEMPTS = 4;
    var MAX_ROADVIEW_ATTEMPTS = 2;
    var SDK_TIMEOUT = 10000;
    var PANO_TIMEOUT = 4500;

    function setStatus(title, desc, showFallback) {
      var html = "<strong>" + title + "</strong><span>" + desc + "</span>";
      if (showFallback) {
        html += '<span style="margin-top:12px;"><a href="https://map.kakao.com/link/roadview/' + data.lat + ',' + data.lng + '" target="_blank" style="color:#60a5fa;text-decoration:underline;font-size:13px;">카카오맵에서 로드뷰 열기 →</a></span>';
      }
      statusEl.innerHTML = html;
      statusEl.style.display = "flex";
    }

    function toggleView(mode) {
      if (mode === "rv") {
        currentView = "rv";
      } else if (mode === "map") {
        // 지도 클릭: rv 상태면 반반 보기, 반반/map 상태면 rv 단독으로 복귀
        if (currentView === "rv") currentView = "both";
        else currentView = "rv";
      } else if (mode === "closeRv") {
        // 로드뷰 닫기: 지도만 표시
        currentView = "map";
      }

      rvPanel.classList.toggle("hidden", currentView === "map");
      mapPanel.classList.toggle("hidden", currentView === "rv");
      btnRv.classList.toggle("active", currentView === "rv" || currentView === "both");
      btnMap.classList.toggle("active", currentView === "map" || currentView === "both");
      btnCloseRv.classList.toggle("show", currentView === "both");

      setTimeout(function() {
        if (currentView !== "map" && roadview) try { roadview.relayout(); } catch(e) {}
        if (currentView !== "rv") {
          if (!mapInstance) initMap();
          else try { mapInstance.relayout(); } catch(e) {}
        }
      }, 100);
    }

    function initMap() {
      var pos = new kakao.maps.LatLng(data.lat, data.lng);
      mapInstance = new kakao.maps.Map(mapEl, { center: pos, level: 3 });
      new kakao.maps.Marker({ position: pos, map: mapInstance });
      var iwContent = '<div style="padding:8px 12px;font-size:12px;font-weight:700;color:#0f172a;font-family:Pretendard,-apple-system,BlinkMacSystemFont,Apple SD Gothic Neo,Malgun Gothic,sans-serif;letter-spacing:-0.01em;white-space:nowrap;">' +
        (data.title ? '<div style="color:#2563eb;font-size:11px;margin-bottom:2px;">' + data.title + '</div>' : '') +
        '<div>' + data.address + '</div></div>';
      var infowindow = new kakao.maps.InfoWindow({ content: iwContent, removable: false });
      infowindow.open(mapInstance, new kakao.maps.Marker({ position: pos, map: mapInstance }));
      mapInstance.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
      mapInstance.addControl(new kakao.maps.MapTypeControl(), kakao.maps.ControlPosition.TOPRIGHT);
    }

    function initRoadview() {
      data = ${payload};
      radii = [30, 50, 100, 200, 400, 800, 1500, 3000];
      statusEl = document.getElementById("status");
      roadviewEl = document.getElementById("roadview");
      mapEl = document.getElementById("map");
      rvPanel = document.getElementById("rvPanel");
      mapPanel = document.getElementById("mapPanel");
      btnRv = document.getElementById("btnRv");
      btnMap = document.getElementById("btnMap");
      btnCloseRv = document.getElementById("btnCloseRv");
      mapInstance = null;
      currentView = "rv";

      try {
        roadviewInitAttempts++;
        var position = new kakao.maps.LatLng(data.lat, data.lng);
        roadview = new kakao.maps.Roadview(roadviewEl);
        var roadviewClient = new kakao.maps.RoadviewClient();

        // 로드뷰 init 이벤트: 파노라마 이미지 안의 실제 좌표 위치에 핀 마커 표시
        kakao.maps.event.addListener(roadview, 'init', function() {
          try {
            var pinContent = '<div class="rv-pin">' +
              '<div class="pin-label"><span class="pin-ico">📍</span>현위치</div>' +
              '<div class="pin-tail"></div>' +
              '<div class="pin-dot"></div>' +
            '</div>';

            var pinOverlay = new kakao.maps.CustomOverlay({
              position: position,
              content: pinContent,
              xAnchor: 0.5,
              yAnchor: 1,
            });
            // 사람 시야 높이(약 2m) 정도 위에 띄워 잘 보이도록
            try { pinOverlay.setAltitude(2); } catch(e) {}
            pinOverlay.setMap(roadview);

            // 시점을 핀 위치로 자동 회전 (어디인지 바로 보이도록)
            try {
              var projection = roadview.getProjection();
              var viewpoint = projection.viewpointFromCoords(
                pinOverlay.getPosition(),
                pinOverlay.getAltitude ? pinOverlay.getAltitude() : 2
              );
              roadview.setViewpoint(viewpoint);
            } catch(e) {}
          } catch(e) {}
        });

        var searchNearest = function(index) {
          if (index === undefined) index = 0;
          var radius = radii[index];
          setStatus("가장 가까운 로드뷰를 찾는 중입니다.", radius + "m 반경까지 탐색 중");

          var settled = false;
          var timer = setTimeout(function() {
            if (settled) return;
            settled = true;
            // 응답 지연 시 다음 반경으로 진행
             if (index < radii.length - 1) {
              searchNearest(index + 1);
            } else {
               if (roadviewInitAttempts < MAX_ROADVIEW_ATTEMPTS) {
                 setStatus("로드뷰 응답이 지연되고 있습니다.", "자동으로 다시 연결하고 있습니다.");
                 setTimeout(initRoadview, 900);
               } else {
                 setStatus("로드뷰 응답이 지연되고 있습니다.", "잠시 후 다시 시도해주세요.", true);
               }
            }
          }, PANO_TIMEOUT);

          try {
            roadviewClient.getNearestPanoId(position, radius, function (panoId) {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              if (panoId) {
                try {
                  roadview.setPanoId(panoId, position);
                  statusEl.style.display = "none";
                  setTimeout(function () {
                    try { roadview.relayout(); } catch (e) {}
                  }, 120);
                } catch (e) {
                  setStatus("로드뷰 표시에 실패했습니다.", "카카오맵에서 직접 확인해주세요.", true);
                }
                return;
              }
              if (index < radii.length - 1) {
                searchNearest(index + 1);
                return;
              }
               if (roadviewInitAttempts < MAX_ROADVIEW_ATTEMPTS) {
                 setStatus("주변 로드뷰를 다시 찾고 있습니다.", "탐색 범위를 다시 확인 중입니다.");
                 setTimeout(initRoadview, 900);
                 return;
               }
               setStatus("주변에서 로드뷰를 찾지 못했습니다.", "이 위치에는 표시 가능한 로드뷰가 없습니다.", true);
            });
          } catch (e) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
             if (roadviewInitAttempts < MAX_ROADVIEW_ATTEMPTS) {
               setStatus("로드뷰 요청 중 오류가 발생했습니다.", "자동으로 다시 연결하고 있습니다.");
               setTimeout(initRoadview, 900);
               return;
             }
             setStatus("로드뷰 요청 중 오류가 발생했습니다.", "카카오맵에서 직접 확인해주세요.", true);
          }
        };

        searchNearest();
      } catch (error) {
         if (roadviewInitAttempts < MAX_ROADVIEW_ATTEMPTS) {
           setStatus("로드뷰를 불러오는 중입니다.", "초기화를 다시 시도하고 있습니다.");
           setTimeout(initRoadview, 900);
           return;
         }
         setStatus("로드뷰를 불러오지 못했습니다.", "잠시 후 다시 시도해주세요.", true);
      }
    }

    function loadSdk() {
      sdkLoadAttempts++;
      if (window.__kakaoRvLoaderPromise) {
        window.__kakaoRvLoaderPromise.then(initRoadview).catch(function() {
          setStatus("카카오 지도 SDK를 불러오지 못했습니다.", "네트워크를 확인하거나 카카오맵에서 직접 확인해주세요.", true);
        });
        return;
      }
      window.__kakaoRvLoaderPromise = new Promise(function(resolve, reject) {
        if (window.kakao && window.kakao.maps) {
          try {
            kakao.maps.load(function() { resolve(window.kakao.maps); });
            return;
          } catch (e) {}
        }

        var existing = document.getElementById("kakao-sdk-rv");
        if (existing) existing.parentNode.removeChild(existing);

        var sdkScript = document.createElement("script");
        sdkScript.id = "kakao-sdk-rv";
        sdkScript.src = "https://dapi.kakao.com/v2/maps/sdk.js?appkey=9b1ab990830e8319b8bafb3104e5ae50&autoload=false&libraries=services";
        sdkScript.async = true;

        var settled = false;
        var loadTimer = setTimeout(function() {
          if (settled) return;
          settled = true;
          sdkScript.remove();
          reject(new Error("timeout"));
        }, SDK_TIMEOUT);

        sdkScript.onload = function() {
          if (settled) return;
          try {
            kakao.maps.load(function() {
              if (settled) return;
              settled = true;
              clearTimeout(loadTimer);
              resolve(window.kakao.maps);
            });
          } catch (e) {
            settled = true;
            clearTimeout(loadTimer);
            reject(e);
          }
        };
        sdkScript.onerror = function() {
          if (settled) return;
          settled = true;
          clearTimeout(loadTimer);
          sdkScript.remove();
          reject(new Error("load_error"));
        };
        document.head.appendChild(sdkScript);
      }).then(function() {
        return initRoadview();
      }).catch(function(error) {
        window.__kakaoRvLoaderPromise = null;
         if (sdkLoadAttempts < MAX_SDK_ATTEMPTS) {
          setStatus("SDK 로딩 재시도 중...", "시도 " + (sdkLoadAttempts + 1) + "/" + MAX_SDK_ATTEMPTS);
           setTimeout(loadSdk, sdkLoadAttempts * 800);
          return;
        }
        setStatus("카카오 지도 SDK를 불러오지 못했습니다.", "네트워크를 확인하거나 카카오맵에서 직접 확인해주세요.", true);
        throw error;
      });
    }

    // 초기 statusEl 참조 + data 미리 세팅 (fallback 링크용)
    statusEl = document.getElementById("status");
    data = ${payload};
    loadSdk();
  </script>
</body>
</html>`;

      // 인앱 풀스크린 iframe 으로 로드뷰 표시 (브라우저 주소창/about:blank 바 제거)
      const existing = document.getElementById("kakao-roadview-overlay");
      if (existing) existing.remove();

      const overlay = document.createElement("div");
      overlay.id = "kakao-roadview-overlay";
      overlay.style.cssText = "position:fixed;inset:0;z-index:2147483646;background:#0f172a;";

      const iframe = document.createElement("iframe");
      iframe.style.cssText = "width:100%;height:100%;border:0;display:block;";
      iframe.setAttribute("allow", "fullscreen");
      overlay.appendChild(iframe);
      document.body.appendChild(overlay);
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const closeOverlay = () => {
        window.removeEventListener("message", onMsg);
        document.body.style.overflow = prevOverflow;
        overlay.remove();
      };
      const onMsg = (ev: MessageEvent) => {
        if (ev?.data?.type === "close-roadview") closeOverlay();
      };
      window.addEventListener("message", onMsg);

      const doc = iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
      }
    };

    // 면적에서 평수만 추출 (예: "49㎡ (15.2평)" → "15.2평", "15" → "15평", "19.2평" → "19.2평")
    const pyeong = prop.area?.match(/\((\d+(?:\.\d+)?)평\)/) ?? prop.area?.match(/(\d+(?:\.\d+)?)\s*평/);
    const rawArea = pyeong ? pyeong[1] + "평" : prop.area ? prop.area.split(" ")[0] : "";
    const areaShort = rawArea && /^\d+(?:\.\d+)?$/.test(rawArea) ? rawArea + "평" : rawArea;
    // floor에서 층 숫자만 (예: "3층" → "3F")
    const floorShort = prop.floor ? prop.floor.replace(/층/g, "F").replace(/지상\s*/g, "") : "";
    // 연락처 버튼 목록
    const contacts: {
      label: string;
      short: string;
      num: string;
      color: React.CSSProperties;
      border: React.CSSProperties;
    }[] = [];
    if (prop.contactOwner)
      contacts.push({
        label: "건물주",
        short: "건물주",
        num: prop.contactOwner,
        color: { background: "#dcfce7", color: "#15803d", borderColor: "#86efac" },
        border: { background: "transparent", color: "#15803d", borderColor: "#86efac" },
      });
    if (prop.contactManager)
      contacts.push({
        label: "관리인",
        short: "관리인",
        num: prop.contactManager,
        color: { background: "#dbeafe", color: "#1d4ed8", borderColor: "#93c5fd" },
        border: { background: "transparent", color: "#1d4ed8", borderColor: "#93c5fd" },
      });
    if (prop.contact)
      contacts.push({
        label: "부동산",
        short: prop.agentName ? `${prop.agentName.slice(0, 3)}문의` : "부동산",
        num: prop.contact,
        color: { background: "#fff7ed", color: "#c2410c", borderColor: "#fdba74" },
        border: { background: "transparent", color: "#c2410c", borderColor: "#fdba74" },
      });

    // 모바일: 컴팩트 3행 레이아웃 (사용자 요청 사양)
    if (isMobile) {
      const buildYr = prop.buildYear ? prop.buildYear.replace(/[^0-9]/g, "").slice(0, 4) : "";
      const hasOwnPhotos = (prop.images && prop.images.length > 0) || (prop.image && prop.image.length > 0);
      const hasPhotos = hasOwnPhotos || !!hasReferencePhotos;
      const note = prop.note ?? "";
      const wolseMatch = note.match(/월세: 보증금 ([^\n/]+)만원 \/ 월세 ([^\n]+)만원/);
      const halfMatch = note.match(/반전세: 보증금 ([^\n/]+)만원 \/ 월세 ([^\n]+)만원/);
      const jeonseMatch = note.match(/(?<!반)전세: 보증금 ([^\n]+)만원/);
      const isSaleProp = note.includes("매매가:") || (!prop.monthly && !!prop.deposit);
      // 부가시설 아이콘 수집
      const opts = prop.options ?? [];
      const normalizedOpts = new Set(opts.map((o) => String(o).replace(/\s+/g, "").toLowerCase()));
      const hasOpt = (...c: string[]) => c.some((x) => normalizedOpts.has(x.replace(/\s+/g, "").toLowerCase()));
      const facilityBadges: JSX.Element[] = [];
      if (prop.elevator || hasOpt("엘리베이터"))
        facilityBadges.push(<FacilityBadge key="el" label="엘리베이터" iconSrc={elevatorIcon} bg="#e0f2fe" border="#7dd3fc" />);
      if (hasOpt("반려동물불가", "애완동물불가", "반려동물_불가"))
        facilityBadges.push(
          <FacilityBadge
            key="pd"
            label="반려동물 불가"
            iconSrc={petIcon}
            bg="#fef2f2"
            border="#fca5a5"
            badge={
              <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <svg width="20" height="20" viewBox="0 0 20 20"><line x1="3" y1="3" x2="17" y2="17" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" /></svg>
              </span>
            }
          />
        );
      else if (hasOpt("반려동물가능", "애완동물가능", "반려동물_가능"))
        facilityBadges.push(<FacilityBadge key="po" label="반려동물 가능" iconSrc={petIcon} bg="#fff7ed" border="#fdba74" />);
      ([
        ["수도", waterIcon, "#eff6ff", "#93c5fd"],
        ["인터넷", internetIcon, "#f0fdf4", "#86efac"],
        ["유선TV", tvIcon, "#faf5ff", "#d8b4fe"],
        ["CCTV", cctvIcon, "#fef2f2", "#fca5a5"],
        ["리모델링", remodelingIcon, "#fff7ed", "#fdba74"],
        ["여성전용", femaleOnlyIcon, "#fdf2f8", "#f9a8d4"],
      ] as const).forEach(([opt, src, bg, br]) => {
        if (!hasOpt(opt)) return;
        facilityBadges.push(<FacilityBadge key={opt} label={opt} iconSrc={src} bg={bg} border={br} />);
      });
      const FULL_OPT = ["냉장고", "세탁기", "에어컨", "TV", "전자레인지", "인터넷", "가스레인지", "수도"];
      const isFull = opts.includes("풀옵션") || FULL_OPT.every((o) => opts.includes(o));

      // 동(棟), 퇴거일, 중도퇴거, 거주중/공실 뱃지
      const dongMatch = note.match(/동\(棟\)[:\s]+([^\n|]+)/);
      const buildingDong = dongMatch?.[1]?.trim().replace(/동+\s*$/, "").trim();
      const earlyExit = note.includes("중도퇴거:");
      const isSalePropM = prop.type?.includes("매매");
      const vacancyM = !isSalePropM && prop.availableFrom && (prop.availableFrom === "공실" || prop.availableFrom === "세입자 거주중") ? prop.availableFrom : null;
      let vacatePast = false;
      let vacateLabel = "";
      if (prop.vacateDate) {
        const vacateStr = prop.vacateDate.replace(/[^0-9\-\/\.]/g, "").replace(/\./g, "-").replace(/\//g, "-");
        const vacateTime = new Date(vacateStr).getTime();
        vacatePast = !isNaN(vacateTime) && vacateTime < Date.now();
        if (!vacatePast && !isNaN(vacateTime)) vacateLabel = `퇴거 ${prop.vacateDate}`;
      }

      return (
        <div className="flex-1 min-w-0 flex flex-col px-2.5 py-2 gap-1.5 justify-center">
          {/* 1행: 건물명 · 동(棟) · 주소(클릭→로드뷰) | 우측: 건물메모, 방메모, 확인일/등록일 */}
          <div className="flex items-center gap-1 min-h-[22px]">
            {/* 확인일 배지 제거 */}
            {/* 모바일 일반회원/게스트는 건물명 숨김 (좌측 사진으로 대체) */}
            {!(isMobile && limitAddress) && (
              <p className="text-[13px] font-extrabold text-foreground truncate leading-none flex-shrink min-w-0">
                {prop.buildingName ?? prop.title}
              </p>
            )}
            {/* 모바일 일반회원/게스트: 임대유형 칩만 좌측에 (가격/평수는 아래 행으로 이동) */}
            {isMobile && limitAddress && (prop.type || floorShort) && (
              <span className="flex-shrink-0 flex items-center gap-0.5 text-[12px] font-extrabold px-1.5 py-0.5 rounded whitespace-nowrap" style={{ background: isDealCompleted ? "hsl(0 80% 95%)" : "hsl(var(--primary)/0.1)", color: isDealCompleted ? "hsl(0 70% 50%)" : "hsl(var(--primary))", border: `1.5px solid ${isDealCompleted ? "hsl(0 70% 70%)" : "hsl(var(--primary)/0.35)"}`, textDecoration: isDealCompleted ? "line-through" : "none" }}>
                {prop.type && <span>{prop.type}</span>}
                {prop.type === "원룸" && (prop.roomType === "오픈형" || prop.roomType === "분리형") && <span className="opacity-90">·{prop.roomType}</span>}
                {prop.roomType && prop.roomType.includes(",") && Array.from(new Set(prop.roomType.split(",").map((s) => s.trim()).filter((s) => s && s !== prop.type && s !== "오픈형" && s !== "분리형"))).map((s) => (<span key={s} className="opacity-90">·{s}</span>))}
                {floorShort && <span className="opacity-80">({floorShort})</span>}
              </span>
            )}
            {/* 모바일 일반회원/게스트: 1행 우측 끝에 상세보기 */}
            {isMobile && limitAddress && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent("open-guest-detail", {
                      detail: {
                        info: {
                          image: prop.images?.[0] || prop.image,
                          address: prop.address,
                          type: prop.type,
                          area: prop.area,
                          floor: prop.floor,
                          deposit: prop.deposit,
                          monthly: prop.monthly,
                          regNo: prop.regNo,
                          buildYear: prop.buildYear,
                          dbId: prop.dbId,
                        },
                        partnerDetail: {
                          propertyDbId: prop.dbId,
                          propertyRegNo: prop.regNo,
                          agentUserId: prop.registeredBy,
                          propertyTitle: addressToDong(prop.address) + (prop.type ? ` ${prop.type}` : ""),
                        },
                      },
                    }));
                  }}
                  className="ml-auto flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap border"
                  style={{ background: "white", color: "hsl(var(--primary))", borderColor: "hsl(var(--primary)/0.5)" }}
                >
                  상세보기
                </button>
              </>
            )}


            {/* 모바일에서 퇴거일/중도퇴거는 카드 선택 시 하단 액션 패널에 표시됨 */}
            {!(isMobile && limitAddress) && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (!limitAddress) setShowFullAddr((v) => !v); }}
              className="text-[11px] font-semibold whitespace-nowrap flex-shrink min-w-0 truncate underline decoration-dotted underline-offset-2"
              style={{ color: limitAddress ? "#000" : (showFullAddr ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))") }}
              title={limitAddress ? "로그인 후 상세 주소 확인" : "클릭하면 전체 주소 표시"}
            >
              {limitAddress ? guGuDong(prop.address) : (showFullAddr ? prop.address : shortAddress(prop.address))}
            </button>
            )}
            {/* 로드뷰 버튼 (게스트 숨김) */}
            {!isGuest && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRoadviewOpen(e); }}
                className="flex-shrink-0 px-1 py-0.5 rounded text-[9px] font-bold border whitespace-nowrap"
                style={{ color: "hsl(var(--primary))", borderColor: "hsl(var(--primary)/0.3)" }}
              >
                로드뷰
              </button>
            )}
            {/* 도로명 버튼 (탭 시 도로명주소 모달 표시) */}
            {!isGuest && prop.roadAddress && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); showRoadAddressModal(prop.roadAddress!); }}
                className="flex-shrink-0 px-1 py-0.5 rounded text-[9px] font-bold border whitespace-nowrap"
                style={{ color: "hsl(var(--primary))", borderColor: "hsl(var(--primary)/0.3)" }}
                title={prop.roadAddress}
              >
                도로명
              </button>
            )}
            {!(isMobile && limitAddress) && <span className="flex-1" />}
            {(isGuest || isGeneralMember) && (
              <>
                {!isMobile && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent("open-guest-detail", {
                      detail: {
                        info: {
                          image: prop.images?.[0] || prop.image,
                          address: prop.address,
                          type: prop.type,
                          area: prop.area,
                          floor: prop.floor,
                          deposit: prop.deposit,
                          monthly: prop.monthly,
                          regNo: prop.regNo,
                          buildYear: prop.buildYear,
                          dbId: prop.dbId,
                        },
                        partnerDetail: {
                          propertyDbId: prop.dbId,
                          propertyRegNo: prop.regNo,
                          agentUserId: prop.registeredBy,
                          propertyTitle: addressToDong(prop.address) + (prop.type ? ` ${prop.type}` : ""),
                        },
                      },
                    }));
                  }}
                  className="flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all hover:opacity-90 whitespace-nowrap border"
                  style={{ background: "white", color: "hsl(var(--primary))", borderColor: "hsl(var(--primary)/0.5)" }}
                >
                  상세보기
                </button>
                )}
                {!isMobile && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.dispatchEvent(new CustomEvent("open-guest-inquiry", {
                          detail: {
                            propertyDbId: prop.dbId,
                            propertyRegNo: prop.regNo,
                            agentUserId: prop.registeredBy,
                            propertyTitle: addressToDong(prop.address) + (prop.type ? ` ${prop.type}` : ""),
                          },
                        }));
                      }}
                      className="flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all hover:opacity-90 whitespace-nowrap"
                      style={{ background: "hsl(var(--primary))", color: "white" }}
                    >
                      문의하기
                    </button>
                    {!isGuest && (
                      <button
                        type="button"
                        onClick={openMemberChat}
                        className="flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all hover:opacity-90 whitespace-nowrap border"
                        style={{ background: "white", color: "hsl(var(--primary))", borderColor: "hsl(var(--primary)/0.5)" }}
                      >
                        채팅문의
                      </button>
                    )}
                  </>
                )}
              </>
            )}
            {regDate && !isMobile && (
              <span className="flex-shrink-0 text-[10px] font-semibold text-muted-foreground whitespace-nowrap">
                등록 {regDate}
              </span>
            )}
            {!(isMobile && limitAddress) && (
              <MemoNotepad
                propertyDbId={prop.dbId || (prop.memo && prop.memo.length === 36 ? prop.memo : undefined)}
                propId={prop.id}
                memoKey="building"
                icon={<img src={memoIcon} alt="건물메모" className="w-3.5 h-3.5 object-contain" style={{ imageRendering: '-webkit-optimize-contrast' as any }} />}
                label="건물메모"
                initialText={buildingMemo ?? ""}
                userId={userId}
                isAdmin={isAdmin}
              />
            )}
            {!(isMobile && limitAddress) && (
              <MemoNotepad
                propertyDbId={prop.dbId || (prop.memo && prop.memo.length === 36 ? prop.memo : undefined)}
                propId={prop.id}
                memoKey="room"
                icon={<img src={memoIcon} alt="방메모" className="w-3.5 h-3.5 object-contain" style={{ imageRendering: '-webkit-optimize-contrast' as any }} />}
                label="방메모"
                initialText={roomMemo ?? ""}
                userId={userId}
                isAdmin={isAdmin}
              />
            )}
            {isMobile && !isGuest && !isGeneralMember && (
              <MobileCheckBadge
                propId={prop.id}
                propertyId={prop.memo}
                registeredDate={prop.registeredDate}
                checkedDate={prop.checkedDate}
                isAdmin={isAdmin}
                listScrollRef={listScrollRef}
                onCheckedDateUpdated={onCheckedDateUpdated}
              />
            )}
          </div>

          {/* 모바일 일반회원/게스트: 가격 · 평수 | 우측 문의하기 */}
          {isMobile && limitAddress && (
            <div className="flex items-center gap-2 min-h-[24px]">
              <div className="flex items-center gap-1 flex-wrap min-w-0">
                {(wolseMatch || halfMatch || jeonseMatch) ? (
                  <span className="flex-shrink-0 flex items-center gap-1 text-[13px] font-extrabold whitespace-nowrap">
                    {wolseMatch && <span><span style={{ color: "hsl(var(--muted-foreground))" }}>월</span> {wolseMatch[1]}/<span style={neonGradientTextStyle}>{wolseMatch[2]}</span></span>}
                    {halfMatch && <span style={{ color: "#1d4ed8" }}>반{halfMatch[1]}/{halfMatch[2]}</span>}
                    {jeonseMatch && <span style={{ color: "#15803d" }}>전{jeonseMatch[1]}</span>}
                  </span>
                ) : (
                  <span className="flex-shrink-0 flex items-center gap-0.5 whitespace-nowrap text-[13px] font-extrabold">
                    {isSaleProp ? (
                      <><span style={{ color: "hsl(0 85% 55%)" }}>매</span><span style={{ color: "hsl(0 85% 45%)" }}>{prop.deposit}</span></>
                    ) : (
                      <><span style={{ color: "hsl(var(--muted-foreground))" }}>월</span><span>{prop.deposit}</span><span style={{ color: "hsl(var(--border))" }}>/</span><span style={neonGradientTextStyle}>{prop.monthly}</span></>
                    )}
                  </span>
                )}
                {prop.area && (
                  <span className="flex-shrink-0 text-[11px] font-bold whitespace-nowrap" style={{ color: "hsl(var(--foreground)/0.75)" }}>
                    {(() => {
                      const a = prop.area;
                      if (/평/.test(a)) return a;
                      const n = parseFloat(a.replace(/[^0-9.]/g, ""));
                      return !isNaN(n) && n > 0 ? `${(n / 3.3058).toFixed(1)}평` : a;
                    })()}
                  </span>
                )}
              </div>
              <span className="flex-1" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent("open-guest-inquiry", {
                    detail: {
                      propertyDbId: prop.dbId,
                      propertyRegNo: prop.regNo,
                      agentUserId: prop.registeredBy,
                      propertyTitle: addressToDong(prop.address) + (prop.type ? ` ${prop.type}` : ""),
                    },
                  }));
                }}
                className="flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap"
                style={{ background: "hsl(var(--primary))", color: "white" }}
              >
                문의하기
              </button>


            </div>
          )}



          {/* 2행: 방유형(층)호수 · 가격 · 카메라 | 우측: 카카오톡 공유 */}
          {!(isMobile && limitAddress) && <div className="flex items-center gap-1 flex-wrap min-h-[24px]">
            {(prop.type || floorShort || prop.unitNumber) && !(isMobile && limitAddress) && (
              <span className="flex-shrink-0 flex items-center gap-0.5 text-[12px] font-extrabold px-1.5 py-0.5 rounded whitespace-nowrap" style={{ background: isDealCompleted ? "hsl(0 80% 95%)" : "hsl(var(--primary)/0.1)", color: isDealCompleted ? "hsl(0 70% 50%)" : "hsl(var(--primary))", border: `1.5px solid ${isDealCompleted ? "hsl(0 70% 70%)" : "hsl(var(--primary)/0.35)"}`, textDecoration: isDealCompleted ? "line-through" : "none" }}>
                {prop.type && <span>{prop.type}</span>}
                {prop.type === "원룸" && (prop.roomType === "오픈형" || prop.roomType === "분리형") && <span className="opacity-90">·{prop.roomType}</span>}
                {prop.roomType && prop.roomType.includes(",") && Array.from(new Set(prop.roomType.split(",").map((s) => s.trim()).filter((s) => s && s !== prop.type && s !== "오픈형" && s !== "분리형"))).map((s) => (<span key={s} className="opacity-90">·{s}</span>))}
                {floorShort && <span className="opacity-80">({floorShort})</span>}
                {!isGuest && prop.unitNumber && <span>{buildingDong ? `${buildingDong}-${prop.unitNumber.replace(/호$/, "")}` : prop.unitNumber}</span>}
              </span>
            )}
            {/* 가격 */}
            {!(isMobile && limitAddress) && (
              (wolseMatch || halfMatch || jeonseMatch) ? (
                <span className="flex-shrink-0 flex items-center gap-1 text-[12px] font-extrabold whitespace-nowrap">
                  {wolseMatch && <span><span style={{ color: "hsl(var(--muted-foreground))" }}>월</span> {wolseMatch[1]}/<span style={neonGradientTextStyle}>{wolseMatch[2]}</span></span>}
                  {halfMatch && <span style={{ color: "#1d4ed8" }}>반{halfMatch[1]}/{halfMatch[2]}</span>}
                  {jeonseMatch && <span style={{ color: "#15803d" }}>전{jeonseMatch[1]}</span>}
                </span>
              ) : (
                <span className="flex-shrink-0 flex items-center gap-0.5 whitespace-nowrap text-[12px] font-extrabold">
                  {isSaleProp ? (
                    <><span style={{ color: "hsl(0 85% 55%)" }}>매</span><span style={{ color: "hsl(0 85% 45%)" }}>{prop.deposit}</span></>
                  ) : (
                    <><span style={{ color: "hsl(var(--muted-foreground))" }}>월</span><span>{prop.deposit}</span><span style={{ color: "hsl(var(--border))" }}>/</span><span style={neonGradientTextStyle}>{prop.monthly}</span></>
                  )}
                </span>
              )
            )}
            {/* 카메라 아이콘: 사진 있으면 진하게, 없으면 흰색. 클릭 시 사진 라이트박스 (모바일 일반회원/게스트는 좌측 썸네일로 대체, 카메라 숨김) */}
            {!(isMobile && limitAddress) && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenPhotos?.(); }}
                title={hasOwnPhotos ? "사진 보기" : hasReferencePhotos ? "다른 방 사진 보기" : "사진 없음"}
                className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded overflow-hidden transition-transform active:scale-95"
                style={{
                  background: "transparent",
                  border: "none",
                  opacity: hasPhotos ? 1 : 0.4,
                }}
              >
                <img
                  src={cameraIcon}
                  alt="사진"
                  className="w-8 h-8 object-contain"
                  style={{ imageRendering: "auto", transform: "scale(1.35)" }}
                  draggable={false}
                />
              </button>
            )}
            {prop.area && !(isMobile && limitAddress) && (
              <span className="flex-shrink-0 text-[11px] font-bold whitespace-nowrap" style={{ color: "hsl(var(--foreground)/0.75)" }}>
                {(() => {
                  const a = prop.area;
                  if (/평/.test(a)) return a;
                  const n = parseFloat(a.replace(/[^0-9.]/g, ""));
                  return !isNaN(n) && n > 0 ? `${(n / 3.3058).toFixed(1)}평` : a;
                })()}
              </span>
            )}
            <span className="flex-1" />
            {!(isMobile && limitAddress) && (
              <>
                {/* 카카오톡 공유 */}
                <button
                  onClick={(e) => { e.stopPropagation(); sharePropertyToKakao(prop, agencyInfo, fallbackImage); }}
                  title="카카오톡 공유"
                  className="flex-shrink-0 flex items-center justify-center"
                >
                  <img src={kakaoTalkIcon} alt="카카오톡 공유" className="w-8 h-8 object-contain" />
                </button>
              </>
            )}
          </div>}

          {/* 3행: 준공년도 · 공실/거주중 · 권리금 · 단기 · 부가시설 이모티콘 | 우측: 옵션(클릭 시 펼침) */}
          {(() => {
            const keyMoneyM = note.match(/권리금:\s*([^\n|]+)/);
            const keyMoney = keyMoneyM?.[1]?.trim();
            const hasKeyMoney = keyMoney && keyMoney !== "0" && keyMoney !== "없음";
            const isShortTerm = !isSaleProp && opts.includes("단기가능");
            const hasDuplexM = opts.includes("복층");
            const buildYearShort = prop.buildYear ? prop.buildYear.replace(/[^0-9]/g, "").slice(0, 4) : "";
            const showRow = (isMobile && limitAddress) || vacancyM || vacatePast || earlyExit || facilityBadges.length > 0 || opts.length > 0 || hasKeyMoney || isShortTerm || hasDuplexM || !!buildYearShort || !!prop.vacateDate;
            if (!showRow) return null;
            return (
            <div className="flex items-center gap-1 min-h-[24px]">
              <div className="flex items-center gap-1 flex-wrap min-w-0">
                {buildYearShort && !(isMobile && limitAddress) && (
                  <span className="flex-shrink-0 text-[10px] font-black px-1 py-0.5 rounded whitespace-nowrap" style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))", border: "1px solid hsl(var(--primary) / 0.3)" }}>
                    준{buildYearShort}
                  </span>
                )}
                {(vacancyM === "공실" || vacatePast) && (
                  <span className="flex-shrink-0 text-[10px] font-extrabold px-1 py-0.5 rounded whitespace-nowrap" style={{ background: "hsl(142 70% 93%)", color: "hsl(142 60% 30%)", border: "1px solid hsl(142 60% 70%)" }}>
                    공실
                  </span>
                )}
                {earlyExit && !(isMobile && limitAddress) && (
                  <span className="flex-shrink-0 text-[10px] font-extrabold px-1 py-0.5 rounded whitespace-nowrap" style={{ background: "hsl(0 85% 95%)", color: "hsl(0 85% 35%)", border: "1px solid hsl(0 85% 70%)" }}>
                    중도퇴거
                  </span>
                )}
                {vacancyM === "세입자 거주중" && !vacatePast && (
                  <span className="flex-shrink-0 text-[10px] font-extrabold px-1 py-0.5 rounded whitespace-nowrap" style={{ background: "hsl(38 95% 92%)", color: "hsl(25 90% 40%)", border: "1px solid hsl(38 80% 65%)" }}>
                    거주중
                  </span>
                )}
                {hasDuplexM && !(isMobile && limitAddress) && (
                  <span className="flex-shrink-0 text-[10px] font-extrabold px-1 py-0.5 rounded whitespace-nowrap" style={{ background: "hsl(270 80% 94%)", color: "hsl(270 70% 40%)", border: "1px solid hsl(270 70% 70%)" }}>
                    복층
                  </span>
                )}
                {isShortTerm && !(isMobile && limitAddress) && (
                  <span className="flex-shrink-0 text-[10px] font-extrabold px-1 py-0.5 rounded whitespace-nowrap" style={{ background: "hsl(217 91% 93%)", color: "hsl(217 91% 35%)", border: "1px solid hsl(217 91% 65%)" }}>
                    단기
                  </span>
                )}
                {hasKeyMoney && !(isMobile && limitAddress) && (
                  <span className="flex-shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded whitespace-nowrap" style={{ background: "hsl(25 90% 95%)", color: "hsl(25 90% 40%)", border: "1px solid hsl(25 90% 70%)" }}>
                    권 {keyMoney}
                  </span>
                )}

                {!(isMobile && limitAddress) && facilityBadges}
              </div>
              <span className="flex-1" />
              {/* 퇴거예정일은 모바일 3행에서 제거 — 카드 선택 시 하단 액션 패널의 소유주 아래에 표시 */}
              {opts.length > 0 && !(isMobile && limitAddress) && (
                <>
                  <div className="relative flex-shrink-0" onClick={(e) => { e.stopPropagation(); setShowOptPopup((v) => !v); }}>
                    {isFull ? (
                      <span className="flex items-center gap-0.5 text-[10px] font-extrabold px-1.5 py-0.5 rounded whitespace-nowrap select-none" style={{ background: "linear-gradient(90deg, hsl(38 95% 88%), hsl(45 100% 82%))", color: "hsl(28 80% 35%)", border: "1.5px solid hsl(38 80% 70%)" }}>
                        풀옵션
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded whitespace-nowrap select-none" style={{ background: "hsl(var(--muted))", color: "hsl(var(--foreground)/0.65)", border: "1.5px solid hsl(var(--border))" }}>
                        옵션 ▾
                      </span>
                    )}
                  </div>
                  {showOptPopup && createPortal(
                    <div
                      className="fixed inset-x-0 top-0 bottom-[calc(86px+env(safe-area-inset-bottom,0px))] sm:inset-0 z-[10400] flex items-end sm:items-center justify-center bg-black/40"
                      onClick={(e) => { e.stopPropagation(); setShowOptPopup(false); }}
                    >
                      <div
                        className="bg-white rounded-2xl shadow-2xl p-4 w-[calc(100%-16px)] sm:w-auto sm:max-w-md max-h-[calc(100dvh-130px)] sm:max-h-[80dvh] overflow-y-auto mb-2 sm:mb-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="text-xs font-extrabold mb-2 pb-1.5 border-b border-border" style={{ color: "hsl(var(--primary))" }}>
                          {isFull ? "풀옵션 구성" : `옵션 항목 (${opts.length}개)`}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5">
                          {opts.map((opt) => (
                            <span key={opt} className="text-[12px] font-semibold text-foreground whitespace-nowrap">· {opt}</span>
                          ))}
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}

                </>
              )}
              {isMobile && limitAddress && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent("open-guest-partner", {
                      detail: {
                        propertyDbId: prop.dbId,
                        propertyRegNo: prop.regNo,
                        agentUserId: prop.registeredBy,
                        propertyTitle: addressToDong(prop.address) + (prop.type ? ` ${prop.type}` : ""),
                      },
                    }));
                  }}
                  className="ml-auto flex-shrink-0 px-1.5 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap border"
                  style={{ background: "white", color: "hsl(var(--primary))", borderColor: "hsl(var(--primary)/0.5)" }}
                >
                  협력 공인중개사

                </button>
              )}
            </div>
            );
          })()}
          {showVacateInfo && (vacateLabel || earlyExit) && (
            <div
              className="fixed inset-0 z-[10300] flex items-end justify-center"
              onClick={(e) => { e.stopPropagation(); setShowVacateInfo(false); }}
            >
              <div className="absolute inset-0 bg-black/40" />
              <div
                className="relative w-full bg-white rounded-t-2xl shadow-2xl p-4 pb-6 max-w-md animate-in slide-in-from-bottom"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-extrabold text-foreground">퇴거 정보</h3>
                  <button
                    type="button"
                    onClick={() => setShowVacateInfo(false)}
                    className="text-[12px] font-bold text-muted-foreground px-2 py-1 rounded hover:bg-muted"
                  >
                    닫기 ✕
                  </button>
                </div>
                <div className="space-y-2.5">
                  {prop.vacateDate && !vacatePast && (
                    <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "hsl(0 85% 96%)", border: "1px solid hsl(0 85% 80%)" }}>
                      <span className="text-[13px] font-bold" style={{ color: "hsl(0 85% 35%)" }}>퇴거 예정일</span>
                      <span className="text-[14px] font-extrabold" style={{ color: "hsl(0 85% 35%)" }}>{prop.vacateDate}</span>
                    </div>
                  )}
                  {earlyExit && (
                    <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "hsl(0 85% 96%)", border: "1px solid hsl(0 85% 80%)" }}>
                      <span className="text-[13px] font-bold" style={{ color: "hsl(0 85% 35%)" }}>세입자 중도퇴거</span>
                      <span className="text-[14px] font-extrabold" style={{ color: "hsl(0 85% 35%)" }}>가능</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex-1 min-w-0 flex flex-col md:border-l md:border-border/30 px-2 py-1 gap-0.5">
        {/* 1줄: 준YYYY | 건물명 | 주소(토글) | 로드뷰 → 확인/등록 */}
        <div className="flex items-center gap-1 overflow-hidden flex-nowrap min-h-[22px]">
          {prop.buildYear && (
            <span
              className="flex-shrink-0 text-[10px] font-black px-1 py-0.5 whitespace-nowrap rounded"
              style={{
                background: "hsl(var(--primary) / 0.12)",
                color: "hsl(var(--primary))",
                border: "1px solid hsl(var(--primary) / 0.3)",
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              준{prop.buildYear.replace(/[^0-9]/g, "").slice(0, 4)}
            </span>
          )}
          {!isGuest && (
            <p className="text-[13px] font-extrabold text-foreground truncate leading-none flex-shrink min-w-0">
              {prop.buildingName ?? prop.title}
            </p>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!limitAddress) setShowFullAddr((v) => !v);
            }}
            className="text-[12px] font-semibold whitespace-nowrap flex-shrink-0 transition-colors underline decoration-dotted underline-offset-2"
            style={{ color: limitAddress ? "#000" : (showFullAddr ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))") }}
            title={limitAddress ? "로그인 후 상세 주소 확인" : "클릭하면 전체 주소 표시"}
          >
            {limitAddress ? guGuDong(prop.address) : (showFullAddr ? prop.address : shortAddress(prop.address))}
          </button>
          {/* 게스트/일반회원 버튼은 우측 확인/등록 위치에 표시 */}
          {/* 로드뷰 버튼 (게스트 숨김) */}
          {!isGuest && (
            <button
              type="button"
              onClick={handleRoadviewOpen}
              className="flex-shrink-0 px-1 py-0.5 rounded text-[9px] font-bold border transition-colors hover:bg-primary/10 whitespace-nowrap"
              style={{ color: "hsl(var(--primary))", borderColor: "hsl(var(--primary)/0.3)" }}
            >
              로드뷰
            </button>
          )}
          {/* 도로명 버튼 (hover 시 도로명주소 표시) */}
          {!isGuest && prop.roadAddress && (
            <span
              className="flex-shrink-0 px-1 py-0.5 rounded text-[9px] font-bold border transition-colors hover:bg-primary/10 whitespace-nowrap relative group/road cursor-default"
              style={{ color: "hsl(var(--primary))", borderColor: "hsl(var(--primary)/0.3)" }}
              title={prop.roadAddress}
            >
              도로명
              <span className="absolute left-0 bottom-full mb-1 hidden group-hover/road:block bg-foreground text-background text-[10px] font-medium px-2 py-1 rounded shadow-lg whitespace-nowrap z-50">
                {prop.roadAddress}
              </span>
            </span>
          )}
          <span className="flex-1" />
          {!isMobile && limitAddress && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent("open-guest-detail", {
                    detail: {
                      info: {
                        image: prop.images?.[0] || prop.image,
                        address: prop.address,
                        type: prop.type,
                        area: prop.area,
                        floor: prop.floor,
                        deposit: prop.deposit,
                        monthly: prop.monthly,
                        regNo: prop.regNo,
                        buildYear: prop.buildYear,
                          dbId: prop.dbId,
                      },
                      partnerDetail: {
                        propertyDbId: prop.dbId,
                        propertyRegNo: prop.regNo,
                        agentUserId: prop.registeredBy,
                        propertyTitle: addressToDong(prop.address) + (prop.type ? ` ${prop.type}` : ""),
                      },
                    },
                  }));
                }}
                className="flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all hover:opacity-90 whitespace-nowrap border"
                style={{ background: "white", color: "hsl(var(--primary))", borderColor: "hsl(var(--primary)/0.5)" }}
              >
                상세보기
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent("open-guest-inquiry", {
                    detail: {
                      propertyDbId: prop.dbId,
                      propertyRegNo: prop.regNo,
                      agentUserId: prop.registeredBy,
                      propertyTitle: addressToDong(prop.address) + (prop.type ? ` ${prop.type}` : ""),
                    },
                  }));
                }}
                className="flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all hover:opacity-90 whitespace-nowrap"
                style={{ background: "hsl(var(--primary))", color: "white" }}
              >
                문의하기
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent("open-guest-partner", {
                    detail: {
                      propertyDbId: prop.dbId,
                      propertyRegNo: prop.regNo,
                      agentUserId: prop.registeredBy,
                      propertyTitle: addressToDong(prop.address) + (prop.type ? ` ${prop.type}` : ""),
                    },
                  }));
                }}
                className="flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all hover:opacity-90 whitespace-nowrap"
                style={{ background: "white", color: "hsl(var(--primary))", border: "1px solid hsl(var(--primary)/0.5)" }}
              >
                협력 공인중개사
              </button>
            </>
          )}
          <MemoNotepad
            propertyDbId={prop.dbId || (prop.memo && prop.memo.length === 36 ? prop.memo : undefined)}
            propId={prop.id}
            memoKey="building"
            icon={<img src={memoIcon} alt="건물메모" className="w-3.5 h-3.5 object-contain" style={{ imageRendering: '-webkit-optimize-contrast' as any }} />}
            label="건물메모"
            initialText={buildingMemo ?? ""}
            userId={userId}
            isAdmin={isAdmin}
          />
          <MemoNotepad
            propertyDbId={prop.dbId || (prop.memo && prop.memo.length === 36 ? prop.memo : undefined)}
            propId={prop.id}
            memoKey="room"
            icon={<img src={memoIcon} alt="방메모" className="w-3.5 h-3.5 object-contain" style={{ imageRendering: '-webkit-optimize-contrast' as any }} />}
            label="방메모"
            initialText={roomMemo ?? ""}
            userId={userId}
            isAdmin={isAdmin}
          />
          {/* 확인 체크박스 — 확인일 기준 경과일(D+N) 자동 표시 (모든 회원에게 표시, 수정은 관리자만) */}
          {
            prop.memo &&
            (() => {
              // 확인일(chkDate) 기준 경과일
              const daysSince = chkDate ? Math.floor((Date.now() - new Date(chkDate).getTime()) / 86400000) : null;
              // 등록일(regDate) 기준 경과일
              const daysFromReg = regDate ? Math.floor((Date.now() - new Date(regDate).getTime()) / 86400000) : null;
              // 경과일: 확인일 있으면 확인일 기준, 없으면 등록일 기준
              const displayDays = daysSince ?? daysFromReg;
              return (
                <button
                  type="button"
                  title={
                    isChecked
                      ? `확인: ${chkDate} (확인 후 ${daysSince}일) | 등록: ${regDate}`
                      : `등록: ${regDate} (${daysFromReg}일 경과) — 클릭하여 확인 완료 표시`
                  }
                  onClick={handleCheckToggle}
                  disabled={checking || !isAdmin}
                  className="flex-shrink-0 flex items-center gap-0.5 px-1 py-0.5 rounded transition-all select-none"
                  style={{
                    background: isChecked ? "hsl(142 70% 93%)" : "hsl(var(--muted))",
                    border: `1.5px solid ${isChecked ? "hsl(142 60% 65%)" : "hsl(var(--border))"}`,
                    opacity: checking ? 0.5 : 1,
                    cursor: isAdmin ? "pointer" : "default",
                  }}
                >
                  <img 
                      src={checkDateIcon} 
                      alt="확인" 
                      className="w-5 h-5 object-contain" 
                      style={{ imageRendering: '-webkit-optimize-contrast' as any, opacity: isChecked ? 1 : 0.4 }} 
                    />
                  {/* 확인일 기준 경과일 (D+N), 없으면 등록일 기준 */}
                  <span
                    className="text-[10px] font-black whitespace-nowrap tabular-nums"
                    style={{ color: isChecked ? "hsl(142 60% 30%)" : "hsl(var(--muted-foreground))" }}
                  >
                    {displayDays !== null ? displayDays : "?"}
                  </span>
                </button>
              );
            })()}
        </div>


        {/* 2줄: [세부유형 (층) 호수] | 보증금/월세 관리비 몇평 | 옵션 | 비번 */}
        <div className="flex items-center gap-0.5 flex-wrap min-h-[22px]">
          {/* 남향 뱃지 */}
          {prop.note && /남향|북향|동향|서향/.test(prop.note) && (
            <span
              className="flex-shrink-0 text-[10px] font-bold px-1 py-0.5 rounded whitespace-nowrap"
              style={{ background: "#fff3e0", color: "#e65100", border: "1px solid #ffcc80" }}
            >
              {prop.note.match(/[남북동서]향/)?.[0]}
            </span>
          )}
          {/* ① 유형 + 층 + 동 + 호수를 하나의 네모칸에 */}
          {(prop.type || floorShort || prop.unitNumber) && (
            <span
              className="flex-shrink-0 flex items-center gap-0.5 text-[12px] font-extrabold px-1.5 py-0.5 rounded whitespace-nowrap"
              style={{
                background: isDealCompleted ? "hsl(0 80% 95%)" : "hsl(var(--primary)/0.1)",
                color: isDealCompleted ? "hsl(0 70% 50%)" : "hsl(var(--primary))",
                border: `1.5px solid ${isDealCompleted ? "hsl(0 70% 70%)" : "hsl(var(--primary)/0.35)"}`,
                textDecoration: isDealCompleted ? "line-through" : "none",
                textDecorationColor: isDealCompleted ? "hsl(0 80% 50%)" : undefined,
                textDecorationThickness: isDealCompleted ? "2px" : undefined,
              }}
            >
              {prop.type && <span>{prop.type}</span>}
              {prop.type === "원룸" && (prop.roomType === "오픈형" || prop.roomType === "분리형") && (
                <span className="opacity-90">·{prop.roomType}</span>
              )}
              {prop.roomType && prop.roomType.includes(",") && Array.from(new Set(prop.roomType.split(",").map((s) => s.trim()).filter((s) => s && s !== prop.type && s !== "오픈형" && s !== "분리형"))).map((s) => (
                <span key={s} className="opacity-90">·{s}</span>
              ))}
              {floorShort && <span className="opacity-80">({floorShort})</span>}
              {(() => {
                const m = (prop.note ?? "").match(/동\(棟\)[:\s]+([^\n|]+)/);
                return m ? <span className="opacity-80">{m[1].trim()}</span> : null;
              })()}
              {!isGuest && prop.unitNumber && <span>{prop.unitNumber}</span>}
            </span>
          )}
          {/* 카카오톡 공유 아이콘 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              sharePropertyToKakao(prop, agencyInfo, fallbackImage);
            }}
            title="카카오톡 공유"
            className="flex-shrink-0 flex items-center justify-center transition-colors"
          >
            <img src={kakaoTalkIcon} alt="카카오톡 공유" className="w-10 h-10 object-contain" />
          </button>
          {/* 구분선 */}
          {(prop.type || floorShort || prop.unitNumber) && <span className="flex-shrink-0 w-px h-3.5 bg-border" />}
          {/* ④ 보증금/월세/관리비/평수 — 텍스트 스타일 (박스 없음) */}
          {(() => {
            const note = prop.note ?? "";
            const wolseMatch = note.match(/월세: 보증금 ([^\n/]+)만원 \/ 월세 ([^\n]+)만원/);
            const halfMatch = note.match(/반전세: 보증금 ([^\n/]+)만원 \/ 월세 ([^\n]+)만원/);
            const jeonseMatch = note.match(/(?<!반)전세: 보증금 ([^\n]+)만원/);
            const hasMulti = wolseMatch || halfMatch || jeonseMatch;

            if (hasMulti) {
              return (
                <div className="flex items-center gap-1 flex-shrink-0" style={isDealCompleted ? { textDecoration: "line-through", textDecorationColor: "hsl(0 80% 50%)", textDecorationThickness: "2px" } : undefined}>
                  {wolseMatch && (
                    <span
                      className="flex-shrink-0 text-[12px] font-extrabold whitespace-nowrap"
                      style={{ color: "hsl(var(--foreground))" }}
                    >
                      <span style={{ color: "hsl(var(--muted-foreground))" }}>월</span> {wolseMatch[1]}/
                      <span style={neonGradientTextStyle}>{wolseMatch[2]}</span>
                      {prop.manageFee && prop.manageFee !== "0" && prop.manageFee !== "-" && (
                        <span style={{ color: "hsl(var(--muted-foreground))" }}>
                          {" "}/ 관 {prop.manageFee}
                        </span>
                      )}
                    </span>
                  )}
                  {halfMatch && (
                    <span
                      className="flex-shrink-0 text-[12px] font-extrabold whitespace-nowrap"
                      style={{ color: "#1d4ed8" }}
                    >
                      반{halfMatch[1]}/{halfMatch[2]}
                      {prop.manageFee && prop.manageFee !== "0" && prop.manageFee !== "-" && (
                        <span style={{ color: "hsl(var(--muted-foreground))" }}>
                          {" "}/ 관 {prop.manageFee}
                        </span>
                      )}
                    </span>
                  )}
                  {jeonseMatch && (
                    <span
                      className="flex-shrink-0 text-[12px] font-extrabold whitespace-nowrap"
                      style={{ color: "#15803d" }}
                    >
                      전{jeonseMatch[1]}
                      {prop.manageFee && prop.manageFee !== "0" && prop.manageFee !== "-" && (
                        <span style={{ color: "hsl(var(--muted-foreground))" }}>
                          {" "}/ 관 {prop.manageFee}
                        </span>
                      )}
                    </span>
                  )}
                  {areaShort && (
                    <>
                      <span className="text-[11px]" style={{ color: "hsl(var(--border))" }}>
                        ·
                      </span>
                      <span className="text-[11px] font-extrabold" style={{ color: "hsl(25 90% 40%)" }}>
                        {areaShort}
                      </span>
                    </>
                  )}
                </div>
              );
            }

            // 매매 여부 판별: note에 매매가 포함되거나 monthly가 비어있고 deposit이 있는 경우
            const isSaleProp = note.includes("매매가:") || (!prop.monthly && !!prop.deposit);
            return (
              <span className="flex-shrink-0 flex items-center gap-0.5 whitespace-nowrap" style={isDealCompleted ? { textDecoration: "line-through", textDecorationColor: "hsl(0 80% 50%)", textDecorationThickness: "2px" } : undefined}>
                {isSaleProp ? (
                  <>
                    <span className="text-[11px] font-bold" style={{ color: "hsl(0 85% 55%)" }}>
                      매
                    </span>
                    <span className="text-[12px] font-extrabold" style={{ color: "hsl(0 85% 45%)" }}>
                      {prop.deposit}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] font-bold" style={{ color: "hsl(var(--muted-foreground))" }}>
                      월
                    </span>
                    <span className="text-[12px] font-extrabold" style={{ color: "hsl(var(--foreground))" }}>
                      {prop.deposit}
                    </span>
                    <span className="text-[11px]" style={{ color: "hsl(var(--border))" }}>
                      /
                    </span>
                    <span className="text-[12px] font-extrabold" style={neonGradientTextStyle}>
                      {prop.monthly}
                    </span>
                    {prop.manageFee && prop.manageFee !== "0" && prop.manageFee !== "-" && (
                      <>
                        <span className="text-[11px] mx-0.5" style={{ color: "hsl(var(--border))" }}>
                          /
                        </span>
                        <span className="text-[11px] font-bold" style={{ color: "hsl(var(--muted-foreground))" }}>
                          관
                        </span>
                        <span className="text-[11px] font-extrabold" style={{ color: "hsl(var(--muted-foreground))" }}>
                          {prop.manageFee}
                        </span>
                      </>
                    )}
                  </>
                )}
                {areaShort && (
                  <>
                    <span className="text-[11px] mx-0.5" style={{ color: "hsl(var(--border))" }}>
                      ·
                    </span>
                    <span className="text-[11px] font-extrabold" style={{ color: "hsl(25 90% 40%)" }}>
                      {areaShort}
                    </span>
                  </>
                )}
              </span>
            );
          })()}
          {/* 권리금 표시 (note에 "권리금: XXX" 저장됨) */}
          {(() => {
            const note = prop.note ?? "";
            const m = note.match(/권리금:\s*([^\n|]+)/);
            const v = m?.[1]?.trim();
            if (!v || v === "0" || v === "없음") return null;
            return (
              <span className="flex-shrink-0 inline-flex items-center gap-0.5 whitespace-nowrap text-[11px] font-extrabold" style={{ color: "hsl(25 90% 45%)" }}>
                <span style={{ color: "hsl(var(--border))" }} className="mx-0.5">·</span>
                권 {v}
              </span>
            );
          })()}
          {/* ⑨ 매매 타입 — 대지·건평 명시 태그 */}
          {(() => {
            const isSale = prop.type?.includes("매매");
            if (!isSale) return null;
            const note = prop.note ?? "";
            const landM = note.match(/대지[:\s]+([^\n|]+)/);
            const bldgM = note.match(/건평[:\s]+([^\n|]+)/);
            const landV = landM ? landM[1].trim() : null;
            const bldgV = bldgM ? bldgM[1].trim() : null;
            if (!landV && !bldgV) return null;
            return (
              <>
                <span className="flex-shrink-0 w-px h-3.5 bg-border" />
                {landV && (
                  <span
                    className="flex-shrink-0 flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
                    style={{
                      background: "hsl(142 60% 93%)",
                      color: "hsl(142 50% 30%)",
                      border: "1px solid hsl(142 50% 75%)",
                    }}
                  >
                    <span className="text-[10px] font-bold opacity-70">대지</span>
                    {landV}
                  </span>
                )}
                {bldgV && (
                  <span
                    className="flex-shrink-0 flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
                    style={{
                      background: "hsl(217 80% 93%)",
                      color: "hsl(217 60% 35%)",
                      border: "1px solid hsl(217 60% 75%)",
                    }}
                  >
                    <span className="text-[10px] font-bold opacity-70">건평</span>
                    {bldgV}
                  </span>
                )}
              </>
            );
          })()}
          <span className="flex-1" />
          {/* 아이콘 배지 (컴팩트, 인라인 — 옵션 앞) */}
          {(() => {
            const badges: JSX.Element[] = [];
            const opts = prop.options ?? [];
            const normalizedOpts = new Set(opts.map((opt) => String(opt).replace(/\s+/g, "").toLowerCase()));
            const hasOption = (...candidates: string[]) => candidates.some((c) => normalizedOpts.has(c.replace(/\s+/g, "").toLowerCase()));
            const iconCls = "flex-shrink-0 flex items-center justify-center w-6 h-6 rounded select-none";
            const imgCls = "w-5 h-5 object-contain";
            const imgStyle = { imageRendering: '-webkit-optimize-contrast' as any };

            if (prop.elevator || hasOption("엘리베이터"))
              badges.push(<span key="elevator" title="엘리베이터" className={iconCls} style={{ background: "#e0f2fe", border: "1px solid #7dd3fc" }}><img src={elevatorIcon} alt="엘리베이터" className={imgCls} style={imgStyle} /></span>);

            const petImg = <img src={petIcon} alt="반려동물" className={imgCls} style={imgStyle} />;
            if (hasOption("반려동물불가", "애완동물불가", "반려동물_불가")) {
              badges.push(
                <span key="pet-deny" title="반려동물 불가" className={`${iconCls} relative`} style={{ background: "#fef2f2", border: "1px solid #fca5a5" }}>
                  {petImg}
                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <svg width="20" height="20" viewBox="0 0 20 20"><line x1="3" y1="3" x2="17" y2="17" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" /></svg>
                  </span>
                </span>,
              );
            } else if (hasOption("반려동물가능", "애완동물가능", "반려동물_가능")) {
              badges.push(<span key="pet-ok" title="반려동물 가능" className={iconCls} style={{ background: "#fff7ed", border: "1px solid #fdba74" }}>{petImg}</span>);
            }

            const entries: [string, { src: string; alt: string; bg: string; border: string }][] = [
              ["수도", { src: waterIcon, alt: "수도", bg: "#eff6ff", border: "#93c5fd" }],
              ["인터넷", { src: internetIcon, alt: "인터넷", bg: "#f0fdf4", border: "#86efac" }],
              ["유선TV", { src: tvIcon, alt: "유선TV", bg: "#faf5ff", border: "#d8b4fe" }],
              ["CCTV", { src: cctvIcon, alt: "CCTV", bg: "#fef2f2", border: "#fca5a5" }],
              ["리모델링", { src: remodelingIcon, alt: "리모델링", bg: "#fff7ed", border: "#fdba74" }],
              ["여성전용", { src: femaleOnlyIcon, alt: "여성전용", bg: "#fdf2f8", border: "#f9a8d4" }],
            ];
            entries.forEach(([opt, d]) => {
              if (!hasOption(opt)) return;
              badges.push(<span key={opt} title={d.alt} className={iconCls} style={{ background: d.bg, border: `1px solid ${d.border}` }}><img src={d.src} alt={d.alt} className={imgCls} style={imgStyle} /></span>);
            });

            return badges;
          })()}
          {/* ⑦-b 옵션 텍스트 배지 — 호버 시 상세 목록 팝업 */}
          {prop.options &&
            prop.options.length > 0 &&
            (() => {
              const FULL_OPT = ["냉장고", "세탁기", "에어컨", "TV", "전자레인지", "인터넷", "가스레인지", "수도"];
              const isFull = prop.options!.includes("풀옵션") || FULL_OPT.every((o) => prop.options!.includes(o));
              return (
                <div
                  ref={optBadgeRef}
                  className="relative flex-shrink-0"
                  onMouseEnter={handleOptMouseEnter}
                  onMouseLeave={handleOptMouseLeave}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (showOptPopup) { setShowOptPopup(false); }
                    else { handleOptMouseEnter(); }
                  }}
                >
                  {isFull ? (
                    <span
                      className="flex items-center gap-0.5 text-[10px] font-extrabold px-1.5 py-0.5 rounded whitespace-nowrap cursor-default select-none"
                      style={{
                        background: "linear-gradient(90deg, hsl(38 95% 88%), hsl(45 100% 82%))",
                        color: "hsl(28 80% 35%)",
                        border: "1.5px solid hsl(38 80% 70%)",
                      }}
                    >
                      풀옵션
                    </span>
                  ) : (
                    <span
                      className="text-[10px] font-extrabold px-1.5 py-0.5 rounded whitespace-nowrap cursor-default select-none"
                      style={{
                        background: "hsl(var(--muted))",
                        color: "hsl(var(--foreground)/0.65)",
                        border: "1.5px solid hsl(var(--border))",
                      }}
                    >
                      {`옵션 ▾`}
                    </span>
                  )}
                  {/* 호버 팝업 — fixed로 overflow:hidden 탈출, 화면 경계 감지 */}
                  {showOptPopup && (
                    <div
                      className="fixed z-[9999] bg-white border border-border rounded-xl shadow-xl p-2.5"
                      style={{
                        ...optPopupStyle,
                        minWidth: "160px",
                        maxWidth: "220px",
                        boxShadow: "0 4px 20px hsl(var(--primary)/0.15)",
                      }}
                      onMouseEnter={() => setShowOptPopup(true)}
                      onMouseLeave={handleOptMouseLeave}
                    >
                      <p
                        className="text-[10px] font-extrabold mb-1.5 pb-1 border-b border-border"
                        style={{ color: "hsl(var(--primary))" }}
                      >
                        {isFull ? "풀옵션 구성" : `옵션 항목 (${prop.options!.length}개)`}
                      </p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        {(() => {
                          const seen = new Set<string>();
                          const list: string[] = [];
                          prop.options!.forEach((o) => {
                            const label = normalizeDisplayOption(o);
                            if (seen.has(label)) return;
                            seen.add(label);
                            list.push(label);
                          });
                          return list.map((opt) => (
                            <span key={opt} className="text-[11px] font-semibold text-foreground whitespace-nowrap">
                              · {opt}
                            </span>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
        </div>

        {/* 3줄: 방향·공실·LH·청소비·중개보수 + 특이사항 */}
        {(() => {
          const note = prop.note ?? "";
          const dirMatch = note.match(/방향[:\s]+([^\n|]+)/);
          const lhMatch = note.match(/LH[:\s]+([^\n|]+)/);
          const cleanMatch = note.match(/청소비[:\s]+([^\n|]+)/);
          const brokerMatch = note.match(/중개보수[:\s]+([^\n|]+)/);
          const direction = dirMatch?.[1]?.trim();
          const lhVal = lhMatch?.[1]?.trim();
          const cleanFee = cleanMatch?.[1]?.trim();
          const brokerFee = brokerMatch?.[1]?.trim();
          // 공실 여부: 임대 타입만 표시 (매매 제외)
          const isSalePropCard = prop.type?.includes("매매");
          const hasDuplex = (prop.options ?? []).includes("복층");
          const hasShortTerm = !isSalePropCard && (prop.options ?? []).includes("단기가능");
          const vacateStatus = (() => {
            if (!prop.vacateDate) return null;
            const vacateStr = prop.vacateDate.replace(/[^0-9\-\/\.]/g, "").replace(/\./g, "-").replace(/\//g, "-");
            const vacateTime = new Date(vacateStr).getTime();
            return !isNaN(vacateTime) && vacateTime < Date.now() ? "공실" : null;
          })();
          const vacateDateLabel = vacateStatus === "공실" ? null : prop.vacateDate?.trim();
          const vacancy = !isSalePropCard
            ? (vacateStatus ?? ((prop.availableFrom === "공실" || prop.availableFrom === "세입자 거주중") ? prop.availableFrom : null))
            : null;

          const chips: { label: string; value: string; bg: string; color: string; border: string }[] = [];
          if (vacancy)
            chips.push({
              label: vacancy === "공실" ? "공실" : vacancy === "세입자 거주중" ? "거주중" : vacancy,
              value: "",
              bg: vacancy === "공실" ? "hsl(142 70% 93%)" : vacancy === "세입자 거주중" ? "hsl(38 95% 92%)" : "hsl(0 85% 93%)",
              color: vacancy === "공실" ? "hsl(142 60% 30%)" : vacancy === "세입자 거주중" ? "hsl(25 90% 40%)" : "hsl(0 85% 35%)",
              border: vacancy === "공실" ? "hsl(142 60% 70%)" : vacancy === "세입자 거주중" ? "hsl(38 80% 65%)" : "hsl(0 85% 65%)",
            });
          // 복층 배지 — 공실 바로 오른쪽에 우선 배치
          if (hasDuplex)
            chips.push({
              label: "복층",
              value: "",
              bg: "hsl(270 80% 94%)",
              color: "hsl(270 70% 40%)",
              border: "hsl(270 70% 70%)",
            });
          // 단기가능 배지
          if (hasShortTerm)
            chips.push({
              label: "단기",
              value: "",
              bg: "hsl(217 91% 93%)",
              color: "hsl(217 91% 35%)",
              border: "hsl(217 91% 65%)",
            });
          if (direction)
            chips.push({ label: direction + "향", value: "", bg: "#fff3e0", color: "#e65100", border: "#ffcc80" });
          if (lhVal && lhVal !== "관계없음")
            chips.push({
              label: lhVal,
              value: "",
              bg: lhVal === "LH가능" ? "hsl(217 91% 93%)" : "hsl(0 85% 93%)",
              color: lhVal === "LH가능" ? "hsl(217 91% 40%)" : "hsl(0 85% 45%)",
              border: lhVal === "LH가능" ? "hsl(217 91% 70%)" : "hsl(0 85% 70%)",
            });
          if (cleanFee)
            chips.push({
              label: `청소비 ${cleanFee}만`,
              value: "",
              bg: "hsl(var(--muted))",
              color: "hsl(var(--muted-foreground))",
              border: "hsl(var(--border))",
            });
          if (brokerFee)
            chips.push({
              label: `수수료 ${brokerFee}`,
              value: "",
              bg: "hsl(0 85% 93%)",
              color: "hsl(0 85% 45%)",
              border: "hsl(0 85% 70%)",
            });
          // 중도퇴거 여부
          const earlyExit = note.includes("중도퇴거:");
          if (earlyExit)
            chips.push({
              label: "중도퇴거",
              value: "",
              bg: "hsl(0 85% 93%)",
              color: "hsl(0 85% 40%)",
              border: "hsl(0 85% 70%)",
            });
          // 리모델링 배지
          if ((prop.options ?? []).some(o => o === "리모델링"))
            chips.push({
              label: "리모델링",
              value: "",
              bg: "hsl(30 100% 95%)",
              color: "hsl(20 90% 35%)",
              border: "hsl(30 80% 65%)",
            });
          const hasChips = chips.length > 0;
          const hasDesc = !!prop.description?.trim();

          if (!hasChips && !(hasDesc && !isGuest) && !(buildingPw && !isGuest) && !(roomPw && !isGuest) && !vacateDateLabel) return null;
          return (
            <div className="flex items-center gap-1 min-h-[17px] flex-wrap">
              {/* 왼쪽: 칩들과 특이사항 */}
              {chips.map((chip, i) => (
                <span
                  key={i}
                  className="flex-shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded whitespace-nowrap"
                  style={{ background: chip.bg, color: chip.color, border: `1px solid ${chip.border}` }}
                >
                  {chip.label}
                </span>
              ))}
              {!isGuest && hasDesc && (
                <>
                  {hasChips && <span className="flex-shrink-0 w-px h-3 bg-border" />}
                  <span
                    className="flex-shrink-0 text-[11px] font-extrabold whitespace-nowrap"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  >
                    특이
                  </span>
                  <span
                    className="text-[11px] font-extrabold leading-tight truncate"
                    style={{ color: "hsl(var(--foreground))" }}
                  >
                    {prop.description!.length > 40 ? prop.description!.slice(0, 40) + "…" : prop.description}
                  </span>
                </>
              )}

              {/* 우측 정렬을 위한 스페이서 */}
              <span className="flex-1" />

              {/* 오른쪽: 퇴거예정일 · 비밀번호 */}
              {vacateDateLabel && (
                <span
                  className="flex-shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded whitespace-nowrap"
                  style={{ background: "hsl(var(--destructive) / 0.08)", color: "hsl(var(--destructive))", border: "1px solid hsl(var(--destructive) / 0.35)" }}
                >
                  퇴거 {vacateDateLabel}
                </span>
              )}
              {!isGuest && (buildingPw || roomPw) && (
                <>
                  {buildingPw && (
                    <div className="relative group/bpw flex-shrink-0">
                      <span
                        className="text-[11px] font-bold whitespace-nowrap px-1.5 py-0.5 rounded cursor-default select-none tracking-wide"
                        style={{ background: "hsl(220 25% 93%)", color: "hsl(220 45% 32%)", border: "1.5px solid hsl(220 25% 80%)", fontFamily: "'Pretendard', sans-serif", letterSpacing: "0.04em" }}
                      >
                        건 {buildingPw}
                      </span>
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-[9999] opacity-0 group-hover/bpw:opacity-100 transition-opacity duration-150 whitespace-nowrap">
                        <div className="text-[10px] font-bold px-2 py-1 rounded-lg shadow-lg" style={{ background: "hsl(var(--foreground))", color: "hsl(var(--background))" }}>
                          🏢 건물 공동현관 비밀번호
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0" style={{ borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "4px solid hsl(var(--foreground))" }} />
                        </div>
                      </div>
                    </div>
                  )}
                  {roomPw && (
                    <div className="relative group/rpw flex-shrink-0">
                      <span
                        className="text-[11px] font-bold whitespace-nowrap px-1.5 py-0.5 rounded cursor-default select-none tracking-wide"
                        style={{ background: "hsl(var(--primary)/0.12)", color: "hsl(var(--primary))", border: "1.5px solid hsl(var(--primary)/0.4)", fontFamily: "'Pretendard', sans-serif", letterSpacing: "0.04em" }}
                      >
                        방 {roomPw}
                      </span>
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-[9999] opacity-0 group-hover/rpw:opacity-100 transition-opacity duration-150 whitespace-nowrap">
                        <div className="text-[10px] font-bold px-2 py-1 rounded-lg shadow-lg" style={{ background: "hsl(var(--foreground))", color: "hsl(var(--background))" }}>
                          🚪 방(호실) 도어락 비밀번호
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0" style={{ borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "4px solid hsl(var(--foreground))" }} />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}
      </div>
    );
  },
);

/* ── LandlordPhoneRow ── */
AddressToggleCard.displayName = "AddressToggleCard";

/* ── LandlordPhoneRow ── */
const LandlordPhoneRow = ({ phone, label }: { phone: string; label: string }) => {
  const isGuest = useIsGuest();
  if (isGuest) return null;
  const colorMap: Record<string, string> = {
    소유주: "hsl(var(--primary))",
    관리인: "hsl(217 91% 60%)",
    부동산: "hsl(25 95% 53%)",
  };
  const color = colorMap[label] ?? "hsl(var(--foreground))";
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <a
        href={`tel:${phone}`}
        className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg"
        style={{ color, background: `${color}18` }}
      >
        <Phone className="w-3 h-3" />
        {phone}
      </a>
    </div>
  );
};

/* ── MapSidebar ── */
interface MapSidebarProps {
  properties: MapProperty[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDeselect?: () => void;
  activeType: string;
  onTypeChange: (type: string) => void;
  query?: string;
  onQueryChange?: (v: string) => void;
  topOffset?: number;
  onDeleteProperties?: (ids: Set<number>) => void;
  /** 핀 클릭 시 해당 주소로 필터링 */
  pinnedAddress?: string | null;
  onClearPin?: () => void;
  /** 핀 클릭 순서대로 쌓인 id 배열 */
  pinnedIds?: number[];
  onClearPinnedIds?: () => void;
  /** 소유주 번호 검색 결과 */
  landlordResults?: import("@/components/MapFilterBar").LandlordResult[];
  landlordLoading?: boolean;
  landlordSearched?: boolean;
  onRefetch?: () => void;
  /** 참고용 사진 검색용 전체 매물 풀 (필터링 전) */
  referencePool?: MapProperty[];
  /** 현재 지도 영역 — 모바일 시트 매물 갯수 표시용 */
  currentBounds?: { swLat: number; swLng: number; neLat: number; neLng: number } | null;
}

const MAX_WIDTH = 700;
const FIXED_WIDTH = MAX_WIDTH;

const MapSidebar = ({
  properties,
  selectedId,
  onSelect,
  onDeselect,
  topOffset = 0,
  onDeleteProperties,
  pinnedAddress,
  onClearPin,
  pinnedIds,
  onClearPinnedIds,
  landlordResults,
  landlordLoading,
  landlordSearched,
  onRefetch,
  referencePool,
  currentBounds,
}: MapSidebarProps) => {
  const { isAdmin } = useAdminAuth();
  const { user: authUser } = useAuth();
  const isGuest = useIsGuest();
  const isMobile = useIsMobile();
  // 모바일 시트 단계: 0=닫힘(헤더만), 1=2/4(50%), 2=4/4(100%)
  // 매물정보 바를 누르면 0 → 1 → 2 → 0 순환
  const [mobileStep, setMobileStep] = useState<0 | 1 | 2>(0);
  const [mobileListLimit, setMobileListLimit] = useState(60);
  const [mobileClosing, setMobileClosing] = useState(false);
  const handleMobileClose = () => {
    // 시트만 닫고 선택된 매물 핀은 유지 (사용자 요청)
    setMobileClosing(true);
    setTimeout(() => {
      setMobileStep(0);
      setMobileClosing(false);
    }, 300);
  };
  const [adminEditProp, setAdminEditProp] = useState<MapProperty | null>(null);
  const width = FIXED_WIDTH;
  const [collapsed, setCollapsed] = useState(false);
  const [lightbox, setLightbox] = useState<{ units: LightboxUnit[]; unitIdx: number } | null>(null);
  const [photoUploadProp, setPhotoUploadProp] = useState<MapProperty | null>(null);
  const [leaseProposalProp, setLeaseProposalProp] = useState<MapProperty | null>(null);
  const [errorReportProp, setErrorReportProp] = useState<MapProperty | null>(null);
  const [dealCompleteProp, setDealCompleteProp] = useState<MapProperty | null>(null);
  const [mobileContactsProp, setMobileContactsProp] = useState<MapProperty | null>(null);
  const [expandedContactsId, setExpandedContactsId] = useState<number | null>(null);
  const [dealCompletedIds, setDealCompletedIds] = useState<Set<string>>(new Set());
  // 카드를 직접 클릭했을 때만 하단(액션 버튼 등)을 펼침. 지도 핀 클릭으로 선택된 경우는 펼치지 않음.
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
  useEffect(() => {
    // 외부(지도 핀)에서 selectedId가 변경되면 펼침 상태는 리셋
    setExpandedCardId((prev) => (prev === selectedId ? prev : null));
  }, [selectedId]);

  useEffect(() => {
    if (lightbox) window.dispatchEvent(new CustomEvent("contact-popup-open", { detail: "close-all" }));
  }, [lightbox]);

  // 기존 거래완료 제보 불러오기 — 매물이 active인 경우에만 취소선 표시
  useEffect(() => {
    const loadDealCompleted = async () => {
      const { data } = await supabase
        .from("property_reports")
        .select("property_id")
        .eq("report_type", "deal_complete")
        .neq("status", "rejected");
      if (data && data.length > 0) {
        // active 상태인 매물 중 거래완료 제보가 있는 것만 표시
        // → 재등록(active 복구) 시 관련 제보도 rejected 처리해야 취소선이 사라짐
        setDealCompletedIds(new Set(data.map((r) => r.property_id)));
      } else {
        setDealCompletedIds(new Set());
      }
    };
    loadDealCompleted();
  }, []);

  // 모바일: 매물 핀 선택만으로는 시트를 자동으로 펼치지 않음
  // (사용자가 매물 정보를 클릭하면 시트를 위로 올림 — 카드 onClick에서 처리)
  const listScrollRef = useRef<HTMLDivElement>(null);
  const [checkedDateOverrides, setCheckedDateOverrides] = useState<Record<number, string | null>>({});
  const [checkedDateBoosts, setCheckedDateBoosts] = useState<Record<number, number>>({});
  const handleCheckedDateUpdated = useCallback((propId: number, checkedDate: string | null) => {
    setCheckedDateOverrides((prev) => ({ ...prev, [propId]: checkedDate }));
    setCheckedDateBoosts((prev) => {
      const next = { ...prev };
      if (checkedDate) next[propId] = Date.now();
      else delete next[propId];
      return next;
    });
    onRefetch?.();
  }, [onRefetch]);
  const propertiesWithCheckedDates = useMemo(() => properties.map((p) => (
    Object.prototype.hasOwnProperty.call(checkedDateOverrides, p.id)
      ? { ...p, checkedDate: checkedDateOverrides[p.id] ?? undefined }
      : p
  )), [properties, checkedDateOverrides]);
  // 공유 시 사용할 중개사무소 정보
  const [myAgencyInfo, setMyAgencyInfo] = useState<AgencyInfo | undefined>(undefined);
  useEffect(() => {
    if (!authUser?.userId) { setMyAgencyInfo(undefined); return; }
    supabase
      .from("agent_profiles")
      .select("agency_name, name, phone, agency_phone, representative_name, agency_address, license_number")
      .eq("user_id", authUser.userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setMyAgencyInfo({ userId: authUser.userId, agencyName: data.agency_name, name: data.name, phone: data.phone, agencyPhone: data.agency_phone ?? "", representativeName: data.representative_name ?? "", agencyAddress: data.agency_address ?? "", licenseNumber: data.license_number ?? "" });
      });
  }, [authUser?.userId]);
  const { favorites, toggleFavorite } = useFavorites();
  const { enabled: favoritesOnly } = useFavoritesOnly();
  useEffect(() => {
    if (isMobile) setMobileListLimit(60);
  }, [isMobile, mobileStep, properties, pinnedIds, favoritesOnly]);
  // 중개회원/관리자용 선택 인쇄 체크박스 상태 (일반회원/게스트는 favorites를 그대로 사용)
  const isAgentForPrint = !isGuest && authUser?.memberType !== "일반회원";
  const [printCheckedIds, setPrintCheckedIds] = useState<Set<number>>(new Set());
  const checkedIds = isAgentForPrint ? printCheckedIds : favorites;
  const togglePrintChecked = (id: number) => {
    setPrintCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [modalPos, setModalPos] = useState({ x: 0, y: 97 });
  const [publicRecordAddress, setPublicRecordAddress] = useState<{ address: string; propertyId?: string } | null>(null);

  // 동일 주소 참고용 사진 (RLS 우회 RPC 사용 — 일반 사용자도 inactive/타카테고리 사진 조회 가능)
  // 주소별 모든 호실(active 풀에 없는 종료 매물 포함)을 보관 → 사진 보기 시 함께 노출
  type InactiveUnit = { image: string; images: string[]; unitNumber: string; roomType: string; floor: string; address: string };
  const [inactiveRefMap, setInactiveRefMap] = useState<Map<string, InactiveUnit[]>>(new Map());
  useEffect(() => {
    let cancelled = false;
    const fetchInactiveRefs = async () => {
      const pool = referencePool && referencePool.length > 0 ? referencePool : properties;
      // 사진 없는 매물뿐 아니라, 사진 있는 매물의 주소도 포함 → 같은 주소 다른 호실(종료) 사진 함께 가져오기
      const allAddrs = pool
        .map((p) => p.address)
        .filter((a, i, arr) => !!a && arr.indexOf(a) === i);
      if (allAddrs.length === 0) return;

      const { data } = await supabase.rpc("get_reference_images", { _addresses: isMobile ? allAddrs.slice(0, 80) : allAddrs });

      if (!cancelled && data) {
        const map = new Map<string, InactiveUnit[]>();
        for (const row of data as Array<{ address: string; unit_number: string; room_type: string; floor?: string; images: string[] }>) {
          const imgs = row.images;
          if (!imgs || imgs.length === 0 || !imgs[0]) continue;
          const list = map.get(row.address) ?? [];
          list.push({
            image: imgs[0],
            images: imgs,
            unitNumber: row.unit_number || "?",
            roomType: row.room_type || "",
            floor: row.floor || "",
            address: row.address,
          });
          map.set(row.address, list);
        }
        setInactiveRefMap(map);
      }
    };
    fetchInactiveRefs();
    return () => { cancelled = true; };
  }, [properties, referencePool, isMobile]);

  // 참고용 사진 찾기 헬퍼: 동일주소 active 매물(전체 풀) → inactive 매물 순
  const findRefImage = useCallback((prop: MapProperty, pool: MapProperty[]) => {
    // 항상 referencePool(전체)을 우선 검색하고, 없으면 전달받은 pool에서 찾음
    const searchPools = [referencePool, pool].filter(Boolean) as MapProperty[][];
    for (const sp of searchPools) {
      const sibling = sp.find(
        (p) => p.id !== prop.id && p.address === prop.address && p.image && p.image.length > 0
      );
      if (sibling) return {
        image: sibling.image,
        images: sibling.images && sibling.images.length > 0 ? sibling.images : [sibling.image],
        unitNumber: sibling.unitNumber || "?",
        roomType: sibling.roomType || "",
      };
    }
    // inactive 매물에서 찾기
    const inactiveList = inactiveRefMap.get(prop.address);
    const inactive = inactiveList?.[0];
    if (inactive) return {
      image: inactive.image,
      images: inactive.images,
      unitNumber: inactive.unitNumber,
      roomType: inactive.roomType || "",
    };
    return null;
  }, [inactiveRefMap, referencePool]);

  /** 동일 주소의 종료(inactive) 매물 호실들을 LightboxUnit 배열로 변환 — 현재 active 호실과 중복 제거 */
  const getInactiveUnitsForAddress = useCallback((address: string, excludeUnitNumbers: Set<string>): LightboxUnit[] => {
    const list = inactiveRefMap.get(address);
    if (!list || list.length === 0) return [];
    return list
      .filter((u) => !excludeUnitNumbers.has(`${u.unitNumber}|${u.roomType}`))
      .map((u) => ({
        unitNumber: u.unitNumber ? `${u.unitNumber}호` : undefined,
        roomType: u.roomType || undefined,
        floor: u.floor || undefined,
        label: `${u.unitNumber}호${u.roomType ? ` ${u.roomType}` : ""} (종료)`,
        images: u.images,
        isReference: true,
      }));
  }, [inactiveRefMap]);

  // pinnedIds 모드: 클릭 순서대로 표시
  // pinnedAddress 모드: 동일 주소 필터
  // 둘 다 없으면 전체 표시
  const displayProperties = useMemo(() => {
    if (isMobile && mobileStep === 0) return [];
    let list = propertiesWithCheckedDates;
    if (favoritesOnly) list = list.filter((p) => favorites.has(p.id));
    if (pinnedIds && pinnedIds.length > 0) {
      const idxMap = new Map(pinnedIds.map((id, i) => [id, i]));
      return [...list].sort((a, b) => (idxMap.get(a.id) ?? 999) - (idxMap.get(b.id) ?? 999));
    }
    return list;
  }, [isMobile, mobileStep, pinnedIds, propertiesWithCheckedDates, favoritesOnly, favorites]);

  const orderedDisplayProperties = useMemo(() => {
    return [...displayProperties].sort((a, b) => {
      const chkA = a.checkedDate ? new Date(a.checkedDate).getTime() : 0;
      const regA = a.registeredDate ? new Date(a.registeredDate).getTime() : 0;
      const chkB = b.checkedDate ? new Date(b.checkedDate).getTime() : 0;
      const regB = b.registeredDate ? new Date(b.registeredDate).getTime() : 0;
      const latestA = Math.max(chkA, regA);
      const latestB = Math.max(chkB, regB);
      if (latestA !== latestB) return latestB - latestA;
      const boostA = checkedDateBoosts[a.id] ?? 0;
      const boostB = checkedDateBoosts[b.id] ?? 0;
      if (boostA !== boostB) return boostB - boostA;
      if (chkA !== chkB) return chkB - chkA;
      return regB - regA;
    });
  }, [displayProperties, checkedDateBoosts]);
  const visibleOrderedDisplayProperties = useMemo(
    () => (isMobile ? orderedDisplayProperties.slice(0, mobileListLimit) : orderedDisplayProperties),
    [isMobile, orderedDisplayProperties, mobileListLimit],
  );

  // 선택 인쇄: 체크된 매물만, 상세 인쇄: 모든 매물 상세
  const handleSelectPrint = () => {
    const list = properties.filter((p) => checkedIds.has(p.id));
    if (list.length === 0) {
      customAlert("인쇄할 매물을 선택해주세요.");
      return;
    }
    if (list.length > 10) {
      customAlert("선택인쇄는 최대 10개까지 가능합니다.");
      return;
    }
    const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

    // 관리자 여부에 따라 연락처 열 포함 여부 결정
    const showContacts = isAdmin;

    const shortAddress = (addr: string) => {
      if (!addr) return "-";
      const tokens = addr.trim().split(/\s+/);
      if (tokens.length >= 2) return tokens.slice(-2).join(" ");
      return addr;
    };

    const rows = list
      .map((p, i) => {
        const buildYearShort = p.buildYear ? p.buildYear.replace(/[^0-9]/g, "").slice(0, 4) : "";
        const roomTypeText = p.type === "원룸" && p.roomType ? p.roomType : (p.roomType ?? "-");
        const passwordCell = showContacts
          ? `<td style="font-size:10px;color:#333;line-height:1.6;text-align:center">
            ${p.buildingPassword || p.password ? `<span style="color:#15803d;font-weight:600">건물</span> ${p.buildingPassword ?? p.password}<br/>` : ""}
            ${p.roomPassword ? `<span style="color:#1d4ed8;font-weight:600">방</span> ${p.roomPassword}` : ""}
            ${!p.buildingPassword && !p.password && !p.roomPassword ? "-" : ""}
           </td>`
          : "";
        const contactCell = showContacts
          ? `<td style="font-size:10px;color:#333;line-height:1.6">
            ${p.contactOwner ? `<span style="color:#15803d;font-weight:600">건물주</span> ${p.contactOwner}<br/>` : ""}
            ${p.contactManager ? `<span style="color:#1d4ed8;font-weight:600">관리인</span> ${p.contactManager}<br/>` : ""}
            ${p.contactTenant ? `<span style="color:#7c3aed;font-weight:600">세입자</span> ${p.contactTenant}<br/>` : ""}
            ${!p.contactOwner && !p.contactManager && !p.contactTenant ? "-" : ""}
           </td>`
          : "";
        return `<tr>
        <td style="text-align:center;color:#888">${i + 1}</td>
        <td style="color:#555">${shortAddress(p.address)}</td>
        <td><strong>${p.buildingName ?? p.title}</strong></td>
        <td style="text-align:center"><span style="background:#e8f0ff;color:#1a56db;border-radius:4px;padding:2px 6px;font-size:10px">${p.type}</span></td>
        <td style="text-align:center;color:#555">${roomTypeText || "-"}</td>
        ${passwordCell}
        <td style="text-align:center">${[p.floor, p.unitNumber].filter(Boolean).join(" / ") || "-"}</td>
        <td style="text-align:center">${p.area ?? "-"}</td>
        <td style="text-align:center;line-height:1.5">
          <span style="color:#1a56db;font-weight:bold">${p.deposit || "-"}</span>
          <span style="color:#888"> / </span>
          <span style="color:#e11d48;font-weight:bold">${p.monthly || "-"}</span>
        </td>
        <td style="text-align:center;color:#555">${p.manageFee ?? "-"}</td>
        <td style="text-align:center">${p.availableFrom ?? "-"}</td>
        <td style="text-align:center;color:#555">${buildYearShort ? `${buildYearShort}년` : "-"}</td>
        ${contactCell}
      </tr>`;
      })
      .join("");

    const passwordHeader = showContacts ? `<th style="width:90px">비밀번호 (관리자용)</th>` : "";
    const contactHeader = showContacts ? `<th style="width:130px">연락처 (관리자용)</th>` : "";

    const adminWatermark = showContacts
      ? `<p style="font-size:11px;color:#e11d48;font-weight:600;margin-top:4px">🔒 관리자 전용 — 연락처 포함</p>`
      : "";

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <title>선택 매물 목록 (${list.length}건)</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Apple SD Gothic Neo', '맑은 고딕', sans-serif; font-size: 12px; color: #111; background: #fff; padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px; border-bottom: 2px solid #1a56db; padding-bottom: 10px; }
    .header h1 { font-size: 18px; font-weight: 700; color: #1a56db; }
    .header .meta { font-size: 11px; color: #888; text-align: right; line-height: 1.6; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #1a56db; color: #fff; padding: 7px 8px; font-size: 11px; font-weight: 600; text-align: center; }
    td { border: 1px solid #e0e0e0; padding: 6px 8px; font-size: 11px; vertical-align: middle; }
    tr:nth-child(even) td { background: #f8faff; }
    tr:hover td { background: #eef3ff; }
    .footer { margin-top: 14px; font-size: 10px; color: #aaa; text-align: right; }
    .admin-badge { display:inline-block;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700; }
    @media print {
      body { padding: 10px; }
      .no-print { display: none !important; }
      tr:hover td { background: inherit; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>📋 선택 매물 목록</h1>
      <p style="font-size:12px;color:#555;margin-top:4px">총 <strong style="color:#1a56db">${list.length}건</strong> 선택</p>
      ${adminWatermark}
    </div>
    <div class="meta">
      출력일: ${today}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:28px">No.</th>
        <th>주소</th>
        <th style="width:130px">건물명</th>
        <th style="width:65px">유형</th>
        <th style="width:60px">방유형</th>
        ${passwordHeader}
        <th style="width:80px">층 / 호수</th>
        <th style="width:70px">면적</th>
        <th style="width:130px">보증금 / 월세</th>
        <th style="width:60px">관리비</th>
        <th style="width:80px">입주가능일</th>
        <th style="width:55px">준공</th>
        ${contactHeader}
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">※ 본 자료는 참고용이며 실제 계약 조건과 다를 수 있습니다.${showContacts ? " | 🔒 이 문서에는 관리자 전용 연락처 정보가 포함되어 있습니다." : ""}</div>
  <div class="no-print" style="margin-top:20px;text-align:center">
    <button onclick="window.print()" style="padding:10px 28px;background:#1a56db;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;margin-right:8px">🖨️ 인쇄</button>
    <button onclick="window.close()" style="padding:10px 20px;background:#f0f0f0;color:#333;border:none;border-radius:8px;font-size:13px;cursor:pointer">닫기</button>
  </div>
</body>
</html>`;
    const w = window.open("", "_blank", "width=1100,height=700");
    w?.document.write(html);
    w?.document.close();
  };

  const handleDetailPrint = () => {
    const list = checkedIds.size > 0 ? properties.filter((p) => checkedIds.has(p.id)) : properties;
    const cards = list
      .map(
        (p) =>
          `<div style="border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:16px;page-break-inside:avoid">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <strong style="font-size:14px">${p.buildingName ?? p.title}</strong>
          <span style="background:#e8f0ff;color:#1a56db;border-radius:4px;padding:2px 8px;font-size:11px">${p.type}</span>
        </div>
        <p style="margin:2px 0;font-size:12px;color:#555">📍 ${p.address} ${p.unitNumber ?? ""}</p>
        <p style="margin:2px 0;font-size:12px;color:#555">🏢 ${p.floor ?? "-"} / ${p.totalFloors ?? "-"} · ${p.area ?? "-"} · 준공 ${p.buildYear ?? "-"}</p>
        <p style="margin:6px 0;font-size:13px;font-weight:bold;color:#1a56db">보증금 ${p.deposit} / 월세 ${p.monthly}</p>
        <p style="margin:2px 0;font-size:11px;color:#777">관리비 ${p.manageFee ?? "-"} · 주차 ${p.parking ?? "-"} · 입주 ${p.availableFrom ?? "-"}</p>
        ${p.options && p.options.length > 0 ? `<p style="margin:4px 0;font-size:11px;color:#555">옵션: ${p.options.join(", ")}</p>` : ""}
      </div>`,
      )
      .join("");
    const html = `<html><head><title>매물 상세 인쇄</title><style>body{font-family:sans-serif;max-width:800px;margin:0 auto;padding:20px}@media print{body{padding:0}}</style></head><body><h2>매물 상세 목록 (${list.length}건)</h2>${cards}</body></html>`;
    const w = window.open("", "_blank");
    w?.document.write(html);
    w?.document.close();
    w?.print();
  };

  return (
    <>
      {/* Public Record Modal */}
      {publicRecordAddress && (
        <PublicRecordModal
          address={publicRecordAddress.address}
          propertyId={publicRecordAddress.propertyId}
          onClose={() => setPublicRecordAddress(null)}
        />
      )}
      {/* Photo Upload Modal */}
      {photoUploadProp && (
        <PhotoUploadModal
          prop={photoUploadProp}
          onClose={() => setPhotoUploadProp(null)}
          onImagesUpdated={(imgs) => {
            // 실시간 반영: photoUploadProp의 이미지 업데이트
            setPhotoUploadProp((prev) => (prev ? { ...prev, images: imgs, image: imgs[0] ?? prev.image } : null));
            onRefetch?.();
          }}
        />
      )}
      {/* Lease Proposal Modal */}
      {leaseProposalProp && (
        <LeaseProposalModal
          prop={leaseProposalProp}
          allProperties={properties}
          onClose={() => setLeaseProposalProp(null)}
          isAdmin={isAdmin}
          onRefetch={onRefetch}
        />
      )}
      {/* Error Report Modal */}
      {errorReportProp && <ErrorReportModal prop={errorReportProp} onClose={() => setErrorReportProp(null)} />}
      {/* Deal Complete Modal */}
      {dealCompleteProp && <DealCompleteModal prop={dealCompleteProp} onClose={() => setDealCompleteProp(null)} onComplete={(pid) => setDealCompletedIds(prev => new Set(prev).add(pid))} />}
      {/* Admin Property Edit Modal */}
      {adminEditProp &&
        (() => {
          // agent_name(DB)에 저장된 연락처 문자열 파싱
          // 형식: "건물주:010-xxx|부동산:043-xxx|세입자:010-xxx|관리인:010-xxx"
          // 또는 note: "건물주: 010-xxx\n부동산: 043-xxx\n..."
          const rawContact = adminEditProp.agentName ?? adminEditProp.note ?? "";
          const parseC = (key: string) => {
            const pattern = key === "건물주"
              ? /건물주(?!2)[:\s]+([0-9][0-9\-]+)/
              : new RegExp(`${key}[:\\s]+([0-9][0-9\\-]+)`);
            const m = rawContact.match(pattern);
            return m ? m[1].trim() : "";
          };
          const parsedOwner = adminEditProp.contactOwner || parseC("건물주");
          const parsedOwner2 = adminEditProp.contactOwner2 || parseC("건물주2");
          const parsedBroker = adminEditProp.contact || parseC("부동산");
          const parsedTenant = parseC("세입자");
          const parsedManager = adminEditProp.contactManager || parseC("관리인");

          return (
            <AdminPropertyFormModal
              initial={
                adminEditProp.memo
                  ? {
                      id: adminEditProp.memo,
                      title: adminEditProp.title,
                      building_name: adminEditProp.buildingName,
                      address: adminEditProp.address,
                      dong: adminEditProp.address?.split(" ").slice(-2, -1)[0] ?? "",
                      lot_number: adminEditProp.address?.split(" ").slice(-1)[0] ?? "",
                      district: adminEditProp.address?.match(/([가-힣]+구)/)?.[1],
                      type: adminEditProp.type,
                      room_type: adminEditProp.roomType ?? adminEditProp.type ?? "",
                      unit_number: adminEditProp.unitNumber,
                      area: adminEditProp.area ?? "",
                      floor: adminEditProp.floor ?? "",
                      deposit: adminEditProp.deposit?.replace(/[^0-9,]/g, "") ?? "",
                      monthly: adminEditProp.monthly?.replace(/[^0-9,]/g, "") ?? "",
                      manage_fee: adminEditProp.manageFee?.replace(/[^0-9,]/g, "") ?? "",
                      parking: adminEditProp.parking ?? "",
                      elevator: adminEditProp.elevator ?? false,
                      available_from: adminEditProp.availableFrom ?? "",
                      total_floors: adminEditProp.totalFloors?.replace(/[^0-9층]/g, "") ?? "",
                      build_year: adminEditProp.buildYear?.replace(/[^0-9]/g, "") ?? "",
                      description: adminEditProp.description ?? "",
                      building_memo: adminEditProp.buildingMemo ?? "",
                      room_memo: adminEditProp.roomMemo ?? "",
                      note: adminEditProp.note ?? "",
                      vacate_date: adminEditProp.vacateDate ?? "",
                      building_password: adminEditProp.buildingPassword ?? "",
                      room_password: adminEditProp.roomPassword ?? "",
                      options: adminEditProp.options ?? [],
                      images:
                        adminEditProp.images && adminEditProp.images.length > 0
                          ? adminEditProp.images
                          : adminEditProp.image
                            ? [adminEditProp.image]
                            : [],
                      views: adminEditProp.views ?? 0,
                      lat: adminEditProp.lat ?? 0,
                      lng: adminEditProp.lng ?? 0,
                      is_new: adminEditProp.isNew ?? false,
                      is_hot: adminEditProp.isHot ?? false,
                      status: "active",
                      registered_date: adminEditProp.registeredDate ?? new Date().toISOString().slice(0, 10),
                      checked_date: adminEditProp.checkedDate ?? "",
                      // 연락처: 각 필드에 분리 배치 (담당중개사 필드에 묶지 않음)
                      agent_name: parsedBroker,
                      // 아래는 AdminFormExtended 확장 필드로 초기화됨
                      ...(parsedOwner ? { contactOwner: parsedOwner } : {}),
                      ...(parsedOwner2 ? { contactOwner2: parsedOwner2 } : {}),
                      ...(parsedTenant ? { contactTenant: parsedTenant } : {}),
                      ...(parsedManager ? { contactManager: parsedManager } : {}),
                    }
                  : null
              }
              onClose={() => setAdminEditProp(null)}
              onSaved={() => { setAdminEditProp(null); onRefetch?.(); }}
            />
          );
        })()}
      {/* Lightbox — 호실별 탭 + 여러 장 좌우 탐색 */}
      {lightbox && (
        <LightboxModal units={lightbox.units} startUnitIdx={lightbox.unitIdx} onClose={() => setLightbox(null)} />
      )}
      {/* 모바일 연락처 모달 — 입력된 연락처만 노출 */}
      {mobileContactsProp && !isGuest && ReactDOM.createPortal(
        <div
          className="fixed inset-0 z-[10000] bg-black/60 flex items-end md:items-center justify-center p-4"
          onClick={() => setMobileContactsProp(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ background: "hsl(var(--primary)/0.05)" }}>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
                <span className="font-extrabold text-[14px]">연락처</span>
              </div>
              <button onClick={() => setMobileContactsProp(null)} className="p-1 rounded hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 flex flex-col gap-2">
              {[
                { label: "소유주", num: mobileContactsProp.contactOwner?.trim() },
                { label: "소유주2", num: mobileContactsProp.contactOwner2?.trim() },
                { label: "관리인", num: mobileContactsProp.contactManager?.trim() },
                { label: "세입자", num: mobileContactsProp.contactTenant?.trim() },
              ]
                .filter((c) => c.num)
                .map((c) => (
                  <a
                    key={c.label}
                    href={`tel:${c.num}`}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-colors hover:bg-primary/5"
                    style={{ borderColor: "hsl(var(--border))" }}
                  >
                    <span className="text-[12px] font-bold text-muted-foreground">{c.label}</span>
                    <span className="text-[14px] font-extrabold" style={{ color: "hsl(var(--primary))" }}>{c.num}</span>
                  </a>
                ))}
              {!(mobileContactsProp.contactOwner?.trim() || mobileContactsProp.contactOwner2?.trim() || mobileContactsProp.contactManager?.trim() || mobileContactsProp.contactTenant?.trim()) && (
                <p className="text-center text-[12px] text-muted-foreground py-4">등록된 연락처가 없습니다</p>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* 모바일에서 시트가 4/4(100%)로 펼쳐졌을 때 배경 어둡게 */}
      {isMobile && mobileStep === 2 && (
        <div
          className="fixed inset-0 bg-black/30 z-[55]"
          onClick={() => setMobileStep(1)}
        />
      )}

      {/* collapsed 시 absolute로 지도 위에 겹치게, 열릴 때는 flex로 공간 차지
          모바일(<768px): 하단 시트로 동작, mobileStep으로 높이 제어 */}
      <div
        className={isMobile ? "" : "flex h-full"}
        style={
          isMobile
            ? {
                position: "fixed",
                left: 0,
                right: 0,
                bottom: "calc(env(safe-area-inset-bottom, 0px) + 70px)",
                top: "auto",
                height:
                  mobileStep === 0
                    ? "56px"
                    : mobileStep === 1
                    ? "min(55vh, calc(100vh - 170px))"
                    : "calc(100vh - 170px)",
                maxHeight: "calc(100vh - 170px)",
                zIndex: 60,
                background: "white",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                boxShadow: "0 -8px 24px rgba(0,0,0,0.18)",
                transform: mobileClosing ? "translateY(100%)" : "translateY(0)",
                transition: "transform 0.18s ease",
                willChange: "transform",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                flexShrink: 0,
              }
            : {
                position: collapsed ? "absolute" : "relative",
                right: 0,
                top: 0,
                bottom: 0,
                zIndex: collapsed ? 50 : "auto",
                flexShrink: 0,
              }
        }
      >
        {/* Toggle tab — 사이드바 왼쪽 (데스크톱 전용) */}
        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="self-start bg-primary text-primary-foreground border-0 rounded-l-xl px-1.5 py-4 shadow-lg hover:bg-primary/90 transition-colors flex-shrink-0"
            style={{ marginTop: "32px" }}
          >
            {collapsed ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* 모바일 전용 peek 헤더 — 탭하면 단계적 확장 */}
        {isMobile && (
          <button
            onClick={() => setMobileStep((p) => (((p + 1) % 3) as 0 | 1 | 2))}
            className="flex-shrink-0 w-full px-4 pt-2 pb-2 flex flex-col items-stretch border-b border-border bg-white"
          >
            <span className="mx-auto w-10 h-1 rounded-full bg-muted-foreground/30 mb-1.5" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: "hsl(var(--stat-green))" }} />
                <span className="text-sm font-bold text-foreground">매물정보</span>
                <span className="text-xs text-muted-foreground">({properties.filter((p) => p.lat !== 0 && p.lng !== 0).length}개)</span>
              </div>
              <div className="flex items-center gap-1">
                {mobileStep > 0 && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMobileStep((p) => (p > 0 ? ((p - 1) as 0 | 1 | 2) : 0));
                    }}
                    className="p-1 rounded hover:bg-muted"
                    title="한 단계 줄이기"
                  >
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  </span>
                )}
                {mobileStep < 2 && <ChevronUp className="w-5 h-5 text-muted-foreground" />}
                {mobileStep > 0 && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMobileClose();
                    }}
                    className="ml-1 p-1 rounded hover:bg-muted"
                    title="닫기"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </span>
                )}
              </div>
            </div>
            {mobileStep > 0 && (
              <div className="flex items-center justify-center gap-1 mt-1.5">
                {[1, 2].map((n) => (
                  <span
                    key={n}
                    className="h-1 rounded-full transition-all"
                    style={{
                      width: mobileStep >= n ? 16 : 8,
                      background: mobileStep >= n ? "hsl(var(--primary))" : "hsl(var(--border))",
                    }}
                  />
                ))}
              </div>
            )}
          </button>
        )}

        {/* Panel */}
        <aside
          className={`bg-white flex flex-col transition-all duration-300 ${
            isMobile
              ? "flex-1 w-full min-h-0"
              : collapsed
                ? "hidden"
                : "border-l border-border opacity-100"
          }`}
          style={
            isMobile
              ? { display: mobileStep === 0 ? "none" : "flex" }
              : collapsed
                ? undefined
                : { width, flexShrink: 0 }
          }
        >
          {/* Header */}
          {/* ── 사이드바 헤더 ── */}
          <div className="flex-shrink-0 border-b border-border" style={{ background: "hsl(var(--toolbar-bg))" }}>
          </div>

          {/* List */}
          <div ref={listScrollRef} className="flex-1 overflow-y-auto scrollbar-thin bg-muted/20 pb-24 md:pb-0">
            {/* 소유주 번호 검색 결과: 매물 카드와 동일한 레이아웃으로 표시 */}
            {landlordSearched ? (
              landlordLoading ? (
                <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: "hsl(var(--accent))" }} />
                  <p className="text-xs">검색 중...</p>
                </div>
              ) : (landlordResults ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <Phone className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm font-medium">연락처가 등록된 결과가 없습니다</p>
                </div>
              ) : (
                <div className="pt-2 pb-2 pr-2 pl-3 flex flex-col gap-1.5">
                  {/* 소유주 검색 결과 헤더 배너 */}
                  <div
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5"
                    style={{ background: "hsl(var(--accent)/0.08)", border: "1px solid hsl(var(--accent)/0.2)" }}
                  >
                    <Phone className="w-3 h-3 flex-shrink-0" style={{ color: "hsl(var(--accent))" }} />
                    <span className="text-[10px] font-bold" style={{ color: "hsl(var(--accent))" }}>
                      소유주 번호 검색 결과
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {(landlordResults ?? []).length}건 (숨김·미노출 포함)
                    </span>
                  </div>
                  {(landlordResults ?? []).map((item, idx) => {
                    const isHidden = item.source === "property" && item.status !== "active";
                    const isInvisible = item.source === "contact" && item.isVisible === false;
                    // LandlordResult → MapProperty 형태로 변환하여 카드 렌더링 재사용
                    const fakePropId = idx + 900000;
                    return (
                      <div key={item.id} className="flex flex-col">
                        <div
                          className={`w-full text-left transition-all group rounded-xl overflow-hidden bg-white shadow-sm ${isHidden || isInvisible ? "opacity-80" : ""}`}
                          style={{ border: "1px solid hsl(var(--border))" }}
                        >
                          {/* Row: 동일 3컬럼 레이아웃 */}
                          <div className="flex items-stretch" style={{ width: "100%", minHeight: isMobile ? "120px" : "80px" }}>
                            {/* ①썸네일 + 참고용 사진 */}
                            <div
                              className={`flex-shrink-0 overflow-hidden relative ${isMobile ? "w-[120px]" : "w-[96px]"}`}
                              style={{ minHeight: isMobile ? "120px" : "96px" }}
                            >
                              {(() => {
                                const hasOwn = item.images && item.images.length > 0 && item.images[0];
                                let refImg: string | null = null;
                                let refImages: string[] = [];
                                let refUnit = "";
                                if (!hasOwn) {
                                  // 동일 sublabel 다른 결과에서 찾기
                                  const sibling = (landlordResults ?? []).find(
                                    (r) => r.id !== item.id && r.sublabel === item.sublabel && r.images && r.images.length > 0 && r.images[0]
                                  );
                                  if (sibling) {
                                    refImg = sibling.images![0];
                                    refImages = sibling.images!;
                                    refUnit = sibling.unitNumber || "?";
                                  }
                                  // inactive 매물에서도 찾기
                                  if (!refImg) {
                                    const addr = item.sublabel || "";
                                    const inactive = inactiveRefMap.get(addr)?.[0];
                                    if (inactive) {
                                      refImg = inactive.image;
                                      refImages = inactive.images;
                                      refUnit = inactive.unitNumber;
                                    }
                                  }
                                }
                                const showImg = hasOwn ? item.images![0] : refImg;
                                const isRef = !hasOwn && !!refImg;

                                if (showImg) {
                                  return (
                                    <>
                                      <img
                                        src={thumbUrl(showImg, 320, 88)}
                                        alt={item.label}
                                        loading="eager"
                                        decoding="async"
                                        referrerPolicy="no-referrer"
                                        className={`w-full h-full object-cover cursor-zoom-in ${isRef ? "opacity-70" : ""}`}
                                        style={{ imageRendering: "auto" }}
                                        onError={(e) => {
                                          const img = e.currentTarget;
                                          if (img.dataset.fallback !== "orig" && img.src.includes("/render/image/")) {
                                            img.dataset.fallback = "orig";
                                            img.src = originalFromThumb(showImg);
                                            return;
                                          }
                                          img.style.display = "none";
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const allWithImages = (landlordResults ?? []).filter(
                                            (r) => r.sublabel === item.sublabel && r.images && r.images.length > 0 && r.images[0]
                                          );
                                          const units: LightboxUnit[] = allWithImages.map((r) => ({
                                            label: r.unitNumber ? `${r.unitNumber}호` : r.label,
                                            images: r.images!,
                                            isReference: r.id !== item.id,
                                          }));
                                          if (isRef && units.length === 0) {
                                            units.push({ label: `${refUnit}호`, images: refImages, isReference: true });
                                          }
                                          if (units.length === 0) return;
                                          const currentIdx = isRef ? units.length - 1 : allWithImages.findIndex((r) => r.id === item.id);
                                          setLightbox({ units, unitIdx: Math.max(0, currentIdx) });
                                        }}
                                      />
                                      <PhotoWatermark size="sm" />
                                      {isRef && (
                                        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                                          <span className="text-[8px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] text-center leading-tight">
                                            참고용<br/>다른 호실 사진
                                          </span>
                                        </div>
                                      )}
                                    </>
                                  );
                                }
                                return (
                                  <div className="w-full h-full flex items-center justify-center bg-muted overflow-hidden">
                                    <img src={zibdaPlaceholder} alt="집다 로고" className="w-full h-full object-contain select-none" />
                                  </div>
    
                                );
                              })()}
                              {/* 순번 + 상태 배지 오버레이 */}
                              <div
                                className="absolute bottom-0 left-0 right-0 flex items-center gap-0.5 px-1 py-0.5"
                                style={{ background: "rgba(0,0,0,0.52)" }}
                              >
                                <span className="text-[9px] font-extrabold text-white leading-none">{idx + 1}.</span>
                                {isHidden && <span className="text-[8px] text-red-300 leading-none ml-0.5">숨김</span>}
                                {isInvisible && (
                                  <span className="text-[8px] text-yellow-300 leading-none ml-0.5">미노출</span>
                                )}
                                {item.images && item.images.length > 1 && (
                                  <span className="text-[8px] text-white/80 leading-none ml-auto">
                                    📷{item.images.length}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* ②연락처 컬럼 — 소유주/관리인/부동산 */}
                            <div className="w-[28px] flex-shrink-0 flex flex-col border-l border-border/30">
                              <ContactEmojiRow propId={fakePropId} type="owner" number={item.contactOwner || null} />
                              <ContactEmojiRow
                                propId={fakePropId + 1}
                                type="manager"
                                number={item.contactManager || null}
                              />
                              <ContactEmojiRow
                                propId={fakePropId + 2}
                                type="broker"
                                number={item.contactBroker || null}
                              />
                            </div>

                            {/* ③메인 정보 */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between px-2 py-1.5 gap-0.5">
                              {/* 1행: 건물명/주소 + 유형 배지 */}
                              <div className="flex items-start gap-1">
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] font-extrabold text-foreground leading-tight truncate">
                                    {item.label}
                                    {item.unitNumber && (
                                      <span
                                        className="ml-1 text-[11px] font-bold px-1 py-0.5 rounded"
                                        style={{ background: "hsl(var(--primary)/0.1)", color: "hsl(var(--primary))" }}
                                      >
                                        {item.unitNumber}호
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground truncate leading-tight">
                                    {item.sublabel}
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                  {item.type && (
                                    <span
                                      className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                                      style={{ background: "hsl(var(--primary)/0.1)", color: "hsl(var(--primary))" }}
                                    >
                                      {item.type}
                                    </span>
                                  )}
                                  <span
                                    className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                                    style={
                                      item.source === "contact"
                                        ? { background: "hsl(var(--accent)/0.12)", color: "hsl(var(--accent))" }
                                        : { background: "hsl(217 91% 60%/0.12)", color: "hsl(217 91% 45%)" }
                                    }
                                  >
                                    {item.source === "contact" ? "연락처DB" : "매물"}
                                  </span>
                                </div>
                              </div>

                              {/* 2행: 층·면적·금액 */}
                              {(item.badge || item.price) && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {item.badge && (
                                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                      {item.badge}
                                    </span>
                                  )}
                                  {item.price && (
                                    <span className="text-[10px] font-bold" style={{ color: "hsl(var(--primary))" }}>
                                      {item.price}
                                    </span>
                                  )}
                                </div>
                              )}

                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : displayProperties.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <MapPin className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">검색 결과가 없습니다</p>
              </div>
            ) : (
              <div className="pt-2 pb-2 pr-2 pl-3 flex flex-col gap-1.5">
                {!isGuest && (
                  <div className="hidden md:flex items-center gap-1 px-1 py-1 flex-wrap">
                    {[
                      { label: "등기소", url: "http://www.iros.go.kr", bg: "hsl(220 60% 93%)", color: "hsl(220 60% 30%)", border: "hsl(220 50% 70%)", icon: "https://www.iros.go.kr/favicon.ico" },
                      { label: "정부24", url: "https://www.gov.kr", bg: "hsl(200 60% 93%)", color: "hsl(200 60% 30%)", border: "hsl(200 50% 70%)", icon: "/images/gov24-logo.png" },
                      { label: "토지e음", url: "https://www.eum.go.kr", bg: "hsl(140 50% 93%)", color: "hsl(140 50% 25%)", border: "hsl(140 40% 65%)", icon: "https://www.google.com/s2/favicons?domain=eum.go.kr&sz=32" },
                      { label: "직방", url: "https://www.zigbang.com", bg: "hsl(15 80% 93%)", color: "hsl(15 70% 30%)", border: "hsl(15 60% 70%)", icon: "https://www.zigbang.com/favicon.ico" },
                      { label: "다방", url: "https://www.dabangapp.com", bg: "hsl(270 50% 95%)", color: "hsl(270 60% 20%)", border: "hsl(270 40% 60%)", icon: "/images/dabang-logo.png" },
                      { label: "네이버부동산", url: "https://land.naver.com", bg: "hsl(145 70% 93%)", color: "hsl(145 60% 25%)", border: "hsl(145 50% 65%)", icon: "https://land.naver.com/favicon.ico" },
                    ].map((link) => (
                      <a
                        key={link.label}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 flex-shrink-0 no-underline text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap"
                        style={{ background: link.bg, color: link.color, border: `1px solid ${link.border}` }}
                      >
                        <img
                          src={link.icon}
                          alt=""
                          className="w-3.5 h-3.5 rounded-sm object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <span className="font-extrabold">{link.label}</span>
                      </a>
                    ))}
                    <span className="flex-1 min-w-[4px]" />
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const addr = await customPrompt(
                          "건축물대장을 조회할 주소를 입력하세요",
                          "",
                          "예: 사창동 225-7"
                        );
                        if (!addr?.trim()) return;
                        let query = addr.trim().replace(/\s+/g, " ");
                        query = query.replace(/([가-힣]+동|[가-힣]+리)(\d)/g, "$1 $2");
                        try {
                          const { data, error } = await supabase.functions.invoke("geocode", { body: { address: query } });
                          if (error || !data?.success) {
                            const notFound = data?.error === "No results found for the given address";
                            await customAlert(
                              notFound
                                ? `'${query}' 주소를 찾을 수 없습니다.\n\n💡 다음을 확인해주세요:\n• 동/리 + 지번 형식 (예: 사창동 225-7)\n• 청주시를 포함 (예: 청주시 흥덕구 봉명동 769)\n• 도로명 주소는 '시/구' 포함 권장`
                                : `주소 조회에 실패했습니다.\n${data?.error || "잠시 후 다시 시도해주세요."}`
                            );
                            return;
                          }
                          const normalized = data.jibunAddress || data.roadAddress || query;
                          setPublicRecordAddress({ address: normalized });
                        } catch {
                          await customAlert("주소 조회 중 네트워크 오류가 발생했습니다.\n인터넷 연결을 확인하고 다시 시도해주세요.");
                        }
                      }}
                      className="flex items-center gap-0.5 flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap"
                      style={{ background: "hsl(30 80% 93%)", color: "hsl(30 70% 25%)", border: "1px solid hsl(30 60% 70%)" }}
                    >
                      <Building2 className="w-3 h-3" />
                      건축물조회
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSelectPrint(); }}
                      className="flex items-center gap-0.5 flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap"
                      style={{ background: "hsl(217 91% 93%)", color: "hsl(217 91% 35%)", border: "1px solid hsl(217 80% 70%)" }}
                    >
                      <Printer className="w-3 h-3" />
                      선택인쇄{isAgentForPrint && printCheckedIds.size > 0 ? ` (${printCheckedIds.size})` : ""}
                    </button>
                  </div>
                )}
                {visibleOrderedDisplayProperties.map((prop, idx) => {
                  const buildingMemo = prop.buildingMemo;
                  const roomMemo = prop.roomMemo;
                  const buildingPw = prop.buildingPassword ?? prop.password;
                  const roomPw = prop.roomPassword;
                  const regDate = prop.registeredDate;
                  const chkDate = prop.checkedDate;
                  const isDealCompleted = dealCompletedIds.has(prop.dbId || String(prop.id));
                  return (
                    <div
                      key={prop.id}
                      data-prop-id={prop.id}
                      className="flex flex-col"
                      style={isMobile ? ({ contentVisibility: "auto", containIntrinsicSize: "120px" } as any) : undefined}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (selectedId !== prop.id) onSelect(prop.id);
                          setExpandedCardId((prev) => (prev === prop.id ? null : prop.id));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (selectedId !== prop.id) onSelect(prop.id);
                            setExpandedCardId((prev) => (prev === prop.id ? null : prop.id));
                          }
                        }}
                        className={`w-full text-left transition-all group cursor-pointer ${
                          selectedId === prop.id
                            ? "shadow-lg"
                            : "shadow-sm hover:shadow-md hover:ring-1 hover:ring-inset hover:ring-primary/30"
                        }`}

                      >
                      <div className={`${selectedId === prop.id ? 'p-[3px] bg-gradient-to-br from-primary to-primary rounded-xl' : 'bg-white rounded-xl'}`}>
                        {/* Row: 3줄 레이아웃 — 모바일 게스트/일반회원도 고정 높이로 통일 */}
                        <div className="flex items-stretch bg-white rounded-[9px] overflow-hidden" style={{ width: "100%", minHeight: isMobile ? "120px" : "96px" }}>
                          {/* ①썸네일 — 정사각 고정 96x96 (모바일 게스트·일반회원 120x120) */}
                          {(!isMobile || isGuest || authUser?.memberType === "일반회원") && <div
                            className={`flex-shrink-0 overflow-hidden relative group/thumb ${isMobile ? "w-[120px] h-[120px]" : "w-[96px] h-[96px]"}`}
                          >


                            {(() => {
                              const hasOwnImage = prop.image && prop.image.length > 0;
                              // 사진 없으면 동일 주소 active 매물 → inactive 매물에서 참고용 사진 찾기
                              const ref = !hasOwnImage ? findRefImage(prop, displayProperties) : null;
                              const showImage = hasOwnImage ? prop.image : ref?.image || null;
                              const isRef = !hasOwnImage && !!ref;

                              if (showImage) {
                                return (
                                  <>
                                    <img
                                      src={thumbUrl(showImage, 320, 88)}
                                      alt={prop.title}
                                      loading={isMobile ? "lazy" : "eager"}
                                      decoding="async"
                                      referrerPolicy="no-referrer"
                                      className={`w-full h-full object-cover ${!isMobile ? "group-hover:scale-105 transition-transform duration-500" : ""} ${isRef ? "opacity-70" : ""}`}
                                      style={{
                                        imageRendering: "auto",
                                        WebkitBackfaceVisibility: "hidden",
                                        backfaceVisibility: "hidden",
                                      }}
                                      onError={(e) => {
                                        const img = e.currentTarget;
                                        // 1차 폴백: 변환 실패 시 원본 URL로 재시도
                                        if (img.dataset.fallback !== "orig" && img.src.includes("/render/image/")) {
                                          img.dataset.fallback = "orig";
                                          img.src = originalFromThumb(showImage);
                                          return;
                                        }
                                        img.onerror = null;
                                        img.style.display = "none";
                                        const parent = img.parentElement;
                                        if (!parent || parent.querySelector('[data-thumb-fallback="logo"]')) return;

                                        const fallback = document.createElement("div");
                                        fallback.setAttribute("data-thumb-fallback", "logo");
                                        fallback.className = "absolute inset-0 flex items-center justify-center bg-muted overflow-hidden pointer-events-none";

                                        const logo = document.createElement("img");
                                        logo.src = zibdaPlaceholder;
                                        logo.alt = "집다 로고";
                                        logo.className = "w-full h-full object-contain select-none p-1";

                                        fallback.appendChild(logo);
                                        parent.prepend(fallback);
                                      }}
                                    />
                                    <PhotoWatermark size="sm" />
                                    {isRef && (
                                      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                                        <span className="text-[8px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] text-center leading-tight">
                                          참고용<br/>다른 호실 사진
                                        </span>
                                      </div>
                                    )}
                                  </>
                                );
                              }
                              return (
                              <div className="w-full h-full flex items-center justify-center bg-muted overflow-hidden">
                                <img src={zibdaPlaceholder} alt="집다 로고" className="w-full h-full object-contain select-none" />
                              </div>
    
                              );
                            })()}
                            {isAgentForPrint && !isMobile && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); togglePrintChecked(prop.id); }}
                                className="absolute top-1 left-1 z-20 flex items-center justify-center transition-all hover:scale-110"
                                title={printCheckedIds.has(prop.id) ? "선택 해제" : "인쇄 대상으로 선택"}
                                aria-label={printCheckedIds.has(prop.id) ? "선택 해제" : "인쇄 대상으로 선택"}
                              >
                                {printCheckedIds.has(prop.id) ? (
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}>
                                    <defs>
                                      <linearGradient id={`print-grad-${prop.id}`} x1="2.16" y1="2.295" x2="21.01" y2="21.01" gradientUnits="userSpaceOnUse">
                                        <stop stopColor="#22d3ee" />
                                        <stop offset="0.5" stopColor="#a855f7" />
                                        <stop offset="1" stopColor="#ec4899" />
                                      </linearGradient>
                                    </defs>
                                    <path
                                      d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"
                                      fill={`url(#print-grad-${prop.id})`}
                                      stroke="white"
                                      strokeWidth="1.5"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                ) : (
                                  <Star
                                    className="w-5 h-5"
                                    style={{
                                      color: "white",
                                      fill: "transparent",
                                      filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))",
                                    }}
                                    strokeWidth={2}
                                  />
                                )}
                              </button>
                            )}
                            {(isGuest || authUser?.memberType === "일반회원") && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(prop.id);
                              }}
                              className="absolute top-1 left-1 z-10 flex items-center justify-center transition-all hover:scale-110"
                              title={favorites.has(prop.id) ? "관심매물 해제" : "관심매물 추가"}
                              aria-label={favorites.has(prop.id) ? "관심매물 해제" : "관심매물 추가"}
                            >
                              {favorites.has(prop.id) ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}>
                                  <defs>
                                    <linearGradient id={`fav-grad-${prop.id}`} x1="2.16" y1="2.295" x2="21.01" y2="21.01" gradientUnits="userSpaceOnUse">
                                      <stop stopColor="#22d3ee" />
                                      <stop offset="0.5" stopColor="#a855f7" />
                                      <stop offset="1" stopColor="#ec4899" />
                                    </linearGradient>
                                  </defs>
                                  <path
                                    d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"
                                    fill={`url(#fav-grad-${prop.id})`}
                                    stroke="white"
                                    strokeWidth="1.5"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              ) : (
                                <Star
                                  className="w-5 h-5"
                                  style={{
                                    color: "white",
                                    fill: "transparent",
                                    filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))",
                                  }}
                                  strokeWidth={2}
                                />
                              )}
                            </button>
                            )}
                            {/* 모바일 게스트/일반회원: 행정동(예: 복대동) 표시 (사진 우측 상단) */}
                            {isMobile && (isGuest || authUser?.memberType === "일반회원") && (() => {
                              const m = (prop.address ?? "").match(/[가-힣]+(동|읍|면|리)/);
                              const label = m?.[0];
                              if (!label) return null;
                              return (
                                <div className="absolute top-1 right-1 z-10 pointer-events-none">
                                  <span className="text-[10px] font-extrabold text-white px-1.5 py-0.5 rounded-md tracking-tight" style={{ background: "rgba(0,0,0,0.65)" }}>
                                    {label}
                                  </span>
                                </div>
                              );
                            })()}
                            {/* 게스트/일반회원: 매물번호 NO.### */}
                            {isGuest && prop.regNo && (
                              <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center pointer-events-none pb-0.5">
                                <span className="text-[10px] font-extrabold text-white px-1.5 py-0.5 rounded-full tracking-wider" style={{ background: "hsl(var(--primary))" }}>
                                  NO.{String(parseInt(prop.regNo.replace(/[^0-9]/g, ""), 10) || prop.regNo)}
                                </span>
                              </div>
                            )}
                            {(() => {
                              const hasOwnImages = (prop.images && prop.images.length > 0) || (prop.image && prop.image.length > 0);
                              const ref = !hasOwnImages ? findRefImage(prop, displayProperties) : null;
                              if (!hasOwnImages && !ref) return null;
                              return (
                              <button
                                 onClick={async (e) => {
                                   e.stopPropagation();
                                   // 동일 주소의 active 매물들 (현재 매물에 사진이 없으면 자기 자신은 포함하지 않음)
                                   const sameAddr = properties.filter(
                                     (p) => p.address === prop.address && ((p.images && p.images.length > 0) || p.image),
                                   );
                                    const activeUnits: LightboxUnit[] =
                                      sameAddr.length > 0
                                        ? (() => {
                                            const current = sameAddr.find((p) => p.id === prop.id);
                                            const others = sameAddr.filter((p) => p.id !== prop.id);
                                            const sorted = current ? [current, ...others] : sameAddr;
                                            // 동일 호수 중복 제거 (호수+주거형 키 기준, 첫 항목만 유지)
                                            const seen = new Set<string>();
                                            const deduped = sorted.filter((p) => {
                                              const key = `${p.unitNumber || "?"}|${p.roomType || ""}`;
                                              if (seen.has(key)) return false;
                                              seen.add(key);
                                              return true;
                                            });
                                            return deduped.map((p) => ({
                                              unitNumber: p.unitNumber ? `${p.unitNumber}호` : undefined,
                                              roomType: p.roomType || undefined,
                                              floor: p.floor || undefined,
                                              label: (p.unitNumber ? `${p.unitNumber}호` : p.title || p.address) + (p.roomType ? ` ${p.roomType}` : ""),
                                              images: p.images && p.images.length > 0 ? p.images : p.image ? [p.image] : [],
                                              isReference: p.id !== prop.id,
                                            }));
                                          })()
                                        : hasOwnImages
                                          ? [{
                                              unitNumber: prop.unitNumber ? `${prop.unitNumber}호` : undefined,
                                              roomType: prop.roomType || undefined,
                                              floor: prop.floor || undefined,
                                              label: (prop.unitNumber ? `${prop.unitNumber}호` : prop.title) + (prop.roomType ? ` ${prop.roomType}` : ""),
                                              images:
                                                prop.images && prop.images.length > 0
                                                  ? prop.images
                                                  : prop.image
                                                    ? [prop.image]
                                                    : [],
                                              isReference: false,
                                            }]
                                          : [];
                                   // 종료된(같은 주소) 호실 사진도 함께 노출 — 자기 자신 호실은 제외
                                   const exclude = new Set(sameAddr.map((p) => `${p.unitNumber || "?"}|${p.roomType || ""}`));
                                   if (!hasOwnImages) {
                                     exclude.add(`${prop.unitNumber || "?"}|${prop.roomType || ""}`);
                                   }
                                   let inactiveUnits = getInactiveUnitsForAddress(prop.address, exclude);
                                   // 캐시에 없으면 즉시 RPC로 가져와 같은 주소의 다른 호실 사진을 보장
                                   if (inactiveUnits.length === 0 && !inactiveRefMap.has(prop.address)) {
                                     try {
                                       const { data } = await supabase.rpc("get_reference_images", { _addresses: [prop.address] });
                                       const fetched: InactiveUnit[] = [];
                                       for (const row of (data as Array<{ address: string; unit_number: string; room_type: string; floor?: string; images: string[] }> | null) ?? []) {
                                         if (!row.images || row.images.length === 0 || !row.images[0]) continue;
                                         fetched.push({
                                           image: row.images[0],
                                           images: row.images,
                                           unitNumber: row.unit_number || "?",
                                           roomType: row.room_type || "",
                                           floor: row.floor || "",
                                           address: row.address,
                                         });
                                       }
                                       if (fetched.length > 0) {
                                         setInactiveRefMap((prev) => {
                                           const next = new Map(prev);
                                           next.set(prop.address, fetched);
                                           return next;
                                         });
                                         inactiveUnits = fetched
                                           .filter((u) => !exclude.has(`${u.unitNumber}|${u.roomType}`))
                                           .map((u) => ({
                                             unitNumber: u.unitNumber ? `${u.unitNumber}호` : undefined,
                                             roomType: u.roomType || undefined,
                                             floor: u.floor || undefined,
                                             label: `${u.unitNumber}호${u.roomType ? ` ${u.roomType}` : ""} (종료)`,
                                             images: u.images,
                                             isReference: true,
                                           }));
                                       }
                                     } catch {
                                       /* noop */
                                     }
                                   }
                                   const allUnits = [...activeUnits, ...inactiveUnits];
                                   // 폴백: 참고용 사진만 있는 경우에도 라이트박스를 열 수 있도록
                                   if (allUnits.length === 0 && ref?.image) {
                                     allUnits.push({
                                       unitNumber: ref.unitNumber ? `${ref.unitNumber}호` : undefined,
                                       roomType: undefined,
                                       label: `${ref.unitNumber ? `${ref.unitNumber}호` : "참고"} (다른 호실)`,
                                       images: [ref.image],
                                       isReference: true,
                                     });
                                   }
                                   if (allUnits.length === 0) return;
                                   setLightbox({ units: allUnits, unitIdx: 0 });
                                 }}

                                className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/thumb:bg-black/30 transition-colors"
                              >
                                <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity drop-shadow-lg" />
                             </button>
                               );
                             })()}
                              {/* 확인일 배지 제거 */}
                           </div>}

                          {/* ②연락처 이모티콘 컬럼 — 건물주/관리인/세입자 (모바일/게스트에서는 숨김) */}
                          {!isMobile && !isGuest && <div className="w-[28px] flex-shrink-0 flex flex-col border-l border-border/30">
                            <ContactEmojiRow propId={prop.id} type="owner" number={prop.contactOwner ?? null} number2={prop.contactOwner2 ?? null} />
                            <ContactEmojiRow propId={prop.id} type="manager" number={prop.contactManager ?? null} />
                            <ContactEmojiRow propId={prop.id} type="tenant" number={prop.contactTenant ?? null} />
                          </div>}

                          {/* ③메인 정보 — 3줄 고정 레이아웃 */}
                          <AddressToggleCard
                            prop={prop}
                            idx={idx}
                            buildingMemo={buildingMemo}
                            roomMemo={roomMemo}
                            buildingPw={buildingPw}
                            roomPw={roomPw}
                            regDate={regDate}
                            chkDate={chkDate}
                            isAdmin={isAdmin}
                            userId={authUser?.userId}
                            isDealCompleted={isDealCompleted}
                            listScrollRef={listScrollRef}
                            onCheckedDateUpdated={handleCheckedDateUpdated}
                            agencyInfo={myAgencyInfo}
                            isMobile={isMobile}
                            onOpenPhotos={async () => {
                              const hasOwnImages = (prop.images && prop.images.length > 0) || (prop.image && prop.image.length > 0);
                              const sameAddr = properties.filter(
                                (p) => p.address === prop.address && ((p.images && p.images.length > 0) || p.image),
                              );
                              const activeUnits: LightboxUnit[] = sameAddr.length > 0
                                ? (() => {
                                    const current = sameAddr.find((p) => p.id === prop.id);
                                    const others = sameAddr.filter((p) => p.id !== prop.id);
                                    const sorted = current ? [current, ...others] : sameAddr;
                                    // 동일 호수 중복 제거 (호수+주거형 키 기준, 첫 항목만 유지)
                                    const seen = new Set<string>();
                                    const deduped = sorted.filter((p) => {
                                      const key = `${p.unitNumber || "?"}|${p.roomType || ""}`;
                                      if (seen.has(key)) return false;
                                      seen.add(key);
                                      return true;
                                    });
                                    return deduped.map((p) => ({
                                      unitNumber: p.unitNumber ? `${p.unitNumber}호` : undefined,
                                      roomType: p.roomType || undefined,
                                      floor: p.floor || undefined,
                                      label: (p.unitNumber ? `${p.unitNumber}호` : p.title || p.address) + (p.roomType ? ` ${p.roomType}` : ""),
                                      images: p.images && p.images.length > 0 ? p.images : p.image ? [p.image] : [],
                                      isReference: p.id !== prop.id,
                                    }));
                                  })()
                                : hasOwnImages
                                  ? [{
                                      unitNumber: prop.unitNumber ? `${prop.unitNumber}호` : undefined,
                                      roomType: prop.roomType || undefined,
                                      floor: prop.floor || undefined,
                                      label: (prop.unitNumber ? `${prop.unitNumber}호` : prop.title) + (prop.roomType ? ` ${prop.roomType}` : ""),
                                      images: prop.images && prop.images.length > 0 ? prop.images : prop.image ? [prop.image] : [],
                                      isReference: false,
                                    }]
                                  : [];
                              const exclude = new Set(sameAddr.map((p) => `${p.unitNumber || "?"}|${p.roomType || ""}`));
                              if (!hasOwnImages) {
                                exclude.add(`${prop.unitNumber || "?"}|${prop.roomType || ""}`);
                              }
                              let inactiveUnits = getInactiveUnitsForAddress(prop.address, exclude);
                              if (inactiveUnits.length === 0 && !inactiveRefMap.has(prop.address)) {
                                try {
                                  const { data } = await supabase.rpc("get_reference_images", { _addresses: [prop.address] });
                                  const fetched: InactiveUnit[] = [];
                                  for (const row of (data as Array<{ address: string; unit_number: string; room_type: string; floor?: string; images: string[] }> | null) ?? []) {
                                    if (!row.images || row.images.length === 0 || !row.images[0]) continue;
                                    fetched.push({
                                      image: row.images[0],
                                      images: row.images,
                                      unitNumber: row.unit_number || "?",
                                      roomType: row.room_type || "",
                                      floor: row.floor || "",
                                      address: row.address,
                                    });
                                  }
                                  if (fetched.length > 0) {
                                    setInactiveRefMap((prev) => {
                                      const next = new Map(prev);
                                      next.set(prop.address, fetched);
                                      return next;
                                    });
                                    inactiveUnits = fetched
                                      .filter((u) => !exclude.has(`${u.unitNumber}|${u.roomType}`))
                                      .map((u) => ({
                                        unitNumber: u.unitNumber ? `${u.unitNumber}호` : undefined,
                                        roomType: u.roomType || undefined,
                                        floor: u.floor || undefined,
                                        label: `${u.unitNumber}호${u.roomType ? ` ${u.roomType}` : ""} (종료)`,
                                        images: u.images,
                                        isReference: true,
                                      }));
                                  }
                                } catch { /* noop */ }
                              }
                              const allUnits = [...activeUnits, ...inactiveUnits];
                              if (allUnits.length === 0) return;
                              setLightbox({ units: allUnits, unitIdx: 0 });
                            }}

                            fallbackImage={(() => {
                              const hasOwn = (prop.images && prop.images.length > 0) || (prop.image && prop.image.length > 0);
                              if (hasOwn) return undefined;
                              const ref = findRefImage(prop, displayProperties);
                              return ref?.image;
                            })()}
                            hasReferencePhotos={(() => {
                              const hasOwn = (prop.images && prop.images.length > 0) || (prop.image && prop.image.length > 0);
                              if (hasOwn) return false;
                              return !!findRefImage(prop, displayProperties);
                            })()}
                          />
                        </div>
                      </div>
                    </div>

                      {/* 선택 시 액션 버튼들 — 카드 너비에 균등 배분 */}
                      {expandedCardId === prop.id && isMobile && (() => {
                        const owner = prop.contactOwner?.trim();
                        const owner2 = prop.contactOwner2?.trim();
                        const manager = prop.contactManager?.trim();
                        const tenant = prop.contactTenant?.trim();
                        const hasAnyContact = !!(owner || owner2 || manager || tenant);
                        const note = prop.note ?? "";
                        const brokerMatch = note.match(/중개보수[:\s]+([^\n|]+)/);
                        const cleanMatch = note.match(/청소비[:\s]+([^\n|]+)/);
                        const dirMatch = note.match(/방향[:\s]+([^\n|]+)/);
                        const lhMatch = note.match(/LH[:\s]+([^\n|]+)/);
                        const brokerFee = brokerMatch?.[1]?.trim();
                        const cleanFee = cleanMatch?.[1]?.trim();
                        const direction = dirMatch?.[1]?.trim();
                        const lhVal = lhMatch?.[1]?.trim();
                        const memos = [prop.buildingMemo, prop.roomMemo].filter(Boolean).join(" / ");
                        let vacateFutureLabel = "";
                        if (prop.vacateDate) {
                          const vacateStr = prop.vacateDate.replace(/[^0-9\-\/\.]/g, "").replace(/\./g, "-").replace(/\//g, "-");
                          const vacateTime = new Date(vacateStr).getTime();
                          if (!isNaN(vacateTime) && vacateTime >= Date.now()) vacateFutureLabel = prop.vacateDate;
                        }
                         // 게스트/일반회원 모바일: 라벨형 단순 레이아웃 (위치/매물정보/옵션/특이사항)
                         if (isGuest || authUser?.memberType === "일반회원") {
                           const opts = prop.options ?? [];
                           const elev = prop.elevator || opts.some((o) => o.includes("엘리베이터"));
                           const petAllowed = opts.some((o) => (o.includes("반려동물") || o.includes("애완")) && !o.includes("불가"));
                           const petNo = opts.some((o) => (o.includes("반려동물") || o.includes("애완")) && o.includes("불가"));
                           const facilityList: string[] = [];
                           if (elev) facilityList.push("엘리베이터");
                           ["수도","인터넷","유선TV","CCTV","리모델링","여성전용"].forEach((k) => {
                             if (opts.some((o) => o.includes(k))) facilityList.push(k);
                           });
                            const mappedOpts = opts.map(normalizeDisplayOption);
                           const allChips = Array.from(new Set([...facilityList, ...mappedOpts]));
                             const noteParts: string[] = [];
                             if (vacateFutureLabel) noteParts.push(`퇴거예정 ${vacateFutureLabel}`);
                             if (opts.includes("복층")) noteParts.push("복층");
                             const keyMoneyM = note.match(/권리금:\s*([^\n|]+)/);
                             const keyMoneyG = keyMoneyM?.[1]?.trim();
                             if (keyMoneyG && keyMoneyG !== "0" && keyMoneyG !== "없음") noteParts.push(`권리금 ${keyMoneyG}`);

                            const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
                              <div className="flex items-start gap-2 py-1 border-b border-primary/10 last:border-0">
                                  <span className="flex-shrink-0 w-14 text-xs font-bold pt-0.5 text-muted-foreground">{label}</span>
                                <div className="flex-1 min-w-0 flex items-center gap-1 flex-wrap">{children}</div>
                              </div>
                            );
                            return (
                              <div className="flex flex-col px-2 py-1.5 border-t border-primary/15 bg-muted/30">
                                 <Row label="매물정보">
                                   {prop.buildYear && (
                                     <span className="px-1.5 py-0.5 rounded text-[11px] font-bold" style={{ background: "hsl(25 90% 92%)", color: "hsl(25 90% 35%)", border: "1px solid hsl(25 80% 65%)" }}>
                                       준{String(prop.buildYear).slice(0,4)}
                                     </span>
                                   )}
                                   {(() => {
                                     const addr = prop.address || "";
                                     const gu = addr.match(/[가-힣]+구(?![가-힣])/)?.[0];
                                     const dong = addr.match(/[가-힣]+(동|읍|면|리)(?![가-힣])/)?.[0];
                                     const isCollective = /아파트|오피스텔|연립|다세대|공동주택/.test(prop.type || "");
                                     const beonji = addr.match(/(?:동|읍|면|리)\s+(\d+(?:-\d+)?)/)?.[1];
                                     const tail = isCollective && beonji ? `${dong ?? ""} ${beonji}`.trim() : (dong ?? "");
                                     const label = [gu, tail].filter(Boolean).join(" ");
                                     if (!label) return null;
                                     return (
                                       <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                                         {label}
                                       </span>
                                     );
                                   })()}
                                   {elev && !(isMobile && (isGuest || authUser?.memberType === "일반회원")) && (
                                     <span className="px-1.5 py-0.5 rounded text-[11px] font-bold" style={{ background: "hsl(217 91% 93%)", color: "hsl(217 91% 35%)", border: "1px solid hsl(217 91% 65%)" }}>
                                       엘리베이터
                                     </span>
                                   )}
                                   <span className="flex-1" />

                                  {!(isMobile && (isGuest || authUser?.memberType === "일반회원")) && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.dispatchEvent(new CustomEvent("open-guest-detail", {
                                            detail: {
                                              info: {
                                                image: prop.images?.[0] || prop.image,
                                                address: prop.address,
                                                type: prop.type,
                                                area: prop.area,
                                                floor: prop.floor,
                                                deposit: prop.deposit,
                                                monthly: prop.monthly,
                                                regNo: prop.regNo,
                                                buildYear: prop.buildYear,
                                                dbId: prop.dbId,
                                              },
                                              partnerDetail: {
                                                propertyDbId: prop.dbId,
                                                propertyRegNo: prop.regNo,
                                                agentUserId: prop.registeredBy,
                                                propertyTitle: addressToDong(prop.address) + (prop.type ? ` ${prop.type}` : ""),
                                              },
                                            },
                                          }));
                                        }}
                                        className="px-2 py-0.5 rounded-md text-xs font-bold border"
                                        style={{ background: "white", color: "hsl(var(--primary))", borderColor: "hsl(var(--primary)/0.5)" }}
                                      >
                                        상세보기
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.dispatchEvent(new CustomEvent("open-guest-inquiry", {
                                            detail: {
                                              propertyDbId: prop.dbId,
                                              propertyRegNo: prop.regNo,
                                              agentUserId: prop.registeredBy,
                                              propertyTitle: addressToDong(prop.address) + (prop.type ? ` ${prop.type}` : ""),
                                            },
                                          }));
                                        }}
                                        className="px-2 py-0.5 rounded-md text-xs font-bold"
                                        style={{ background: "hsl(var(--primary))", color: "white" }}
                                      >
                                        문의하기
                                      </button>
                                    </>
                                  )}
                                </Row>

                               <Row label="옵션">
                                 {allChips.length > 0 ? (
                                   <GuestOptionsButton chips={allChips} />
                                 ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                 )}
                               </Row>
                                <Row label="특이사항">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                     {/* 반려동물 아이콘 */}
                                     {petAllowed && (
                                       <span className="inline-flex items-center justify-center w-6 h-6 rounded select-none" style={{ background: "#fff7ed", border: "1px solid #fdba74" }}>
                                         <img src={petIcon} alt="반려동물 가능" className="w-5 h-5 object-contain" title="반려동물 가능" style={{ imageRendering: '-webkit-optimize-contrast' }} />
                                       </span>
                                     )}
                                     {petNo && !petAllowed && (
                                       <span className="inline-flex items-center justify-center w-6 h-6 rounded select-none relative" style={{ background: "#fef2f2", border: "1px solid #fca5a5" }}>
                                         <img src={petIcon} alt="반려동물 불가" className="w-5 h-5 object-contain" title="반려동물 불가" style={{ imageRendering: '-webkit-optimize-contrast' }} />
                                         <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                           <svg width="20" height="20" viewBox="0 0 20 20"><line x1="3" y1="3" x2="17" y2="17" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" /></svg>
                                         </span>
                                       </span>
                                     )}
                                    {/* 단기 배지 */}
                                    {opts.includes("단기가능") && (
                                      <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[11px] font-bold" style={{ background: "#dbeafe", color: "#2563eb", border: "1px solid #93c5fd" }}>
                                        단기
                                      </span>
                                    )}
                                    {/* 방향 아이콘 */}
                                    {direction && (
                                      <span className="inline-flex items-center justify-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-bold" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #86efac" }}>
                                        {direction}향
                                      </span>
                                    )}
                                    {/* 나머지 텍스트 */}
                                    {noteParts.length > 0 && (
                                      <span className="text-xs text-black font-bold whitespace-pre-wrap break-words">
                                        {noteParts.join(" · ")}
                                      </span>
                                    )}
                                    {!(petAllowed || (petNo && !petAllowed) || opts.includes("단기가능") || direction) && noteParts.length === 0 && (
                                      <span className="text-xs text-muted-foreground">-</span>
                                    )}
                                  </div>
                                </Row>
                             </div>
                           );
                         }
                          // 중개사(관리자 포함) 모바일: 라벨형 행 레이아웃
                          if (isMobile) {
                            const earlyExit = note.includes("중도퇴거:");
                            const noteParts: string[] = [];
                            if (earlyExit) noteParts.push("중도퇴거");
                            if ((prop.options ?? []).includes("복층")) noteParts.push("복층");
                            if ((prop.options ?? []).includes("단기가능")) noteParts.push("단기가능");
                            const keyMoneyM2 = note.match(/권리금:\s*([^\n|]+)/);
                            const keyMoneyV = keyMoneyM2?.[1]?.trim();
                            if (keyMoneyV && keyMoneyV !== "0" && keyMoneyV !== "없음") noteParts.push(`권리금 ${keyMoneyV}`);
                            if (direction) noteParts.push(`${direction}향`);
                            const vacateMemoPart = vacateFutureLabel
                              ? `퇴거예정 ${vacateFutureLabel}`
                              : prop.availableFrom === "공실"
                                ? "공실"
                                : prop.availableFrom === "세입자 거주중"
                                  ? "거주중"
                                  : "";
                            const memoText = [vacateMemoPart, prop.buildingMemo, prop.roomMemo, prop.description]
                              .filter((t) => t && String(t).trim())
                              .join(" / ");

                            const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
                              <div className="flex items-start gap-2 py-1 border-b border-primary/10 last:border-0">
                                <span className="flex-shrink-0 w-14 text-[11px] font-bold pt-0.5 text-muted-foreground">{label}</span>
                                <div className="flex-1 min-w-0 flex items-center gap-1 flex-wrap">{children}</div>
                              </div>
                            );

                            return (
                              <div className="flex flex-col px-2 py-1.5 border-t border-primary/15 bg-muted/30">
                                {/* 연락처 */}
                                {hasAnyContact && (
                                  <Row label="연락처">
                                    {(owner || owner2) && (
                                      <button type="button" onClick={(e) => { e.stopPropagation(); setMobileContactsProp(prop); }}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px]"
                                        style={{ background: "hsl(var(--primary)/0.1)", color: "hsl(var(--primary))", border: "1px solid hsl(var(--primary)/0.3)" }}>
                                        <Phone className="w-3 h-3" /> 소유주
                                      </button>
                                    )}
                                    {manager && (
                                      <button type="button" onClick={(e) => { e.stopPropagation(); setMobileContactsProp(prop); }}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px]"
                                        style={{ background: "hsl(217 91% 93%)", color: "hsl(217 91% 35%)", border: "1px solid hsl(217 91% 65%)" }}>
                                        <Phone className="w-3 h-3" /> 관리인
                                      </button>
                                    )}
                                    {tenant && (
                                      <button type="button" onClick={(e) => { e.stopPropagation(); setMobileContactsProp(prop); }}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px]"
                                        style={{ background: "hsl(25 95% 93%)", color: "hsl(25 95% 35%)", border: "1px solid hsl(25 80% 65%)" }}>
                                        <Phone className="w-3 h-3" /> 세입자
                                      </button>
                                    )}
                                  </Row>
                                )}
                                {/* 메모 (퇴거일 포함) */}
                                <Row label="메모">
                                  {memoText ? (
                                     <span className="text-[11px] text-black font-bold whitespace-pre-wrap break-words">{memoText}</span>
                                   ) : (
                                     <span className="text-[11px] text-muted-foreground">-</span>
                                  )}
                                </Row>
                                {/* 비밀번호 (방 비번 없으면 숨김) */}
                                {(prop.buildingPassword || prop.password || prop.roomPassword) && (
                                  <Row label="비밀번호">
                                    {(prop.buildingPassword || prop.password) && (
                                      <span className="px-1.5 py-0.5 rounded font-bold text-[11px]" style={roomPasswordChipStyle}>
                                        <span className="font-bold mr-0.5">현관</span>{prop.buildingPassword || prop.password}
                                      </span>
                                    )}
                                    {prop.roomPassword && (
                                      <span className="px-1.5 py-0.5 rounded font-bold text-[11px]" style={roomPasswordChipStyle}>
                                        <span className="font-bold mr-0.5">방</span>{prop.roomPassword}
                                      </span>
                                    )}
                                  </Row>
                                )}
                                {/* 중개보수 (없으면 협의) */}
                                <Row label="중개보수">
                                  <span className="px-1.5 py-0.5 rounded font-bold text-[11px]" style={{ background: "hsl(0 85% 93%)", color: "hsl(0 85% 45%)", border: "1px solid hsl(0 85% 70%)" }}>
                                    {brokerFee || "협의"}
                                  </span>
                                  {cleanFee && (
                                    <span className="px-1.5 py-0.5 rounded font-bold text-[11px] bg-muted text-muted-foreground border border-border">청소비 {cleanFee}만</span>
                                  )}
                                  {lhVal && lhVal !== "관계없음" && (
                                    <span className="px-1.5 py-0.5 rounded font-bold text-[11px]" style={{ background: "hsl(217 91% 93%)", color: "hsl(217 91% 35%)", border: "1px solid hsl(217 91% 65%)" }}>{lhVal}</span>
                                  )}
                                </Row>

                              </div>
                            );
                          }

                          return (
                            <div className="flex flex-col gap-1.5 px-2 py-2 border-t border-primary/15 bg-muted/30 text-[11px]">
                               {/* 확인일 아이콘은 상단(건물메모 좌측)으로 이동됨 */}
                             <div className="flex items-center justify-between gap-2 flex-wrap">
                               <div className="flex items-center gap-1 flex-wrap">
                                 {isGuest ? null : (
                                   <>
                                     {!hasAnyContact && <span className="text-muted-foreground">연락처 없음</span>}
                                     {(owner || owner2) && (
                                       <button
                                         type="button"
                                         onClick={(e) => { e.stopPropagation(); setMobileContactsProp(prop); }}
                                         className="flex items-center gap-1 px-2 py-1 rounded-md font-bold text-[11px]"
                                         style={{ background: "hsl(var(--primary)/0.1)", color: "hsl(var(--primary))", border: "1px solid hsl(var(--primary)/0.3)" }}
                                       >
                                         <Phone className="w-3 h-3" /> 소유주
                                       </button>
                                     )}
                                     {manager && (
                                       <button
                                         type="button"
                                         onClick={(e) => { e.stopPropagation(); setMobileContactsProp(prop); }}
                                         className="flex items-center gap-1 px-2 py-1 rounded-md font-bold text-[11px]"
                                         style={{ background: "hsl(217 91% 93%)", color: "hsl(217 91% 35%)", border: "1px solid hsl(217 91% 65%)" }}
                                       >
                                         <Phone className="w-3 h-3" /> 관리인
                                       </button>
                                     )}
                                     {tenant && (
                                       <button
                                         type="button"
                                         onClick={(e) => { e.stopPropagation(); setMobileContactsProp(prop); }}
                                         className="flex items-center gap-1 px-2 py-1 rounded-md font-bold text-[11px]"
                                         style={{ background: "hsl(25 95% 93%)", color: "hsl(25 95% 35%)", border: "1px solid hsl(25 80% 65%)" }}
                                       >
                                         <Phone className="w-3 h-3" /> 세입자
                                       </button>
                                     )}
                                   </>
                                 )}
                               </div>

                               {/* 등록일은 1열에서 제거. 확인일은 매물 펼침(확인 버튼)에서 웹과 동일하게 노출됨 */}
                             </div>
                             {/* 퇴거 정보 행 (퇴거예정) */}
                             {vacateFutureLabel && (
                               <div className="flex items-center gap-1.5 flex-wrap">
                                 <span className="px-2 py-1 rounded-md font-extrabold text-[11px]" style={{ background: "hsl(0 85% 93%)", color: "hsl(0 85% 35%)", border: "1px solid hsl(0 85% 65%)" }}>
                                   퇴거예정 {vacateFutureLabel}
                                 </span>
                               </div>
                             )}
                             {/* 게스트/일반회원: 부가시설 & 옵션 — 버튼 클릭 시 모달로 전체 표시 */}
                             {(isGuest || authUser?.memberType === "일반회원") && (() => {
                               const opts = prop.options ?? [];
                               const elev = prop.elevator || opts.some((o) => o.includes("엘리베이터"));
                               const facilityList: string[] = [];
                               if (elev) facilityList.push("엘리베이터");
                               ["수도","인터넷","유선TV","CCTV","리모델링","여성전용"].forEach((k) => {
                                 if (opts.some((o) => o.includes(k))) facilityList.push(k);
                               });
                               const mappedOpts = opts.map(normalizeDisplayOption);
                               const allChips = Array.from(new Set([...facilityList, ...mappedOpts]));
                               if (allChips.length === 0) return null;
                               return <GuestOptionsButton chips={allChips} />;
                             })()}
                             {/* 2행: 현관비번/방비번(게스트 숨김) | 우측: 방향 */}
                             {(((!isGuest) && (prop.buildingPassword || prop.password || prop.roomPassword)) || direction) && (
                               <div className="flex items-center gap-1.5 text-[12px] flex-wrap">
                                 {!isGuest && (prop.buildingPassword || prop.password) && (
                                   <span className="px-1.5 py-0.5 rounded font-bold text-[12px]" style={roomPasswordChipStyle}>
                                     <span className="font-bold mr-0.5">현관</span>{prop.buildingPassword || prop.password}
                                   </span>
                                 )}
                                 {!isGuest && prop.roomPassword && (
                                   <span className="px-1.5 py-0.5 rounded font-bold text-[12px]" style={roomPasswordChipStyle}>
                                     <span className="font-bold mr-0.5">방</span>{prop.roomPassword}
                                   </span>
                                 )}
                                 <span className="flex-1" />
                                 {direction && (
                                   <span className="px-1.5 py-0.5 rounded font-bold text-[10px]" style={{ background: "#fff3e0", color: "#e65100", border: "1px solid #ffcc80" }}>{direction}향</span>
                                 )}
                               </div>
                             )}
                             {/* 3행: 수수료 등 부가 정보 */}
                             {(brokerFee || cleanFee || lhVal) && (
                               <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                                 {brokerFee && <span className="px-1.5 py-0.5 rounded font-bold" style={{ background: "hsl(0 85% 93%)", color: "hsl(0 85% 45%)", border: "1px solid hsl(0 85% 70%)" }}>수수료 {brokerFee}</span>}
                                 {cleanFee && <span className="px-1.5 py-0.5 rounded font-bold bg-muted text-muted-foreground border border-border">청소비 {cleanFee}만</span>}
                                 {lhVal && lhVal !== "관계없음" && <span className="px-1.5 py-0.5 rounded font-bold" style={{ background: "hsl(217 91% 93%)", color: "hsl(217 91% 35%)", border: "1px solid hsl(217 91% 65%)" }}>{lhVal}</span>}
                               </div>
                             )}
                             {/* 메모 (매물 등록/수정 시 입력한 매물 소개) */}
                             {!isGuest && prop.description && prop.description.trim() && (
                               <div className="mt-1 px-1.5 py-0.5 rounded font-bold text-[12px] whitespace-pre-wrap break-words" style={{ background: "hsl(48 100% 88%)", color: "hsl(30 90% 25%)", border: "1px solid hsl(48 90% 65%)" }}>
                                 {prop.description}
                               </div>
                             )}
                           </div>
                         );
                       })()}
                      {expandedCardId === prop.id && (
                        <div className="flex w-full border-t border-primary/20 overflow-hidden rounded-b-xl">
                          {/* 수정 버튼: 관리자 또는 본인이 등록한 매물 */}
                          {(isAdmin || (authUser?.userId && prop.registeredBy && prop.registeredBy === authUser.userId)) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!prop.memo) {
                                  alert("static 샘플 매물은 수정할 수 없습니다.\nDB에 등록된 매물만 수정 가능합니다.");
                                  return;
                                }
                                setAdminEditProp(prop);
                              }}
                              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 border-r border-primary/20 transition-colors hover:opacity-80 min-w-0"
                              style={{
                                background: prop.memo ? "hsl(var(--accent)/0.12)" : "hsl(var(--muted)/0.5)",
                              }}
                            >
                              <Pencil
                                className="w-3 h-3 flex-shrink-0"
                                style={{ color: prop.memo ? "hsl(var(--accent))" : "hsl(var(--muted-foreground))" }}
                              />
                              <span
                                className="text-[8px] font-bold leading-none"
                                style={{ color: prop.memo ? "hsl(var(--accent))" : "hsl(var(--muted-foreground))" }}
                              >
                                {prop.memo ? "수정" : "수정불가"}
                              </span>
                            </button>
                          )}
                          {!isGuest && (
                            <>
                              {/* 건축/토지 열람 버튼 */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const pid = prop.dbId || (prop.memo && prop.memo.length === 36 ? prop.memo : undefined);
                                  console.log(
                                    "📄 [건축/토지 클릭] property 전체 객체:",
                                    JSON.stringify({
                                      id: prop.id,
                                      dbId: prop.dbId,
                                      address: prop.address,
                                      memo: prop.memo,
                                    }),
                                  );
                                  console.log("🆔 전달 property_id:", pid ?? "(없음)");
                                  setPublicRecordAddress({ address: prop.address, propertyId: pid });
                                }}
                                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 border-r border-primary/20 transition-colors hover:opacity-80 min-w-0"
                                style={{ background: "hsl(142 50% 95%)" }}
                              >
                                <FileSearch className="w-3 h-3 flex-shrink-0" style={{ color: "hsl(142 60% 35%)" }} />
                                <span className="text-[8px] font-bold leading-none" style={{ color: "hsl(142 60% 35%)" }}>
                                  건축/토지
                                </span>
                              </button>
                              {/* 사진등록 */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPhotoUploadProp(prop);
                                }}
                                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 bg-blue-50 hover:bg-blue-100 transition-colors border-r border-primary/20 min-w-0"
                              >
                                <Camera className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                <span className="text-[8px] font-bold text-blue-700 leading-none">사진등록</span>
                              </button>
                              {/* 임대현황 */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLeaseProposalProp(prop);
                                }}
                                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 bg-purple-50 hover:bg-purple-100 transition-colors border-r border-primary/20 min-w-0"
                              >
                                <ClipboardList className="w-3 h-3 text-purple-600 flex-shrink-0" />
                                <span className="text-[8px] font-bold text-purple-700 leading-none">임대현황</span>
                              </button>
                              {/* 거래완료 */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDealCompleteProp(prop);
                                }}
                                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 bg-green-50 hover:bg-green-100 transition-colors border-r border-primary/20 min-w-0"
                              >
                                <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                                <span className="text-[8px] font-bold text-green-700 leading-none">거래완료</span>
                              </button>
                              {/* 오류제보 */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setErrorReportProp(prop);
                                }}
                                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 bg-red-50 hover:bg-red-100 transition-colors min-w-0"
                              >
                                <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                                <span className="text-[8px] font-bold text-red-600 leading-none">오류제보</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {isMobile && visibleOrderedDisplayProperties.length < orderedDisplayProperties.length && (
                  <button
                    type="button"
                    onClick={() => setMobileListLimit((prev) => prev + 60)}
                    className="mx-3 mb-4 rounded-lg border border-border bg-white py-2 text-xs font-bold text-foreground shadow-sm"
                  >
                    더 보기 ({orderedDisplayProperties.length - visibleOrderedDisplayProperties.length}개)
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
};

export default MapSidebar;
