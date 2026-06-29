/**
 * 건축물대장 원본 응답 → 표시값 변환 공통 유틸
 * Edge Function의 mapBuildingData와 동일한 로직을 프론트엔드에서도 사용
 */

export interface BuildingMapped {
  /** 사용승인일 (YYYY-MM-DD 또는 원본 8자리) */
  approvalDate: string | null;
  /** 건축연도 4자리 (매물카드용) */
  buildYear: string | null;
  /** 엘리베이터 있음/없음 */
  elevator: boolean;
  /** 엘리베이터 상세 문자열 ex) "있음 (일반 2대, 비상 1대)" */
  elevatorDetail: string;
  /** 승용 엘리베이터 수 */
  elevRide: number;
  /** 비상용 엘리베이터 수 */
  elevEmg: number;
  /** 내진능력 */
  seismicAblty: string | null;
  /** 내진설계 적용 여부 "적용" | "미적용" | null */
  seismicDesign: string | null;
}

/**
 * null / 빈값 / 숫자 0 / "Y"/"N" / "있음"/"없음" 을 모두 정규화한다.
 * - "Y" → true, "N" → false
 * - "있음" / "1" 이상 숫자 → true
 * - 나머지 → false
 */
export function normalizeYN(v: unknown): boolean {
  if (v == null || v === "") return false;
  const s = String(v).trim().toUpperCase();
  if (s === "Y" || s === "있음" || s === "TRUE" || s === "1") return true;
  const n = Number(v);
  if (!isNaN(n) && n > 0) return true;
  return false;
}

/**
 * 원본 건축물대장 API 응답(item)에서 표시에 필요한 값을 추출·가공한다.
 * building_summary._raw 또는 직접 API 응답 item 모두 허용.
 */
export function mapBuildingRaw(raw: Record<string, unknown> | null | undefined): BuildingMapped {
  if (!raw) {
    return { approvalDate: null, buildYear: null, elevator: false, elevatorDetail: "없음", elevRide: 0, elevEmg: 0, seismicAblty: null, seismicDesign: null };
  }

  // ── 1. 사용승인일 ─────────────────────────────────────────────────
  let approvalDate: string | null = null;
  const raw_useAprDay = raw.useAprDay ?? raw.useAprDayBefore ?? null;
  if (typeof raw_useAprDay === "string" && raw_useAprDay.trim().length === 8 && /^\d{8}$/.test(raw_useAprDay.trim())) {
    const d = raw_useAprDay.trim();
    approvalDate = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
  } else if (typeof raw_useAprDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw_useAprDay.trim())) {
    approvalDate = raw_useAprDay.trim(); // 이미 YYYY-MM-DD
  }

  // building_summary.approval_date가 이미 있으면 우선
  if (!approvalDate && typeof raw.approval_date === "string" && raw.approval_date.length >= 4) {
    approvalDate = raw.approval_date;
  }

  const buildYear = approvalDate ? approvalDate.slice(0, 4) : null;

  // ── 2. 엘리베이터 수 ─────────────────────────────────────────────
  // 승용: rideUseElvtCnt (아파트/집합건물), elevCnt (일반건물), rawRideUseElvtCnt
  const elevRide = Number(
    raw.rideUseElvtCnt ?? raw.rawRideUseElvtCnt ?? raw.elevCnt ?? raw.rawElevCnt ?? raw.elvCnt ?? 0
  );
  // 비상: emgElevCnt, rawEmgElevCnt, emrgncyElvtCnt
  const elevEmg = Number(
    raw.emgElevCnt ?? raw.rawEmgElevCnt ?? raw.emrgncyElvtCnt ?? 0
  );
  const elevTotal = elevRide + elevEmg;

  // elevYn / elevYn 필드 fallback
  const elevYnField = raw.elevYn ?? raw.rawElevYn ?? raw.elvtYn ?? null;
  const elevator = elevTotal > 0 || normalizeYN(elevYnField);

  let elevatorDetail: string;
  if (elevTotal > 0) {
    if (elevEmg > 0) {
      elevatorDetail = `있음 (일반 ${elevRide}대, 비상 ${elevEmg}대)`;
    } else {
      elevatorDetail = `있음 (${elevRide}대)`;
    }
  } else if (elevator) {
    elevatorDetail = "있음";
  } else {
    elevatorDetail = "없음";
  }

  // 이미 가공된 elevatorDetail 문자열이 _raw에 있으면 우선 사용
  if (typeof raw.elevatorDetail === "string" && raw.elevatorDetail.length > 0) {
    elevatorDetail = raw.elevatorDetail;
  }

  // ── 3. 내진 ───────────────────────────────────────────────────────
  const seismicAblty: string | null = (raw.erthqkAblty as string) || null;

  let seismicDesign: string | null = null;
  const dyn = raw.erthqkDsgnApplyYn;
  if (dyn != null && dyn !== "") {
    const s = String(dyn).trim().toUpperCase();
    seismicDesign = s === "Y" ? "적용" : s === "N" ? "미적용" : String(dyn);
  }

  console.log("🏢 [building raw]", JSON.stringify({
    useAprDay: raw_useAprDay,
    rideUseElvtCnt: raw.rideUseElvtCnt,
    elevCnt:        raw.elevCnt,
    rawElevCnt:     raw.rawElevCnt,
    rawRideUseElvtCnt: raw.rawRideUseElvtCnt,
    emgElevCnt:     raw.emgElevCnt,
    rawEmgElevCnt:  raw.rawEmgElevCnt,
    elevYn:         raw.elevYn,
    rawElevYn:      raw.rawElevYn,
    erthqkAblty:    raw.erthqkAblty,
    erthqkDsgnApplyYn: raw.erthqkDsgnApplyYn,
  }));

  console.log("🏢 [building mapped]", JSON.stringify({ approvalDate, buildYear, elevator, elevatorDetail, elevRide, elevEmg, seismicAblty, seismicDesign }));
  console.log("🏢 [elevator counts]", `ride=${elevRide} emg=${elevEmg} total=${elevTotal} elevYn=${elevYnField} → ${elevatorDetail}`);

  return { approvalDate, buildYear, elevator, elevatorDetail, elevRide, elevEmg, seismicAblty, seismicDesign };
}

