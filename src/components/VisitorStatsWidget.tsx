import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, TrendingUp } from "lucide-react";

interface DayBucket {
  date: string; // YYYY-MM-DD (local)
  count: number;
}

const ymd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const VisitorStatsWidget = () => {
  const [todayCount, setTodayCount] = useState<number>(0);
  const [weekly, setWeekly] = useState<DayBucket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    // 최근 7일 기록 조회 (최대 10000건)
    const { data, error } = await supabase
      .from("page_views")
      .select("created_at")
      .gte("created_at", startOfWeek.toISOString())
      .order("created_at", { ascending: false })
      .limit(10000);

    if (error) {
      setLoading(false);
      return;
    }

    // 일자별 집계
    const buckets: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      buckets[ymd(d)] = 0;
    }
    let today = 0;
    (data ?? []).forEach((r: any) => {
      const d = new Date(r.created_at);
      const key = ymd(d);
      if (key in buckets) buckets[key]++;
      if (d.getTime() >= startOfToday.getTime()) today++;
    });
    setTodayCount(today);
    setWeekly(Object.entries(buckets).map(([date, count]) => ({ date, count })));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
    // 실시간 구독
    const ch = supabase
      .channel("admin-page-views")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "page_views" }, () => {
        fetchStats();
      })
      .subscribe();
    // 1분마다 폴링도 보장
    const t = setInterval(fetchStats, 60_000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(t);
    };
  }, [fetchStats]);

  const maxCount = Math.max(1, ...weekly.map((b) => b.count));
  const total7 = weekly.reduce((s, b) => s + b.count, 0);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
          <h3 className="text-sm font-bold text-foreground">실시간 사이트 접속수</h3>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "hsl(var(--destructive)/0.12)", color: "hsl(var(--destructive))" }}>
            LIVE
          </span>
        </div>
        <div className="text-xs text-muted-foreground">최근 7일 {total7.toLocaleString()}건</div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs text-muted-foreground mb-1">오늘 접속수</div>
          <div className="text-2xl font-extrabold text-foreground tabular-nums">
            {loading ? "…" : todayCount.toLocaleString()}
          </div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> 일평균 (7일)
          </div>
          <div className="text-2xl font-extrabold text-foreground tabular-nums">
            {loading ? "…" : Math.round(total7 / 7).toLocaleString()}
          </div>
        </div>
      </div>

      {/* 7일 막대 그래프 */}
      <div className="flex items-end gap-1.5 h-28">
        {weekly.map((b) => {
          const heightPct = (b.count / maxCount) * 100;
          const isToday = b.date === ymd(new Date());
          const md = b.date.slice(5).replace("-", "/");
          const dow = new Date(b.date + "T00:00:00").toLocaleDateString("ko-KR", { weekday: "short" });
          return (
            <div key={b.date} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-[10px] font-bold text-foreground tabular-nums">{b.count}</div>
              <div className="w-full flex-1 flex items-end">
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${heightPct}%`,
                    minHeight: "2px",
                    background: isToday ? "hsl(var(--primary))" : "hsl(var(--primary)/0.35)",
                  }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground">{md}</div>
              <div className={`text-[9px] ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>{dow}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VisitorStatsWidget;
