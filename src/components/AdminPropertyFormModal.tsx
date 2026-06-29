import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { prefetchPropertySummary } from "@/lib/prefetchPropertySummary";
import cctvIcon from "@/assets/cctv_icon-v2-20260427.png";
import remodelingIcon from "@/assets/remodeling-icon-v2-20260427.png";
import tvIcon from "@/assets/tv_icon-v2-20260427.png";
import waterIcon from "@/assets/water_icon-v2-20260427.png";
import elevatorIcon from "@/assets/elevator_icon-v2-20260427.png";
import internetIcon from "@/assets/internet_icon-v2-20260427.png";
import petIcon from "@/assets/pet_icon-v2-20260427.png";
import memoIcon from "@/assets/memo_icon_new-v2-20260427.png";
import femaleOnlyIcon from "@/assets/female_only_icon-v2-20260427.png";

// ─── Image Carousel Preview (사진 등록 캐러셀) ────────────────────────────────
function ImageCarouselPreview({
  images,
  onRemove,
  onSetMain,
  onReorder,
}: {
  images: string[];
  onRemove: (url: string) => void;
  onSetMain?: (url: string) => void;
  onReorder?: (reordered: string[]) => void;
}) {
  const [idx, setIdx] = useState(0);
  const safeIdx = Math.min(idx, images.length - 1);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const pressRef = useRef<{ x: number; y: number; idx: number; moved: boolean } | null>(null);
  const DRAG_THRESHOLD = 5;

  const handleRemove = useCallback((url: string) => {
    onRemove(url);
    setIdx((i) => Math.min(i, images.length - 2));
  }, [onRemove, images.length]);

  const moveItem = (from: number, to: number) => {
    if (from === to) return;
    const arr = [...images];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    onReorder?.(arr);
    setIdx(to);
  };

  // 통합 포인터 기반 DnD (마우스 + 터치 동일)
  const onPointerDown = (e: React.PointerEvent, i: number) => {
    pressRef.current = { x: e.clientX, y: e.clientY, idx: i, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = pressRef.current;
    if (!p) return;
    if (!p.moved) {
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;
      p.moved = true;
      setDragIdx(p.idx);
    }
    const curDrag = dragIdx ?? p.idx;
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const target = el?.closest<HTMLElement>("[data-thumb-idx]");
    if (target) {
      const i = parseInt(target.dataset.thumbIdx ?? "-1", 10);
      if (!isNaN(i) && i !== curDrag) {
        setOverIdx(i);
        moveItem(curDrag, i);
        setDragIdx(i);
        pressRef.current = { ...p, idx: i, moved: true };
      }
      return;
    }
    // 메인 프리뷰 위에 드롭하면 대표(인덱스 0)로 이동
    const mainTarget = el?.closest<HTMLElement>("[data-main-drop]");
    if (mainTarget && curDrag !== 0) {
      setOverIdx(0);
      moveItem(curDrag, 0);
      setDragIdx(0);
      pressRef.current = { ...p, idx: 0, moved: true };
    }
  };
  const onPointerUp = (e: React.PointerEvent, i: number) => {
    const p = pressRef.current;
    pressRef.current = null;
    setDragIdx(null); setOverIdx(null);
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    if (p && !p.moved) setIdx(i);
  };
  const onPointerCancel = () => {
    pressRef.current = null;
    setDragIdx(null); setOverIdx(null);
  };

  if (images.length === 0) return null;

  const isMain = safeIdx === 0;

  return (
    <div className="flex flex-col gap-2">
      <div data-main-drop className="relative w-full rounded-xl overflow-hidden border border-border bg-muted" style={{ height: 280 }}>
        {/* 슬라이드 */}
        <div
          className="flex h-full w-full transition-transform duration-300"
          style={{ transform: `translateX(-${safeIdx * 100}%)` }}
        >
          {images.map((src) => (
            <div key={src} className="h-full w-full flex-shrink-0">
              <img src={src} alt="매물 사진" loading="eager" decoding="async" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>

        {/* 그라디언트 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />

        {/* 삭제 버튼 */}
        <button
          type="button"
          onClick={() => handleRemove(images[safeIdx])}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-destructive flex items-center justify-center transition-colors z-10"
        >
          <X className="w-3.5 h-3.5 text-white" />
        </button>

        {/* 대표 배지 or 대표 설정 버튼 */}
        {isMain ? (
          <span className="absolute top-2 left-2 text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full z-10">⭐ 대표</span>
        ) : (
          onSetMain && (
            <button
              type="button"
              onClick={() => { onSetMain(images[safeIdx]); setIdx(0); }}
              className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full z-10 transition-colors"
              style={{ background: "rgba(0,0,0,0.55)", color: "#fff", border: "1px solid rgba(255,255,255,0.4)" }}
            >
              대표로 설정
            </button>
          )
        )}

        {/* 좌우 화살표 */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/75 flex items-center justify-center backdrop-blur-sm transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            <button
              type="button"
              onClick={() => setIdx((i) => (i + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/75 flex items-center justify-center backdrop-blur-sm transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
            {/* 인디케이터 */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIdx(i)}
                  className="w-1.5 h-1.5 rounded-full transition-all"
                  style={{ background: i === safeIdx ? "#fff" : "rgba(255,255,255,0.45)" }}
                />
              ))}
            </div>
            {/* 장수 표시 */}
            <div className="absolute bottom-2 right-3 text-white text-[10px] font-bold bg-black/50 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
              {safeIdx + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {/* 썸네일 그리드 — 사진 전체를 누른 채로 끌어 순서 변경, 탭하면 대표 미리보기로 선택 */}
      {images.length > 1 && (
        <>
          <p className="text-[11px] text-muted-foreground -mb-1">사진을 길게 눌러 끌면 순서를 바꿀 수 있어요</p>
          <div className="flex flex-wrap gap-2">
            {images.map((src, i) => (
              <div
                key={src}
                data-thumb-idx={i}
                onPointerDown={(e) => onPointerDown(e, i)}
                onPointerMove={onPointerMove}
                onPointerUp={(e) => onPointerUp(e, i)}
                onPointerCancel={onPointerCancel}
                className="relative w-[calc((100%-1.5rem)/4)] sm:w-24 aspect-square rounded-lg overflow-hidden border-2 select-none bg-muted cursor-grab active:cursor-grabbing"
                style={{
                  touchAction: "none",
                  borderColor: i === safeIdx ? "hsl(var(--primary))" : overIdx === i ? "hsl(var(--accent))" : "transparent",
                  opacity: dragIdx === i ? 0.5 : 1,
                  transform: dragIdx === i ? "scale(1.05)" : "scale(1)",
                  boxShadow: dragIdx === i ? "0 6px 16px rgba(0,0,0,0.25)" : "none",
                  transition: "transform 180ms ease, opacity 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
                  willChange: "transform",
                }}
              >
                <img src={src} alt={`사진 ${i + 1}`} className="w-full h-full object-cover pointer-events-none" draggable={false} />
                <div className="absolute top-0 left-0 right-0 h-5 bg-gradient-to-b from-black/55 to-transparent pointer-events-none flex items-center justify-center">
                  <GripVertical className="w-3.5 h-3.5 text-white/90" />
                  <GripVertical className="w-3.5 h-3.5 text-white/90 -ml-2" />
                </div>
                {i === 0 && (
                  <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] font-bold bg-primary/85 text-white leading-4 pointer-events-none">대표</span>
                )}
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); handleRemove(src); }}
                  className="absolute top-0 right-0 w-5 h-5 rounded-bl-md bg-black/70 hover:bg-destructive flex items-center justify-center z-10"
                  title="사진 삭제"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
import { X, Phone, Eye, EyeOff, ChevronDown, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadCheongjuContact, saveCheongjuContact } from "@/lib/cheongjuContacts";

// ─── ContactField: 번호 입력 (기본 노출, 눈 아이콘으로 숨김 가능) ──────────────
import { formatPhone } from "@/lib/utils";
import { customConfirm, customAlert } from "@/lib/customDialogs";

function ContactField({
  fieldKey, label, placeholder, required, value, onChange,
}: {
  fieldKey: string; label: string; placeholder: string; required?: boolean;
  value: string; onChange: (v: string) => void;
}) {
  const [revealed, setRevealed] = useState(true); // 기본 노출
  const ic = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition";

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-foreground/70">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <div className="relative">
        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type={revealed ? "tel" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(formatPhone(e.target.value))}
          className={ic + " pl-9 pr-9"}
        />
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          title={revealed ? "숨기기" : "번호 보기"}
        >
          {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}


// ─── Types ───────────────────────────────────────────────────────────────────
export type DBPropertyForm = {
  id?: string;
  created_at?: string;
  title: string;
  building_name?: string;
  address: string;
  dong: string;
  lot_number: string;
  district?: string;
  type: string;
  room_type?: string;
  unit_number?: string;
  area: string;
  floor: string;
  deposit: string;
  monthly: string;
  manage_fee: string;
  parking: string;
  elevator: boolean;
  available_from: string;
  total_floors: string;
  build_year: string;
  description: string;
  building_memo?: string;
  room_memo?: string;
  note?: string;
  vacate_date?: string;
  building_password?: string;
  room_password?: string;
  options: string[];
  images: string[];
  views: number;
  lat: number;
  lng: number;
  is_new: boolean;
  is_hot: boolean;
  status: "active" | "hidden" | "ended";
  registered_date: string;
  checked_date?: string;
  agent_name: string;
};

// ─── Address Data (청주시 4개 구 고정) ──────────────────────────────────────
const FIXED_SIDO_ADMIN = "충북";
const CHEONGJU_SIGUNGU_ADMIN = [
  "청주시 상당구","청주시 서원구","청주시 흥덕구","청주시 청원구",
];
const DONG_MAP: Record<string, string[]> = {
  "청주시 상당구": ["가덕면","금천동","남문로1가","남문로2가","남일면","남주동","낭성면","대성동","명암동","문의면","문화동","미원면","방서동","북문로1가","북문로2가","북문로3가","산성동","서문동","석교동","수동","영동","영운동","용담동","용암동","용정동","운동동","월오동","중앙동","지북동","탑동","평촌동"],
  "청주시 서원구": ["개신동","남이면","모충동","미평동","분평동","사직동","사창동","산남동","성화동","수곡동","장성동","장암동","죽림동","현도면"],
  "청주시 흥덕구": ["가경동","강내면","강서동","남촌동","내곡동","동막동","문암동","복대동","봉명동","비하동","상신동","서촌동","석곡동","석소동","송절동","송정동","수의동","신대동","신봉동","신성동","신전동","신촌동","오송읍","옥산면","외북동","운천동","원평동","정봉동","지동동","평동","향정동","현암동","화계동","휴암동"],
  "청주시 청원구": ["내덕동","내수읍","북이면","사천동","오근장동","오동동","오창읍","외남동","외평동","외하동","우암동","율량동","정북동","정상동","정하동","주성동","주중동"],
};

// ─── Constants ────────────────────────────────────────────────────────────────
const FLOOR_OPTIONS = [
  "지하5층","지하4층","지하3층","지하2층","지하1층","0층",
  ...Array.from({ length: 50 }, (_, i) => `${i + 1}층`),
  "50층이상",
];
const ROOM_OPTIONS = [
  "냉장고","세탁기","드럼세탁기","건조기","스타일러","TV",
  "에어컨","가스레인지","인덕션","전자레인지","침대","책상",
  "옷장","신발장","복층","옥탑","테라스","주차","베란다",
];
// 부가 시설 옵션 (아이콘 뱃지로 표시)
const EXTRA_FACILITY_OPTIONS: { key: string; label: string; icon: React.ReactNode; bg: string; color: string; border: string }[] = [
  { key: "엘리베이터", label: "엘리베이터", icon: <img src={elevatorIcon} alt="엘리베이터" className="w-5 h-5 object-contain" style={{ imageRendering: '-webkit-optimize-contrast' as any }} />, bg: "#e0f2fe", color: "#0369a1", border: "#7dd3fc" },
  { key: "수도",   label: "수도",   icon: <img src={waterIcon} alt="수도" className="w-5 h-5 object-contain" style={{ imageRendering: '-webkit-optimize-contrast' as any }} />, bg: "#eff6ff", color: "#1d4ed8", border: "#93c5fd" },
  { key: "유선TV", label: "유선TV", icon: <img src={tvIcon} alt="유선TV" className="w-5 h-5 object-contain" style={{ imageRendering: '-webkit-optimize-contrast' as any }} />, bg: "#faf5ff", color: "#7e22ce", border: "#d8b4fe" },
  { key: "인터넷", label: "인터넷", icon: <img src={internetIcon} alt="인터넷" className="w-5 h-5 object-contain" style={{ imageRendering: '-webkit-optimize-contrast' as any }} />, bg: "#f0fdf4", color: "#15803d", border: "#86efac" },
  { key: "CCTV",  label: "CCTV",  icon: <img src={cctvIcon} alt="CCTV" className="w-5 h-5 object-contain" style={{ imageRendering: '-webkit-optimize-contrast' as any }} />, bg: "#f8fafc", color: "#475569", border: "#cbd5e1" },
  { key: "리모델링", label: "리모델링", icon: <img src={remodelingIcon} alt="리모델링" className="w-5 h-5 object-contain" style={{ imageRendering: '-webkit-optimize-contrast' as any }} />, bg: "#fff7ed", color: "#c2410c", border: "#fdba74" },
  { key: "여성전용", label: "여성전용", icon: <img src={femaleOnlyIcon} alt="여성전용" className="w-5 h-5 object-contain" style={{ imageRendering: '-webkit-optimize-contrast' as any }} />, bg: "#fdf2f8", color: "#be185d", border: "#f9a8d4" },
];
const DIRECTION_OPTIONS = ["동","서","남","북","동남","남서","북동","북서"];
const LH_TYPES = ["관계없음","LH가능","LH불가"] as const;
const VACANCY_TYPES = ["공실","세입자 거주중"] as const;
const BROKER_TYPES = ["일반중개","공동중개"] as const;
const TRADE_TYPES = ["임대","매매"] as const;
const BUILDING_TYPES = ["단독건물","집합건물","토지"] as const;

// 집합건물로 취급할 세부 유형 (호수별 연락처 저장/조회)
const COLLECTIVE_TYPES = ["아파트","오피스텔","빌라","연립","다세대","주상복합"] as const;
const ROOM_SUBTYPES = ["원룸","투베이","투룸","쓰리룸","포룸"] as const;
const PROPERTY_TYPE_GROUPS = [
  { group: "주거형", types: ["원룸","투베이","투룸","쓰리룸","포룸","주인세대","고시원","다가구","단독주택","아파트","오피스텔","도시형","연립","다세대","주상복합"] },
  { group: "상가", types: ["상가","사무실","공장·창고","지식산업","기타임대"] },
  { group: "매매", types: ["단독매매","다가구매매","다중매매","상가주택매매","상가건물매매","구분상가매매","창고/공장매매","지식산업매매"] },
  { group: "토지", types: ["토지"] },
];

// 매물 유형별 세부유형 목록
const ROOM_TYPE_MAP: Record<string, string[]> = {
  "원룸":     ["원룸","복층원룸","옥탑원룸","반지하원룸"],
  "투베이":   ["투베이","복층투베이"],
  "투룸":     ["투룸","복층투룸","옥탑투룸"],
  "쓰리룸":   ["쓰리룸","복층쓰리룸"],
  "아파트":   ["아파트","주상복합"],
  "오피스텔": ["오피스텔"],
  "빌라":     ["빌라","다세대","연립"],
  "고시원":   ["고시원","고시텔"],
  "주인세대": ["주인세대","단독주택"],
  "상가":     ["1층상가","2층상가","지하상가","코너상가","대형상가"],
  "사무실":   ["소형사무실","중형사무실","대형사무실","오피스","코워킹"],
  "공장·창고":["소형창고","대형창고","공장","물류센터"],
};

type LhType = typeof LH_TYPES[number];

const EMPTY: Omit<DBPropertyForm, "id" | "created_at"> = {
  title: "", building_name: "", address: "", dong: "", lot_number: "", district: "", type: "원룸",
  room_type: "", unit_number: "", area: "", floor: "", deposit: "", monthly: "",
  manage_fee: "", parking: "", elevator: false, available_from: "", total_floors: "",
  build_year: "", description: "", building_memo: "", room_memo: "", note: "",
  vacate_date: "", building_password: "", room_password: "", options: [], images: [],
  views: 0, lat: 0, lng: 0, is_new: false, is_hot: false, status: "active",
  registered_date: new Date().toISOString().slice(0, 10), checked_date: "",
  agent_name: "",
};

// Extended form state for admin (adds fields not in DBPropertyForm)
type PetType = "가능" | "불가" | "";

interface AdminFormExtended extends Omit<DBPropertyForm, "id" | "created_at"> {
  brokerType: typeof BROKER_TYPES[number];
  tradeType: typeof TRADE_TYPES[number];
  buildingType: typeof BUILDING_TYPES[number];
  direction: string;
  lhType: LhType;
  exitCleanFee: string;
  brokerFee: string;
  contactOwner: string;
  contactOwner2: string;
  extraOwners: string[];
  contactTenant: string;
  contactManager: string;
  contactBroker: string;
  roadAddress: string;
  // 다중 임대 방식
  rentModes: string[]; // ["월세", "반전세", "전세"]
  halfDeposit: string;
  halfMonthly: string;
  jeonseDeposit: string;
  earlyExit: boolean; // 세입자 중도퇴거
  buildingArea: string; // 건평
  buildingDong: string; // 집합건물 동(棟)
  landArea: string; // 대지 면적
  pet: PetType; // 반려동물 가능 여부
  keyMoney: string; // 권리금
  extraRoomTypes: string[]; // 집합건물 선택 후 추가 주거형 다중선택
}

const EMPTY_EXTENDED: AdminFormExtended = {
  ...EMPTY,
  brokerType: "일반중개",
  tradeType: "임대",
  buildingType: "단독건물",
  direction: "",
  lhType: "관계없음",
  exitCleanFee: "",
  brokerFee: "",
  contactOwner: "",
  contactOwner2: "",
  extraOwners: [],
  contactTenant: "",
  contactManager: "",
  contactBroker: "",
  roadAddress: "",
  rentModes: [],
  halfDeposit: "",
  halfMonthly: "",
  jeonseDeposit: "",
  earlyExit: false,
  buildingArea: "",
  buildingDong: "",
  landArea: "",
  pet: "",
  keyMoney: "",
  extraRoomTypes: [],
};

// ─── Shared UI Helpers ────────────────────────────────────────────────────────
const ic = `w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all bg-background text-foreground placeholder:text-muted-foreground border-border focus:border-primary focus:ring-2 focus:ring-primary/20`;

function Section({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-bold text-foreground">{label}</p>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Radio({ checked, onClick, children }: { checked: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer select-none" onClick={onClick}>
      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked ? "border-primary" : "border-muted-foreground/40"}`}>
        {checked && <span className="w-2 h-2 rounded-full bg-primary" />}
      </span>
      <span className={`text-sm ${checked ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{children}</span>
    </label>
  );
}

function AmountInput({ label, prefix, value, onChange, placeholder = "만원", noUnit = false }: {
  label: string; prefix?: string; value: string; onChange: (v: string) => void; placeholder?: string; noUnit?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-foreground/70 flex items-center gap-1">
        {prefix && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-black"
            style={{ background: "hsl(var(--primary))", color: "#fff" }}>
            {prefix}
          </span>
        )}
        {label}
      </label>
      <div className="relative">
        <input type="text" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
          className={ic + (noUnit ? "" : " pr-10")} />
        {!noUnit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">만원</span>}
      </div>
    </div>
  );
}

const AdminSelect = ({ value, onChange, placeholder, options, disabled }: {
  value: string; onChange: (v: string) => void; placeholder: string; options: string[]; disabled?: boolean;
}) => (
  <div className="relative">
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
      className={`w-full px-3 py-2.5 text-sm rounded-xl border outline-none appearance-none bg-background text-foreground border-border focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-40 disabled:cursor-not-allowed pr-8`}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
  </div>
);

// ─── AdminPropertyFormModal ───────────────────────────────────────────────────
interface AdminPropertyFormModalProps {
  initial: Partial<DBPropertyForm> | null;
  onClose: () => void;
  onSaved?: () => void;
}

const AdminPropertyFormModal = ({ initial, onClose, onSaved }: AdminPropertyFormModalProps) => {
  // note에서 연락처 + 다중 임대방식 파싱 (수정 시 폼에 자동 채움)
  const SALE_TYPES = ["매매","단독매매","건물매매","다가구매매","다중매매","상가주택매매","상가건물매매","구분상가매매","창고/공장매매"];

  const parseContactsFromInitial = (init: Partial<DBPropertyForm> | null) => {
    if (!init) return {};
    const contacts: Partial<AdminFormExtended> = {};

    // tradeType 복원: type 필드가 매매 계열이면 "매매", 아니면 "임대"
    const noteStr2 = init.note ?? "";
    if (SALE_TYPES.includes(init.type ?? "") || noteStr2.includes("매매가:")) {
      contacts.tradeType = "매매";
    } else if (noteStr2.includes("월세") || noteStr2.includes("전세") || noteStr2.includes("반전세")) {
      contacts.tradeType = "임대";
    } else if (init.monthly && init.monthly !== "0") {
      contacts.tradeType = "임대";
    }

    const noteStr = init.note ?? init.agent_name ?? "";
    const ownerMatch = noteStr.match(/건물주(?!2)[:\s]+([0-9\-]+)/);
    const owner2Match = noteStr.match(/건물주2[:\s]+([0-9\-]+)/);
    const managerMatch = noteStr.match(/관리인[:\s]+([0-9\-]+)/);
    const tenantMatch = noteStr.match(/세입자[:\s]+([0-9\-]+)/);
    if (ownerMatch) contacts.contactOwner = ownerMatch[1].trim();
    if (owner2Match) contacts.contactOwner2 = owner2Match[1].trim();
    if (managerMatch) contacts.contactManager = managerMatch[1].trim();
    if (tenantMatch) contacts.contactTenant = tenantMatch[1].trim();
    // 건물주3, 4, 5... extraOwners
    const extras: string[] = [];
    for (let i = 3; i <= 20; i++) {
      const mm = noteStr.match(new RegExp(`건물주${i}[:\\s]+([0-9\\-]+)`));
      if (mm) extras.push(mm[1].trim());
    }
    contacts.extraOwners = extras;
    const roadMatch = noteStr.match(/도로명[:\s]+([^\n|]+)/);
    if (roadMatch) contacts.roadAddress = roadMatch[1].trim();

    // 방향, LH, 청소비, 중개보수, 중도퇴거 파싱
    const dirMatch = noteStr.match(/방향[:\s]+([^\n|]+)/);
    const lhMatch2 = noteStr.match(/LH[:\s]+([^\n|]+)/);
    const cleanMatch2 = noteStr.match(/청소비[:\s]+([^\n|]+)/);
    const brokerFeeMatch2 = noteStr.match(/중개보수[:\s]+([^\n|]+)/);
    if (dirMatch) contacts.direction = dirMatch[1].trim();
    if (lhMatch2) contacts.lhType = lhMatch2[1].trim() as LhType;
    if (cleanMatch2) contacts.exitCleanFee = cleanMatch2[1].trim();
    if (brokerFeeMatch2) contacts.brokerFee = brokerFeeMatch2[1].trim();
    if (noteStr.includes("중도퇴거:")) contacts.earlyExit = true;
    const buildingAreaMatch = noteStr.match(/건평[:\s]+([^\n|]+)/);
    if (buildingAreaMatch) contacts.buildingArea = buildingAreaMatch[1].trim();
    const buildingDongMatch = noteStr.match(/동\(棟\)[:\s]+([^\n|]+)/);
    if (buildingDongMatch) contacts.buildingDong = buildingDongMatch[1].trim();
    const landAreaMatch = noteStr.match(/대지[:\s]+([^\n|]+)/);
    if (landAreaMatch) contacts.landArea = landAreaMatch[1].trim();
    const keyMoneyMatch = noteStr.match(/권리금[:\s]+([^\n|]+)/);
    if (keyMoneyMatch) contacts.keyMoney = keyMoneyMatch[1].trim();

    // 반려동물 가능 여부 파싱 (options 배열에서)
    const opts: string[] = Array.isArray(initial?.options) ? (initial.options as string[]) : [];
    const petOpt = opts.find((o) => o.startsWith("반려동물_"));
    if (petOpt) contacts.pet = petOpt.replace("반려동물_", "") as PetType;

    const roomTypeParts = (init.room_type ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    contacts.extraRoomTypes = roomTypeParts.filter((rt) => (ROOM_SUBTYPES as readonly string[]).includes(rt));

    // 다중 임대방식 파싱 (PropertyRegisterModal과 동일한 note 포맷)
    const modes: string[] = [];
    const wolseMatch = noteStr.match(/월세: 보증금 ([^\n/]+)만원 \/ 월세 ([^\n]+)만원/);
    const halfMatch  = noteStr.match(/반전세: 보증금 ([^\n/]+)만원 \/ 월세 ([^\n]+)만원/);
    const jeonseMatch = noteStr.match(/(?<!반)전세: 보증금 ([^\n]+?)만원(?!\s*\/)/);
    if (wolseMatch)  modes.push("월세");
    if (halfMatch)   { modes.push("반전세"); contacts.halfDeposit = halfMatch[1].trim(); contacts.halfMonthly = halfMatch[2].trim(); }
    if (jeonseMatch) { modes.push("전세");  contacts.jeonseDeposit = jeonseMatch[1].trim(); }
    if (modes.length > 0) contacts.rentModes = modes;

    return contacts;
  };

  const [form, setForm] = useState<AdminFormExtended>(() => {
    const merged = {
      ...EMPTY_EXTENDED,
      ...(initial ?? {}),
      ...parseContactsFromInitial(initial),
    };
    // elevator boolean → 부가시설 옵션으로 매핑
    if (initial?.elevator && !merged.options.includes("엘리베이터")) {
      merged.options = [...merged.options, "엘리베이터"];
    }
    // 수정 모드: DB에 저장되지 않는 buildingType을 type으로부터 자동 추론
    if (initial?.type) {
      if (initial.type === "토지") {
        merged.buildingType = "토지";
      } else if (COLLECTIVE_TYPES.some(ct => ct === initial.type) || ["아파트매매","오피스텔매매"].includes(initial.type)) {
        merged.buildingType = "집합건물";
      }
      // 그 외는 EMPTY_EXTENDED 기본값 "단독건물" 유지
    }
    if (typeof merged.room_type === "string" && merged.room_type.includes(",")) {
      merged.room_type = merged.room_type.split(",").map((s) => s.trim()).filter(Boolean)[0] ?? "";
    }
    return merged;
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2 | 3>(1);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [contactAutoFilled, setContactAutoFilled] = useState(false);
  // 자동 채워진 연락처 값 추적 — 호수가 바뀌어 매칭 안되면 이전 자동값만 제거
  const autoFilledContactsRef = useRef<{
    contactOwner?: string;
    contactOwner2?: string;
    extraOwners?: string[];
    contactManager?: string;
    contactBroker?: string;
  }>({});
  const [showOwner2, setShowOwner2] = useState(!!form.contactOwner2);
  const [showOneRoomModal, setShowOneRoomModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 창고/공장매매 포함 모든 매매 타입: 층수·호수·평수·관리비·청소비·권리금 제외, 대지·건평 표시
  const isWarehouseSale = SALE_TYPES.includes(form.type);

  const set = <K extends keyof AdminFormExtended>(k: K, v: AdminFormExtended[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // 충북 고정 — 청주시 4개 구만 표시
  const [sigungu, setSigungu] = useState(form.district ? `청주시 ${form.district}` : "");
  const [dong, setDong] = useState(form.dong ?? "");
  const sigunguList = CHEONGJU_SIGUNGU_ADMIN;
  const dongList = DONG_MAP[sigungu] ?? [];

  const geocodeAddress = useCallback(async (fullAddress: string) => {
    if (!fullAddress.trim()) return;
    setGeocoding(true);
    try {
      const { data, error } = await supabase.functions.invoke("geocode", {
        body: { address: fullAddress },
      });
      if (!error && data?.success) {
        const updates: Partial<typeof form> = { lat: data.lat, lng: data.lng };
        // 도로명주소 자동 저장
        if (data.roadAddress && !form.roadAddress) {
          updates.roadAddress = data.roadAddress as string;
        }
        // 도로명으로 검색했을 때 지번 주소로 자동 변환
        if (data.jibunAddress) {
          const jibun = data.jibunAddress as string;
          const jibunMatch = jibun.match(/([가-힣]+[동리읍면])\s+([\d-]+)$/);
          if (jibunMatch) {
            const jibunDong = jibunMatch[1];
            const jibunLot = jibunMatch[2];
            updates.dong = jibunDong;
            updates.lot_number = jibunLot;
            setForm((f) => {
              const sg = f.district ? `청주시 ${f.district}` : "";
              const newAddress = ["충북", sg, jibunDong, jibunLot].filter(Boolean).join(" ");
              return { ...f, ...updates, address: newAddress };
            });
            setDong(jibunDong);
            return;
          }
        }
        setForm((f) => ({ ...f, ...updates }));
      }
    } catch {
      // 좌표 조회 실패 시 무시 (저장은 계속 진행)
    } finally {
      setGeocoding(false);
    }
  }, []);


  // 청주 연락처 자동 불러오기
  // 정확한 주소(동+번지[+호]) 일치만 매칭하여 잘못된 번호 노출을 방지
  const fetchContactFromDB = useCallback(async (dongVal: string, lotVal: string, unitVal?: string, isCollective?: boolean) => {
    if (!dongVal || !lotVal) return; // 번지 없으면 매칭 안 함
    if (isCollective && !unitVal) return; // 집합건물은 호수까지 있어야만 매칭
    const contacts = await loadCheongjuContact({
      dong: dongVal,
      lotNumber: lotVal,
      unitNumber: isCollective ? unitVal : null,
      fallbackFromProperties: !isCollective, // 집합건물은 정확 호수 매칭만 (폴백 X)
    });
    const prevAuto = autoFilledContactsRef.current;
    if (contacts) {
      setForm((f) => ({
        ...f,
        // 이전 자동값이거나 비어있을 때만 새 값으로 교체 (사용자 입력 보존)
        contactOwner:   (!f.contactOwner   || f.contactOwner   === prevAuto.contactOwner)   ? (contacts.contactOwner   || "") : f.contactOwner,
        contactOwner2:  (!f.contactOwner2  || f.contactOwner2  === prevAuto.contactOwner2)  ? (contacts.contactOwner2  || "") : f.contactOwner2,
        extraOwners:    (f.extraOwners.length === 0 || JSON.stringify(f.extraOwners) === JSON.stringify(prevAuto.extraOwners)) ? contacts.extraOwners : f.extraOwners,
        contactManager: (!f.contactManager || f.contactManager === prevAuto.contactManager) ? (contacts.contactManager || "") : f.contactManager,
        contactBroker:  (!f.contactBroker  || f.contactBroker  === prevAuto.contactBroker)  ? (contacts.contactBroker  || "") : f.contactBroker,
      }));
      autoFilledContactsRef.current = { ...contacts };
      setContactAutoFilled(true);
      setTimeout(() => setContactAutoFilled(false), 4000);
    } else if (isCollective) {
      // 집합건물에서 호수 매칭 실패 → 이전에 자동 채운 값만 제거 (사용자 입력 보존)
      if (prevAuto.contactOwner || prevAuto.contactOwner2 || (prevAuto.extraOwners?.length ?? 0) > 0 || prevAuto.contactManager || prevAuto.contactBroker) {
        setForm((f) => ({
          ...f,
          contactOwner:   f.contactOwner   === prevAuto.contactOwner   ? "" : f.contactOwner,
          contactOwner2:  f.contactOwner2  === prevAuto.contactOwner2  ? "" : f.contactOwner2,
          extraOwners:    JSON.stringify(f.extraOwners) === JSON.stringify(prevAuto.extraOwners) ? [] : f.extraOwners,
          contactManager: f.contactManager === prevAuto.contactManager ? "" : f.contactManager,
          contactBroker:  f.contactBroker  === prevAuto.contactBroker  ? "" : f.contactBroker,
        }));
      }
      autoFilledContactsRef.current = {};
    }
  }, []);

  const updateAddress = (sg: string, d: string, lot: string) => {
    const parts = [FIXED_SIDO_ADMIN, sg, d, lot].filter(Boolean);
    const fullAddress = parts.join(" ");
    set("address", fullAddress);
    if (sg.includes("청주시 ")) set("district", sg.replace("청주시 ", ""));
    set("dong", d);
    set("lot_number", lot);
    // 동이 있으면 좌표 자동 조회 (번지 없어도 동 단위로 조회)
    if (d) geocodeAddress(fullAddress);
    // 등록/수정 모두 주소 기준 연락처 자동 불러오기
    const isCollective = form.buildingType === "집합건물" || COLLECTIVE_TYPES.some((t) => t === form.type);
    if (d && !isCollective) fetchContactFromDB(d, lot, undefined, false);
    // 동+번지 입력 시 기존 등록 매물에서 총층수·건축년도 자동 조회
    if (d && lot) fetchBuildingInfoFromDB(d, lot);
  };

  // 기존 매물에서 총층수·건축년도·건물명 자동 조회
  const fetchBuildingInfoFromDB = useCallback(async (dongVal: string, lotVal: string) => {
    if (!dongVal || !lotVal) return;
    const { data } = await supabase
      .from("properties")
      .select("total_floors,build_year,building_name,building_password")
      .eq("dong", dongVal)
      .eq("lot_number", lotVal)
      .not("total_floors", "eq", "")
      .order("registered_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setForm((f) => ({
        ...f,
        total_floors:      f.total_floors      || data.total_floors      || f.total_floors,
        build_year:        f.build_year        || data.build_year        || f.build_year,
        building_name:     f.building_name     || data.building_name     || f.building_name,
        building_password: f.building_password || data.building_password || f.building_password,
      }));
    }
  }, []);

  // ── 집합건물/아파트/오피스텔/빌라/연립 등: 호수 입력 시 해당 호수 소유주 연락처 자동 로드 ──
  const handleUnitNumberChange = useCallback((unitVal: string) => {
    set("unit_number", unitVal);
    const isCollective = form.buildingType === "집합건물" || COLLECTIVE_TYPES.some((t) => t === form.type);
    if (isCollective && form.dong) {
      if (unitVal) {
        fetchContactFromDB(form.dong, form.lot_number, unitVal, true);
      } else {
        // 호수가 비워졌을 때: 이전에 자동 채운 값 제거
        const prevAuto = autoFilledContactsRef.current;
        if (prevAuto.contactOwner || prevAuto.contactOwner2 || (prevAuto.extraOwners?.length ?? 0) > 0 || prevAuto.contactManager || prevAuto.contactBroker) {
          setForm((f) => ({
            ...f,
            contactOwner:   f.contactOwner   === prevAuto.contactOwner   ? "" : f.contactOwner,
            contactOwner2:  f.contactOwner2  === prevAuto.contactOwner2  ? "" : f.contactOwner2,
            extraOwners:    JSON.stringify(f.extraOwners) === JSON.stringify(prevAuto.extraOwners) ? [] : f.extraOwners,
            contactManager: f.contactManager === prevAuto.contactManager ? "" : f.contactManager,
            contactBroker:  f.contactBroker  === prevAuto.contactBroker  ? "" : f.contactBroker,
          }));
          autoFilledContactsRef.current = {};
        }
      }
    }
  }, [form.buildingType, form.type, form.dong, form.lot_number, fetchContactFromDB]);

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newUrls: string[] = [];
    const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"));

    // 병렬 업로드: 각 파일에 고유 타임스탬프+인덱스로 경로 중복 방지
    const uploadResults = await Promise.all(
      fileArray.map(async (file, i) => {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const uniqueId = `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`;
        const path = `properties/${uniqueId}.${ext}`;
        const { error } = await supabase.storage
          .from("property-images")
          .upload(path, file, { upsert: false });
        if (error) {
          console.error(`이미지 업로드 실패 (${file.name}):`, error.message);
          return null;
        }
        const { data: urlData } = supabase.storage
          .from("property-images")
          .getPublicUrl(path);
        return urlData?.publicUrl ?? null;
      })
    );

    const successUrls = uploadResults.filter((url): url is string => !!url);
    if (successUrls.length < fileArray.length) {
      alert(`${fileArray.length}장 중 ${successUrls.length}장 업로드 성공. 일부 실패했습니다.`);
    }
    if (successUrls.length > 0) {
      setForm((f) => ({ ...f, images: [...(f.images ?? []), ...successUrls] }));
    }
    // input 초기화 (같은 파일 재선택 가능하도록)
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploading(false);
  };

  const toggleOption = (opt: string) => {
    setForm((f) => ({
      ...f,
      options: f.options.includes(opt) ? f.options.filter((o) => o !== opt) : [...f.options, opt],
    }));
  };

  const handleSave = async () => {
    if (!form.type) { alert("유형을 선택해주세요."); return; }
    if (!form.address.trim()) { alert("주소를 입력해주세요."); return; }
    if (!form.contactOwner?.trim() && !form.contactManager?.trim()) {
      await customAlert("소유주 또는 관리인 연락처 중 하나는 입력해주세요.");
      return;
    }
    setSaving(true);

    // 좌표가 없거나 도로명 주소이거나 도로명정보가 없는 경우 geocode 호출
    let finalLat = form.lat;
    let finalLng = form.lng;
    let finalAddress = form.address;
    let finalDong = form.dong;
    let finalLotNumber = form.lot_number;
    let finalRoadAddress = form.roadAddress;
    const isRoadAddr = form.lot_number?.match(/[가-힣].*(로|길)\s/);
    if (!finalLat || !finalLng || isRoadAddr || !finalRoadAddress) {
      try {
        const geoQuery = isRoadAddr ? form.lot_number : form.address;
        const { data } = await supabase.functions.invoke("geocode", {
          body: { address: geoQuery },
        });
        if (data?.success) {
          if (!finalLat || !finalLng) {
            finalLat = data.lat;
            finalLng = data.lng;
          }
          // 도로명→지번 변환
          if (isRoadAddr && data.jibunAddress) {
            const jibunMatch = (data.jibunAddress as string).match(/([가-힣]+[동리읍면])\s+([\d-]+)$/);
            if (jibunMatch) {
              finalDong = jibunMatch[1];
              finalLotNumber = jibunMatch[2];
              const sg = form.district ? `청주시 ${form.district}` : "";
              finalAddress = ["충북", sg, finalDong, finalLotNumber].filter(Boolean).join(" ");
            }
          }
          // 도로명주소 저장
          if (data.roadAddress && !finalRoadAddress) {
            finalRoadAddress = data.roadAddress as string;
          }
        }
      } catch {
        // 좌표 없이 저장 계속
      }
    }

    // note 필드: 연락처 + 다중 임대방식 저장
    const isRent = form.tradeType === "임대";
    const isSale = form.tradeType === "매매";
    const hasWolse  = isRent && (form.rentModes.includes("월세") || form.rentModes.length === 0);
    const hasHalf   = isRent && form.rentModes.includes("반전세");
    const hasJeonse = isRent && form.rentModes.includes("전세");

    // 매매: deposit=매매가, monthly="" / 임대: 전세단독이면 jeonseDeposit→deposit
    const finalDeposit = isSale
      ? form.deposit
      : (hasJeonse && !hasWolse && !hasHalf && form.jeonseDeposit)
        ? form.jeonseDeposit
        : form.deposit;
    const finalMonthly = isSale
      ? ""
      : (hasJeonse && !hasWolse && !hasHalf) ? "0" : form.monthly;

    const rentNotes: string[] = [];
    if (isRent) {
      if (hasWolse && (form.deposit || form.monthly))
        rentNotes.push(`월세: 보증금 ${form.deposit || "0"}만원 / 월세 ${form.monthly || "0"}만원`);
      if (hasHalf && (form.halfDeposit || form.halfMonthly))
        rentNotes.push(`반전세: 보증금 ${form.halfDeposit || "0"}만원 / 월세 ${form.halfMonthly || "0"}만원`);
      if (hasJeonse && form.jeonseDeposit)
        rentNotes.push(`전세: 보증금 ${form.jeonseDeposit}만원`);
    } else if (isSale && form.deposit) {
      rentNotes.push(`매매가: ${form.deposit}만원`);
    }

    const noteStr = [
      form.contactOwner && `건물주: ${form.contactOwner}`,
      form.contactOwner2 && `건물주2: ${form.contactOwner2}`,
      ...form.extraOwners.map((o, i) => o && `건물주${i + 3}: ${o}`).filter(Boolean),
      form.contactTenant && `세입자: ${form.contactTenant}`,
      form.contactManager && `관리인: ${form.contactManager}`,
      ...rentNotes,
      form.direction && `방향: ${form.direction}`,
      form.lhType && form.lhType !== "관계없음" && `LH: ${form.lhType}`,
      form.exitCleanFee && `청소비: ${form.exitCleanFee}`,
      form.brokerFee && `중개보수: ${form.brokerFee}`,
      form.earlyExit && `중도퇴거: 세입자중도퇴거`,
      form.buildingArea && `건평: ${form.buildingArea}`,
      form.buildingDong && `동(棟): ${form.buildingDong}`,
      form.landArea && `대지: ${form.landArea}`,
      form.keyMoney && `권리금: ${form.keyMoney}`,
      finalRoadAddress && `도로명: ${finalRoadAddress}`,
    ].filter(Boolean).join("\n");

    const payload = {
      title: form.title || "",
      building_name: form.building_name || null,
      address: finalAddress || "",
      dong: finalDong ?? "",
      lot_number: finalLotNumber ?? "",
      district: form.district || null,
      type: form.type || "",
      room_type: (() => {
        const base = form.room_type || form.type;
        if ((COLLECTIVE_TYPES as readonly string[]).includes(form.type) && form.extraRoomTypes.length > 0) {
          return [base, ...form.extraRoomTypes].filter(Boolean).join(",");
        }
        return form.room_type || null;
      })(),
      unit_number: form.unit_number || null,
      area: (form.area && !form.area.includes("평")) ? (() => { const n = parseFloat(form.area.replace(/[^0-9.]/g, "")); return !isNaN(n) && n > 0 ? `${(n / 3.3058).toFixed(1)}평` : form.area; })() : (form.area ?? ""),
      floor: form.floor ?? "",
      deposit: finalDeposit ?? "",
      monthly: finalMonthly ?? "",
      manage_fee: form.manage_fee ?? "",
      parking: form.parking ?? "",
      elevator: form.options.includes("엘리베이터"),
      available_from: form.available_from ?? "",
      total_floors: form.total_floors ?? "",
      build_year: form.build_year ?? "",
      description: form.description ?? "",
      building_memo: null,
      room_memo: null,
      note: noteStr || null,
      vacate_date: form.vacate_date || null,
      building_password: form.building_password || null,
      room_password: form.room_password || null,
      options: (() => {
        const base = Array.isArray(form.options) ? form.options.filter((o) => !o.startsWith("반려동물_")) : [];
        return form.pet ? [...base, `반려동물_${form.pet}`] : base;
      })(),
      images: Array.isArray(form.images) ? form.images : [],
      views: Number(form.views) || 0,
      lat: Number(finalLat) || 0,
      lng: Number(finalLng) || 0,
      is_new: false,
      is_hot: false,
      status: form.status ?? "active",
      registered_date: form.registered_date || new Date().toISOString().slice(0, 10),
      checked_date: form.checked_date || null,
      agent_name: form.agent_name || "",
    };

    // ── 중복 등록 방지: 같은 주소(동+번지) + 같은 호수 → 등록/수정 차단 ──
    // 수정 시 주소/호수가 변경되지 않았다면 중복 체크를 건너뜀
    const norm = (v: unknown) => (v == null ? "" : String(v).trim());
    const addrUnitUnchanged = !!initial?.id
      && norm(initial.dong) === norm(finalDong)
      && norm(initial.lot_number) === norm(finalLotNumber)
      && norm(initial.unit_number) === norm(form.unit_number);
    if (!addrUnitUnchanged) {
      try {
        let dupQuery = supabase
          .from("properties")
          .select("id")
          .eq("dong", finalDong ?? "")
          .eq("lot_number", finalLotNumber ?? "")
          .eq("status", "active");
        if (form.unit_number) {
          dupQuery = dupQuery.eq("unit_number", form.unit_number);
        } else {
          dupQuery = dupQuery.is("unit_number", null);
        }
        if (initial?.id) dupQuery = dupQuery.neq("id", initial.id);
        const { data: dupRows } = await dupQuery.limit(1);
        if (dupRows && dupRows.length > 0) {
          setSaving(false);
          await customAlert(
            form.unit_number
              ? `이미 등록된 매물입니다.\n같은 주소 · 같은 호수(${form.unit_number})로 등록할 수 없습니다.`
              : "이미 등록된 매물입니다.\n같은 주소로 중복 등록할 수 없습니다."
          );
          return;
        }
      } catch (e) {
        console.warn("[duplicate-check] 실패:", e);
      }
    }

    try {
      if (initial?.id) {
        const { data: updated, error } = await supabase.from("properties").update(payload).eq("id", initial.id).select("id");
        if (error) { alert("수정 오류: " + error.message); return; }
        if (!updated || updated.length === 0) { alert("수정 권한이 없거나 해당 매물을 찾을 수 없습니다."); return; }
        // 수정 후 건축물·토지대장 백그라운드 캐싱
        prefetchPropertySummary(payload.address, initial.id).catch(() => {});
      } else {
        const { data: insertedRow, error } = await supabase.from("properties").insert(payload).select("id").single();
        if (error) { alert("등록 오류: " + error.message); return; }
        // 신규 등록 후 건축물·토지대장 백그라운드 캐싱
        if (insertedRow?.id) {
          prefetchPropertySummary(payload.address, insertedRow.id).catch(() => {});
        }
      }

      // 청주 연락처 동기화 (소유주/관리인 등 연락처는 필히 저장)
      const hasAnyContact = !!(form.contactOwner || form.contactOwner2 || form.extraOwners.some(Boolean) || form.contactManager || form.contactBroker);
      const isCollectiveType = form.buildingType === "집합건물" || COLLECTIVE_TYPES.some((t) => t === form.type);
      const unitVal = form.unit_number || null;

      // 집합건물은 호수별로 저장되도록 호수 필수
      const canSaveCheongju = finalDong && hasAnyContact && (!isCollectiveType || !!unitVal);
      if (canSaveCheongju) {
        const contactDistrict = form.district ?? "";
        const lotNum = finalLotNumber ?? "";

        const extraList = [form.contactOwner2, ...form.extraOwners].filter(Boolean);
        const extraMemo = extraList.length > 0 ? `EXTRA_OWNERS:[${extraList.join(",")}]` : null;

        const upsertPayload: Record<string, unknown> = {
          district: contactDistrict,
          dong: finalDong,
          lot_number: lotNum,
          unit_number: isCollectiveType ? unitVal : null,
          phone: form.contactOwner || form.contactManager || "",
          contact_owner: form.contactOwner || null,
          contact_manager: form.contactManager || null,
          contact_broker: form.contactBroker || null,
          memo: extraMemo,
          is_visible: true,
        };
        if (form.building_name && form.building_name.trim()) {
          upsertPayload.building_name = form.building_name.trim();
        }
        const { error: upsertErr } = await saveCheongjuContact(upsertPayload as never);
        if (upsertErr) console.error("[청주연락처] upsert 오류:", upsertErr.message);
      }


      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const STEP_LABELS = ["기본 설정 및 주소", "옵션 및 조건", "사진 및 기타"];

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col rounded-2xl shadow-2xl"
        style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0"
          style={{ background: "hsl(var(--header-bg))" }}>
          <div>
            <h3 className="text-base font-bold text-white">
              {initial?.id ? "매물 수정" : "매물 등록"}
            </h3>
            {initial?.id && (
              <p className="text-xs mt-0.5 text-white/60">{initial.address} {initial.unit_number ? `· ${initial.unit_number}호` : ""}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-4 pb-2 flex-shrink-0">
          <div className="flex gap-1.5 mb-1.5">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= formStep ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{formStep}/3 {STEP_LABELS[formStep - 1]}</p>
        </div>

        {/* Body */}
        <div ref={bodyScrollRef} className="overflow-y-auto flex-1 px-6 py-4">

          {/* ── STEP 1 ── */}
          {formStep === 1 && (
            <div className="flex flex-col gap-5">

              {/* 거래 방식 */}
              <Section label="거래 방식">
                <div className="flex gap-5">
                  {BROKER_TYPES.map((t) => <Radio key={t} checked={form.brokerType === t} onClick={() => set("brokerType", t)}>{t}</Radio>)}
                </div>
              </Section>

              {/* 거래 종류 */}
              <Section label="거래 종류">
                <div className="flex gap-5">
                  {TRADE_TYPES.map((t) => <Radio key={t} checked={form.tradeType === t} onClick={() => set("tradeType", t)}>{t}</Radio>)}
                </div>
              </Section>

              {/* 매물 종류 */}
              <Section label="매물 종류">
                <div className="flex gap-5">
                  {BUILDING_TYPES.map((t) => <Radio key={t} checked={form.buildingType === t} onClick={() => set("buildingType", t)}>{t}</Radio>)}
                </div>
              </Section>

              {/* 세부 종류 (유형) */}
              <Section label="세부 종류 (유형) *">
                {PROPERTY_TYPE_GROUPS.filter(({ group }) => !(["단독건물","집합건물"].includes(form.buildingType) && group === "토지")).map(({ group, types }) => (
                  <div key={group} className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                      {group}
                      {group === "주거형" && (
                        <span className="ml-1.5 text-[10px] font-semibold normal-case tracking-normal" style={{ color: "hsl(var(--primary))" }}>
                          (중복가능)
                        </span>
                      )}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {types.map((t) => {
                        const isPrimary = form.type === t;
                        const primaryIsCollective = (COLLECTIVE_TYPES as readonly string[]).includes(form.type) || form.type === "도시형";
                        const isSubType = (ROOM_SUBTYPES as readonly string[]).includes(t);
                        const canMultiSelect = primaryIsCollective && isSubType && !isPrimary;
                        const isExtra = form.extraRoomTypes.includes(t);
                        const isSelected = isPrimary || isExtra;
                        return (
                          <button key={t} type="button" onClick={() => {
                            if (canMultiSelect) {
                              set("extraRoomTypes", isExtra ? form.extraRoomTypes.filter((x) => x !== t) : [...form.extraRoomTypes, t]);
                              return;
                            }
                            // 동일 1차 카테고리 재클릭 — 해제
                            if (isPrimary) {
                              set("type", "");
                              set("extraRoomTypes", []);
                              set("room_type", "");
                              return;
                            }
                            set("type", t);
                            const newPrimaryCollective = (COLLECTIVE_TYPES as readonly string[]).includes(t) || t === "도시형";
                            if (!newPrimaryCollective) set("extraRoomTypes", []);
                            if (newPrimaryCollective) set("room_type", t);
                            else if (!form.room_type || form.room_type === form.type || form.room_type.includes(",")) set("room_type", t);
                            if (newPrimaryCollective) set("buildingType", "집합건물");
                            if (t === "원룸") {
                              if (form.room_type !== "오픈형" && form.room_type !== "분리형") set("room_type", "");
                              setShowOneRoomModal(true);
                            }
                          }}
                            className="px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                            style={isSelected
                              ? { background: isPrimary ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.75)", color: "#fff", borderColor: "hsl(var(--primary))" }
                              : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
                            {t}{isExtra && !isPrimary ? " +" : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {/* 원룸 형태 표시 */}
                {form.type === "원룸" && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-muted-foreground">원룸 형태</span>
                    <button
                      type="button"
                      onClick={() => setShowOneRoomModal(true)}
                      className="px-2.5 py-1 rounded-full text-xs font-bold border transition-all"
                      style={(form.room_type === "오픈형" || form.room_type === "분리형")
                        ? { background: "hsl(var(--primary))", color: "#fff", borderColor: "hsl(var(--primary))" }
                        : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
                    >
                      {(form.room_type === "오픈형" || form.room_type === "분리형") ? form.room_type : "선택하기"}
                    </button>
                    <span className="text-[10px] text-muted-foreground">(클릭하여 변경)</span>
                  </div>
                )}
              </Section>

              {/* 주소 입력 */}
              <Section label="주소 입력">
                {/* 시/도 고정 배지 */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/30 bg-primary/5">
                  <span className="text-xs text-muted-foreground">시/도</span>
                  <span className="text-sm font-bold text-primary">충청북도 (충북)</span>
                  <span className="ml-auto text-[10px] text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-full">고정</span>
                </div>

                {/* 시/군/구 + 동 */}
                <div className="grid grid-cols-2 gap-2">
                  <AdminSelect value={sigungu} onChange={(v) => { setSigungu(v); setDong(""); updateAddress(v, "", form.lot_number); }} placeholder="시/군/구 선택" options={sigunguList} />
                  <AdminSelect value={dong} onChange={(v) => { setDong(v); updateAddress(sigungu, v, form.lot_number); }} placeholder="동/읍/면 선택" options={dongList} disabled={!sigungu} />
                </div>

                {/* 번지 또는 도로명주소 */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="text" placeholder="번지 또는 도로명주소 입력 (예: 123-4 또는 대농로 17)" value={form.lot_number}
                      onChange={(e) => { set("lot_number", e.target.value); updateAddress(sigungu, dong, e.target.value); }}
                      className={ic + " pl-9"} />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground/60 -mt-1">번지주소 또는 도로명주소 입력 가능</p>
                {/* 주소확인 버튼 */}
                <button type="button" onClick={() => {
                  const isRoad = form.lot_number?.match(/[가-힣].*(로|길)\s/);
                  const addr = isRoad ? form.lot_number : form.address;
                  if (addr) geocodeAddress(addr);
                }} disabled={geocoding || !form.lot_number}
                  className="w-full py-2 rounded-xl text-xs font-bold border transition-all disabled:opacity-40"
                  style={{ borderColor: "hsl(var(--primary))", color: "hsl(var(--primary))", background: "hsl(var(--primary) / 0.05)" }}>
                  {geocoding ? "확인 중..." : "📍 주소확인"}
                </button>
                {form.address && (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-primary font-medium bg-primary/8 px-3 py-1.5 rounded-lg">📍 {form.address}</p>
                    {geocoding && (
                      <p className="text-[11px] text-muted-foreground px-1 animate-pulse">📡 좌표 자동 조회 중...</p>
                    )}
                    {!geocoding && form.lat !== 0 && form.lng !== 0 && (
                      <p className="text-[11px] text-success font-semibold px-1">
                        ✅ 좌표 확인: {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
                      </p>
                    )}
                    {!geocoding && form.lat === 0 && form.lng === 0 && form.dong && (
                      <p className="text-[11px] text-warning px-1">⚠️ 좌표를 찾을 수 없습니다. 번지를 정확히 입력해주세요.</p>
                    )}
                  </div>
                )}
              </Section>

              {/* 건물이름 */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">건물이름</label>
                <input type="text" placeholder="건물명 (선택)" value={form.building_name ?? ""} onChange={(e) => set("building_name", e.target.value)} className={ic} />
              </div>

              {/* 층수 / 호수 / 평수 — 창고/공장매매 제외 */}
              {!isWarehouseSale && (
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">층수</label>
                  <AdminSelect value={form.floor} onChange={(v) => set("floor", v)} placeholder="선택" options={FLOOR_OPTIONS} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    호수
                    {(form.buildingType === "집합건물" || COLLECTIVE_TYPES.some((t) => t === form.type)) && (
                      <span className="ml-1 text-[10px] text-primary font-normal">호수별 소유주 자동로드</span>
                    )}
                  </label>
                  <input
                    type="text"
                    placeholder="직접입력"
                    value={form.unit_number ?? ""}
                    onChange={(e) => handleUnitNumberChange(e.target.value)}
                    className={ic}
                  />
                  {form.unit_number && (form.buildingType === "집합건물" || COLLECTIVE_TYPES.some((t) => t === form.type)) && (
                    <p className="text-[10px] text-primary/70">🏠 이 호수의 소유주 연락처를 자동으로 불러옵니다</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">면적</label>
                  <input type="text" placeholder="예) 59.94㎡ 또는 18평" value={form.area} onChange={(e) => set("area", e.target.value)} className={ic} />
                  {form.area && !form.area.includes("평") && (() => { const n = parseFloat(form.area.replace(/[^0-9.]/g, "")); return !isNaN(n) && n > 0 ? <p className="text-[10px] text-primary/70">→ 약 {(n / 3.3058).toFixed(1)}평</p> : null; })()}
                </div>
              </div>
              )}

              {/* 집합건물 동(棟) 입력 */}
              {(form.buildingType === "집합건물" || COLLECTIVE_TYPES.some((t) => t === form.type)) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      동(棟) <span className="text-muted-foreground/60 font-normal">(집합건물 전용)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="예) 101동, A동"
                      value={form.buildingDong}
                      onChange={(e) => set("buildingDong", e.target.value)}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && !/동$/.test(v)) set("buildingDong", `${v}동`);
                      }}
                      className={ic}
                    />
                  </div>
                </div>
              )}

              {/* 건물 기본 정보 — 매매 타입: 대지·건평·총층·건축년도 통합 박스 */}
              {SALE_TYPES.includes(form.type) ? (
                <div className="rounded-xl border-2 p-3 flex flex-col gap-3"
                  style={{ borderColor: "hsl(var(--primary) / 0.4)", background: "hsl(var(--primary) / 0.04)" }}>
                  <p className="text-xs font-extrabold text-primary">🏢 건물 기본 정보</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted-foreground">대지 <span className="text-muted-foreground/60 font-normal">(선택)</span></label>
                      <input type="text" placeholder="예) 120㎡, 36평" value={form.landArea} onChange={(e) => set("landArea", e.target.value)} className={ic} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted-foreground">건평 <span className="text-muted-foreground/60 font-normal">(선택)</span></label>
                      <input type="text" placeholder="예) 50평" value={form.buildingArea} onChange={(e) => set("buildingArea", e.target.value)} className={ic} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted-foreground">전체 층수</label>
                      <input type="text" placeholder="예) 5층" value={form.total_floors} onChange={(e) => set("total_floors", e.target.value)} className={ic} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted-foreground">건축연도</label>
                      <input type="text" placeholder="예) 2010" value={form.build_year} onChange={(e) => set("build_year", e.target.value)} className={ic} />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* ── STEP 2 ── */}
          {formStep === 2 && (
            <div className="flex flex-col gap-5">

              {/* 요약 칩 */}
              <div className="flex gap-1.5 flex-wrap">
                {[form.brokerType, form.tradeType, form.buildingType, form.type].filter(Boolean).map((v) => (
                  <span key={v} className="text-xs bg-primary/10 text-primary font-semibold px-2.5 py-1 rounded-full">{v}</span>
                ))}
              </div>

              {/* 부가 시설 (수도·유선TV·인터넷·CCTV) — 매매/상가임대류/토지 제외 */}
              {!SALE_TYPES.includes(form.type) && !["상가","사무실","공장·창고","지식산업"].includes(form.type) && form.buildingType !== "토지" && (
              <Section label="부가 시설">
                <div className="flex flex-wrap gap-2">
                  {EXTRA_FACILITY_OPTIONS.map(({ key, label, icon, bg, color, border }) => {
                    const isActive = form.options.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setForm((f) => ({
                            ...f,
                            options: isActive
                              ? f.options.filter((o) => o !== key)
                              : [...f.options, key],
                          }));
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all select-none"
                        style={isActive
                          ? { background: color, color: "#fff", borderColor: color }
                          : { background: bg, color, borderColor: border }
                        }
                      >
                        <span>{icon}</span>
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </Section>
              )}

              {/* 옵션 — 매매/상가임대류/토지 제외 */}
              {!SALE_TYPES.includes(form.type) && !["상가","사무실","공장·창고","지식산업"].includes(form.type) && form.buildingType !== "토지" && (
              <Section label="옵션">
                {/* 풀옵션 버튼 */}
                <div className="mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      const FULL_OPTIONS = ["냉장고","세탁기","에어컨","TV","전자레인지","인터넷","가스레인지","수도"];
                      setForm((f) => {
                        const current = new Set(f.options);
                        const allSelected = FULL_OPTIONS.every(o => current.has(o));
                        if (allSelected) {
                          FULL_OPTIONS.forEach(o => current.delete(o));
                        } else {
                          FULL_OPTIONS.forEach(o => current.add(o));
                        }
                        return { ...f, options: Array.from(current) };
                      });
                    }}
                    className="px-4 py-1.5 rounded-xl text-xs font-extrabold border-2 transition-all"
                    style={
                      ["냉장고","세탁기","에어컨","TV","전자레인지","인터넷","가스레인지","수도"].every(o => form.options.includes(o))
                        ? { background: "hsl(var(--primary))", color: "#fff", borderColor: "hsl(var(--primary))" }
                        : { background: "transparent", color: "hsl(var(--primary))", borderColor: "hsl(var(--primary))" }
                    }
                  >
                    ✨ 풀옵션
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ROOM_OPTIONS.map((opt) => (
                    <button key={opt} type="button" onClick={() => toggleOption(opt)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        form.options.includes(opt)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-border hover:border-primary/50"
                      }`}>{opt}</button>
                  ))}
                </div>
              </Section>
              )}

              {/* 방 비번 / 건물 비번 — 매매/토지 제외 (상가임대류 포함) */}
              {!SALE_TYPES.includes(form.type) && form.buildingType !== "토지" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">호실 비번</label>
                  <input type="text" placeholder="방 비밀번호" value={form.room_password ?? ""} onChange={(e) => set("room_password", e.target.value)} className={ic} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">건물 비번</label>
                  <input type="text" placeholder="건물 비밀번호" value={form.building_password ?? ""} onChange={(e) => set("building_password", e.target.value)} className={ic} />
                </div>
              </div>
              )}

              {/* 방향 — 매매/상가임대류/토지 제외 */}
              {!SALE_TYPES.includes(form.type) && !["상가","사무실","공장·창고","지식산업"].includes(form.type) && form.buildingType !== "토지" && (
              <Section label="방향">
                <div className="flex flex-wrap gap-2">
                  {DIRECTION_OPTIONS.map((d) => (
                    <button key={d} type="button" onClick={() => set("direction", form.direction === d ? "" : d)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        form.direction === d
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-border hover:border-primary/50"
                      }`}>{d}</button>
                  ))}
                </div>
              </Section>
              )}

              {/* 공실 여부 — 매매 타입이더라도 집합건물이면 표시 */}
              {(form.tradeType !== "매매" || form.buildingType === "집합건물" || COLLECTIVE_TYPES.some((t) => t === form.type)) && (
                <Section label="공실여부">
                  <div className="flex gap-3">
                    {VACANCY_TYPES.map((t) => (
                      <button key={t} type="button" onClick={() => set("available_from", form.available_from === t ? "" : t)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                          form.available_from === t
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-border hover:border-primary/50"
                        }`}>{t === "세입자 거주중" ? "거주중" : t}</button>
                    ))}
                  </div>

                  {/* 단기가능 체크박스 */}

                  <div className="flex items-center gap-3 px-3 py-2 rounded-xl border transition-all"
                    style={{
                      background: form.options.includes("단기가능") ? "hsl(217 91% 97%)" : "hsl(var(--muted)/0.3)",
                      borderColor: form.options.includes("단기가능") ? "hsl(217 91% 65%)" : "hsl(var(--border))",
                    }}>
                    <label className="flex items-center gap-2 text-sm cursor-pointer w-full"
                      style={{ color: form.options.includes("단기가능") ? "hsl(217 91% 40%)" : undefined }}>
                      <input type="checkbox"
                        checked={form.options.includes("단기가능")}
                        onChange={(e) => {
                          setForm((f) => ({
                            ...f,
                            options: e.target.checked
                              ? [...f.options, "단기가능"]
                              : f.options.filter((o) => o !== "단기가능"),
                          }));
                        }}
                        className="w-4 h-4 accent-primary" />
                      <span className="font-semibold">단기 가능</span>
                      {form.options.includes("단기가능") && (
                        <span className="ml-auto text-[10px] font-extrabold px-1.5 py-0.5 rounded"
                          style={{ background: "hsl(217 91% 93%)", color: "hsl(217 91% 35%)", border: "1px solid hsl(217 91% 65%)" }}>
                          단기가능
                        </span>
                      )}
                    </label>
                  </div>

                  {/* 반려동물 가능 여부 */}
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold text-foreground/70 flex items-center gap-1"><img src={petIcon} alt="반려동물" className="w-4 h-4 inline" /> 반려동물</p>
                    <div className="flex gap-2">
                      {(["가능", "불가"] as PetType[]).map((v) => {
                        const label = v === "가능" ? "가능" : "불가";
                        const isActive = form.pet === v;
                        return (
                          <button
                            key={String(v)}
                            type="button"
                            onClick={() => set("pet", form.pet === v ? "" : v)}
                            className="flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all"
                            style={
                              isActive
                                ? v === "가능"
                                  ? { background: "hsl(142 71% 45%)", color: "#fff", borderColor: "hsl(142 71% 45%)" }
                                  : v === "불가"
                                  ? { background: "hsl(0 85% 55%)", color: "#fff", borderColor: "hsl(0 85% 55%)" }
                                  : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }
                                : { background: "hsl(var(--background))", color: "hsl(var(--foreground))", borderColor: "hsl(var(--border))" }
                            }
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 세입자 중도퇴거 체크박스 */}
                  <div className="flex items-center gap-3 mt-2 px-3 py-2 rounded-xl border transition-all"
                    style={{
                      background: form.earlyExit ? "hsl(0 85% 97%)" : "hsl(var(--muted)/0.3)",
                      borderColor: form.earlyExit ? "hsl(0 85% 70%)" : "hsl(var(--border))",
                    }}>
                    <label className="flex items-center gap-2 text-sm cursor-pointer w-full" style={{ color: form.earlyExit ? "hsl(0 85% 45%)" : undefined }}>
                      <input type="checkbox" checked={form.earlyExit}
                        onChange={(e) => set("earlyExit", e.target.checked)} className="w-4 h-4 accent-destructive" />
                      <span className={`font-semibold ${form.earlyExit ? "text-[hsl(0_85%_45%)]" : ""}`}>중도퇴거</span>
                      {form.earlyExit && (
                        <span className="ml-auto text-[10px] font-extrabold px-1.5 py-0.5 rounded"
                          style={{ background: "hsl(0 85% 93%)", color: "hsl(0 85% 45%)", border: "1px solid hsl(0 85% 70%)" }}>
                          중도퇴거
                        </span>
                      )}
                    </label>
                  </div>

                  {/* 퇴거 예정일 */}
                  <div className="flex flex-col gap-1 mt-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      퇴거 예정일
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground/70">(예: 2025.03.15)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="예) 2025-03-15"
                      value={form.vacate_date ?? ""}
                      maxLength={10}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "").slice(0, 8);
                        let formatted = raw;
                        if (raw.length > 4) formatted = raw.slice(0, 4) + "-" + raw.slice(4);
                        if (raw.length > 6) formatted = raw.slice(0, 4) + "-" + raw.slice(4, 6) + "-" + raw.slice(6);
                        set("vacate_date", formatted);
                      }}
                      className={ic}
                      style={form.vacate_date ? { borderColor: "hsl(0 85% 60%)", background: "hsl(0 85% 98%)" } : {}}
                    />
                    {form.vacate_date && (
                      <p className="text-[11px] font-semibold" style={{ color: "hsl(0 85% 45%)" }}>
                        🚪 퇴거 예정: {form.vacate_date}
                      </p>
                    )}
                  </div>
                </Section>
              )}

              {/* 금액 입력 */}
              <Section label="금액 입력">
                <p className="text-[11px] text-muted-foreground/70 -mt-1">단위: 만원</p>
                {form.tradeType === "매매" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <AmountInput label="매매가액 *" prefix="매" value={form.deposit} onChange={(v) => set("deposit", v)} placeholder="예) 15,000" />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {/* 임대 방식 다중 선택 */}
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[11px] font-bold text-foreground/70">임대 방식 (중복 선택 가능)</p>
                      <div className="flex gap-2">
                      {(["월세", "반전세", "전세"] as const).map((mode) => {
                          const isOn = form.rentModes.includes(mode);
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => {
                                const cur = [...form.rentModes];
                                const next = cur.includes(mode) ? cur.filter(m => m !== mode) : [...cur, mode];
                                set("rentModes", next as any);
                              }}
                              className="flex-1 py-2 rounded-xl text-xs font-bold border transition-all"
                              style={isOn
                                ? { background: "hsl(var(--primary))", color: "#fff", borderColor: "hsl(var(--primary))" }
                                : { background: "transparent", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }
                              }
                            >
                              {mode}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 월세 금액 */}
                    {(form.rentModes.includes("월세") || (form.rentModes.length === 0 && !form.rentModes.includes("전세") && !form.rentModes.includes("반전세"))) && (
                      <div className="rounded-xl border border-border bg-muted/20 p-3 flex flex-col gap-2">
                        <p className="text-[11px] font-extrabold text-primary">💰 월세</p>
                        <div className="grid grid-cols-2 gap-2">
                          <AmountInput label="보증금" value={form.deposit} onChange={(v) => set("deposit", v)} />
                          <AmountInput label="월세" value={form.monthly} onChange={(v) => set("monthly", v)} />
                        </div>
                      </div>
                    )}
                    {/* 반전세 금액 */}
                    {form.rentModes.includes("반전세") && (
                      <div className="rounded-xl border border-border bg-muted/20 p-3 flex flex-col gap-2">
                        <p className="text-[11px] font-extrabold text-primary">🏠 반전세</p>
                        <div className="grid grid-cols-2 gap-2">
                          <AmountInput label="보증금" value={form.halfDeposit} onChange={(v) => set("halfDeposit", v as any)} />
                          <AmountInput label="월세" value={form.halfMonthly} onChange={(v) => set("halfMonthly", v as any)} />
                        </div>
                      </div>
                    )}
                    {/* 전세 금액 */}
                    {form.rentModes.includes("전세") && (
                      <div className="rounded-xl border border-border bg-muted/20 p-3 flex flex-col gap-2">
                        <p className="text-[11px] font-extrabold text-primary">🏡 전세</p>
                        <AmountInput label="보증금" prefix="전" value={form.jeonseDeposit} onChange={(v) => set("jeonseDeposit", v as any)} />
                      </div>
                    )}
                  </div>
                )}
                {/* 관리비 + 청소비 + 중개보수 — 창고/공장매매 제외 */}
                {!isWarehouseSale && (
                <div className="grid grid-cols-2 gap-3 mt-1">
                  {["상가","사무실","공장·창고","지식산업","기타임대","상가주택매매","상가건물매매","구분상가매매","지식산업매매"].includes(form.type) && (
                    <div className="col-span-2">
                      <AmountInput label="권리금" value={form.keyMoney} onChange={(v) => set("keyMoney", v)} placeholder="없으면 0 또는 비워두기" />
                    </div>
                  )}
                  <AmountInput label="관리비" value={form.manage_fee} onChange={(v) => set("manage_fee", v)} />
                  <AmountInput label="퇴실 청소비" value={form.exitCleanFee} onChange={(v) => set("exitCleanFee", v)} />
                  <div className="col-span-2">
                    <AmountInput label="중개보수" value={form.brokerFee} onChange={(v) => set("brokerFee", v)} placeholder="예) 협의" noUnit />
                  </div>
                </div>
                )}
                {/* 창고/공장매매: 중개보수만 표시 */}
                {isWarehouseSale && (
                <div className="grid grid-cols-1 gap-3 mt-1">
                  <AmountInput label="중개보수" value={form.brokerFee} onChange={(v) => set("brokerFee", v)} placeholder="예) 협의" noUnit />
                </div>
                )}
              </Section>

              {/* LH 전세대출 — '전세' 임대방식 선택 시에만 표시 */}
              {!SALE_TYPES.includes(form.type) && form.tradeType !== "매매" && form.rentModes.includes("전세") && (
              <Section label="LH (전세대출)">
                <div className="flex gap-5">
                  {LH_TYPES.map((t) => (
                    <Radio key={t} checked={form.lhType === t} onClick={() => set("lhType", t)}>{t}</Radio>
                  ))}
                </div>
              </Section>
              )}

              {/* 매물 소개 */}
              <Section label="매물 소개">
                <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)}
                  className={ic + " resize-none"} placeholder="매물의 특징, 특이사항 등" maxLength={300} />
                <p className="text-right text-[11px] text-muted-foreground">{form.description.length} / 300</p>
              </Section>
            </div>
          )}

          {/* ── STEP 3 ── */}
          {formStep === 3 && (
            <div className="flex flex-col gap-5">

              {/* 연락처 */}
              <Section label="연락처">
                {contactAutoFilled && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/30 bg-primary/8 text-primary text-xs font-semibold animate-pulse">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>청주 연락처에서 자동으로 불러왔습니다</span>
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  {/* 소유주 연락처 1 + 추가 버튼 */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-foreground/70">소유주 연락처</label>
                      <button type="button" onClick={() => {
                        if (!form.contactOwner2) { setShowOwner2(true); }
                        else { set("extraOwners", [...form.extraOwners, ""]); }
                      }}
                        className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-0.5">
                        <span className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-black">+</span>
                        소유주 추가
                      </button>
                    </div>
                    <ContactField
                      fieldKey="contactOwner"
                      label=""
                      placeholder="예) 010-1234-5678"
                      value={form.contactOwner}
                      onChange={(v) => set("contactOwner", v)}
                    />
                  </div>
                  {/* 소유주 연락처 2 */}
                  {showOwner2 && (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-foreground/70">소유주 연락처 2</label>
                        <button type="button" onClick={() => { setShowOwner2(false); set("contactOwner2", ""); }}
                          className="text-[10px] font-bold text-destructive hover:text-destructive/80 transition-colors">삭제</button>
                      </div>
                      <ContactField
                        fieldKey="contactOwner2"
                        label=""
                        placeholder="예) 010-5678-1234"
                        value={form.contactOwner2}
                        onChange={(v) => set("contactOwner2", v)}
                      />
                    </div>
                  )}
                  {/* 추가 소유주들 (3, 4, 5...) */}
                  {form.extraOwners.map((owner, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-foreground/70">소유주 연락처 {idx + 3}</label>
                        <button type="button"
                          onClick={() => set("extraOwners", form.extraOwners.filter((_, i) => i !== idx))}
                          className="text-[10px] font-bold text-destructive hover:text-destructive/80 transition-colors">삭제</button>
                      </div>
                      <ContactField
                        fieldKey={`extraOwner_${idx}` as any}
                        label=""
                        placeholder="예) 010-0000-0000"
                        value={owner}
                        onChange={(v) => {
                          const next = [...form.extraOwners];
                          next[idx] = v;
                          set("extraOwners", next);
                        }}
                      />
                    </div>
                  ))}
                  {/* 나머지 연락처 */}
                  {([
                    { key: "contactTenant" as const, label: "세입자 연락처", placeholder: "예) 010-9876-5432" },
                    { key: "contactManager" as const, label: "관리인 연락처", placeholder: "예) 010-5555-6666" },
                  ] as { key: "contactTenant"|"contactManager"; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
                    <ContactField
                      key={key}
                      fieldKey={key}
                      label={label}
                      placeholder={placeholder}
                      value={form[key] as string}
                      onChange={(v) => set(key, v)}
                    />
                  ))}
                </div>
              </Section>




              {/* 이미지 업로드 — 캐러셀 프리뷰 */}
              <Section label="이미지 업로드">
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => handleImageUpload(e.target.files)} />
                {(form.images ?? []).length > 0 && (
                  <ImageCarouselPreview
                    images={form.images ?? []}
                    onRemove={(url) =>
                      setForm((f) => ({ ...f, images: (f.images ?? []).filter((u) => u !== url) }))
                    }
                    onSetMain={(url) =>
                      setForm((f) => {
                        const rest = (f.images ?? []).filter((u) => u !== url);
                        return { ...f, images: [url, ...rest] };
                      })
                    }
                    onReorder={(reordered) =>
                      setForm((f) => ({ ...f, images: reordered }))
                    }
                  />
                )}
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full border-2 border-dashed border-primary/30 rounded-xl py-4 flex flex-col items-center gap-1.5 hover:border-primary/60 hover:bg-primary/5 transition-colors mt-1">
                  {uploading
                    ? <><span className="text-sm font-semibold text-primary">업로드 중...</span></>
                    : <>
                        <span className="text-sm font-semibold text-primary">📷 사진 추가</span>
                        <span className="text-[11px] text-muted-foreground">여러 장 동시 선택 가능 · JPG, PNG, WEBP</span>
                      </>
                  }
                </button>
              </Section>

              {/* 노출 상태 */}
              <Section label="노출 상태">
                <div className="flex gap-3">
                  {(["active", "hidden"] as const).map((s) => (
                    <button key={s} type="button" onClick={() => set("status", s)}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${
                        form.status === s ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border"
                      }`}>
                      {s === "active" ? "✅ 노출" : "🔕 숨김"}
                    </button>
                  ))}
                </div>
              </Section>

              {/* 등록일 / 확인일 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">등록일</label>
                  <input type="date" value={form.registered_date} onChange={(e) => set("registered_date", e.target.value)} className={ic} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">확인일</label>
                  <input type="date" value={form.checked_date ?? ""} onChange={(e) => set("checked_date", e.target.value)} className={ic} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-border flex items-center gap-3">
          {/* 매물 종료 버튼 — 수정 모드에서만 표시 */}
          {initial?.id && (
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                if (!(await customConfirm("이 매물을 종료하시겠습니까?\n매물이 목록에서 숨겨지고 종료 상태로 변경됩니다."))) return;
                setSaving(true);
                try {
                  const { error } = await supabase.from("properties").update({ status: "closed" }).eq("id", initial.id!);
                  if (error) { await customAlert("오류: " + error.message); return; }
                  // 신고/제안에 거래완료 기록 남기기
                  const { data: { user } } = await supabase.auth.getUser();
                  let pName: string | null = null, pCompany: string | null = null, pPhone: string | null = null;
                  if (user) {
                    const { data: profile } = await supabase.from("agent_profiles").select("name, agency_name, phone").eq("user_id", user.id).maybeSingle();
                    if (profile) { pName = profile.name; pCompany = profile.agency_name; pPhone = profile.phone; }
                  }
                  await supabase.from("property_reports").insert({
                    property_id: initial.id!,
                    property_title: initial.title || form.title || "",
                    property_address: initial.address || form.address || "",
                    report_type: "deal_complete",
                    status: "resolved",
                    submitted_by: user?.id || null,
                    proposer_name: pName,
                    proposer_company: pCompany,
                    proposer_phone: pPhone,
                    deal_memo: "관리자 직접 종료",
                  });
                  onSaved?.();
                  onClose();
                } finally {
                  setSaving(false);
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border transition-colors disabled:opacity-50"
              style={{ borderColor: "hsl(var(--chart-4))", color: "hsl(var(--chart-4))", background: "transparent" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "hsl(var(--chart-4))"; (e.currentTarget as HTMLButtonElement).style.color = "white"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "hsl(var(--chart-4))"; }}
            >
              <X className="w-3.5 h-3.5" />
              매물 종료
            </button>
          )}
          {formStep > 1 && (
            <button type="button" onClick={() => { setFormStep((s) => (s - 1) as 1 | 2 | 3); bodyScrollRef.current?.scrollTo(0, 0); }}
              className="px-4 py-2 rounded-full text-xs font-semibold border border-border text-foreground hover:bg-muted/50">
              이전
            </button>
          )}
          <div className="flex-1" />
          {formStep < 3 ? (
            <button type="button" onClick={async () => {
              if (formStep === 1) {
                if (!isWarehouseSale && form.buildingType !== "토지") {
                  if (!form.floor) { await customAlert("층수를 선택해주세요."); return; }
                  if (!form.unit_number?.trim()) { await customAlert("호수를 입력해주세요."); return; }
                }
                if (form.type === "원룸" && form.room_type !== "오픈형" && form.room_type !== "분리형") {
                  setShowOneRoomModal(true);
                  return;
                }
              }
              setFormStep((s) => (s + 1) as 2 | 3);
              bodyScrollRef.current?.scrollTo(0, 0);
            }}
              className="px-6 py-2 rounded-full text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90">
              다음
            </button>
          ) : (
            <button type="button" onClick={handleSave} disabled={saving}
              className="px-6 py-2 rounded-full text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {saving ? "저장 중..." : (initial?.id ? "수정 완료" : "등록 완료")}
            </button>
          )}
        </div>
      </div>

      {/* 원룸 형태 선택 모달 */}
      {showOneRoomModal && (
        <div
          className="fixed inset-0 z-[10300] flex items-center justify-center bg-black/60"
          onClick={() => setShowOneRoomModal(false)}
        >
          <div
            className="bg-background rounded-2xl p-6 w-[90%] max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-foreground mb-1">원룸 형태 선택</h3>
            <p className="text-xs text-muted-foreground mb-4">방 구조 형태를 선택해주세요</p>
            <div className="grid grid-cols-2 gap-3">
              {(["오픈형", "분리형"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    set("room_type", opt);
                    setShowOneRoomModal(false);
                  }}
                  className="flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all hover:scale-105"
                  style={form.room_type === opt
                    ? { background: "hsl(var(--primary))", color: "#fff", borderColor: "hsl(var(--primary))" }
                    : { borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", background: "hsl(var(--muted))" }}
                >
                  <span className="text-base font-bold">{opt}</span>
                  <span className="text-[11px] opacity-80">
                    {opt === "오픈형" ? "방·주방 통합" : "방·주방 분리"}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowOneRoomModal(false)}
              className="w-full mt-4 py-2 rounded-lg text-xs font-bold border border-border text-muted-foreground hover:bg-muted"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPropertyFormModal;
