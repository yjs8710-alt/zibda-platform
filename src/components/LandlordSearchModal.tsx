import { useState } from "react";
import { Search, Phone, X, MapPin, Building2, Eye, AlertCircle, BookUser, EyeOff, ChevronLeft, ChevronRight, Images, Home, Layers, Calendar, Ruler, ChevronRight as ArrowRight, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PropertyDetailPanel from "@/components/PropertyDetailPanel";
import { MapProperty } from "@/data/mapProperties";
import { useAuth } from "@/hooks/useAuth";

const today = () => new Date().toISOString().slice(0, 10);
const revealKey = (id: string) => `landlord_reveal_${id}`;
const hasRevealedToday = (id: string) => localStorage.getItem(revealKey(id)) === today();
const markRevealed = (id: string) => localStorage.setItem(revealKey(id), today());

interface SearchResult {
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
  // extended property fields
  floor?: string;
  area?: string;
  deposit?: string;
  monthly?: string;
  type?: string;
  buildYear?: string;
  totalFloors?: string;
  availableFrom?: string;
  note?: string;
  regNo?: string;
  lat?: number;
  lng?: number;
  lotNumber?: string;
  buildingName?: string;
  dong?: string;
  address?: string;
}

// ── SearchResult → MapProperty 변환 ───────────────────────────────────────
let _panelId = 1;
function toMapProperty(item: SearchResult): MapProperty {
  return {
    id: _panelId++,
    title: item.label,
    address: item.sublabel,
    type: item.type ?? (item.source === "contact" ? "연락처DB" : "매물"),
    area: item.area ? `${item.area}㎡` : "—",
    floor: item.floor ?? "—",
    deposit: item.deposit ? `${item.deposit}만` : "—",
    monthly: item.monthly ? `${item.monthly}만` : "—",
    views: 0,
    lat: 0,
    lng: 0,
    image: (item.images ?? [])[0] ?? "",
    images: item.images ?? [],
    description: item.note ?? "",
    contact: item.contactBroker ?? "",
    contactOwner: item.contactOwner ?? "",
    contactManager: item.contactManager ?? "",
    agentName: "",
    manageFee: "—",
    parking: "—",
    elevator: false,
    availableFrom: item.availableFrom ?? "—",
    totalFloors: item.totalFloors ? `지상 ${item.totalFloors}층` : "—",
    buildYear: item.buildYear ? `${item.buildYear}년` : "—",
    isNew: false,
    isHot: false,
  };
}

// ── Photo Lightbox ──────────────────────────────────────────────
interface LightboxProps {
  images: string[];
  startIndex: number;
  onClose: () => void;
}
const Lightbox = ({ images, startIndex, onClose }: LightboxProps) => {
  const [idx, setIdx] = useState(startIndex);
  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);

  return (
    <div
      className="fixed inset-0 z-[10200] flex flex-col items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors"
      >
        <X className="w-4 h-4 text-white" />
      </button>
      <div className="relative flex items-center justify-center w-full max-w-2xl px-12" onClick={(e) => e.stopPropagation()}>
        {images.length > 1 && (
          <button onClick={prev} className="absolute left-2 w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
        )}
        <img
          src={images[idx]}
          alt={`photo-${idx + 1}`}
          className="max-h-[75vh] max-w-full rounded-xl object-contain shadow-2xl"
        />
        {images.length > 1 && (
          <button onClick={next} className="absolute right-2 w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors">
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-1.5 mt-4 flex-wrap justify-center px-4" onClick={(e) => e.stopPropagation()}>
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition-all ${i === idx ? "border-white" : "border-white/30 opacity-60"}`}
            >
              <img src={img} alt={`thumb-${i}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <p className="text-white/60 text-xs mt-3">{idx + 1} / {images.length}</p>
    </div>
  );
};

// ── Phone Row ───────────────────────────────────────────────────
interface PhoneRowProps {
  label: string;
  phone: string;
  color: string;
  show: boolean;
  onReveal: () => void;
}
const PhoneRow = ({ label, phone, color, show, onReveal }: PhoneRowProps) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-1.5">
      <Phone className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
      <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
    </div>
    {show ? (
      <a
        href={`tel:${phone}`}
        className="flex items-center gap-1.5 text-sm font-bold rounded-lg px-3 py-1.5 transition-colors"
        style={{ color, background: `${color}18` }}
      >
        <Phone className="w-3.5 h-3.5" />{phone}
      </a>
    ) : (
      <button
        onClick={onReveal}
        className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all hover:scale-105"
        style={{ background: "hsl(var(--accent))", color: "#fff", borderColor: "hsl(var(--accent))" }}
      >
        <Eye className="w-3.5 h-3.5" />번호 공개
      </button>
    )}
  </div>
);

// ── Result Card ─────────────────────────────────────────────────
interface ResultCardProps {
  item: SearchResult;
  show: boolean;
  isApproved: boolean;
  onReveal: () => void;
  onLightbox: (images: string[], idx: number) => void;
  onOpenPanel: (item: SearchResult) => void;
  isSelected: boolean;
}
const ResultCard = ({ item, show, isApproved, onReveal, onLightbox, onOpenPanel, isSelected }: ResultCardProps) => {
  // 번호는 항상 '번호 공개' 버튼을 눌러야만 노출
  const phoneVisible = show;
  const [expanded, setExpanded] = useState(false);
  const isContact = item.source === "contact";
  const isHidden = item.source === "property" && item.status !== "active";
  const isInvisible = item.source === "contact" && item.isVisible === false;
  const images = item.images ?? [];
  const hasImages = images.length > 0;

  return (
    <div
      className="rounded-xl border overflow-hidden transition-all"
      style={{
        borderColor: isSelected ? "hsl(var(--primary))" : "hsl(var(--border))",
        background: isSelected ? "hsl(var(--primary) / 0.04)" : "hsl(var(--background))",
        opacity: isHidden || isInvisible ? 0.85 : 1,
        boxShadow: isSelected ? "0 0 0 2px hsl(var(--primary) / 0.2)" : undefined,
      }}
    >
      {/* Photo strip (property only) */}
      {!isContact && hasImages && (
        <div className="relative">
          <div className="flex gap-0.5 h-32 overflow-hidden">
            {images.slice(0, 4).map((img, i) => (
              <button
                key={i}
                onClick={() => onLightbox(images, i)}
                className="flex-1 min-w-0 relative overflow-hidden hover:brightness-110 transition-all"
              >
                <img src={img} alt={`img-${i}`} className="w-full h-full object-cover" />
                {i === 3 && images.length > 4 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">+{images.length - 4}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={() => onLightbox(images, 0)}
            className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 transition-colors"
          >
            <Images className="w-3 h-3" />사진 {images.length}장
          </button>
        </div>
      )}

      <div className="p-3.5 flex flex-col gap-2">
        {/* Header row */}
        <div className="flex items-start gap-2.5">
          {!hasImages && (
            <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              {isContact
                ? <BookUser className="w-5 h-5 text-muted-foreground" />
                : <Building2 className="w-5 h-5 text-muted-foreground" />}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <p className="text-xs font-bold text-foreground">{item.label}</p>
              {isContact ? (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: "hsl(var(--accent)/0.15)", color: "hsl(var(--accent))" }}>연락처DB</span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: "hsl(var(--primary)/0.1)", color: "hsl(var(--primary))" }}>매물</span>
              )}
              {isHidden && (
                <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground">
                  <EyeOff className="w-2.5 h-2.5" />숨김
                </span>
              )}
              {isInvisible && (
                <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground">
                  <EyeOff className="w-2.5 h-2.5" />미노출
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">{item.sublabel}</p>
            {item.badge && (
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-[10px] text-muted-foreground">{item.badge}</span>
              </div>
            )}
          </div>

          {/* 상세보기 버튼 */}
          <button
            onClick={() => onOpenPanel(item)}
            className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all shrink-0"
            style={isSelected
              ? { background: "hsl(var(--primary))", color: "#fff" }
              : { background: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }
            }
          >
            {isSelected ? "보는 중" : "상세보기"}
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Property detail grid */}
        {!isContact && (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              {item.area && (
                <div className="bg-muted/60 rounded-lg px-2.5 py-1.5">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Ruler className="w-2.5 h-2.5 text-muted-foreground" />
                    <p className="text-[9px] text-muted-foreground">면적</p>
                  </div>
                  <p className="text-[11px] font-bold text-foreground">{item.area}㎡</p>
                </div>
              )}
              {item.floor && (
                <div className="bg-muted/60 rounded-lg px-2.5 py-1.5">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Layers className="w-2.5 h-2.5 text-muted-foreground" />
                    <p className="text-[9px] text-muted-foreground">층수</p>
                  </div>
                  <p className="text-[11px] font-bold text-foreground">{item.floor}{item.totalFloors ? `/${item.totalFloors}` : ""}층</p>
                </div>
              )}
              {item.type && (
                <div className="bg-muted/60 rounded-lg px-2.5 py-1.5">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Home className="w-2.5 h-2.5 text-muted-foreground" />
                    <p className="text-[9px] text-muted-foreground">유형</p>
                  </div>
                  <p className="text-[11px] font-bold text-foreground truncate">{item.type}</p>
                </div>
              )}
            </div>

            {/* 가격은 소유주 검색에서 표시하지 않음 */}

            {/* Extra info toggle */}
            {(item.buildYear || item.availableFrom || item.note) && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[10px] text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors self-start"
              >
                {expanded ? "접기 ▲" : "상세 정보 보기 ▼"}
              </button>
            )}
            {expanded && (
              <div className="flex flex-col gap-1 text-[11px] text-muted-foreground pl-1 border-l-2 border-border ml-1">
                {item.buildYear && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    <span>준공연도: <span className="text-foreground font-medium">{item.buildYear}</span></span>
                  </div>
                )}
                {item.availableFrom && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    <span>입주가능: <span className="text-foreground font-medium">{item.availableFrom}</span></span>
                  </div>
                )}
                {item.note && (
                  <p className="text-[10px] bg-muted/50 rounded px-2 py-1 mt-0.5">{item.note}</p>
                )}
              </div>
            )}
          </>
        )}

        {/* Phone numbers */}
        <div className="border-t border-border/50 pt-2 flex flex-col gap-1.5">
          {isApproved && (
            <div className="flex items-center gap-1 mb-0.5">
              <ShieldCheck className="w-3 h-3" style={{ color: "hsl(var(--chart-2))" }} />
              <span className="text-[10px] font-semibold" style={{ color: "hsl(var(--chart-2))" }}>승인 회원 — 제한없이 열람 가능</span>
            </div>
          )}
          {item.contactOwner ? (
            <PhoneRow label="소유주(임대인)" phone={item.contactOwner} color="hsl(var(--primary))" show={phoneVisible} onReveal={onReveal} />
          ) : (
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">임대인 직접 연락처 미등록</span>
            </div>
          )}
          {item.contactManager && (
            <PhoneRow label="관리인" phone={item.contactManager} color="hsl(var(--chart-4))" show={phoneVisible} onReveal={onReveal} />
          )}
          {item.contactBroker && (
            <PhoneRow label="부동산" phone={item.contactBroker} color="hsl(var(--chart-3))" show={phoneVisible} onReveal={onReveal} />
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Modal ──────────────────────────────────────────────────
interface LandlordSearchModalProps {
  onClose: () => void;
  onPropertiesFound?: (props: { regNo?: string; lat?: number; lng?: number }[]) => void;
}

const LandlordSearchModal = ({ onClose, onPropertiesFound }: LandlordSearchModalProps) => {
  const { isAuthorized, isLoading: authLoading } = useAuth();
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<{ images: string[]; idx: number } | null>(null);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const [panelProperty, setPanelProperty] = useState<MapProperty | null>(null);

  // 승인된 회원(인증된 모든 로그인 사용자)은 번호 제한 없이 바로 노출
  // authLoading 중에는 false로 처리하되, 로딩 완료 후 isAuthorized 값 사용
  const isApproved = !authLoading && isAuthorized;

  const handleReveal = (id: string) => {
    setRevealed((prev) => ({ ...prev, [id]: true }));
  };
  // 매번 '번호 공개' 버튼을 눌러야만 노출 (localStorage/승인 여부 무시)
  const isRevealed = (id: string) => !!revealed[id];

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearched(true);
    setLoading(true);
    setError("");
    setSelectedItem(null);
    setPanelProperty(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("landlord-search", {
        body: { q: query.trim() },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      const res = (data?.results ?? []) as SearchResult[];
      setResults(res);
      // 지도에는 검색어가 '번지수(lot_number)' 또는 '건물명(building_name)'에 매칭된 매물만 노출
      const norm = (v: string) => v.toLowerCase().replace(/\s+/g, "").replace(/번지|호/g, "");
      const qTokens = query.trim().replace(/번지/g, " ").split(/\s+/).map(norm).filter(Boolean);
      const matchesLotOrBuilding = (r: SearchResult) => {
        if (qTokens.length === 0) return false;
        const hay = norm(`${r.lotNumber ?? ""} ${r.buildingName ?? ""} ${r.dong ?? ""} ${r.address ?? ""} ${r.sublabel ?? ""} ${r.label ?? ""}`);
        return qTokens.every((t) => hay.includes(t));
      };
      onPropertiesFound?.(
        res
          .filter((r) => r.source === "property" && matchesLotOrBuilding(r) && (r.regNo || (r.lat && r.lng)))
          .map((r) => ({ regNo: r.regNo, lat: r.lat, lng: r.lng }))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setResults([]);
      onPropertiesFound?.([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPanel = (item: SearchResult) => {
    if (selectedItem?.id === item.id) {
      setSelectedItem(null);
      setPanelProperty(null);
    } else {
      setSelectedItem(item);
      setPanelProperty(toMapProperty(item));
    }
  };

  const hasPanel = panelProperty !== null;

  return (
    <>
      {lightbox && (
        <Lightbox
          images={lightbox.images}
          startIndex={lightbox.idx}
          onClose={() => setLightbox(null)}
        />
      )}

      <div
        className="fixed inset-0 z-[10100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-2 md:px-4"
        onClick={onClose}
      >
        {/* 컨테이너: 검색모달 + 상세패널 나란히 */}
        <div
          className="flex gap-3 w-full items-start justify-center"
          style={{ maxHeight: "90vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── 검색 모달 ── */}
          <div
            className="bg-card rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300"
            style={{
              maxHeight: "90vh",
              width: hasPanel ? "420px" : "100%",
              maxWidth: hasPanel ? "420px" : "512px",
              minWidth: "320px",
              flexShrink: 0,
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(218 88% 32%))" }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">소유주 번호 찾기</p>
                  <p className="text-[10px] text-white/70">숨김 매물·미노출 연락처 포함 전체 조회</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 pt-4 pb-3 flex-shrink-0">
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 bg-muted/40 border border-border rounded-xl px-3 h-10 focus-within:border-primary transition-colors">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setSearched(false); }}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="동 이름, 번지수, 건물명, 전화번호 입력"
                    className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                    autoFocus
                  />
                  {query && (
                    <button onClick={() => { setQuery(""); setSearched(false); setResults([]); setSelectedItem(null); setPanelProperty(null); }} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  onClick={handleSearch}
                  disabled={!query.trim() || loading}
                  className="h-10 px-4 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-40"
                  style={{ background: "hsl(var(--primary))" }}
                >
                  {loading ? <span className="animate-pulse text-xs">...</span> : <Search className="w-4 h-4" />}
                </button>
              </div>
              {searched && !loading && (
                <p className="text-[10px] text-muted-foreground mt-1.5 pl-1">
                  매물(숨김 포함) + 청주 연락처DB 전체 통합 검색
                  {hasPanel && <span className="ml-1 font-medium" style={{ color: "hsl(var(--primary))" }}>· 우측에서 상세 확인 중</span>}
                </p>
              )}
            </div>

            {/* Results */}
            <div className="px-5 pb-3 flex flex-col gap-2.5 overflow-y-auto flex-1">
              {error && (
                <div className="py-4 flex items-center gap-2 text-destructive text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                </div>
              )}
              {searched && !loading && !error && results.length === 0 && (
                <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 opacity-30" />
                  <p className="text-sm">연락처가 등록된 검색 결과가 없습니다.</p>
                  <p className="text-xs">다른 주소나 동 이름으로 검색해보세요.</p>
                </div>
              )}
              {!searched && (
                <div className="py-6 flex flex-col items-center gap-1.5 text-muted-foreground">
                  <Search className="w-7 h-7 opacity-20" />
                  <p className="text-xs">동 이름, 번지수 또는 건물명을 입력 후 검색하세요.</p>
                </div>
              )}
              {loading && (
                <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs">검색 중...</p>
                </div>
              )}

              {!loading && results.map((item) => (
                <ResultCard
                  key={item.id}
                  item={item}
                  show={isRevealed(item.id)}
                  isApproved={isApproved}
                  onReveal={() => handleReveal(item.id)}
                  onLightbox={(imgs, idx) => setLightbox({ images: imgs, idx })}
                  onOpenPanel={handleOpenPanel}
                  isSelected={selectedItem?.id === item.id}
                />
              ))}
            </div>

            <div className="px-5 pb-4 flex-shrink-0 border-t border-border/40 pt-2">
              {isApproved ? (
                <div className="flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3 h-3" style={{ color: "hsl(var(--chart-2))" }} />
                  <p className="text-[10px] font-semibold" style={{ color: "hsl(var(--chart-2))" }}>
                    승인된 회원 — 소유주·관리인·부동산 번호 제한없이 열람 가능
                  </p>
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground text-center">
                  ℹ️ 연락처는 일 1회 열람 가능하며, 승인된 회원은 제한없이 조회됩니다.
                </p>
              )}
            </div>
          </div>

          {/* ── 우측 매물 상세 패널 ── */}
          {hasPanel && (
            <div
              className="relative hidden md:block rounded-2xl overflow-hidden shadow-2xl bg-card border border-border"
              style={{ width: "360px", height: "90vh", flexShrink: 0, position: "relative" }}
              onClick={(e) => e.stopPropagation()}
            >
              <PropertyDetailPanel
                property={panelProperty}
                onClose={() => { setSelectedItem(null); setPanelProperty(null); }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default LandlordSearchModal;
