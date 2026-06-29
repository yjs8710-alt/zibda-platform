const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function searchKakao(query: string, apiKey: string) {
  const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `KakaoAK ${apiKey}`,
      KA: "sdk/1.0.0 os/web origin/https://lovable.app",
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.documents?.length > 0 ? data.documents[0] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const kakaoApiKey = Deno.env.get("KAKAO_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!kakaoApiKey || !supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing env" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find ALL active properties that don't have 도로명 in their note
    const listRes = await fetch(
      `${supabaseUrl}/rest/v1/properties?status=eq.active&select=id,address,dong,lot_number,note,lat,lng&limit=500&order=created_at.desc`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    const allProps: {
      id: string;
      address: string;
      dong: string;
      lot_number: string;
      note: string | null;
      lat: number;
      lng: number;
    }[] = listRes.ok ? await listRes.json() : [];

    // Filter: only properties WITHOUT 도로명 in note, limit to 50 per run
    const needsRoad = allProps
      .filter((p) => !p.note || !/도로명[:\s]/.test(p.note))
      .slice(0, 50);

    console.log(
      `[convert] Total active: ${allProps.length}, needing road address: ${needsRoad.length}`
    );

    const results: {
      id: string;
      address: string;
      roadAddress: string;
      status: string;
    }[] = [];

    for (const prop of needsRoad) {
      try {
        // Use address for geocoding
        const searchQuery = prop.address;
        const result = await searchKakao(searchQuery, kakaoApiKey);

        if (!result) {
          // Try with dong + lot_number
          const fallback = `청주시 ${prop.dong} ${prop.lot_number}`;
          const result2 = await searchKakao(fallback, kakaoApiKey);
          if (!result2) {
            results.push({
              id: prop.id,
              address: prop.address,
              roadAddress: "",
              status: "not_found",
            });
            continue;
          }
          Object.assign(result, result2);
        }

        const roadAddress = result?.road_address?.address_name ?? "";

        if (!roadAddress) {
          results.push({
            id: prop.id,
            address: prop.address,
            roadAddress: "",
            status: "no_road",
          });
          continue;
        }

        // Append 도로명 to note
        const noteStr = prop.note ?? "";
        const newNote = [noteStr, `도로명: ${roadAddress}`]
          .filter(Boolean)
          .join("\n");

        // Also update lat/lng if missing
        const updates: Record<string, unknown> = { note: newNote };
        if (!prop.lat || !prop.lng) {
          const lat = parseFloat(result.y);
          const lng = parseFloat(result.x);
          if (lat && lng) {
            updates.lat = lat;
            updates.lng = lng;
          }
        }

        const updateRes = await fetch(
          `${supabaseUrl}/rest/v1/properties?id=eq.${prop.id}`,
          {
            method: "PATCH",
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify(updates),
          }
        );

        results.push({
          id: prop.id,
          address: prop.address,
          roadAddress,
          status: updateRes.ok ? "added" : "update_fail",
        });

        // Rate limit
        await new Promise((r) => setTimeout(r, 200));
      } catch (e) {
        results.push({
          id: prop.id,
          address: prop.address,
          roadAddress: "",
          status: `error: ${e}`,
        });
      }
    }

    const added = results.filter((r) => r.status === "added").length;
    console.log(`[convert] Done: ${added}/${needsRoad.length} road addresses added`);

    return new Response(
      JSON.stringify({ total: needsRoad.length, added, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[convert-road-to-jibun] error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
