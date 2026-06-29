import { useState, useMemo } from "react";
import Header from "@/components/Header";
import MapView, { MapBounds } from "@/components/MapView";
import MapSidebar from "@/components/MapSidebar";

import MapFilterBar, { FilterState, DEFAULT_FILTERS } from "@/components/MapFilterBar";
import LandlordSearchModal from "@/components/LandlordSearchModal";
import { MAP_PROPERTIES } from "@/data/mapProperties";
import { useDBProperties } from "@/hooks/useDBProperties";
import { useHiddenMockIds } from "@/hooks/useHiddenMockIds";
import { useAuth } from "@/hooks/useAuth";
import { useIsGuest } from "@/hooks/useIsGuest";
import { LayoutGrid, Map, List, X } from "lucide-react";
import { toast } from "sonner";

type ViewMode = "map" | "list";

const MapSearch = () => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeType, setActiveType] = useState("전체");
  const [query, setQuery] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [showLandlord, setShowLandlord] = useState(false);
  const [landlordHits, setLandlordHits] = useState<Set<string> | null>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  // 현재 지도가 보고 있는 영역(실시간 추적용)
  const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null);
  // "이 지역에서 검색" 버튼 클릭 시 스냅샷된 영역 (사이드바 필터링에 사용)
  const [searchBounds, setSearchBounds] = useState<MapBounds | null>(null);

  const { user } = useAuth();
  const isGuest = useIsGuest();
  const canSearchByText = !isGuest && user?.memberType !== "일반회원";

  // DB에서 실시간으로 매물 불러오기
  const { properties: dbProperties, refetch } = useDBProperties();
  const { hiddenIds: hiddenMockIds } = useHiddenMockIds();

  // 정적 목 데이터(숨긴 것 제외) + DB 데이터 병합
  // DB 매물 우선, 최신 등록순 정렬
  const allProperties = useMemo(() => {
    const dbIds = new Set(dbProperties.map((p) => p.id));
    const merged = [
      ...dbProperties,
      ...MAP_PROPERTIES.filter(p => !hiddenMockIds.has(p.id) && !dbIds.has(p.id)),
    ];
    return merged.sort((a, b) => {
      const da = a.registeredDate ?? "";
      const db2 = b.registeredDate ?? "";
      return da > db2 ? -1 : da < db2 ? 1 : 0;
    });
  }, [dbProperties, hiddenMockIds]);


  const handleDeleteProperties = (ids: Set<number>) => {
    setDeletedIds(prev => new Set([...prev, ...ids]));
  };

  const filtered = allProperties.filter((p) => {
    if (deletedIds.has(p.id)) return false;
    if (landlordHits) {
      if (!p.regNo || !landlordHits.has(p.regNo)) return false;
    }
    if (activeType !== "전체" && p.type !== activeType) return false;
    // 등록번호(숫자)로 직접 검색하는 경우 — 영역/유형 무시하고 해당 매물만 매칭
    const qTrim = query.trim();
    const isRegNoQuery =
      /^\d+$/.test(qTrim) &&
      allProperties.some(
        (x) => x.regNo && String(parseInt(x.regNo.replace(/[^0-9]/g, ""), 10)) === qTrim,
      );
    const regNoMatch =
      isRegNoQuery &&
      p.regNo &&
      String(parseInt(p.regNo.replace(/[^0-9]/g, ""), 10)) === qTrim;
    if (propertyId && !String(p.id).includes(propertyId) && !(p.regNo ?? "").includes(propertyId)) return false;
    // 지도 영역 필터 — 등록번호 검색 / 소유주(landlord) 검색 시에는 무시
    if (!isRegNoQuery && !landlordHits) {
      const activeBounds = searchBounds ?? currentBounds;
      if (activeBounds) {
        if (!p.lat || !p.lng) return false;
        const { swLat, swLng, neLat, neLng } = activeBounds;
        if (p.lat < swLat || p.lat > neLat || p.lng < swLng || p.lng > neLng) return false;
      }
    } else if (isRegNoQuery && !regNoMatch) {
      return false;
    }
    if (query && !regNoMatch) {
      const q = query.toLowerCase().trim();
      const isDongSearch = /[가-힣]+동$/.test(q);
      if (!canSearchByText && !isDongSearch) return false;

      if (isDongSearch && !canSearchByText) {
        if (!p.address.toLowerCase().includes(q)) return false;
      } else {
        const qNorm = q.replace(/번지$/, "").trim();
        const addr = p.address.toLowerCase();
        const dongLotPattern = qNorm.match(/([가-힣]+동)\s+(\d[\d\-]*)/);
        const dongLotMatch = dongLotPattern !== null &&
          addr.includes(dongLotPattern[1]) &&
          addr.includes(dongLotPattern[2]);
        const lotOnlyPattern = qNorm.match(/^(\d[\d\-]*)$/);
        const lotOnlyMatch = lotOnlyPattern !== null &&
          new RegExp(`(^|\\s)${lotOnlyPattern[1]}(\\s|$)`).test(addr);
        const matchText =
          addr.includes(qNorm) ||
          addr.includes(q) ||
          p.title.toLowerCase().includes(qNorm) ||
          (p.buildingName ?? "").toLowerCase().includes(qNorm) ||
          (p.regNo ?? "").includes(qNorm) ||
          dongLotMatch ||
          lotOnlyMatch;
        if (!matchText) return false;
      }
    }
    return true;
  });


  // lat/lng가 유효한 매물만 지도에 표시 (0,0은 제외)
  const mappableProperties = filtered.filter(p => p.lat !== 0 && p.lng !== 0);

  const selected = allProperties.find((p) => p.id === selectedId) ?? null;

  const handleSearchInArea = () => {
    // 현재 지도 영역을 스냅샷하여 사이드바 매물을 화면 안 매물로만 제한
    const bounds = currentBounds;
    if (!bounds) {
      toast.error("지도 영역을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    setSearchBounds(bounds);
    // 영역 검색 시에는 텍스트 검색은 초기화 (사용자가 화면 안 매물만 보고 싶어하는 의도)
    setQuery("");
    setPropertyId("");
    const inArea = allProperties.filter(
      (p) =>
        p.lat &&
        p.lng &&
        p.lat >= bounds.swLat &&
        p.lat <= bounds.neLat &&
        p.lng >= bounds.swLng &&
        p.lng <= bounds.neLng &&
        !deletedIds.has(p.id)
    ).length;
    toast.success(`화면 안 매물 ${inArea}개를 표시합니다`);
  };
  const handleClearAreaSearch = () => setSearchBounds(null);

  return (
    <div className="flex flex-col" style={{ height: "100vh" }}>
      <Header onMenuOpenChange={setMobileMenuOpen} />
      {showLandlord && (
        <LandlordSearchModal
          onClose={() => { setShowLandlord(false); setLandlordHits(null); }}
          onPropertiesFound={(items) => {
            const regNos = items.map((i) => i.regNo).filter(Boolean) as string[];
            setLandlordHits(regNos.length > 0 ? new Set(regNos) : new Set());
          }}
        />
      )}

      {/* 서브 툴바 — 필터/뷰 전환 */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-4 h-9 border-b"
        style={{
          background: "hsl(var(--toolbar-bg))",
          borderColor: "hsl(var(--border))",
        }}
      >
        {/* 뷰 전환 */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: "hsl(var(--border))" }}>
          <button
            onClick={() => setViewMode("map")}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
            style={
              viewMode === "map"
                ? { background: "white", color: "hsl(var(--primary))", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
                : { color: "hsl(var(--muted-foreground))" }
            }
          >
            <Map className="w-3 h-3" />
            지도
          </button>
          <button
            onClick={() => setViewMode("list")}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
            style={
              viewMode === "list"
                ? { background: "white", color: "hsl(var(--primary))", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
                : { color: "hsl(var(--muted-foreground))" }
            }
          >
            <List className="w-3 h-3" />
            목록
          </button>
        </div>

        {/* 매물 수 */}
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "hsl(var(--stat-green))" }} />
          <span className="text-[11px] font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>
            {mappableProperties.length}개 매물
          </span>
        </div>

        {/* 지도 영역 검색 활성 표시 */}
        {searchBounds && (
          <button
            onClick={handleClearAreaSearch}
            className="flex items-center gap-1 px-2 h-6 rounded-full text-[10px] font-bold transition-colors"
            style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}
            title="지도 영역 검색 해제"
          >
            <Map className="w-3 h-3" />
            화면 안 매물만
            <X className="w-3 h-3" />
          </button>
        )}

        <div className="flex-1" />

        {/* 유형 칩 */}
        {["전체", "원룸", "빌라", "상가", "사무실", "토지"].map(type => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all hidden lg:block"
            style={
              activeType === type
                ? { background: "hsl(var(--primary))", color: "white", borderColor: "hsl(var(--primary))" }
                : { background: "transparent", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }
            }
          >
            {type}
          </button>
        ))}
      </div>

      {/* 메인 콘텐츠 */}
      <main
        className="flex-1 relative overflow-hidden flex"
        style={{ minHeight: 0 }}
      >
        {/* 지도 영역 */}
        <div className="flex-1 relative min-w-0">
          <MapView
            properties={mappableProperties}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
            onBoundsChange={setCurrentBounds}
            onMapMoveClear={() => setSelectedId(null)}
          />
          {/* 필터 바 오버레이 */}
          <MapFilterBar
            activeType={activeType}
            onTypeChange={setActiveType}
            onClearTypeFilters={() => setActiveType("전체")}
            query={query}
            onQueryChange={setQuery}
            propertyId={propertyId}
            onPropertyIdChange={setPropertyId}
            filters={filters}
            onFiltersChange={setFilters}
            onLandlordClick={() => setShowLandlord(true)}
            onSearchClick={handleSearchInArea}
            propertyCount={mappableProperties.length}
            topOffset={92}
            hideSearchBar={mobileMenuOpen}
          />
        </div>

        {/* 사이드바 — 데스크톱: 우측 / 모바일: 하단 시트 (MapSidebar 내부에서 자동 분기) */}
        <MapSidebar
          properties={filtered}
          referencePool={allProperties}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDeselect={() => setSelectedId(null)}
          activeType={activeType}
          onTypeChange={setActiveType}
          onDeleteProperties={handleDeleteProperties}
          onRefetch={refetch}
          currentBounds={currentBounds}
        />
      </main>
    </div>
  );
};

export default MapSearch;
