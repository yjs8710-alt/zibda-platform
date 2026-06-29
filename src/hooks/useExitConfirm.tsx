import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { hasOpenOverlay } from "@/lib/overlayGuard";

/**
 * 모바일 / Capacitor 네이티브에서 뒤로가기 시 "Zibda를 종료하겠습니까?" 다이얼로그.
 * - 홈("/")에서만 종료 다이얼로그를 띄움
 * - 다른 경로에서는 일반적인 뒤로가기로 이전 화면으로 이동
 */
export const useExitConfirm = (enabled: boolean = true) => {
  const [open, setOpen] = useState(false);
  const isNativeRef = useRef(false);
  const { pathname } = useLocation();
  const isHome = pathname === "/";

  // 네이티브 뒤로가기 (전역) — 홈이 아니면 history.back, 홈이면 종료 모달
  useEffect(() => {
    if (!enabled) return;
    let handle: any;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        isNativeRef.current = true;
        const { App } = await import("@capacitor/app");
        handle = await App.addListener("backButton", () => {
          if (hasOpenOverlay()) return;
          if (window.location.pathname !== "/") {
            window.history.back();
            return;
          }
          setOpen(true);
        });
      } catch {}
    })();
    return () => { try { handle?.remove(); } catch {} };
  }, [enabled]);

  // 웹/PWA 모바일: 홈에 있을 때만 가드 push & popstate 처리
  useEffect(() => {
    if (!enabled) return;
    if (isNativeRef.current) return;
    const ua = navigator.userAgent || "";
    const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const isMobileViewport = typeof window !== "undefined" && window.innerWidth <= 768;
    if (!isMobileUA && !isMobileViewport) return;
    if (!isHome) return;

    try { window.history.pushState({ exitGuard: true }, ""); } catch {}
    const onPopState = () => {
      if (hasOpenOverlay()) return;
      if (window.location.pathname !== "/") return;
      setOpen(true);
      try { window.history.pushState({ exitGuard: true }, ""); } catch {}
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [enabled, isHome]);

  const handleConfirm = useCallback(async () => {
    setOpen(false);
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform()) {
        const { App } = await import("@capacitor/app");
        await App.exitApp();
        return;
      }
    } catch {}
    try { window.close(); } catch {}
    try { window.open("", "_self")?.close(); } catch {}
    setTimeout(() => {
      try {
        if (window.history.length > 1) window.history.go(-2);
        else window.location.href = "about:blank";
      } catch {}
    }, 50);
  }, []);

  const handleCancel = useCallback(() => {
    setOpen(false);
    if (!isNativeRef.current && window.location.pathname === "/") {
      try { window.history.pushState({ exitGuard: true }, ""); } catch {}
    }
  }, []);

  const dialog = open
    ? createPortal(
        <div
          className="fixed inset-0 z-[20000] flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={handleCancel}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-background shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-5 text-center">
              <p className="text-base font-semibold text-foreground">
                Zibda를 종료하겠습니까?
              </p>
            </div>
            <div className="grid grid-cols-2 border-t border-border">
              <button
                onClick={handleCancel}
                className="py-3 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleConfirm}
                className="py-3 text-sm font-semibold text-white border-l border-border transition-colors"
                style={{ background: "linear-gradient(90deg, #ff6ec4 0%, #a78bfa 50%, #60a5fa 100%)" }}
              >
                종료
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return { ExitConfirmDialog: () => dialog };
};
