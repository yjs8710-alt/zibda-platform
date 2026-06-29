import { useEffect, useState } from "react";
import { isRoadName, roadToJibun } from "@/lib/roadToJibun";

interface Props {
  /** 원본 주소(도로명일 수 있음) */
  address: string;
  /** 매물 DB의 dong/lot_number가 있으면 우선 사용 */
  dong?: string | null;
  lotNumber?: string | null;
  district?: string | null;
  className?: string;
}

/**
 * 도로명 주소면 지번(번지수) 주소로 변환해 표시.
 * dong+lot_number가 이미 지번이면 곧바로 사용.
 */
export default function JibunInlineAddress({ address, dong, lotNumber, district, className }: Props) {
  const [resolved, setResolved] = useState<string>("");

  // 1) DB에 jibun이 이미 있는 경우 우선 사용
  const dbJibun = (() => {
    const d = (dong ?? "").trim();
    const lot = (lotNumber ?? "").trim();
    if (!d) return "";
    if (isRoadName(d)) return ""; // dong이 도로명이면 변환 필요
    return [district, d, lot].filter(Boolean).join(" ").trim();
  })();

  useEffect(() => {
    if (dbJibun) { setResolved(dbJibun); return; }
    if (!address) { setResolved(""); return; }
    if (!isRoadName(address)) { setResolved(address); return; }

    let cancelled = false;
    roadToJibun(address, district ?? undefined).then((res) => {
      if (cancelled) return;
      setResolved(res || address);
    });
    return () => { cancelled = true; };
  }, [address, dbJibun, district]);

  return <span className={className}>{resolved || address}</span>;
}
