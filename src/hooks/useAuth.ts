import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { claimDeviceSlot, verifyDeviceSlot, verifyPcIpAllowed, getDeviceType, getOrCreateDeviceId } from "@/lib/deviceSession";

type AuthStatus = "loading" | "authorized" | "unauthorized";

interface AuthUser {
  userId: string;
  memberType: string;
  isAdmin: boolean;
}

let cachedStatus: AuthStatus = "loading";
let cachedUser: AuthUser | null = null;
let listeners: Array<(s: AuthStatus, u: AuthUser | null) => void> = [];
let deviceChannel: ReturnType<typeof supabase.channel> | null = null;
let kickedOut = false;
let sessionCheckPromise: Promise<void> | null = null;
let lastAdminCheck: { userId: string; isAdmin: boolean; at: number } | null = null;
let adminCheckPromise: { userId: string; promise: Promise<boolean> } | null = null;

const ADMIN_CACHE_MS = 30_000;

function notify(s: AuthStatus, u: AuthUser | null) {
  cachedStatus = s;
  cachedUser = u;
  listeners.forEach((fn) => fn(s, u));
}

async function getIsAdmin(userId: string) {
  if (lastAdminCheck?.userId === userId && Date.now() - lastAdminCheck.at < ADMIN_CACHE_MS) {
    return lastAdminCheck.isAdmin;
  }
  if (adminCheckPromise?.userId === userId) return adminCheckPromise.promise;
  const promise = (async () => {
    try {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      const isAdmin = Boolean(roleData);
      lastAdminCheck = { userId, isAdmin, at: Date.now() };
      return isAdmin;
    } finally {
      if (adminCheckPromise?.userId === userId) adminCheckPromise = null;
    }
  })();
  adminCheckPromise = { userId, promise };
  return promise;
}

async function forceLogoutDueToDeviceConflict() {
  if (kickedOut) return;
  kickedOut = true;
  try { await supabase.auth.signOut(); } catch {}
  if (typeof window !== "undefined") {
    alert("다른 기기에서 동일한 계정으로 로그인되어 이 기기는 로그아웃됩니다.\n(휴대폰 1대 + PC 1대만 동시 사용 가능)");
  }
  notify("unauthorized", null);
}

async function forceLogoutDueToIpRestriction() {
  if (kickedOut) return;
  kickedOut = true;
  try { await supabase.auth.signOut(); } catch {}
  if (typeof window !== "undefined") {
    alert("등록된 사무실 IP가 아니어서 접속할 수 없습니다.\n관리자에게 허용 IP 등록을 요청하세요.");
  }
  notify("unauthorized", null);
}

function teardownDeviceChannel() {
  if (deviceChannel) {
    try { supabase.removeChannel(deviceChannel); } catch {}
    deviceChannel = null;
  }
}

function setupDeviceChannel(userId: string) {
  teardownDeviceChannel();
  const myDeviceId = getOrCreateDeviceId();
  const myDeviceType = getDeviceType();
  deviceChannel = supabase
    .channel(`device-sessions-${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "user_active_sessions", filter: `user_id=eq.${userId}` },
      (payload: any) => {
        const row = (payload.new ?? payload.old) as { device_type?: string; device_id?: string } | null;
        if (!row) return;
        if (row.device_type === myDeviceType && row.device_id !== myDeviceId) {
          forceLogoutDueToDeviceConflict();
        }
      }
    )
    .subscribe();
}

async function checkSession() {
  if (sessionCheckPromise) return sessionCheckPromise;
  sessionCheckPromise = runSessionCheck().finally(() => {
    sessionCheckPromise = null;
  });
  return sessionCheckPromise;
}

async function runSessionCheck() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    teardownDeviceChannel();
    notify("unauthorized", null);
    return;
  }

  // 관리자 여부 확인
  if (await getIsAdmin(session.user.id)) {
    notify("authorized", { userId: session.user.id, memberType: "관리자", isAdmin: true });
    return;
  }

  // 중개사 프로필 확인
  const { data: profile } = await supabase
    .from("agent_profiles")
    .select("status, is_active, member_type")
    .eq("user_id", session.user.id)
    .maybeSingle();

  // 미승인(pending/rejected) 또는 비활성 계정 → 강제 로그아웃
  if (!profile || profile.status !== "approved" || profile.is_active === false) {
    await supabase.auth.signOut();
    teardownDeviceChannel();
    notify("unauthorized", null);
    return;
  }

  notify("authorized", {
    userId: session.user.id,
    memberType: profile.member_type,
    isAdmin: false,
  });
}

// 앱 시작 시 한번 체크
checkSession();

supabase.auth.onAuthStateChange((event, session) => {
  if (!session) {
    teardownDeviceChannel();
    notify("unauthorized", null);
    return;
  }

  // 세션 상태 즉시 갱신 (IP/디바이스 검증은 백그라운드)
  checkSession();

  // 로그인/세션 갱신 시: 디바이스 슬롯 클레임 + 검증 + 채널 구독 (비동기)
  if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
    kickedOut = false;
    (async () => {
      // 관리자 계정은 다중 디바이스/IP 제한 면제
      if (await getIsAdmin(session.user.id)) return;

      try { await claimDeviceSlot(); } catch {}
      setupDeviceChannel(session.user.id);
      // 허용 IP 검증 (PC/모바일 공통)
      const ipOk = await verifyPcIpAllowed();
      if (!ipOk) { await forceLogoutDueToIpRestriction(); return; }
      // 디바이스 슬롯 정합성 검증
      const ok = await verifyDeviceSlot();
      if (!ok) { await forceLogoutDueToDeviceConflict(); return; }
    })();
  }
});

// 탭이 다시 보일 때 디바이스 슬롯 정합성 재검증
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    // 관리자는 검증 스킵
    if (await getIsAdmin(session.user.id)) return;
    const ok = await verifyDeviceSlot();
    if (!ok) { await forceLogoutDueToDeviceConflict(); return; }
    const ipOk = await verifyPcIpAllowed();
    if (!ipOk) await forceLogoutDueToIpRestriction();
  });
}

export function useAuth() {
  const [status, setStatus] = useState<AuthStatus>(cachedStatus);
  const [user, setUser] = useState<AuthUser | null>(cachedUser);

  useEffect(() => {
    setStatus(cachedStatus);
    setUser(cachedUser);
    const fn = (s: AuthStatus, u: AuthUser | null) => {
      setStatus(s);
      setUser(u);
    };
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((l) => l !== fn);
    };
  }, []);

  const logout = useCallback(async () => {
    teardownDeviceChannel();
    await supabase.auth.signOut();
    notify("unauthorized", null);
  }, []);

  return {
    isLoading: status === "loading",
    isAuthorized: status === "authorized",
    user,
    logout,
  };
}
