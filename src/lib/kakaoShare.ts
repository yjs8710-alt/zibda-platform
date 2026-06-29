import { MapProperty } from "@/data/mapProperties";
import { addMobileFreshParams, buildFreshSiteUrl, SITE_ORIGIN } from "@/lib/freshUrl";

declare global {
  interface Window {
    Kakao: any;
  }
}

const KAKAO_SDK_SRC = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";
const KAKAO_APP_KEY = "9b1ab990830e8319b8bafb3104e5ae50";
let kakaoSdkPromise: Promise<void> | null = null;

/** 카카오 JS SDK를 필요할 때만 동적으로 로딩 (공유 등 사용 직전 호출) */
export function ensureKakaoSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Kakao?.Share) {
    if (!window.Kakao.isInitialized()) window.Kakao.init(KAKAO_APP_KEY);
    return Promise.resolve();
  }
  if (kakaoSdkPromise) return kakaoSdkPromise;

  kakaoSdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${KAKAO_SDK_SRC}"]`);
    const handleReady = () => {
      try {
        if (window.Kakao && !window.Kakao.isInitialized()) window.Kakao.init(KAKAO_APP_KEY);
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    if (existing) {
      existing.addEventListener("load", handleReady, { once: true });
      existing.addEventListener("error", () => reject(new Error("Kakao SDK load failed")), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = KAKAO_SDK_SRC;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onload = handleReady;
    s.onerror = () => {
      kakaoSdkPromise = null;
      reject(new Error("Kakao SDK load failed"));
    };
    document.head.appendChild(s);
  });
  return kakaoSdkPromise;
}

export interface AgencyInfo {
  userId?: string;
  agencyName?: string;
  name?: string;
  phone?: string;
  agencyPhone?: string;
  representativeName?: string;
  agencyAddress?: string;
  licenseNumber?: string;
}

/**
 * 카카오톡으로 매물 카드를 공유합니다.
 * 전화번호, 상세 주소는 제외하고 건물명·유형·가격 등만 노출합니다.
 * agencyInfo가 전달되면 공유한 중개사무소 정보를 표시합니다.
 */
export async function sharePropertyToKakao(property: MapProperty, agencyInfo?: AgencyInfo, fallbackImageUrl?: string) {
  // 공유 링크가 실제 DB 매물을 가리키지 않으면 "매물을 찾을 수 없음" 화면이 떠서
  // 공유받은 사람이 혼란스러우므로 사전에 차단한다.
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const dbUuid = property.dbId && uuidRegex.test(property.dbId) ? property.dbId : "";
  if (!dbUuid) {
    alert("이 매물은 공유 링크를 만들 수 없습니다. (저장되지 않았거나 임시 데이터)\n매물을 다시 등록한 뒤 공유해주세요.");
    return;
  }

  const shareUrl = buildPropertyShareUrl(property, agencyInfo?.userId);
  const safeAddress = sanitizeAddress(property.address);

  const descParts = [
    property.type,
    property.area ? `면적 ${property.area}` : "",
    property.floor ? `${property.floor}` : "",
    `보증금 ${property.deposit} / 월세 ${property.monthly}`,
  ].filter(Boolean);

  if (agencyInfo?.agencyName) {
    const agencyParts = [
      `🏢 ${agencyInfo.agencyName}`,
      agencyInfo.representativeName ? `대표 ${agencyInfo.representativeName}` : "",
      agencyInfo.agencyAddress ? `📍 ${agencyInfo.agencyAddress}` : "",
      agencyInfo.agencyPhone ? `☎ ${agencyInfo.agencyPhone}` : "",
      agencyInfo.phone ? `📱 ${agencyInfo.phone}` : "",
      agencyInfo.licenseNumber ? `등록번호 ${agencyInfo.licenseNumber}` : "",
    ].filter(Boolean);
    descParts.push(agencyParts.join("\n"));
  }

  const description = descParts.join(" · ");
  const fullDescription = safeAddress ? `${safeAddress}\n${description}` : description;
  // 건물명은 카카오톡 공유 제목에 노출하지 않음 (개인정보/특정 가능성 방지)
  const title = safeAddress || property.type || "매물 정보";
  const defaultShareLogo = `${SITE_ORIGIN}/og-share-zibda-logo-20260502.png`;
  const imageUrl =
    property.images?.[0] || property.image || fallbackImageUrl || defaultShareLogo;

  // 1) 카카오톡 SDK 시도
  let kakaoOk = false;
  try {
    await ensureKakaoSdk();
    if (window.Kakao?.Share) {
      window.Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title,
          description: fullDescription,
          imageUrl,
          imageWidth: 800,
          imageHeight: 400,
          link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
        },
        buttons: [
          { title: "매물 보기", link: { mobileWebUrl: shareUrl, webUrl: shareUrl } },
        ],
      });
      kakaoOk = true;
      return;
    }
  } catch (e) {
    console.warn("[kakaoShare] SDK 실패, 대체 공유 사용:", e);
  }

  if (kakaoOk) return;

  // 2) Web Share API (모바일 OS 기본 공유 시트 → 카톡 선택 가능)
  const shareText = `${title}\n${fullDescription}\n${shareUrl}`;
  try {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      await (navigator as any).share({ title, text: `${title}\n${fullDescription}`, url: shareUrl });
      return;
    }
  } catch (e) {
    // 사용자 취소 또는 실패 → 클립보드로 폴백
  }

  // 3) 최종 폴백: 클립보드 복사
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareText);
      alert("매물 정보가 클립보드에 복사되었습니다.\n카카오톡 대화창에 붙여넣기 해주세요.");
      return;
    }
  } catch {}
  // 클립보드도 실패 → prompt
  window.prompt("아래 내용을 복사해 카카오톡으로 공유하세요:", shareText);
}

