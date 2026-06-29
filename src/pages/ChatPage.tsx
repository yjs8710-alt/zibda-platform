import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, MessageCircle, Send, Building2, Hash, ExternalLink, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import MobileBottomNav from "@/components/MobileBottomNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import StaffPropertyDetailModal from "@/components/StaffPropertyDetailModal";


type Conv = {
  id: string;
  user_id: string;
  agent_user_id: string | null;
  property_id: string | null;
  user_name: string;
  last_message: string;
  last_message_at: string;
  unread_for_user: number;
  unread_for_agent: number;
};
type Msg = {
  id: string;
  sender_role: "user" | "admin" | "agent";
  content: string;
  created_at: string;
};
type PropInfo = { id: string; address: string | null; building_name: string | null; unit_number: string | null; reg_no: string | null };

const ChatPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthorized, isLoading, user } = useAuth();
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [props, setProps] = useState<Record<string, PropInfo>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [peekId, setPeekId] = useState<string | null>(null);
  const isStaff = !!user?.isAdmin || (user?.memberType !== "일반회원" && user?.memberType !== "게스트");

  useEffect(() => {
    if (!isLoading && !isAuthorized) navigate("/login");
  }, [isLoading, isAuthorized, navigate]);

  // 현재 사용자가 user 또는 agent로 참여한 모든 대화 로드
  const loadConversations = useCallback(async () => {
    if (!user?.userId) return;
    const { data } = await supabase
      .from("chat_conversations")
      .select("id, user_id, agent_user_id, property_id, user_name, last_message, last_message_at, unread_for_user, unread_for_agent")
      .or(`user_id.eq.${user.userId},agent_user_id.eq.${user.userId}`)
      .order("last_message_at", { ascending: false });
    const list = (data ?? []) as Conv[];
    setConversations(list);
    const propIds = Array.from(new Set(list.map((c) => c.property_id).filter(Boolean))) as string[];
    if (propIds.length) {
      const { data: pp } = await supabase
        .from("properties")
        .select("id, address, building_name, unit_number, reg_no")
        .in("id", propIds);
      const pmap: Record<string, PropInfo> = {};
      (pp ?? []).forEach((p: any) => { pmap[p.id] = p; });
      setProps(pmap);
    }
  }, [user?.userId]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // 알림에서 ?c=<conversation_id>로 진입 시 해당 대화 자동 열기
  useEffect(() => {
    const cid = searchParams.get("c");
    if (!cid) return;
    if (conversations.some((c) => c.id === cid)) {
      setActiveId(cid);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, conversations, setSearchParams]);

  // 실시간
  useEffect(() => {
    if (!user?.userId) return;
    const ch = supabase
      .channel(`user-chat-list-${user.userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations" }, () => loadConversations())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const m = payload.new as Msg & { conversation_id: string };
        if (activeId && m.conversation_id === activeId) {
          setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.userId, loadConversations, activeId]);

  // 활성 대화의 메시지 로드 + 미확인 초기화
  useEffect(() => {
    if (!activeId || !user?.userId) { setMessages([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, sender_role, content, created_at")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setMessages((data ?? []) as Msg[]);
      // 활성 대화 진입 시 최신 메시지(맨 아래)부터 보이도록 스크롤
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
      const conv = conversations.find((c) => c.id === activeId);
      if (conv) {
        const updates: any = {};
        if (conv.user_id === user.userId) updates.unread_for_user = 0;
        if (conv.agent_user_id === user.userId) updates.unread_for_agent = 0;
        if (Object.keys(updates).length) {
          await supabase.from("chat_conversations").update(updates).eq("id", activeId);
        }
      }
    })();
    return () => { cancelled = true; };
    // conversations는 실시간으로 자주 갱신되므로 의존성에서 제외 — 스크롤이 위로 안 올라가는 문제 방지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, user?.userId]);

  // 새 메시지가 도착했을 때만(하단 근처에 있을 때) 자동으로 따라 내려가기
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) el.scrollTo({ top: el.scrollHeight });
  }, [messages.length]);

  const active = conversations.find((c) => c.id === activeId);
  const myRole: "user" | "agent" = active && active.agent_user_id === user?.userId ? "agent" : "user";

  const send = async () => {
    const text = input.trim();
    if (!text || !activeId || !user?.userId || sending) return;
    setSending(true);
    const prevInput = input;
    setInput("");
    // 관리자는 항상 'admin' 역할로 전송 (RLS 통과 보장)
    const effectiveRole: "user" | "agent" | "admin" = user.isAdmin ? "admin" : myRole;
    const { error } = await supabase.from("chat_messages").insert({
      conversation_id: activeId,
      sender_id: user.userId,
      sender_role: effectiveRole,
      content: text,
    });
    if (error) {
      console.error("[chat send]", error);
      toast.error(`전송 실패: ${error.message || "권한 오류"}`);
      setInput(prevInput);
    } else {
      setMessages((prev) => [
        ...prev,
        { id: `tmp-${Date.now()}`, sender_role: effectiveRole, content: text, created_at: new Date().toISOString() },
      ]);
    }
    setSending(false);
  };


  return (
    <div className="min-h-screen pb-28 md:pb-0" style={{ background: "hsl(var(--background))" }}>
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-md hover:bg-muted">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <MessageCircle className="w-5 h-5" /> 채팅 문의
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 h-[calc(100vh-200px)] min-h-[480px]">
          {/* 대화 목록 */}
          <div className={`bg-card border border-border rounded-xl overflow-hidden flex-col ${activeId ? "hidden md:flex" : "flex"}`}>
            <div className="px-3 py-2 border-b border-border text-xs font-bold text-muted-foreground">
              내 대화 ({conversations.length})
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 && (
                <div className="text-center text-xs text-muted-foreground py-12 px-4">
                  진행 중인 대화가 없습니다.<br />매물 카드의 '채팅 문의'를 눌러 시작해보세요.
                </div>
              )}
              {conversations.map((c) => {
                const p = c.property_id ? props[c.property_id] : null;
                const isMyUserSide = c.user_id === user?.userId;
                const unread = isMyUserSide ? c.unread_for_user : c.unread_for_agent;
                const otherLabel = isMyUserSide ? "담당자" : c.user_name;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`w-full text-left px-3 py-3 border-b border-border last:border-0 transition-colors ${
                      activeId === c.id ? "bg-muted/50" : "hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-foreground truncate">{otherLabel || "대화"}</span>
                      {unread > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-destructive-foreground bg-destructive shrink-0">
                          {unread}
                        </span>
                      )}
                    </div>
                    {p && (
                      <div className="text-[11px] text-primary font-semibold truncate mt-1 flex items-center gap-1">
                        {p.reg_no && <span className="font-mono">NO.{p.reg_no}</span>}
                        <Building2 className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {p.building_name || p.address}{p.unit_number ? ` ${p.unit_number}호` : ""}
                        </span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{c.last_message || "(메시지 없음)"}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 대화 화면 */}
          <div className={`bg-card border border-border rounded-xl flex-col overflow-hidden ${activeId ? "flex" : "hidden md:flex"}`}>
            {!active ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground gap-2">
                <MessageCircle className="w-4 h-4" /> 대화를 선택하세요
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <button onClick={() => setActiveId(null)} className="md:hidden p-1 -ml-1 rounded-md hover:bg-muted shrink-0">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-foreground truncate">
                        {myRole === "agent" ? active.user_name : "담당자"}
                      </div>
                      {active.property_id && props[active.property_id] && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          {props[active.property_id].reg_no && (
                            <span className="inline-flex items-center gap-0.5 font-mono font-bold text-primary"><Hash className="w-3 h-3" />{props[active.property_id].reg_no}</span>
                          )}
                          <Building2 className="w-3 h-3" />
                          <span className="truncate">
                            {props[active.property_id].building_name || ""} {props[active.property_id].address || ""}
                            {props[active.property_id].unit_number ? ` ${props[active.property_id].unit_number}호` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {active.property_id && (
                    <button
                      onClick={() => {
                        if (isStaff) setPeekId(active.property_id!);
                        else navigate(`/share/${active.property_id}`);
                      }}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-card border border-border hover:bg-muted inline-flex items-center gap-1 shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> 매물 상세보기
                    </button>
                  )}
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/10">
                  {messages.length === 0 && (
                    <div className="text-center text-xs text-muted-foreground py-8">
                      메시지를 입력해 대화를 시작하세요.
                    </div>
                  )}
                  {messages.map((m) => {
                    const isMine = m.sender_role === myRole;
                    const senderLabel =
                      m.sender_role === "admin" ? "관리자"
                      : m.sender_role === "agent" ? "담당자(중개사)"
                      : myRole === "agent" ? (active.user_name || "회원") : "나";
                    return (
                      <div key={m.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                        <span className={`text-[10px] font-bold mb-0.5 px-1 ${
                          m.sender_role === "admin" ? "text-rose-500"
                          : m.sender_role === "agent" ? "text-primary"
                          : "text-muted-foreground"
                        }`}>{senderLabel}</span>
                        <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                          isMine
                            ? "text-white rounded-br-sm shadow-sm bg-gradient-to-br from-orange-400 to-orange-600"
                            : "bg-card border border-border rounded-bl-sm"
                        }`}>
                          {m.content}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 p-3 border-t border-border">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="메시지를 입력하세요"
                    className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={send}
                    disabled={sending || !input.trim()}
                    className="h-9 px-4 rounded-lg flex items-center gap-1.5 text-white text-sm font-bold disabled:opacity-50 shadow-md hover:opacity-90"
                    style={{ background: "linear-gradient(90deg, #22d3ee 0%, #a855f7 50%, #ec4899 100%)" }}

                  >
                    <Send className="w-4 h-4" /> 보내기
                  </button>

                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <MobileBottomNav />
      {peekId && <StaffPropertyDetailModal propertyId={peekId} onClose={() => setPeekId(null)} />}
    </div>
  );
};

export default ChatPage;
