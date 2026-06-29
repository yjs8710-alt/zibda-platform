import { Search, SlidersHorizontal, X, ChevronDown } from "lucide-react";

const TYPES = [
  { label: "전체", icon: "🗺" },
  { label: "상가", icon: "🏪" },
  { label: "사무실", icon: "🏢" },
  { label: "식당·카페", icon: "🍽" },
  { label: "공장·창고", icon: "🏭" },
  { label: "병원·학원", icon: "🏥" },
];

interface MapSearchBarProps {
  query: string;
  onQueryChange: (v: string) => void;
  activeType: string;
  onTypeChange: (v: string) => void;
}

const MapSearchBar = ({ query, onQueryChange, activeType, onTypeChange }: MapSearchBarProps) => (
  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-xl px-4 pointer-events-none">
    <div className="pointer-events-auto rounded-2xl overflow-hidden"
      style={{ boxShadow: "0 8px 32px rgba(10,45,110,0.18), 0 2px 8px rgba(0,0,0,0.12)" }}
    >
      {/* Search row */}
      <div className="flex items-center bg-white">
        {/* Region selector */}
        <button className="flex items-center gap-1 px-4 border-r border-border h-12 flex-shrink-0 hover:bg-muted/40 transition-colors">
          <span className="text-xs font-bold text-primary whitespace-nowrap">서울 전체</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>

        {/* Input */}
        <div className="flex items-center flex-1 px-3 gap-2">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="지역, 건물명, 역명으로 검색"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground h-12"
          />
          {query && (
            <button onClick={() => onQueryChange("")} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter */}
        <button className="flex items-center gap-1.5 px-3 h-12 border-l border-border text-muted-foreground hover:text-primary transition-colors">
          <SlidersHorizontal className="w-4 h-4" />
          <span className="text-xs font-medium hidden sm:block">필터</span>
        </button>

        {/* Search button */}
        <button className="h-12 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-colors rounded-r-none"
          style={{ borderRadius: "0" }}
        >
          검색
        </button>
      </div>

      {/* Type filter chips */}
      <div className="flex gap-1.5 px-3 py-2.5 bg-primary/5 border-t border-border overflow-x-auto scrollbar-none">
        {TYPES.map((t) => (
          <button
            key={t.label}
            onClick={() => onTypeChange(t.label)}
            className={`flex items-center gap-1 flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 ${
              activeType === t.label
                ? "bg-primary text-primary-foreground shadow-md scale-105"
                : "bg-white text-foreground border border-border hover:border-primary hover:text-primary"
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  </div>
);

export default MapSearchBar;
