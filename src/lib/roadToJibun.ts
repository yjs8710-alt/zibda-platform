import { supabase } from "@/integrations/supabase/client";

// 도로명 주소(예: "분평로88-1", "OO길 12") 인지 판별
export function isRoadName(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.trim();
  if (!t) return false;
  // "OO로", "OO길" 패턴이 포함되면 도로명으로 간주 (단, "OO동/읍/면/리"가 들어 있으면 지번)
  if (/(동|읍|면|리)$/.test(t)) return false;
  return /[가-힣0-9]+(로|길)\s*\d/.test(t) || /[가-힣]+(로|길)$/.test(t);
}

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
const STORAGE_KEY = "road2jibun_cache_v1";

// localStorage 캐시 로드
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const obj = JSON.parse(raw) as Record<string, string>;
    for (const [k, v] of Object.entries(obj)) cache.set(k, v);
  }
} catch {}

function persist() {
  try {
    const obj: Record<string, string> = {};
    cache.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {}
}

/**
 * 도로명 주소를 구주소(지번)로 변환. 실패 시 빈 문자열.
 * 결과는 메모리 + localStorage 캐시.
 */
export async function roadToJibun(road: string, district?: string): Promise<string> {
  const key = `${district ?? ""}|${road.trim()}`;
  if (cache.has(key)) return cache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;

  const query = [district, road].filter(Boolean).join(" ").trim();
  const fullQuery = query.includes("청주") ? query : `청주시 ${query}`;

  const p = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("geocode", {
        body: { address: fullQuery },
      });
      if (error || !data?.success) return "";
      const jibun: string = data.jibunAddress ?? "";
      // "충북 청주시 서원구 분평동 123-4" → "분평동 123-4" 만 추출 (가능 시)
      const short = jibun.match(/([가-힣]+(?:동|읍|면|리)\s+[\d-]+.*)$/)?.[1] ?? jibun;
      cache.set(key, short);
      persist();
      return short;
    } catch {
      return "";
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}
