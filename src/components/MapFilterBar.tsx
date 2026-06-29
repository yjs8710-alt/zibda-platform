import { useState, useRef, useEffect } from "react";
import { Search, X, SlidersHorizontal, RotateCcw, AlertCircle, Loader2, Phone, Target, Star } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { neonChipStyle } from "@/lib/neonChipStyle";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsGuest } from "@/hooks/useIsGuest";
import { useFavoritesOnly } from "@/hooks/useFavorites";
import { useNavigate } from "react-router-dom";

// ── 소유주 번호 검색 타입 (export) ─────────────────────────────────────────
export interface LandlordResult {
  id: string;
  source: "property" | "contact";
  status?: string;
  isVisible?: boolean;
  label: string;
  sublabel: string;
  badge?: string;
  price?: string;
  images?: string[];
  contactOwner: string;
  contactManager: string;
  contactBroker: string;
  type?: string;
  unitNumber?: string;
  regNo?: string;
  lat?: number;
  lng?: number;
  lotNumber?: string;
  buildingName?: string;
  dong?: string;
  address?: string;
  note?: string;
}





const SEARCH_CATEGORIES = [
  { value: "residential", short: "주거형임대", label: "주거형임대", desc: "원투룸, 주택, 빌라, 아파트, 오피스텔", route: "/residential" },
  { value: "commercial", short: "상가임대", label: "상가임대", desc: "상가, 식당·카페, 사무실, 공장·창고, 병원·학원", route: "/commercial" },
  { value: "non-residential", short: "주거형외임대·매매", label: "주거형 외 임대,매매", desc: "상가, 사무실, 창고, 임대 및 모든 종류 건물 매매", route: "/non-residential" },
  { value: "land", short: "토지", label: "토지", desc: "토지 임대 및 매매", route: "/land" },
];

const CATEGORY_TYPES = [
  { label: "상가임대", group: "임대" },
  { label: "기타임대", group: "임대" },
  { label: "매매전체", group: "매매" },
  { label: "원룸건물매매", group: "매매" },
  { label: "주택매매", group: "매매" },
  { label: "상가주택매매", group: "매매" },
  { label: "상가건물매매", group: "매매" },
  { label: "구분상가매매", group: "매매" },
  { label: "창고/공장매매", group: "매매" },
  { label: "다중매매", group: "매매" },
];

const ROOM_TYPES = ["전체", "원룸", "투룸", "쓰리룸+", "오피스텔", "투베이", "복층", "주인세대"];
const RESIDENTIAL_TYPES = ["전체", "원룸", "투베이", "투룸", "쓰리룸", "주인세대", "아파트", "오피스텔", "도시형", "연립"];
const DEAL_TYPES_RESIDENTIAL = ["전체", "월세", "전세", "단기임대"];
const DEAL_TYPES_COMMERCIAL = ["전체", "임대", "매매"];
const BUILD_YEARS = ["전체", "1년 이내", "3년 이내", "5년 이내", "10년 이내"];

const LAND_CATEGORIES = [
  "전", "답", "과수원", "목장용지", "임야", "대", "공장용지", "주차장",
  "주유소용지", "창고용지", "잡종지", "묘지", "도로", "철도용지", "제방",
  "하천", "구거", "유지", "양어장", "수도용지", "공원", "체육용지",
  "유원지", "종교용지", "사적지", "광천지", "염전",
];

const ZONE_TYPES = [
  "보전관리지역", "생산관리지역", "계획관리지역", "농림지역", "자연환경보전지역",
  "1종전용주거지역", "2종전용주거지역", "3종전용주거지역",
  "1종일반주거지역", "2종일반주거지역", "3종일반주거지역", "준주거지역",
  "중심상업지역", "일반상업지역", "근린상업지역", "유통상업지역",
  "전용공업지역", "일반공업지역", "준공업지역",
  "녹지지역", "보전녹지지역", "생산녹지지역", "자연녹지지역",
];

const BUILDING_OPTIONS = [
  { key: "엘리베이터", label: "엘리베이터" },
  { key: "리모델링", label: "리모델링" },
  { key: "수도", label: "수도" },
  { key: "주차", label: "주차 가능" },
  { key: "인터넷", label: "인터넷" },
  { key: "CCTV", label: "CCTV" },
  { key: "여성전용", label: "여성전용" },
];

const PET_OPTIONS = [
  { key: "반려동물_가능", label: "반려동물 가능" },
  { key: "반려동물_불가", label: "반려동물 불가" },
];

const ROOM_OPTIONS = [
  { key: "테라스", label: "테라스" },
  { key: "옥탑", label: "옥탑" },
  { key: "복층", label: "복층" },
  { key: "주차", label: "주차" },
  { key: "LH가능", label: "LH가능" },
  { key: "신발장", label: "신발장" },
  { key: "냉장고", label: "냉장고" },
  { key: "세탁기", label: "세탁기" },
  { key: "드럼세탁기", label: "드럼세탁기" },
  { key: "건조기", label: "건조기" },
  { key: "스타일러", label: "스타일러" },
  { key: "TV", label: "TV" },
  { key: "에어컨", label: "에어컨" },
  { key: "가스레인지", label: "가스레인지" },
  { key: "인덕션", label: "인덕션" },
  { key: "전자레인지", label: "전자레인지" },
  { key: "침대", label: "침대" },
  { key: "책상", label: "책상" },
  { key: "옷장붙박이", label: "옷장(붙)" },
  { key: "전자키", label: "전자키" },
  { key: "베란다", label: "베란다" },
];

