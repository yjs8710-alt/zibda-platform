import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, LogOut, Settings, ChevronDown, X } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

const AdminEditBar = () => {
  const { isAdmin, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!isAdmin || dismissed) return null;

  return (
    <div
      className="sticky top-0 z-[1000] flex items-center justify-between px-4 py-1.5 gap-2 shadow-sm"
      style={{ background: "hsl(var(--accent))" }}
    >
      {/* 좌측: 관리자 표시 */}
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-white" />
        <span className="text-xs font-bold text-white">관리자 모드 활성화</span>
        <span className="text-white/60 text-[10px] hidden sm:block">· 매물 수정 권한 활성</span>
      </div>

      {/* 우측: 메뉴 */}
      <div className="flex items-center gap-1" ref={menuRef}>
        <button
          onClick={() => navigate("/admin")}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/20 hover:bg-white/30 text-white transition-colors"
        >
          <Settings className="w-3 h-3" />
          관리자 페이지
        </button>

        {/* 드롭다운 */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-0.5 px-2 py-1 rounded-full text-[11px] font-bold bg-white/15 hover:bg-white/25 text-white transition-colors"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 rounded-xl shadow-xl border border-border overflow-hidden z-50 min-w-[140px]"
              style={{ background: "hsl(var(--card))" }}
            >
              <button
                onClick={() => { setMenuOpen(false); navigate("/admin"); }}
                className="w-full text-left px-4 py-2.5 text-xs font-medium text-foreground hover:bg-muted/60 transition-colors flex items-center gap-2"
              >
                <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                관리자 대시보드
              </button>
              <div className="h-px bg-border" />
              <button
                onClick={async () => { setMenuOpen(false); await logout(); }}
                className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-red-50 transition-colors flex items-center gap-2"
                style={{ color: "hsl(var(--destructive))" }}
              >
                <LogOut className="w-3.5 h-3.5" />
                로그아웃
              </button>
            </div>
          )}
        </div>

        {/* 숨기기 버튼 */}
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-colors ml-0.5"
          title="관리자 바 숨기기 (세션은 유지)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default AdminEditBar;
