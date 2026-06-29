// 디바이스 세션 유틸 — 슬롯(모바일/데스크톱)별 단일 디바이스 정책
import { supabase } from "@/integrations/supabase/client";

const DEVICE_ID_KEY = "jipda_device_id_v1";

export type DeviceType = "mobile" | "desktop";

export function getDeviceType(): DeviceType {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  // 모바일/태블릿 판별 (iPad iOS13+ 포함)
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isIpadOS = ua.includes("Macintosh") && (navigator.maxTouchPoints || 0) > 1;
  return isMobileUA || isIpadOS ? "mobile" : "desktop";
}

export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return "anon-" + Math.random().toString(36).slice(2);
  }
}

// IP 캐시 — 같은 세션 내 중복 외부 호출 방지
let _ipCache: { ip: string | null; t: number } | null = null;
let _ipInFlight: Promise<string | null> | null = null;
const IP_CACHE_TTL = 60_000; // 1분

async function fetchPublicIp(): Promise<string | null> {
  const now = Date.now();
  if (_ipCache && now - _ipCache.t < IP_CACHE_TTL) return _ipCache.ip;
  if (_ipInFlight) return _ipInFlight;
  _ipInFlight = (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1500); // 3000 → 1500ms
      const res = await fetch("https://api.ipify.org?format=json", { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) { _ipCache = { ip: null, t: Date.now() }; return null; }
      const j = await res.json();
      const ip = typeof j?.ip === "string" ? j.ip : null;
      _ipCache = { ip, t: Date.now() };
      return ip;
    } catch {
      _ipCache = { ip: null, t: Date.now() };
      return null;
    } finally {
      _ipInFlight = null;
    }
  })();
  return _ipInFlight;
}

/** 로그인 직후 호출: 같은 슬롯의 기존 디바이스를 밀어내고 본 디바이스를 활성화
 *  - IP 조회는 비차단(fire-and-forget)으로 처리해 초기 로그인 지연 제거 */
export async function claimDeviceSlot(): Promise<void> {
  const deviceType = getDeviceType();
  const deviceId = getOrCreateDeviceId();
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
  // IP 없이 즉시 슬롯 클레임 (빠른 로그인)
  await supabase.rpc("claim_device_slot", {
    _device_type: deviceType,
    _device_id: deviceId,
    _user_agent: ua,
    _ip_address: null,
  });
  // IP 는 백그라운드로 조회 후 갱신 (UI 차단 X)
  fetchPublicIp().then((ip) => {
    if (!ip) return;
    void supabase.rpc("claim_device_slot", {
      _device_type: deviceType,
      _device_id: deviceId,
      _user_agent: ua,
      _ip_address: ip,
    });
  });
}

/** 현재 디바이스가 여전히 활성 슬롯의 주인인지 검증 */
export async function verifyDeviceSlot(): Promise<boolean> {
  const deviceType = getDeviceType();
  const deviceId = getOrCreateDeviceId();
  const { data, error } = await supabase.rpc("verify_device_slot", {
    _device_type: deviceType,
    _device_id: deviceId,
  });
  if (error) return true;
  return data === true;
}

/** PC/모바일 공통: 관리자가 등록한 허용 IP와 현재 IP가 일치하는지 검증.
 *  - 허용 IP가 비어있으면 통과 (제한 없음)
 *  - 관리자는 RPC 내부에서 면제됨
 *  - IP 조회 자체가 실패하면 차단 안함 (false 반환 시 알림) */
export async function verifyPcIpAllowed(): Promise<boolean> {
  const ip = await fetchPublicIp();
  if (!ip) return true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("verify_pc_ip", { _ip_address: ip });
  if (error) return true;
  return data === true;
}