export interface FilterState {
  dealType: string[];
  roomTypes: string[];
  depositRange: [number, number];
  monthlyRange: [number, number];
  saleRange: [number, number];
  floorRange: [number, number];
  areaRange: [number, number];
  buildYear: string[];
  buildingOptions: string[];
  roomOptions: string[];
  landCategory: string[];
  zoneType: string[];
}

export const DEFAULT_FILTERS: FilterState = {
  dealType: [],
  roomTypes: [],
  depositRange: [0, 50000],
  monthlyRange: [0, 1000],
  saleRange: [0, 200000],
  floorRange: [-2, 30],
  areaRange: [0, 200],
  buildYear: [],
  buildingOptions: [],
  roomOptions: [],
  landCategory: [],
  zoneType: [],
};

interface MapFilterBarProps {
  activeType: string;
  activeTypes?: string[];
  onTypeChange: (v: string) => void;
  query: string;
  onQueryChange: (v: string) => void;
  propertyId: string;
  onPropertyIdChange: (v: string) => void;
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
  onLandlordClick?: () => void;
  /** 소유주 검색 결과를 부모로 전달 */
  onLandlordResults?: (results: LandlordResult[], loading: boolean, searched: boolean) => void;
  /** 돋보기 버튼 클릭 시 현재 필터 매물 전체 표시 요청 */
  onSearchClick?: () => void;
  hideSearchBar?: boolean;
  topOffset?: number;
  showCategoryChips?: boolean;
  showResidentialTypes?: boolean;
  nonResidentialSubtypes?: { label: string; group: string }[];
  showRoomTypes?: boolean;
  showFloor?: boolean;
  showBuildYear?: boolean;
  showBuildingOptions?: boolean;
  showLandFilters?: boolean;
  showApartmentFilters?: boolean;
  apartmentActiveTypes?: string[];
  onApartmentTypeChange?: (t: string) => void;
  onClearApartmentTypes?: () => void;
  apartmentDealTypes?: string[];
  onApartmentDealTypeChange?: (t: string) => void;
  onClearApartmentDealTypes?: () => void;
  onClearTypeFilters?: () => void;
  /** 반경검색 모드 활성 여부 */
  radiusMode?: boolean;
  /** 반경검색 모드 토글 */
  onRadiusModeToggle?: () => void;
  /** 반경 정보 (활성 표시용) */
  radiusInfo?: { radius: number } | null;
  /** 임대 그룹/거래유형/보증금/월세 섹션 숨김 (집합건물 매매 페이지용) */
  hideRentalAndPrice?: boolean;
  /** 검색바 아래 표시할 매물 갯수 (지도 화면 안 매물) */
  propertyCount?: number;
}

function makeFormatManwon(max: number) {
  return (v: number) => {
    if (v >= max) return "무제한";
    if (v === 0) return "0";
    if (v >= 10000) return `${(v / 10000).toFixed(v % 10000 === 0 ? 0 : 1)}억`;
    return `${v.toLocaleString()}만`;
  };
}
function makeFormatArea(max: number) {
  return (v: number) => {
    if (v >= max) return "무제한";
    const sqm = (v * 3.30579).toFixed(2);
    return `${v}평(${sqm}㎡)`;
  };
}
function makeFormatFloor(min: number, max: number) {
  return (v: number) => {
    if (v >= max) return "무제한";
    return `${v}층`;
  };
}

// 입력 문자열 → 만원 단위 숫자
function parseManwon(s: string): number | null {
  const t = s.replace(/,/g, "").replace(/\s/g, "");
  if (t === "" || t === "무제한") return null;
  // 억 단위
  const uk = t.match(/^(\d+(?:\.\d+)?)억$/);
  if (uk) return Math.round(parseFloat(uk[1]) * 10000);
  const mk = t.match(/^(\d+(?:\.\d+)?)만?$/);
  if (mk) return Math.round(parseFloat(mk[1]));
  return null;
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-bold tracking-wide mb-1.5" style={{ color: "hsl(var(--foreground))" }}>
    {children}
  </p>
);

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all"
      style={
        active
          ? neonChipStyle(true)
          : { background: "transparent", color: "hsl(var(--foreground))", borderColor: "hsl(var(--border))" }
      }
    >
      {children}
    </button>
  );
}

