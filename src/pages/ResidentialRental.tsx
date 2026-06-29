import { useState, useMemo, useRef, useCallback } from "react";
import { useExitConfirm } from "@/hooks/useExitConfirm";
import { neonChipStyle } from "@/lib/neonChipStyle";
import { useDBProperties } from "@/hooks/useDBProperties";
import { useIsGuest } from "@/hooks/useIsGuest";
import { usePropertyFilter } from "@/hooks/usePropertyFilter";
import Header from "@/components/Header";
import MapView, { MapBounds } from "@/components/MapView";
import MapSidebar from "@/components/MapSidebar";
import MapFilterBar, { FilterState, DEFAULT_FILTERS, LandlordResult } from "@/components/MapFilterBar";
import { MapProperty } from "@/data/mapProperties";
import { RadiusCircle, isInsideRadius } from "@/lib/geoDistance";
import { filterLandlordMapProperties } from "@/lib/landlordMapFilter";

const RESIDENTIAL_PROPERTIES: MapProperty[] = [];

const RESIDENTIAL_SUBTYPES = ["전체", "원룸", "투베이", "투룸", "쓰리룸", "주인세대", "아파트", "오피스텔"];

const RESIDENTIAL_DB_TYPES = ["원룸", "투베이", "투룸", "쓰리룸", "주인세대", "아파트", "오피스텔", "도시형", "고시원", "연립", "다세대", "주상복합", "단독주택", "다가구", "포룸"];

