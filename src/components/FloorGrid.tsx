import { useState, useMemo } from "react";

interface ExposFloor {
  flrNo?: string | null;
  flrNoNm?: string | null;
  area?: string | null;
  pubuseGbCdNm?: string | null;
  mainPurpsCdNm?: string | null;
  etcPurps?: string | null;
  exposPubuseGbCdNm?: string | null;
  hoNm?: string | null;
}

interface FloorGridProps {
  exposFloors: ExposFloor[];
  dongName?: string;
}

function parseFloorNum(f: ExposFloor): number {
  const raw = f.flrNo ?? f.flrNoNm ?? "0";
  const n = parseInt(String(raw).replace(/[^0-9-]/g, "")) || 0;
  return n;
}

function parseHoNum(ho: string): number {
  return parseInt(ho.replace(/[^0-9]/g, "")) || 0;
}

function areaToNum(area?: string | null): number {
  if (!area) return 0;
  return parseFloat(area.replace(/[^0-9.]/g, "")) || 0;
}

export default function FloorGrid({ exposFloors, dongName }: FloorGridProps) {
  const [hoveredUnit, setHoveredUnit] = useState<ExposFloor | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Private units (전유부) with hoNm
  const privateUnits = useMemo(() => {
    return exposFloors.filter(
      (e) => e.hoNm && e.exposPubuseGbCdNm !== "공용" && e.pubuseGbCdNm !== "공용"
    );
  }, [exposFloors]);

  // Group by area size for color coding (private units only)
  const areaGroups = useMemo(() => {
    const map = new Map<string, { count: number; color: string }>();
    privateUnits.forEach((u) => {
      const areaKey = u.area ?? "기타";
      if (!map.has(areaKey)) map.set(areaKey, { count: 0, color: "" });
      map.get(areaKey)!.count++;
    });

    const colors = [
      "hsl(0 70% 85%)",
      "hsl(210 60% 85%)",
      "hsl(142 50% 85%)",
      "hsl(45 80% 85%)",
      "hsl(280 50% 85%)",
      "hsl(20 70% 85%)",
    ];
    let ci = 0;
    map.forEach((val) => {
      val.color = colors[ci % colors.length];
      ci++;
    });
    return map;
  }, [privateUnits]);

  // Build grid: use ALL entries to build complete floor list (no gaps)
  const gridData = useMemo(() => {
    const floorMap = new Map<number, ExposFloor[]>();
    // Register ALL floors (including 공용-only floors) so no floor is skipped
    exposFloors.forEach((u) => {
      const fNum = parseFloorNum(u);
      if (!floorMap.has(fNum)) floorMap.set(fNum, []);
    });
    // Add private units to their floors
    privateUnits.forEach((u) => {
      const fNum = parseFloorNum(u);
      if (!floorMap.has(fNum)) floorMap.set(fNum, []);
      floorMap.get(fNum)!.push(u);
    });

    floorMap.forEach((arr) => arr.sort((a, b) => parseHoNum(a.hoNm!) - parseHoNum(b.hoNm!)));

    const maxCols = Math.max(...Array.from(floorMap.values()).map((arr) => arr.length), 1);
    const floors = Array.from(floorMap.keys()).sort((a, b) => b - a);

    return { floorMap, floors, maxCols };
  }, [exposFloors, privateUnits]);

  if (privateUnits.length === 0 && exposFloors.length === 0) return null;

  const { floorMap, floors, maxCols } = gridData;

  const handleMouseEnter = (e: React.MouseEvent, unit: ExposFloor) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 4 });
    setHoveredUnit(unit);
  };

  return (
    <div className="px-3 mt-3 mb-2">
      <h3 className="text-[13px] font-extrabold text-foreground mb-2">
        {dongName ? `${dongName} 층별내역` : "층별내역"}
      </h3>

      {/* Area legend */}
      {areaGroups.size > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {Array.from(areaGroups.entries())
            .sort((a, b) => areaToNum(a[0]) - areaToNum(b[0]))
            .map(([area, info]) => (
            <span
              key={area}
              className="text-[10px] font-bold px-2 py-0.5 rounded border border-border/50"
              style={{ background: info.color }}
            >
              {area} <span className="text-muted-foreground font-normal">({info.count})</span>
            </span>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto border border-border/50 rounded-lg" style={{ maxHeight: 320, overflowY: "auto" }}>
        <table className="border-collapse w-full" style={{ minWidth: `${maxCols * 38 + 30}px` }}>
          <tbody>
            {floors.map((fNum) => {
              const rowUnits = floorMap.get(fNum) || [];
              const floorLabel = fNum < 0 ? `B${Math.abs(fNum)}` : `${fNum}F`;
              const isEmptyFloor = rowUnits.length === 0;
              return (
                <tr key={fNum}>
                  <td className="py-0 px-1 text-[9px] font-bold text-muted-foreground text-right whitespace-nowrap border-r border-border/30 bg-muted/20" style={{ width: 28, lineHeight: "16px" }}>
                    {floorLabel}
                  </td>
                  {isEmptyFloor ? (
                    <td
                      colSpan={maxCols}
                      className="text-center text-[8px] text-muted-foreground/50 italic border border-border/10 bg-muted/10"
                      style={{ padding: "1px 2px", lineHeight: "14px" }}
                    >
                      공용
                    </td>
                  ) : (
                    <>
                      {rowUnits.map((unit, ci) => {
                        const areaKey = unit.area ?? "기타";
                        const bg = areaGroups.get(areaKey)?.color ?? "hsl(var(--muted))";
                        const hoLabel = unit.hoNm?.replace(/호$/, "") ?? "";
                        return (
                          <td
                            key={ci}
                            className="text-center cursor-pointer border border-border/20 transition-all hover:ring-1 hover:ring-primary/50 hover:z-10 relative"
                            style={{
                              background: bg,
                              minWidth: 36,
                              padding: "0px 1px",
                              lineHeight: "12px",
                            }}
                            onMouseEnter={(e) => handleMouseEnter(e, unit)}
                            onMouseLeave={() => setHoveredUnit(null)}
                          >
                            <span className="block text-[8px] font-bold text-foreground/80 leading-none pt-[1px]">{hoLabel}</span>
                            {unit.area && (
                              <span className="block text-[6px] text-foreground/50 leading-none pb-[1px]">{parseFloat(String(unit.area).replace(/[^0-9.]/g, "")).toFixed(1)}㎡</span>
                            )}
                          </td>
                        );
                      })}
                      {Array.from({ length: maxCols - rowUnits.length }).map((_, i) => (
                        <td key={`e-${i}`} className="border border-border/10" style={{ minWidth: 36, padding: "1px" }}>
                          <span className="text-[8px] text-transparent">·</span>
                        </td>
                      ))}
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tooltip */}
      {hoveredUnit && (
        <div
          className="fixed z-[10000] pointer-events-none px-3 py-2 rounded-lg shadow-lg border border-border/60 text-[10px] leading-relaxed"
          style={{
            background: "hsl(var(--background))",
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: "translate(-50%, -100%)",
            maxWidth: 220,
          }}
        >
          <div className="font-extrabold text-[11px] text-foreground mb-0.5">
            {hoveredUnit.hoNm ?? "-"}
          </div>
          <div className="text-muted-foreground">
            <span className="font-semibold text-foreground">용도:</span>{" "}
            {hoveredUnit.mainPurpsCdNm || hoveredUnit.etcPurps || "-"}
          </div>
          <div className="text-muted-foreground">
            <span className="font-semibold text-foreground">면적:</span>{" "}
            {hoveredUnit.area ?? "-"}
          </div>
          <div className="text-muted-foreground">
            <span className="font-semibold text-foreground">구분:</span>{" "}
            {hoveredUnit.exposPubuseGbCdNm || hoveredUnit.pubuseGbCdNm || "-"}
          </div>
        </div>
      )}

      <p className="text-[9px] text-muted-foreground/50 mt-1 italic">
        * 호실 위에 마우스를 올리면 전유부 상세정보를 확인할 수 있습니다.
      </p>
    </div>
  );
}
