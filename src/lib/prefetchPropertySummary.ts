/**
 * 매물 등록/수정 후 건축물대장·토지대장을 백그라운드로 자동 조회하여 DB에 캐싱.
 * - building_summary, land_summary 테이블에 저장
 * - properties.build_year, elevator 동기화
 * - 이후 공적장부 열람 시 즉시 표시 가능
 */

import { supabase } from "@/integrations/supabase/client";

export async function prefetchPropertySummary(
  address: string,
  propertyId: string,
): Promise<void> {
  if (!address || !propertyId) return;

  try {
    console.log("🔄 [자동 조회] 건축물·토지대장 백그라운드 캐싱 시작:", address);

    const { data, error } = await supabase.functions.invoke("property-summary", {
      body: { address, property_id: propertyId },
    });

    if (!error && data) {
      const hasBldg = !!data.building_summary;
      const hasLand = !!data.land_summary;
      console.log(`✅ [자동 조회] 완료 — 건축물: ${hasBldg ? "✓" : "✗"}, 토지: ${hasLand ? "✓" : "✗"}`);
    } else {
      console.warn("⚠️ [자동 조회] 실패:", error);
    }
  } catch (e) {
    console.warn("⚠️ [자동 조회] 예외:", e);
  }
}
