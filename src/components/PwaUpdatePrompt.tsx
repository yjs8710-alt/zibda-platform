import { useEffect } from "react";

const FRESH_CHECK_INTERVAL = 60_000;
const BUILD_VERSION_STORAGE_KEY = "jibda_buildVersion";
const OLD_VERSION_STORAGE_KEYS = [
  "jibda_build_id",
  "jibda_build_version",
  "jibda_cache_version",
  "jibda_version",
];

export function PwaUpdatePrompt() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const userAgent = navigator.userAgent.toLowerCase();
    const isKakaoInAppBrowser = userAgent.includes("kakaotalk");
    const isNaverInAppBrowser = userAgent.includes("naver") || userAgent.includes("naver(inapp");
    const isAggressiveInAppBrowser = isKakaoInAppBrowser || isNaverInAppBrowser;

    const host = window.location.hostname;
    const isPreviewHost =
      host.includes("id-preview--") ||
      host.includes("lovableproject.com") ||
      host.includes("lovable.dev");

    let inIframe = false;
    try {
      inIframe = window.self !== window.top;
    } catch {
      inIframe = true;
    }

    const clearOldAppCache = async () => {
      let hadLegacyCache = false;

      try {
        if ("serviceWorker" in navigator) {
          hadLegacyCache = Boolean(navigator.serviceWorker.controller);
          const regs = await navigator.serviceWorker.getRegistrations();
          hadLegacyCache = hadLegacyCache || regs.length > 0;
          await Promise.all(regs.map((r) => r.unregister()));
        }
        if (typeof caches !== "undefined") {
          const keys = await caches.keys();
          hadLegacyCache = hadLegacyCache || keys.length > 0;
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {
        // 캐시 정리는 실패해도 앱 사용은 계속 가능해야 함
      }

      return hadLegacyCache;
    };

    const removeOldCacheVersionStorage = () => {
      OLD_VERSION_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));

      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (key?.startsWith("jibda_cache_")) {
          localStorage.removeItem(key);
        }
      }
    };

    const moveToFreshUrl = () => {
      if (isPreviewHost || inIframe) return;
      const freshUrl = new URL(window.location.href);
      freshUrl.searchParams.set("v", `${Date.now()}`);
      window.location.replace(freshUrl.toString());
    };

    const getServerBuildVersion = async () => {
      try {
        const versionUrl = new URL("/version.json", window.location.origin);
        versionUrl.searchParams.set("v", `${Date.now()}`);
        const response = await fetch(versionUrl.toString(), {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (typeof data?.build === "string") return data.build;
          if (typeof data?.buildVersion === "string") return data.buildVersion;
        }
      } catch {
        // index.html 확인으로 대체
      }

      try {
        const htmlUrl = new URL(window.location.pathname || "/", window.location.origin);
        htmlUrl.searchParams.set("_fresh", `${Date.now()}`);
        const response = await fetch(htmlUrl.toString(), {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        });
        const html = await response.text();
        return html.match(/<meta name="app-build-version" content="([^"]+)"/i)?.[1] ?? null;
      } catch {
        return null;
      }
    };

    const refreshOnceForBuild = async () => {
      if (isPreviewHost || inIframe) return;

      if (isAggressiveInAppBrowser) {
        await clearOldAppCache();
      }

      const serverBuildVersion = await getServerBuildVersion();
      if (!serverBuildVersion) return;

      const storedBuildVersion = localStorage.getItem(BUILD_VERSION_STORAGE_KEY);
      const isRunningOldBundle = serverBuildVersion !== __APP_BUILD_VERSION__;
      const needsRefresh = storedBuildVersion !== serverBuildVersion || isRunningOldBundle;
      const reloadKey = `jibda_version_refresh_once_${serverBuildVersion}`;

      if (needsRefresh && !sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, "1");
        removeOldCacheVersionStorage();
        await clearOldAppCache();
        localStorage.setItem(BUILD_VERSION_STORAGE_KEY, serverBuildVersion);
        moveToFreshUrl();
        return;
      }

      if (!storedBuildVersion || storedBuildVersion !== serverBuildVersion) {
        removeOldCacheVersionStorage();
        localStorage.setItem(BUILD_VERSION_STORAGE_KEY, serverBuildVersion);
      }
    };

    // 첫 화면 진입 속도를 위해 버전 확인은 idle 시점으로 미룸
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    if (w.requestIdleCallback) {
      w.requestIdleCallback(() => { refreshOnceForBuild(); }, { timeout: 4000 });
    } else {
      window.setTimeout(() => { refreshOnceForBuild(); }, 2500);
    }

    const interval = window.setInterval(refreshOnceForBuild, FRESH_CHECK_INTERVAL);
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refreshOnceForBuild();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshOnceForBuild();
    };

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
