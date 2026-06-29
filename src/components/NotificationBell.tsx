import { useEffect, useState, useCallback } from "react";
import { Bell } from "lucide-react";
import iconBellNeon from "@/assets/icon-bell-neon.png";

import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  variant?: "desktop" | "mobile";
}

const NotificationBell = ({ variant = "desktop" }: Props) => {
  const navigate = useNavigate();
  const { isAuthorized, user } = useAuth();
  const [count, setCount] = useState(0);
  const targetPath = !isAuthorized ? "/login" : "/notifications";

  const refresh = useCallback(async () => {
    if (!user?.userId) { setCount(0); return; }
    const { count: c } = await (supabase.from("notifications") as any)
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.userId)
      .eq("is_read", false);
    setCount(c ?? 0);
  }, [user?.userId]);

  useEffect(() => {
    if (!isAuthorized || !user?.userId) return;
    refresh();
    const ch = supabase
      .channel(`user-notifications-bell-${variant}-${user.userId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.userId}`,
      }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAuthorized, user?.userId, refresh]);

  if (variant === "mobile") {
    return (
      <button
        onClick={() => navigate(targetPath)}
        className="relative flex items-center justify-center px-1"
        aria-label="알림"
        title="알림"
      >
        <Bell className="w-8 h-8" style={{ stroke: "url(#neonIconGrad)" }} strokeWidth={2.2} />
        {count > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center bg-destructive text-destructive-foreground">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={() => navigate(targetPath)}
      className="relative inline-flex items-center justify-center p-1"
      aria-label="알림"
    >
      <img src={iconBellNeon} alt="알림" className="w-16 h-16 object-contain" />
      {count > 0 && (
        <span className="absolute top-3 right-2 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-destructive text-destructive-foreground ring-2 ring-[hsl(var(--header-bg))]">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
};

export default NotificationBell;
