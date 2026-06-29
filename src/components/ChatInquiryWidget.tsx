import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { pushOverlay, popOverlay } from "@/lib/overlayGuard";


type Msg = {
  id: string;
  sender_role: "user" | "admin" | "agent";
  content: string;
  created_at: string;
};

type ChatContext = {
  agentUserId: string | null;
  propertyId: string | null;
  propertyTitle?: string;
  agentName?: string;
  conversationId?: string | null;
};

const ChatInquiryWidget = () => {
  const { isAuthorized, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [ctx, setCtx] = useState<ChatContext>({ agentUserId: null, propertyId: null });
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  /** 현재 사용자가 이 대화에서 가지는 역할 */
  const [role, setRole] = useState<"user" | "agent" | "admin">("user");
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ensureConversation = useCallback(async (context: ChatContext): Promise<string | null> => {
    if (!user) return null;
    // 알림에서 전달된 대화ID가 있으면 그대로 사용
    if (context.conversationId) {
      setConversationId(context.conversationId);
      return context.conversationId;
    }
    const agentId = context.agentUserId;
    const propId = context.propertyId;

    let query = supabase
      .from("chat_conversations")
      .select("id, unread_for_user")
      .eq("user_id", user.userId);
    query = agentId ? query.eq("agent_user_id", agentId) : query.is("agent_user_id", null);
    query = propId ? query.eq("property_id", propId) : query.is("property_id", null);
    const { data: existingList, error: findErr } = await query.order("created_at", { ascending: false }).limit(1);
    if (findErr) {
      console.error("[ChatInquiry] find conv", findErr);
      toast.error("대화를 불러올 수 없습니다");
      return null;
    }
    const existing = existingList?.[0];

    if (existing) {
      setConversationId(existing.id);
      setUnread(existing.unread_for_user ?? 0);
      return existing.id;
    }

    let displayName = "사용자";
    try {
      const { data: prof } = await supabase
        .from("agent_profiles")
        .select("name, agency_name")
        .eq("user_id", user.userId)
        .maybeSingle();
      if (prof?.name) {
        displayName = `${prof.name}${prof.agency_name ? ` (${prof.agency_name})` : ""}`;
      }
    } catch (e) {
      console.warn("[ChatInquiry] profile fetch", e);
    }
    const { data: created, error } = await supabase
      .from("chat_conversations")
      .insert({
        user_id: user.userId,
        user_name: displayName,
        agent_user_id: agentId,
        property_id: propId,
        last_message: "",
        last_message_at: new Date().toISOString(),
      } as any)
      .select("id")
      .single();
    if (error) {
      // 동시성으로 인한 유니크 충돌이면 재조회
      if ((error as any).code === "23505") {
        const { data: again } = await query.order("created_at", { ascending: false }).limit(1);
        if (again?.[0]) {
          setConversationId(again[0].id);
          return again[0].id;
        }
      }
      console.error("[ChatInquiry] create conv", error);
      toast.error(`채팅 시작 실패: ${error.message || "권한을 확인해주세요"}`);
      return null;
    }
    setConversationId(created.id);
    return created.id;
  }, [user]);


  // 헤더 또는 매물카드/알림에서 발생하는 전역 이벤트 수신
  useEffect(() => {
    const handler = (e: Event) => {
      if (!isAuthorized) { navigate("/login"); return; }
      const detail = (e as CustomEvent).detail || {};
      const nextCtx: ChatContext = {
        agentUserId: detail.agentUserId || null,
        propertyId: detail.propertyId || null,
        propertyTitle: detail.propertyTitle,
        agentName: detail.agentName,
        conversationId: detail.conversationId || null,
      };
      setCtx((prev) => {
        const changed = prev.agentUserId !== nextCtx.agentUserId
          || prev.propertyId !== nextCtx.propertyId
          || prev.conversationId !== nextCtx.conversationId;
        if (changed) {
          setConversationId(nextCtx.conversationId ?? null);
          setMessages([]);
        }
        return nextCtx;
      });
      setOpen(true);
    };
    window.addEventListener("open-chat-inquiry", handler);
    return () => window.removeEventListener("open-chat-inquiry", handler);
  }, [isAuthorized, navigate]);

  // 뒤로가기로 채팅창 닫기
  useEffect(() => {
    if (!open) return;
    pushOverlay();
    window.history.pushState({ chatInquiry: true }, "");
    const onPop = () => setOpen(false);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      popOverlay();
    };
  }, [open]);

  // Realtime
  useEffect(() => {
    if (!conversationId) return;
    const ch = supabase
      .channel(`chat-conv-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chat_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const m = payload.new as Msg;
        setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
        if (m.sender_role !== role && !open) setUnread((u) => u + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId, open, role]);

  // 채팅 열리면 대화 메타 + 메시지 로드, 역할 판정
  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      let cid = conversationId;
      if (!cid) cid = await ensureConversation(ctx);
      if (!cid) return;

      // 역할 판정: 현재 사용자가 대화의 user/agent/admin 중 누구인가
      const { data: conv } = await supabase
        .from("chat_conversations")
        .select("user_id, agent_user_id")
        .eq("id", cid)
        .maybeSingle();
      let r: "user" | "agent" | "admin" = "user";
      if (user.isAdmin) r = "admin";
      else if (conv?.agent_user_id === user.userId) r = "agent";
      else if (conv?.user_id === user.userId) r = "user";
      setRole(r);

      const { data } = await supabase
        .from("chat_messages")
        .select("id, sender_role, content, created_at")
        .eq("conversation_id", cid)
        .order("created_at", { ascending: true });
      setMessages((data ?? []) as Msg[]);
      // 본인의 미확인 카운터 초기화
      const updates: { unread_for_agent?: number; unread_for_user?: number; unread_for_admin?: number } = {};
      if (r === "agent") updates.unread_for_agent = 0;
      else if (r === "user") updates.unread_for_user = 0;
      else if (r === "admin") updates.unread_for_admin = 0;
      if (Object.keys(updates).length) {
        await supabase.from("chat_conversations").update(updates).eq("id", cid);
      }

      setUnread(0);
    })();
  }, [open, conversationId, ensureConversation, ctx, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || !user || sending) return;
    setSending(true);
    let cid = conversationId;
    if (!cid) cid = await ensureConversation(ctx);
    if (!cid) { setSending(false); return; }
    setInput("");
    const { error } = await supabase.from("chat_messages").insert({
      conversation_id: cid,
      sender_id: user.userId,
      sender_role: role,
      content: text,
    });
    if (error) {
      console.error("[chat send]", error);
      toast.error(`전송 실패: ${error.message || "권한 오류"}`);
      setInput(text);
    }
    setSending(false);
  };


  if (!open) return null;

  const title = role === "agent"
    ? "고객 채팅 문의"
    : role === "admin"
      ? "관리자 채팅"
      : ctx.agentUserId
        ? (ctx.agentName ? `${ctx.agentName} 중개사와 채팅` : "담당 중개사 채팅")
        : "관리자 채팅 문의";

  return (
    <div
      className="fixed z-[1150] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden
        inset-x-3 bottom-20 top-16
        md:inset-auto md:bottom-24 md:right-6 md:w-[380px] md:h-[520px] md:top-auto"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border" style={{ background: "hsl(var(--header-bg))" }}>
        <div className="flex flex-col text-white">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            <span className="text-sm font-bold">{title}</span>
          </div>
          {ctx.propertyTitle && (
            <span className="text-[11px] text-white/80 mt-0.5 line-clamp-1">{ctx.propertyTitle}</span>
          )}
        </div>
        <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
        {messages.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">
            {role === "agent"
              ? "고객의 문의에 답변해주세요."
              : ctx.agentUserId
                ? "담당 중개사에게 문의 내용을 남겨주세요."
                : "관리자에게 문의 내용을 남겨주세요."}
            <br />빠르게 답변드리겠습니다.
          </div>
        )}
        {messages.map((m) => {
          const isMine = m.sender_role === role;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                  isMine
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border border-border rounded-bl-sm"
                }`}
              >
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
          className="h-9 w-9 rounded-lg flex items-center justify-center text-white disabled:opacity-50"
          style={{ background: "hsl(var(--accent))" }}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ChatInquiryWidget;
