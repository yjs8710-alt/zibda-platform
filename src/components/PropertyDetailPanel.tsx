import {
  X,
  MapPin,
  Eye,
  Heart,
  Phone,
  Calendar,
  Building2,
  Car,
  Maximize2,
  Layers,
  BadgeCheck,
  Share2,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Eye as EyeIcon,
  AlertTriangle,
  CheckCircle2,
  Send,
  ClipboardList,
  Download,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { MapProperty } from "@/data/mapProperties";
import { supabase } from "@/integrations/supabase/client";
import { formatPhone } from "@/lib/utils";
import { sharePropertyToKakao, AgencyInfo } from "@/lib/kakaoShare";
import kakaoTalkIcon from "@/assets/kakao-talk-icon-v2-20260427.png";
import { useAuth } from "@/hooks/useAuth";
import { useIsGuest, addressToDong } from "@/hooks/useIsGuest";
import { downloadPropertyImage } from "@/lib/downloadImageWithWatermark";
import { notifySelf } from "@/lib/notifications";
import { toast } from "sonner";
import { formatUnitCount, pickPrimaryCountKey } from "@/lib/buildingUtils";
import { pushOverlay, popOverlay, getOverlayCount } from "@/lib/overlayGuard";

interface PropertyDetailPanelProps {
  property: MapProperty | null;
  onClose: () => void;
  sameProperties?: MapProperty[]; // 동일 주소 다른 호실 매물
}

const TYPE_STYLE: Record<string, { bg: string; text: string }> = {
  상가: { bg: "bg-primary", text: "text-white" },
  사무실: { bg: "bg-purple-600", text: "text-white" },
  "식당·카페": { bg: "bg-accent", text: "text-white" },
  "공장·창고": { bg: "bg-green-600", text: "text-white" },
  "병원·학원": { bg: "bg-red-700", text: "text-white" },
  "지식산업": { bg: "bg-cyan-700", text: "text-white" },
};

/* ─── 풀스크린 라이트박스 ─── */
interface LightboxUnit {
  label: string;
  images: string[];
  isReference?: boolean;
}
function Lightbox({
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
  const isMobile = useIsMobile();
  const [unitIdx, setUnitIdx] = useState(startUnitIdx);
  const [imgIdx, setImgIdx] = useState(startImgIdx);
  const currentImages = units[unitIdx]?.images ?? [];

  const prev = useCallback(
    () => setImgIdx((i) => (i - 1 + currentImages.length) % currentImages.length),
    [currentImages.length],
  );
  const next = useCallback(() => setImgIdx((i) => (i + 1) % currentImages.length), [currentImages.length]);
  const handleUnitChange = (i: number) => {
    setUnitIdx(i);
    setImgIdx(0);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next, onClose]);

  // 라이트박스 열릴 때 현재 호실 이미지만 우선 미리 가져오기 (첫 클릭 지연 방지)
  useEffect(() => {
    const current = units[unitIdx]?.images ?? [];
    const run = () => {
      current.slice(0, 6).forEach((src) => {
        if (!src) return;
        const img = new Image();
        img.decoding = "async";
        img.src = src;
      });
    };
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(run, { timeout: 500 });
    } else {
      setTimeout(run, 0);
    }
  }, [units, unitIdx]);


  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center" onClick={onClose}>
      {/* 닫기 버튼은 하단에 위치 */}

      {/* 호실 탭 — 2개 이상일 때만. 모바일은 상단 고정 바(배경 있음)로 다운로드 버튼과 겹침 방지 */}
      {units.length > 1 && (
        <div
          className={`absolute top-0 left-0 right-0 z-20 flex gap-1.5 px-3 py-2 flex-wrap justify-center ${isMobile ? "bg-black/80 backdrop-blur-sm" : "top-4 left-1/2 -translate-x-1/2 max-w-[80vw] right-auto"}`}
          onClick={(e) => e.stopPropagation()}
        >
          {units.map((u, i) => (
            <button
              key={i}
              onClick={() => handleUnitChange(i)}
              className="px-3 py-1 rounded-full text-xs font-bold transition-all"
              style={
                i === unitIdx
                  ? { background: "hsl(var(--primary))", color: "#fff" }
                  : { background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }
              }
            >
              {u.label}
            </button>
          ))}
        </div>
      )}

      {!isMobile && (
        <div
          className={`absolute bg-black/50 text-white text-sm font-bold px-3 py-1 rounded-full backdrop-blur-sm z-10 ${units.length > 1 ? "top-14 right-4" : "top-4 left-1/2 -translate-x-1/2"}`}
          onClick={(e) => e.stopPropagation()}
        >
          {imgIdx + 1} / {currentImages.length}
        </div>
      )}

      {isMobile ? (
        <div
          className="flex-1 w-full overflow-y-auto overflow-x-hidden scrollbar-none"
          style={{ paddingTop: units.length > 1 ? "56px" : "48px", paddingBottom: "80px" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center gap-3 px-3">
            {currentImages.map((src, i) => (
              <div key={i} className="relative w-full">
                <img
                  src={src}
                  alt={`사진 ${i + 1}`}
                  className="w-full max-w-full object-contain rounded-lg select-none"
                  draggable={false}
                  loading={i < 2 ? "eager" : "lazy"}
                  decoding="async"
                  // @ts-ignore
                  fetchpriority={i === 0 ? "high" : "auto"}
                />
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      toast.loading("저장 중...", { id: `dl-${i}` });
                      await downloadPropertyImage(src, `사진_${i + 1}.jpg`);
                      toast.success("저장되었습니다", { id: `dl-${i}` });
                    } catch {
                      toast.error("저장 실패", { id: `dl-${i}` });
                    }
                  }}
                  className="absolute top-2 right-2 w-10 h-10 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                  style={{ background: "hsl(var(--accent))", color: "white" }}
                  aria-label="사진 저장"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
      <div
        className="relative w-full h-full overflow-hidden"
        style={{ paddingTop: units.length > 1 ? "56px" : "0" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex h-full transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${imgIdx * 100}vw)`, width: `${currentImages.length * 100}vw` }}
        >
          {currentImages.map((src, i) => {
            const distance = Math.abs(i - imgIdx);
            return (
            <div
              key={i}
              className="flex-shrink-0 h-full flex items-center justify-center px-16"
              style={{ width: "100vw" }}
            >
              <img
                src={src}
                alt={`사진 ${i + 1}`}
                className="max-w-full max-h-full object-contain rounded-lg select-none"
                draggable={false}
                loading={distance <= 1 ? "eager" : "lazy"}
                decoding="async"
                // @ts-ignore
                fetchpriority={distance === 0 ? "high" : "auto"}
              />
            </div>
            );
          })}
        </div>
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
      )}
      {!isMobile && currentImages.length > 1 && (
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
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {/* 하단 액션 — 저장 + 닫기 */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20" onClick={(e) => e.stopPropagation()}>
        {!isMobile && currentImages[imgIdx] && (
          <button
            onClick={async () => {
              const src = currentImages[imgIdx];
              try {
                toast.loading("저장 중...", { id: "dl-current" });
                await downloadPropertyImage(src, `사진_${imgIdx + 1}.jpg`);
                toast.success("저장되었습니다", { id: "dl-current" });
              } catch {
                toast.error("저장 실패", { id: "dl-current" });
              }
            }}
            className="flex items-center gap-1.5 px-5 py-3 rounded-full text-white text-sm font-extrabold shadow-2xl transition-transform active:scale-95"
            style={{ background: "hsl(var(--primary))", border: "2px solid rgba(255,255,255,0.5)" }}
          >
            <Download className="w-4 h-4" />
            저장
          </button>
        )}
        <button
          onClick={() => onClose()}
          className="px-10 py-3 rounded-full text-white text-base font-extrabold shadow-2xl transition-transform active:scale-95"
          style={{ background: "hsl(var(--accent))", border: "2px solid rgba(255,255,255,0.6)" }}
        >
          ✕ 닫기
        </button>
      </div>
    </div>
  );
}

/* ─── 전화번호 클릭시 노출 컴포넌트 ─── */
interface RevealPhoneProps {
  label: string;
  phone?: string;
  itemKey: string;
  activeKey: string | null;
  onActivate: (key: string | null) => void;
}
function RevealPhone({ label, phone, itemKey, activeKey, onActivate }: RevealPhoneProps) {
  if (!phone) return null;
  const revealed = activeKey === itemKey;

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-xl border border-border bg-muted/30">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
          <Phone className="w-3 h-3 text-primary" />
        </div>
        <span className="text-xs font-semibold text-foreground">{label}</span>
      </div>
      {revealed ? (
        <div className="flex items-center gap-2">
          <a href={`tel:${phone}`} className="text-xs font-bold text-primary hover:underline">
            {phone}
          </a>
          <button
            onClick={() => onActivate(null)}
            className="p-1 rounded-md hover:bg-muted transition-colors"
            title="숨기기"
          >
            <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => onActivate(itemKey)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors"
          style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}
        >
          <EyeIcon className="w-3 h-3" />
          번호 보기
        </button>
      )}
    </div>
  );
}

/* ─── 연락처 그룹 (상호 배타적 노출) ─── */
function ContactGroup({ property }: { property: MapProperty }) {
  const isGuest = useIsGuest();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  const hasOwner = !!property.contactOwner;
  const hasManager = !!property.contactManager;
  const hasTenant = !!property.contactTenant;

  useEffect(() => {
    if (!activeKey) return;
    const handler = (e: MouseEvent) => {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) {
        setActiveKey(null);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [activeKey]);

  if (isGuest || (!hasOwner && !hasManager && !hasTenant)) return null;

  return (
    <>
      <div className="h-2 bg-muted/50 my-2" />
      <div ref={groupRef} className="px-4 pb-3 flex flex-col gap-2">
        <p className="text-xs font-bold text-foreground uppercase tracking-wide">연락처</p>
        <RevealPhone
          label="소유주"
          phone={property.contactOwner}
          itemKey="owner"
          activeKey={activeKey}
          onActivate={setActiveKey}
        />
        {/* 모바일 전용: 소유주 하단 퇴거예정일 */}
        {(() => {
          const SALE_TYPES = ["매매","단독매매","건물매매","상가주택매매","상가건물매매","구분상가매매","창고/공장매매","다가구매매","다중매매"];
          const isRentType = !SALE_TYPES.includes(property.type);
          if (!isRentType) return null;
          return (
            <div className="md:hidden flex items-center justify-between py-2 px-3 rounded-xl border border-border bg-muted/30 -mt-1">
              <span className="text-xs font-semibold text-muted-foreground">퇴거 예정일</span>
              <span className="text-xs font-bold" style={{ color: property.vacateDate ? "hsl(0 85% 45%)" : "hsl(var(--muted-foreground))" }}>
                {property.vacateDate || "-"}
              </span>
            </div>
          );
        })()}
        <RevealPhone
          label="관리인"
          phone={property.contactManager}
          itemKey="manager"
          activeKey={activeKey}
          onActivate={setActiveKey}
        />
        <RevealPhone
          label="세입자"
          phone={property.contactTenant}
          itemKey="tenant"
          activeKey={activeKey}
          onActivate={setActiveKey}
        />
        {property.contact && (
          <div className="flex items-center justify-between py-2 px-3 rounded-xl border border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center">
                <Phone className="w-3 h-3 text-accent" />
              </div>
              <span className="text-xs font-semibold text-foreground">부동산</span>
            </div>
            <a href={`tel:${property.contact}`} className="text-xs font-bold text-accent hover:underline">
              {property.contact}
            </a>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── 이미지 캐러셀 ─── */
function ImageCarousel({
  images,
  title,
  onImageClick,
}: {
  images: string[];
  title: string;
  onImageClick: (idx: number) => void;
}) {
  const [idx, setIdx] = useState(0);
  const imgs = images.filter(Boolean);

  if (imgs.length === 0) {
    return (
      <div className="relative flex-shrink-0 h-48 bg-muted flex items-center justify-center">
        <Building2 className="w-12 h-12 text-muted-foreground/30" />
      </div>
    );
  }

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIdx((i) => (i - 1 + imgs.length) % imgs.length);
  };
  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIdx((i) => (i + 1) % imgs.length);
  };

  return (
    <div className="relative flex-shrink-0 h-48 overflow-hidden bg-muted">
      <div
        className="flex h-full transition-transform duration-300 ease-in-out cursor-zoom-in"
        style={{ transform: `translateX(-${idx * 100}%)`, width: `${imgs.length * 100}%` }}
        onClick={() => onImageClick(idx)}
      >
        {imgs.map((src, i) => (
          <div key={i} className="h-full flex-shrink-0" style={{ width: `${100 / imgs.length}%` }}>
            <img src={src} alt={`${title} ${i + 1}`} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />
      {imgs.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center backdrop-blur-sm transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center backdrop-blur-sm transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-1">
            {imgs.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setIdx(i);
                }}
                className="w-1.5 h-1.5 rounded-full transition-all"
                style={{ background: i === idx ? "#fff" : "rgba(255,255,255,0.45)" }}
              />
            ))}
          </div>
          <div className="absolute top-3 left-3 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
            {idx + 1} / {imgs.length}
          </div>
        </>
      )}
      <div className="absolute bottom-3 right-3 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm pointer-events-none flex items-center gap-1">
        <Maximize2 className="w-2.5 h-2.5" />
        클릭하여 크게 보기
      </div>
    </div>
  );
}

/* ─── 오류제보 모달 ─── */
function ErrorReportModal({ property, onClose }: { property: MapProperty; onClose: () => void }) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const propertyId = property.dbId || property.memo || String(property.id);
      const { error } = await supabase.from("property_reports").insert({
        property_id: propertyId,
        property_title: property.title || property.address,
        property_address: property.address,
        report_type: "error_report",
        error_content: content.trim(),
        submitted_by: session?.user?.id ?? null,
      });
      if (error) throw error;
      await notifySelf("report", "신고 신청이 완료되었습니다.", property.title || property.address, "/notifications");
      setDone(true);
    } catch (e) {
      console.error("오류제보 저장 실패:", e);
      alert("제보 저장 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-border"
          style={{ background: "hsl(var(--destructive) / 0.08)" }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" style={{ color: "hsl(var(--destructive))" }} />
            <h3 className="text-sm font-bold text-foreground">오류 제보</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted/50">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        {done ? (
          <div className="p-8 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="w-10 h-10" style={{ color: "hsl(var(--chart-2))" }} />
            <p className="text-sm font-bold text-foreground">제보가 접수되었습니다</p>
            <p className="text-xs text-muted-foreground">관리자가 검토 후 처리할 예정입니다.</p>
            <button
              onClick={onClose}
              className="mt-2 px-5 py-2 rounded-full text-xs font-bold text-white"
              style={{ background: "hsl(var(--primary))" }}
            >
              확인
            </button>
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">대상 매물</p>
              <p className="text-xs font-semibold text-foreground truncate">{property.title}</p>
              <p className="text-[11px] text-muted-foreground">{property.address}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">오류 내용 *</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="잘못된 정보, 허위 매물 등 오류 내용을 입력해주세요."
                rows={4}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground resize-none outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={!content.trim() || saving}
              className="w-full h-10 rounded-full text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{ background: "hsl(var(--destructive))" }}
            >
              {saving ? "제출 중..." : "제보하기"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── 거래완료 모달 ─── */
function DealCompleteModal({ property, onClose }: { property: MapProperty; onClose: () => void }) {
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
      // dbId(실제 DB UUID) 우선 사용, 없으면 memo(레거시 UUID 저장 필드), 마지막에 숫자 id
      const propertyId = property.dbId || property.memo || String(property.id);
      const { error } = await supabase.from("property_reports").insert({
        property_id: propertyId,
        property_title: property.title || property.address,
        property_address: property.address,
        report_type: "deal_complete",
        deal_date: dealDate,
        deal_memo: memo.trim() || null,
        submitted_by: session?.user?.id ?? null,
      });
      if (error) throw error;
      await notifySelf("transaction", "거래완료 신청이 완료되었습니다.", property.title || property.address, "/notifications");
      setDone(true);
    } catch (e) {
      console.error("거래완료 저장 실패:", e);
      alert("처리 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-border"
          style={{ background: "hsl(var(--chart-2) / 0.08)" }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" style={{ color: "hsl(var(--chart-2))" }} />
            <h3 className="text-sm font-bold text-foreground">거래 완료 처리</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted/50">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        {done ? (
          <div className="p-8 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="w-10 h-10" style={{ color: "hsl(var(--chart-2))" }} />
            <p className="text-sm font-bold text-foreground">거래완료가 접수되었습니다</p>
            <p className="text-xs text-muted-foreground">관리자가 확인 후 매물 상태를 변경합니다.</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-full text-xs font-bold text-white"
                style={{ background: "hsl(var(--primary))" }}
              >
                확인
              </button>
              <a
                href="/admin?tab=reports"
                className="px-5 py-2 rounded-full text-xs font-bold text-white"
                style={{ background: "hsl(var(--chart-2))" }}
              >
                관리자 페이지에서 확인
              </a>
            </div>
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">대상 매물</p>
              <p className="text-xs font-semibold text-foreground truncate">{property.title}</p>
              <p className="text-[11px] text-muted-foreground">{property.address}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">거래 완료일</label>
              <input
                type="date"
                value={dealDate}
                onChange={(e) => setDealDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">메모 (선택)</label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="거래 관련 메모를 입력하세요."
                rows={3}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground resize-none outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full h-10 rounded-full text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{ background: "hsl(var(--primary))" }}
            >
              {saving ? "처리 중..." : "확인"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── 임대현황 모달 (건물매매 전용: 동일주소 임대매물 자동로드 + 근저당/보증금 합계) ─── */
interface RoomRow {
  unit: string;
  deposit: string;
  monthly: string;
  status: string;
}
interface MortgageRow {
  creditor: string;
  amount: string;
  memo: string;
}

function RentalProposalModal({ property, onClose }: { property: MapProperty; onClose: () => void }) {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [mortgages, setMortgages] = useState<MortgageRow[]>([]);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(true);

  const ic =
    "w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20";
  const icUnit =
    "px-1.5 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-primary text-center font-bold w-full";

  // 정확히 동일한 주소(address)의 임대 매물만 로드 (중복 호수 제거)
  useEffect(() => {
    const load = async () => {
      if (!property.address) {
        setLoadingUnits(false);
        return;
      }
      try {
        const { data } = await supabase
          .from("properties")
          .select("unit_number, deposit, monthly, available_from, address")
          .eq("address", property.address) // 정확히 같은 주소만
          .eq("status", "active")
          .not("type", "ilike", "%매매%")
          .order("unit_number", { ascending: true });

        if (data && data.length > 0) {
          const seen = new Set<string>();
          const unique = data.filter((p) => {
            const key = (p.unit_number ?? "").trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setRooms(
            unique.map((p) => ({
              unit: p.unit_number ?? "",
              deposit: p.deposit ?? "",
              monthly: p.monthly ?? "",
              status: p.available_from === "공실" ? "공실" : "임대중",
            })),
          );
        } else {
          // 등록된 임대 매물 없으면 빈 행 1개
          setRooms([{ unit: "", deposit: "", monthly: "", status: "임대중" }]);
        }
      } catch (e) {
        console.error("임대 매물 로드 실패:", e);
        setRooms([{ unit: "", deposit: "", monthly: "", status: "임대중" }]);
      } finally {
        setLoadingUnits(false);
      }
    };
    load();
  }, [property.address]);

  const setRoom = (i: number, key: keyof RoomRow, v: string) =>
    setRooms((r) => r.map((row, idx) => (idx === i ? { ...row, [key]: v } : row)));
  const addRoom = () => setRooms((r) => [...r, { unit: "", deposit: "", monthly: "", status: "임대중" }]);
  const removeRoom = (i: number) => setRooms((r) => r.filter((_, idx) => idx !== i));

  const setMortgage = (i: number, key: keyof MortgageRow, v: string) =>
    setMortgages((r) => r.map((row, idx) => (idx === i ? { ...row, [key]: v } : row)));
  const addMortgage = () => setMortgages((r) => [...r, { creditor: "", amount: "", memo: "" }]);
  const removeMortgage = (i: number) => setMortgages((r) => r.filter((_, idx) => idx !== i));

  const totalDeposit = rooms.reduce((s, r) => s + (parseFloat(r.deposit.replace(/[^0-9.]/g, "")) || 0), 0);
  const totalMonthly = rooms.reduce((s, r) => s + (parseFloat(r.monthly.replace(/[^0-9.]/g, "")) || 0), 0);
  const totalMortgage = mortgages.reduce((s, m) => s + (parseFloat(m.amount.replace(/[^0-9.]/g, "")) || 0), 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const roomLines = rooms
        .filter((r) => r.unit || r.deposit || r.monthly)
        .map((r) => `[${r.unit || "-"}호] ${r.status} / 보증금 ${r.deposit || "0"}만원 / 월세 ${r.monthly || "0"}만원`)
        .join("\n");
      const mortgageLines = mortgages
        .filter((m) => m.creditor || m.amount)
        .map((m) => `${m.creditor || "-"}: ${m.amount || "0"}만원${m.memo ? ` (${m.memo})` : ""}`)
        .join("\n");
      const fullContent = [
        `■ 건물: ${property.title} / ${property.address}`,
        roomLines && `■ 호실별 임대 현황\n${roomLines}`,
        `■ 보증금 합계: ${totalDeposit.toLocaleString()}만원`,
        `■ 월세 합계: ${totalMonthly.toLocaleString()}만원`,
        mortgageLines && `■ 근저당 내역\n${mortgageLines}`,
        totalMortgage > 0 && `■ 근저당 합계: ${totalMortgage.toLocaleString()}만원`,
        memo && `■ 메모\n${memo}`,
      ]
        .filter(Boolean)
        .join("\n\n");

      const { error } = await supabase.from("property_reports").insert({
        property_id: String(property.id),
        property_title: property.title,
        property_address: property.address,
        report_type: "rental_proposal",
        proposer_name: "관리자",
        proposer_phone: "-",
        proposal_deposit: String(totalDeposit),
        proposal_monthly: String(totalMonthly),
        proposal_content: fullContent || null,
        submitted_by: session?.user?.id ?? null,
      });
      if (error) throw error;
      await notifySelf("proposal", "제안 신청이 완료되었습니다.", property.title || property.address, "/notifications");
      setDone(true);
    } catch (e) {
      console.error("임대현황 저장 실패:", e);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0"
          style={{ background: "hsl(var(--primary) / 0.08)" }}
        >
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            <div>
              <h3 className="text-sm font-bold text-foreground">임대 제안서 (건물 매매용)</h3>
              <p className="text-[10px] text-muted-foreground">{property.address}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted/50">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {done ? (
          <div className="p-8 flex flex-col items-center gap-3 text-center">
            <Send className="w-10 h-10 text-primary" />
            <p className="text-sm font-bold text-foreground">임대 제안서가 저장되었습니다</p>
            <button
              onClick={onClose}
              className="mt-2 px-5 py-2 rounded-full text-xs font-bold text-white"
              style={{ background: "hsl(var(--primary))" }}
            >
              확인
            </button>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-5">
            {/* ① 호실별 임대 현황 - 동일주소 임대매물만 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-foreground">
                  📋 호실별 임대 현황
                  {loadingUnits && (
                    <span className="ml-2 text-[10px] text-muted-foreground font-normal">불러오는 중...</span>
                  )}
                  {!loadingUnits && rooms.length > 0 && (
                    <span className="ml-2 text-[10px] text-primary font-normal">{rooms.length}개 호실</span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={addRoom}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold"
                  style={{ background: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}
                >
                  + 호실 추가
                </button>
              </div>

              {/* 테이블 헤더 */}
              <div className="grid grid-cols-[50px_1fr_1fr_32px] gap-1 mb-1 px-1">
                <span className="text-[10px] font-bold text-muted-foreground text-center">호실</span>
                <span className="text-[10px] font-bold text-muted-foreground text-center">보증금(만원)</span>
                <span className="text-[10px] font-bold text-muted-foreground text-center">월세(만원)</span>
                <span className="text-[10px] font-bold text-muted-foreground text-center">삭제</span>
              </div>

              <div className="flex flex-col gap-1">
                {rooms.map((row, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[50px_1fr_1fr_32px] gap-1 items-center rounded-lg px-1 py-1.5"
                    style={{ background: i % 2 === 0 ? "hsl(var(--muted)/0.4)" : "transparent" }}
                  >
                    <input
                      type="text"
                      placeholder="101"
                      value={row.unit}
                      onChange={(e) => setRoom(i, "unit", e.target.value)}
                      className={icUnit}
                    />
                    <input
                      type="text"
                      placeholder="500"
                      value={row.deposit}
                      onChange={(e) => setRoom(i, "deposit", e.target.value)}
                      className={ic}
                    />
                    <input
                      type="text"
                      placeholder="50"
                      value={row.monthly}
                      onChange={(e) => setRoom(i, "monthly", e.target.value)}
                      className={ic}
                    />
                    <button
                      type="button"
                      onClick={() => removeRoom(i)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-destructive/15 transition-colors mx-auto"
                      title="삭제"
                    >
                      <X className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                ))}
                {rooms.length === 0 && !loadingUnits && (
                  <div className="text-center py-4 text-xs text-muted-foreground">
                    같은 주소의 임대 매물이 없습니다. 수기로 입력하세요.
                  </div>
                )}
              </div>

              {/* 소계 */}
              {rooms.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg border"
                    style={{ borderColor: "hsl(var(--primary)/0.3)", background: "hsl(var(--primary)/0.05)" }}
                  >
                    <span className="text-[11px] font-bold text-foreground">보증금 합계</span>
                    <span className="text-xs font-extrabold text-primary">{totalDeposit.toLocaleString()}만원</span>
                  </div>
                  <div
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg border"
                    style={{ borderColor: "hsl(var(--accent)/0.4)", background: "hsl(var(--accent)/0.05)" }}
                  >
                    <span className="text-[11px] font-bold text-foreground">월세 합계</span>
                    <span className="text-xs font-extrabold" style={{ color: "hsl(var(--accent))" }}>
                      {totalMonthly.toLocaleString()}만원
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ② 근저당 내역 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-foreground">🏦 근저당 내역</p>
                <button
                  type="button"
                  onClick={addMortgage}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold"
                  style={{ background: "hsl(0 85% 45% / 0.1)", color: "hsl(0 85% 45%)" }}
                >
                  + 항목 추가
                </button>
              </div>

              {mortgages.length > 0 && (
                <>
                  <div className="grid grid-cols-[1fr_90px_90px_32px] gap-1 mb-1 px-1">
                    <span className="text-[10px] font-bold text-muted-foreground">채권자</span>
                    <span className="text-[10px] font-bold text-muted-foreground text-center">금액(만원)</span>
                    <span className="text-[10px] font-bold text-muted-foreground text-center">메모</span>
                    <span className="text-[10px] font-bold text-muted-foreground text-center">삭제</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {mortgages.map((m, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[1fr_90px_90px_32px] gap-1 items-center rounded-lg px-1 py-1.5"
                        style={{ background: i % 2 === 0 ? "hsl(var(--muted)/0.4)" : "transparent" }}
                      >
                        <input
                          type="text"
                          placeholder="예) OO은행"
                          value={m.creditor}
                          onChange={(e) => setMortgage(i, "creditor", e.target.value)}
                          className={ic}
                        />
                        <input
                          type="text"
                          placeholder="10,000"
                          value={m.amount}
                          onChange={(e) => setMortgage(i, "amount", e.target.value)}
                          className={ic}
                        />
                        <input
                          type="text"
                          placeholder="1순위 등"
                          value={m.memo}
                          onChange={(e) => setMortgage(i, "memo", e.target.value)}
                          className={ic}
                        />
                        <button
                          type="button"
                          onClick={() => removeMortgage(i)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-destructive/15 transition-colors mx-auto"
                          title="삭제"
                        >
                          <X className="w-3.5 h-3.5 text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {totalMortgage > 0 && (
                    <div
                      className="mt-2 flex items-center justify-between px-3 py-1.5 rounded-lg border"
                      style={{ borderColor: "hsl(0 85% 45% / 0.3)", background: "hsl(0 85% 45% / 0.05)" }}
                    >
                      <span className="text-[11px] font-bold text-foreground">근저당 합계</span>
                      <span className="text-xs font-extrabold" style={{ color: "hsl(0 85% 45%)" }}>
                        {totalMortgage.toLocaleString()}만원
                      </span>
                    </div>
                  )}
                </>
              )}
              {mortgages.length === 0 && (
                <div className="text-center py-2 text-xs text-muted-foreground">근저당 항목을 추가하세요.</div>
              )}
            </div>

            {/* ③ 종합 요약 */}
            {(totalDeposit > 0 || totalMortgage > 0) && (
              <div
                className="rounded-xl border-2 p-3 flex flex-col gap-1"
                style={{ borderColor: "hsl(var(--primary)/0.4)", background: "hsl(var(--primary)/0.04)" }}
              >
                <p className="text-xs font-extrabold text-foreground mb-1">📊 종합 요약</p>
                {totalDeposit > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">보증금 합계</span>
                    <span className="font-bold text-primary">{totalDeposit.toLocaleString()}만원</span>
                  </div>
                )}
                {totalMonthly > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">월세 합계</span>
                    <span className="font-bold" style={{ color: "hsl(var(--accent))" }}>
                      {totalMonthly.toLocaleString()}만원
                    </span>
                  </div>
                )}
                {totalMortgage > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">근저당 합계</span>
                    <span className="font-bold" style={{ color: "hsl(0 85% 45%)" }}>
                      {totalMortgage.toLocaleString()}만원
                    </span>
                  </div>
                )}
                {totalDeposit > 0 && totalMortgage > 0 && (
                  <div className="flex justify-between text-xs border-t border-border mt-1 pt-1">
                    <span className="font-bold text-foreground">보증금 - 근저당</span>
                    <span
                      className="font-extrabold"
                      style={{ color: totalDeposit - totalMortgage >= 0 ? "hsl(var(--primary))" : "hsl(0 85% 45%)" }}
                    >
                      {(totalDeposit - totalMortgage).toLocaleString()}만원
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ④ 메모 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">메모 (선택)</label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="특이사항, 입주 조건 등"
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground resize-none outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>

            {/* 하단 버튼 영역: 취소 + 저장 */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-11 rounded-full text-sm font-bold border border-border text-foreground flex items-center justify-center gap-2 transition-all hover:bg-muted/50 active:scale-95"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-[2] h-11 rounded-full text-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-95"
                style={{ background: "hsl(var(--primary))" }}
              >
                <Send className="w-4 h-4" />
                {saving ? "저장 중..." : "임대 제안서 저장"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── 공적장부 통합 열람 모달 ─── */
function PublicRecordModal({ address, onClose }: { address: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [building, setBuilding] = useState<Record<string, unknown> | null>(null);
  const [land, setLand] = useState<Record<string, unknown> | null>(null);

  const str = (v: unknown) => (v != null && v !== "" ? String(v) : "-");

  useEffect(() => {
    const fetchData = async () => {
      console.log("OPEN_PROPERTY_MODAL", address);
      if (!address) {
        setError("주소 정보가 없습니다.");
        setLoading(false);
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/property-summary`;
        const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const bearer = session?.access_token ?? apiKey;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: apiKey,
            Authorization: `Bearer ${bearer}`,
          },
          body: JSON.stringify({ address }),
        });
        const data = await res.json();
        console.log("PROPERTY_SUMMARY_RESPONSE", data);
        if (!res.ok) throw new Error(data.error || "조회 실패");
        setBuilding(data.building_summary ?? null);
        setLand(data.land_summary ?? null);
      } catch (e: unknown) {
        console.error("PROPERTY_SUMMARY_ERROR", e);
        setError(e instanceof Error ? e.message : "오류 발생");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [address]);

  const Row = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
      <span className="w-[88px] flex-shrink-0 text-xs text-muted-foreground font-medium leading-tight pt-0.5">
        {label}
      </span>
      <span className="text-xs font-semibold text-foreground leading-tight flex-1">{value ?? "-"}</span>
    </div>
  );

  const SectionTitle = ({ icon, title, color }: { icon: string; title: string; color: string }) => (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-border" style={{ background: color }}>
      <span className="text-base">{icon}</span>
      <span className="text-sm font-bold text-foreground">{title}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/60 p-2 sm:p-4" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden w-[calc(100vw-16px)] sm:w-full sm:max-w-md"
        style={{ maxHeight: "calc(100dvh - 16px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0"
          style={{ background: "hsl(var(--primary) / 0.06)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "hsl(var(--primary) / 0.15)" }}
            >
              <Layers className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">건축물대장·토지대장</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight line-clamp-1">{address}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="overflow-y-auto flex-1">
          {/* 로딩 */}
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-sm text-muted-foreground">공적장부 조회중...</p>
            </div>
          )}

          {/* 오류 */}
          {!loading && error && (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "hsl(var(--destructive) / 0.1)" }}
              >
                <AlertTriangle className="w-6 h-6" style={{ color: "hsl(var(--destructive))" }} />
              </div>
              <p className="text-sm font-bold text-foreground">공적장부 조회 실패</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          )}

          {/* 빈 결과 */}
          {!loading && !error && !building && !land && (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <Layers className="w-10 h-10 text-muted-foreground/25" />
              <p className="text-sm font-semibold text-muted-foreground">조회 결과 없음</p>
              <p className="text-xs text-muted-foreground/60">해당 주소의 공적장부 데이터가 없습니다</p>
            </div>
          )}

          {/* 정상 출력 — 토지 + 건축 위아래 동시 표시 */}
          {!loading && !error && (building || land) && (
            <div className="flex flex-col">
              {/* ① 토지 정보 */}
              <SectionTitle icon="🌍" title="토지 정보" color="hsl(142 50% 95%)" />
              {land ? (
                <div className="px-4 py-1">
                  <Row label="지번주소" value={str(land.lot_number) !== "-" ? str(land.lot_number) : address} />
                  <Row label="공시지가" value={str(land.official_price)} />
                  <Row label="토지면적" value={str(land.land_area)} />
                  <Row label="지목" value={str(land.land_category)} />
                  <Row label="용도지역" value={str(land.use_zone)} />
                  <Row label="도로조건" value={str(land.road_access)} />
                </div>
              ) : (
                <p className="text-xs text-center text-muted-foreground py-5">토지대장 데이터 없음</p>
              )}

              {/* 구분선 */}
              <div className="h-2 bg-muted/50 my-1" />

              {/* ② 건축물 정보 */}
              <SectionTitle icon="🏢" title="건축물 정보" color="hsl(var(--primary) / 0.06)" />
              {building ? (
                <div className="px-4 py-1">
                  <Row label="건물명" value={str(building.building_name)} />
                  <Row
                    label="건축물용도"
                    value={str(building.main_purpose) === "조회 결과 없음" ? "-" : str(building.main_purpose)}
                  />
                  <Row label="연면적" value={str(building.total_area)} />
                  <Row label="대지면적" value={str(building.land_area)} />
                  <Row label="건축면적" value={str(building.building_area)} />
                  <Row label="사용승인일" value={str(building.approval_date)} />
                  <Row
                    label="층수"
                    value={
                      building.floors_above
                        ? `지상 ${building.floors_above}층${building.floors_below && String(building.floors_below) !== "0" ? ` / 지하 ${building.floors_below}층` : ""}`
                        : "-"
                    }
                  />
                  <Row
                    label="주차대수"
                    value={
                      str(building.parking_count) !== "-" && str(building.parking_count) !== "0"
                        ? `${building.parking_count}대`
                        : str(building.parking_count)
                    }
                  />
                  <Row
                    label="엘리베이터"
                    value={building.elevator === true ? "있음" : building.elevator === false ? "없음" : "-"}
                  />
                  {/* _raw 추가 정보 (data.go.kr 실제 데이터 존재 시) */}
                  {building._raw &&
                    typeof building._raw === "object" &&
                    (() => {
                      const raw = building._raw as Record<string, unknown>;
                      return (
                        <>
                          {raw.strctCdNm && <Row label="구조" value={str(raw.strctCdNm)} />}
                          {raw.bcRat && <Row label="건폐율" value={str(raw.bcRat)} />}
                          {raw.vlRat && <Row label="용적률" value={str(raw.vlRat)} />}
                          {(() => {
                            const primary = pickPrimaryCountKey(str(raw.mainPurpsCdNm), {
                              hhld: raw.hhldCnt, fmly: raw.fmlyCnt, ho: raw.hoCnt,
                            });
                            const rows: Array<["hhld" | "fmly" | "ho", string, string]> = [
                              ["hhld", "세대수", formatUnitCount(raw.hhldCnt, "세대")],
                              ["fmly", "가구수", formatUnitCount(raw.fmlyCnt, "가구")],
                              ["ho", "호수", formatUnitCount(raw.hoCnt, "호")],
                            ];
                            rows.sort((a, b) => (a[0] === primary ? -1 : b[0] === primary ? 1 : 0));
                            return rows.map(([k, label, value]) => (
                              <Row key={k} label={label} value={value} />
                            ));
                          })()}
                          {raw.roofCdNm && <Row label="지붕구조" value={str(raw.roofCdNm)} />}
                        </>
                      );
                    })()}
                </div>
              ) : (
                <p className="text-xs text-center text-muted-foreground py-5">건축물대장 데이터 없음</p>
              )}

              {/* ③ 층별 정보 (data.go.kr 실제 데이터 존재 시) */}
              {building?._raw &&
                typeof building._raw === "object" &&
                Array.isArray((building._raw as Record<string, unknown>).floors) &&
                ((building._raw as Record<string, unknown>).floors as unknown[]).length > 0 &&
                (() => {
                  const rawBldg = building._raw as Record<string, unknown>;
                  const floors = rawBldg.floors as Array<Record<string, unknown>>;
                  const primary = pickPrimaryCountKey(str(rawBldg.mainPurpsCdNm), {
                    hhld: rawBldg.hhldCnt, fmly: rawBldg.fmlyCnt, ho: rawBldg.hoCnt,
                  });
                  const countMeta = primary === "fmly"
                    ? { label: "가구수", field: "fmlyCnt", suffix: "가구" }
                    : primary === "ho"
                      ? { label: "호수", field: "hoCnt", suffix: "호" }
                      : { label: "세대수", field: "hhldCnt", suffix: "세대" };
                  return (
                    <>
                      <div className="h-2 bg-muted/50 my-1" />
                      <SectionTitle icon="📐" title="층별 개요" color="hsl(221 90% 97%)" />
                      <div className="px-4 py-2">
                        <div className="grid grid-cols-4 gap-0 text-[10px] font-bold text-muted-foreground border-b border-border/40 pb-1.5 mb-1">
                          <span>층</span>
                          <span>면적</span>
                          <span>용도</span>
                          <span>{countMeta.label}</span>
                        </div>
                        {floors.map((f, i) => (
                          <div
                            key={i}
                            className="grid grid-cols-4 gap-0 text-xs py-1.5 border-b border-border/20 last:border-0"
                          >
                            <span className="font-medium text-foreground">{String(f.flrNoNm ?? f.flrNo ?? "-")}</span>
                            <span className="text-muted-foreground">{String(f.area ?? "-")}</span>
                            <span className="text-muted-foreground">{String(f.mainPurpsCdNm ?? "-")}</span>
                            <span className="text-muted-foreground">{(() => { const v = formatUnitCount(f[countMeta.field], countMeta.suffix); return v === "미기재" ? "" : v; })()}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}

              {/* 데이터 출처 안내 */}
              <div className="px-4 py-3 mt-1">
                <p className="text-[10px] text-muted-foreground/50 text-center">
                  출처: 국토교통부 건축물대장 공공데이터 (data.go.kr)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-muted/20">
          <button
            onClick={onClose}
            className="w-full h-10 rounded-xl text-sm font-bold text-primary border border-primary/40 hover:bg-primary/5 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── 공적장부 버튼 + 인라인 토지 조회 결과 ─── */
function PropertySummaryPanel({ address, pnu }: { address: string; pnu?: string }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [landOpen, setLandOpen] = useState(false);
  const [landLoading, setLandLoading] = useState(false);
  const [landError, setLandError] = useState("");
  const [landData, setLandData] = useState<Record<string, unknown> | null>(null);

  const LAND_PROXY = "https://port-0-node-express-mn6x22nsd44b9fb3.sel3.cloudtype.app";

  const handleLandClick = async () => {
    console.log("[공적장부] 버튼 클릭, address:", address);
    console.log("[공적장부] pnu:", pnu);

    if (!pnu) {
      console.error("[공적장부] PNU 없음");
      setLandError("토지 조회 실패");
      setLandOpen(true);
      return;
    }

    if (landOpen && landData) {
      setLandOpen(false);
      return;
    }

    setLandOpen(true);
    setLandLoading(true);
    setLandError("");
    setLandData(null);

    const url = `${LAND_PROXY}/land?pnu=${encodeURIComponent(pnu)}`;
    console.log("[공적장부] API URL:", url);

    try {
      const res = await fetch(url);
      const text = await res.text();
      console.log("LAND_RAW_RESPONSE:", text);

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("프록시 서버가 JSON이 아니라 HTML을 반환했습니다. 주소를 확인하세요.");
      }

      if (!res.ok) throw new Error((data?.message as string) || "토지 조회 실패");
      setLandData(data);
    } catch (e: unknown) {
      console.error("❌ 토지 조회 실패:", e);
      setLandError(e instanceof Error ? e.message : "토지 조회 실패");
    } finally {
      setLandLoading(false);
    }
  };

  // 응답에서 토지 정보 추출
  const landInfo = landData?.landInfo as Record<string, unknown> | undefined;

  return (
    <div className="px-4 pb-3">
      <button
        type="button"
        onClick={handleLandClick}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border hover:bg-primary/5 transition-colors"
        style={{ borderColor: "hsl(var(--primary) / 0.4)", background: "hsl(var(--primary) / 0.04)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "hsl(var(--primary) / 0.15)" }}
          >
            <Layers className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-xs font-bold text-foreground">공적장부</span>
        </div>
        <span
          className="text-[10px] font-semibold px-2.5 py-1 rounded-full text-white"
          style={{ background: "hsl(var(--primary))" }}
        >
          {landOpen ? "닫기" : "조회"}
        </span>
      </button>
      <button
        onClick={() => setModalOpen(true)}
        className="w-full mt-2 flex items-center justify-center px-4 py-2 rounded-xl border text-xs font-bold"
      >
        건축물 + 토지 전체 보기
      </button>
      {/* 인라인 토지 결과 박스 */}
      {landOpen && (
        <div
          className="mt-2 rounded-xl border px-4 py-3 space-y-1.5"
          style={{ background: "hsl(48 100% 96%)", borderColor: "hsl(48 80% 75%)" }}
        >
          {landLoading && (
            <p className="text-xs text-center py-2" style={{ color: "hsl(48 80% 35%)" }}>
              조회중...
            </p>
          )}
          {!landLoading && landError && (
            <p className="text-xs text-center py-2" style={{ color: "hsl(var(--destructive))" }}>
              {landError}
            </p>
          )}
          {!landLoading && !landError && landInfo && (
            <>
              <LandRow label="지번주소" value={String(landData?.parcelAddress ?? "-")} />
              <LandRow label="지목" value={String(landInfo.category ?? "-")} />
              <LandRow label="면적" value={landInfo.area ? `${landInfo.area}㎡` : "-"} />
              <LandRow label="소유구분" value={String(landInfo.owner ?? "-")} />
              <LandRow label="최종업데이트" value={String(landInfo.updateDate ?? "-")} />
            </>
          )}
          {!landLoading && !landError && !landInfo && (
            <p className="text-xs text-center py-2 text-muted-foreground">토지 데이터 없음</p>
          )}
        </div>
      )}

      {modalOpen && (
        <PublicRecordModal key={address + String(modalOpen)} address={address} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}

function LandRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold w-[72px] flex-shrink-0" style={{ color: "hsl(48 60% 30%)" }}>
        {label}
      </span>
      <span className="text-[11px] font-medium text-foreground">{value}</span>
    </div>
  );
}

const PropertyDetailPanel = ({ property, onClose, sameProperties = [] }: PropertyDetailPanelProps) => {
  const [liked, setLiked] = useState(false);
  const [lightboxUnitIdx, setLightboxUnitIdx] = useState<number | null>(null);
  const [activeModal, setActiveModal] = useState<"error" | "deal" | "proposal" | null>(null);
  const { user: authUser } = useAuth();
  const isGuest = useIsGuest();
  const [myAgencyInfo, setMyAgencyInfo] = useState<AgencyInfo | undefined>(undefined);
  // 동일주소의 종료(inactive) 호실 사진들도 라이트박스에 표시
  const [inactiveUnits, setInactiveUnits] = useState<Array<{ unitNumber: string; roomType: string; images: string[] }>>([]);
  // 게스트/일반회원에게 표시할 담당 부동산 사무소명 (등록자 user_id 기준)
  const [registrarAgencyName, setRegistrarAgencyName] = useState<string>("");
  const isGeneralMember = authUser?.memberType === "일반회원";
  const showAgencyOnly = isGuest || isGeneralMember;

  // 모바일 뒤로가기 → 패널 닫기 (단, 위에 다른 오버레이/채팅이 열려 있으면 무시)
  useEffect(() => {
    pushOverlay();
    window.history.pushState({ detailPanel: true }, "");
    const onPopState = () => {
      // 채팅 등 더 위에 푸시된 오버레이가 있으면, 그 오버레이가 먼저 닫혀야 함
      if (getOverlayCount() > 1) return;
      onClose();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      popOverlay();
    };
  }, [onClose]);


  useEffect(() => {
    if (!property?.address) { setInactiveUnits([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("get_reference_images", { _addresses: [property.address] });
      if (cancelled || !data) return;
      setInactiveUnits(
        (data as Array<{ address: string; unit_number: string; room_type: string; images: string[] }>)
          .filter((r) => r.images && r.images.length > 0)
          .map((r) => ({ unitNumber: r.unit_number || "?", roomType: r.room_type || "", images: r.images }))
      );
    })();
    return () => { cancelled = true; };
  }, [property?.address]);

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

  // 게스트/일반회원에게 보여줄 등록자(중개사) 사무소명 조회
  useEffect(() => {
    const regBy = (property as { registeredBy?: string } | null)?.registeredBy;
    if (!showAgencyOnly || !regBy) { setRegistrarAgencyName(""); return; }
    let cancelled = false;
    supabase
      .from("agent_profiles")
      .select("agency_name, name")
      .eq("user_id", regBy)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setRegistrarAgencyName(data?.agency_name?.trim() || data?.name?.trim() || "");
      });
    return () => { cancelled = true; };
  }, [showAgencyOnly, (property as { registeredBy?: string } | null)?.registeredBy]);

  if (!property) return null;

  const typeStyle = TYPE_STYLE[property.type] ?? { bg: "bg-primary", text: "text-white" };
  const propertyPnu =
    typeof (property as unknown as { pnu?: unknown }).pnu === "string"
      ? String((property as unknown as { pnu?: unknown }).pnu)
      : undefined;

  const allImages =
    property.images && property.images.length > 0 ? property.images : property.image ? [property.image] : [];

  // 동일주소 호실별 라이트박스 유닛 구성
  const otherUnits = sameProperties.filter(
    (p) => p.id !== property.id && ((p.images && p.images.length > 0) || p.image),
  );
  const lightboxUnits: LightboxUnit[] = [
    {
      label: isGuest
        ? (property.floor ? `${property.floor}` : "현재 매물")
        : (property.unitNumber ? `${property.unitNumber}호` : property.title || "현재 매물"),
      images: allImages,
    },
    ...otherUnits.map((p) => ({
      label: isGuest
        ? (p.floor ? `${p.floor}` : "")
        : (p.unitNumber ? `${p.unitNumber}호` : p.title || p.address),
      images: p.images && p.images.length > 0 ? p.images : p.image ? [p.image] : [],
    })),
  ].filter((u) => u.images.length > 0);

  // 종료된 동일주소 호실 사진 추가 (호실번호 기준으로 중복 제거)
  const seenUnits = new Set<string>([
    property.unitNumber || "?",
    ...otherUnits.map((p) => p.unitNumber || "?"),
  ]);
  for (const u of inactiveUnits) {
    if (seenUnits.has(u.unitNumber)) continue;
    seenUnits.add(u.unitNumber);
    lightboxUnits.push({
      label: isGuest
        ? ""
        : `${u.unitNumber}호${u.roomType ? ` ${u.roomType}` : ""} (종료)`,
      images: u.images,

      isReference: true,
    });
  }


  return (
    <>
      {/* ── 풀스크린 라이트박스 ── */}
      {lightboxUnitIdx !== null && (
        <Lightbox units={lightboxUnits} startUnitIdx={lightboxUnitIdx} onClose={() => setLightboxUnitIdx(null)} />
      )}

      {/* ── 액션 모달 ── */}
      {activeModal === "error" && <ErrorReportModal property={property} onClose={() => setActiveModal(null)} />}
      {activeModal === "deal" && <DealCompleteModal property={property} onClose={() => setActiveModal(null)} />}
      {activeModal === "proposal" && <RentalProposalModal property={property} onClose={() => setActiveModal(null)} />}

      <div className="absolute left-0 top-0 bottom-0 z-[900] w-[360px] bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-250">
        {/* ── Image Carousel ── */}
        <div className="relative">
          <ImageCarousel images={allImages} title={property.title} onImageClick={(i) => setLightboxUnitIdx(0)} />

          {/* Badges */}
          <div
            className="absolute top-3 left-3 flex gap-1.5 z-10"
            style={{ top: allImages.length > 1 ? "2.5rem" : "0.75rem" }}
          >
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${typeStyle.bg} ${typeStyle.text}`}>
              {property.type}
            </span>
            {property.isNew && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-badge-new text-white">NEW</span>
            )}
            {property.isHot && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-badge-hot text-white">HOT</span>
            )}
          </div>

          {/* Top-right controls */}
          <div className="absolute top-3 right-3 flex gap-1.5 z-10">
            <button
              onClick={() => setLiked(!liked)}
              className="w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center backdrop-blur-sm transition-colors"
            >
              <Heart className={`w-3.5 h-3.5 ${liked ? "fill-red-400 text-red-400" : "text-white"}`} />
            </button>
            <button
              onClick={() => {
                const hasOwn = (property.images && property.images.length > 0) || (property.image && property.image.length > 0);
                let fallback: string | undefined;
                if (!hasOwn && sameProperties.length > 0) {
                  const sibling = sameProperties.find(p => p.images && p.images.length > 0);
                  fallback = sibling?.images?.[0] || sibling?.image;
                }
                sharePropertyToKakao(property, myAgencyInfo, fallback);
              }}
              title="카카오톡 공유"
              className="w-10 h-10 md:w-7 md:h-7 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center backdrop-blur-sm transition-colors"
            >
              <img src={kakaoTalkIcon} alt="카카오톡 공유" className="w-6 h-6 md:w-5 md:h-5 pointer-events-none select-none" />
            </button>
            <button
              onClick={onClose}
              aria-label="닫기"
              title="닫기"
              className="w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg ring-2 ring-white/70 transition-colors"
            >
              <X className="w-5 h-5 text-white" strokeWidth={3} />
            </button>
          </div>

          {/* Bottom title overlay */}
          <div className="absolute bottom-3 left-4 right-4 z-10">
            <p className="text-white font-bold text-[15px] line-clamp-1 drop-shadow-sm">{property.title}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-white/70 flex-shrink-0" />
              <p className="text-white/80 text-xs line-clamp-1">{isGuest ? addressToDong(property.address) : property.address}</p>
            </div>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Price block */}
          <div className="px-4 py-4 bg-primary/5 border-b border-border">
            {/* 임대 방식별 금액 파싱 (note 필드에 월세/반전세/전세 저장됨) */}
            {(() => {
              const note = property.note ?? "";
              const wolseMatch = note.match(/월세: 보증금 ([^\n/]+)만원 \/ 월세 ([^\n]+)만원/);
              const halfMatch = note.match(/반전세: 보증금 ([^\n/]+)만원 \/ 월세 ([^\n]+)만원/);
              const jeonseMatch = note.match(/(?<!반)전세: 보증금 ([^\n]+?)만원(?!\s*\/)/);
              const hasMultiRent = wolseMatch || halfMatch || jeonseMatch;

              return hasMultiRent ? (
                <div className="flex flex-col gap-2 mb-2">
                  {wolseMatch && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground font-medium">💰 월세</span>
                      <span className="text-sm font-extrabold text-foreground">
                        보증금 {wolseMatch[1]}만원 <span className="text-muted-foreground font-light">/</span>{" "}
                        <span className="text-accent">월 {wolseMatch[2]}만원</span>
                      </span>
                    </div>
                  )}
                  {halfMatch && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground font-medium">🏠 반전세</span>
                      <span className="text-sm font-extrabold text-foreground">
                        보증금 {halfMatch[1]}만원 <span className="text-muted-foreground font-light">/</span>{" "}
                        <span className="text-accent">월 {halfMatch[2]}만원</span>
                      </span>
                    </div>
                  )}
                  {jeonseMatch && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground font-medium">🏡 전세</span>
                      <span className="text-sm font-extrabold text-foreground">보증금 {jeonseMatch[1]}만원</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-[11px] text-muted-foreground font-medium mb-0.5">보증금 / 월세</p>
                    <p className="text-xl font-extrabold text-foreground leading-tight">
                      {property.deposit}
                      <span className="text-muted-foreground font-light mx-1.5 text-base">/</span>
                      <span className="text-accent">{property.monthly}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">관리비</p>
                    <p className="text-sm font-semibold text-foreground">{property.manageFee}</p>
                  </div>
                </div>
              );
            })()}
            <div className="flex items-center gap-3 pt-2 border-t border-border/60">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Eye className="w-3 h-3" />
                <span>조회 {property.views.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-badge-new font-semibold">
                <BadgeCheck className="w-3 h-3" />
                <span>입주가능 {property.availableFrom}</span>
              </div>
            </div>
          </div>

          {/* ── 추가 조건 정보 (방향·빈방여부·LH·청소비·중개보수) ── */}
          {(() => {
            const note = property.note ?? "";
            const directionMatch = note.match(/방향[:\s]+([^\n|]+)/);
            const lhMatch = note.match(/LH[:\s]+([^\n|]+)/);
            const cleanMatch = note.match(/청소비[:\s]+([^\n|]+)/);
            const brokerFeeMatch = note.match(/중개보수[:\s]+([^\n|]+)/);

            const direction = directionMatch?.[1]?.trim();
            const lhType = lhMatch?.[1]?.trim();
            const cleanFee = cleanMatch?.[1]?.trim();
            const brokerFee = brokerFeeMatch?.[1]?.trim();
            const vacateDate = property.vacateDate;
            // 임대 매물 여부 (매매 타입 제외: 모든 임대 유형에 퇴거일 항시 표시)
            const SALE_TYPES = [
              "매매",
              "단독매매",
              "건물매매",
              "상가주택매매",
              "상가건물매매",
              "구분상가매매",
              "창고/공장매매",
              "다가구매매",
              "다중매매",
            ];
            const isRentType = !SALE_TYPES.includes(property.type);

            // 공실여부: 임대 매물일 때만 표시 (매매 타입 제외)
            const vacancy =
              isRentType &&
              property.availableFrom &&
              (property.availableFrom === "공실" || property.availableFrom === "세입자 거주중")
                ? property.availableFrom
                : null;

            const items = [
              vacancy && {
                label: "빈방여부",
                value: vacancy === "세입자 거주중" ? "거주중" : vacancy,
                color: vacancy === "공실" ? "hsl(142 71% 45%)" : "hsl(25 95% 53%)",
              },
              direction && { label: "방향", value: direction + "향", color: "hsl(var(--foreground))" },
              lhType &&
                lhType !== "관계없음" && {
                  label: "LH 대출",
                  value: lhType,
                  color:
                    lhType === "LH가능"
                      ? "hsl(217 91% 60%)"
                      : lhType === "LH불가"
                        ? "hsl(var(--destructive))"
                        : "hsl(var(--muted-foreground))",
                },
              cleanFee && {
                label: "퇴실청소비",
                value: cleanFee.endsWith("만원") ? cleanFee : `${cleanFee}만원`,
                color: "hsl(var(--foreground))",
              },
              brokerFee && { label: "중개수수료", value: brokerFee, color: "hsl(0 85% 45%)" },
              brokerFee && { label: "중개수수료", value: brokerFee, color: "hsl(0 85% 45%)" },
              // 임대 매물은 퇴거 예정일 항시 표시 (값 없으면 "-")
              isRentType && {
                label: "퇴거 예정일",
                value: vacateDate || "-",
                color: vacateDate ? "hsl(0 85% 45%)" : "hsl(var(--muted-foreground))",
              },
            ].filter(Boolean) as { label: string; value: string; color: string }[];

            if (items.length === 0) return null;
            return (
              <div className="mx-4 mb-3 rounded-xl border border-border bg-muted/30 overflow-hidden">
                {items.map((item, i) => (
                  <div
                    key={item.label}
                    className={`flex items-center justify-between px-3 py-2 text-xs ${i > 0 ? "border-t border-border/50" : ""} ${item.label === "퇴거 예정일" ? "hidden md:flex" : ""}`}
                  >
                    <span className="text-muted-foreground font-medium">{item.label}</span>
                    <span className="font-bold" style={{ color: item.color }}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Info grid */}
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-bold text-foreground mb-2 uppercase tracking-wide">매물 정보</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  icon: <Maximize2 className="w-3.5 h-3.5" />,
                  label: "면적",
                  value: (() => {
                    const a = property.area || "";
                    const m = a.match(/\((\d+)평\)/) ?? a.match(/^(\d+)평/) ?? a.match(/^(\d+)$/);
                    return m ? m[1] + "평" : a.split(" ")[0];
                  })(),
                  sub: property.area.includes("(") ? property.area.split(" ")[1] : undefined,
                },
                { icon: <Layers className="w-3.5 h-3.5" />, label: "해당층", value: property.floor },
                {
                  icon: <Building2 className="w-3.5 h-3.5" />,
                  label: "건물층",
                  value: property.totalFloors.replace("지상 ", ""),
                },
                {
                  icon: <Calendar className="w-3.5 h-3.5" />,
                  label: "준공",
                  value: property.buildYear.replace("년", ""),
                  sub: "년",
                },
                { icon: <Car className="w-3.5 h-3.5" />, label: "주차", value: property.parking },
                {
                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><polygon points="12,3 5,11 19,11" /><polygon points="12,21 5,13 19,13" /></svg>,
                  label: "엘리베이터",
                  value: property.elevator ? "있음" : "없음",
                },
                ...(() => {
                  const m = (property.note ?? "").match(/건평[:\s]+([^\n|]+)/);
                  return m ? [{ icon: <Building2 className="w-3.5 h-3.5" />, label: "건평", value: m[1].trim() }] : [];
                })(),
                ...(() => {
                  const m = (property.note ?? "").match(/동[(\（]棟[)\）][:\s：\s]*([^\n|]+)/);
                  return m ? [{ icon: <Building2 className="w-3.5 h-3.5" />, label: "동", value: m[1].trim() }] : [];
                })(),
              ].map(({ icon, label, value, sub }) => (
                <div key={label} className="bg-muted/50 rounded-lg px-2.5 py-2 flex flex-col gap-0.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                    {icon}
                    <span className="text-[10px]">{label}</span>
                  </div>
                  <p className="text-sm font-bold text-foreground leading-tight">
                    {value}
                    {sub && <span className="text-xs font-normal text-muted-foreground">{sub}</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          {!isGuest && (
            <>
              <div className="h-2 bg-muted/50 my-2" />
              <div className="px-4 pb-3">
                <p className="text-xs font-bold text-foreground mb-2 uppercase tracking-wide">매물 설명</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{property.description}</p>
              </div>
            </>
          )}

          {/* ── 비밀번호 ── */}
          {!isGuest && (property.buildingPassword || property.roomPassword || property.password) && (
            <>
              <div className="h-2 bg-muted/50 my-2" />
              <div className="px-4 pb-3 flex flex-col gap-2">
                <p className="text-xs font-bold text-foreground uppercase tracking-wide">비밀번호</p>
                <div className="px-3 py-2.5 rounded-xl border border-border bg-muted/30 flex flex-col gap-2">
                  {property.buildingPassword && (
                    <div className="relative group cursor-default">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-muted-foreground font-medium">🏢 건물 공동현관</span>
                        <span className="text-base font-bold tracking-widest text-primary">
                          건{property.buildingPassword}
                        </span>
                      </div>
                      {/* 호버 툴팁 */}
                      <div className="pointer-events-none absolute left-0 bottom-full mb-1.5 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <div className="bg-foreground text-background text-[11px] font-semibold px-2.5 py-1 rounded-lg shadow-lg whitespace-nowrap">
                          🏢 건물 공동현관 비밀번호
                          <div className="absolute top-full left-4 w-2 h-1.5 overflow-hidden">
                            <div className="w-2 h-2 bg-foreground rotate-45 -translate-y-1" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {property.buildingPassword && (property.roomPassword || property.password) && (
                    <div className="h-px bg-border" />
                  )}
                  {(property.roomPassword || property.password) && (
                    <div className="relative group cursor-default">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-muted-foreground font-medium">🚪 방(호실) 도어락</span>
                        <span className="text-base font-bold tracking-widest text-primary">
                          방{property.roomPassword || property.password}
                        </span>
                      </div>
                      {/* 호버 툴팁 */}
                      <div className="pointer-events-none absolute left-0 bottom-full mb-1.5 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <div className="bg-foreground text-background text-[11px] font-semibold px-2.5 py-1 rounded-lg shadow-lg whitespace-nowrap">
                          🚪 방(호실) 도어락 비밀번호
                          <div className="absolute top-full left-4 w-2 h-1.5 overflow-hidden">
                            <div className="w-2 h-2 bg-foreground rotate-45 -translate-y-1" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── 연락처 ── */}
          <ContactGroup property={property} />

          {/* Divider */}
          <div className="h-2 bg-muted/50 my-2" />

          {/* Agent card */}
          <div className="px-4 pb-4">
            <p className="text-xs font-bold text-foreground mb-2 uppercase tracking-wide">담당 공인중개사</p>
            <div className="border border-border rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">{showAgencyOnly ? (registrarAgencyName || "봄날부동산공인중개사사무소") : property.agentName}</p>
                <p className="text-xs text-muted-foreground">공인중개사</p>
              </div>
              {!isGuest && property.contact && (
                <a
                  href={`tel:${property.contact}`}
                  className="flex items-center gap-1.5 text-xs font-bold text-accent hover:underline"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {property.contact}
                </a>
              )}
            </div>
          </div>

          {/* ── 건축물대장·토지대장 ── */}
          {!isGuest && (
            <>
              <div className="h-2 bg-muted/50 my-2" />
              <PropertySummaryPanel address={property.address} pnu={propertyPnu} />
            </>
          )}

          {/* ── 추가 액션 버튼 ── */}
          {!isGuest && (
            <>
              <div className="h-2 bg-muted/50 my-2" />
              <div className="px-4 pb-4 flex flex-col gap-2">
                <p className="text-xs font-bold text-foreground uppercase tracking-wide mb-1">기타 기능</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setActiveModal("proposal")}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-border hover:bg-primary/5 transition-colors"
                    style={{ borderColor: "hsl(var(--primary) / 0.3)" }}
                  >
                    <ClipboardList className="w-4 h-4 text-primary" />
                    <span className="text-[11px] font-semibold text-foreground">임대현황</span>
                  </button>
                  <button
                    onClick={() => setActiveModal("deal")}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-border hover:bg-chart-2/5 transition-colors"
                    style={{ borderColor: "hsl(var(--chart-2) / 0.3)" }}
                  >
                    <CheckCircle2 className="w-4 h-4" style={{ color: "hsl(var(--chart-2))" }} />
                    <span className="text-[11px] font-semibold text-foreground">거래완료</span>
                  </button>
                  <button
                    onClick={() => setActiveModal("error")}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-border hover:bg-destructive/5 transition-colors"
                    style={{ borderColor: "hsl(var(--destructive) / 0.3)" }}
                  >
                    <AlertTriangle className="w-4 h-4" style={{ color: "hsl(var(--destructive))" }} />
                    <span className="text-[11px] font-semibold text-foreground">오류제보</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── CTA ── */}
        <div className={`flex-shrink-0 px-4 py-3 border-t border-border bg-white grid gap-2 ${isGuest ? "grid-cols-1" : "grid-cols-2"}`}>
          {!isGuest && (
            <a
              href={`tel:${property.contactOwner ?? property.contact}`}
              className="flex items-center justify-center gap-1.5 h-11 rounded-lg border-2 border-primary text-primary text-sm font-bold hover:bg-primary hover:text-white transition-colors"
            >
              <Phone className="w-4 h-4" />
              전화 문의
            </a>
          )}
          <button
            onClick={() => setActiveModal("proposal")}
            className="flex items-center justify-center gap-1.5 h-11 rounded-lg text-white text-sm font-bold transition-colors"
            style={{ background: "hsl(var(--accent))" }}
          >
            <ClipboardList className="w-4 h-4" />
            임대 제안서
          </button>
        </div>
      </div>
    </>
  );
};

export default PropertyDetailPanel;
