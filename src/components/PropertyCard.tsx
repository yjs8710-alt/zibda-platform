import { MapPin, Eye, Heart, X, Building2, Star } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import PhotoWatermark from "./PhotoWatermark";
import petIcon from "@/assets/pet_icon-v2-20260427.png";
import zibdaPlaceholder from "@/assets/zibda-placeholder-20260427-v2-20260427.png";
import { useState } from "react";
import { thumbUrl, originalFromThumb } from "@/lib/imageThumb";
import { useIsGuest, addressToDong } from "@/hooks/useIsGuest";
import { useAuth } from "@/hooks/useAuth";
import { InquiryModal, PartnerAgencyModal } from "@/components/guest/GuestModals";

interface PropertyCardProps {
  image: string;
  title: string;
  address: string;
  type: string;
  roomType?: string;
  area: string;
  floor: string;
  deposit: string;
  monthly: string;
  manageFee?: string;
  isNew?: boolean;
  isHot?: boolean;
  views: number;
  buildYear?: string;
  elevator?: boolean;
  vacateDate?: string;
  availableFrom?: string;
  checkedDate?: string;
  registeredDate?: string;
  onDelete?: () => void;
  referenceImage?: string;
  referenceUnit?: string;
  options?: string[];
  note?: string;
  regNo?: string;
  dbId?: string;
  registeredBy?: string;
}

