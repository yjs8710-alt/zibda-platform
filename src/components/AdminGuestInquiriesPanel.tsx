import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, MessageCircle, Search, Check, Trash2, User, Hash, Clock, Building2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Inquiry = {
  id: string;
  property_id: string | null;
  property_reg_no: string | null;
  agent_user_id: string | null;
  user_id: string | null;
  name: string;
  phone: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
};

type AgentInfo = { user_id: string; name: string; phone: string | null; company: string | null };
type PropInfo = { id: string; address: string | null; building_name: string | null; unit_number: string | null; reg_no: string | null };

const AdminGuestInquiriesPanel = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<Inquiry[]>([]);
  const [agents, setAgents] = useState<Record<string, AgentInfo>>({});
  const [props, setProps] = useState<Record<string, PropInfo>>({});
  const [filter, setFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "guest" | "member">("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("guest_inquiries")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("문의 내역을 불러오지 못했습니다");
      setLoading(false);
      return;
    }
    const list = (data ?? []) as Inquiry[];
    setItems(list);
    const ids = Array.from(new Set(list.map((i) => i.agent_user_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: ap } = await supabase
        .from("agent_profiles")
        .select("user_id, name, phone, company")
        .in("user_id", ids);
      const map: Record<string, AgentInfo> = {};
      (ap ?? []).forEach((a: any) => { map[a.user_id] = a; });
      setAgents(map);
    }
    const propIds = Array.from(new Set(list.map((i) => i.property_id).filter(Boolean))) as string[];
    if (propIds.length) {
      const { data: pp } = await supabase
        .from("properties")
        .select("id, address, building_name, unit_number, reg_no")
        .in("id", propIds);
      const pmap: Record<string, PropInfo> = {};
      (pp ?? []).forEach((p: any) => { pmap[p.id] = p; });
      setProps(pmap);
    }
    setLoading(false);
  };


  useEffect(() => { load(); }, []);

  useEffect(() => {
    const ch = supabase
      .channel("admin-inquiries")
      .on("postgres_changes", { event: "*", schema: "public", table: "guest_inquiries" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const grouped = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const filtered = items.filter((i) => {
      if (agentFilter !== "all" && (i.agent_user_id ?? "_none") !== agentFilter) return false;
      if (sourceFilter === "guest" && i.user_id) return false;
      if (sourceFilter === "member" && !i.user_id) return false;
      if (!q) return true;
      return (
        (i.name ?? "").toLowerCase().includes(q) ||
        (i.phone ?? "").includes(q) ||
        (i.message ?? "").toLowerCase().includes(q) ||
        (i.property_reg_no ?? "").includes(q)
      );
    });
    const map = new Map<string, Inquiry[]>();
    filtered.forEach((i) => {
      const key = i.agent_user_id ?? "_none";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    });
    return Array.from(map.entries());
  }, [items, filter, agentFilter, sourceFilter]);


  const markRead = async (id: string, is_read: boolean) => {
    const { error } = await supabase.from("guest_inquiries").update({ is_read }).eq("id", id);
    if (error) return toast.error("업데이트 실패");
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_read } : i)));
  };

  const remove = async (id: string) => {
    // 낙관적 업데이트 (즉시 반영)
    const prev = items;
    setItems((p) => p.filter((i) => i.id !== id));
    const { error } = await supabase.from("guest_inquiries").delete().eq("id", id);
    if (error) {
      setItems(prev);
      toast.error("삭제 실패: " + error.message);
    } else {
      toast.success("삭제되었습니다");
    }
  };

  const agentOptions = useMemo(() => {
    const list = Object.values(agents);
    list.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    return list;
  }, [agents]);

  const totalUnread = items.filter((i) => !i.is_read).length;

  return (
    <div className="p-4 md:p-6 space-y-5 bg-background min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-foreground">문의 내역</h2>
          <p className="text-sm text-muted-foreground mt-1">
            전체 <span className="font-bold text-foreground">{items.length}</span>건 · 미확인{" "}
            <span className="text-destructive font-extrabold">{totalUnread}</span>건
            <span className="ml-2 text-xs">(게스트 {items.filter(i=>!i.user_id).length} · 회원 {items.filter(i=>!!i.user_id).length})</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as any)}
            className="text-sm px-3 py-2 rounded-lg bg-card text-foreground border border-border font-medium"
          >
            <option value="all">전체</option>
            <option value="guest">게스트</option>
            <option value="member">회원/중개사</option>
          </select>
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="text-sm px-3 py-2 rounded-lg bg-card text-foreground border border-border font-medium"
          >
            <option value="all">담당자 전체</option>
            <option value="_none">담당자 미지정</option>
            {agentOptions.map((a) => (
              <option key={a.user_id} value={a.user_id}>{a.name}{a.company ? ` (${a.company})` : ""}</option>
            ))}
          </select>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="이름/번호/매물번호"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-sm pl-8 pr-3 py-2 rounded-lg bg-card text-foreground border border-border placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-16 text-sm">불러오는 중...</div>
      ) : grouped.length === 0 ? (
        <div className="text-center text-muted-foreground py-16 text-sm">문의 내역이 없습니다</div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([agentId, list]) => {
            const a = agentId !== "_none" ? agents[agentId] : null;
            const unread = list.filter((i) => !i.is_read).length;
            return (
              <div key={agentId} className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                {/* Agent header */}
                <div className="px-5 py-3.5 bg-primary/5 border-b border-border flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
                      <User className="w-4.5 h-4.5 text-primary" />
                    </div>
                    {a ? (
                      <div>
                        <div className="text-base font-extrabold text-foreground leading-tight">
                          {a.name}
                          {a.company && <span className="ml-2 text-sm font-semibold text-muted-foreground">{a.company}</span>}
                        </div>
                        {a.phone && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" /> {a.phone}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-base font-bold text-muted-foreground">담당자 미지정</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {unread > 0 && (
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-destructive text-destructive-foreground">
                        미확인 {unread}
                      </span>
                    )}
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-muted text-foreground">
                      총 {list.length}건
                    </span>
                  </div>
                </div>

                {/* Table header (desktop) */}
                <div className="hidden md:grid grid-cols-[110px_1fr_140px_2fr_140px_120px] gap-3 px-5 py-2.5 bg-muted/40 border-b border-border text-xs font-bold text-muted-foreground">
                  <div>매물번호</div>
                  <div>문의자</div>
                  <div>연락처</div>
                  <div>문의내용</div>
                  <div>일시</div>
                  <div className="text-right">관리</div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-border">
                  {list.map((i) => (
                    <div
                      key={i.id}
                      className={`px-5 py-3.5 transition-colors ${
                        !i.is_read ? "bg-primary/[0.04] hover:bg-primary/[0.07]" : "hover:bg-muted/30"
                      }`}
                    >
                      {/* Desktop row */}
                      <div className="hidden md:grid grid-cols-[110px_1fr_140px_2fr_140px_120px] gap-3 items-center">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {!i.is_read && (
                            <span className="w-2 h-2 rounded-full bg-destructive" title="미확인" />
                          )}
                          {i.user_id && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">회원</span>
                          )}
                          {i.property_reg_no ? (
                            <span className="inline-flex items-center gap-1 text-xs font-mono font-extrabold px-2 py-1 rounded-md bg-primary/10 text-primary">
                              <Hash className="w-3 h-3" />NO.{i.property_reg_no}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="text-sm font-bold text-foreground flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            {i.name}
                          </div>
                          {i.property_id && props[i.property_id] && (
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                              <Building2 className="w-3 h-3 shrink-0" />
                              <span className="truncate">
                                {props[i.property_id].building_name || ""} {props[i.property_id].address || ""}
                                {props[i.property_id].unit_number ? ` ${props[i.property_id].unit_number}호` : ""}
                              </span>
                            </div>
                          )}
                        </div>
                        <a
                          href={`tel:${i.phone.replace(/[^0-9]/g, "")}`}
                          className="text-sm font-semibold text-primary hover:underline flex items-center gap-1"
                        >
                          <Phone className="w-3.5 h-3.5" /> {i.phone}
                        </a>
                        <div className="text-sm text-foreground flex items-start gap-1.5">
                          <MessageCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                          <span className="whitespace-pre-wrap break-words">
                            {i.message || <span className="text-muted-foreground italic">메시지 없음</span>}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(i.created_at).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          {i.property_id && (
                            <button
                              onClick={() => navigate(`/?propertyId=${i.property_id}`)}
                              className="p-2 rounded-lg bg-card border border-border text-foreground hover:bg-muted"
                              title="매물 상세보기"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => markRead(i.id, !i.is_read)}
                            className={`p-2 rounded-lg transition-colors ${
                              i.is_read
                                ? "bg-muted text-muted-foreground hover:bg-muted/70"
                                : "bg-primary text-primary-foreground hover:opacity-90"
                            }`}
                            title={i.is_read ? "미확인으로" : "확인 처리"}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => remove(i.id)}
                            className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                      </div>

                      {/* Mobile row */}
                      <div className="md:hidden space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {!i.is_read && (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground">NEW</span>
                          )}
                          {i.property_reg_no && (
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">NO.{i.property_reg_no}</span>
                          )}
                          <span className="text-sm font-bold text-foreground">{i.name}</span>
                          <a href={`tel:${i.phone.replace(/[^0-9]/g, "")}`} className="text-sm font-semibold text-primary flex items-center gap-1 ml-auto">
                            <Phone className="w-3.5 h-3.5" /> {i.phone}
                          </a>
                        </div>
                        {i.message && (
                          <p className="text-sm text-foreground bg-muted/40 rounded-lg px-3 py-2 whitespace-pre-wrap">
                            {i.message}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(i.created_at).toLocaleString("ko-KR")}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => markRead(i.id, !i.is_read)}
                              className={`p-1.5 rounded-lg ${i.is_read ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => remove(i.id)} className="p-1.5 rounded-lg bg-destructive/10 text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminGuestInquiriesPanel;
