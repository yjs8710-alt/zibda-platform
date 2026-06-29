import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, User, Mail, Phone, Calendar, Building2, ClipboardList, Bell, LogOut, Settings } from "lucide-react";
import Header from "@/components/Header";
import MobileBottomNav from "@/components/MobileBottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const MyInfoPage = () => {
  const navigate = useNavigate();
  const { isAuthorized, isLoading, user, logout } = useAuth();

  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [propertyCount, setPropertyCount] = useState<number>(0);
  const [notifEnabled, setNotifEnabled] = useState<boolean>(true);

  useEffect(() => {
    if (!isLoading && !isAuthorized) navigate("/login");
  }, [isLoading, isAuthorized, navigate]);

  useEffect(() => {
    if (!user?.userId) return;
    (async () => {
      const { data: { user: au } } = await supabase.auth.getUser();
      if (au?.email) setEmail(au.email);
      const { data: p } = await supabase
        .from("agent_profiles")
        .select("*")
        .eq("user_id", user.userId)
        .maybeSingle();
      setProfile(p);
      const name = p?.name ?? "";
      const orFilter = `registered_by.eq.${user.userId}${name ? `,agent_name.eq.${name}` : ""}`;
      const { count } = await supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .or(orFilter);
      setPropertyCount(count ?? 0);

      try {
        const v = localStorage.getItem("notif_enabled");
        if (v !== null) setNotifEnabled(v === "1");
      } catch {}
    })();
  }, [user?.userId]);

  const toggleNotif = () => {
    const next = !notifEnabled;
    setNotifEnabled(next);
    try { localStorage.setItem("notif_enabled", next ? "1" : "0"); } catch {}
  };

  const rows: { label: string; value: string; Icon: any }[] = [
    { label: "이름", value: profile?.name ?? "—", Icon: User },
    { label: "이메일", value: email || "—", Icon: Mail },
    { label: "전화번호", value: profile?.phone ?? "—", Icon: Phone },
    { label: "가입일", value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString("ko-KR") : "—", Icon: Calendar },
    { label: "회원유형", value: profile?.member_type ?? "—", Icon: Building2 },
    { label: "내 등록 매물 수", value: `${propertyCount}건`, Icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen pb-28 md:pb-0" style={{ background: "hsl(var(--background))" }}>
      <Header />

      <div className="max-w-2xl mx-auto px-4 py-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-md hover:bg-muted">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">내 정보</h1>
        </div>

        {/* Profile head */}
        <div className="flex items-center gap-3 p-4 rounded-2xl border mb-4"
          style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}>
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-extrabold"
            style={{ background: "linear-gradient(135deg, #6366f1, #a78bfa, #38bdf8)" }}
          >
            {(profile?.name ?? "U").slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold truncate">{profile?.name ?? "사용자"}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
        </div>

        {/* Info rows */}
        <ul className="rounded-2xl border overflow-hidden mb-4" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}>
          {rows.map((r, i) => {
            const Icon = r.Icon;
            return (
              <li
                key={r.label}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: i === 0 ? "none" : "1px solid hsl(var(--border))" }}
              >
                <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{r.label}</span>
                <span className="text-sm font-semibold text-foreground ml-auto truncate text-right">{r.value}</span>
              </li>
            );
          })}
        </ul>

        {/* Settings */}
        <ul className="rounded-2xl border overflow-hidden mb-4" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}>
          <li className="flex items-center gap-3 px-4 py-3">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">알림 설정</span>
            <button
              onClick={toggleNotif}
              className="ml-auto relative w-11 h-6 rounded-full transition-colors"
              style={{ background: notifEnabled ? "hsl(var(--accent))" : "hsl(var(--muted))" }}
              aria-pressed={notifEnabled}
            >
              <span
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                style={{ left: notifEnabled ? "22px" : "2px" }}
              />
            </button>
          </li>
          <li>
            <button
              onClick={() => navigate("/my-page")}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
              style={{ borderTop: "1px solid hsl(var(--border))" }}
            >
              <Settings className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">상세 정보 수정</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
            </button>
          </li>
        </ul>

        <button
          onClick={async () => { await logout(); navigate("/login"); }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border text-sm font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
          style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </button>
      </div>

      <MobileBottomNav />
    </div>
  );
};

export default MyInfoPage;