const PropertyCard = ({
  image, title, address, type, roomType, area, floor, deposit, monthly, manageFee,
  isNew, isHot, views, buildYear, elevator, vacateDate, availableFrom, checkedDate, registeredDate, onDelete, referenceImage, referenceUnit, options, note, regNo, dbId, registeredBy
}: PropertyCardProps) => {

  // 권리금 파싱 (note 필드에 "권리금: XXX" 형태로 저장됨)
  const keyMoney = (() => {
    if (!note) return "";
    const m = note.match(/권리금:\s*([^\n|]+)/);
    const v = m?.[1]?.trim();
    if (!v || v === "0" || v === "없음") return "";
    return v;
  })();
  // 퇴거일이 오늘 이전이면 공실로 표기
  const isVacant = (() => {
    if (!vacateDate) return false;
    const digits = vacateDate.replace(/[^0-9]/g, "");
    if (digits.length < 8) return false;
    const y = parseInt(digits.slice(0, 4), 10);
    const m = parseInt(digits.slice(4, 6), 10);
    const d = parseInt(digits.slice(6, 8), 10);
    const vacate = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return vacate.getTime() <= today.getTime();
  })();
  const isGuest = useIsGuest();
  const { user: authUserPC } = useAuth();
  const isGeneralMember = authUserPC?.memberType === "일반회원";
  const showGuestButtons = isGuest || isGeneralMember;
  const [showInquiry, setShowInquiry] = useState(false);
  const [showPartner, setShowPartner] = useState(false);
  const { has: hasFav, toggleFavorite } = useFavorites();
  const favKey = dbId || regNo || `${title}-${address}`;
  const liked = hasFav(favKey);

  // 건축년도에서 숫자 4자리만 추출
  const buildYearShort = buildYear ? buildYear.replace(/[^0-9]/g, "").slice(0, 4) : null;

  const hasOwnImage = image && image.length > 0;
  const displayImage = hasOwnImage ? image : referenceImage || "";
  const isRef = !hasOwnImage && !!referenceImage;

  // 게스트에게는 동까지만 보여주기
  const displayAddress = isGuest ? addressToDong(address) : address;

  // 매물번호: 숫자만 표기 (앞 0 제거)
  const regNoNumeric = regNo ? String(parseInt(regNo.replace(/[^0-9]/g, ""), 10) || regNo) : "";

  return (
    <>
    <div className="bg-card rounded-2xl overflow-hidden card-shadow hover:card-shadow-hover transition-all duration-300 hover:-translate-y-1 group">
      {/* Image */}
      <div className="relative overflow-hidden h-60 md:h-24">
        {displayImage ? (
          <>
            <img
              src={thumbUrl(displayImage, 800, 88)}
              alt={title}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className={`w-full h-full object-contain bg-muted group-hover:scale-105 transition-transform duration-500 ${isRef ? "opacity-70" : ""}`}
              style={{ imageRendering: "auto", backgroundColor: "hsl(var(--muted))" }}
              onError={(e) => {
                const img = e.currentTarget;
                // 1차 폴백: 변환 실패 시 원본 public URL로 재시도
                if (img.dataset.fallback !== "orig" && img.src.includes("/render/image/")) {
                  img.dataset.fallback = "orig";
                  img.src = originalFromThumb(displayImage);
                  return;
                }
                if (img.dataset.fallback === "ph") return;
                img.dataset.fallback = "ph";
                img.src = zibdaPlaceholder;
                img.classList.remove("object-cover");
                img.classList.add("object-contain");
              }}
            />
            <PhotoWatermark size="lg" />
            {isRef && (
              <div className="absolute top-0 left-0 right-0 z-20 flex justify-center pointer-events-none pt-2">
                <span className="text-[11px] font-bold text-white bg-black/60 px-2 py-0.5 rounded-full drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
                  다른 호실 사진 참고용
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <img src={zibdaPlaceholder} alt="집다 로고" className="w-full h-full object-contain" />
          </div>
        )}
        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
          {isVacant && (
            <span className="bg-accent text-accent-foreground text-xs font-bold px-2 py-0.5 rounded-full shadow">공실</span>
          )}
          {options?.includes("단기가능") && (
            <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">단기</span>
          )}
          {options?.includes("복층") && (
            <span className="bg-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">복층</span>
          )}
          {(options?.includes("반려동물가능") || options?.includes("애완동물가능") || options?.includes("반려동물_가능")) && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full shadow" style={{ background: "#fff7ed", border: "1px solid #fdba74" }}>
              <img src={petIcon} alt="반려동물 가능" className="w-4 h-4 object-contain" />
            </span>
          )}
          {(options?.includes("반려동물불가") || options?.includes("애완동물불가") || options?.includes("반려동물_불가")) && (
            <span className="relative inline-flex items-center justify-center w-6 h-6 rounded-full shadow" style={{ background: "#fef2f2", border: "1px solid #fca5a5" }}>
              <img src={petIcon} alt="반려동물 불가" className="w-4 h-4 object-contain" />
              <span className="absolute inset-0 flex items-center justify-center text-red-600 font-extrabold text-sm leading-none">✕</span>
            </span>
          )}
          {isNew && (
            <span className="bg-badge-new text-white text-xs font-bold px-2 py-0.5 rounded-full">NEW</span>
          )}
          {isHot && (
            <span className="bg-badge-hot text-white text-xs font-bold px-2 py-0.5 rounded-full">HOT</span>
          )}
        </div>
        {/* Delete + Like */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(favKey); }}
            className="w-8 h-8 rounded-full bg-white/95 flex items-center justify-center shadow hover:bg-white transition-colors"
            title={liked ? "관심목록에서 제거" : "관심목록에 추가"}
            aria-label={liked ? "관심목록에서 제거" : "관심목록에 추가"}
          >
            <Star className={`w-4 h-4 ${liked ? "fill-yellow-400 text-yellow-400 drop-shadow" : "text-muted-foreground"}`} strokeWidth={2} />
          </button>
        </div>
        {/* Type badge */}
        <div className="absolute bottom-3 left-3 flex gap-1.5">
          <span className="bg-primary/90 text-primary-foreground text-xs font-medium px-2.5 py-1 rounded-full backdrop-blur-sm">
            {type}
          </span>
          {type === "원룸" && (roomType === "오픈형" || roomType === "분리형") && (
            <span
              className={`bg-white/95 text-xs font-extrabold px-2.5 py-1 rounded-full backdrop-blur-sm ${
                roomType === "오픈형" ? "text-orange-500" : "text-blue-600"
              }`}
            >
              {roomType}
            </span>
          )}
        </div>
        {/* 건축년도 badge */}
        {buildYearShort && (
          <div className="absolute bottom-3 right-3">
            <span className="bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
              준{buildYearShort}
            </span>
          </div>
        )}
        {/* 매물번호 (게스트/일반회원만) */}
        {isGuest && regNoNumeric && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30">
            <span className="bg-primary text-primary-foreground text-xs font-extrabold px-3 py-1 rounded-full backdrop-blur-sm tracking-wider shadow-lg">
              NO.{regNoNumeric}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 md:p-4">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          {/* 게스트/일반회원: 모바일에서는 건물명 숨김, 데스크탑은 노출 */}
          <h3 className={`font-semibold text-foreground text-base md:text-sm line-clamp-1 flex-1 ${isGuest ? "hidden md:block" : ""}`}>{title}</h3>
          {isGuest && (
            <span className="md:hidden inline-flex items-center px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-bold flex-1 self-center">
              {type}
              {type === "원룸" && (roomType === "오픈형" || roomType === "분리형") && (
                <span className={`ml-1.5 text-[11px] font-extrabold ${roomType === "오픈형" ? "text-orange-500" : "text-blue-600"}`}>
                  · {roomType}
                </span>
              )}
            </span>
          )}
          {showGuestButtons && (
            <div className="flex md:contents flex-col gap-1.5 shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent("open-guest-detail", {
                    detail: {
                      info: { image: displayImage, address, type, area, floor, deposit, monthly, regNo, buildYear, dbId },
                      partnerDetail: { propertyDbId: dbId, propertyRegNo: regNoNumeric || regNo, agentUserId: registeredBy, propertyTitle: regNoNumeric ? `[NO.${regNoNumeric}] ${title}` : title },
                    },
                  }));
                }}
                className="shrink-0 px-3 py-1.5 md:px-2.5 md:py-1 rounded-full bg-white text-primary border border-primary/50 text-sm md:text-xs font-bold shadow-sm hover:bg-primary/5"
              >
                상세보기
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  const propertyTitleLbl = regNoNumeric ? `[NO.${regNoNumeric}] ${title}` : title;
                  if (isGeneralMember && authUserPC?.userId) {
                    // 일반회원: 프로필에서 이름/연락처 가져와 자동입력 문의 폼 열기
                    let memberInfo: { name?: string; phone?: string } | null = null;
                    try {
                      const { supabase } = await import("@/integrations/supabase/client");
                      const { data } = await supabase
                        .from("agent_profiles")
                        .select("name, phone")
                        .eq("user_id", authUserPC.userId)
                        .maybeSingle();
                      memberInfo = { name: data?.name || "", phone: data?.phone || "" };
                    } catch {}
                    window.dispatchEvent(new CustomEvent("open-guest-inquiry", {
                      detail: { propertyDbId: dbId, propertyRegNo: regNoNumeric || regNo, agentUserId: registeredBy, propertyTitle: propertyTitleLbl, memberInfo },
                    }));
                  } else {
                    window.dispatchEvent(new CustomEvent("open-guest-partner", {
                      detail: { propertyDbId: dbId, propertyRegNo: regNoNumeric || regNo, agentUserId: registeredBy, propertyTitle: propertyTitleLbl },
                    }));
                  }
                }}
                className="shrink-0 px-3 py-1.5 md:px-2.5 md:py-1 rounded-full bg-primary text-primary-foreground text-sm md:text-xs font-bold shadow-sm hover:opacity-90"
              >
                문의하기
              </button>
              {!isGuest && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const propertyTitleLbl = regNoNumeric ? `[NO.${regNoNumeric}] ${title}` : title;
                    window.dispatchEvent(new CustomEvent("open-chat-inquiry", {
                      detail: { agentUserId: null, propertyId: dbId || null, propertyTitle: propertyTitleLbl },
                    }));
                  }}
                  className="shrink-0 px-3 py-1.5 md:px-2.5 md:py-1 rounded-full bg-white text-primary border border-primary/50 text-sm md:text-xs font-bold shadow-sm hover:bg-primary/5"
                >
                  채팅문의
                </button>
              )}


              <div className="hidden md:flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
                {(checkedDate || registeredDate) && <span>확인 {checkedDate || registeredDate}</span>}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 mb-3">
          <MapPin className="w-4 h-4 md:w-3.5 md:h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-sm md:text-xs text-black line-clamp-1">{displayAddress}</span>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
          <div className="bg-muted rounded-lg px-3 py-2.5 md:py-2">
            <p className="text-[11px] md:text-xs text-muted-foreground">면적</p>
            <p className="text-base md:text-sm font-semibold text-foreground">{area?.includes("평") ? area : (() => { const n = parseFloat((area || "").replace(/[^0-9.]/g, "")); return !isNaN(n) && n > 0 ? `${(n / 3.3058).toFixed(1)}평` : area; })()}</p>
          </div>
          <div className="bg-muted rounded-lg px-3 py-2.5 md:py-2">
            <p className="text-[11px] md:text-xs text-muted-foreground">층수</p>
            <p className="text-base md:text-sm font-semibold text-foreground">{floor}</p>
          </div>
          {isGuest && (
            <div className="bg-muted rounded-lg px-3 py-2.5 md:hidden col-span-2">
              <p className="text-[11px] text-muted-foreground">보증금 / 월세</p>
              <p className="font-bold text-primary text-base">
                {deposit} / <span style={{ color: "#000", fontWeight: 800 }}>{monthly}</span>
                {manageFee && manageFee !== "0" && manageFee !== "" && (
                  <span className="text-xs text-muted-foreground font-normal ml-2">
                    (관리비 {manageFee})
                  </span>
                )}
              </p>
              {keyMoney && (
                <p className="text-xs font-bold text-orange-600 mt-1">권리금 {keyMoney}</p>
              )}
            </div>
          )}
          <div className="bg-muted rounded-lg px-3 py-2 hidden md:block">
            <p className="text-xs text-muted-foreground">퇴거예정일</p>
            <div className="flex items-center justify-between gap-1">
              {(() => {
                const earlyExit = !!note && /중도퇴거/.test(note);
                const isOccupied = availableFrom === "세입자 거주중";
                const showVacant = isVacant || availableFrom === "공실";
                let label = "", cls = "";
                if (earlyExit) { label = "중도퇴거"; cls = "bg-destructive/10 text-destructive"; }
                else if (showVacant) { label = "공실"; cls = "bg-primary/10 text-primary"; }
                else if (isOccupied) { label = "거주중"; cls = "bg-accent/10 text-accent"; }
                return label ? (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cls}`}>{label}</span>
                ) : <span />;
              })()}
              {vacateDate && (
                <p className="text-sm font-semibold text-foreground text-right">
                  {vacateDate}
                </p>
              )}
            </div>
          </div>

        </div>

        {/* 건축년도 + 엘리베이터 */}
        {(buildYearShort || elevator !== undefined) && (
          <div className="flex items-center gap-2 mb-3">
            {buildYearShort && (
              <div className="flex items-center gap-1 bg-muted rounded-full px-2.5 py-1">
                <span className="text-[10px] text-muted-foreground">준공</span>
                <span className="text-[11px] font-bold text-foreground">{buildYearShort}년</span>
              </div>
            )}
            {elevator !== undefined && (
              <div className="flex items-center gap-1 bg-muted rounded-full px-2.5 py-1">
                <span className="text-[10px] text-muted-foreground">엘리베이터</span>
                <span className={`text-[11px] font-bold ${elevator ? "text-primary" : "text-muted-foreground"}`}>
                  {elevator ? "있음" : "없음"}
                </span>
              </div>
            )}
          </div>
        )}


        {/* Price */}
        <div className={`border-t border-border pt-3 flex items-end justify-between ${isGuest ? "hidden md:flex" : ""}`}>
          <div>
            <p className="text-[11px] md:text-xs text-muted-foreground">보증금 / 월세</p>
            <p className="font-bold text-primary text-base md:text-sm">
              {deposit} / <span style={{ color: "#000", fontWeight: 800 }}>{monthly}</span>
              {manageFee && manageFee !== "0" && manageFee !== "" && (
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  (관리비 {manageFee})
                </span>
              )}
            </p>
            {keyMoney && (
              <p className="text-xs font-bold text-orange-600 mt-1">
                권리금 {keyMoney}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Eye className="w-3.5 h-3.5" />
            <span className="text-xs">{views.toLocaleString()}</span>
          </div>
        </div>

      </div>
    </div>

    {isGuest && (
      <>
        <InquiryModal
          open={showInquiry}
          onClose={() => setShowInquiry(false)}
          propertyTitle={regNoNumeric ? `[NO.${regNoNumeric}] ${title}` : title}
          propertyDbId={dbId}
          propertyRegNo={regNoNumeric || regNo}
          agentUserId={registeredBy}
          onOpenPartner={() => setShowPartner(true)}
        />
        <PartnerAgencyModal
          open={showPartner}
          onClose={() => setShowPartner(false)}
          onChat={() => setShowInquiry(true)}
        />
      </>
    )}
    </>
  );
};

export default PropertyCard;
