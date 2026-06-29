import { useState, useMemo, useRef, useCallback } from "react";
import { useExitConfirm } from "@/hooks/useExitConfirm";
import { useDBProperties } from "@/hooks/useDBProperties";
import { useIsGuest } from "@/hooks/useIsGuest";
import { usePropertyFilter } from "@/hooks/usePropertyFilter";
import Header from "@/components/Header";
import MapView, { MapBounds } from "@/components/MapView";
import MapSidebar from "@/components/MapSidebar";
import MapFilterBar, { FilterState, DEFAULT_FILTERS, LandlordResult } from "@/components/MapFilterBar";
import { MapProperty } from "@/data/mapProperties";
import { filterLandlordMapProperties } from "@/lib/landlordMapFilter";
import { neonChipStyle } from "@/lib/neonChipStyle";

const NON_RESIDENTIAL_PROPERTIES: MapProperty[] = [];

// 집합건물 매매로 분류되는 키 (Header의 '집합건물.매매' 메뉴)
const COLLECTIVE_SALE_KEYS = new Set([
  "건물매매", "상가건물매매", "상가주택매매", "구분상가매매",
  "아파트매매-그룹", "오피스텔매매-그룹", "연립매매-그룹", "다세대매매-그룹", "주상복합매매-그룹",
]);
// 집합건물 매매에 매핑되는 실제 type 값들
const COLLECTIVE_SALE_DB_TYPES = [
  "건물매매", "상가건물매매", "상가주택매매", "구분상가매매",
  "아파트매매", "오피스텔매매", "연립매매", "다세대매매", "주상복합매매",
  "아파트", "오피스텔", "연립", "다세대", "주상복합",
];

const FULL_NON_RESIDENTIAL_SUBTYPES = [
  { label: "전체", group: "전체", key: "전체" },
  { label: "임대전체", group: "임대", key: "임대-전체" },
  { label: "상가", group: "임대", key: "상가" },
  { label: "사무실", group: "임대", key: "사무실" },
  { label: "공장·창고", group: "임대", key: "공장·창고" },
  { label: "지식산업", group: "임대", key: "지식산업" },
  { label: "매매전체", group: "매매", key: "매매-전체" },
  { label: "상가", group: "매매", key: "상가매매" },
  { label: "사무실", group: "매매", key: "사무실매매-그룹" },
  { label: "공장·창고", group: "매매", key: "공장창고매매-그룹" },
  { label: "지식산업", group: "매매", key: "지식산업매매-그룹" },
];

// 집합건물.매매 페이지 전용 서브타입
const COLLECTIVE_SALE_SUBTYPES = [
  { label: "전체", group: "전체", key: "전체" },
  { label: "단독·건물", group: "매매", key: "건물매매" },
  { label: "아파트", group: "매매", key: "아파트매매-그룹" },
  { label: "오피스텔", group: "매매", key: "오피스텔매매-그룹" },
  { label: "도시형", group: "매매", key: "도시형매매-그룹" },
  { label: "주상복합", group: "매매", key: "주상복합매매-그룹" },
  { label: "연립", group: "매매", key: "연립매매-그룹" },
  { label: "다세대", group: "매매", key: "다세대매매-그룹" },
  { label: "분양권", group: "매매", key: "분양권매매-그룹" },
];

const NON_RESIDENTIAL_DB_TYPES = [
  "상가", "사무실", "공장·창고", "식당·카페", "병원·학원", "지식산업",
  "상가매매", "건물매매", "사무실매매",
  "상가임대", "기타임대",
  "단독매매", "상가주택매매", "상가건물매매",
  "구분상가매매", "창고/공장매매", "다가구매매", "다중매매",
  "아파트매매", "오피스텔매매", "도시형매매", "연립매매", "다세대매매", "주상복합매매", "분양권매매",
  // 주거형 type이지만 매매(note에 "매매가:")인 매물 포함을 위해 fetch
  "아파트", "오피스텔", "도시형", "연립", "다세대", "주상복합", "빌라", "단독주택", "다가구", "분양권",
];

interface NonResidentialRentalProps {
  mode?: "default" | "collective-sale";
}

