import { useEffect, useState } from "react";
import { Download, X, Smartphone, Monitor, Share, Plus, Chrome, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

interface InstallAppModalProps {
  open: boolean;
  onClose: () => void;
}

type Platform = "ios" | "android" | "desktop-chrome" | "desktop-other" | "kakao-naver";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop-other";
  const ua = navigator.userAgent;
  if (/KAKAOTALK|NAVER|Whale|Instagram|FBAN|FBAV|Line/i.test(ua)) return "kakao-naver";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  const isChrome = /Chrome|CriOS/i.test(ua) && !/Edg|OPR/i.test(ua);
  return isChrome ? "desktop-chrome" : "desktop-other";
}

export function InstallAppModal({ open, onClose }: InstallAppModalProps) {
  const [platform, setPlatform] = useState<Platform>("desktop-other");
  const [deferredPrompt, setDeferredPrompt] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-ignore iOS
      window.navigator.standalone === true;
    setInstalled(!!isStandalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!open) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      onClose();
    }
    setDeferredPrompt(null);
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText("https://jibda.co.kr");
      alert("주소가 복사되었습니다. Chrome 브라우저 주소창에 붙여넣어 주세요.");
    } catch {
      // ignore
    }
  };

  const openInChrome = () => {
    const ua = navigator.userAgent;
    // Android: Chrome intent URL → Chrome 앱으로 강제 실행
    if (/Android/i.test(ua)) {
      window.location.href =
        "intent://jibda.co.kr/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fjibda.co.kr;end";
      return;
    }
    // iOS: googlechromes:// 스킴 (Chrome 미설치 시 App Store로 안내)
    if (/iPhone|iPad|iPod/i.test(ua)) {
      const fallback = setTimeout(() => {
        window.location.href = "https://apps.apple.com/app/google-chrome/id535886823";
      }, 1500);
      window.location.href = "googlechromes://jibda.co.kr";
      window.addEventListener("pagehide", () => clearTimeout(fallback), { once: true });
      return;
    }
    // 데스크톱: Chrome 강제 실행 불가 → 주소 복사 + Chrome 다운로드 안내
    copyUrl();
    window.open("https://www.google.com/chrome/", "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="fixed inset-0 z-[10400] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-card text-card-foreground w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ background: "hsl(var(--header-bg))" }}
        >
          <div className="flex items-center gap-2 text-white">
            <Download className="w-5 h-5" />
            <h2 className="text-base font-bold">집다 앱 설치</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {installed && (
            <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-sm text-green-700 dark:text-green-400">
              ✅ 이미 앱이 설치되어 있습니다.
            </div>
          )}

          {/* Chrome 권장 안내 */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex gap-2">
            <Chrome className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-xs text-foreground/80 leading-relaxed">
              <strong className="text-foreground">Chrome 브라우저 사용을 권장합니다.</strong>
              <br />
              가장 안정적인 설치 및 업데이트가 지원됩니다. (Android · 데스크톱)
              <br />
              iPhone은 <strong>Safari</strong>에서 설치해 주세요.
            </div>
          </div>

          {/* 카카오/네이버 인앱 경고 */}
          {platform === "kakao-naver" && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <strong>카카오톡 / 네이버 / 인스타그램 등 인앱 브라우저에서는 설치할 수 없습니다.</strong>
                <br />
                우측 상단 메뉴에서 <strong>"다른 브라우저(Chrome / Safari)로 열기"</strong>를 선택해 주세요.
                <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={copyUrl}>
                  주소 복사 (jibda.co.kr)
                </Button>
              </div>
            </div>
          )}

          {/* iOS */}
          {platform === "ios" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Smartphone className="w-4 h-4" /> iPhone / iPad (Safari)
              </div>
              <ol className="text-sm space-y-2 list-decimal list-inside text-foreground/80">
                <li>
                  하단 <Share className="inline w-4 h-4 mx-1" /> <strong>공유</strong> 버튼을 누르세요.
                </li>
                <li>
                  메뉴에서 <Plus className="inline w-4 h-4 mx-1" />{" "}
                  <strong>"홈 화면에 추가"</strong>를 선택하세요.
                </li>
                <li>우측 상단 <strong>"추가"</strong>를 누르면 설치 완료됩니다.</li>
              </ol>
            </div>
          )}

          {/* Android */}
          {platform === "android" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Smartphone className="w-4 h-4" /> Android (Chrome 권장)
              </div>
              {deferredPrompt ? (
                <Button
                  onClick={handleInstall}
                  className="w-full"
                  style={{ background: "hsl(var(--accent))", color: "white" }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  지금 앱 설치하기
                </Button>
              ) : (
                <ol className="text-sm space-y-2 list-decimal list-inside text-foreground/80">
                  <li>Chrome 우측 상단 <strong>⋮ (메뉴)</strong>를 누르세요.</li>
                  <li>
                    <strong>"앱 설치"</strong> 또는 <strong>"홈 화면에 추가"</strong>를 선택하세요.
                  </li>
                  <li>안내에 따라 설치를 완료해 주세요.</li>
                </ol>
              )}
            </div>
          )}

          {/* Desktop Chrome */}
          {platform === "desktop-chrome" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Monitor className="w-4 h-4" /> 데스크톱 (Chrome)
              </div>
              {deferredPrompt ? (
                <Button
                  onClick={handleInstall}
                  className="w-full"
                  style={{ background: "hsl(var(--accent))", color: "white" }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  지금 앱 설치하기
                </Button>
              ) : (
                <ol className="text-sm space-y-2 list-decimal list-inside text-foreground/80">
                  <li>주소창 오른쪽 끝 <strong>설치 아이콘 ⊕</strong>을 클릭하세요.</li>
                  <li>또는 우측 상단 <strong>⋮ → "집다 설치"</strong>를 선택하세요.</li>
                  <li>설치 후 바탕화면/시작메뉴에서 바로 실행할 수 있습니다.</li>
                </ol>
              )}
            </div>
          )}

          {/* Desktop other */}
          {platform === "desktop-other" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Monitor className="w-4 h-4" /> 데스크톱
              </div>
              <p className="text-sm text-foreground/80">
                현재 브라우저는 앱 설치를 지원하지 않습니다. <strong>Google Chrome</strong> 또는{" "}
                <strong>Microsoft Edge</strong>로 접속해 주세요.
              </p>
              <Button size="sm" variant="outline" className="w-full" onClick={copyUrl}>
                주소 복사 (jibda.co.kr)
              </Button>
            </div>
          )}
        </div>

        {/* Chrome 바로가기 */}
        <div className="px-5 py-3 border-t border-border bg-primary/5 space-y-2">
          <Button
            onClick={openInChrome}
            className="w-full h-11 text-sm font-bold gap-2"
            style={{ background: "#1a73e8", color: "white" }}
          >
            <Chrome className="w-4 h-4" />
            Chrome으로 설치 / 사이트 열기
          </Button>
          <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
            현재 브라우저가 Chrome이 아닐 경우 Chrome 앱에서 자동으로 사이트가 열립니다.
            <br />
            Chrome이 설치되어 있지 않으면 설치 페이지로 이동합니다.
          </p>
        </div>

        <div className="px-5 py-3 border-t border-border bg-muted/30">
          <button
            onClick={onClose}
            className="w-full text-xs text-muted-foreground hover:text-foreground py-1"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

export default InstallAppModal;