const ResidentialRental = () => {
  const isGuest = useIsGuest();
  const { ExitConfirmDialog } = useExitConfirm();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [suppressPan, setSuppressPan] = useState(false);
  const [pinnedAddress, setPinnedAddress] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<number[]>([]);
  const [showAllFromSearch, setShowAllFromSearch] = useState(false);
  const [activeTypes, setActiveTypes] = useState<string[]>(["전체"]);
  const [query, setQuery] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [landlordResults, setLandlordResults] = useState<LandlordResult[]>([]);
  const [landlordLoading, setLandlordLoading] = useState(false);
  const [landlordSearched, setLandlordSearched] = useState(false);
  const mapBoundsRef = useRef<MapBounds | null>(null);
  const [mapBoundsState, setMapBoundsState] = useState<MapBounds | null>(null);
  const [radiusMode, setRadiusMode] = useState(false);
  const [radiusCircle, setRadiusCircle] = useState<RadiusCircle | null>(null);
  const [blinkTrigger, setBlinkTrigger] = useState(0);


  const { properties: dbProperties, refetch } = useDBProperties(RESIDENTIAL_DB_TYPES);

  const allProperties = useMemo(
    () => [...RESIDENTIAL_PROPERTIES, ...dbProperties.filter(p =>
      !p.type.includes("매매") &&
      !(p.note ?? "").includes("매매가:")
    )],
    [dbProperties]
  );

  const toggleType = (t: string) => {
    if (t === "전체") { setActiveTypes(["전체"]); return; }
    setActiveTypes(prev => {
      const without전체 = prev.filter(x => x !== "전체");
      if (without전체.includes(t)) {
        const next = without전체.filter(x => x !== t);
        return next.length === 0 ? ["전체"] : next;
      }
      return [...without전체, t];
    });
  };

  const filtered = usePropertyFilter(allProperties, filters, activeTypes, query, propertyId);
  const activeType = activeTypes[0] ?? "전체";
  const mapProperties = useMemo(
    () => filterLandlordMapProperties(filtered, landlordResults, landlordSearched, landlordLoading),
    [filtered, landlordResults, landlordSearched, landlordLoading]
  );

  // 돋보기 클릭 → 현재 지도 화면 내 매물만 사이드바에 표시
  const handleSearchClick = useCallback(() => {
    const b = mapBoundsRef.current;
    setPinnedAddress(null);
    setSelectedId(null);
    setShowAllFromSearch(true);
    if (b) {
      // bounds 필터링은 sidebarProperties에서 처리
    }
  }, []);

  const handleBoundsChange = useCallback((b: MapBounds) => {
    mapBoundsRef.current = b;
    setMapBoundsState(b);
  }, []);

  // 핀 클릭: 토글만 (지도 이동/자동 해제 없음, 다중 체크 누적)
  const handlePinSelect = useCallback((id: number) => {
    const prop = filtered.find(p => p.id === id) ?? allProperties.find(p => p.id === id);
    if (!prop) return;
    setShowAllFromSearch(false);
    setSuppressPan(true);

    // 이미 체크된 핀 재클릭 → 해제
    if (pinnedIds.includes(id)) {
      const next = pinnedIds.filter(x => x !== id);
      setPinnedIds(next);
      if (selectedId === id) setSelectedId(null);
      if (next.length === 0) setPinnedAddress(null);
      setTimeout(() => setSuppressPan(false), 100);
      return;
    }

    // 새 체크 추가 (다중 체크 가능, 이동 없음)
    setPinnedIds(prev => prev.includes(id) ? prev : [...prev, id]);
    setSelectedId(id);
    setPinnedAddress(prop.address);
    setTimeout(() => setSuppressPan(false), 100);
  }, [filtered, allProperties, pinnedIds, selectedId]);

  const handleClusterSelect = useCallback((ids: number[]) => {
    if (ids.length === 0) return;
    setShowAllFromSearch(false);
    setPinnedAddress(null);
    setSuppressPan(true);
    const allSelected = ids.every(id => pinnedIds.includes(id));
    const next = allSelected
      ? pinnedIds.filter(id => !ids.includes(id))
      : ids.reduce((acc, id) => acc.includes(id) ? acc : [...acc, id], [...pinnedIds]);
    setPinnedIds(next);
    setSelectedId(allSelected ? (next[next.length - 1] ?? null) : (ids[0] ?? null));
    setTimeout(() => setSuppressPan(false), 120);
  }, [pinnedIds]);

  // 사이드바 매물: 반경 우선 → 돋보기 → 핀 선택 → 기본
  const sidebarProperties = useMemo(() => {
    const inBounds = (p: any, b: MapBounds | null) =>
      !b ? true : (p.lat && p.lng && p.lat >= b.swLat && p.lat <= b.neLat && p.lng >= b.swLng && p.lng <= b.neLng);
    if (radiusCircle) {
      return filtered.filter(p =>
        p.lat && p.lng && isInsideRadius(p.lat, p.lng, radiusCircle)
      );
    }
    if (showAllFromSearch) {
      return filtered.filter(p => inBounds(p, mapBoundsState));
    }
    if (pinnedIds.length === 0) {
      // 지도 줌/이동에 따라 화면 안 매물만 자동 표시
      return filtered.filter(p => inBounds(p, mapBoundsState));
    }
    return filtered.filter(p => pinnedIds.includes(p.id));
  }, [filtered, pinnedIds, showAllFromSearch, radiusCircle, mapBoundsState]);

  return (
    <div className="flex flex-col" style={{ height: "100vh", overflow: "hidden" }}>
      <Header onRegisterChange={setShowRegister} onMenuOpenChange={setMobileMenuOpen} />

      {/* 주거 유형 탭 - 다중 선택 (모바일에서는 숨김) */}
      <div
        className="hidden md:flex items-center gap-2 px-4 py-2 border-b border-border overflow-x-auto flex-shrink-0 sticky top-0 z-[900]"
        style={{ background: "hsl(var(--header-bg))" }}
      >
        <span className="text-white/50 text-xs font-semibold whitespace-nowrap flex-shrink-0">주거 유형</span>
        {RESIDENTIAL_SUBTYPES.map(t => {
          const isActive = activeTypes.includes(t);
          return (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className="px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-all flex-shrink-0"
              style={neonChipStyle(isActive)}
            >
              {t}
            </button>
          );
        })}
        {!activeTypes.includes("전체") && activeTypes.length > 1 && (
          <button
            onClick={() => setActiveTypes(["전체"])}
            className="ml-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border whitespace-nowrap flex-shrink-0 transition-all"
            style={{ color: "hsl(var(--destructive))", borderColor: "hsl(var(--destructive))", background: "transparent" }}
          >
            선택 삭제
          </button>
        )}

        <div className="w-px h-4 mx-1 flex-shrink-0" style={{ background: "rgba(255,255,255,0.15)" }} />
        {(["월세", "전세", "단기임대"] as const).map(dt => {
          const isActive = filters.dealType.includes(dt);
          const displayLabel = dt === "단기임대" ? "단기" : dt;
          return (
            <button
              key={dt}
              onClick={() => {
                setFilters(prev => ({
                  ...prev,
                  dealType: isActive
                    ? prev.dealType.filter(x => x !== dt)
                    : [...prev.dealType, dt],
                }));
              }}
              className="px-3.5 py-1 rounded-full text-[13px] font-extrabold border-2 whitespace-nowrap transition-all flex-shrink-0"
              style={neonChipStyle(isActive)}
            >
              {displayLabel}
            </button>
          );
        })}
        {(() => {
          const petKey = "애완동물가능";
          const isActive = filters.buildingOptions.includes(petKey);
          return (
            <button
              onClick={() => {
                setFilters(prev => ({
                  ...prev,
                  buildingOptions: isActive
                    ? prev.buildingOptions.filter(x => x !== petKey)
                    : [...prev.buildingOptions, petKey],
                }));
              }}
              className="px-3.5 py-1 rounded-full text-[13px] font-extrabold border-2 whitespace-nowrap transition-all flex-shrink-0"
              style={neonChipStyle(isActive)}
            >
              반려동물
            </button>
          );
        })()}

        {/* 매물 등록 버튼 (우측 끝) */}
        {!isGuest && (
        <button
          onClick={() => window.dispatchEvent(new Event("open-register-modal"))}
          className="ml-auto flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white whitespace-nowrap flex-shrink-0 transition-transform hover:scale-[1.02] active:scale-95"
          style={neonChipStyle(true)}
          aria-label="매물 등록"
        >
          <span className="text-sm leading-none">+</span>
          매물 등록
        </button>
        )}
      </div>

      <main
        className="flex-1 overflow-hidden flex relative"
        style={{ minHeight: 0 }}
      >
        <div className="flex-1 relative min-w-0">
          <MapView
            properties={mapProperties}
            selectedId={selectedId}
            selectedIds={pinnedIds}
            onMapMoveClear={() => { setPinnedIds([]); setPinnedAddress(null); setSelectedId(null); setShowAllFromSearch(false); }}
            onSelect={handlePinSelect}
            onClusterSelect={handleClusterSelect}
            onBoundsChange={handleBoundsChange}
            suppressPan={suppressPan}
            radiusMode={radiusMode}
            radiusCircle={radiusCircle}
            onRadiusChange={setRadiusCircle}
            blinkId={selectedId}
            blinkTrigger={blinkTrigger}
          />
          <MapFilterBar
            activeType={activeType}
            activeTypes={activeTypes}
            onTypeChange={(t) => toggleType(t)}
            onClearTypeFilters={() => setActiveTypes(["전체"])}
            query={query}
            onQueryChange={setQuery}
            propertyId={propertyId}
            onPropertyIdChange={setPropertyId}
            filters={filters}
            onFiltersChange={setFilters}
            onLandlordResults={(results, loading, searched) => {
              setLandlordResults(results);
              setLandlordLoading(loading);
              setLandlordSearched(searched);
            }}
            onSearchClick={handleSearchClick}
            propertyCount={landlordSearched ? mapProperties.length : sidebarProperties.length}
            hideSearchBar={showRegister || mobileMenuOpen}
            showResidentialTypes={true}
            showBuildingOptions={true}
            showRoomTypes={false}
            radiusMode={radiusMode}
            radiusInfo={radiusCircle ? { radius: radiusCircle.radius } : null}
            onRadiusModeToggle={() => {
              if (radiusMode) {
                setRadiusMode(false);
                setRadiusCircle(null);
              } else {
                setRadiusMode(true);
              }
            }}
          />
        </div>
        <MapSidebar
          properties={sidebarProperties}
          referencePool={allProperties}
          selectedId={selectedId}
          onSelect={(id) => {
            setSuppressPan(true);
            setSelectedId(id);
            setBlinkTrigger(n => n + 1);
            setTimeout(() => setSuppressPan(false), 600);
          }}
          onDeselect={() => setSelectedId(null)}
          activeType={activeType}
          onTypeChange={(t) => toggleType(t)}
          pinnedAddress={pinnedAddress}
          onClearPin={() => { setPinnedAddress(null); setSelectedId(null); }}
          pinnedIds={pinnedIds}
          onClearPinnedIds={() => {
            setPinnedIds([]);
            setPinnedAddress(null);
            setSelectedId(null);
            setShowAllFromSearch(false);
          }}
          landlordResults={landlordResults}
          landlordLoading={landlordLoading}
          landlordSearched={landlordSearched}
          onRefetch={refetch}
        />
      </main>
      <ExitConfirmDialog />
    </div>
  );
};

export default ResidentialRental;
