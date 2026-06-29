import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, MapPin, Layers, Car, Calendar, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import logoTransparent from "@/assets/logo-zibda-share-header-20260502-v3-cropped.png";
import { loadKakaoMaps } from "@/lib/kakaoMapsLoader";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useIsGuest } from "@/hooks/useIsGuest";

interface PropertyData {
  id: string;
  title: string;
  building_name: string | null;
  address: string;
  district: string | null;
  dong: string | null;
  lot_number: string | null;
  type: string;
  room_type: string | null;
  area: string;
  floor: string;
  total_floors: string;
  deposit: string;
  monthly: string;
  manage_fee: string;
  parking: string;
  elevator: boolean;
  available_from: string;
  vacate_date: string;
  build_year: string;
  description: string;
  images: string[];
  options: string[];
  is_new: boolean;
  is_hot: boolean;
  registered_date: string;
  registered_by: string | null;
  reg_no: string | null;
  note: string | null;
  lat: number;
  lng: number;
}

// 집합건물/공동주택 여부 (번지수까지 표기)
function isCollectiveBuilding(type: string | null | undefined): boolean {
  if (!type) return false;
  return /아파트|오피스텔|빌라|다세대|연립|도시형생활주택|주상복합|타운하우스/.test(type);
}


interface BuildingSummaryData {
  building_name: string | null;
  main_purpose: string | null;
  approval_date: string | null;
  land_area: string | null;
  building_area: string | null;
  total_area: string | null;
  floors_above: string | null;
  floors_below: string | null;
  parking_count: string | null;
  elevator: boolean | null;
}

function toPyeong(value: string | null | undefined): string {
  if (!value) return "";
  const num = parseFloat(value.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return "";
  return (num / 3.3058).toFixed(2);
}

function formatArea(value: string | null | undefined): string {
  if (!value) return "-";
  if (value.includes("평")) return value;
  const pyeong = toPyeong(value);
  return pyeong ? `${value} (${pyeong}평)` : value;
}

function formatAreaShort(value: string | null | undefined): string {
  if (!value) return "-";
  if (value.includes("평")) return value;
  const pyeong = toPyeong(value);
  return pyeong ? `${pyeong}평` : value;
}

function normalizeDisplayOption(option: string): string {
  const compact = option.replace(/\s+/g, "");
  if (compact.includes("애완동물") || compact.includes("반려동물")) {
    if (compact.includes("불가")) return "반려동물 불가";
    if (compact.includes("가능")) return "반려동물 가능";
  }
  return option;
}

function sanitizeAddress(address: string): string {
  if (!address) return "";
  const match = address.match(
    /(?:.*?(?:시|군)\s+)?(?:.*?(?:구|군)\s+)?[\uAC00-\uD7A3]+(?:동|리|읍|면)/
  );
  return match ? match[0] : address.split(" ").slice(0, -1).join(" ") || address;
}

function checkVacant(p: PropertyData): boolean {
  if (p.vacate_date) {
    const v = p.vacate_date.replace(/[^0-9\-\/\.]/g, "").replace(/\./g, "-").replace(/\//g, "-");
    const t = new Date(v).getTime();
    if (!isNaN(t) && t < Date.now()) return true;
  }
  if (p.available_from === "공실") return true;
  return false;
}

function KakaoMapPreview({ lat, lng }: { lat: number; lng: number }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;
    const el = mapRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || !lat || !lng || !mapRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        await loadKakaoMaps({ retries: 4, timeoutMs: 10000 });
        if (cancelled || !window.kakao?.maps || !mapRef.current) return;
        const position = new window.kakao.maps.LatLng(lat, lng);
        const map = new window.kakao.maps.Map(mapRef.current, {
          center: position, level: 2, draggable: false, scrollwheel: false, disableDoubleClickZoom: true,
        });
        mapInstanceRef.current = map;
        new window.kakao.maps.Circle({
          center: position, radius: 30, strokeWeight: 2,
          strokeColor: "#1B3A5C", strokeOpacity: 0.6, fillColor: "#1B3A5C", fillOpacity: 0.15, map,
        });
        window.setTimeout(() => {
          if (cancelled || !mapInstanceRef.current) return;
          try { mapInstanceRef.current.relayout(); mapInstanceRef.current.setCenter(position); } catch (_) {}
        }, 200);
      } catch (_) {
        if (mapRef.current) {
          mapRef.current.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;background:hsl(220 16% 97%);color:hsl(218 14% 48%);font-size:12px;font-weight:700;">지도를 불러오지 못했습니다.</div>';
        }
      }
    })();
    return () => { cancelled = true; mapInstanceRef.current = null; };
  }, [inView, lat, lng]);

  return (
    <div>
      <p className="text-xs font-bold text-foreground mb-2">위치</p>
      <div ref={mapRef} className="w-full h-48 rounded-xl overflow-hidden border border-border bg-muted" />
      <p className="text-[10px] text-muted-foreground mt-1">정확한 위치는 중개사무소에 문의해주세요.</p>
    </div>
  );
}