function toggleArr(arr: string[], val: string) {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

// 범위 입력 (슬라이더 + 텍스트 입력 두 칸)
function RangeInput({
  label,
  min,
  max,
  step,
  value,
  defaultValue,
  onChange,
  format,
  parse,
  ticks,
  unit,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: [number, number];
  defaultValue: [number, number];
  onChange: (v: [number, number]) => void;
  format: (v: number) => string;
  parse: (s: string) => number | null;
  ticks: string[];
  unit?: string;
}) {
  const [minText, setMinText] = useState("");
  const [maxText, setMaxText] = useState("");

  const isDefault = value[0] === defaultValue[0] && value[1] === defaultValue[1];

  const applyMin = () => {
    const n = parse(minText);
    if (n !== null) {
      const clamped = Math.max(min, Math.min(n, value[1]));
      onChange([clamped, value[1]]);
    }
    setMinText("");
  };
  const applyMax = () => {
    const n = parse(maxText);
    if (n !== null) {
      const clamped = Math.min(max, Math.max(n, value[0]));
      onChange([value[0], clamped]);
    }
    setMaxText("");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <SectionLabel>{label}</SectionLabel>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold" style={{ color: "hsl(var(--primary))" }}>
            {format(value[0])} ~ {format(value[1])}
          </span>
          {!isDefault && (
            <button
              onClick={() => onChange(defaultValue)}
              className="text-[9px] px-1.5 py-0.5 rounded border transition-colors"
              style={{ color: "hsl(var(--destructive))", borderColor: "hsl(var(--destructive))", background: "transparent" }}
            >
              조건삭제
            </button>
          )}
        </div>
      </div>
      {/* 텍스트 직접 입력 */}
      <div className="flex items-center gap-1 mb-2">
        <input
          type="text"
          value={minText}
          onChange={(e) => setMinText(e.target.value)}
          onBlur={applyMin}
          onKeyDown={(e) => e.key === "Enter" && applyMin()}
          placeholder={format(value[0])}
          className="flex-1 h-7 px-2 rounded-lg border border-border text-[11px] bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
        />
        <span className="text-[10px] text-muted-foreground">~</span>
        <input
          type="text"
          value={maxText}
          onChange={(e) => setMaxText(e.target.value)}
          onBlur={applyMax}
          onKeyDown={(e) => e.key === "Enter" && applyMax()}
          placeholder={format(value[1])}
          className="flex-1 h-7 px-2 rounded-lg border border-border text-[11px] bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
        />
        {unit && <span className="text-[10px] text-muted-foreground whitespace-nowrap">{unit}</span>}
      </div>
      <Slider
        min={min} max={max} step={step}
        value={value}
        onValueChange={(v) => onChange(v as [number, number])}
        className="w-full"
      />
      <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
        {ticks.map((t, i) => <span key={i}>{t}</span>)}
      </div>
    </div>
  );
}

const MapFilterBar = ({
  activeType,
  activeTypes,
  onTypeChange,
  query,
  onQueryChange,
  propertyId,
  onPropertyIdChange,
  filters,
  onFiltersChange,
  onLandlordClick,
  onLandlordResults,
  onSearchClick,
  hideSearchBar = false,
  topOffset,
  showCategoryChips = false,
  showResidentialTypes = false,
  nonResidentialSubtypes,
  showRoomTypes = true,
  showFloor = true,
  showBuildYear = true,
  showBuildingOptions = false,
  showLandFilters = false,
  showApartmentFilters = false,
  apartmentActiveTypes = [],
  onApartmentTypeChange,
  onClearApartmentTypes,
  apartmentDealTypes = [],
  onApartmentDealTypeChange,
  onClearApartmentDealTypes,
  onClearTypeFilters,
  radiusMode = false,
  onRadiusModeToggle,
  radiusInfo,
  hideRentalAndPrice = false,
  propertyCount,
}: MapFilterBarProps) => {
  const [showFilter, setShowFilter] = useState(false);

  // 검색어 입력값(로컬) — 검색 버튼/Enter 클릭 시에만 commit
  const [pendingQuery, setPendingQuery] = useState(query);
  useEffect(() => { setPendingQuery(query); }, [query]);
  const commitSearch = () => {
    onQueryChange(pendingQuery);
    onPropertyIdChange("");
    onSearchClick?.();
  };

  // 매물 등록 모달이 열리면 필터 패널을 자동으로 닫음
  useEffect(() => {
    const handleClose = () => setShowFilter(false);
    window.addEventListener("close-map-filter", handleClose);
    return () => window.removeEventListener("close-map-filter", handleClose);
  }, []);

  // ── 소유주 번호 통합 검색 상태 ──
  const { user } = useAuth();
  const navigate = useNavigate();
  const isGuest = useIsGuest();
  const { enabled: favoritesOnly, toggle: toggleFavoritesOnly } = useFavoritesOnly();
  const [searchMode, setSearchMode] = useState<"normal" | "landlord">("normal");
  const [landlordQuery, setLandlordQuery] = useState("");
  const [landlordLoading, setLandlordLoading] = useState(false);
  const [landlordResults, setLandlordResults] = useState<LandlordResult[]>([]);
  const [landlordSearched, setLandlordSearched] = useState(false);
  const [landlordError, setLandlordError] = useState("");
  const landlordInputRef = useRef<HTMLInputElement>(null);

  const handleLandlordSearch = async () => {
    if (!landlordQuery.trim()) return;
    setLandlordSearched(true);
    setLandlordLoading(true);
    setLandlordError("");
    onLandlordResults?.([], true, true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("landlord-search", {
        body: { q: landlordQuery.trim() },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      const results = (data?.results ?? []) as LandlordResult[];
      setLandlordResults(results);
      onLandlordResults?.(results, false, true);
    } catch (e: unknown) {
      setLandlordError(e instanceof Error ? e.message : String(e));
      setLandlordResults([]);
      onLandlordResults?.([], false, true);
    } finally {
      setLandlordLoading(false);
    }
  };

  const switchToLandlord = () => {
    setSearchMode("landlord");
    // 일반 검색에 입력된 값(번지수 등)을 그대로 가져와 자동 검색 실행
    const carry = (query ?? "").trim();
    if (carry) {
      setLandlordQuery(carry);
      setLandlordSearched(true);
      setLandlordLoading(true);
      setLandlordError("");
      onLandlordResults?.([], true, true);
      supabase.functions
        .invoke("landlord-search", { body: { q: carry } })
        .then(({ data, error: fnErr }) => {
          if (fnErr) throw fnErr;
          if (data?.error) throw new Error(data.error);
          const results = (data?.results ?? []) as LandlordResult[];
          setLandlordResults(results);
          onLandlordResults?.(results, false, true);
        })
        .catch((e: unknown) => {
          setLandlordError(e instanceof Error ? e.message : String(e));
          setLandlordResults([]);
          onLandlordResults?.([], false, true);
        })
        .finally(() => setLandlordLoading(false));
    } else {
      setLandlordSearched(false);
      setLandlordResults([]);
      onLandlordResults?.([], false, false);
    }
    setTimeout(() => landlordInputRef.current?.focus(), 50);
  };
  const switchToNormal = () => {
    setSearchMode("normal");
    // landlordQuery를 일반 검색창으로 옮겨 입력값 유지
    const carry = (landlordQuery ?? "").trim();
    if (carry) {
      onQueryChange(carry);
      onPropertyIdChange("");
    }
    setLandlordQuery("");
    setLandlordSearched(false);
    setLandlordResults([]);
    onLandlordResults?.([], false, false);
  };

  const set = <K extends keyof FilterState>(key: K, val: FilterState[K]) =>
    onFiltersChange({ ...filters, [key]: val });


  const isDefault = (f: FilterState) =>
    f.dealType.length === 0 &&
    f.roomTypes.length === 0 &&
    f.depositRange[0] === 0 && f.depositRange[1] === 50000 &&
    f.monthlyRange[0] === 0 && f.monthlyRange[1] === 1000 &&
    f.saleRange[0] === 0 && f.saleRange[1] === 200000 &&
    f.floorRange[0] === -2 && f.floorRange[1] === 30 &&
    f.areaRange[0] === 0 && f.areaRange[1] === 200 &&
    f.buildYear.length === 0 &&
    f.buildingOptions.length === 0 &&
    f.roomOptions.length === 0 &&
    f.landCategory.length === 0 &&
    f.zoneType.length === 0;

  const hasTypeFilters = activeTypes ? activeTypes.some((t) => t !== "전체") : activeType !== "전체";
  const activeFilterCount = [
    hasTypeFilters,
    showApartmentFilters && apartmentActiveTypes.length > 0,
    showApartmentFilters && apartmentDealTypes.length > 0,
    filters.dealType.length > 0,
    filters.roomTypes.length > 0,
    filters.depositRange[0] !== 0 || filters.depositRange[1] !== 50000,
    filters.monthlyRange[0] !== 0 || filters.monthlyRange[1] !== 1000,
    filters.saleRange[0] !== 0 || filters.saleRange[1] !== 200000,
    filters.floorRange[0] !== -2 || filters.floorRange[1] !== 30,
    filters.areaRange[0] !== 0 || filters.areaRange[1] !== 200,
    filters.buildYear.length > 0,
    filters.buildingOptions.length > 0,
    filters.roomOptions.length > 0,
    filters.landCategory.length > 0,
    filters.zoneType.length > 0,
  ].filter(Boolean).length;

  const clearFiltersImmediately = () => {
    onFiltersChange({ ...DEFAULT_FILTERS });
    onClearTypeFilters?.();
    onClearApartmentTypes?.();
    onClearApartmentDealTypes?.();
    setShowFilter(false);
  };

  return (
    <>
      {/* 필터 패널 외부 클릭 시 닫기 (별도 적용 버튼 없이 자동 적용됨) */}
      {showFilter && (
        <div
          className="fixed inset-0 z-[999]"
          onClick={() => setShowFilter(false)}
        />
      )}
    <div
      className="mfb-pos fixed z-[1000] pointer-events-none left-2 right-2 md:right-auto md:left-4 top-[50px]"
      style={{ ['--mfb-md-top' as any]: `${topOffset ?? 96}px`, maxWidth: 600 }}
    >
      <style>{`@media (min-width: 768px){ .mfb-pos{ top: var(--mfb-md-top); } }`}</style>
      <div className="pointer-events-auto flex flex-col gap-2">

        {/* 검색바 */}
        <div className={`flex flex-col transition-all duration-200 ${hideSearchBar ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          <div
            className="flex items-center bg-white overflow-hidden rounded-xl w-full md:w-fit md:min-w-[480px]"
            style={{
              boxShadow: "0 4px 20px rgba(10,45,110,0.18)",
              flexShrink: 0,
            }}
          >
            {/* 관심매물만 보기 토글 (별표) — 게스트/일반회원만 노출 */}
            {(isGuest || user?.memberType === "일반회원") && (
            <button
              onClick={() => {
                if (user?.memberType === "일반회원") navigate("/my-page?view=activity&tab=favorites");
                else toggleFavoritesOnly();
              }}
              title={favoritesOnly ? "전체 매물 보기" : "관심매물만 보기"}
              aria-label={favoritesOnly ? "전체 매물 보기" : "관심매물만 보기"}
              className={`flex items-center gap-1 px-2.5 h-10 flex-shrink-0 transition-all ${favoritesOnly ? "rounded-l-xl" : ""}`}
              style={{
                borderRight: "1px solid hsl(var(--primary)/0.3)",
                background: favoritesOnly ? "linear-gradient(90deg, #22d3ee 0%, #a855f7 50%, #ec4899 100%)" : "transparent",
              }}
            >
              <Star
                className="w-5 h-5 md:w-3.5 md:h-3.5"
                style={{
                  color: favoritesOnly ? "#fff" : "hsl(var(--muted-foreground))",
                  fill: favoritesOnly ? "#fff" : "transparent",
                }}
                strokeWidth={2}
              />
              <span className="text-[10px] font-bold hidden md:block" style={{ color: favoritesOnly ? "#fff" : "hsl(var(--muted-foreground))" }}>
                관심매물
              </span>
            </button>
            )}

            {/* 모드 탭 — 소유주 번호 검색 (게스트/일반회원에게는 숨김) */}
            {!isGuest && (
            <button
              onClick={() => searchMode === "normal" ? switchToLandlord() : switchToNormal()}
              title={searchMode === "normal" ? "소유주 번호 검색으로 전환" : "일반 검색으로 전환"}
              className="flex items-center gap-1 px-2.5 h-10 flex-shrink-0 transition-all"
              style={{
                borderRight: `1px solid ${searchMode === "landlord" ? "hsl(var(--accent)/0.4)" : "hsl(var(--primary)/0.3)"}`,
                background: searchMode === "landlord" ? "hsl(var(--accent)/0.08)" : "transparent",
                color: searchMode === "landlord" ? "hsl(var(--accent))" : "hsl(var(--muted-foreground))",
              }}
            >
              {searchMode === "landlord"
                ? <Phone className="w-3.5 h-3.5" />
                : <Search className="w-3.5 h-3.5" />
              }
              <span className="text-[10px] font-bold hidden md:block">
                {searchMode === "landlord" ? "소유주" : "소유주검색"}
              </span>
            </button>
            )}

            {/* 입력창 */}
            {searchMode === "normal" ? (
              <div className="flex items-center flex-1 min-w-0 px-2 sm:px-3 gap-2 h-10">
                <input
                  type="text"
                  value={pendingQuery}
                  onChange={(e) => setPendingQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") commitSearch(); }}
                  placeholder="주소, 등록번호 검색"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="flex-1 min-w-0 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                />
                {(pendingQuery || query) && (
                  <button onClick={() => { setPendingQuery(""); onQueryChange(""); onPropertyIdChange(""); }} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center flex-1 min-w-0 px-2 sm:px-3 gap-2 h-10">
                <input
                  ref={landlordInputRef}
                  type="text"
                  value={landlordQuery}
                  onChange={(e) => { setLandlordQuery(e.target.value); setLandlordSearched(false); }}
                  onKeyDown={(e) => e.key === "Enter" && handleLandlordSearch()}
                  placeholder="동명, 번지, 건물명, 전화번호 검색"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="flex-1 min-w-0 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                />
                {landlordQuery && (
                  <button onClick={() => { setLandlordQuery(""); setLandlordSearched(false); setLandlordResults([]); onLandlordResults?.([], false, false); }} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* 우측 버튼들 */}
            {searchMode === "normal" ? (
              <>
                <button
                  onClick={() => setShowFilter((v) => !v)}
                  className="relative flex items-center gap-1 px-2 sm:px-3 h-10 transition-colors flex-shrink-0"
                  style={{
                    borderLeft: "1px solid hsl(var(--primary) / 0.3)",
                    background: (showFilter || activeFilterCount > 0) ? "linear-gradient(90deg, #22d3ee 0%, #a855f7 50%, #ec4899 100%)" : "transparent",
                    color: (showFilter || activeFilterCount > 0) ? "#fff" : "hsl(var(--muted-foreground))",
                  }}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">필터</span>
                  {activeFilterCount > 0 && (
                    <span
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                      style={{ background: "hsl(var(--destructive))" }}
                    >
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onPointerDown={clearFiltersImmediately}
                  onClick={clearFiltersImmediately}
                  className="flex items-center gap-1 px-2 sm:px-3 h-10 transition-colors flex-shrink-0"
                  style={{
                    borderLeft: "1px solid hsl(var(--border))",
                    background: activeFilterCount > 0 ? "hsl(var(--destructive))" : "transparent",
                    color: activeFilterCount > 0 ? "#fff" : "hsl(var(--muted-foreground))",
                    opacity: activeFilterCount > 0 ? 1 : 0.5,
                    cursor: activeFilterCount > 0 ? "pointer" : "not-allowed",
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">해제</span>
                </button>
                {onRadiusModeToggle && (
                  <button
                    onClick={onRadiusModeToggle}
                    title={radiusMode ? "반경검색 종료" : "지도 클릭 후 드래그로 반경 지정"}
                    className="relative hidden md:flex items-center gap-1 px-2 sm:px-2.5 h-10 transition-all flex-shrink-0"
                    style={{
                      borderLeft: "1px solid hsl(var(--border))",
                      background: radiusMode ? "linear-gradient(90deg, #22d3ee 0%, #a855f7 50%, #ec4899 100%)" : "transparent",
                      color: radiusMode ? "#fff" : "hsl(var(--muted-foreground))",
                    }}
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-bold whitespace-nowrap hidden md:inline">
                      {radiusMode && radiusInfo
                        ? `반경 ${radiusInfo.radius >= 1000 ? (radiusInfo.radius/1000).toFixed(2)+"km" : Math.round(radiusInfo.radius)+"m"}`
                        : "반경검색"}
                    </span>
                    {radiusMode && (
                      <X className="w-3 h-3 opacity-80" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => commitSearch()}
                  className="flex items-center justify-center h-10 px-3 sm:px-4 text-xs font-bold flex-shrink-0"
                  style={{
                    background: "linear-gradient(90deg, #22d3ee 0%, #a855f7 50%, #ec4899 100%)",
                    color: "#fff",
                    borderTopRightRadius: "12px",
                    borderBottomRightRadius: "12px",
                    margin: "-2px -2px -2px 0",
                    height: "calc(100% + 4px)",
                    minHeight: "44px",
                  }}
                >
                  <Search className="w-3.5 h-3.5" strokeWidth={2.5} />
                </button>
              </>
            ) : (
              <button
                onClick={handleLandlordSearch}
                disabled={!landlordQuery.trim() || landlordLoading}
                className="flex items-center justify-center h-10 px-4 text-xs font-bold transition-colors disabled:opacity-40"
                style={{ background: "linear-gradient(90deg, #22d3ee 0%, #a855f7 50%, #ec4899 100%)", color: "#fff", borderRadius: "0 calc(var(--radius) - 2px) calc(var(--radius) - 2px) 0" }}
              >
                {landlordLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" strokeWidth={2.5} />}
              </button>
            )}
          </div>
          {/* 매물 갯수 표시 (지도 화면 안 매물, 확대/축소에 따라 갱신) */}
          {typeof propertyCount === "number" && !hideSearchBar && (
            <div className="hidden md:flex items-center gap-1.5 mt-1.5 px-3 py-1 bg-white rounded-full w-fit"
              style={{ boxShadow: "0 2px 8px rgba(10,45,110,0.12)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "hsl(var(--primary))" }} />
              <span className="text-[11px] font-bold" style={{ color: "hsl(var(--primary))" }}>
                지도 매물 {propertyCount.toLocaleString()}개
              </span>
            </div>
          )}
        </div>

        {/* 상세 필터 패널 */}
        {showFilter && (
          <div
            className="bg-white rounded-xl border border-border flex flex-col overflow-hidden"
            style={{ boxShadow: "0 8px 32px rgba(10,45,110,0.15)", maxHeight: "calc(100dvh - 380px)", overflowY: "auto", marginBottom: "calc(150px + env(safe-area-inset-bottom, 0px))" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-white z-10">
              <span className="text-xs font-bold text-foreground">상세 필터</span>
              {!isDefault(filters) && (
                <button
                  onClick={() => onFiltersChange({ ...DEFAULT_FILTERS })}
                  className="flex items-center gap-1 text-[10px] font-medium transition-colors hover:text-destructive"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  <RotateCcw className="w-3 h-3" />
                  초기화
                </button>
              )}
            </div>

            <div className="px-4 py-3 flex flex-col gap-4">

              {/* 아파트/오피스텔 필터 */}
              {showApartmentFilters && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <SectionLabel>종 류</SectionLabel>
                      {apartmentActiveTypes.length > 0 && (
                        <button onClick={onClearApartmentTypes}
                          className="text-[9px] px-1.5 py-0.5 rounded border transition-colors"
                          style={{ color: "hsl(var(--destructive))", borderColor: "hsl(var(--destructive))", background: "transparent" }}
                        >선택 삭제</button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {["아파트", "오피스텔", "도시형", "아파트분양권", "오피스텔분양권", "연립/다세대", "빌라분양권"].map(t => (
                        <Chip key={t} active={apartmentActiveTypes.includes(t)} onClick={() => onApartmentTypeChange?.(t)}>{t}</Chip>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <SectionLabel>매전월</SectionLabel>
                      {apartmentDealTypes.length > 0 && (
                        <button onClick={onClearApartmentDealTypes}
                          className="text-[9px] px-1.5 py-0.5 rounded border transition-colors"
                          style={{ color: "hsl(var(--destructive))", borderColor: "hsl(var(--destructive))", background: "transparent" }}
                        >선택 삭제</button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {["매매+전세+월세", "매매", "전세+월세", "전세", "월세"].map(t => (
                        <Chip key={t} active={apartmentDealTypes.includes(t)} onClick={() => onApartmentDealTypeChange?.(t)}>{t}</Chip>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* 상가 카테고리 - showCategoryChips 일 때만 */}
              {showCategoryChips && (
                <div>
                  <SectionLabel>매물 유형</SectionLabel>
                  <div className="flex flex-wrap gap-1">
                    {["임대", "매매"].map((group) => (
                      <div key={group} className="w-full">
                        <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>
                          {group}
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {CATEGORY_TYPES.filter((t) => t.group === group).map((t) => {
                            const arr = activeTypes ?? [activeType];
                            const active = arr.includes(t.label);
                            return (
                              <button
                                key={t.label}
                                onClick={() => onTypeChange(t.label)}
                                className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all"
                                style={
                                  active
                                    ? neonChipStyle(true)
                                    : { background: "transparent", color: "hsl(var(--foreground))", borderColor: "hsl(var(--border))" }
                                }
                              >
                                {t.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 비주거형 카테고리 - nonResidentialSubtypes 있을 때만 */}
              {nonResidentialSubtypes && nonResidentialSubtypes.length > 0 && (
                <div>
                  {(() => {
                    const arr = activeTypes ?? [activeType];
                    const hasSelection = !arr.includes("전체") && arr.length > 0;
                    return hasSelection ? (
                      <div className="flex justify-end mb-1.5">
                        <button
                          onClick={() => onTypeChange("전체")}
                          className="text-[9px] px-1.5 py-0.5 rounded border transition-colors"
                          style={{ color: "hsl(var(--destructive))", borderColor: "hsl(var(--destructive))", background: "transparent" }}
                        >
                          선택 삭제
                        </button>
                      </div>
                    ) : null;
                  })()}
                  <div className="flex flex-col gap-2">
                    {(hideRentalAndPrice ? ["매매"] : ["임대", "매매"]).map((group) => (
                      <div key={group}>
                        <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>
                          {group}
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(() => {
                            const arr = activeTypes ?? [activeType];
                            const allActive = arr.includes("전체") || arr.length === 0;
                            return (
                              <button
                                key="__all__"
                                onClick={() => onTypeChange("전체")}
                                className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all"
                                style={
                                  allActive
                                    ? neonChipStyle(true)
                                    : { background: "transparent", color: "hsl(var(--foreground))", borderColor: "hsl(var(--border))" }
                                }
                              >
                                전체
                              </button>
                            );
                          })()}
                          {nonResidentialSubtypes.filter((t) => t.group === group).map((t) => {
                            const arr = activeTypes ?? [activeType];
                            const key = (t as any).key ?? t.label;
                            const active = arr.includes(key);
                            return (
                              <button
                                key={key}
                                onClick={() => onTypeChange(key)}
                                className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all"
                                style={
                                  active
                                    ? neonChipStyle(true)
                                    : { background: "transparent", color: "hsl(var(--foreground))", borderColor: "hsl(var(--border))" }
                                }
                              >
                                {t.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 주거 유형 - showResidentialTypes 일 때만 */}
              {showResidentialTypes && (
                <div>
                  <SectionLabel>임대 유형</SectionLabel>
                  <div className="flex flex-wrap gap-1">
                    {RESIDENTIAL_TYPES.map((v) => {
                      const isAll = v === "전체";
                      const arr = activeTypes ?? [activeType];
                      const active = isAll ? arr.includes("전체") || arr.length === 0 : arr.includes(v);
                      return (
                        <Chip
                          key={v}
                          active={active}
                          onClick={() => onTypeChange(v)}
                        >
                          {v}
                        </Chip>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 거래 유형 */}
              {!hideRentalAndPrice && (
              <div>
                <SectionLabel>거래 유형</SectionLabel>
                <div className="flex flex-wrap gap-1">
                  {(showResidentialTypes ? DEAL_TYPES_RESIDENTIAL : DEAL_TYPES_COMMERCIAL).map((v) => {
                    const isAll = v === "전체";
                    const active = isAll ? filters.dealType.length === 0 : filters.dealType.includes(v);
                    return (
                      <Chip key={v} active={active} onClick={() => {
                        if (isAll) set("dealType", []);
                        else set("dealType", toggleArr(filters.dealType, v));
                      }}>{v}</Chip>
                    );
                  })}
                </div>
              </div>
              )}


              {/* 방 종류 */}
              {showRoomTypes && (
              <div>
                <SectionLabel>방 종류</SectionLabel>
                <div className="flex flex-wrap gap-1">
                  {ROOM_TYPES.map((v) => {
                    const isAll = v === "전체";
                    const active = isAll ? filters.roomTypes.length === 0 : filters.roomTypes.includes(v);
                    return (
                      <Chip
                        key={v}
                        active={active}
                        onClick={() => {
                          if (isAll) set("roomTypes", []);
                          else set("roomTypes", toggleArr(filters.roomTypes, v));
                        }}
                      >
                        {v}
                      </Chip>
                    );
                  })}
                </div>
              </div>
              )}

              {/* 보증금 */}
              {!hideRentalAndPrice && (
              <RangeInput
                label="보증금"
                min={0} max={50000} step={500}
                value={filters.depositRange}
                defaultValue={[0, 50000]}
                onChange={(v) => set("depositRange", v)}
                format={makeFormatManwon(50000)}
                parse={parseManwon}
                ticks={["0", "1억", "2억", "3억", "무제한"]}
              />
              )}

              {/* 월세 */}
              {!hideRentalAndPrice && (
              <RangeInput
                label="월세"
                min={0} max={1000} step={10}
                value={filters.monthlyRange}
                defaultValue={[0, 1000]}
                onChange={(v) => set("monthlyRange", v)}
                format={makeFormatManwon(1000)}
                parse={parseManwon}
                ticks={["0", "250만", "500만", "750만", "무제한"]}
              />
              )}

              {/* 매매가 - 주거형 임대에서는 제외 */}
              {!showResidentialTypes && (
              <RangeInput
                label="매매가"
                min={0} max={200000} step={1000}
                value={filters.saleRange}
                defaultValue={[0, 200000]}
                onChange={(v) => set("saleRange", v)}
                format={makeFormatManwon(200000)}
                parse={parseManwon}
                ticks={["0", "5억", "10억", "15억", "무제한"]}
              />
              )}
              {/* 층수 */}
              {showFloor && (
              <RangeInput
                label="층수"
                min={-2} max={30} step={1}
                value={filters.floorRange}
                defaultValue={[-2, 30]}
                onChange={(v) => set("floorRange", v)}
                format={makeFormatFloor(-2, 30)}
                parse={(s) => { const n = parseInt(s); return isNaN(n) ? null : n; }}
                ticks={["-2층", "0층", "10층", "20층", "무제한"]}
                unit="층"
              />
              )}

              {/* 면적 */}
              <RangeInput
                label="면적 (평)"
                min={0} max={200} step={5}
                value={filters.areaRange}
                defaultValue={[0, 200]}
                onChange={(v) => set("areaRange", v)}
                format={makeFormatArea(200)}
                parse={(s) => { const n = parseFloat(s.replace(/[평㎡()]/g, "")); return isNaN(n) ? null : n; }}
                ticks={["0", "50평", "100평", "150평", "무제한"]}
                unit="평"
              />

              {/* 준공년도 */}
              {showBuildYear && (
              <div>
                <SectionLabel>준공년도</SectionLabel>
                <div className="flex flex-wrap gap-1">
                  {BUILD_YEARS.map((v) => {
                    const isAll = v === "전체";
                    const active = isAll ? filters.buildYear.length === 0 : filters.buildYear.includes(v);
                    return (
                      <Chip key={v} active={active} onClick={() => {
                        if (isAll) set("buildYear", []);
                        else set("buildYear", toggleArr(filters.buildYear, v));
                      }}>{v}</Chip>
                    );
                  })}
                </div>
              </div>
              )}

              {/* 건물 옵션 */}
              {showBuildingOptions && (
              <div>
                <SectionLabel>옵션</SectionLabel>
                <div className="flex flex-wrap gap-1">
                  {BUILDING_OPTIONS.map(({ key, label }) => (
                    <Chip
                      key={key}
                      active={filters.buildingOptions.includes(key)}
                      onClick={() => set("buildingOptions", toggleArr(filters.buildingOptions, key))}
                    >
                      {label}
                    </Chip>
                  ))}
                </div>
              </div>
              )}

              {/* 반려동물 */}
              {showBuildingOptions && (
              <div>
                <SectionLabel>반려동물</SectionLabel>
                <div className="flex flex-wrap gap-1">
                  {PET_OPTIONS.map(({ key, label }) => (
                    <Chip
                      key={key}
                      active={filters.buildingOptions.includes(key)}
                      onClick={() => set("buildingOptions", toggleArr(filters.buildingOptions, key))}
                    >
                      {label}
                    </Chip>
                  ))}
                </div>
              </div>
              )}

              {/* 방향 */}
              {showBuildingOptions && (
              <div>
                <SectionLabel>방향</SectionLabel>
                <div className="flex flex-wrap gap-1">
                  {["동향", "서향", "남향", "북향"].map((key) => (
                    <Chip
                      key={key}
                      active={filters.roomOptions.includes(key)}
                      onClick={() => set("roomOptions", toggleArr(filters.roomOptions, key))}
                    >
                      {key}
                    </Chip>
                  ))}
                </div>
              </div>
              )}

              {/* 방 옵션 */}
              {showBuildingOptions && (
              <div>
                <SectionLabel>방 옵션</SectionLabel>
                <div className="flex flex-wrap gap-1">
                  {ROOM_OPTIONS.map(({ key, label }) => (
                    <Chip
                      key={key}
                      active={filters.roomOptions.includes(key)}
                      onClick={() => set("roomOptions", toggleArr(filters.roomOptions, key))}
                    >
                      {label}
                    </Chip>
                  ))}
                </div>
              </div>
              )}

              {/* 지목 */}
              {showLandFilters && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <SectionLabel>지목</SectionLabel>
                  {filters.landCategory.length > 0 && (
                    <button
                      onClick={() => set("landCategory", [])}
                      className="text-[9px] px-1.5 py-0.5 rounded border transition-colors"
                      style={{ color: "hsl(var(--destructive))", borderColor: "hsl(var(--destructive))", background: "transparent" }}
                    >
                      선택 삭제
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {LAND_CATEGORIES.map((v) => (
                    <Chip
                      key={v}
                      active={filters.landCategory.includes(v)}
                      onClick={() => set("landCategory", toggleArr(filters.landCategory, v))}
                    >
                      {v}
                    </Chip>
                  ))}
                </div>
              </div>
              )}

              {/* 용도지역 */}
              {showLandFilters && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <SectionLabel>용도지역</SectionLabel>
                  {filters.zoneType.length > 0 && (
                    <button
                      onClick={() => set("zoneType", [])}
                      className="text-[9px] px-1.5 py-0.5 rounded border transition-colors"
                      style={{ color: "hsl(var(--destructive))", borderColor: "hsl(var(--destructive))", background: "transparent" }}
                    >
                      선택 삭제
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {ZONE_TYPES.map((v) => (
                    <Chip
                      key={v}
                      active={filters.zoneType.includes(v)}
                      onClick={() => set("zoneType", toggleArr(filters.zoneType, v))}
                    >
                      {v}
                    </Chip>
                  ))}
                </div>
              </div>
              )}


            </div>

            {/* 적용 버튼 */}
            <div className="px-4 py-3 border-t border-border sticky bottom-0 bg-white">
              <button
                onClick={() => setShowFilter(false)}
                className="w-full h-9 rounded-full text-xs font-bold text-white transition-colors"
                style={{ background: "hsl(var(--primary))" }}
              >
                필터 적용
                {activeFilterCount > 0 && ` (${activeFilterCount}개 선택)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default MapFilterBar;