const NonResidentialRental = ({ mode = "default" }: NonResidentialRentalProps) => {
  const { ExitConfirmDialog } = useExitConfirm();
  const isGuest = useIsGuest();
  const isCollectiveSale = mode === "collective-sale";
  const NON_RESIDENTIAL_SUBTYPES = isCollectiveSale ? COLLECTIVE_SALE_SUBTYPES : FULL_NON_RESIDENTIAL_SUBTYPES;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [suppressPan, setSuppressPan] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<number[]>([]);
  const [pinnedAddress, setPinnedAddress] = useState<string | null>(null);
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
  const [blinkTrigger, setBlinkTrigger] = useState(0);

  const { properties: dbProperties, refetch } = useDBProperties(NON_RESIDENTIAL_DB_TYPES);
  // 주거형 type은 매매(note에 "매매가:")인 경우에만 포함
  const RESIDENTIAL_TYPES = ["아파트", "오피스텔", "도시형", "연립", "다세대", "주상복합", "빌라", "단독주택", "다가구"];
  // 집합건물.매매 페이지에 표시될 type 집합 (매매 한정)
  const COLLECTIVE_SALE_TYPE_SET = new Set([
    "건물매매", "상가건물매매", "상가주택매매", "구분상가매매",
    "단독매매", "다가구매매", "다중매매",
    "아파트매매", "오피스텔매매", "도시형매매", "연립매매", "다세대매매", "주상복합매매", "분양권매매",
  ]);
  const isCollectiveSaleProp = (p: { type?: string; note?: string | null }) => {
    const t = p.type ?? "";
    if (COLLECTIVE_SALE_TYPE_SET.has(t)) return true;
    if (["아파트", "오피스텔", "도시형", "연립", "다세대", "주상복합", "분양권", "단독주택", "다가구"].includes(t)) {
      return (p.note ?? "").includes("매매가:");
    }
    return false;
  };
  const allProperties = useMemo(
    () => {
      const base = [
        ...NON_RESIDENTIAL_PROPERTIES,
        ...dbProperties.filter(p => {
          if (RESIDENTIAL_TYPES.includes(p.type)) {
            return (p.note ?? "").includes("매매가:") || p.type.includes("매매");
          }
          return true;
        }),
      ];
      if (isCollectiveSale) return base.filter(isCollectiveSaleProp);
      return base.filter(p => !isCollectiveSaleProp(p));
    },
    [dbProperties, isCollectiveSale]
  );


  const toggleType = (k: string) => {
    if (k === "전체") { setActiveTypes(["전체"]); return; }
    setActiveTypes(prev => {
      const w = prev.filter(x => x !== "전체");
      if (w.includes(k)) { const n = w.filter(x => x !== k); return n.length === 0 ? ["전체"] : n; }
      return [...w, k];
    });
  };

  const ALL_SALE_TYPES = [
    "상가매매", "사무실매매", "지식산업매매", "창고/공장매매",
    "사무실", "지식산업", "공장·창고",
  ];

  const nonResidentialTypeLabels = useMemo(() => {
    if (activeTypes.includes("전체")) return ["전체"];
    if (activeTypes.includes("임대-전체")) return ["상가", "사무실", "공장·창고", "지식산업", "상가임대", "기타임대"];
    if (activeTypes.includes("매매-전체")) return ALL_SALE_TYPES;
    const expansionMap: Record<string, string[]> = {
      "건물매매": ["건물매매", "단독매매", "다가구매매", "다중매매", "상가주택매매", "상가건물매매"],
      "사무실매매-그룹": ["사무실", "사무실매매"],
      "지식산업매매-그룹": ["지식산업", "지식산업매매"],
      "공장창고매매-그룹": ["공장·창고", "창고/공장매매"],
      "아파트매매-그룹": ["아파트", "아파트매매"],
      "오피스텔매매-그룹": ["오피스텔", "오피스텔매매"],
      "도시형매매-그룹": ["도시형", "도시형매매"],
      "연립매매-그룹": ["연립", "연립매매"],
      "다세대매매-그룹": ["다세대", "다세대매매"],
      "주상복합매매-그룹": ["주상복합", "주상복합매매"],
      "분양권매매-그룹": ["분양권", "분양권매매"],
    };
    return activeTypes.flatMap(t => expansionMap[t] ?? [t]);
  }, [activeTypes]);

  const groupDealMode = useMemo<"all" | "rental" | "sale">(() => {
    if (activeTypes.includes("전체")) return "all";
    const RENTAL_KEYS = new Set(["임대-전체", "상가", "사무실", "공장·창고", "지식산업"]);
    const SALE_KEYS = new Set([
      "매매-전체", "상가매매", "사무실매매-그룹",
      "지식산업매매-그룹", "공장창고매매-그룹",
    ]);
    const hasRental = activeTypes.some(t => RENTAL_KEYS.has(t));
    const hasSale = activeTypes.some(t => SALE_KEYS.has(t));
    if (hasRental && !hasSale) return "rental";
    if (hasSale && !hasRental) return "sale";
    return "all";
  }, [activeTypes]);

  const rawFiltered = usePropertyFilter(allProperties, filters, nonResidentialTypeLabels, query, propertyId);
  const filtered = useMemo(() => {
    const isSale = (p: { type?: string; note?: string | null }) =>
      (p.type ?? "").includes("매매") || (p.note ?? "").includes("매매가:");
    if (groupDealMode === "all") return rawFiltered;
    if (groupDealMode === "sale") return rawFiltered.filter(isSale);
    return rawFiltered.filter(p => !isSale(p));
  }, [rawFiltered, groupDealMode]);
  const activeType = activeTypes[0] ?? "전체";
  const mapProperties = useMemo(
    () => filterLandlordMapProperties(filtered, landlordResults, landlordSearched, landlordLoading),
    [filtered, landlordResults, landlordSearched, landlordLoading]
  );

  const handleBoundsChange = useCallback((b: MapBounds) => { mapBoundsRef.current = b; setMapBoundsState(b); }, []);

  const handleSearchClick = useCallback(() => {
    setPinnedIds([]); setPinnedAddress(null); setSelectedId(null); setShowAllFromSearch(true);
  }, []);

  const handlePinSelect = useCallback((id: number) => {
    const prop = filtered.find(p => p.id === id) ?? allProperties.find(p => p.id === id);
    if (!prop) { setSelectedId(prev => prev === id ? null : id); return; }
    setShowAllFromSearch(false);
    setSuppressPan(true);
    if (pinnedIds.includes(id)) {
      const next = pinnedIds.filter(x => x !== id);
      setPinnedIds(next);
      if (selectedId === id) setSelectedId(null);
      if (next.length === 0) setPinnedAddress(null);
      setTimeout(() => setSuppressPan(false), 100);
      return;
    }
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

  const sidebarProperties = useMemo(() => {
    const b = mapBoundsState;
    const inBounds = (p: any) => !b ? true : (p.lat && p.lng && p.lat >= b.swLat && p.lat <= b.neLat && p.lng >= b.swLng && p.lng <= b.neLng);
    if (showAllFromSearch) return filtered.filter(inBounds);
    if (pinnedIds.length === 0) return filtered.filter(inBounds);
    return filtered.filter(p => pinnedIds.includes(p.id));
  }, [filtered, pinnedIds, showAllFromSearch, mapBoundsState]);

  return (
    <div className="flex flex-col" style={{ height: "100vh", overflow: "hidden" }}>
      <Header onRegisterChange={setShowRegister} onMenuOpenChange={setMobileMenuOpen} />

      <div
        className="hidden md:flex items-center gap-2 px-4 py-2 border-b border-border overflow-x-auto flex-shrink-0 sticky top-0 z-[900]"
        style={{ background: "hsl(var(--header-bg))" }}
      >
        {NON_RESIDENTIAL_SUBTYPES.filter(t => t.group === "전체").map(t => {
          const isActive = activeTypes.includes(t.key);
          return (
            <button key={t.key} onClick={() => toggleType(t.key)}
              className="px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-all flex-shrink-0"
              style={neonChipStyle(isActive)}
            >{t.label}</button>
          );
        })}

        {!isCollectiveSale && (
          <>
            <div className="w-px h-4 mx-1 flex-shrink-0" style={{ background: "rgba(255,255,255,0.15)" }} />

            <span className="text-[12px] font-extrabold whitespace-nowrap flex-shrink-0 px-2 py-0.5 rounded-md" style={{ color: "hsl(var(--accent))", background: "hsl(var(--accent) / 0.12)", border: "1px solid hsl(var(--accent) / 0.4)" }}>임대</span>
            {NON_RESIDENTIAL_SUBTYPES.filter(t => t.group === "임대").map(t => {
              const isActive = activeTypes.includes(t.key);
              return (
                <button key={t.key} onClick={() => toggleType(t.key)}
                  className="px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-all flex-shrink-0"
                  style={neonChipStyle(isActive)}
                >{t.label}</button>
              );
            })}
          </>
        )}

        <div className="w-px h-4 mx-1 flex-shrink-0" style={{ background: "rgba(255,255,255,0.15)" }} />

        <span className="text-[12px] font-extrabold whitespace-nowrap flex-shrink-0 px-2 py-0.5 rounded-md" style={{ color: "hsl(var(--accent))", background: "hsl(var(--accent) / 0.12)", border: "1px solid hsl(var(--accent) / 0.4)" }}>매매</span>
        {NON_RESIDENTIAL_SUBTYPES.filter(t => t.group === "매매").map(t => {
          const isActive = activeTypes.includes(t.key);
          return (
            <button key={t.key} onClick={() => toggleType(t.key)}
              className="px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-all flex-shrink-0"
              style={neonChipStyle(isActive)}
            >{t.label}</button>
          );
        })}

        {!activeTypes.includes("전체") && (
          <button
            onClick={() => setActiveTypes(["전체"])}
            className="ml-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border whitespace-nowrap flex-shrink-0 transition-all"
            style={{ color: "hsl(var(--destructive))", borderColor: "hsl(var(--destructive))", background: "transparent" }}
          >
            선택 삭제
          </button>
        )}
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
            nonResidentialSubtypes={NON_RESIDENTIAL_SUBTYPES}
            showRoomTypes={false}
            hideRentalAndPrice={isCollectiveSale}
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
            setPinnedIds([]); setPinnedAddress(null); setSelectedId(null); setShowAllFromSearch(false);
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

export default NonResidentialRental;
