import { useState, useEffect, useRef, forwardRef, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import MapView from "@/components/MapView";
import MapSidebar from "@/components/MapSidebar";
import MapSearchBar from "@/components/MapSearchBar";
import PropertyDetailPanel from "@/components/PropertyDetailPanel";
import { MAP_PROPERTIES, MapProperty } from "@/data/mapProperties";
import { useDBProperties, dbToMapProperty } from "@/hooks/useDBProperties";
import { useHiddenMockIds } from "@/hooks/useHiddenMockIds";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeType, setActiveType] = useState("전체");
  const [query, setQuery] = useState("");
  const [extraProperty, setExtraProperty] = useState<MapProperty | null>(null);

  const { properties: dbProperties, refetch } = useDBProperties();
  const { hiddenIds: hiddenMockIds } = useHiddenMockIds();


  const allProperties = useMemo(() => {
    const dbIds = new Set(dbProperties.map((p) => p.id));
    const merged = [
      ...dbProperties,
      ...MAP_PROPERTIES.filter((p) => !dbIds.has(p.id) && !hiddenMockIds.has(p.id)),
    ];
    if (extraProperty && !merged.some((p) => p.dbId === extraProperty.dbId)) {
      merged.push(extraProperty);
    }
    // 최근 확인일순 정렬 (확인일 없으면 등록일 fallback)
    return merged.sort((a, b) => {
      const da = a.checkedDate ?? a.registeredDate ?? "";
      const db2 = b.checkedDate ?? b.registeredDate ?? "";
      return da > db2 ? -1 : da < db2 ? 1 : 0;
    });
  }, [dbProperties, hiddenMockIds, extraProperty]);

  const filtered = allProperties
    .filter((p) => activeType === "전체" || p.type === activeType)
    .filter((p) =>
      !query || p.title.includes(query) || p.address.includes(query) || p.type.includes(query)
    );

  const selected = allProperties.find((p) => p.id === selectedId) ?? null;

  // ?propertyId=<dbId> 쿼리 → 자동 상세보기 (관리자/중개사가 알림 등에서 진입)
  useEffect(() => {
    const dbId = searchParams.get("propertyId");
    if (!dbId) return;
    // 활성 목록에 있으면 즉시 선택
    const target = allProperties.find((p) => p.dbId === dbId);
    if (target) {
      setSelectedId(target.id);
      return;
    }
    // 없으면 (종료/비활성 포함) 단건 조회 후 임시 주입
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", dbId)
        .maybeSingle();
      if (cancelled || error || !data) return;
      const mapped = dbToMapProperty(data as Record<string, unknown>, 9999);
      setExtraProperty(mapped);
      setSelectedId(mapped.id);
    })();
    return () => { cancelled = true; };
  }, [searchParams, allProperties, setSearchParams]);

  const closeDetail = useCallback(() => {
    setSelectedId(null);
    if (searchParams.has("propertyId")) {
      const next = new URLSearchParams(searchParams);
      next.delete("propertyId");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);




  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />
      <div className="flex-1 relative flex overflow-hidden">
        {/* Full-screen map */}
        <div className="absolute inset-0">
          <MapView
            properties={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        {/* Floating search bar */}
        <MapSearchBar
          query={query}
          onQueryChange={setQuery}
          activeType={activeType}
          onTypeChange={setActiveType}
        />

        {/* Left sidebar */}
        <MapSidebar
          properties={filtered}
          referencePool={allProperties}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDeselect={() => setSelectedId(null)}
          activeType={activeType}
          onTypeChange={setActiveType}
          query={query}
          onQueryChange={setQuery}
          onRefetch={refetch}
        />

        {/* Right detail panel */}
        {selected && (
          <PropertyDetailPanel
            property={selected}
            onClose={closeDetail}
            sameProperties={allProperties.filter(p => p.address === selected.address && p.id !== selected.id)}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
