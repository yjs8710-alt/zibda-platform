import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapProperty } from "@/data/mapProperties";

// 매물 카드/지도에 필요한 컬럼만 선택 (성능 개선)
const PROPERTY_COLUMNS = [
  "id", "reg_no", "title", "building_name", "address", "type", "room_type", "unit_number",
  "area", "floor", "deposit", "monthly", "manage_fee", "parking", "elevator",
  "available_from", "total_floors", "build_year", "description",
  "building_memo", "room_memo", "note", "vacate_date",
  "building_password", "room_password",
  "options", "views", "lat", "lng", "is_new", "is_hot",
  "registered_date", "checked_date", "agent_name", "images", "registered_by",
].join(",");

// UUID → 안정적인 숫자 id (정렬 순서가 바뀌어도 동일 id 유지)
function stableNumericId(uuid: string, fallbackIdx: number): number {
  if (!uuid) return 100000 + fallbackIdx;
  let h = 5381;
  for (let i = 0; i < uuid.length; i++) {
    h = ((h << 5) + h + uuid.charCodeAt(i)) | 0;
  }
  // 100000 ~ 2^31-1 범위에 매핑
  return 100000 + (Math.abs(h) % 2000000000);
}

// 관리자 DB 매물 → MapProperty 변환
export function dbToMapProperty(row: Record<string, unknown>, idx: number): MapProperty {
  const noteStr = String(row.note ?? row.agent_name ?? "");
  const vacateDateFromNote = noteStr.match(/퇴거(?:\s*예정)?일[:\s]*([0-9]{4}[-./년\s]*[0-9]{1,2}[-./월\s]*[0-9]{1,2}(?:일)?)/)?.[1]?.trim();
  const parseContact = (key: string) => {
    const pattern = key === "건물주"
      ? /건물주(?!2)[:\s]+([0-9\-]+)/
      : new RegExp(`${key}[:\\s]+([0-9\\-]+)`);
    const m = noteStr.match(pattern);
    return m ? m[1].trim() : undefined;
  };
  const roadMatch = noteStr.match(/도로명[:\s]+([^\n|]+)/);
  const lotStr = String(row.lot_number ?? "");
  const isRoadLot = /[가-힣].*(로|길)/.test(lotStr);
  const roadAddress = roadMatch
    ? roadMatch[1].trim()
    : isRoadLot
      ? lotStr
      : undefined;

  return {
    id: stableNumericId(String(row.id ?? ""), idx),
    dbId: String(row.id ?? ""),
    regNo: row.reg_no ? String(row.reg_no) : undefined,
    title: String(row.title ?? ""),
    buildingName: row.building_name ? String(row.building_name) : undefined,
    address: String(row.address ?? ""),
    type: String(row.type ?? ""),
    roomType: row.room_type ? String(row.room_type) : undefined,
    unitNumber: row.unit_number ? String(row.unit_number) : undefined,
    area: String(row.area ?? ""),
    floor: String(row.floor ?? ""),
    deposit: String(row.deposit ?? ""),
    monthly: String(row.monthly ?? ""),
    isNew: Boolean(row.is_new),
    isHot: Boolean(row.is_hot),
    views: Number(row.views) || 0,
    lat: Number(row.lat) || 0,
    lng: Number(row.lng) || 0,
    image: Array.isArray(row.images) && (row.images as string[]).length > 0
      ? (row.images as string[])[0]
      : "",
    images: Array.isArray(row.images) ? (row.images as string[]) : [],
    description: String(row.description ?? ""),
    buildingMemo: row.building_memo && !String(row.building_memo).startsWith("__PROPOSAL_JSON__")
      ? String(row.building_memo)
      : undefined,
    buildingMemoRaw: row.building_memo ? String(row.building_memo) : undefined,
    roomMemo: row.room_memo ? String(row.room_memo) : undefined,
    note: row.note ? String(row.note) : undefined,
    vacateDate: row.vacate_date ? String(row.vacate_date) : vacateDateFromNote,
    buildingPassword: row.building_password ? String(row.building_password) : undefined,
    roomPassword: row.room_password ? String(row.room_password) : undefined,
    options: Array.isArray(row.options) ? (row.options as string[]) : [],
    registeredDate: row.registered_date ? String(row.registered_date) : undefined,
    checkedDate: row.checked_date ? String(row.checked_date) : undefined,
    contact: parseContact("부동산") ?? "",
    contactOwner: parseContact("건물주"),
    contactOwner2: parseContact("건물주2"),
    contactManager: parseContact("관리인"),
    contactTenant: parseContact("세입자"),
    agentName: String(row.agent_name ?? ""),
    manageFee: String(row.manage_fee ?? ""),
    parking: String(row.parking ?? ""),
    elevator: Boolean(row.elevator),
    availableFrom: String(row.available_from ?? ""),
    totalFloors: String(row.total_floors ?? ""),
    buildYear: String(row.build_year ?? ""),
    memo: String(row.id ?? ""),
    roadAddress,
    registeredBy: row.registered_by ? String(row.registered_by) : undefined,
  };
}

// 같은 typeFilter 요청은 모듈 단위 캐시로 즉시 반환 (페이지 전환 시 재요청 방지)
const cache = new Map<string, MapProperty[]>();

/**
 * Supabase properties 테이블에서 active 매물을 불러와 MapProperty[]로 변환
 */
export function useDBProperties(typeFilter?: string[]) {
  const cacheKey = typeFilter ? typeFilter.slice().sort().join(",") : "__all__";
  const cached = cache.get(cacheKey);
  const [properties, setProperties] = useState<MapProperty[]>(cached ?? []);
  const [loading, setLoading] = useState<boolean>(!cached);
  const [refreshKey, setRefreshKey] = useState(0);
  const debounceRef = useRef<number | null>(null);

  const refetch = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      let query = supabase
        .from("properties")
        .select(PROPERTY_COLUMNS)
        .eq("status", "active")
        .order("checked_date", { ascending: false, nullsFirst: false })
        .order("registered_date", { ascending: false })
        .limit(2000);

      if (typeFilter && typeFilter.length > 0) {
        query = query.in("type", typeFilter);
      }

      const { data, error } = await query;

      if (!cancelled) {
        if (!error && data) {
          const mapped = (data as unknown as Record<string, unknown>[]).map((row, idx) =>
            dbToMapProperty(row, idx)
          );
          cache.set(cacheKey, mapped);
          setProperties(mapped);
        }
        setLoading(false);
      }
    };

    fetchData();

    // Realtime 구독: 변경 다발 시 debounce(800ms)로 묶어서 한 번만 refetch
    const channelName = `db-properties-${cacheKey}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "properties" },
        () => {
          if (cancelled) return;
          if (debounceRef.current) window.clearTimeout(debounceRef.current);
          debounceRef.current = window.setTimeout(() => {
            if (!cancelled) fetchData();
          }, 800);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [cacheKey, refreshKey]);

  return { properties, loading, refetch };
}
