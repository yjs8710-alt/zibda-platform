const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function searchKakao(query: string, apiKey: string): Promise<any[]> {
  // analyze_type=exact 우선 시도 → 결과 없으면 similar 폴백
  for (const analyze of ["exact", "similar"]) {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?analyze_type=${analyze}&size=10&query=${encodeURIComponent(query)}`;
    console.log("[geocode] Trying:", url);
    const res = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${apiKey}`,
        "KA": "sdk/1.0.0 os/web origin/https://lovable.app",
      },
    });
    if (!res.ok) continue;
    const data = await res.json();
    if (data?.documents?.length > 0) return data.documents as any[];
  }
  return [];
}

/** 입력 주소에서 핵심 토큰 추출 */
function extractKeyTokens(addr: string) {
  const dongMatch = addr.match(/([가-힣]+(?:동|읍|면))\s*([\d-]+)?/);
  const roadMatch = addr.match(/([가-힣0-9]+(?:로|길))\s*([\d-]+)/);
  const guMatch = addr.match(/([가-힣]+구)/);
  return {
    dong: dongMatch?.[1] ?? "",
    bunji: dongMatch?.[2] ?? roadMatch?.[2] ?? "",
    road: roadMatch?.[1] ?? "",
    gu: guMatch?.[1] ?? "",
  };
}

/** 후보 결과 중 입력 주소와 가장 잘 맞는 것 선택 */
function pickBestMatch(docs: any[], inputAddr: string) {
  if (!docs.length) return null;
  const tokens = extractKeyTokens(inputAddr);
  let best = docs[0];
  let bestScore = -Infinity;
  for (const doc of docs) {
    const jibun = doc.address?.address_name ?? "";
    const road = doc.road_address?.address_name ?? "";
    const combined = `${jibun} ${road}`;
    let score = 0;
    if (tokens.gu && combined.includes(tokens.gu)) score += 3;
    if (tokens.dong && combined.includes(tokens.dong)) score += 4;
    if (tokens.bunji) {
      const re = new RegExp(`(^|\\s|-)${tokens.bunji}(\\s|$|-|번)`);
      if (re.test(jibun) || re.test(road)) score += 5;
      else if (combined.includes(tokens.bunji)) score += 2;
    }
    if (tokens.road && combined.includes(tokens.road)) score += 2;
    if (combined.includes("청주")) score += 1;
    if (score > bestScore) { bestScore = score; best = doc; }
  }
  return best;
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── JWT 인증 검증 ────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
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
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const kakaoApiKey = Deno.env.get("KAKAO_API_KEY");
    console.log("[geocode] KAKAO_API_KEY loaded:", !!kakaoApiKey);

    if (!kakaoApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Kakao API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const address = body?.address?.trim();

    if (!address) {
      return new Response(
        JSON.stringify({ success: false, error: "address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 폴백 전략: 여러 형식으로 순차 검색
    // 1) 원본 주소 그대로
    // 2) "충북 " 제거 (충청북도 생략)
    // 3) "청주시 " 앞 다 제거 → "청주시 XX구 XX동 번지"
    // 4) "XX구 XX동 번지" 만
    const candidates: string[] = [address];

    // "충북 청주시 서원구 사창동 1396" → 앞부분 축약 시도
    const withoutChungbuk = address.replace(/^충북\s*/, "");
    if (withoutChungbuk !== address) candidates.push(withoutChungbuk);

    // "청주시 ..." 만 남기기
    const cheongJuMatch = address.match(/(청주시\s+.+)/);
    if (cheongJuMatch) {
      const shorter = cheongJuMatch[1];
      if (!candidates.includes(shorter)) candidates.push(shorter);
    }

    // 구+동+번지 만 남기기 (예: "서원구 사창동 1396")
    const guDongMatch = address.match(/([가-힣]+구\s+[가-힣]+동\s+[\d-]+)/);
    if (guDongMatch) {
      const shorter = guDongMatch[1];
      if (!candidates.includes(shorter)) candidates.push(shorter);
    }

    // 동+번지 만 남기기 (예: "사창동 1396")
    const dongMatch = address.match(/([가-힣]+동\s+[\d-]+)/);
    if (dongMatch) {
      const shorter = "청주시 " + dongMatch[1];
      if (!candidates.includes(shorter)) candidates.push(shorter);
    }

    // 도로명 주소 폴백: "XX로 123" 또는 "XX길 123" 패턴에 "청주시" 붙이기
    const roadMatch = address.match(/([가-힣0-9]+(?:로|길)\s*[\d-]+(?:번길\s*[\d-]+)?)/);
    if (roadMatch) {
      const roadOnly = roadMatch[1];
      if (!candidates.includes(roadOnly)) candidates.push(roadOnly);
      const withCity = "청주시 " + roadOnly;
      if (!candidates.includes(withCity)) candidates.push(withCity);
      const withFull = "충북 청주시 " + roadOnly;
      if (!candidates.includes(withFull)) candidates.push(withFull);
    }

    console.log("[geocode] Fallback candidates:", candidates);

    let first: any = null;
    for (const candidate of candidates) {
      const docs = await searchKakao(candidate, kakaoApiKey);
      if (docs.length > 0) {
        // 입력 원본 주소 기준으로 가장 잘 맞는 결과 선택
        first = pickBestMatch(docs, address) ?? docs[0];
        console.log("[geocode] Found result with query:", candidate, "→ chosen:",
          first?.address?.address_name ?? first?.road_address?.address_name);
        break;
      }
    }

    if (!first) {
      console.log("[geocode] No results for any candidate");
      return new Response(
        JSON.stringify({ success: false, error: "No results found for the given address" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lat = parseFloat(first.y);
    const lng = parseFloat(first.x);
    const roadAddress = first.road_address?.address_name ?? "";
    const jibunAddress = first.address?.address_name ?? "";

    console.log("[geocode] Success:", lat, lng);
    return new Response(
      JSON.stringify({ success: true, lat, lng, roadAddress, jibunAddress }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[geocode] Exception:", e);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
