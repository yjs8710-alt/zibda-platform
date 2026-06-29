import { useNavigate, useLocation } from "react-router-dom";
import navHome from "@/assets/nav-0.png";
import navSearch from "@/assets/nav-1.png";
import navMy from "@/assets/nav-2.png";
import navCommunity from "@/assets/nav-3.png";
import navChat from "@/assets/nav-4.png";
import { useAuth } from "@/hooks/useAuth";
import { useIsGuest } from "@/hooks/useIsGuest";

const ITEMS = [
  { label: "홈", path: "/", icon: navHome, match: (p: string) => p === "/", agentOnly: false },
  { label: "매물찾기", path: "/residential", icon: navSearch, match: (p: string) => p.startsWith("/residential") || p === "/apartment" || p === "/non-residential" || p === "/collective-sale" || p === "/land" || p === "/commercial", agentOnly: false },
  { label: "내매물", path: "/my-properties", icon: navMy, match: (p: string) => p.startsWith("/my-properties"), agentOnly: true },
  { label: "커뮤니티", path: "/community", icon: navCommunity, match: (p: string) => p.startsWith("/community"), agentOnly: false },
  { label: "채팅문의", path: "/chat", icon: navChat, match: (p: string) => p.startsWith("/chat"), agentOnly: false },
];


const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isGuest = useIsGuest();
  const hideAgent = isGuest || user?.memberType === "일반회원";
  const visibleItems = ITEMS.filter((it) => !(it.agentOnly && hideAgent));

  const HIDDEN_PREFIXES = ["/login", "/signup", "/forgot-password", "/reset-password", "/admin", "/share", "/property"];
  if (HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p))) return null;


  return (
    <nav
      className="md:hidden fixed left-0 right-0 bottom-0 z-[900] rounded-t-2xl border-t backdrop-blur-md"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: "hsl(var(--header-bg) / 0.92)",
        borderColor: "hsl(var(--header-border))",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.4), 0 0 24px hsl(var(--accent) / 0.25)",
      }}
      aria-label="모바일 메인 메뉴"
    >
      <ul className="flex items-stretch justify-around px-1 py-2">
        {visibleItems.map(({ label, path, icon, match }) => {
          const active = match(location.pathname);
          return (
            <li key={label} className="flex-1">
              <button
                onClick={() => navigate(path)}
                className="w-full flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition-all"
                aria-current={active ? "page" : undefined}
              >
                <img
                  src={icon}
                  alt={label}
                  className="w-9 h-9 object-contain shrink-0"
                  style={{
                    filter: active
                      ? "drop-shadow(0 0 8px rgba(168,85,247,0.7))"
                      : "drop-shadow(0 0 4px rgba(168,85,247,0.35))",
                    opacity: active ? 1 : 0.9,
                  }}
                />
                <span
                  className="text-[10px] font-bold leading-tight text-white"
                  style={{ opacity: active ? 1 : 0.75 }}
                >
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileBottomNav;
