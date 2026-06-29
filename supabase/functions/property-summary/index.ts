import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BUILDING_API_BASE = "http://apis.data.go.kr/1613000/BldRgstHubService";
// 토지 API는 land-proxy Edge Function을 통해서만 호출 (브라우저/VWorld 직접 호출 금지)
// → property-summary가 land-proxy를 POST로 호출하는 구조

// ── 카카오 주소 API로 정확한 법정동 코드 + 번지 추출 ────────────────────────
// 카카오 address.b_code = 10자리 법정동코드 (시군구5 + 읍면동5)
// → sigunguCd = b_code[0..4] (5자리)
// → bjdongCd  = b_code[5..9] (5자리) ← 이것이 건축물대장 API의 bjdongCd
// platGbCd: mountain_yn === "Y" → "1" (산), else "0" (대지)
interface KakaoAddressResult {
  sigunguCd: string;   // 5자리
  bjdongCd:  string;   // 5자리 (b_code 뒤 5자리)
  bun:       string;   // 4자리 0패딩
  ji:        string;   // 4자리 0패딩
  pnu:       string;   // 19자리
  platGbCd:  string;   // "0" 대지, "1" 산
  source:    "kakao" | "fallback";
}

async function resolveAddressParams(
  address: string,
  kakaoKey: string
): Promise<KakaoAddressResult | null> {
  console.log("\n🗺️ [카카오 주소 API] 호출 시작:", address);

  const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${kakaoKey}`,
        "KA": "sdk/1.0.0 os/web origin/https://lovable.app",
      },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    console.log("🗺️ [카카오 응답] documents 수:", data?.documents?.length ?? 0);

    const doc = data?.documents?.[0];
    if (!doc) {
      console.log("⚠️ [카카오] 결과 없음 → fallback 파싱으로 전환");
      return null;
    }

    const addr = doc.address; // 지번 주소 객체
    if (!addr) {
      console.log("⚠️ [카카오] address 객체 없음 → fallback으로 전환");
      return null;
    }

    console.log("🗺️ [카카오 address 객체]:", JSON.stringify(addr));

    // b_code: 10자리 법정동코드
    const bCode = addr.b_code ?? "";
    if (bCode.length !== 10) {
      console.log(`⚠️ [카카오] b_code 길이 이상: "${bCode}" (${bCode.length}자리) → fallback`);
      return null;
    }

    const sigunguCd = bCode.substring(0, 5);   // 앞 5자리
    const bjdongCd  = bCode.substring(5, 10);  // 뒤 5자리

    // 대지구분: mountain_yn "Y" → 산(1), "N" 또는 기타 → 대지(0)
    const platGbCd = addr.mountain_yn === "Y" ? "1" : "0";

    // 본번/부번 4자리 패딩
    const bun = String(addr.main_address_no ?? "0").padStart(4, "0");
    const ji  = String(addr.sub_address_no  ?? "0").padStart(4, "0");

    // PNU: 시군구(5) + 법정동(5) + 대지구분(1) + 본번(4) + 부번(4) = 19자리
    const pnu = `${sigunguCd}${bjdongCd}${platGbCd}${bun}${ji}`;

    console.log("✅ [카카오 파싱 완료]:", { sigunguCd, bjdongCd, platGbCd, bun, ji, pnu, bCode });

    return { sigunguCd, bjdongCd, bun, ji, pnu, platGbCd, source: "kakao" };
  } catch (e) {
    console.error("❌ [카카오 API 오류]:", String(e));
    return null;
  }
}

// ── 폴백: 문자열 기반 파싱 (카카오 실패 시) ─────────────────────────────────
const SIGUNGU_MAP: Record<string, string> = {
  "청주시 상당구": "43111",
  "청주시 흥덕구": "43112",
  "청주시 서원구": "43113",
  "청주시 청원구": "43114",
  "충주시":        "43130",
  "제천시":        "43150",
  "보은군":        "43720",
  "옥천군":        "43730",
  "영동군":        "43740",
  "증평군":        "43745",
  "진천군":        "43750",
  "괴산군":        "43760",
  "음성군":        "43770",
  "단양군":        "43800",
  "청원군":        "43710",
};

// 법정동 코드: sigunguCd(5자리) + bjdongCd(5자리) — 실제 b_code 기준
const BJDONG_MAP: Record<string, { sigungu: string; bjdong: string }> = {
  // 청주시 상당구 (43111)
  "중앙동":     { sigungu: "43111", bjdong: "10100" },
  "북문로1가":  { sigungu: "43111", bjdong: "10200" },
  "북문로2가":  { sigungu: "43111", bjdong: "10300" },
  "내덕동":     { sigungu: "43111", bjdong: "10400" },
  "우암동":     { sigungu: "43111", bjdong: "10500" },
  "금천동":     { sigungu: "43111", bjdong: "10600" },
  "용암동":     { sigungu: "43111", bjdong: "10700" },
  "율량동":     { sigungu: "43111", bjdong: "10800" },
  "방서동":     { sigungu: "43111", bjdong: "10900" },
  "운동동":     { sigungu: "43111", bjdong: "11000" },
  "오근장동":   { sigungu: "43111", bjdong: "11100" },
  "산성동":     { sigungu: "43111", bjdong: "11200" },
  "영운동":     { sigungu: "43111", bjdong: "11300" },
  "용정동":     { sigungu: "43111", bjdong: "11400" },
  "명암동":     { sigungu: "43111", bjdong: "11500" },
  "대성동":     { sigungu: "43111", bjdong: "11600" },
  "수동":       { sigungu: "43111", bjdong: "11700" },
  "문화동":     { sigungu: "43111", bjdong: "11800" },
  "탑동":       { sigungu: "43111", bjdong: "11900" },
  // 청주시 흥덕구 (43112)
  "가경동":     { sigungu: "43112", bjdong: "10700" },
  "봉명동":     { sigungu: "43112", bjdong: "10500" },
  "강서동":     { sigungu: "43112", bjdong: "10800" },
  "복대동":     { sigungu: "43112", bjdong: "11000" },
  "송정동":     { sigungu: "43112", bjdong: "10900" },
  "신봉동":     { sigungu: "43112", bjdong: "11300" },
  "원평동":     { sigungu: "43112", bjdong: "11200" },
  "운천동":     { sigungu: "43112", bjdong: "11100" },
  "송절동":     { sigungu: "43112", bjdong: "11500" },
  "오송읍":     { sigungu: "43112", bjdong: "25000" },
  "강내면":     { sigungu: "43112", bjdong: "38000" },
  // 청주시 서원구 (43113)
  "개신동":     { sigungu: "43113", bjdong: "10300" },
  "성화동":     { sigungu: "43113", bjdong: "10400" },
  "죽림동":     { sigungu: "43113", bjdong: "11800" },
  "사창동":     { sigungu: "43113", bjdong: "11300" },
  "산남동":     { sigungu: "43113", bjdong: "11400" },
  "분평동":     { sigungu: "43113", bjdong: "11500" },
  "사직동":     { sigungu: "43113", bjdong: "11600" },
  "수곡동":     { sigungu: "43113", bjdong: "11700" },
  "모충동":     { sigungu: "43113", bjdong: "11100" },
  "남이면":     { sigungu: "43113", bjdong: "38000" },
  // 청주시 청원구 (43114)
  "내수읍":     { sigungu: "43114", bjdong: "25000" },
  "오창읍":     { sigungu: "43114", bjdong: "21000" },
  "오동동":     { sigungu: "43114", bjdong: "10100" },
  "주중동":     { sigungu: "43114", bjdong: "10400" },
  "주성동":     { sigungu: "43114", bjdong: "10500" },
  "우산동":     { sigungu: "43114", bjdong: "10600" },
  "향정동":     { sigungu: "43114", bjdong: "10700" },
  "외남동":     { sigungu: "43114", bjdong: "10800" },
  "사천동":     { sigungu: "43114", bjdong: "10900" },
  "외평동":     { sigungu: "43114", bjdong: "11000" },
  "외하동":     { sigungu: "43114", bjdong: "11100" },
  // 충주시 (43130)
  "교현동":     { sigungu: "43130", bjdong: "10100" },
  "연수동":     { sigungu: "43130", bjdong: "10200" },
  "용산동":     { sigungu: "43130", bjdong: "10300" },
  "봉방동":     { sigungu: "43130", bjdong: "10900" },
  "칠금동":     { sigungu: "43130", bjdong: "11000" },
  // 제천시 (43150)
  "청전동":     { sigungu: "43150", bjdong: "10300" },
  "화산동":     { sigungu: "43150", bjdong: "10400" },
  "하소동":     { sigungu: "43150", bjdong: "10500" },
};

function fallbackParseAddress(address: string): KakaoAddressResult {
  const sortedKeys = Object.keys(BJDONG_MAP).sort((a, b) => b.length - a.length);
  let sigunguCd = "";
  let bjdongCd  = "";

  for (const [key, code] of Object.entries(SIGUNGU_MAP)) {
    if (address.includes(key)) { sigunguCd = code; break; }
  }
  for (const dong of sortedKeys) {
    if (address.includes(dong)) {
      const entry = BJDONG_MAP[dong];
      if (sigunguCd && entry.sigungu !== sigunguCd) continue;
      sigunguCd = entry.sigungu;
      bjdongCd  = entry.bjdong;
      break;
    }
  }

  // 산 여부: 주소에 "산" 포함 확인
  const isMountain = /\s산\s*\d/.test(address);
  const platGbCd   = isMountain ? "1" : "0";

  const lotMatch = address.match(/(\d+)(?:-(\d+))?(?:\s*번지?)?\s*$/);
  let bun = "0000", ji = "0000";
  if (lotMatch) {
    bun = String(lotMatch[1]).padStart(4, "0");
    ji  = String(lotMatch[2] || "0").padStart(4, "0");
  }

  // PNU = 시군구(5) + 법정동(5) + 대지구분(1) + 본번(4) + 부번(4) = 19자리
  const pnu = sigunguCd && bjdongCd
    ? `${sigunguCd}${bjdongCd}${platGbCd}${bun}${ji}`
    : "";

  console.log("📋 [fallback 파싱]:", { address, sigunguCd, bjdongCd, platGbCd, bun, ji, pnu });

  // 파라미터 진단 로그
  if (!sigunguCd) console.log("⚠️ [진단] sigunguCd 추출 실패 → 시군구 이름이 SIGUNGU_MAP에 없음");
  if (!bjdongCd)  console.log("⚠️ [진단] bjdongCd 추출 실패 → 동 이름이 BJDONG_MAP에 없음");
  if (bun === "0000") console.log("⚠️ [진단] bun=0000 → 번지 추출 실패. 주소 형식 확인 필요");

  return { sigunguCd, bjdongCd, bun, ji, pnu, platGbCd, source: "fallback" };
}

// ── 건축물대장 API 공통 호출 ─────────────────────────────────────────────
async function fetchBuildingApi(
  endpoint: string,
  sigunguCd: string,
  bjdongCd: string,
  bun: string,
  ji: string,
  apiKey: string,
  numOfRows = "10",
) {
  const encodedKey = encodeURIComponent(apiKey);
  const keyMasked  = apiKey ? apiKey.substring(0, 8) + "***" : "(없음)";

  // ── bjdongCd 길이 진단 ──────────────────────────────────────────────
  if (bjdongCd.length !== 5) {
    console.log(`⚠️ [진단] bjdongCd 길이 이상: "${bjdongCd}" (${bjdongCd.length}자리) → 5자리여야 함`);
  }
  if (sigunguCd.length !== 5) {
    console.log(`⚠️ [진단] sigunguCd 길이 이상: "${sigunguCd}" (${sigunguCd.length}자리) → 5자리여야 함`);
  }
  if (bun.length !== 4) {
    console.log(`⚠️ [진단] bun 길이 이상: "${bun}" (${bun.length}자리) → 4자리여야 함`);
  }
  if (ji.length !== 4) {
    console.log(`⚠️ [진단] ji 길이 이상: "${ji}" (${ji.length}자리) → 4자리여야 함`);
  }

  const params  = new URLSearchParams({ sigunguCd, bjdongCd, bun, ji, numOfRows, pageNo: "1", _type: "json" });
  const url     = `${BUILDING_API_BASE}/${endpoint}?serviceKey=${encodedKey}&${params}`;
  const maskedUrl = url.replace(encodedKey, "***MASKED***");

  console.log(`\n🔍 [건축물대장 API] 호출 시작 → ${endpoint}`);
  console.log(`  🌐 호출 URL: ${maskedUrl}`);
  console.log(`  🔑 serviceKey 존재 여부: ${!!apiKey} (앞 8자: ${keyMasked})`);
  console.log(`  📦 요청 파라미터:`);
  console.log(`    📍 sigunguCd : ${sigunguCd} (${sigunguCd.length}자리)`);
  console.log(`    🏘  bjdongCd : ${bjdongCd} (${bjdongCd.length}자리)`);
  console.log(`    🗂  platGbCd : 없음 (URLParam 미포함, API 기본값 사용)`);
  console.log(`    1️⃣  bun      : ${bun} (${bun.length}자리)`);
  console.log(`    2️⃣  ji       : ${ji} (${ji.length}자리)`);
  console.log(`    numOfRows  : ${numOfRows}`);

  try {
    const res  = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const text = await res.text();

    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { /* XML 응답 처리 */ }

    const header     = parsed?.response?.header ?? {};
    const body       = parsed?.response?.body   ?? {};
    const resultCode = header?.resultCode ?? "N/A";
    const resultMsg  = header?.resultMsg  ?? "N/A";
    const totalCount = Number(body?.totalCount ?? 0);
    const rawItem    = body?.items?.item;
    const items      = rawItem ? (Array.isArray(rawItem) ? rawItem : [rawItem]) : [];

    console.log(`\n✅ [건축물대장 API] 응답 수신 → ${endpoint}`);
    console.log(`  🔖 resultCode  : ${resultCode}`);
    console.log(`  💬 resultMsg   : ${resultMsg}`);
    console.log(`  🔢 totalCount  : ${totalCount}`);
    console.log(`  📋 아이템 수   : ${items.length}`);
    console.log(`  📄 원문 응답   : ${text.substring(0, 800)}`);

    // ── totalCount=0 원인 자동 진단 ────────────────────────────────────
    if (totalCount === 0) {
      const isNormalService = (resultCode === "00" || resultCode === "0000") &&
        (resultMsg?.toUpperCase().includes("NORMAL") || resultMsg?.includes("정상"));
      const isKeyError = ["30","31","22","03","04","20","21"].includes(resultCode) ||
        resultMsg?.toUpperCase().includes("SERVICE KEY") || resultMsg?.toUpperCase().includes("INVALID");
      const isLimitExceeded = resultCode === "22" ||
        resultMsg?.toUpperCase().includes("LIMITED") || resultMsg?.includes("초과");

      console.log(`\n⚠️ [진단] totalCount=0 원인 분석 시작 → ${endpoint}`);
      console.log(`  - 사용된 sigunguCd : ${sigunguCd} (${sigunguCd.length}자리)`);
      console.log(`  - 사용된 bjdongCd  : ${bjdongCd} (${bjdongCd.length}자리)`);
      console.log(`  - 사용된 bun/ji    : ${bun}/${ji}`);

      if (isKeyError) {
        console.log(`  ❌ serviceKey 자체 오류 가능성: 높음 (resultCode=${resultCode})`);
        console.log(`  - 활용신청 미승인 가능성: 낮음`);
        console.log(`  - 파라미터 불일치 가능성: 낮음`);
        console.log(`  - bjdongCd 오류 가능성: 낮음`);
      } else if (isLimitExceeded) {
        console.log(`  - serviceKey 자체 오류 가능성: 낮음`);
        console.log(`  ⚠️ 일일 호출 한도 초과 가능성: 높음`);
        console.log(`  - 파라미터 불일치 가능성: 낮음`);
        console.log(`  - bjdongCd 오류 가능성: 낮음`);
      } else if (isNormalService) {
        console.log(`  - serviceKey 자체 오류 가능성: 낮음 (resultCode=00 정상 응답)`);
        console.log(`  - 활용신청 미승인 가능성: 낮음 (활용승인 완료 확인됨)`);
        console.log(`  ⚠️ bjdongCd 오류 가능성: 높음 → 카카오 b_code 기반 5자리 사용 중 (${bjdongCd})`);
        console.log(`  ⚠️ bun/ji 패딩 오류 가능성: 중간 → 현재 bun=${bun} ji=${ji}`);
        console.log(`  ⚠️ sigunguCd 조합 오류 가능성: 중간 → 현재 ${sigunguCd}`);
        console.log(`  - endpoint 불일치 가능성: 낮음 (${BUILDING_API_BASE}/${endpoint})`);
        console.log(`  → 권장: 카카오 b_code의 정확한 앞5자리(sigunguCd)/뒤5자리(bjdongCd) 확인 필요`);
        console.log(`  → 권장: platGbCd 파라미터를 명시적으로 추가해 재시도`);
      } else {
        console.log(`  - 분류 불명확 (resultCode=${resultCode})`);
        console.log(`  - serviceKey 자체 오류 가능성: 중간`);
        console.log(`  - 파라미터 불일치 가능성: 중간`);
        console.log(`  - bjdongCd 오류 가능성: 중간`);
      }
    }

    return { total: totalCount, items, resultCode, resultMsg };
  } catch (e) {
    console.error(`❌ [${endpoint} 오류]`, String(e));
    return { total: 0, items: [], resultCode: "ERR", resultMsg: String(e) };
  }
}

// ── platGbCd 포함 버전 호출 (재시도용) ──────────────────────────────────
async function fetchBuildingApiWithPlatGb(
  endpoint: string,
  sigunguCd: string,
  bjdongCd: string,
  bun: string,
  ji: string,
  platGbCd: string,
  apiKey: string,
  numOfRows = "10",
) {
  const encodedKey = encodeURIComponent(apiKey);
  const params  = new URLSearchParams({ sigunguCd, bjdongCd, platGbCd, bun, ji, numOfRows, pageNo: "1", _type: "json" });
  const url     = `${BUILDING_API_BASE}/${endpoint}?serviceKey=${encodedKey}&${params}`;
  const maskedUrl = url.replace(encodedKey, "***MASKED***");

  console.log(`\n🔍 [건축물대장 API+platGbCd] 호출 → ${endpoint}`);
  console.log(`  🌐 호출 URL: ${maskedUrl}`);
  console.log(`  🗂  platGbCd: ${platGbCd} (${platGbCd === "0" ? "대지" : "산"})`);

  try {
    const res  = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const text = await res.text();
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { /* XML */ }

    const header     = parsed?.response?.header ?? {};
    const body       = parsed?.response?.body   ?? {};
    const resultCode = header?.resultCode ?? "N/A";
    const totalCount = Number(body?.totalCount ?? 0);
    const rawItem    = body?.items?.item;
    const items      = rawItem ? (Array.isArray(rawItem) ? rawItem : [rawItem]) : [];

    console.log(`  ✅ platGbCd(${platGbCd}) 응답: resultCode=${resultCode} totalCount=${totalCount}`);
    console.log(`  📄 원문: ${text.substring(0, 600)}`);

    return { total: totalCount, items, resultCode, resultMsg: header?.resultMsg ?? "" };
  } catch (e) {
    console.error(`❌ [${endpoint}+platGbCd 오류]`, String(e));
    return { total: 0, items: [], resultCode: "ERR", resultMsg: String(e) };
  }
}

// ── 표제부 (platGbCd 없이 먼저, 없으면 0/1로 재시도) ────────────────────
// 여러 동이 있을 수 있으므로 { primary, allItems } 형태로 반환
async function fetchBuildingTitle(s: string, b: string, bun: string, ji: string, platGbCd: string, k: string) {
  const { total, items, resultCode, resultMsg } = await fetchBuildingApi("getBrTitleInfo", s, b, bun, ji, k, "100");
  if (total > 0) {
    console.log("📊 [표제부] 성공:", total, "건 (동 수:", items.length, ")");
    return { primary: items[0], allItems: items };
  }
  // platGbCd 명시 재시도
  for (const pgb of [platGbCd, platGbCd === "0" ? "1" : "0"]) {
    const r2 = await fetchBuildingApiWithPlatGb("getBrTitleInfo", s, b, bun, ji, pgb, k, "100");
    if (r2.total > 0) {
      console.log(`📊 [표제부] platGbCd=${pgb} 재시도 성공:`, r2.total, "건");
      return { primary: r2.items[0], allItems: r2.items };
    }
  }
  console.log(`📊 [표제부] 없음 (${resultCode}/${resultMsg})`);
  return { primary: null, allItems: [] };
}

// ── 총괄표제부 ───────────────────────────────────────────────────────────
async function fetchBuildingRecap(s: string, b: string, bun: string, ji: string, platGbCd: string, k: string) {
  const { total, items, resultCode, resultMsg } = await fetchBuildingApi("getBrRecapTitleInfo", s, b, bun, ji, k);
  if (total > 0) {
    console.log("📊 [총괄표제부] 성공:", total, "건");
    return items[0];
  }
  for (const pgb of [platGbCd, platGbCd === "0" ? "1" : "0"]) {
    const r2 = await fetchBuildingApiWithPlatGb("getBrRecapTitleInfo", s, b, bun, ji, pgb, k);
    if (r2.total > 0) {
      console.log(`📊 [총괄표제부] platGbCd=${pgb} 재시도 성공`);
      return r2.items[0];
    }
  }
  console.log(`📊 [총괄표제부] 없음 (${resultCode}/${resultMsg})`);
  return null;
}

// ── 집합건물 공용부 (전체 목록) ──────────────────────────────────────────
async function fetchBuildingExpos(s: string, b: string, bun: string, ji: string, platGbCd: string, k: string) {
  // 대단지 아파트는 500건 이상일 수 있으므로 페이지네이션
  const fetchAllPages = async (usePlatGb?: string) => {
    let allItems: any[] = [];
    let pageNo = 1;
    const perPage = 500;
    while (true) {
      const encodedKey = encodeURIComponent(k);
      const params: Record<string, string> = { sigunguCd: s, bjdongCd: b, bun, ji, numOfRows: String(perPage), pageNo: String(pageNo), _type: "json" };
      if (usePlatGb) params.platGbCd = usePlatGb;
      const url = `${BUILDING_API_BASE}/getBrExposPubuseAreaInfo?serviceKey=${encodedKey}&${new URLSearchParams(params)}`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        const text = await res.text();
        let parsed: any = {};
        try { parsed = JSON.parse(text); } catch {}
        const body = parsed?.response?.body ?? {};
        const totalCount = Number(body?.totalCount ?? 0);
        const rawItem = body?.items?.item;
        const items = rawItem ? (Array.isArray(rawItem) ? rawItem : [rawItem]) : [];
        allItems = allItems.concat(items);
        console.log(`📊 [집합건물공용부] 페이지 ${pageNo}: ${items.length}건 / 전체 ${totalCount}건`);
        if (allItems.length >= totalCount || items.length === 0) break;
        pageNo++;
      } catch (e) {
        console.error(`❌ [집합건물공용부 페이지 ${pageNo} 오류]`, String(e));
        break;
      }
    }
    return allItems;
  };

  // 먼저 platGbCd 없이 시도
  let allItems = await fetchAllPages();
  if (allItems.length > 0) {
    console.log("📊 [집합건물공용부] 성공:", allItems.length, "건");
    return { primary: allItems[0], allItems };
  }
  // platGbCd 재시도
  for (const pgb of [platGbCd, platGbCd === "0" ? "1" : "0"]) {
    allItems = await fetchAllPages(pgb);
    if (allItems.length > 0) {
      console.log(`📊 [집합건물공용부] platGbCd=${pgb} 재시도 성공:`, allItems.length, "건");
      return { primary: allItems[0], allItems };
    }
  }
  console.log("📊 [집합건물공용부] 없음");
  return { primary: null, allItems: [] };
}

// ── 기본개요 ─────────────────────────────────────────────────────────────
async function fetchBuildingBasic(s: string, b: string, bun: string, ji: string, platGbCd: string, k: string) {
  const { total, items, resultCode, resultMsg } = await fetchBuildingApi("getBrBasisOulnInfo", s, b, bun, ji, k);
  if (total > 0) { console.log("📊 [기본개요] 성공"); return items[0]; }
  for (const pgb of [platGbCd, platGbCd === "0" ? "1" : "0"]) {
    const r2 = await fetchBuildingApiWithPlatGb("getBrBasisOulnInfo", s, b, bun, ji, pgb, k);
    if (r2.total > 0) { console.log(`📊 [기본개요] platGbCd=${pgb} 재시도 성공`); return r2.items[0]; }
  }
  console.log(`📊 [기본개요] 없음 (${resultCode}/${resultMsg})`);
  return null;
}

// ── 층별 개요 ────────────────────────────────────────────────────────────
async function fetchBuildingFloors(s: string, b: string, bun: string, ji: string, platGbCd: string, k: string) {
  const { items } = await fetchBuildingApi("getBrFlrOulnInfo", s, b, bun, ji, k, "30");
  if (items.length > 0) { console.log("📊 [층별개요] 성공:", items.length, "건"); return items; }
  for (const pgb of [platGbCd, platGbCd === "0" ? "1" : "0"]) {
    const r2 = await fetchBuildingApiWithPlatGb("getBrFlrOulnInfo", s, b, bun, ji, pgb, k, "30");
    if (r2.items.length > 0) { console.log(`📊 [층별개요] platGbCd=${pgb} 재시도 성공`); return r2.items; }
  }
  console.log("📊 [층별개요] 없음");
  return [];
}

// ── 위반건축물 조회 ──────────────────────────────────────────────────────
async function fetchBuildingViolation(s: string, b: string, bun: string, ji: string, platGbCd: string, k: string) {
  // getBrVlttRnList: 위반건축물 목록 조회
  const { total, items, resultCode, resultMsg } = await fetchBuildingApi("getBrVlttRnList", s, b, bun, ji, k, "10");
  if (total > 0) {
    console.log("🚨 [위반건축물] 목록 조회 성공:", total, "건");
    items.forEach((item: any, idx: number) => {
      console.log(`  🚨 위반건축물 여부: Y`);
      console.log(`  📄 위반내용 [${idx + 1}]:`, item.vlttRnCnts || item.vlttCn || "(내용 없음)");
      console.log(`  🗂  위반구분:`, item.vlttGbCdNm || item.vlttKndCdNm || "(구분 없음)");
      console.log(`  원문:`, JSON.stringify(item));
    });
    return { isViolation: true, items, resultCode, resultMsg };
  }

  // platGbCd 명시 재시도
  for (const pgb of [platGbCd, platGbCd === "0" ? "1" : "0"]) {
    const r2 = await fetchBuildingApiWithPlatGb("getBrVlttRnList", s, b, bun, ji, pgb, k);
    if (r2.total > 0) {
      console.log(`🚨 [위반건축물] platGbCd=${pgb} 재시도 성공:`, r2.total, "건");
      return { isViolation: true, items: r2.items, resultCode: r2.resultCode, resultMsg: r2.resultMsg };
    }
  }

  // resultCode=00, totalCount=0 → 위반 없음
  if (resultCode === "00" || resultCode === "0000") {
    console.log("✅ [위반건축물] 위반 없음 (resultCode=00, totalCount=0)");
    return { isViolation: false, items: [], resultCode, resultMsg };
  }

  console.log(`⚠️ [위반건축물] 조회 결과 없음 (${resultCode}/${resultMsg})`);
  return { isViolation: false, items: [], resultCode, resultMsg };
}

// ── 토지 API 응답 파싱 헬퍼 (모든 구조 처리) ──────────────────────────────
// ── 토지 조회는 land-proxy Edge Function에 완전 위임 ──────────────────────
// 브라우저 또는 이 함수에서 VWorld(api.vworld.kr) / nsdi를 직접 호출하지 않음
// property-summary → land-proxy(POST) → 국내프록시 or nsdi fallback

// ── 층별 세대수/호수 보강 (집합건물 전유부에서 집계) ─────────────────────
// getBrFlrOulnInfo는 층별 hhldCnt/fmlyCnt/hoCnt를 반환하지 않으므로,
// 집합건물 전유부(getBrExposPubuseAreaInfo) 응답을 층별로 집계해 보강한다.
function enrichFloorsWithExposCounts(floorItems: any[], exposItems: any[]): any[] {
  if (!Array.isArray(floorItems) || floorItems.length === 0) return floorItems ?? [];
  if (!Array.isArray(exposItems) || exposItems.length === 0) return floorItems;

  // 전유부만 카운트 (공용부 제외). 호수(hoNm)가 있는 레코드만 1세대로 집계.
  const norm = (v: any) => String(v ?? "").trim();
  const countByFloor = new Map<string, number>();
  for (const e of exposItems) {
    const gb = norm(e.exposPubuseGbCdNm);
    if (gb && !gb.includes("전유")) continue;
    const ho = norm(e.hoNm);
    if (!ho) continue;
    const key = norm(e.flrNoNm) || norm(e.flrNo);
    if (!key) continue;
    countByFloor.set(key, (countByFloor.get(key) ?? 0) + 1);
  }

  if (countByFloor.size === 0) return floorItems;

  return floorItems.map((f) => {
    const key = norm(f.flrNoNm) || norm(f.flrNo);
    const derived = key ? countByFloor.get(key) ?? null : null;
    const orig = (v: any) => (v !== undefined && v !== null && String(v).trim() !== "" && Number(v) !== 0 ? v : null);
    return {
      ...f,
      hhldCnt: orig(f.hhldCnt) ?? derived ?? null,
      fmlyCnt: orig(f.fmlyCnt) ?? null,
      hoCnt:   orig(f.hoCnt)   ?? derived ?? null,
    };
  });
}

// ── API 응답 → building_summary 매핑 ────────────────────────────────────
function mapBuildingData(item: any, floorItems: any[]) {
  if (!item) return null;



  // ── 원본 응답 디버그 로그 ─────────────────────────────────────────────
  console.log("🏢 [building raw]", JSON.stringify({
    useAprDay:           item.useAprDay,
    rideUseElvtCnt:      item.rideUseElvtCnt,
    emgenUseElvtCnt:     item.emgenUseElvtCnt,
    elevCnt:             item.elevCnt,
    emgElevCnt:          item.emgElevCnt,
    elvCnt:              item.elvCnt,
    elevYn:              item.elevYn,
    elvtYn:              item.elvtYn,
    erthqkAblty:         item.erthqkAblty,
    erthqkDsgnApplyYn:   item.erthqkDsgnApplyYn,
    mainPurpsCdNm:       item.mainPurpsCdNm,
    bldNm:               item.bldNm,
    grndFlrCnt:          item.grndFlrCnt,
    ugrndFlrCnt:         item.ugrndFlrCnt,
  }));

  const floorsAbove  = item.grndFlrCnt  ? String(item.grndFlrCnt)                  : null;
  const floorsBelow  = item.ugrndFlrCnt ? String(item.ugrndFlrCnt)                 : null;
  const totalArea    = item.totArea     ? `${Number(item.totArea).toFixed(1)}㎡`    : null;
  const buildingArea = item.archArea    ? `${Number(item.archArea).toFixed(1)}㎡`   : null;
  const landArea     = item.platArea    ? `${Number(item.platArea).toFixed(1)}㎡`   : null;
  const mainPurpose  = item.mainPurpsCdNm || item.etcPurps || null;

  let approvalDate: string | null = null;
  if (item.useAprDay?.length === 8) {
    approvalDate = `${item.useAprDay.slice(0,4)}-${item.useAprDay.slice(4,6)}-${item.useAprDay.slice(6,8)}`;
  }
  const buildYear = approvalDate ? approvalDate.slice(0, 4) : null;

  const parkingCount = (
    Number(item.indrMechUtcnt || 0) + Number(item.oudrMechUtcnt || 0) +
    Number(item.indrAutoUtcnt || 0) + Number(item.oudrAutoUtcnt || 0)
  );

  // ── 엘리베이터 상세 판단 ─────────────────────────────────────────────
  // 건축물대장 API 필드명:
  //   - 표제부/총괄표제부 일반건물: elevCnt(승용) + emgElevCnt(비상)
  //   - 집합건물/아파트: rideUseElvtCnt(승용) + emgenUseElvtCnt(비상) ← 정확한 필드명
  //   - 구버전: elvCnt, emrgncyElvtCnt 등
  const elevRide = Number(
    item.rideUseElvtCnt ?? item.elevCnt ?? item.elvCnt ?? 0
  );
  const elevEmg  = Number(
    item.emgenUseElvtCnt ?? item.emgElevCnt ?? item.emrgncyElvtCnt ?? 0
  );
  const elevTotal = elevRide + elevEmg;

  // Y/N 필드 fallback
  const elevYnField = item.elevYn ?? item.elvtYn ?? null;
  const elevator    = elevTotal > 0 || elevYnField === "Y";

  let elevatorDetail: string;
  if (elevTotal > 0) {
    elevatorDetail = elevEmg > 0
      ? `있음 (일반 ${elevRide}대, 비상 ${elevEmg}대)`
      : `있음 (${elevRide}대)`;
  } else {
    elevatorDetail = elevator ? "있음" : "없음";
  }

  console.log(`🏢 [elevator counts] ride=${item.rideUseElvtCnt ?? "-"} emgen=${item.emgenUseElvtCnt ?? "-"} elevCnt=${item.elevCnt ?? "-"} emgElevCnt=${item.emgElevCnt ?? "-"} elevYn=${elevYnField ?? "-"} → ride=${elevRide} emg=${elevEmg} total=${elevTotal} → ${elevatorDetail}`);

  // 허가일/착공일
  let permitDate: string | null = null;
  if (item.pmsDay?.length === 8) {
    permitDate = `${item.pmsDay.slice(0,4)}-${item.pmsDay.slice(4,6)}-${item.pmsDay.slice(6,8)}`;
  }
  let startDate: string | null = null;
  if (item.stcnsDay?.length === 8) {
    startDate = `${item.stcnsDay.slice(0,4)}-${item.stcnsDay.slice(4,6)}-${item.stcnsDay.slice(6,8)}`;
  }

  // 내진 정보
  const seismicAblty        = item.erthqkAblty       || null;
  const seismicDsgnApplyYn  = item.erthqkDsgnApplyYn || null;
  const seismicDesign = seismicDsgnApplyYn
    ? (seismicDsgnApplyYn === "Y" ? "적용" : seismicDsgnApplyYn === "N" ? "미적용" : seismicDsgnApplyYn)
    : null;

  const mapped = {
    building_name:  item.bldNm || null,
    main_purpose:   mainPurpose,
    approval_date:  approvalDate,
    land_area:      landArea,
    building_area:  buildingArea,
    total_area:     totalArea,
    floors_above:   floorsAbove,
    floors_below:   floorsBelow,
    parking_count:  parkingCount > 0 ? String(parkingCount) : null,
    elevator,
    _raw: {
      // 기본
      hhldCnt:       item.hhldCnt       ? String(item.hhldCnt)                : null,
      fmlyCnt:       item.fmlyCnt       ? String(item.fmlyCnt)                : null,
      hoCnt:         item.hoCnt         ? String(item.hoCnt)                  : null,
      bcRat:         item.bcRat         ? `${item.bcRat}%`                    : null,
      vlRat:         item.vlRat         ? `${item.vlRat}%`                    : null,
      vlRatEstmTotArea: item.vlRatEstmTotArea ? `${Number(item.vlRatEstmTotArea).toFixed(1)}㎡` : null,
      strctCdNm:     item.strctCdNm     || null,
      roofCdNm:      item.roofCdNm      || null,
      bldNm:         item.bldNm         || null,
      mainPurpsCdNm: item.mainPurpsCdNm || null,
      etcPurps:      item.etcPurps      || null,
      totArea:       item.totArea       ? `${Number(item.totArea).toFixed(1)}㎡`   : null,
      archArea:      item.archArea      ? `${Number(item.archArea).toFixed(1)}㎡`  : null,
      platArea:      item.platArea      ? `${Number(item.platArea).toFixed(1)}㎡`  : null,
      useAprDay:     approvalDate,
      pmsDay:        permitDate,
      stcnsDay:      startDate,
      grndFlrCnt:    floorsAbove,
      ugrndFlrCnt:   floorsBelow,
      indrMechUtcnt: item.indrMechUtcnt ? String(item.indrMechUtcnt) : null,
      // 엘리베이터 — ride/emg 분리 저장 (공통 유틸이 재사용)
      rideUseElvtCnt:    String(elevRide),
      emgenUseElvtCnt:   String(elevEmg),
      elevCnt:           String(elevRide),   // 레거시 호환
      emgElevCnt:        String(elevEmg),    // 레거시 호환
      elevYn:            elevator ? "Y" : "N",
      elevatorDetail,
      // 원본 보존 (디버깅)
      rawRideUseElvtCnt: item.rideUseElvtCnt  ?? null,
      rawEmgenUseElvtCnt: item.emgenUseElvtCnt ?? null,
      rawElevCnt:        item.elevCnt          ?? null,
      rawEmgElevCnt:     item.emgElevCnt       ?? null,
      rawElevYn:         elevYnField           ?? null,
      // 주소
      platPlc:       item.platPlc    || null,
      newPlatPlc:    item.newPlatPlc || null,
      // 내진
      erthqkDsgnApplyYn: seismicDsgnApplyYn,
      erthqkAblty:       seismicAblty,
      seismicDesign,
      // 기타
      useAprDayBefore: item.useAprDayBefore || null,
      floors: floorItems.map((f) => ({
        flrNo:         f.flrNo,
        flrNoNm:       f.flrNoNm,
        area:          f.area ? `${Number(f.area).toFixed(1)}㎡` : null,
        mainPurpsCdNm: f.mainPurpsCdNm,
        hhldCnt:       f.hhldCnt ?? null,
        fmlyCnt:       f.fmlyCnt ?? null,
        hoCnt:         f.hoCnt   ?? null,
      })),
    },
  };

  console.log("🏢 [building mapped]", JSON.stringify({
    approval_date: mapped.approval_date,
    buildYear,
    elevator:      mapped.elevator,
    elevatorDetail,
    elevRide,
    elevEmg,
    seismicAblty,
    seismicDesign,
  }));

  return mapped;
}

// ── 메인 핸들러 ─────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── JWT 인증 검증 ────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const _supabaseUrlForAuth = Deno.env.get("SUPABASE_URL")!;
    const _anonKeyForAuth = Deno.env.get("SUPABASE_ANON_KEY")!;
    const _userClient = createClient(_supabaseUrlForAuth, _anonKeyForAuth, {
      global: { headers: { Authorization: authHeader } },
    });
    const _token = authHeader.replace("Bearer ", "");
    const { data: _claimsData, error: _claimsErr } = await _userClient.auth.getClaims(_token);
    if (_claimsErr || !_claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { address, property_id } = await req.json();
    console.log("🔍 [property-summary] 요청:", { address, property_id });

    if (!address && !property_id) {
      return new Response(
        JSON.stringify({ error: "address 또는 property_id가 필요합니다" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dataGoKrApiKey = Deno.env.get("DATA_GO_KR_API_KEY")?.trim();
    const vworldApiKey   = Deno.env.get("VWORLD_API_KEY")?.trim();
    const kakaoApiKey    = Deno.env.get("KAKAO_API_KEY")?.trim();

    console.log("🔑 [API키 로드]:", {
      dataGoKr: !!dataGoKrApiKey,
      vworld:   !!vworldApiKey,
      kakao:    !!kakaoApiKey,
    });

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── 1. property_id + address 확인 ───────────────────────────────
    let pid = property_id;
    let propertyAddress = address;

    if (!pid && address) {
      const { data: exact } = await supabase
        .from("properties").select("id, address").eq("address", address).limit(1).maybeSingle();
      if (exact) { pid = exact.id; propertyAddress = exact.address; }
      else {
        const { data: like } = await supabase
          .from("properties").select("id, address").ilike("address", `%${address}%`).limit(1).maybeSingle();
        if (like) {
          pid = like.id; propertyAddress = like.address;
          if (propertyAddress !== address)
            console.log("⚠️ [주소 불일치] 요청:", address, "| DB:", propertyAddress);
        }
      }
    } else if (pid && !propertyAddress) {
      const { data: prop } = await supabase
        .from("properties").select("address").eq("id", pid).maybeSingle();
      if (prop?.address) propertyAddress = prop.address;
    }

    console.log("📌 [property_id]:", pid, "| [address]:", propertyAddress);

    // pid가 없어도 주소만 있으면 공적장부 조회를 진행 (DB 저장은 스킵)
    const skipDbWrite = !pid;
    if (!pid && !propertyAddress) {
      return new Response(
        JSON.stringify({ property_id: null, address, building_summary: null, land_summary: null, has_building: false, has_land: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. DB 기존 데이터 조회 (pid가 있을 때만) ─────────────────────
    let buildingData: Record<string, unknown> | null = null;
    let landData:     Record<string, unknown> | null = null;
    if (pid) {
      const [bRes, lRes] = await Promise.all([
        supabase.from("building_summary").select("*").eq("property_id", pid).maybeSingle(),
        supabase.from("land_summary").select("*").eq("property_id", pid).maybeSingle(),
      ]);
      buildingData = bRes.data as Record<string, unknown> | null;
      landData     = lRes.data as Record<string, unknown> | null;
    }

    // 공백/무의미한 값도 빈 데이터로 취급
    const trimOrNull = (v: unknown) => v && String(v).trim() ? String(v).trim() : null;
    const isBuildingEmpty = buildingData && !trimOrNull(buildingData.main_purpose) && !trimOrNull(buildingData.total_area) && !trimOrNull(buildingData.approval_date);
    // total_area가 너무 작으면 (경비실 등 소규모 건물 캐시) 재조회 필요
    const isBuildingPoor = buildingData && !isBuildingEmpty &&
      buildingData.total_area && Number(String(buildingData.total_area).replace(/[^0-9.]/g, "")) < 20 &&
      !trimOrNull(buildingData.approval_date) && !trimOrNull(buildingData.floors_above);
    const needBuildingSave = !buildingData || !!isBuildingEmpty || !!isBuildingPoor;
    const needBuilding     = true; // _raw 상세 데이터를 위해 항상 API 호출
    const needLand         = !landData || !landData.official_price;

    console.log("📦 [building_summary]:", buildingData ? (isBuildingEmpty ? "빈껍데기" : "유효") : "없음", "| needBuildingSave:", needBuildingSave);
    console.log("🌍 [land_summary]:", landData ? "있음" : "없음", "| 공시지가:", landData?.official_price || "없음");

    // ── 3. API 조회 ──────────────────────────────────────────────────
    if ((needBuilding || needLand) && dataGoKrApiKey && propertyAddress) {
      // ── 카카오 API로 정확한 법정동 코드 추출 시도 ────────────────
      let addrParams: KakaoAddressResult | null = null;

      if (kakaoApiKey) {
        addrParams = await resolveAddressParams(propertyAddress, kakaoApiKey);
      }

      // ── 카카오 결과를 BJDONG_MAP과 교차 검증 (로그만, 카카오 우선) ──
      // 청주시 구 개편(2014) 이후 법정동코드는 변경되지 않았으므로
      // 카카오 API의 b_code(정부 공식 데이터)를 신뢰하고 BJDONG_MAP은 참고용으로만 사용
      if (addrParams) {
        const fallbackCheck = fallbackParseAddress(propertyAddress);
        if (fallbackCheck.sigunguCd && fallbackCheck.bjdongCd) {
          const kakaoMatch = `${addrParams.sigunguCd}${addrParams.bjdongCd}`;
          const mapMatch   = `${fallbackCheck.sigunguCd}${fallbackCheck.bjdongCd}`;
          if (kakaoMatch !== mapMatch) {
            console.log(`ℹ️ [카카오 교차검증 불일치] 카카오: ${kakaoMatch} vs 맵: ${mapMatch} → 카카오(공식코드) 기준 유지`);
            // 카카오 결과를 그대로 사용 (덮어쓰지 않음)
          }
        }
      }

      // 카카오 실패 시 fallback
      if (!addrParams) {
        console.log("⚠️ [카카오 실패] fallback 문자열 파싱으로 전환");
        addrParams = fallbackParseAddress(propertyAddress);
      }

      const { sigunguCd, bjdongCd, bun, ji, pnu, platGbCd, source } = addrParams;

      console.log(`\n📊 [주소 파라미터 최종 확정] (출처: ${source})`);
      console.log(`  sigunguCd : ${sigunguCd} (${sigunguCd.length}자리) ${sigunguCd.length === 5 ? "✅" : "❌ 5자리 아님"}`);
      console.log(`  bjdongCd  : ${bjdongCd}  (${bjdongCd.length}자리) ${bjdongCd.length === 5 ? "✅" : "❌ 5자리 아님"}`);
      console.log(`  bun       : ${bun} (${bun.length}자리) ${bun.length === 4 ? "✅" : "❌ 4자리 아님"}`);
      console.log(`  ji        : ${ji}  (${ji.length}자리) ${ji.length === 4 ? "✅" : "❌ 4자리 아님"}`);
      console.log(`  platGbCd  : ${platGbCd} (${platGbCd === "0" ? "대지" : "산"})`);
      console.log(`  PNU       : ${pnu} (${pnu.length}자리) ${pnu.length === 19 ? "✅" : "❌ 19자리 아님"}`);

      if (sigunguCd && bjdongCd) {
        // ── 3a. 건축물대장 + 위반건축물 ──
        if (needBuilding) {
          const [titleResult, recapItem, exposResult, basicItem, floorItems, violationResult] = await Promise.all([
            fetchBuildingTitle(sigunguCd, bjdongCd, bun, ji, platGbCd, dataGoKrApiKey),
            fetchBuildingRecap(sigunguCd, bjdongCd, bun, ji, platGbCd, dataGoKrApiKey),
            fetchBuildingExpos(sigunguCd, bjdongCd, bun, ji, platGbCd, dataGoKrApiKey),
            fetchBuildingBasic(sigunguCd, bjdongCd, bun, ji, platGbCd, dataGoKrApiKey),
            fetchBuildingFloors(sigunguCd, bjdongCd, bun, ji, platGbCd, dataGoKrApiKey),
            fetchBuildingViolation(sigunguCd, bjdongCd, bun, ji, platGbCd, dataGoKrApiKey),
          ]);

          const allTitleItems = titleResult.allItems;
          const exposItem = exposResult.primary;
          const allExposItems = exposResult.allItems;

          // ── bestItem 선택: 가장 상세한 표제부 아이템 우선 ──
          // 아파트 등 집합건물에서 첫 번째 아이템이 관리동/경비실 등 소규모인 경우 방지
          const scoreTitleItem = (item: any) => {
            let s = 0;
            if (item.bldNm && String(item.bldNm).trim()) s += 3;
            if (item.mainPurpsCdNm && String(item.mainPurpsCdNm).trim()) s += 2;
            if (item.totArea && Number(item.totArea) > 50) s += 2;
            if (item.useAprDay && String(item.useAprDay).trim().length >= 8) s += 1;
            if (item.grndFlrCnt && Number(item.grndFlrCnt) > 1) s += 1;
            if (item.rideUseElvtCnt && Number(item.rideUseElvtCnt) > 0) s += 1;
            return s;
          };

          let titleItem = titleResult.primary;
          if (allTitleItems.length > 1) {
            // 가장 상세한 표제부 아이템 선택
            titleItem = allTitleItems.reduce((best: any, item: any) =>
              scoreTitleItem(item) > scoreTitleItem(best) ? item : best,
              allTitleItems[0]
            );
            console.log(`📊 [표제부 최적 선택] ${allTitleItems.length}건 중 bldNm="${titleItem?.bldNm}" totArea=${titleItem?.totArea} score=${scoreTitleItem(titleItem)}`);
          }

          // recap(총괄표제부)이 있고 titleItem보다 상세하면 recap 우선
          const bestItem = (() => {
            if (titleItem && recapItem) {
              // recap이 건물명이 있고 titleItem에 없으면 recap 우선
              const titleHasName = titleItem.bldNm && String(titleItem.bldNm).trim();
              const recapHasName = recapItem.bldNm && String(recapItem.bldNm).trim();
              if (!titleHasName && recapHasName) return recapItem;
              // titleItem의 면적이 너무 작으면 (경비실 등) recap 우선
              if (Number(titleItem.totArea ?? 0) < 50 && Number(recapItem.totArea ?? 0) > 50) return recapItem;
            }
            return titleItem || recapItem || exposItem || basicItem;
          })();
          const bestSource = bestItem === recapItem ? "총괄표제부" : bestItem === titleItem ? "표제부" : bestItem === exposItem ? "집합건물공용부" : bestItem === basicItem ? "기본개요" : "없음";
          const apiStatus  = !bestItem ? "no_data" : "ok";

          console.log(`\n📊 [최종 선택 API]: ${bestSource} (bldNm="${bestItem?.bldNm}" totArea=${bestItem?.totArea})`);

          // ── 위반건축물 최종 요약 로그 ──
          console.log(`\n🏛️ [위반건축물 판단]`);
          console.log(`  🚨 위반건축물 여부: ${violationResult.isViolation ? "Y" : "N"}`);
          if (violationResult.isViolation && violationResult.items.length > 0) {
            violationResult.items.forEach((v: any, i: number) => {
              const content = v.vlttRnCnts || v.vlttCn || v.vlttKndCdNm || "(내용 없음)";
              const kind    = v.vlttGbCdNm || v.vlttKndCdNm || "(구분 없음)";
              console.log(`  📄 위반내용 [${i + 1}]: ${content}`);
              console.log(`  🗂  위반구분 [${i + 1}]: ${kind}`);
            });
          } else {
            console.log(`  ✅ 위반 없음`);
          }

          if (!bestItem) {
            console.log("\n🚨 [최종 진단]");
            console.log(`resultCode=00 / 정상 서비스 / totalCount=0`);
            console.log(`API 키 및 활용승인은 정상입니다.`);
            console.log(`파라미터 조합 확인: sigunguCd=${sigunguCd} bjdongCd=${bjdongCd} bun=${bun} / ji=${ji} platGbCd=${platGbCd} (출처: ${source})`);
            console.log(`→ 해당 번지에 건축물이 없거나, 대장 미등록 건물일 수 있습니다.`);
          }

          const enrichedFloorItems = enrichFloorsWithExposCounts(floorItems, allExposItems);
          const mappedBuilding = mapBuildingData(bestItem, enrichedFloorItems);

          // 위반건축물 정보를 _raw에 포함
          const violationSummary = violationResult.isViolation
            ? {
                isViolation: true,
                violationYn: "Y",
                items: violationResult.items.map((v: any) => ({
                  vlttRnCnts: v.vlttRnCnts || v.vlttCn || null,
                  vlttGbCdNm: v.vlttGbCdNm || v.vlttKndCdNm || null,
                  crtnDay:    v.crtnDay || null,
                })),
              }
            : { isViolation: false, violationYn: "N", items: [] };

          // dongNm 정규화 헬퍼 (공백/빈문자열 → null)
          const normDong = (v: any) => v && String(v).trim() ? String(v).trim() : null;

          // 총괄표제부 매핑
          const recapMapped = recapItem ? {
            bldNm: recapItem.bldNm || null,
            mainPurpsCdNm: recapItem.mainPurpsCdNm || null,
            etcPurps: recapItem.etcPurps || null,
            strctCdNm: recapItem.strctCdNm || null,
            roofCdNm: recapItem.roofCdNm || null,
            platArea: recapItem.platArea ? `${Number(recapItem.platArea).toFixed(2)} ㎡` : null,
            archArea: recapItem.archArea ? `${Number(recapItem.archArea).toFixed(2)} ㎡` : null,
            totArea: recapItem.totArea ? `${Number(recapItem.totArea).toFixed(2)} ㎡` : null,
            vlRatEstmTotArea: recapItem.vlRatEstmTotArea ? `${Number(recapItem.vlRatEstmTotArea).toFixed(2)} ㎡` : null,
            bcRat: recapItem.bcRat ? `${Number(recapItem.bcRat).toFixed(2)} %` : null,
            vlRat: recapItem.vlRat ? `${Number(recapItem.vlRat).toFixed(2)} %` : null,
            hhldCnt: recapItem.hhldCnt ?? null,
            fmlyCnt: recapItem.fmlyCnt ?? null,
            hoCnt: recapItem.hoCnt ?? null,
            grndFlrCnt: recapItem.grndFlrCnt ?? null,
            ugrndFlrCnt: recapItem.ugrndFlrCnt ?? null,
            rideUseElvtCnt: recapItem.rideUseElvtCnt ?? recapItem.elevCnt ?? null,
            emgenUseElvtCnt: recapItem.emgenUseElvtCnt ?? recapItem.emgElevCnt ?? null,
            indrMechUtcnt: recapItem.indrMechUtcnt ?? null,
            oudrMechUtcnt: recapItem.oudrMechUtcnt ?? null,
            indrAutoUtcnt: recapItem.indrAutoUtcnt ?? null,
            oudrAutoUtcnt: recapItem.oudrAutoUtcnt ?? null,
            pmsDay: recapItem.pmsDay?.length === 8 ? `${recapItem.pmsDay.slice(0,4)}-${recapItem.pmsDay.slice(4,6)}-${recapItem.pmsDay.slice(6,8)}` : null,
            stcnsDay: recapItem.stcnsDay?.length === 8 ? `${recapItem.stcnsDay.slice(0,4)}-${recapItem.stcnsDay.slice(4,6)}-${recapItem.stcnsDay.slice(6,8)}` : null,
            useAprDay: recapItem.useAprDay?.length === 8 ? `${recapItem.useAprDay.slice(0,4)}-${recapItem.useAprDay.slice(4,6)}-${recapItem.useAprDay.slice(6,8)}` : null,
            platPlc: recapItem.platPlc || null,
            newPlatPlc: recapItem.newPlatPlc || null,
            dongCnt: recapItem.dongCnt ?? null,
          } : null;

          const rawWithStatus  = {
            ...(mappedBuilding?._raw ?? { floors: [] }),
            api_status: apiStatus,
            params_used: { sigunguCd, bjdongCd, bun, ji, platGbCd, pnu, source },
            violation: violationSummary,
            recap: recapMapped,
            allBuildings: allTitleItems.map((item: any) => {
              const titleDong = normDong(item.dongNm);
              // 집합건물 전유/공용부 면적에서 해당 동의 층별 정보 추출
              const dongFloors = allExposItems.filter((e: any) => {
                const exposDong = normDong(e.dongNm);
                return (!titleDong && !exposDong) || (titleDong && exposDong === titleDong);
              });
              
              return {
                dongNm: titleDong || (item.bldNm ? String(item.bldNm).trim() : null) || null,
                regstrGbCdNm: item.regstrGbCdNm || null,
                regstrKindCdNm: item.regstrKindCdNm || null,
                mainPurpsCdNm: item.mainPurpsCdNm || null,
                etcPurps: item.etcPurps || null,
                strctCdNm: item.strctCdNm || null,
                roofCdNm: item.roofCdNm || null,
                platArea: item.platArea ? `${Number(item.platArea).toFixed(2)} ㎡` : null,
                archArea: item.archArea ? `${Number(item.archArea).toFixed(2)} ㎡` : null,
                totArea: item.totArea ? `${Number(item.totArea).toFixed(2)} ㎡` : null,
                vlRatEstmTotArea: item.vlRatEstmTotArea ? `${Number(item.vlRatEstmTotArea).toFixed(2)} ㎡` : null,
                bcRat: item.bcRat ? `${Number(item.bcRat).toFixed(2)} %` : null,
                vlRat: item.vlRat ? `${Number(item.vlRat).toFixed(2)} %` : null,
                hhldCnt: item.hhldCnt ?? null,
                fmlyCnt: item.fmlyCnt ?? null,
                hoCnt: item.hoCnt ?? null,
                grndFlrCnt: item.grndFlrCnt ?? null,
                ugrndFlrCnt: item.ugrndFlrCnt ?? null,
                rideUseElvtCnt: item.rideUseElvtCnt ?? item.elevCnt ?? null,
                emgenUseElvtCnt: item.emgenUseElvtCnt ?? item.emgElevCnt ?? null,
                indrMechUtcnt: item.indrMechUtcnt ?? null,
                oudrMechUtcnt: item.oudrMechUtcnt ?? null,
                indrAutoUtcnt: item.indrAutoUtcnt ?? null,
                oudrAutoUtcnt: item.oudrAutoUtcnt ?? null,
                pmsDay: item.pmsDay ? `${item.pmsDay.slice(0,4)}-${item.pmsDay.slice(4,6)}-${item.pmsDay.slice(6,8)}` : null,
                stcnsDay: item.stcnsDay ? `${item.stcnsDay.slice(0,4)}-${item.stcnsDay.slice(4,6)}-${item.stcnsDay.slice(6,8)}` : null,
                useAprDay: item.useAprDay ? `${item.useAprDay.slice(0,4)}-${item.useAprDay.slice(4,6)}-${item.useAprDay.slice(6,8)}` : null,
                platPlc: item.platPlc || null,
                newPlatPlc: item.newPlatPlc || null,
                bldNm: item.bldNm ? String(item.bldNm).trim() : null,
                erthqkAblty: item.erthqkAblty || null,
                erthqkDsgnApplyYn: item.erthqkDsgnApplyYn || null,
                // 집합건물 층별 전유/공용 면적 정보
                exposFloors: dongFloors.map((e: any) => ({
                  flrNo: e.flrNo ?? null,
                  flrNoNm: e.flrNoNm ?? null,
                  area: e.area ? `${Number(e.area).toFixed(1)}㎡` : null,
                  pubuseGbCdNm: e.pubuseGbCdNm ?? null,
                  mainPurpsCdNm: e.mainPurpsCdNm ?? null,
                  etcPurps: e.etcPurps ?? null,
                  exposPubuseGbCdNm: e.exposPubuseGbCdNm ?? null,
                  hoNm: e.hoNm ?? null,
                })),
              };
            }),
          };

          if (skipDbWrite) {
            // pid가 없을 때: API 결과를 메모리에서만 구성하여 응답
            buildingData = {
              property_id: null,
              building_name: mappedBuilding?.building_name ?? null,
              main_purpose:  mappedBuilding?.main_purpose  ?? null,
              approval_date: mappedBuilding?.approval_date ?? null,
              land_area:     mappedBuilding?.land_area     ?? null,
              building_area: mappedBuilding?.building_area ?? null,
              total_area:    mappedBuilding?.total_area    ?? null,
              floors_above:  mappedBuilding?.floors_above  ?? null,
              floors_below:  mappedBuilding?.floors_below  ?? null,
              parking_count: mappedBuilding?.parking_count ?? null,
              elevator:      mappedBuilding?.elevator      ?? false,
              _raw: rawWithStatus,
            };
            console.log("✅ [건축물대장] 비등록 매물 — 메모리 응답");
          } else if (buildingData && !isBuildingEmpty && !isBuildingPoor) {
            // DB에 유효한 데이터가 이미 있으면 _raw만 붙여서 반환 (DB 업데이트 불필요)
            buildingData = { ...buildingData, _raw: rawWithStatus };
            console.log("✅ [건축물대장] DB 캐시 + _raw 병합");
          } else if ((isBuildingEmpty || isBuildingPoor) && buildingData) {
            const { data: updated } = await supabase
              .from("building_summary")
              .update({
                building_name: mappedBuilding?.building_name ?? null,
                main_purpose:  mappedBuilding?.main_purpose  ?? null,
                approval_date: mappedBuilding?.approval_date ?? null,
                land_area:     mappedBuilding?.land_area     ?? null,
                building_area: mappedBuilding?.building_area ?? null,
                total_area:    mappedBuilding?.total_area    ?? null,
                floors_above:  mappedBuilding?.floors_above  ?? null,
                floors_below:  mappedBuilding?.floors_below  ?? null,
                parking_count: mappedBuilding?.parking_count ?? null,
                elevator:      mappedBuilding?.elevator      ?? false,
              })
              .eq("property_id", pid).select().single();
            if (updated) buildingData = { ...updated, _raw: rawWithStatus };
          } else {
            const { data: inserted } = await supabase
              .from("building_summary")
              .insert({
                property_id:   pid,
                building_name: mappedBuilding?.building_name ?? null,
                main_purpose:  mappedBuilding?.main_purpose  ?? null,
                approval_date: mappedBuilding?.approval_date ?? null,
                land_area:     mappedBuilding?.land_area     ?? null,
                building_area: mappedBuilding?.building_area ?? null,
                total_area:    mappedBuilding?.total_area    ?? null,
                floors_above:  mappedBuilding?.floors_above  ?? null,
                floors_below:  mappedBuilding?.floors_below  ?? null,
                parking_count: mappedBuilding?.parking_count ?? null,
                elevator:      mappedBuilding?.elevator      ?? false,
              })
              .select().single();
            if (inserted) buildingData = { ...inserted, _raw: rawWithStatus };
            console.log("✅ [건축물대장 저장 완료]");
          }

          // ── approval_date / elevator 동기화 (신규 저장 시에만) ──────
          if (needBuildingSave && mappedBuilding?.approval_date && pid) {
            const approvalYear = mappedBuilding.approval_date.substring(0, 4);
            const { data: propRow } = await supabase
              .from("properties").select("build_year").eq("id", pid).maybeSingle();
            if (propRow && (!propRow.build_year || propRow.build_year.trim() === "")) {
              await supabase
                .from("properties")
                .update({ build_year: approvalYear })
                .eq("id", pid);
              console.log(`✅ [build_year 동기화] properties.build_year = ${approvalYear}`);
            }
          }

          if (needBuildingSave && mappedBuilding && pid) {
            const apiElev = mappedBuilding.elevator;
            const { data: propRow2 } = await supabase
              .from("properties").select("elevator, build_year").eq("id", pid).maybeSingle();
            if (propRow2 && propRow2.elevator !== apiElev) {
              await supabase
                .from("properties")
                .update({ elevator: apiElev })
                .eq("id", pid);
              console.log(`✅ [elevator 동기화] properties.elevator = ${apiElev} (${mappedBuilding._raw?.elevatorDetail})`);
            }
          }
        } // end if (needBuilding)

        // ── 3b. 토지 조회 — 전량 land-proxy(국내 프록시)에 위임 ──────────────
        // 흐름: property-summary → land-proxy → LAND_PROXY_URL(국내 프록시) → NSDI/VWorld
        // property-summary 내부에는 NSDI 직접 호출 코드가 없음
        if (needLand && pnu) {
          console.log("\n🌍 [토지 조회 시작 → land-proxy에 전량 위임]");
          console.log(`  📍 PNU  : ${pnu} (${pnu.length}자리) ${pnu.length === 19 ? "✅" : "❌"}`);
          console.log(`  📮 주소 : ${propertyAddress}`);
          console.log(`  1️⃣  bun : ${bun}`);
          console.log(`  2️⃣  ji  : ${ji}`);

          let officialPrice: string | null = null;
          let landCategory:  string | null = null;
          let landArea:      string | null = null;
          let useZone:       string | null = null;
          let landKeyError   = false;
          let landConnError  = false;
          const landDiagnostics: Record<string, unknown> = {};

          try {
            const landProxyUrl = `${supabaseUrl}/functions/v1/land-proxy`;
            console.log(`\n🌐 [land-proxy] 호출`);
            console.log(`  - endpoint : ${landProxyUrl}`);

            const landRes = await fetch(landProxyUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseKey}`,
                "apikey": supabaseKey,
              },
              // address, bun, ji, pnu 전달 — NSDI/VWorld 호출은 land-proxy가 전담
              body: JSON.stringify({
                pnu,
                property_id: pid,
                address: propertyAddress,
                bun,
                ji,
              }),
              signal: AbortSignal.timeout(30000),
            });

            const landText = await landRes.text();
            console.log(`  - HTTP status: ${landRes.status}`);
            console.log(`  - raw(400)   : ${landText.substring(0, 400)}`);

            if (landRes.ok) {
              let landJson: any = null;
              try { landJson = JSON.parse(landText); } catch { /* 파싱 오류 무시 */ }

              if (landJson) {
                // 응답 구조: { land: { area, jimok, zone, price, pnu }, _verdict, ... }
                const lObj    = landJson.land ?? null;
                const verdict = landJson._verdict ?? "unknown";

                if (landJson._key_error)        landKeyError  = true;
                if (landJson._land_conn_error)   landConnError = true;
                if (landJson._all_years_no_data) landDiagnostics.all_years_no_data = true;

                if (lObj) {
                  officialPrice = lObj.price ?? null;
                  landCategory  = lObj.jimok ?? null;
                  landArea      = lObj.area  ?? null;
                  useZone       = lObj.zone  ?? null;
                }

                console.log(`\n🌍 토지 응답 — property-summary 수신`);
                console.log(JSON.stringify({ land: lObj, _verdict: verdict }, null, 2));

                if (verdict === "success") {
                  console.log(`  ✅ 토지 조회 성공 | 공시지가: ${officialPrice} | 지목: ${landCategory}`);
                } else if (landJson._all_years_no_data) {
                  console.log(`  📭 3개 연도(2025·2024·2026) 모두 데이터 없음`);
                } else if (landConnError) {
                  console.log(`  🔌 연결 실패 — LAND_PROXY_URL 국내 프록시 설정 필요`);
                } else {
                  console.log(`  ⚠️  토지 조회 실패 (verdict=${verdict})`);
                }
              }
            } else {
              console.log(`  🔌 [land-proxy] HTTP ${landRes.status} — 연결 실패`);
              landConnError = true;
            }
          } catch (e) {
            const errMsg    = String(e);
            const isConnErr = errMsg.includes("connection closed") || errMsg.includes("timed out") || errMsg.includes("AbortError");
            console.log(`  ${isConnErr ? "🔌" : "❌"} [land-proxy] 호출 오류: ${errMsg.substring(0, 200)}`);
            if (isConnErr) landConnError = true;
          }

          // ── 진단 플래그 정리 ────────────────────────────────────────────
          if (landKeyError)  landDiagnostics.land_key_error  = true;
          if (landConnError) landDiagnostics.land_conn_error = true;
          if (!officialPrice && !landKeyError && !landConnError) landDiagnostics.land_no_data = true;

          console.log("💰 [공시지가 최종]:", officialPrice ?? "(없음)");
          console.log("🌱 [토지특성 최종]:", { landCategory, landArea, useZone });
          if (landConnError) console.log("🔌 LAND_PROXY_URL 시크릿에 국내 프록시 URL을 설정하세요");

          // ── DB 저장 ────────────────────────────────────────────────────
          const dongName = propertyAddress.match(/([가-힣]+동|[가-힣]+면|[가-힣]+읍)/)?.[1] || "";
          const lotStr   = `${dongName} ${bun.replace(/^0+/, "") || "0"}-${ji.replace(/^0+/, "") || "0"}`.trim();

          if (skipDbWrite) {
            landData = {
              property_id: null,
              lot_number: lotStr,
              official_price: officialPrice,
              land_category: landCategory,
              land_area: landArea,
              use_zone: useZone,
              road_access: null,
              _diagnostics: landDiagnostics,
            };
            console.log("✅ [토지] 비등록 매물 — 메모리 응답");
          } else if (landData) {
            const { data: updated } = await supabase
              .from("land_summary")
              .update({
                official_price: officialPrice ?? (landData as any).official_price,
                land_category:  landCategory  ?? (landData as any).land_category,
                land_area:      landArea      ?? (landData as any).land_area,
                use_zone:       useZone       ?? (landData as any).use_zone,
                road_access:    null,
              })
              .eq("property_id", pid).select().single();
            if (updated) landData = { ...updated, _diagnostics: landDiagnostics };
          } else {
            const { data: inserted } = await supabase
              .from("land_summary")
              .insert({
                property_id:    pid,
                lot_number:     lotStr,
                official_price: officialPrice ?? null,
                land_category:  landCategory  ?? null,
                land_area:      landArea      ?? null,
                use_zone:       useZone       ?? null,
                road_access:    null,
              })
              .select().single();
            if (inserted) landData = { ...inserted, _diagnostics: landDiagnostics };
          }
          console.log("✅ [토지 정보 저장 완료]");

        } else if (needLand && !pnu) {
          console.log("⚠️ [PNU 생성 실패] 법정동코드 없음 → 토지 조회 불가");
          if (!skipDbWrite && !landData) {
            const { data: inserted } = await supabase.from("land_summary")
              .insert({ property_id: pid, lot_number: null, land_category: null, land_area: null, official_price: null, use_zone: null, road_access: null })
              .select().single();
            if (inserted) landData = inserted;
          }
        }
      } else {
        console.log("⚠️ [주소 파싱 실패] 시군구:", sigunguCd, "| 법정동:", bjdongCd);
        if (!skipDbWrite && needBuilding) {
          const { data: inserted } = await supabase.from("building_summary")
            .insert({ property_id: pid, building_name: null, main_purpose: null, approval_date: null, land_area: null, building_area: null, total_area: null, floors_above: null, floors_below: null, parking_count: null, elevator: false })
            .select().single();
          if (inserted) buildingData = inserted;
        }
        if (!skipDbWrite && !landData) {
          const { data: inserted } = await supabase.from("land_summary")
            .insert({ property_id: pid, lot_number: null, land_category: null, land_area: null, official_price: null, use_zone: null, road_access: null })
            .select().single();
          if (inserted) landData = inserted;
        }
      }
    }

    // ── 4. 최종 응답 ─────────────────────────────────────────────────
    const result = {
      property_id:      pid,
      address:          propertyAddress ?? address,
      building_summary: buildingData ?? null,
      land_summary:     landData     ?? null,
      has_building:     buildingData !== null,
      has_land:         landData     !== null,
      data_source:      dataGoKrApiKey ? "data.go.kr" : "fallback",
    };

    console.log("📤 [응답]:", {
      has_building:          result.has_building,
      has_land:              result.has_land,
      building_main_purpose: (result.building_summary as any)?.main_purpose,
      official_price:        (result.land_summary as any)?.official_price,
    });
    console.log("✅ [property-summary] 완료");

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("❌ [property-summary] 오류:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
