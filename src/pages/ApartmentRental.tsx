import { useState, useMemo, useRef, useCallback } from "react";
import { usePropertyFilter } from "@/hooks/usePropertyFilter";
import Header from "@/components/Header";
import MapView, { MapBounds } from "@/components/MapView";
import MapSidebar from "@/components/MapSidebar";
import MapFilterBar, { FilterState, DEFAULT_FILTERS, LandlordResult } from "@/components/MapFilterBar";

import { useDBProperties } from "@/hooks/useDBProperties";
import { MapProperty } from "@/data/mapProperties";
import { filterLandlordMapProperties } from "@/lib/landlordMapFilter";

const APARTMENT_PROPERTIES: MapProperty[] = [];

const APARTMENT_SUBTYPES = ["아파트", "오피스텔", "연립/다세대", "분양권"];
const APARTMENT_DEAL_TYPES = ["매매", "전세", "월세"];

const APARTMENT_DB_TYPES = ["아파트", "오피스텔", "연립", "다세대", "주상복합", "아파트매매", "오피스텔매매"];

const ApartmentRental = () => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [suppressPan, setSuppressPan] = useState(false);
  const [pinnedAddress, setPinnedAddress] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<number[]>([]);
  const [showAllFromSearch, setShowAllFromSearch] = useState(false);
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [activeDealTypes, setActiveDealTypes] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [landlordResults, setLandlordResults] = useState<LandlordResult[]>([]);
  const [landlordLoading, setLandlordLoading] = useState(false);
  const [landlordSearched, setLandlordSearched] = useState(false);
  const mapBoundsRef = useRef<MapBounds | null>(null);
  const [mapBoundsState, setMapBoundsState] = useState<MapBounds | null>(null);

  const { properties: dbProperties, refetch } = useDBProperties(APARTMENT_DB_TYPES);
  const allProperties = useMemo(() => [...APARTMENT_PROPERTIES, ...dbProperties], [dbProperties]);

  const toggleType = (t: string) => setActiveTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  const toggleDealType = (t: string) => setActiveDealTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const aptTypeFilter = activeTypes.length === 0 ? ["전체"] : activeTypes;
  const mergedFilters = useMemo(() => ({
    ...filters,
    dealType: activeDealTypes.length > 0 ? activeDealTypes : filters.dealType,
  }), [filters, activeDealTypes]);
  const filtered = usePropertyFilter(allProperties, mergedFilters, aptTypeFilter, query, propertyId);
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
    if (!prop) return;
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
      <Header onRegisterChange={setShowRegister} />

      <div
        className="flex items-center gap-2 px-4 py-2 border-b border-border overflow-x-auto flex-shrink-0 sticky top-0 z-[900]"
        style={{ background: "hsl(var(--header-bg))" }}
      >
        <span className="text-white/40 text-[10px] font-semibold whitespace-nowrap flex-shrink-0">종 류</span>
        {APARTMENT_SUBTYPES.map(t => {
          const isActive = activeTypes.includes(t);
          return (
            <button key={t} onClick={() => toggleType(t)}
              className="px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-all flex-shrink-0"
              style={isActive ? { background: "hsl(var(--accent))", color: "#fff", borderColor: "hsl(var(--accent))" } : { background: "transparent", color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.2)" }}
            >{t}</button>
          );
        })}
        {activeTypes.length > 0 && (
          <button onClick={() => setActiveTypes([])}
            className="px-2.5 py-1 rounded-full text-[10px] font-semibold border whitespace-nowrap flex-shrink-0 transition-all"
            style={{ color: "hsl(var(--destructive))", borderColor: "hsl(var(--destructive))", background: "transparent" }}
          >선택 삭제</button>
        )}

        <div className="w-px h-4 mx-1 flex-shrink-0" style={{ background: "rgba(255,255,255,0.15)" }} />

        <span className="text-white/40 text-[10px] font-semibold whitespace-nowrap flex-shrink-0">매전월</span>
        {APARTMENT_DEAL_TYPES.map(t => {
          const isActive = activeDealTypes.includes(t);
          return (
            <button key={t} onClick={() => toggleDealType(t)}
              className="px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-all flex-shrink-0"
              style={isActive ? { background: "hsl(var(--accent))", color: "#fff", borderColor: "hsl(var(--accent))" } : { background: "transparent", color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.2)" }}
            >{t}</button>
          );
        })}
        {activeDealTypes.length > 0 && (
          <button onClick={() => setActiveDealTypes([])}
            className="px-2.5 py-1 rounded-full text-[10px] font-semibold border whitespace-nowrap flex-shrink-0 transition-all"
            style={{ color: "hsl(var(--destructive))", borderColor: "hsl(var(--destructive))", background: "transparent" }}
          >선택 삭제</button>
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
            activeTypes={activeTypes}
            onTypeChange={(t) => toggleType(t)}
            onClearTypeFilters={() => setActiveTypes([])}
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
            hideSearchBar={showRegister}
            showCategoryChips={false}
            showRoomTypes={false}
            showApartmentFilters={true}
            apartmentActiveTypes={activeTypes}
            onApartmentTypeChange={toggleType}
            onClearApartmentTypes={() => setActiveTypes([])}
            apartmentDealTypes={activeDealTypes}
            onApartmentDealTypeChange={toggleDealType}
            onClearApartmentDealTypes={() => setActiveDealTypes([])}
          />
        </div>
        <MapSidebar
          properties={sidebarProperties}
          referencePool={allProperties}
          selectedId={selectedId}
          onSelect={setSelectedId}
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
    </div>
  );
};

export default ApartmentRental;
