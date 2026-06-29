/**
 * land-proxy — 토지대장 조회 전용 Edge Function
 *
 * 응답 구조:
 *   {
 *     land: {
 *       area:  string | null,   // 토지면적 (㎡)
 *       jimok: string | null,   // 지목
 *       zone:  string | null,   // 용도지역
 *       price: string | null,   // 공시지가
 *       pnu:   string           // 19자리 PNU
 *     }
 *   }
 *
 * 조회 경로:
 *   1. LAND_PROXY_URL 설정 시 → 국내 프록시 경유 (연도 재시도 포함)
 *   2. 미설정 시 → nsdi 직접 호출 (EU IP 차단 가능성 있음)
 *
 * stdrYear 재시도: 2025 → 2024 → 2026
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── 엔드포인트 상수 ────────────────────────────────────────────────────────
const NSDI_LAND_PRICE_URL = "https://apis.data.go.kr/1611000/nsdi/IndvdLandPriceService/wfs/getIndvdLandPrice";
const NSDI_LAND_CHAR_URL  = "https://apis.data.go.kr/1611000/nsdi/LandUseService/wfs/getLandUse";

// ── 연도 재시도 순서 ────────────────────────────────────────────────────────
const YEAR_RETRY_ORDER = [2025, 2024, 2026];

// ── 내부 판정 타입 ─────────────────────────────────────────────────────────
type LandVerdict =
  | "success"
  | "no_data"
  | "key_error"
  | "land_conn_error"
  | "unexpected_error"
  | "parse_error";

interface LandRaw {
  area:    string | null;
  jimok:   string | null;
  zone:    string | null;
  price:   string | null;
  pnu:     string;
  verdict: LandVerdict;
  // 진단 플래그
  key_error:         boolean;
  land_conn_error:   boolean;
  land_no_data:      boolean;
  all_years_no_data: boolean;
  stdrYear_used:     string | null;
  proxy_used:        "domestic" | "direct_fallback" | "none";
}

const emptyRaw = (
  pnu: string,
  verdict: LandVerdict,
  opts: {
    key_error?: boolean;
    land_conn_error?: boolean;
    land_no_data?: boolean;
    all_years_no_data?: boolean;
  } = {}
): LandRaw => ({
  area:  null,
  jimok: null,
  zone:  null,
  price: null,
  pnu,
  verdict,
  key_error:         opts.key_error          ?? false,
  land_conn_error:   opts.land_conn_error    ?? false,
  land_no_data:      opts.land_no_data       ?? false,
  all_years_no_data: opts.all_years_no_data  ?? false,
  stdrYear_used:     null,
  proxy_used:        "none",
});

// ── 국내 프록시를 통한 토지 조회 ──────────────────────────────────────────
async function callDomesticProxy(
  proxyUrl: string,
  pnu: string,
  apiKey: string,
  stdrYear: string
): Promise<LandRaw> {
  console.log(`\n🌏 [국내 프록시] 호출 시작`);
  console.log(`  - endpoint: ${proxyUrl}`);
  console.log(`  - pnu     : ${pnu}`);
  console.log(`  - stdrYear: ${stdrYear}`);

  try {
    const res = await fetch(proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pnu, apiKey, stdrYear }),
      signal: AbortSignal.timeout(15000),
    });

    const httpS = res.status;
    const text  = await res.text();
    console.log(`  - HTTP status: ${httpS}`);
    console.log(`  - raw(400): ${text.substring(0, 400)}`);

    if (!res.ok) {
      console.log(`  - 판정: unexpected_error (HTTP ${httpS})`);
      return emptyRaw(pnu, "unexpected_error");
    }

    let data: any = null;
    try { data = JSON.parse(text); } catch {
      console.log(`  - 판정: parse_error`);
      return emptyRaw(pnu, "parse_error");
    }

    if (data.key_error)        return emptyRaw(pnu, "key_error",       { key_error: true });
    if (data.land_conn_error)  return emptyRaw(pnu, "land_conn_error", { land_conn_error: true });

    if (data.official_price || data.land_category || data.land_area) {
      console.log(`  - 판정: success (공시지가: ${data.official_price})`);
      return {
        area:    data.land_area       ?? null,
        jimok:   data.land_category   ?? null,
        zone:    data.use_zone        ?? null,
        price:   data.official_price  ?? null,
        pnu,
        verdict:           "success",
        key_error:         false,
        land_conn_error:   false,
        land_no_data:      false,
        all_years_no_data: false,
        stdrYear_used:     stdrYear,
        proxy_used:        "domestic",
      };
    }

    console.log(`  - 판정: land_no_data (프록시 데이터 없음)`);
    return emptyRaw(pnu, "no_data", { land_no_data: true });
  } catch (e) {
    const errMsg    = String(e);
    const isConnErr = errMsg.includes("connection closed") || errMsg.includes("fetch failed") ||
                      errMsg.includes("timed out") || errMsg.includes("AbortError") ||
                      errMsg.includes("ECONNRESET");
    console.log(`\n${isConnErr ? "🔌" : "❌"} [국내 프록시] ${isConnErr ? "연결 실패" : "오류"}`);
    console.log(`  - 원인: ${errMsg.substring(0, 300)}`);
    return emptyRaw(pnu, isConnErr ? "land_conn_error" : "unexpected_error", {
      land_conn_error: isConnErr,
    });
  }
}

// ── nsdi 단일 연도 호출 (공시지가) ──────────────────────────────────────────
async function callNsdiOnce(pnu: string, apiKey: string, stdrYear: string): Promise<LandRaw> {
  const encodedKey = encodeURIComponent(apiKey);
  const keyMasked  = apiKey.substring(0, 8) + "***";

  const priceParams = new URLSearchParams({
    pnu,
    stdrYear,
    numOfRows: "1",
    pageNo: "1",
    _type: "json",
  });
  const priceUrl = `${NSDI_LAND_PRICE_URL}?serviceKey=${encodedKey}&${priceParams}`;

  console.log(`\n🌐 [nsdi] 호출 시작`);
  console.log(`  - pnu            : ${pnu} (${pnu.length}자리${pnu.length === 19 ? " ✅" : " ❌"})`);
  console.log(`  - stdrYear       : ${stdrYear}`);
  console.log(`  - serviceKey     : ${keyMasked}`);

  try {
    const res    = await fetch(priceUrl, { signal: AbortSignal.timeout(12000) });
    const httpS  = res.status;
    const text   = await res.text();
    const raw600 = text.substring(0, 600);
    const hasIncorrectKey = text.includes("INCORRECT_KEY") || text.includes("SERVICE_KEY_IS_NOT_REGISTERED_ERROR");

    console.log(`\n✅ [nsdi] 응답 수신`);
    console.log(`  - HTTP status: ${httpS}`);
    console.log(`  - INCORRECT_KEY: ${hasIncorrectKey ? "⚠️ YES" : "NO"}`);
    console.log(`  - raw 일부: ${raw600}`);

    const trimmed = text.trim();
    if (trimmed === "Unexpected errors" || trimmed.startsWith("Unexpected") || trimmed === "API not found") {
      console.log(`  - 판정: unexpected_error`);
      return emptyRaw(pnu, "unexpected_error");
    }

    let data: any = null;
    try { data = JSON.parse(text); } catch {
      console.log(`  - 판정: parse_error`);
      return emptyRaw(pnu, "parse_error");
    }

    // KEY 오류 감지
    const errorCode   = data?.error?.errorCode ?? null;
    const statusField = data?.status ?? null;
    const authErrMsg  = data?.OpenAPI_ServiceResponse?.cmmMsgHeader?.errMsg ?? "";
    const authRtCode  = data?.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnReasonCode ?? "";
    const isKeyErr = hasIncorrectKey || errorCode === "INCORRECT_KEY" || statusField === "INVALID_KEY"
      || authRtCode === "30" || authErrMsg.includes("SERVICE KEY IS NOT REGISTERED")
      || (statusField === "ERROR" && text.includes("KEY"));

    if (isKeyErr) {
      console.log(`  - 판정: key_error`);
      return emptyRaw(pnu, "key_error", { key_error: true });
    }

    const header     = data?.response?.header ?? {};
    const body       = data?.response?.body   ?? {};
    const totalCount = Number(body?.totalCount ?? 0);

    console.log(`  - resultCode: ${header?.resultCode ?? "N/A"}`);
    console.log(`  - totalCount: ${totalCount}`);

    if (totalCount === 0) {
      console.log(`  - 판정: no_data (stdrYear=${stdrYear})`);
      return emptyRaw(pnu, "no_data", { land_no_data: true });
    }

    const rawItem = body?.items?.item;
    const items   = rawItem ? (Array.isArray(rawItem) ? rawItem : [rawItem]) : [];
    if (items.length > 0) {
      const it    = items[0];
      const priceVal = Number(it?.pblntfPclnd ?? 0);
      if (priceVal > 0) {
        const usedYear = it?.stdrYear ?? it?.stdrYr ?? stdrYear;
        const out: LandRaw = {
          area:    it.lndpclAr  ? `${Number(it.lndpclAr).toFixed(1)}㎡` : null,
          jimok:   it.lndcgrCodeNm || null,
          zone:    it.prposArea1Nm || it.prposArea2Nm || null,
          price:   `${priceVal.toLocaleString("ko-KR")}원/㎡ (${usedYear}년 기준)`,
          pnu,
          verdict:           "success",
          key_error:         false,
          land_conn_error:   false,
          land_no_data:      false,
          all_years_no_data: false,
          stdrYear_used:     usedYear,
          proxy_used:        "direct_fallback",
        };
        console.log(`  - 판정: success (공시지가: ${out.price})`);
        return out;
      }
    }

    return emptyRaw(pnu, "no_data", { land_no_data: true });
  } catch (e) {
    const errMsg    = String(e);
    const isConnErr = errMsg.includes("connection closed") || errMsg.includes("SendRequest") ||
                      errMsg.includes("socket hang up") || errMsg.includes("fetch failed") ||
                      errMsg.includes("ECONNRESET") || errMsg.includes("timed out") ||
                      errMsg.includes("AbortError");

    console.log(`\n${isConnErr ? "🔌" : "❌"} [nsdi] ${isConnErr ? "연결 실패" : "응답 오류"}`);
    console.log(`  - stdrYear: ${stdrYear}`);
    console.log(`  - 원인    : ${errMsg.substring(0, 300)}`);
    return emptyRaw(pnu, isConnErr ? "land_conn_error" : "unexpected_error", {
      land_conn_error: isConnErr,
    });
  }
}

// ── nsdi 연도 재시도 (2025 → 2024 → 2026) ───────────────────────────────
async function callNsdiFallbackWithRetry(pnu: string, apiKey: string): Promise<LandRaw> {
  console.log(`\n⚠️  [nsdi 직접 호출 — 연도 재시도: ${YEAR_RETRY_ORDER.join(" → ")}]`);

  const trialLog: string[] = [];
  let lastConnError: LandRaw | null = null;
  let keyError: LandRaw | null = null;

  for (const year of YEAR_RETRY_ORDER) {
    const stdrYear = String(year);
    console.log(`\n──────────── stdrYear=${stdrYear} 시도 ────────────`);

    const result = await callNsdiOnce(pnu, apiKey, stdrYear);
    trialLog.push(`  ${YEAR_RETRY_ORDER.indexOf(year) + 1}) stdrYear=${stdrYear} → ${result.verdict}`);

    if (result.verdict === "success") {
      console.log(`\n✅ [연도 재시도] stdrYear=${stdrYear} 성공`);
      trialLog.forEach(l => console.log(l));
      return result;
    }
    if (result.verdict === "key_error") { keyError = result; break; }
    if (result.verdict === "land_conn_error" || result.verdict === "unexpected_error") {
      lastConnError = result;
    }
  }

  trialLog.forEach(l => console.log(l));

  if (keyError) return keyError;
  if (lastConnError) return lastConnError;

  console.log(`\n📭 [nsdi] 3개 연도 모두 데이터 없음`);
  return emptyRaw(pnu, "no_data", { land_no_data: true, all_years_no_data: true });
}

// ── 토지특성 nsdi (지목·면적·용도지역 보완) ────────────────────────────────
async function callNsdiCharFallback(pnu: string, apiKey: string): Promise<{
  jimok:  string | null;
  area:   string | null;
  zone:   string | null;
} | null> {
  const encodedKey = encodeURIComponent(apiKey);
  const params     = new URLSearchParams({ pnu, numOfRows: "1", pageNo: "1", _type: "json" });
  const url        = `${NSDI_LAND_CHAR_URL}?serviceKey=${encodedKey}&${params}`;

  console.log(`\n🌐 [nsdi 토지특성] 호출`);
  console.log(`  - pnu: ${pnu}`);

  try {
    const res  = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const text = await res.text();

    const trimmed = text.trim();
    if (trimmed === "Unexpected errors" || trimmed.startsWith("Unexpected")) {
      console.log(`  - 판정: unexpected_error`);
      return null;
    }

    let data: any = null;
    try { data = JSON.parse(text); } catch { return null; }

    const body       = data?.response?.body ?? {};
    const totalCount = Number(body?.totalCount ?? 0);
    console.log(`  - totalCount: ${totalCount}`);
    if (totalCount === 0) return null;

    const rawItem = body?.items?.item;
    const items   = rawItem ? (Array.isArray(rawItem) ? rawItem : [rawItem]) : [];
    if (items.length > 0) {
      const it = items[0];
      console.log(`  - 지목: ${it.lndcgrCodeNm ?? "없음"}`);
      return {
        jimok: it.lndcgrCodeNm || null,
        area:  it.lndpclAr ? `${Number(it.lndpclAr).toFixed(1)}㎡` : null,
        zone:  it.prposArea1Nm || it.prposArea2Nm || null,
      };
    }
    return null;
  } catch (e) {
    console.log(`  - 오류: ${String(e).substring(0, 200)}`);
    return null;
  }
}

// ── 메인 핸들러 ───────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const _userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: _claimsData, error: _claimsErr } = await _userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (_claimsErr || !_claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { pnu, property_id, stdrYear, address, bun, ji } = body;

    console.log(`\n🌍 [land-proxy] 토지 조회 요청`);
    console.log(`  - pnu        : ${pnu ?? "(없음)"}`);
    console.log(`  - address    : ${address ?? "(없음)"}`);
    console.log(`  - bun        : ${bun ?? "(없음)"}`);
    console.log(`  - ji         : ${ji ?? "(없음)"}`);
    console.log(`  - property_id: ${property_id ?? "(없음)"}`);
    console.log(`  - stdrYear   : ${stdrYear ?? "(미전달 — 연도 재시도 모드)"}`);

    if (!pnu || pnu.length !== 19) {
      console.log(`  ❌ pnu 오류: "${pnu}" (${pnu?.length ?? 0}자리)`);
      return new Response(
        JSON.stringify({ error: "pnu가 없거나 19자리가 아닙니다", pnu }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey   = Deno.env.get("DATA_GO_KR_API_KEY")?.trim() ?? "";
    const proxyUrl = Deno.env.get("LAND_PROXY_URL")?.trim();

    console.log(`  - apiKey 존재  : ${!!apiKey}`);
    console.log(`  - LAND_PROXY_URL: ${proxyUrl ? `✅ 설정됨` : "❌ 미설정 (nsdi fallback 사용)"}`);

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "DATA_GO_KR_API_KEY가 설정되지 않았습니다" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 연도 재시도 순서
    const yearsToTry = stdrYear
      ? [stdrYear, ...YEAR_RETRY_ORDER.map(String).filter(y => y !== stdrYear)]
      : YEAR_RETRY_ORDER.map(String);

    let raw: LandRaw;

    if (proxyUrl) {
      // ── 국내 프록시 우선 호출 ──────────────────────────────────────────
      console.log(`\n🌐 [land-proxy] 국내 프록시 호출 시작 (연도 재시도: ${yearsToTry.join(" → ")})`);

      let proxyResult: LandRaw | null = null;
      const proxyTrialLog: string[] = [];

      for (const year of yearsToTry) {
        console.log(`\n──────────── 국내 프록시 stdrYear=${year} 시도 ────────────`);
        const r = await callDomesticProxy(proxyUrl, pnu, apiKey, year);
        proxyTrialLog.push(`  ${yearsToTry.indexOf(year) + 1}) stdrYear=${year} → ${r.verdict}`);

        if (r.verdict === "success") { proxyResult = r; break; }
        if (r.verdict === "key_error") { proxyResult = r; break; }
        if (!proxyResult) proxyResult = r;
      }

      console.log(`\n📋 [국내 프록시 연도별 시도 결과]`);
      proxyTrialLog.forEach(l => console.log(l));

      if (proxyResult?.verdict === "success" || proxyResult?.verdict === "key_error") {
        raw = proxyResult;
      } else {
        // 프록시 실패 → nsdi fallback
        console.log(`\n🔌 [land-proxy] 국내 프록시 모두 실패 → nsdi fallback`);
        const fallback = await callNsdiFallbackWithRetry(pnu, apiKey);
        raw = fallback.verdict === "success" ? fallback : (proxyResult ?? fallback);
      }
    } else {
      // ── 프록시 미설정: nsdi 직접 호출 ────────────────────────────────
      console.log(`\n⚠️  [land-proxy] LAND_PROXY_URL 미설정 → nsdi 직접 호출`);

      const [priceResult, charResult] = await Promise.all([
        callNsdiFallbackWithRetry(pnu, apiKey),
        callNsdiCharFallback(pnu, apiKey),
      ]);

      raw = priceResult;

      // 토지특성 병합 (지목·면적·용도지역)
      if (charResult) {
        if (!raw.jimok && charResult.jimok) raw.jimok = charResult.jimok;
        if (!raw.area  && charResult.area)  raw.area  = charResult.area;
        if (!raw.zone  && charResult.zone)  raw.zone  = charResult.zone;
      }
    }

    // ── 표준 응답 구조로 변환 ─────────────────────────────────────────
    const landObj = {
      area:  raw.area,
      jimok: raw.jimok,
      zone:  raw.zone,
      price: raw.price,
      pnu,
    };

    const response = {
      land: landObj,
      // 진단 플래그 (프론트에서도 오류 배지 표시에 사용)
      _verdict:           raw.verdict,
      _key_error:         raw.key_error,
      _land_conn_error:   raw.land_conn_error,
      _land_no_data:      raw.land_no_data,
      _all_years_no_data: raw.all_years_no_data,
      _stdrYear_used:     raw.stdrYear_used,
      _proxy_used:        raw.proxy_used,
    };

    console.log(`\n🌍 토지 응답 — 최종 결과`);
    console.log(JSON.stringify(response, null, 2));
    console.log(`\n📊 [land-proxy 판정 요약]`);
    console.log(`  - verdict    : ${raw.verdict}`);
    console.log(`  - area       : ${landObj.area}`);
    console.log(`  - jimok      : ${landObj.jimok}`);
    console.log(`  - zone       : ${landObj.zone}`);
    console.log(`  - price      : ${landObj.price}`);
    console.log(`  - pnu        : ${landObj.pnu}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("❌ [land-proxy] 오류:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
