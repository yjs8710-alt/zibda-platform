import { useState, useEffect, lazy, Suspense } from "react";
import { Menu, X, Bell, LogOut, Users, ShieldCheck, Building, ClipboardList, User, Download, Home, MessageCircle } from "lucide-react";
import logoImg from "@/assets/logo-zibda-active-opt.webp";
import iconUsersGradient from "@/assets/icon-users-gradient.png";
import iconBellNeon from "@/assets/icon-bell-neon.png";
import iconUserNeon from "@/assets/icon-user-neon.png";
import iconChatNeon from "@/assets/icon-chat-neon.png";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { neonChipStyle } from "@/lib/neonChipStyle";
const PropertyRegisterModal = lazy(() => import("@/components/PropertyRegisterModal"));
import AdminEditBar from "@/components/AdminEditBar";
const InstallAppModal = lazy(() => import("@/components/InstallAppModal"));
import { useAuth } from "@/hooks/useAuth";
import { useIsGuest } from "@/hooks/useIsGuest";

import NotificationBell from "@/components/NotificationBell";

const NAV_ITEMS_BASE = [
  { label: "주거·임대", path: "/residential", icon: Building },
  { label: "상업·임대·매매", path: "/non-residential", icon: Building },
  { label: "집합건물·건물매매", path: "/collective-sale", icon: Building },
  { label: "토지", path: "/land", icon: Building },
];
const NAV_ITEMS_AUTH = [
  ...NAV_ITEMS_BASE,
  { label: "내 매물 관리", path: "/my-properties", icon: ClipboardList },
];

interface HeaderProps {
  onRegisterChange?: (open: boolean) => void;
  onMenuOpenChange?: (open: boolean) => void;
}