/**
 * building_summary DB row (with optional _raw) → BuildingMapped
 */
export function mapBuildingFromDB(building: Record<string, unknown> | null): BuildingMapped {
  if (!building) return mapBuildingRaw(null);

  const raw = (building._raw && typeof building._raw === "object")
    ? (building._raw as Record<string, unknown>)
    : null;

  // _raw가 있으면 원본 기반으로 재계산 (가장 정확)
  if (raw) {
    // raw에 approval_date를 주입해서 mapBuildingRaw가 인식하게
    const merged = { ...raw, approval_date: building.approval_date };
    return mapBuildingRaw(merged);
  }

  // _raw 없이 DB 컬럼만 있는 경우 (캐시 hit)
  const approvalDate = typeof building.approval_date === "string" && building.approval_date.length >= 4
    ? building.approval_date
    : null;
  const buildYear = approvalDate ? approvalDate.slice(0, 4) : null;
  const elevator  = building.elevator === true;
  const elevatorDetail = elevator ? "있음" : "없음";

  console.log("🏢 [building mapped from DB cache]", JSON.stringify({ approvalDate, buildYear, elevator }));
  return { approvalDate, buildYear, elevator, elevatorDetail, elevRide: 0, elevEmg: 0, seismicAblty: null, seismicDesign: null };
}

/* ─── 세대수 / 가구수 / 호수 표시 유틸 ─── */

/** 숫자(또는 "12세대" 같은 문자열) 받아 양수면 "${n}${suffix}", 아니면 "미기재" */
export function formatUnitCount(value: unknown, suffix: string): string {
  if (value === null || value === undefined || value === "") return "미기재";
  const digits = String(value).replace(/[^0-9.]/g, "");
  if (!digits) return "미기재";
  const n = Number(digits);
  if (!isFinite(n) || n <= 0) return "미기재";
  return `${Math.round(n)}${suffix}`;
}

/**
 * 주용도에 따라 세대/가구/호 중 우선 표시 키를 반환.
 * - 다가구/원룸/상가주택 → "fmly" (가구수 우선)
 * - 아파트/오피스텔/연립/다세대 → "hhld" (세대수 우선, 호수 보조)
 * - 그 외는 가장 큰 값을 우선
 */
export function pickPrimaryCountKey(
  mainPurpose: string | null | undefined,
  counts: { hhld?: unknown; fmly?: unknown; ho?: unknown }
): "hhld" | "fmly" | "ho" {
  const p = String(mainPurpose ?? "");
  if (/다가구|원룸|상가주택/.test(p)) return "fmly";
  if (/아파트|오피스텔|연립|다세대|공동주택/.test(p)) return "hhld";
  const toNum = (v: unknown) => {
    const d = String(v ?? "").replace(/[^0-9.]/g, "");
    return d ? Number(d) : 0;
  };
  const h = toNum(counts.hhld), f = toNum(counts.fmly), o = toNum(counts.ho);
  if (h >= f && h >= o) return "hhld";
  if (f >= h && f >= o) return "fmly";
  return "ho";
}
