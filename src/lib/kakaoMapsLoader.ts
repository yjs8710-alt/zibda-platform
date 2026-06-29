declare global {
  interface Window {
    kakao: any;
    __kakaoMapReady?: boolean;
    __kakaoMapLoadPromise?: Promise<any> | null;
    __kakaoScriptLoadPromise?: Promise<void> | null;
  }
}

const KAKAO_JS_KEY = "9b1ab990830e8319b8bafb3104e5ae50";
const KAKAO_SCRIPT_ID = "kakao-map-sdk";
const KAKAO_SCRIPT_SRC = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false&libraries=services`;
const DEFAULT_TIMEOUT_MS = 20000;

function waitFor(condition: () => boolean, timeoutMs: number, errorMessage: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (condition()) {
      resolve();
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (condition()) {
        window.clearInterval(timer);
        resolve();
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(timer);
        reject(new Error(errorMessage));
      }
    }, 50);
  });
}

function waitForKakaoGlobal(timeoutMs: number) {
  return waitFor(
    () => Boolean(window.kakao?.maps?.load),
    timeoutMs,
    "카카오 지도 SDK 전역이 준비되지 않았습니다."
  );
}

function isKakaoLoaded() {
  return Boolean(window.kakao?.maps?.LatLng);
}

function callMapsLoad(timeoutMs: number): Promise<any> {
  return new Promise(async (resolve, reject) => {
    if (isKakaoLoaded()) {
      window.__kakaoMapReady = true;
      resolve(window.kakao.maps);
      return;
    }

    try {
      await waitForKakaoGlobal(timeoutMs);
    } catch (err) {
      reject(err instanceof Error ? err : new Error("카카오 SDK 전역이 준비되지 않았습니다."));
      return;
    }

    const timer = window.setTimeout(() => {
      reject(new Error("카카오 지도 SDK 초기화 시간이 초과되었습니다."));
    }, timeoutMs);
    try {
      window.kakao.maps.load(() => {
        window.clearTimeout(timer);
        window.__kakaoMapReady = true;
        resolve(window.kakao.maps);
      });
    } catch (err) {
      window.clearTimeout(timer);
      reject(err instanceof Error ? err : new Error("카카오 지도 SDK 초기화 실패"));
    }
  });
}

function injectScript(timeoutMs: number): Promise<void> {
  if (window.kakao?.maps?.load) {
    return Promise.resolve();
  }

  if (window.__kakaoScriptLoadPromise) {
    return window.__kakaoScriptLoadPromise;
  }

  window.__kakaoScriptLoadPromise = new Promise((resolve, reject) => {
    let script = document.getElementById(KAKAO_SCRIPT_ID) as HTMLScriptElement | null;
    let settled = false;

    const cleanup = () => {
      if (!script) return;
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      window.clearTimeout(timer);
    };

    const finishResolve = async () => {
      try {
        await waitForKakaoGlobal(Math.min(timeoutMs, 4000));
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      } catch (err) {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err instanceof Error ? err : new Error("카카오 지도 SDK 전역 준비 실패"));
      }
    };

    const onLoad = () => {
      void finishResolve();
    };

    const onError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("카카오 지도 SDK 스크립트를 불러오지 못했습니다."));
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("카카오 지도 SDK 스크립트 로딩 시간이 초과되었습니다."));
    }, timeoutMs);

    if (!script) {
      script = document.createElement("script");
      script.id = KAKAO_SCRIPT_ID;
      script.src = KAKAO_SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    if ((script as HTMLScriptElement).dataset.loaded === "true" || window.kakao?.maps?.load) {
      void finishResolve();
      return;
    }

    const markLoaded = () => {
      if (script) {
        script.dataset.loaded = "true";
      }
    };

    script.addEventListener("load", markLoaded, { once: true });
  });

  return window.__kakaoScriptLoadPromise.catch((err) => {
    window.__kakaoScriptLoadPromise = null;
    const broken = document.getElementById(KAKAO_SCRIPT_ID) as HTMLScriptElement | null;
    if (broken?.dataset.loaded !== "true") {
      broken?.remove();
    }
    throw err;
  });
}

export async function loadKakaoMaps(options?: { retries?: number; timeoutMs?: number }) {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options?.retries ?? 3;

  if (isKakaoLoaded() && window.__kakaoMapReady) {
    return window.kakao.maps;
  }

  if (window.__kakaoMapLoadPromise) {
    return window.__kakaoMapLoadPromise;
  }

  window.__kakaoMapLoadPromise = (async () => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await injectScript(timeoutMs);
        const maps = await callMapsLoad(timeoutMs);
        return maps;
      } catch (err) {
        lastError = err;
        window.__kakaoMapReady = false;
        window.__kakaoScriptLoadPromise = null;

        const broken = document.getElementById(KAKAO_SCRIPT_ID) as HTMLScriptElement | null;
        if (broken?.dataset.loaded !== "true") {
          broken.remove();
        }

        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      }
    }
    window.__kakaoMapLoadPromise = null;
    throw lastError ?? new Error("카카오 지도 SDK를 불러오지 못했습니다.");
  })();

  try {
    return await window.__kakaoMapLoadPromise;
  } catch (err) {
    window.__kakaoMapLoadPromise = null;
    throw err;
  }
}