interface Props {
  id: string;
  sharedBy?: string | null;
  showHeader?: boolean;
  className?: string;
}

export default function PublicPropertyView({ id, sharedBy, showHeader = true, className }: Props) {
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [building, setBuilding] = useState<BuildingSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);
  const [fallbackImages, setFallbackImages] = useState<string[]>([]);
  const [otherUnits, setOtherUnits] = useState<{ id: string; unit_number: string | null; floor: string | null; room_type: string | null; images: string[] }[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const isMobileView = useIsMobile();
  const isGuestView = useIsGuest();
  const { user: authUser } = useAuth();
  const hideDetailInfo = isMobileView && (isGuestView || authUser?.memberType === "일반회원");

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    (async () => {
      setLoading(true);
      setBuilding(null);
      setImgIdx(0);
      setFallbackImages([]);
      setOtherUnits([]);
      setSelectedUnitId("");

      const { data, error } = await supabase
        .from("properties")
        .select("id,title,building_name,address,district,dong,lot_number,type,room_type,area,floor,total_floors,deposit,monthly,manage_fee,parking,elevator,available_from,vacate_date,build_year,description,images,options,is_new,is_hot,registered_date,registered_by,reg_no,note,lat,lng")
        .eq("id", id)
        .eq("status", "active")
        .single();

      if (!isMounted) return;
      if (error || !data) { setProperty(null); setLoading(false); return; }

      setProperty(data as PropertyData);
      setLoading(false);

      supabase
        .from("building_summary")
        .select("building_name,main_purpose,approval_date,land_area,building_area,total_area,floors_above,floors_below,parking_count,elevator")
        .eq("property_id", id)
        .maybeSingle()
        .then(({ data: buildingData }) => {
          if (!isMounted) return;
          setBuilding(buildingData ?? null);
        });

      const hasImages = Array.isArray(data.images) && data.images.filter(Boolean).length > 0;
      if (data.address) {
        (supabase as any)
          .rpc("get_public_property_reference_images", { _property_id: data.id })
          .then(({ data: siblings }: any) => {
            if (!isMounted || !siblings) return;
            const units = siblings
              .map((s: any) => ({
                id: s.id as string,
                unit_number: s.unit_number ?? null,
                floor: s.floor ?? null,
                room_type: s.room_type ?? null,
                images: (Array.isArray(s.images) ? s.images : []).filter(Boolean),
              }))
              .filter((u: any) => u.images.length > 0);
            if (units.length > 0) {
              setOtherUnits(units);
              // 본 호실에 사진이 없는 경우에만 다른 호실 사진을 기본 노출
              if (!hasImages) {
                setSelectedUnitId(units[0].id);
                setFallbackImages(units[0].images);
              }
            }
          });
      }
    })();
    return () => { isMounted = false; };
  }, [id, sharedBy]);

  if (loading) {
    return (
      <div className={className ?? "min-h-screen flex items-center justify-center bg-background"}>
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className={className ?? "min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-6"}>
        <Building2 className="w-16 h-16 text-muted-foreground/30" />
        <p className="text-lg font-bold text-foreground">매물 정보를 표시할 수 없습니다</p>
        <p className="text-sm text-muted-foreground text-center">공유한 중개사무소에 직접 문의해주세요.</p>
      </div>
    );
  }

  const ownImgs = (property.images || []).filter(Boolean);
  const viewingOtherUnit = selectedUnitId !== "" && fallbackImages.length > 0;
  const imgs = viewingOtherUnit ? fallbackImages : (ownImgs.length > 0 ? ownImgs : fallbackImages);
  const showingOtherUnit = viewingOtherUnit || (ownImgs.length === 0 && fallbackImages.length > 0);
  // 집합건물/공동주택은 번지수까지 노출 (호수는 미포함)
  const collective = isCollectiveBuilding(property.type);
  const safeAddress = collective
    ? ([property.district, property.dong, property.lot_number].filter((v) => v && String(v).trim()).join(" ").trim() || sanitizeAddress(property.address))
    : sanitizeAddress(property.address);
  const regNoNumeric = property.reg_no ? String(parseInt(property.reg_no.replace(/[^0-9]/g, ""), 10) || property.reg_no) : "";
  const directionText = (() => {
    const m = (property.note || "").match(/방향:\s*([^\n|]+)/);
    return m ? m[1].trim() : "";
  })();
  const prev = () => setImgIdx((i) => (i - 1 + imgs.length) % imgs.length);
  const next = () => setImgIdx((i) => (i + 1) % imgs.length);
  const isSale = property.type?.includes("매매");

  return (
    <div className={className ?? "min-h-screen bg-background"}>
      {showHeader && (
        <header className="sticky top-0 z-50 bg-card border-b border-border px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <img src={logoTransparent} alt="집다" className="h-8 w-auto" />
          </div>
        </header>
      )}

      <div className="max-w-lg mx-auto pb-8">
        {imgs.length > 0 ? (
          <div
            className="relative aspect-[4/3] bg-muted overflow-hidden touch-pan-y select-none"
            onTouchStart={(e) => {
              (e.currentTarget as any)._tx = e.touches[0].clientX;
              (e.currentTarget as any)._ty = e.touches[0].clientY;
            }}
            onTouchEnd={(e) => {
              const startX = (e.currentTarget as any)._tx as number | undefined;
              const startY = (e.currentTarget as any)._ty as number | undefined;
              if (startX == null || startY == null) return;
              const endX = e.changedTouches[0].clientX;
              const endY = e.changedTouches[0].clientY;
              const dx = endX - startX;
              const dy = endY - startY;
              if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
                if (dx < 0) next(); else prev();
              }
            }}
          >
            {imgs.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`${property.title} ${i + 1}`}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={i === 0 ? "high" : "low" as any}
                draggable={false}
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300 pointer-events-none"
                style={{ opacity: i === imgIdx ? 1 : 0 }}
              />
            ))}
            {showingOtherUnit && (
              <div className="absolute top-3 left-3 bg-black/70 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                다른 호실 사진{(() => {
                  const u = otherUnits.find((x) => x.id === selectedUnitId);
                  const floorTxt = (u?.floor ?? "").trim();
                  const label = floorTxt ? (/[층F]/.test(floorTxt) ? floorTxt : `${floorTxt}층`) : "";
                  return label ? ` · ${label}` : "";
                })()}
              </div>
            )}
            {imgs.length > 1 && (
              <>
                <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
                {!hideDetailInfo && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                    {imgIdx + 1} / {imgs.length}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="aspect-[4/3] bg-muted flex items-center justify-center">
            <Building2 className="w-16 h-16 text-muted-foreground/20" />
          </div>
        )}

        {imgs.length > 1 && (
          <div className="px-3 pt-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {imgs.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  className={`relative shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition ${
                    i === imgIdx ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                  aria-label={`사진 ${i + 1}`}
                >
                  <img
                    src={src}
                    alt={`thumb ${i + 1}`}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {otherUnits.length > 0 && (
          <div className="px-5 pt-4">
            <p className="text-xs font-bold text-foreground mb-2">
              {ownImgs.length === 0
                ? "📷 사진이 등록되지 않아 같은 건물 다른 호실 사진을 보여드립니다."
                : "📷 같은 건물 다른 호실 사진도 참고해보세요."}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ownImgs.length > 0 && (
                <button
                  onClick={() => {
                    setSelectedUnitId("");
                    setFallbackImages([]);
                    setImgIdx(0);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                    !viewingOtherUnit ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:border-primary/50"
                  }`}
                >
                  본 호실
                </button>
              )}
              {otherUnits.map((u) => {
                const floorTxt = (u.floor ?? "").trim();
                const floorLabel = floorTxt ? (/[층F]/.test(floorTxt) ? floorTxt : `${floorTxt}층`) : "호실";
                const label = floorLabel;
                const active = u.id === selectedUnitId;
                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      setSelectedUnitId(u.id);
                      setFallbackImages(u.images);
                      setImgIdx(0);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                      active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {label}
                    {!hideDetailInfo && (
                      <span className="ml-1 font-normal opacity-70">· 사진 {u.images.length}장</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="p-5 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            {regNoNumeric && (
              <span className="self-start inline-flex items-center px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[11px] font-extrabold tracking-wider shadow-sm">
                매물번호 NO.{regNoNumeric}
              </span>
            )}
            <h1 className="text-xl font-bold text-foreground flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {safeAddress}
            </h1>
          </div>

          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground mb-1">{isSale ? "매매가" : "보증금 / 월세"}</p>
            <p className="text-2xl font-black text-primary">
              {isSale ? property.deposit : `${property.deposit} / ${property.monthly}`}
            </p>
            {!isSale && property.manage_fee && (
              <p className="text-xs text-muted-foreground mt-1">관리비 {property.manage_fee}</p>
            )}
          </div>

          {(() => {
            const formatVacateDate = (d?: string) => {
              if (!d) return "";
              const m = String(d).match(/(\d{2,4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
              if (!m) return d;
              const yy = m[1].length === 4 ? m[1].slice(2) : m[1];
              return `${yy}-${parseInt(m[2], 10)}-${parseInt(m[3], 10)}`;
            };
            return (
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: <Layers className="w-4 h-4" />, label: "면적", value: formatAreaShort(property.area) },
              { icon: <Building2 className="w-4 h-4" />, label: "층", value: `${property.floor}` },
              { icon: <Car className="w-4 h-4" />, label: "주차", value: building?.parking_count ? `${building.parking_count}대` : (property.parking || "확인필요") },
              { icon: <Calendar className="w-4 h-4" />, label: "입주가능", value: checkVacant(property) ? "즉시입주" : "거주중" },
              ...(directionText ? [{ icon: <Building2 className="w-4 h-4" />, label: "방향", value: directionText }] : []),
              ...(property.vacate_date ? [{ icon: <Calendar className="w-4 h-4" />, label: "퇴거예정일", value: formatVacateDate(property.vacate_date) }] : []),
            ].map((item, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-3 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">{item.icon}</div>
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-base font-extrabold text-primary">{item.value || "-"}</p>
                </div>
              </div>
            ))}
          </div>
            );
          })()}



          {property.options && property.options.length > 0 && (
            <div>
              <p className="text-xs font-bold text-foreground mb-2">옵션</p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(new Set(property.options.map(normalizeDisplayOption))).map((opt) => (
                  <span key={opt} className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-foreground border border-border">
                    {opt}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center gap-3">
            <div className="text-xs text-muted-foreground">
              건축년도 <span className="font-bold text-foreground">{property.build_year || "-"}</span>
              {" · "}엘리베이터 <span className="font-bold text-foreground">{property.elevator ? "있음" : "없음"}</span>
            </div>
          </div>

          {building && (
            <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 mb-1">
                <FileText className="w-4 h-4 text-primary" />
                <p className="text-xs font-bold text-primary">건축물대장 정보</p>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                {building.main_purpose && (<><span className="text-muted-foreground">주용도</span><span className="text-foreground">{building.main_purpose}</span></>)}
                {building.land_area && (<><span className="text-muted-foreground">대지면적</span><span className="text-foreground">{formatArea(building.land_area)}</span></>)}
                {building.building_area && (<><span className="text-muted-foreground">건축면적</span><span className="text-foreground">{formatArea(building.building_area)}</span></>)}
                {building.total_area && (<><span className="text-muted-foreground">연면적</span><span className="text-foreground">{formatArea(building.total_area)}</span></>)}
                {(building.floors_above || building.floors_below) && (<><span className="text-muted-foreground">층수</span><span className="text-foreground">지상 {building.floors_above || "-"}층 / 지하 {building.floors_below || "-"}층</span></>)}
                {building.parking_count && (<><span className="text-muted-foreground">주차대수</span><span className="text-foreground">{building.parking_count}대</span></>)}
                {building.approval_date && (<><span className="text-muted-foreground">사용승인일</span><span className="text-foreground">{building.approval_date}</span></>)}
                <span className="text-muted-foreground">엘리베이터</span>
                <span className="text-foreground">{building.elevator ? "있음" : "없음"}</span>
              </div>
            </div>
          )}

          <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-4">
            <p className="text-sm font-extrabold text-primary mb-2">📌 매물 안내</p>
            <ul className="space-y-1.5 text-xs leading-relaxed text-foreground">
              <li>• 본 매물 정보는 <span className="font-bold">현장조사 및 임대인 확인</span>을 거쳐 등록된 정보입니다.</li>
              <li>• 상세주소는 <span className="font-bold">임대인의 요청에 따라 공개되지 않으며</span>, 대략적인 위치 정보만 제공됩니다.</li>
              <li>• 매물 상담, 현장 안내 및 거래는 <span className="font-bold text-primary">아래 협력 공인중개사</span>를 통해 진행됩니다.</li>
              <li>• 실제 거래 여부 및 임대 조건은 변동될 수 있으므로 <span className="font-bold">협력 공인중개사를 통해 최종 확인</span>하시기 바랍니다.</li>
            </ul>
          </div>

          {property.lat && property.lng && (
            <KakaoMapPreview lat={property.lat} lng={property.lng} />
          )}

          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 flex flex-col gap-2">
            <p className="text-xs font-bold text-primary mb-1">📞 협력 공인중개사</p>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
              <span className="text-muted-foreground">사무소명</span>
              <span className="font-bold text-foreground">봄날부동산 공인중개사 사무소</span>
              <span className="text-muted-foreground">대표자</span>
              <span className="font-bold text-foreground">김진형</span>
              <span className="text-muted-foreground">주소</span>
              <span className="text-foreground">청주시 서원구 사창동 514-10</span>
              <span className="text-muted-foreground">대표번호</span>
              <a href="tel:0432750966" className="font-bold text-primary">043-275-0966</a>
              <span className="text-muted-foreground">연락처</span>
              <a href="tel:01081828939" className="font-bold text-primary">010-8182-8939</a>
              <span className="text-muted-foreground">개설등록번호</span>
              <span className="text-foreground">43112-2024-00034호</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
