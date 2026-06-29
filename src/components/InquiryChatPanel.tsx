import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, MessageCircle, Loader2 } from "lucide-react";

interface Msg {
  id: string;
  sender_role: "user" | "agent";
  content: string;
  created_at: string;
}

interface Props {
  inquiryId: string;
  viewerRole: "user" | "agent";
  /** 게스트 측 표시명 */
  guestName?: string;
  /** 에이전트 측 표시명 */
  agentName?: string;
  className?: string;
}

/**
 * 게스트 ↔ 담당자 채팅 패널 (inquiry_messages 테이블 기반)
 * - 게스트(비로그인)도 inquiry_id 만 알면 메시지 전송/수신 가능
 * - Realtime 구독 + 폴백 폴링
 */
export default function InquiryChatPanel({
  inquiryId,
  viewerRole,
  guestName,
  agentName,
  className,
}: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data, error } = await (supabase as any).rpc("get_inquiry_messages", {
      _inquiry_id: inquiryId,
    });
    if (error) console.error("[inquiry load]", error);
    setMessages(((data ?? []) as unknown) as Msg[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!inquiryId) return;
    setLoading(true);
    load();
    // Realtime
    const ch = supabase
      .channel(`inquiry-msg-${inquiryId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inquiry_messages", filter: `inquiry_id=eq.${inquiryId}` },
        (payload) => {
          const n = payload.new as any;
          setMessages((prev) =>
            prev.some((m) => m.id === n.id) ? prev : [...prev, { id: n.id, sender_role: n.sender_role, content: n.content, created_at: n.created_at }]
          );
        }
      )
      .subscribe();
    // 폴링 폴백 (게스트 anon은 realtime 권한 부족할 수 있음)
    const t = setInterval(load, 4000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiryId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    let sender_user_id: string | null = null;
    try {
      const { data } = await supabase.auth.getUser();
      sender_user_id = data.user?.id ?? null;
    } catch {}
    const { error } = await (supabase as any).from("inquiry_messages").insert({
      inquiry_id: inquiryId,
      sender_role: viewerRole,
      sender_user_id,
      content: text,
    });
    setSending(false);
    if (error) {
      console.error("[inquiry send]", error);
      alert("메시지 전송 실패: " + error.message);
      return;
    }
    setInput("");
    load();
  };

  return (
    <div className={`flex flex-col bg-card rounded-lg border border-border overflow-hidden ${className ?? ""}`}>
      <div className="px-3 py-2 border-b bg-primary/5 flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-primary" />
        <span className="text-xs font-bold text-foreground">
          {viewerRole === "user" ? `담당자와 채팅 ${agentName ? `· ${agentName}` : ""}` : `${guestName ?? "게스트"} 님과 채팅`}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/20" style={{ minHeight: 220, maxHeight: 360 }}>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8">
            아직 메시지가 없습니다. 첫 메시지를 보내보세요.
          </p>
        ) : (
          messages.map((m) => {
            const isMine = m.sender_role === viewerRole;
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] px-3 py-1.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                    isMine
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border border-border text-foreground rounded-bl-sm"
                  }`}
                >
                  {m.content}
                  <div className={`text-[9px] mt-0.5 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t bg-card p-2 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="메시지를 입력하세요"
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
