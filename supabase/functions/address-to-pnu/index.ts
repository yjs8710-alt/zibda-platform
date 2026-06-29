/**
 * address-to-pnu — 주소를 19자리 PNU로 변환
 * 카카오 주소 API를 사용하여 법정동코드 + 번지를 추출하고 PNU를 생성합니다.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const address = body?.address?.trim();

    if (!address) {
      return new Response(
        JSON.stringify({ ok: false, error: "주소를 입력해주세요" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const kakaoKey = Deno.env.get("KAKAO_API_KEY");
    if (!kakaoKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "KAKAO_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[address-to-pnu] 주소:", address);

    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${kakaoKey}`,
        KA: "sdk/1.0.0 os/web origin/https://lovable.app",
      },
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();
    const doc = data?.documents?.[0];

    if (!doc?.address) {
      console.log("[address-to-pnu] 카카오 결과 없음");
      return new Response(
        JSON.stringify({ ok: false, error: "주소를 찾을 수 없습니다" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const addr = doc.address;
    const bCode = addr.b_code ?? "";

    if (bCode.length !== 10) {
      return new Response(
        JSON.stringify({ ok: false, error: `법정동코드 오류: ${bCode}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sigunguCd = bCode.substring(0, 5);
    const bjdongCd = bCode.substring(5, 10);
    const platGbCd = addr.mountain_yn === "Y" ? "1" : "0";
    const bun = String(addr.main_address_no ?? "0").padStart(4, "0");
    const ji = String(addr.sub_address_no ?? "0").padStart(4, "0");
    const pnu = `${sigunguCd}${bjdongCd}${platGbCd}${bun}${ji}`;

    console.log("[address-to-pnu] PNU:", pnu);

    return new Response(
      JSON.stringify({
        ok: true,
        pnu,
        address: addr.address_name ?? address,
        sigunguCd,
        bjdongCd,
        platGbCd,
        bun,
        ji,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[address-to-pnu] Error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
