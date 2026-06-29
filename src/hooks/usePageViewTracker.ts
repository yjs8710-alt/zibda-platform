import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

function getSessionId() {
  try {
    let sid = sessionStorage.getItem("__pv_sid");
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem("__pv_sid", sid);
    }
    return sid;
  } catch {
    return "anon";
  }
}

/**
 * 페이지 이동마다 page_views에 INSERT.
 * RLS는 anyone INSERT 허용이라 익명/로그인 모두 기록됨.
 */
export const usePageViewTracker = () => {
  const location = useLocation();

  useEffect(() => {
    // 쿼리스트링/해시 제거 — __lovable_sha 등으로 인한 중복 집계 방지
    const path = location.pathname || "/";
    const sid = getSessionId();
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        await supabase.from("page_views").insert({
          path,
          user_id: user?.id ?? null,
          session_id: sid,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null,
        });
      } catch {
        // 추적 실패는 무시
      }
    })();
    return () => { cancelled = true; };
  }, [location.pathname]);
};