function buildPropertyShareUrl(property: MapProperty, sharerUserId?: string): string {
  const propertyId = property.dbId || property.id;
  const shareUrl = new URL(`/share/${propertyId}`, SITE_ORIGIN);
  if (sharerUserId) {
    shareUrl.searchParams.set("sharedBy", sharerUserId);
  }
  return addMobileFreshParams(shareUrl);
}

/** 주소에서 동/리 까지만 남기고 번지 이하 제거 */
function sanitizeAddress(address: string): string {
  if (!address) return "";
  // "충청북도 청주시 흥덕구 개신동 41-5" → "청주시 흥덕구 개신동"
  // "세종특별자치시 한솔동 1234" → "세종특별자치시 한솔동"
  const match = address.match(
    /(?:.*?(?:시|군)\s+)?(?:.*?(?:구|군)\s+)?[\uAC00-\uD7A3]+(?:동|리|읍|면)/
  );
  return match ? match[0] : address.split(" ").slice(0, -1).join(" ") || address;
}

/**
 * 선택된 매물 여러 개를 카카오톡으로 공유합니다.
 */
export async function shareMultipleToKakao(properties: MapProperty[]) {
  if (properties.length === 0) return;
  if (properties.length === 1) {
    await sharePropertyToKakao(properties[0]);
    return;
  }

  const text = properties
    .slice(0, 5)
    .map((p, i) => {
      const addr = sanitizeAddress(p.address);
      return `${i + 1}. ${p.buildingName || p.title} (${p.deposit}/${p.monthly})${addr ? ` - ${addr}` : ""}`;
    })
    .join("\n");
  const fullText = `[집다] 매물 ${properties.length}건\n\n${text}${properties.length > 5 ? `\n... 외 ${properties.length - 5}건` : ""}`;
  const url = buildFreshSiteUrl();

  // 1) Kakao SDK
  try {
    await ensureKakaoSdk();
    if (window.Kakao?.Share) {
      window.Kakao.Share.sendDefault({
        objectType: "text",
        text: fullText,
        link: { mobileWebUrl: url, webUrl: url },
      });
      return;
    }
  } catch (e) {
    console.warn("[shareMultipleToKakao] SDK 실패:", e);
  }

  // 2) Web Share
  try {
    if ((navigator as any).share) {
      await (navigator as any).share({ title: "집다 매물", text: fullText, url });
      return;
    }
  } catch {}

  // 3) Clipboard
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${fullText}\n${url}`);
      alert("매물 정보가 클립보드에 복사되었습니다.\n카카오톡 대화창에 붙여넣기 해주세요.");
      return;
    }
  } catch {}
  window.prompt("아래 내용을 복사해 카카오톡으로 공유하세요:", `${fullText}\n${url}`);
}
