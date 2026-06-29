import { useState, useEffect, useRef } from "react";
import { X, Layers, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { mapBuildingFromDB, formatUnitCount, pickPrimaryCountKey } from "@/lib/buildingUtils";
import FloorGrid from "@/components/FloorGrid";

/* ── 모듈 레벨 캐시: 동일 주소 재조회 시 API 호출 방지 ── */
interface CachedRecord {
  building: Record<string, any> | null;
  land: Record<string, any> | null;
  fetchedFrom: "db" | "api" | null;
}
const recordCache = new Map<string, CachedRecord>();
const getCacheKey = (address: string, propertyId?: string) =>
  `${propertyId ?? ""}::${address}`;

interface PublicRecordModalProps {
  address: string;
  propertyId?: string; // DB UUID (dbId)
  onClose: () => void;
}

function TRow({
  l1,
  v1,
  l2,
  v2,
  highlight,
}: {
  l1: string;
  v1?: string | null;
  l2?: string;
  v2?: string | null;
  highlight?: boolean;
}) {
  return (
    <tr className="border-b border-border/40">
      <td className="py-1.5 px-2 text-[10px] text-muted-foreground font-medium bg-muted/30 w-[64px] sm:w-[80px] align-top break-words border-r border-border/30">
        {l1}
      </td>

      <td
        className={`py-1.5 px-2 text-[11px] font-semibold border-r border-border/30 align-top break-words ${
          highlight ? "text-red-600" : "text-foreground"
        }`}
      >
        {v1 ?? "-"}
      </td>

      {l2 !== undefined ? (
        <>
          <td className="py-1.5 px-2 text-[10px] text-muted-foreground font-medium bg-muted/30 w-[64px] sm:w-[80px] align-top break-words border-r border-border/30">
            {l2}
          </td>
          <td
            className={`py-1.5 px-2 text-[11px] font-semibold align-top break-words ${
              highlight ? "text-red-600" : "text-foreground"
            }`}
          >
            {v2 ?? "-"}
          </td>
        </>
      ) : (
        <td colSpan={2} />
      )}
    </tr>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
      <span className="w-[90px] flex-shrink-0 text-[11px] text-muted-foreground font-medium leading-tight pt-0.5">
        {label}
      </span>
      <span className="text-[11px] font-semibold text-foreground leading-tight flex-1">{value ?? "-"}</span>
    </div>
  );
}

function SectionHeader({ title, bg }: { emoji?: string; title: string; bg: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border" style={{ background: bg }}>
      <span className="text-[16px] font-extrabold text-foreground">{title}</span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0 animate-pulse">
      <div className="w-[90px] h-3 bg-muted rounded" />
      <div className="flex-1 h-3 bg-muted/70 rounded" />
    </div>
  );
}

const hasVal = (v: unknown) => {
  if (v == null || v === "") return false;
  const s = String(v).trim();
  return s !== "" && s !== "-" && s !== "--" && s !== "조회 결과 없음";
};

const buildingDetailKeyFields = [
  "mainPurpsCdNm",
  "strctCdNm",
  "archArea",
  "totArea",
  "useAprDay",
  "grndFlrCnt",
  "bcRat",
  "vlRat",
  "platPlc",
  "newPlatPlc",
];

const toDisplayText = (v: unknown) => {
  if (v == null || v === "") return null;
  const trimmed = String(v).trim();
  return trimmed === "" || trimmed === "-" || trimmed === "--" || trimmed === "조회 결과 없음" ? null : trimmed;
};

const getBuildingLabel = (bldg: Record<string, any>) => toDisplayText(bldg?.dongNm) || toDisplayText(bldg?.bldNm) || "";

/** recap(총괄표제부)에서 건물명 추출 */
const getRecapBuildingName = (raw: Record<string, any> | null) => {
  if (!raw?.recap || typeof raw.recap !== "object") return null;
  return toDisplayText((raw.recap as Record<string, any>).bldNm) || null;
};
const getBuildingDetailScore = (bldg: Record<string, any>) =>
  buildingDetailKeyFields.filter((field) => toDisplayText(bldg?.[field])).length;

/** 의미 있는 데이터가 있는 건물인지 (빈 레코드 제외) */
const hasMeaningfulData = (bldg: Record<string, any>) => {
  const label = getBuildingLabel(bldg);
  const score = getBuildingDetailScore(bldg);
  const hasExpos = Array.isArray(bldg.exposFloors) && bldg.exposFloors.length > 0;
  return (!!label && score > 0) || hasExpos;
};

const sortBuildingsByLabel = (buildings: Array<Record<string, any>>) =>
  [...buildings].sort((a, b) => getBuildingLabel(a).localeCompare(getBuildingLabel(b), "ko"));

/** 모든 동을 반환 (빈 레코드만 제외, 의미 없는 "건축물" 레이블 탭 제거) */
const getDetailedBuildingCandidates = (buildings: Array<Record<string, any>>) => {
  const filtered = sortBuildingsByLabel(buildings.filter(hasMeaningfulData));
  if (filtered.length > 0) {
    // 구체적인 동/건물명이 있는 탭이 1개 이상이면, 라벨이 빈 문자열이거나 "건축물"인 제네릭 탭 제거
    const named = filtered.filter((b) => {
      const lbl = getBuildingLabel(b);
      return lbl && lbl !== "건축물";
    });
    if (named.length > 0) return named;
    return filtered;
  }

  const fallback = [...buildings]
    .filter((bldg) => getBuildingDetailScore(bldg) > 0)
    .sort((a, b) => getBuildingDetailScore(b) - getBuildingDetailScore(a));

  return fallback.length > 0 ? [fallback[0]] : [];
};

const mergeSummary = (
  dbData: Record<string, any> | null,
  apiData: Record<string, any> | null,
): Record<string, any> | null => {
  if (!dbData && !apiData) return null;
  if (!dbData) return apiData;
  if (!apiData) return dbData;

  const dbRaw = dbData._raw && typeof dbData._raw === "object" ? (dbData._raw as Record<string, any>) : {};

  const apiRaw = apiData._raw && typeof apiData._raw === "object" ? (apiData._raw as Record<string, any>) : {};

  const mergedRaw: Record<string, any> = {
    ...dbRaw,
    ...apiRaw,
  };

  if (!Array.isArray(mergedRaw.floors) || mergedRaw.floors.length === 0) {
    mergedRaw.floors = Array.isArray(dbRaw.floors) ? dbRaw.floors : [];
  }

  if (!Array.isArray(mergedRaw.allBuildings) || mergedRaw.allBuildings.length === 0) {
    mergedRaw.allBuildings = Array.isArray(dbRaw.allBuildings) ? dbRaw.allBuildings : [];
  }

  if (!Array.isArray(mergedRaw.exposFloors) || mergedRaw.exposFloors.length === 0) {
    mergedRaw.exposFloors = Array.isArray(dbRaw.exposFloors) ? dbRaw.exposFloors : [];
  }

  if (!mergedRaw.violation && dbRaw.violation) {
    mergedRaw.violation = dbRaw.violation;
  }

  return {
    ...dbData,
    ...apiData,
    _raw: mergedRaw,
  };
};

export default function PublicRecordModal({ address, propertyId, onClose }: PublicRecordModalProps) {
  const [loading, setLoading] = useState(true);
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState("");
  const [building, setBuilding] = useState<Record<string, any> | null>(null);
  const [land, setLand] = useState<Record<string, any> | null>(null);
  const [fetchedFrom, setFetchedFrom] = useState<"db" | "api" | null>(null);
  const [selectedDongIdx, setSelectedDongIdx] = useState(0);

  const str = (v: unknown) => {
    if (v == null || v === "") return null;
    const s = String(v).trim();
    return s === "" || s === "-" || s === "--" || s === "조회 결과 없음" ? null : s;
  };

  /** _raw 보강 로직 (building에 적용) - 모든 동/recap/exposFloors에서 가장 상세한 값을 탐색 */
  const enrichBuilding = (bSum: Record<string, any>) => {
    if (bSum._raw && typeof bSum._raw === "object") {
      const raw = bSum._raw as Record<string, any>;
      const buildings: Record<string, any>[] =
        Array.isArray(raw.allBuildings) && raw.allBuildings.length > 0 ? raw.allBuildings : [];
      const recap = raw.recap && typeof raw.recap === "object" ? (raw.recap as Record<string, any>) : null;

      // 모든 동/recap에서 첫 번째 유효값을 찾는 헬퍼
      const findVal = (...fields: string[]) => {
        // recap에서 먼저 탐색 (총괄표제부가 가장 정확)
        if (recap) {
          for (const f of fields) {
            if (hasVal(recap[f])) return recap[f];
          }
        }
        // raw 자체에서 탐색
        for (const f of fields) {
          if (hasVal(raw[f])) return raw[f];
        }
        // allBuildings에서 탐색
        for (const bldg of buildings) {
          for (const f of fields) {
            if (hasVal(bldg[f])) return bldg[f];
          }
        }
        // exposFloors에서 mainPurpsCdNm 등 탐색 (집합건물 fallback)
        for (const bldg of buildings) {
          if (Array.isArray(bldg.exposFloors)) {
            for (const ef of bldg.exposFloors) {
              for (const f of fields) {
                if (hasVal(ef[f])) return ef[f];
              }
            }
          }
        }
        return null;
      };

      if (!hasVal(bSum.main_purpose)) bSum.main_purpose = findVal("mainPurpsCdNm", "etcPurps") ?? bSum.main_purpose;
      if (!hasVal(bSum.total_area)) bSum.total_area = findVal("totArea") ?? bSum.total_area;
      if (!hasVal(bSum.building_area)) bSum.building_area = findVal("archArea") ?? bSum.building_area;
      if (!hasVal(bSum.land_area)) bSum.land_area = findVal("platArea") ?? bSum.land_area;
      if (!hasVal(bSum.approval_date)) bSum.approval_date = findVal("useAprDay") ?? bSum.approval_date;
      if (!hasVal(bSum.floors_above)) bSum.floors_above = findVal("grndFlrCnt") ?? bSum.floors_above;
      if (!hasVal(bSum.floors_below)) bSum.floors_below = findVal("ugrndFlrCnt") ?? bSum.floors_below;
      if (!hasVal(bSum.parking_count)) {
        // 주차대수: recap/allBuildings에서 총합 계산
        const parkingSources = recap ? [recap, ...buildings] : buildings;
        const parkingTotal = parkingSources.reduce((max, src) => {
          const t = Number(src.indrMechUtcnt ?? 0) + Number(src.oudrMechUtcnt ?? 0) +
                    Number(src.indrAutoUtcnt ?? 0) + Number(src.oudrAutoUtcnt ?? 0);
          return t > max ? t : max;
        }, 0);
        if (parkingTotal > 0) bSum.parking_count = `${parkingTotal} 대`;
      }
      if (!hasVal(bSum.building_name)) bSum.building_name = findVal("bldNm", "dongNm") ?? bSum.building_name;
      if (bSum.elevator !== true) {
        if (raw.elevYn === "Y" || String(raw.elevatorDetail ?? "").includes("있음") ||
            buildings.some((b) => Number(b.rideUseElvtCnt ?? 0) + Number(b.emgenUseElvtCnt ?? 0) > 0)) {
          bSum.elevator = true;
        }
      }
    }
    return bSum;
  };

  /** _raw 보강 로직 (land에 적용) */
  const enrichLand = (lSum: Record<string, any>) => {
    if (lSum._raw && typeof lSum._raw === "object") {
      const raw = lSum._raw as Record<string, any>;
      lSum.land_category = raw.lndcgrCodeNm ?? lSum.land_category;
      lSum.land_area = raw.lndpclAr ?? lSum.land_area;
      lSum.official_price = raw.indvdlzPblntfPc ?? lSum.official_price;
      lSum.use_zone = raw.prposArea1DstrcNm ?? lSum.use_zone;
      lSum.pnu = raw.pnu ?? lSum.pnu;
      lSum.lot_number = raw.mnnmSlno ?? lSum.lot_number;
    }
    return lSum;
  };

  useEffect(() => {
    let cancelled = false;
    const cacheKey = getCacheKey(address, propertyId);

    // ── 캐시 히트: API 호출 없이 즉시 표시 ──
    const cached = recordCache.get(cacheKey);
    if (cached) {
      console.log("⚡ [캐시 히트] 즉시 표시:", cacheKey);
      setBuilding(cached.building);
      setLand(cached.land);
      setFetchedFrom(cached.fetchedFrom);
      setLoading(false);
      setEnhancing(false);
      setError("");
      return;
    }

    // ── 캐시 미스: 기존 fetch 로직 ──
    setLoading(true);
    setEnhancing(false);
    setError("");
    setBuilding(null);
    setLand(null);
    setFetchedFrom(null);

    const fetchData = async () => {
      if (!address && !propertyId) {
        setError("주소 정보가 없습니다.");
        setLoading(false);
        return;
      }

      try {
        let pid = propertyId;

        if (!pid && address) {
          const { data: propRow } = await supabase
            .from("properties")
            .select("id")
            .eq("address", address)
            .maybeSingle();
          if (propRow?.id) pid = propRow.id;
        }

        // ── Phase 1: DB 즉시 표시 ────────────────────────────────────
        let dbBuilding: Record<string, any> | null = null;
        let dbLand: Record<string, any> | null = null;
        let hasDBData = false;

        if (pid) {
          const [bRes, lRes] = await Promise.all([
            supabase.from("building_summary").select("*").eq("property_id", pid).maybeSingle(),
            supabase.from("land_summary").select("*").eq("property_id", pid).maybeSingle(),
          ]);

          dbBuilding = (bRes.data as Record<string, any> | null) ?? null;
          dbLand = (lRes.data as Record<string, any> | null) ?? null;

          const bHasData = dbBuilding && (dbBuilding.main_purpose || dbBuilding.total_area || dbBuilding.approval_date);
          const lHasData = dbLand && (dbLand.land_area || dbLand.land_category || dbLand.official_price);
          hasDBData = !!(bHasData || lHasData);

          if (hasDBData && !cancelled) {
            // DB 데이터를 먼저 즉시 표시 (간소화 뷰)
            setBuilding(dbBuilding);
            setLand(dbLand);
            setFetchedFrom("db");
            setLoading(false);
            console.log("⚡ [Phase 1] DB 캐시 즉시 표시");
          }
        }

        // ── Phase 2: Edge Function으로 _raw 보강 ────────────────────
        if (hasDBData) setEnhancing(true);

        const { data: { session } } = await supabase.auth.getSession();
        const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const bearer = session?.access_token ?? apiKey;
        const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/property-summary`;

        console.log("⚡ [Phase 2] Edge Function 호출:", address);

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: apiKey,
            Authorization: `Bearer ${bearer}`,
          },
          body: JSON.stringify({ address, property_id: pid }),
        });

        if (cancelled) return;

        const data = await res.json();

        if (!res.ok) {
          if (!hasDBData) throw new Error(data.error || "공적장부 조회 실패");
          console.warn("⚠️ Edge Function 실패, DB 캐시 유지");
          setEnhancing(false);
          // DB 데이터만이라도 캐시
          recordCache.set(cacheKey, { building: dbBuilding, land: dbLand, fetchedFrom: "db" });
          return;
        }

        const apiBuilding = (data.building_summary as Record<string, any> | null) ?? null;
        const apiLand = (data.land_summary as Record<string, any> | null) ?? null;

        const bSum = mergeSummary(dbBuilding, apiBuilding);
        const lSum = mergeSummary(dbLand, apiLand);

        if (bSum) enrichBuilding(bSum);
        if (lSum) enrichLand(lSum);

        if (!cancelled) {
          const finalFetchedFrom = apiBuilding?._raw ? "api" as const : "db" as const;
          setBuilding(bSum);
          setLand(lSum);
          setFetchedFrom(finalFetchedFrom);
          setEnhancing(false);
          if (!hasDBData) setLoading(false);
          console.log("✅ [Phase 2] 최종 병합 완료");

          // 빈 결과는 캐시하지 않음 (재시도 가능하도록)
          const hasAnyData = !!(bSum?.main_purpose || bSum?.total_area || bSum?.approval_date ||
                                lSum?.land_area || lSum?.land_category || lSum?.official_price);
          if (hasAnyData) {
            recordCache.set(cacheKey, { building: bSum, land: lSum, fetchedFrom: finalFetchedFrom });
            console.log("💾 캐시 저장");
          } else {
            console.log("⚠️ 빈 결과 → 캐시 저장 안 함");
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error("❌ [공적장부] 조회 실패:", e);
          setError(e?.message || "조회 중 오류가 발생했습니다.");
          setLoading(false);
          setEnhancing(false);
        }
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [address, propertyId]);

  const raw = building?._raw && typeof building._raw === "object" ? (building._raw as Record<string, any>) : null;

  const floors = raw?.floors && Array.isArray(raw.floors) ? (raw.floors as Array<Record<string, string>>) : [];

  const allBuildings =
    raw?.allBuildings && Array.isArray(raw.allBuildings) ? (raw.allBuildings as Array<Record<string, any>>) : [];

  const detailedBuildings = getDetailedBuildingCandidates(allBuildings);

  const firstBuildingValue = (...fields: string[]) => {
    for (const bldg of allBuildings) {
      for (const field of fields) {
        const value = str(bldg?.[field]);
        if (value) return value;
      }
    }
    return null;
  };

  const headerSource =
    allBuildings.find(
      (bldg) =>
        str(bldg?.bldNm) ||
        str(bldg?.mainPurpsCdNm) ||
        str(bldg?.etcPurps) ||
        str(bldg?.platArea) ||
        str(bldg?.archArea) ||
        str(bldg?.totArea) ||
        str(bldg?.useAprDay)
    ) ?? null;

  const topBuildingRaw =
    raw || headerSource
      ? {
          ...(raw ?? {}),
          ...(headerSource ?? {}),
        }
      : null;

  const headerParkingTotal = allBuildings.reduce((maxTotal, bldg) => {
    const total =
      Number(bldg.indrMechUtcnt ?? 0) +
      Number(bldg.oudrMechUtcnt ?? 0) +
      Number(bldg.indrAutoUtcnt ?? 0) +
      Number(bldg.oudrAutoUtcnt ?? 0);
    return total > maxTotal ? total : maxTotal;
  }, 0);

  const topBuilding =
    building || headerSource
      ? {
          ...(building ?? {}),
          _raw: topBuildingRaw,
          building_name: str(building?.building_name) ?? firstBuildingValue("bldNm", "dongNm") ?? "",
          main_purpose: str(building?.main_purpose) ?? firstBuildingValue("mainPurpsCdNm", "etcPurps") ?? "",
          land_area: str(building?.land_area) ?? firstBuildingValue("platArea") ?? "",
          building_area: str(building?.building_area) ?? firstBuildingValue("archArea") ?? "",
          total_area: str(building?.total_area) ?? firstBuildingValue("totArea") ?? "",
          approval_date: str(building?.approval_date) ?? firstBuildingValue("useAprDay") ?? "",
          floors_above: str(building?.floors_above) ?? firstBuildingValue("grndFlrCnt") ?? "",
          floors_below: str(building?.floors_below) ?? firstBuildingValue("ugrndFlrCnt") ?? "",
          parking_count:
            str(building?.parking_count) ??
            (headerParkingTotal > 0 ? `${headerParkingTotal} 대` : ""),
        }
      : null;

  const buildingExposeSections = allBuildings.filter(
    (bldg) => Array.isArray(bldg.exposFloors) && bldg.exposFloors.length > 0
  );

  const violation =
    raw?.violation && typeof raw.violation === "object"
      ? (raw.violation as {
          isViolation: boolean;
          violationYn: string;
          items: Array<{
            vlttRnCnts?: string;
            vlttGbCdNm?: string;
            crtnDay?: string;
          }>;
        })
      : null;

  const isViolation = violation?.isViolation === true;
  const hasViolationInfo = violation !== null;

  const hasAnyBuildingData =
    !!topBuilding &&
    !!(
      str(topBuilding.building_name) ||
      str(topBuilding.main_purpose) ||
      str(topBuilding.total_area) ||
      str(topBuilding.approval_date) ||
      str(topBuilding.floors_above)
    );

  const hasAnyLandData =
    !!land &&
    !!(
      str(land.land_area) ||
      str(land.land_category) ||
      str(land.use_zone) ||
      str(land.official_price) ||
      str(land.road_access) ||
      str(land.pnu)
    );

  const topBMapped = mapBuildingFromDB(topBuilding);

  const renderBuildingSummaryTable = (
    source: Record<string, any> | null,
    mapped: ReturnType<typeof mapBuildingFromDB>
  ) => (
    <table className="w-full border-collapse border border-border/50 text-[11px]">
      <tbody>
        <TRow l1="건물명" v1={str(source?.building_name)} />
        <TRow
          l1="주용도"
          v1={str(source?.main_purpose)}
          l2="사용승인일"
          v2={mapped.approvalDate ?? str(source?.approval_date)}
        />
        <TRow
          l1="연면적"
          v1={str(source?.total_area)}
          l2="대지면적"
          v2={str(source?.land_area)}
        />
        <TRow
          l1="건축면적"
          v1={str(source?.building_area)}
          l2="층수"
          v2={`지상 ${str(source?.floors_above) ?? "-"}층 / 지하 ${str(source?.floors_below) ?? "-"}층`}
        />
        <TRow
          l1="주차대수"
          v1={str(source?.parking_count)}
          l2="엘리베이터"
          v2={mapped.elevatorDetail}
        />
        {(() => {
          const raw = (source?._raw && typeof source._raw === "object") ? source._raw as Record<string, unknown> : null;
          const hhld = raw?.hhldCnt ?? firstBuildingValue("hhldCnt");
          const fmly = raw?.fmlyCnt ?? firstBuildingValue("fmlyCnt");
          const ho = raw?.hoCnt ?? firstBuildingValue("hoCnt");
          const primary = pickPrimaryCountKey(str(source?.main_purpose), { hhld, fmly, ho });
          const pairs: Array<[string, string]> = [
            ["세대수", formatUnitCount(hhld, "세대")],
            ["가구수", formatUnitCount(fmly, "가구")],
            ["호수", formatUnitCount(ho, "호")],
          ];
          const order = primary === "fmly"
            ? [1, 0, 2]
            : primary === "ho"
              ? [2, 0, 1]
              : [0, 2, 1];
          const sorted = order.map((i) => pairs[i]);
          return (
            <>
              <TRow l1={sorted[0][0]} v1={sorted[0][1]} l2={sorted[1][0]} v2={sorted[1][1]} />
              <TRow l1={sorted[2][0]} v1={sorted[2][1]} />
            </>
          );
        })()}
      </tbody>
    </table>
  );

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/60 p-2 sm:p-4" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden w-[calc(100vw-16px)] sm:w-full max-w-[680px]"
        style={{ maxHeight: "calc(100dvh - 16px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0"
          style={{ background: "hsl(var(--primary) / 0.06)" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "hsl(var(--primary) / 0.14)" }}
            >
              <Layers className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[13px] font-extrabold text-foreground">건축물대장·토지대장</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight truncate max-w-[520px]">{address}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors flex-shrink-0 ml-2"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-[12px] text-muted-foreground font-medium">공적장부 조회 중...</p>
              <div className="w-full px-4 mt-2 space-y-1">
                {[...Array(5)].map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "hsl(var(--destructive) / 0.1)" }}
              >
                <AlertTriangle className="w-6 h-6" style={{ color: "hsl(var(--destructive))" }} />
              </div>
              <p className="text-[13px] font-bold text-foreground">공적장부 조회 실패</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{error}</p>
            </div>
          )}

          {!loading && !error && !building && !land && (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <Layers className="w-10 h-10 text-muted-foreground/20" />
              <p className="text-[13px] font-semibold text-muted-foreground">조회 결과 없음</p>
              <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                해당 주소의 공적장부 데이터가 없습니다.
                <br />
                국토교통부 데이터에 미등록된 지번일 수 있습니다.
              </p>
            </div>
          )}

          {!loading && !error && (building || land) && (
            <div className="flex flex-col">
              <SectionHeader emoji="🏛️" title="건축물대장" bg="hsl(var(--primary) / 0.05)" />


              {building && hasViolationInfo && (
                <div
                  className="flex items-start gap-2 mx-3 mt-2 mb-1 rounded-lg px-3 py-2.5"
                  style={
                    isViolation
                      ? {
                          background: "hsl(0 100% 97%)",
                          border: "1.5px solid hsl(0 80% 80%)",
                        }
                      : {
                          background: "hsl(142 60% 96%)",
                          border: "1.5px solid hsl(142 50% 75%)",
                        }
                  }
                >
                  <span className="text-base leading-none mt-0.5 flex-shrink-0">{isViolation ? "⚠️" : "✔"}</span>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span
                      className="text-[12px] font-extrabold leading-tight"
                      style={{ color: isViolation ? "hsl(0 70% 40%)" : "hsl(142 50% 30%)" }}
                    >
                      {isViolation ? "위반건축물" : "정상건축물"}
                    </span>

                    {isViolation && violation!.items.length > 0 && (
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        {violation!.items.map((v, i) => (
                          <span key={i} className="text-[10px] leading-snug" style={{ color: "hsl(0 60% 35%)" }}>
                            {v.vlttGbCdNm ? `[${v.vlttGbCdNm}] ` : ""}
                            {v.vlttRnCnts || "위반내용 정보 없음"}
                          </span>
                        ))}
                      </div>
                    )}

                    {!isViolation && (
                      <span className="text-[10px]" style={{ color: "hsl(142 40% 38%)" }}>
                        위반건축물 이력 없음
                      </span>
                    )}
                  </div>
                </div>
              )}

              {building && !hasViolationInfo && (
                <div
                  className="flex items-center gap-2 mx-3 mt-2 mb-1 rounded-lg px-3 py-2"
                  style={{
                    background: "hsl(var(--muted))",
                    border: "1px solid hsl(var(--border))",
                  }}
                >
                  <span className="text-sm">🏛️</span>
                  <span className="text-[11px] text-muted-foreground">위반건축물 여부 정보 없음</span>
                </div>
              )}


              {(() => {
                const s = toDisplayText;
                const sorted = detailedBuildings;
                const recapName = getRecapBuildingName(raw);

                // allBuildings 없으면 요약 표제부
                if (sorted.length === 0 && hasAnyBuildingData) {
                  return (
                    <div className="px-3 mt-2">
                      {renderBuildingSummaryTable(topBuilding, topBMapped)}
                    </div>
                  );
                }

                if (sorted.length === 0 && !hasAnyBuildingData) {
                  return (
                    <div className="px-4 py-4">
                      <p className="text-[11px] text-muted-foreground">건축물 데이터 없음 또는 일부 항목만 조회됨</p>
                    </div>
                  );
                }

                const safeIdx = Math.min(selectedDongIdx, sorted.length - 1);
                const bldg = sorted[safeIdx];
                const fallbackName = s(topBuilding?.building_name) ?? s(raw?.bldNm) ?? recapName ?? "건축물";
                const displayBldg: Record<string, any> = {
                  ...bldg,
                  platPlc: s(bldg?.platPlc) ?? s(raw?.platPlc) ?? null,
                  newPlatPlc: s(bldg?.newPlatPlc) ?? s(raw?.newPlatPlc) ?? null,
                  regstrGbCdNm: s(bldg?.regstrGbCdNm) ?? null,
                  bldNm: s(bldg?.bldNm) ?? fallbackName,
                  mainPurpsCdNm: s(bldg?.mainPurpsCdNm) ?? s(topBuilding?.main_purpose) ?? s(raw?.mainPurpsCdNm) ?? null,
                  etcPurps: s(bldg?.etcPurps) ?? s(raw?.etcPurps) ?? null,
                  strctCdNm: s(bldg?.strctCdNm) ?? s(raw?.strctCdNm) ?? null,
                  roofCdNm: s(bldg?.roofCdNm) ?? s(raw?.roofCdNm) ?? null,
                  platArea: s(bldg?.platArea) ?? s(topBuilding?.land_area) ?? s(raw?.platArea) ?? null,
                  archArea: s(bldg?.archArea) ?? s(topBuilding?.building_area) ?? s(raw?.archArea) ?? null,
                  totArea: s(bldg?.totArea) ?? s(topBuilding?.total_area) ?? s(raw?.totArea) ?? null,
                  vlRatEstmTotArea: s(bldg?.vlRatEstmTotArea) ?? s(raw?.vlRatEstmTotArea) ?? null,
                  bcRat: s(bldg?.bcRat) ?? s(raw?.bcRat) ?? null,
                  vlRat: s(bldg?.vlRat) ?? s(raw?.vlRat) ?? null,
                  hhldCnt: s(bldg?.hhldCnt) ?? s(raw?.hhldCnt) ?? null,
                  fmlyCnt: s(bldg?.fmlyCnt) ?? s(raw?.fmlyCnt) ?? null,
                  hoCnt: s(bldg?.hoCnt) ?? s(raw?.hoCnt) ?? null,
                  grndFlrCnt: s(bldg?.grndFlrCnt) ?? s(topBuilding?.floors_above) ?? s(raw?.grndFlrCnt) ?? null,
                  ugrndFlrCnt: s(bldg?.ugrndFlrCnt) ?? s(topBuilding?.floors_below) ?? s(raw?.ugrndFlrCnt) ?? null,
                  pmsDay: s(bldg?.pmsDay) ?? s(raw?.pmsDay) ?? null,
                  stcnsDay: s(bldg?.stcnsDay) ?? s(raw?.stcnsDay) ?? null,
                  useAprDay: s(bldg?.useAprDay) ?? s(topBuilding?.approval_date) ?? s(raw?.useAprDay) ?? null,
                  erthqkAblty: s(bldg?.erthqkAblty) ?? s(raw?.erthqkAblty) ?? null,
                  erthqkDsgnApplyYn: s(bldg?.erthqkDsgnApplyYn) ?? s(raw?.erthqkDsgnApplyYn) ?? null,
                };
                const dongLabel = (b: Record<string, any>) => getBuildingLabel(b) || fallbackName;

                const elevRide = Number(bldg.rideUseElvtCnt ?? raw?.rideUseElvtCnt ?? 0);
                const elevEmg = Number(bldg.emgenUseElvtCnt ?? raw?.emgenUseElvtCnt ?? 0);
                const elevDetail = elevRide + elevEmg > 0 ? `승용 ${elevRide} 대 / 비상용 ${elevEmg} 대` : "없음";

                const parkTotal =
                  Number(bldg.indrMechUtcnt ?? raw?.indrMechUtcnt ?? 0) +
                  Number(bldg.oudrMechUtcnt ?? raw?.oudrMechUtcnt ?? 0) +
                  Number(bldg.indrAutoUtcnt ?? raw?.indrAutoUtcnt ?? 0) +
                  Number(bldg.oudrAutoUtcnt ?? raw?.oudrAutoUtcnt ?? 0);
                const parkMech = Number(bldg.indrMechUtcnt ?? raw?.indrMechUtcnt ?? 0) + Number(bldg.oudrMechUtcnt ?? raw?.oudrMechUtcnt ?? 0);
                const parkAuto = Number(bldg.indrAutoUtcnt ?? raw?.indrAutoUtcnt ?? 0) + Number(bldg.oudrAutoUtcnt ?? raw?.oudrAutoUtcnt ?? 0);
                const parkDetail = parkTotal > 0 ? `기계식 ${parkMech} 대 / 자주식 ${parkAuto} 대` : "-";

                const seismicDesign = displayBldg.erthqkDsgnApplyYn
                  ? String(displayBldg.erthqkDsgnApplyYn).trim().toUpperCase() === "Y"
                    ? "적용"
                    : String(displayBldg.erthqkDsgnApplyYn) === "1"
                      ? "적용"
                      : String(displayBldg.erthqkDsgnApplyYn)
                  : "-";

                return (
                  <>
                    {/* 동 선택 탭 */}
                    {sorted.length > 1 && (
                      <div className="px-3 mt-2 mb-1">
                        <div className="flex flex-wrap gap-1.5">
                          {sorted.map((b, i) => (
                            <button
                              key={i}
                              onClick={() => setSelectedDongIdx(i)}
                              className="text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors"
                              style={
                                i === safeIdx
                                  ? {
                                      background: "hsl(var(--primary))",
                                      color: "hsl(var(--primary-foreground))",
                                      borderColor: "hsl(var(--primary))",
                                    }
                                  : {
                                      background: "hsl(var(--muted))",
                                      color: "hsl(var(--muted-foreground))",
                                      borderColor: "hsl(var(--border))",
                                    }
                              }
                            >
                              {dongLabel(b)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 선택된 동 표제부 */}
                    <div className="px-3 mt-2">
                      <table className="w-full border-collapse border border-border/50 text-[11px]">
                        <tbody>
                          <TRow l1="소재지" v1={displayBldg.platPlc ?? address} />
                          {displayBldg.newPlatPlc && <TRow l1="도로명" v1={displayBldg.newPlatPlc} />}
                          <TRow l1="건물명" v1={displayBldg.bldNm} l2="대장구분" v2={displayBldg.regstrGbCdNm} />
                          <TRow l1="용도지역" v1={displayBldg.mainPurpsCdNm} l2="사용승인일" v2={displayBldg.useAprDay} />
                          <TRow l1="주용도" v1={displayBldg.mainPurpsCdNm} l2="기타용도" v2={displayBldg.etcPurps} />
                          <TRow l1="주구조" v1={displayBldg.strctCdNm} l2="지붕구조" v2={displayBldg.roofCdNm} />
                          <TRow l1="대지면적" v1={displayBldg.platArea} l2="건축면적" v2={displayBldg.archArea} />
                          <TRow l1="연면적" v1={displayBldg.totArea} l2="용적률산정연면적" v2={displayBldg.vlRatEstmTotArea} />
                          <TRow l1="건폐율" v1={displayBldg.bcRat} l2="용적률" v2={displayBldg.vlRat} />
                          <TRow l1="세대수" v1={formatUnitCount(displayBldg.hhldCnt, "세대")} l2="가구수" v2={formatUnitCount(displayBldg.fmlyCnt, "가구")} />
                          <TRow l1="호수" v1={formatUnitCount(displayBldg.hoCnt, "호")} />
                          <TRow l1="지상층수" v1={displayBldg.grndFlrCnt} l2="지하층수" v2={displayBldg.ugrndFlrCnt ?? "0"} />
                          <TRow l1="엘리베이터" v1={elevDetail} l2="주차" v2={parkDetail} />
                          <TRow l1="허가일" v1={displayBldg.pmsDay} l2="착공일" v2={displayBldg.stcnsDay} />
                          <TRow l1="대내진능력" v1={displayBldg.erthqkAblty ?? "-"} l2="내진설계적용" v2={seismicDesign} />
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}

              {(() => {
                const s = toDisplayText;
                const selectedBuildings = detailedBuildings;
                const safeIdx2 = Math.min(selectedDongIdx, Math.max(selectedBuildings.length - 1, 0));
                const selectedBldg = selectedBuildings[safeIdx2];
                const dongExposFloors = Array.isArray(selectedBldg?.exposFloors) ? selectedBldg.exposFloors : [];
                const dongLabel2 =
                  getBuildingLabel(selectedBldg ?? {}) ||
                  s(topBuilding?.building_name) ||
                  s(raw?.bldNm) ||
                  getRecapBuildingName(raw) ||
                  undefined;

                if (dongExposFloors.length === 0 && floors.length > 0) {
                  return (
                    <>
                      <div className="px-3 mt-3 mb-1">
                        <p className="text-[10px] text-muted-foreground italic">
                          * 참고용 자료이므로 실제 내용과 차이가 있을 수 있습니다.
                        </p>
                        <h3 className="text-[13px] font-extrabold text-foreground mt-2 mb-1.5">층별내역</h3>
                      </div>
                      <div className="px-3 pb-2">
                        {(() => {
                          const mainPurpose = s(selectedBldg?.mainPurpsCdNm) ?? s(topBuilding?.main_purpose) ?? s(raw?.mainPurpsCdNm) ?? null;
                          const primary = pickPrimaryCountKey(mainPurpose, {
                            hhld: selectedBldg?.hhldCnt ?? raw?.hhldCnt,
                            fmly: selectedBldg?.fmlyCnt ?? raw?.fmlyCnt,
                            ho: selectedBldg?.hoCnt ?? raw?.hoCnt,
                          });
                          const countMeta = primary === "fmly"
                            ? { label: "가구수", field: "fmlyCnt", suffix: "가구" }
                            : primary === "ho"
                              ? { label: "호수", field: "hoCnt", suffix: "호" }
                              : { label: "세대수", field: "hhldCnt", suffix: "세대" };
                          return (
                            <table className="w-full border-collapse border border-border/50 text-[11px]">
                              <thead>
                                <tr className="bg-muted/40">
                                  <th className="py-1.5 px-2 text-left text-[10px] font-bold text-muted-foreground border-b border-r border-border/40">층</th>
                                  <th className="py-1.5 px-2 text-left text-[10px] font-bold text-muted-foreground border-b border-r border-border/40">용도</th>
                                  <th className="py-1.5 px-2 text-left text-[10px] font-bold text-muted-foreground border-b border-r border-border/40">면적</th>
                                  <th className="py-1.5 px-2 text-left text-[10px] font-bold text-muted-foreground border-b border-r border-border/40">{countMeta.label}</th>
                                  <th className="py-1.5 px-2 text-left text-[10px] font-bold text-muted-foreground border-b border-border/40">구분</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[...floors]
                                  .sort((a, b) => {
                                    const numA = parseInt(String(a.flrNo ?? a.flrNoNm ?? "0").replace(/[^0-9-]/g, "")) || 0;
                                    const numB = parseInt(String(b.flrNo ?? b.flrNoNm ?? "0").replace(/[^0-9-]/g, "")) || 0;
                                    return numA - numB;
                                  })
                                  .map((f, i) => (
                                  <tr key={i} className="border-b border-border/30 last:border-0">
                                    <td className="py-1.5 px-2 font-semibold text-foreground border-r border-border/30">{f.flrNoNm || f.flrNo || "-"}</td>
                                    <td className="py-1.5 px-2 text-muted-foreground border-r border-border/30">{f.mainPurpsCdNm || "-"}</td>
                                    <td className="py-1.5 px-2 text-muted-foreground border-r border-border/30">{f.area || "-"}</td>
                                    <td className="py-1.5 px-2 text-muted-foreground border-r border-border/30">{(() => { const v = formatUnitCount((f as Record<string, unknown>)[countMeta.field], countMeta.suffix); return v === "미기재" ? "" : v; })()}</td>
                                    <td className="py-1.5 px-2 text-muted-foreground">주건축물</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          );
                        })()}
                      </div>
                    </>
                  );
                }

                if (dongExposFloors.length > 0) {
                  return <FloorGrid exposFloors={dongExposFloors} dongName={dongLabel2} />;
                }

                return null;
              })()}

              <div className="h-1.5 bg-muted/40 my-1" />

              <SectionHeader emoji="🗺️" title="토지대장" bg="hsl(142 50% 96%)" />

              {hasAnyLandData ? (
                <div className="px-4 py-1">
                  <Row label="PNU" value={str(land?.pnu)} />
                  <Row label="지목" value={str(land?.land_category) ?? str(land?.jimok)} />
                  <Row label="토지면적" value={str(land?.land_area) ?? str(land?.area)} />
                  <Row label="용도지역" value={str(land?.use_zone) ?? str(land?.zone)} />
                  <Row label="공시지가" value={str(land?.official_price) ?? str(land?.price)} />
                </div>
              ) : (
                <div className="px-4 py-4">
                  <p className="text-[11px] text-muted-foreground">토지 데이터 없음 또는 일부 항목만 조회됨</p>
                </div>
              )}

              <div className="px-4 py-3 mt-1 flex items-center justify-between">
                <p className="text-[9px] text-muted-foreground/40">출처: 국토교통부 건축물대장·토지대장 공공데이터</p>
                {fetchedFrom && (
                  <span
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                    style={
                      fetchedFrom === "db"
                        ? {
                            background: "hsl(142 60% 93%)",
                            color: "hsl(142 50% 35%)",
                          }
                        : {
                            background: "hsl(var(--primary)/0.08)",
                            color: "hsl(var(--primary))",
                          }
                    }
                  >
                    {enhancing ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        상세 로딩
                      </span>
                    ) : fetchedFrom === "db" ? "✓ 캐시" : "✓ 실시간"}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-muted/20">
          <button
            onClick={onClose}
            className="w-full h-10 rounded-xl text-[13px] font-bold text-primary border border-primary/30 hover:bg-primary/5 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
