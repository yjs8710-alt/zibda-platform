import { useEffect, useState } from "react";
import { isRoadName, roadToJibun } from "@/lib/roadToJibun";

interface Props {
  dong: string;
  lotNumber?: string | null;
  district?: string | null;
  className?: string;
}

/**
 * dong 또는 lot_number가 도로명 형태면 구주소(지번)로 변환해 작게 표시.
 * 도로명이 아니면 아무것도 렌더링하지 않음.
 */
export default function JibunAddressBadge({ dong, lotNumber, district, className }: Props) {
  const [jibun, setJibun] = useState<string>("");
  const combined = [dong, lotNumber].filter((v) => v && v.trim()).join(" ").trim();
  const looksLikeRoad = isRoadName(dong) || isRoadName(combined);

  useEffect(() => {
    if (!looksLikeRoad || !combined) return;
    let cancelled = false;
    roadToJibun(combined, district ?? undefined).then((res) => {
      if (!cancelled) setJibun(res);
    });
    return () => {
      cancelled = true;
    };
  }, [combined, district, looksLikeRoad]);

  if (!looksLikeRoad || !jibun) return null;
  return (
    <span
      className={className ?? "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"}
      style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
      title="도로명 → 구주소 자동 변환"
    >
      구주소: {jibun}
    </span>
  );
}