const Header = ({ onRegisterChange, onMenuOpenChange }: HeaderProps) => {
  const [menuOpen, _setMenuOpen] = useState(false);
  const setMenuOpen = (v: boolean) => {
    _setMenuOpen(v);
    onMenuOpenChange?.(v);
  };
  const [showRegister, setShowRegister] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [hideInstallButton, setHideInstallButton] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const checkInstalled = () => {
      const isStandalone =
        window.matchMedia?.("(display-mode: standalone)").matches ||
        window.matchMedia?.("(display-mode: fullscreen)").matches ||
        window.matchMedia?.("(display-mode: minimal-ui)").matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.startsWith("android-app://");
      setHideInstallButton(isMobile && isStandalone);
    };
    checkInstalled();
    const mql = window.matchMedia?.("(display-mode: standalone)");
    mql?.addEventListener?.("change", checkInstalled);
    return () => mql?.removeEventListener?.("change", checkInstalled);
  }, []);

  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthorized, user, logout } = useAuth();
  const isGuest = useIsGuest();
  const isGeneralMember = user?.memberType === "일반회원";
  const NAV_ITEMS = isGuest || isGeneralMember ? NAV_ITEMS_BASE : NAV_ITEMS_AUTH;

  const openRegister = () => {
    window.dispatchEvent(new Event("close-map-filter"));
    setShowRegister(true);
    onRegisterChange?.(true);
  };
  const closeRegister = () => {
    setShowRegister(false);
    onRegisterChange?.(false);
  };

  useEffect(() => {
    const handler = () => openRegister();
    window.addEventListener("open-register-modal", handler);
    return () => window.removeEventListener("open-register-modal", handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isActive = (path: string) => location.pathname === path;
  const isHome = location.pathname === "/";

  return (
    <header className={`sticky top-0 flex-shrink-0 ${menuOpen ? "z-[1200]" : "z-[950]"}`} style={{ background: "hsl(var(--header-bg))" }}>
      {/* 네온 그라데이션 stroke 정의 (lucide 아이콘용) */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <linearGradient id="neonIconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
      {/* <AdminEditBar /> */}
      <Suspense fallback={null}>
        {showRegister && <PropertyRegisterModal onClose={closeRegister} />}
        {showInstall && <InstallAppModal open={showInstall} onClose={() => setShowInstall(false)} />}
      </Suspense>

      {/* 상단 바 */}
      <div className="border-b" style={{ borderColor: "hsl(var(--header-border))" }}>
        <div className="w-full pl-0 pr-3 sm:pr-5 md:pr-0">
          <div className="flex items-center h-12 gap-0">

            {/* 로고 */}
            <div
              className="flex items-center cursor-pointer select-none flex-shrink-0 -ml-4 sm:-ml-2 mr-0"
              onClick={() => navigate("/")}
            >
              <img src={logoImg} alt="집다 로고" loading="eager" decoding="async" width={200} height={80} className="h-24 md:h-20 w-auto object-contain object-left block mt-2" />
            </div>

            {/* 데스크톱 매물등록 버튼은 각 페이지의 2번째 줄 우측 끝으로 이동됨 */}

            {/* 데스크톱 Nav (홈에서는 숨김) */}
            {!isHome && (
            <nav className="hidden md:flex items-center gap-0.5 flex-1 overflow-hidden">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  className="text-[12px] font-medium px-3 py-2 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
                  style={
                    isActive(item.path)
                      ? { background: "rgba(255,255,255,0.12)", color: "white" }
                      : { color: "white" }
                  }
                >
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => navigate("/community")}
                className="flex items-center gap-1 text-[12px] font-medium px-3 py-2 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
                style={
                  isActive("/community")
                    ? { background: "rgba(255,255,255,0.12)", color: "white" }
                    : { color: "white" }
                }
              >
                <Users className="w-3.5 h-3.5" />
                커뮤니티
              </button>
            </nav>
            )}

            {/* 홈에서만 채팅 아이콘을 우측으로 밀어주는 공간 */}
            {isHome && isAuthorized && (
              <div className="hidden md:flex items-center ml-auto" />
            )}

            {/* 우측 액션 (홈에서는 숨김) */}
            {!isHome && (
            <div className="hidden md:flex items-center gap-1 ml-auto flex-shrink-0">
              {isAuthorized && (
                <button
                  onClick={() => navigate("/chat")}
                  className="flex items-center gap-1 -mr-1"
                  aria-label="채팅 문의"
                  title="채팅 문의"
                >
                  <img src={iconChatNeon} alt="채팅문의" className="w-16 h-16 object-contain" />
                  <span className="text-[12px] font-bold text-white">채팅문의</span>
                </button>
              )}
              {isAuthorized && <NotificationBell variant="desktop" />}


              {isAuthorized ? (
                <>
                  <button
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
                    onClick={() => navigate("/my-page")}
                  >
                    <span className="text-[11px] font-semibold text-white/80">{user?.memberType ?? "사용자"}</span>
                    <img src={iconUsersGradient} alt="" className="h-11 w-auto object-contain" />
                  </button>

                  {user?.isAdmin && (
                    <button
                      className="flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-lg transition-all"
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.7)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                      onClick={() => navigate("/admin")}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      관리자
                    </button>
                  )}

                  <button
                    className="flex items-center justify-center px-1.5 py-1 -ml-2 mr-10 rounded-lg transition-colors hover:bg-white/10"
                    onClick={handleLogout}
                    aria-label="로그아웃"
                    title="로그아웃"
                  >
                    <LogOut className="w-6 h-6" style={{ stroke: "url(#neonIconGrad)" }} strokeWidth={2.2} />
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-1.5 mr-10">
                  <button
                    className="text-[12px] font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(90deg, #22d3ee 0%, #a855f7 50%, #ec4899 100%)", color: "white" }}
                    onClick={() => navigate("/login")}
                  >
                    로그인
                  </button>
                  <button
                    className="text-[12px] font-bold px-3 py-1.5 rounded-lg transition-all"
                    style={{ background: "linear-gradient(90deg, #22d3ee 0%, #a855f7 50%, #ec4899 100%)", color: "white" }}
                    onClick={() => navigate("/signup")}
                  >
                    회원가입
                  </button>
                </div>
              )}

            </div>
            )}

            {/* 모바일: 알림 + 내정보 + 햄버거(우측끝) — 홈에서는 숨김 */}
            {!isHome && (
            <div className="md:hidden flex items-center gap-0 ml-auto">
              <button
                  onClick={() => navigate(!isAuthorized ? "/login" : isGeneralMember ? "/my-page?view=activity&tab=inquiries" : "/notifications")}
                className="flex items-center justify-center -mr-3"
                aria-label="알림"
              >
                <img src={iconBellNeon} alt="알림" className="w-[88px] h-[88px] mx-2 object-contain" />
              </button>
              <button
                className="flex items-center justify-center -mr-3"
                onClick={() => {
                  if (!isAuthorized) { navigate("/login"); return; }
                  navigate(isGeneralMember ? "/my-page" : "/my-info");
                }}
                aria-label="내 정보"
              >
                <img src={iconUserNeon} alt="내 정보" className="w-[88px] h-[88px] mx-2 object-contain" />
              </button>
              <button
                className="text-white p-1 mb-1"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="메뉴"
              >
                {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* 모바일 메뉴 */}
      {menuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-[1205]"
            style={{ background: "transparent" }}
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="md:hidden border-t flex flex-col gap-0.5 py-2 px-3 relative z-[1210]"
            style={{ background: "hsl(var(--header-bg))", borderColor: "hsl(var(--header-border))" }}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => { navigate(item.path); setMenuOpen(false); }}
              className="text-left text-sm font-medium text-white/70 py-2 px-3 rounded-lg hover:bg-white/10"
            >
              {item.label}
            </button>
          ))}
          <button
            onClick={() => { navigate("/community"); setMenuOpen(false); }}
            className="text-left text-sm font-medium text-white/70 py-2 px-3 rounded-lg hover:bg-white/10"
          >
            커뮤니티
          </button>
          <div className="pt-1 border-t mt-1" style={{ borderColor: "hsl(var(--header-border))" }}>
            {location.pathname !== "/" && !isGuest && (
              <button
                onClick={openRegister}
                className="w-full flex items-center justify-center gap-2 py-2 my-1 rounded-xl text-white text-sm font-bold transition-transform active:scale-[0.98] shadow-lg"
                style={{ background: "linear-gradient(90deg, #ff6ec4 0%, #a78bfa 50%, #60a5fa 100%)" }}
                aria-label="매물 등록"
              >
                <span className="text-base leading-none">+</span>
                <span>매물 등록</span>
              </button>
            )}
            {isAuthorized && (
              <>
                <button
                  onClick={() => { navigate("/my-page"); setMenuOpen(false); }}
                  className="w-full text-left text-sm font-medium text-white/70 py-2 px-3 rounded-lg hover:bg-white/10"
                >
                  마이페이지
                </button>
                {user?.isAdmin && (
                  <button
                    onClick={() => { navigate("/admin"); setMenuOpen(false); }}
                    className="w-full text-left text-sm font-bold py-2 px-3 rounded-lg hover:bg-white/10 flex items-center gap-2"
                    style={{ color: "hsl(var(--accent))" }}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    관리자 모드
                  </button>
                )}
                <button
                  className="w-full text-sm text-white/50 font-medium py-2 mt-1"
                  onClick={handleLogout}
                >
                  로그아웃
                </button>
              </>
            )}
            {!isAuthorized && (
              <button
                onClick={() => { navigate("/login"); setMenuOpen(false); }}
                className="w-full text-left text-sm font-medium text-white/70 py-2 px-3 rounded-lg hover:bg-white/10 flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                로그인
              </button>
            )}
          </div>
          </div>
        </>
      )}
    </header>
  );
};

export default Header;
