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

const LAND_PROPERTIES: MapProperty[] = [];

const LAND_SUBTYPES = ["전체"];

const LandSearch = () => {
  const { ExitConfirmDialog } = useExitConfirm();
  const isGuest = useIsGuest();
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

  const { properties: dbProperties, refetch } = useDBProperties(["토지"]);
  const allProperties = useMemo(() => [...LAND_PROPERTIES, ...dbProperties], [dbProperties]);

  const toggleType = (t: string) => {
    if (t === "전체") { setActiveTypes(["전체"]); return; }
    setActiveTypes(prev => {
      const w = prev.filter(x => x !== "전체");
      if (w.includes(t)) { const n = w.filter(x => x !== t); return n.length === 0 ? ["전체"] : n; }
      return [...w, t];
    });
  };

  const landTypeFilter = useMemo(() => activeTypes.includes("전체") ? ["전체"] : activeTypes, [activeTypes]);
  const filtered = usePropertyFilter(allProperties, filters, landTypeFilter, query, propertyId);
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
    if (pinnedIds.includes(id)) {
      setSuppressPan(true);
      const next = pinnedIds.filter(x => x !== id);
      setPinnedIds(next);
      setSelectedId(null);
      if (next.length === 0) setPinnedAddress(null);
      setTimeout(() => setSuppressPan(false), 100);
      return;
    }
    const sameAddrIds = allProperties.filter(p => p.address === prop.address).map(p => p.id);
    setSuppressPan(false);
    setPinnedIds(prev => { const m = [...prev]; sameAddrIds.forEach(s => { if (!m.includes(s)) m.push(s); }); return m; });
    setSelectedId(id);
    setPinnedAddress(prop.address);
  }, [filtered, allProperties, pinnedIds]);

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
        {!isGuest && (
        <button
          onClick={() => window.dispatchEvent(new Event("open-register-modal"))}
          className="ml-auto flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white whitespace-nowrap flex-shrink-0 transition-transform hover:scale-[1.02] active:scale-95"
          style={{ background: "linear-gradient(90deg, #22d3ee 0%, #a855f7 50%, #ec4899 100%)" }}
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
          />
          <MapFilterBar
            activeType={activeType}
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
            showRoomTypes={false}
            showFloor={false}
            showBuildYear={false}
            showLandFilters={true}
          />
        </div>
        <MapSidebar
          properties={sidebarProperties}
          referencePool={allProperties}
          selectedId={selectedId}
          onSelect={(id) => {
            setSuppressPan(true);
            setSelectedId(id);
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

export default LandSearch;
