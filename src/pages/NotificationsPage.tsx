import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Bell, Check, Trash2, ChevronLeft, AlertCircle, FileText, CheckCircle2, Eye, MessageCircle, Phone, X, User2, Building2, ExternalLink } from "lucide-react";
import Header from "@/components/Header";
import MobileBottomNav from "@/components/MobileBottomNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { loadCheongjuContact } from "@/lib/cheongjuContacts";
import StaffPropertyDetailModal from "@/components/StaffPropertyDetailModal";

interface Notification {
  id: string;
  type: "report" | "proposal" | "transaction" | "view" | "guest_inquiry" | "chat_inquiry" | string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_META: Record<string, { label: string; Icon: any; color: string }> = {
  report:         { label: "신고",       Icon: AlertCircle,  color: "#f97316" },
  proposal:       { label: "제안",       Icon: FileText,     color: "#a78bfa" },
  transaction:    { label: "거래완료",   Icon: CheckCircle2, color: "#22c55e" },
  view:           { label: "조회",       Icon: Eye,          color: "#60a5fa" },
  guest_inquiry:  { label: "매물문의",   Icon: MessageCircle, color: "#e11d48" },
  chat_inquiry:   { label: "채팅문의",   Icon: MessageCircle, color: "#0ea5e9" },
};

type InquiryDetail = {
  id: string;
  name: string;
  phone: string;
  message: string | null;
  created_at: string;
  property_reg_no: string | null;
  property_id?: string | null;
  property_dong?: string | null;
  property_lot?: string | null;
  property_unit?: string | null;
  property_address?: string | null;
  property_building?: string | null;
  owner_phone?: string | null;
  user_id?: string | null;
  inquirer_kind?: "게스트" | "일반회원" | "중개사" | "관리자" | null;
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthorized, user, isLoading } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<InquiryDetail | null>(null);
  const [peekId, setPeekId] = useState<string | null>(null);


  const load = useCallback(async () => {
    if (!user?.userId) return;
    setLoading(true);
    const { data } = await (supabase.from("notifications") as any)
      .select("*")
      .eq("user_id", user.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    setItems((data ?? []) as Notification[]);
    setLoading(false);
  }, [user?.userId]);

  useEffect(() => {
    if (!isLoading && !isAuthorized) navigate("/login");
  }, [isLoading, isAuthorized, navigate]);

  useEffect(() => {
    if (!user?.userId) return;
    load();
    const ch = supabase
      .channel("notifications-page")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.userId}`,
      }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.userId, load]);

  const openChatFromConversation = useCallback((cid: string) => {
    // 우측 떠있는 채팅 위젯이 아닌, 채팅 페이지로 이동하여 해당 대화를 표시
    navigate(`/chat?c=${cid}`);
  }, [navigate]);

  const openInquiryDetail = useCallback(async (id: string) => {
    const { data } = await supabase
      .from("guest_inquiries")
      .select("id, name, phone, message, created_at, property_reg_no, property_id, user_id" as any)
      .eq("id", id)
      .maybeSingle();
    if (!data) return;
    const d: any = data;
    let dong: string | null = null, lot: string | null = null, unit: string | null = null;
    let address: string | null = null, building: string | null = null;
    let ownerPhone: string | null = null;
    if (d.property_id) {
      const { data: prop } = await supabase
        .from("properties")
        .select("dong, lot_number, unit_number, address, building_name")
        .eq("id", d.property_id)
        .maybeSingle();
      dong = prop?.dong ?? null;
      lot = prop?.lot_number ?? null;
      unit = (prop as any)?.unit_number ?? null;
      address = (prop as any)?.address ?? null;
      building = (prop as any)?.building_name ?? null;
      if (dong && lot) {
        try {
          const c = await loadCheongjuContact({ dong, lotNumber: lot, unitNumber: unit ?? undefined });
          ownerPhone = c?.contactOwner || null;
        } catch (e) { console.warn("[owner phone]", e); }
      }
    }
    let inquirerKind: InquiryDetail["inquirer_kind"] = d.user_id ? "일반회원" : "게스트";
    if (d.user_id) {
      try {
        const { data: prof } = await supabase
          .from("agent_profiles")
          .select("member_type")
          .eq("user_id", d.user_id)
          .maybeSingle();
        const mt = (prof as any)?.member_type as string | undefined;
        if (mt === "대표중개사" || mt === "소속중개사" || mt === "중개보조원") inquirerKind = "중개사";
        else if (mt === "일반회원") inquirerKind = "일반회원";
        const { data: roleRow } = await (supabase as any)
          .from("user_roles")
          .select("role")
          .eq("user_id", d.user_id)
          .eq("role", "admin")
          .maybeSingle();
        if (roleRow) inquirerKind = "관리자";
      } catch (e) { /* noop */ }
    }
    setDetail({
      id: d.id,
      name: d.name,
      phone: d.phone,
      message: d.message,
      created_at: d.created_at,
      property_reg_no: d.property_reg_no,
      property_id: d.property_id ?? null,
      property_dong: dong,
      property_lot: lot,
      property_unit: unit,
      property_address: address,
      property_building: building,
      owner_phone: ownerPhone,
      user_id: d.user_id ?? null,
      inquirer_kind: inquirerKind,
    });
  }, []);

  const startChatFromInquiry = useCallback(async (inq: InquiryDetail) => {
    const { data: cid, error } = await (supabase as any).rpc("start_chat_from_inquiry", { _inquiry_id: inq.id });
    if (error || !cid) {
      console.error("[start_chat_from_inquiry]", error);
      alert("이 문의는 비회원 게스트 문의입니다.\n채팅 대신 전화로 연락해주세요.");
      return;
    }
    setDetail(null);
    await openChatFromConversation(cid as string);
  }, [openChatFromConversation]);

  // 알림 링크 클릭 시 처리(URL 쿼리)
  useEffect(() => {
    const chat = searchParams.get("chat");
    const inquiry = searchParams.get("inquiry");
    if (chat) {
      openChatFromConversation(chat);
      setSearchParams({}, { replace: true });
    } else if (inquiry) {
      openInquiryDetail(inquiry);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, openChatFromConversation, openInquiryDetail]);

  const markRead = async (id: string) => {
    await (supabase.from("notifications") as any).update({ is_read: true }).eq("id", id);
  };
  const markAllRead = async () => {
    if (!user?.userId) return;
    await (supabase.from("notifications") as any)
      .update({ is_read: true })
      .eq("user_id", user.userId)
      .eq("is_read", false);
  };
  const remove = async (id: string) => {
    await (supabase.from("notifications") as any).delete().eq("id", id);
  };

  const handleClick = async (n: Notification) => {
    if (!n.is_read) await markRead(n.id);
    if (!n.link) return;
    // 링크가 외부/다른 경로면 그대로 이동
    if (!n.link.startsWith("/notifications")) {
      navigate(n.link);
      return;
    }
    // /notifications?chat=... 또는 ?inquiry=...
    const qs = n.link.includes("?") ? n.link.slice(n.link.indexOf("?") + 1) : "";
    const params = new URLSearchParams(qs);
    const cid = params.get("chat");
    const iid = params.get("inquiry");
    if (cid) await openChatFromConversation(cid);
    else if (iid) await openInquiryDetail(iid);
  };

  const unread = items.filter(i => !i.is_read).length;

  return (
    <div className="min-h-screen pb-28 md:pb-0" style={{ background: "hsl(var(--background))" }}>
      <Header />

      <div className="max-w-2xl mx-auto px-4 py-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-md hover:bg-muted">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-foreground" />
            <h1 className="text-lg font-bold">알림</h1>
            {unread > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground">
                {unread}
              </span>
            )}
          </div>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="ml-auto text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              모두 읽음
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground text-center py-12">불러오는 중…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">알림이 없습니다.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => {
              const meta = TYPE_META[n.type] ?? TYPE_META.view;
              const Icon = meta.Icon;
              return (
                <li
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleClick(n)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(n); } }}
                  className="flex items-start gap-3 p-3 rounded-xl border bg-card cursor-pointer hover:bg-muted/40 transition-colors"
                  style={{
                    borderColor: n.is_read ? "hsl(var(--border))" : "hsl(var(--accent) / 0.5)",
                    background: n.is_read ? "hsl(var(--card))" : "hsl(var(--accent) / 0.06)",
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: `${meta.color}22`, color: meta.color }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${meta.color}22`, color: meta.color }}>
                        {meta.label}
                      </span>
                      {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-destructive" />}
                    </div>
                    <p className="text-sm font-semibold mt-1 truncate">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(n.created_at).toLocaleString("ko-KR")}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                    className="p-1 text-muted-foreground hover:text-destructive flex-shrink-0"
                    aria-label="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>

              );
            })}
          </ul>
        )}
      </div>

      {/* 게스트 매물 문의 상세 */}
      {detail && (
        <div className="fixed inset-0 z-[10200] flex items-end md:items-center justify-center p-3 md:p-6" style={{ background: "rgba(0,0,0,0.55)" }} onClick={() => setDetail(null)}>
          <div className="bg-card rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ background: "hsl(var(--header-bg))" }}>
              <div className="flex items-center gap-2 text-white">
                <MessageCircle className="w-4 h-4" />
                <span className="text-sm font-bold">매물 문의 상세</span>
              </div>
              <button onClick={() => setDetail(null)} className="text-white/80 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {/* 매물 헤더 */}
              {(detail.property_reg_no || detail.property_address || detail.property_dong) && (
                <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Building2 className="w-4 h-4 text-primary" />
                    {detail.property_reg_no && (
                      <span className="text-[11px] font-mono font-extrabold px-2 py-0.5 rounded bg-primary/10 text-primary">
                        NO.{detail.property_reg_no}
                      </span>
                    )}
                    {detail.property_building && (
                      <span className="text-xs font-bold text-foreground">{detail.property_building}</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-foreground break-words">
                    {detail.property_address || [detail.property_dong, detail.property_lot].filter(Boolean).join(" ") || "주소 정보 없음"}
                    {detail.property_unit ? ` ${detail.property_unit}호` : ""}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    {detail.property_id && (
                      <button
                        onClick={() => {
                          setPeekId(detail.property_id!);
                        }}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-bold rounded-md bg-card border border-border hover:bg-muted"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> 매물 상세보기
                      </button>
                    )}


                    {detail.owner_phone ? (
                      <a
                        href={`tel:${detail.owner_phone.replace(/[^0-9+]/g, "")}`}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-bold rounded-md bg-emerald-600 text-white hover:opacity-90"
                      >
                        <Phone className="w-3.5 h-3.5" /> 소유주 전화
                      </a>
                    ) : (
                      <span className="flex-1 text-center py-1.5 text-[11px] text-muted-foreground border border-dashed border-border rounded-md">
                        소유주 연락처 미등록
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 문의자 정보 */}
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <User2 className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold">{detail.name}</span>
                {detail.inquirer_kind && (
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                    detail.inquirer_kind === "게스트" ? "bg-amber-100 text-amber-700 border border-amber-300"
                    : detail.inquirer_kind === "일반회원" ? "bg-sky-100 text-sky-700 border border-sky-300"
                    : detail.inquirer_kind === "중개사" ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                    : "bg-rose-100 text-rose-700 border border-rose-300"
                  }`}>
                    {detail.inquirer_kind}
                  </span>
                )}
                <a
                  href={`tel:${detail.phone.replace(/[^0-9]/g, "")}`}
                  className="ml-auto flex items-center gap-1 text-sm font-bold text-primary"
                >
                  <Phone className="w-3.5 h-3.5" /> {detail.phone}
                </a>
              </div>
              <div className="rounded-lg border p-3 text-sm whitespace-pre-wrap bg-muted/40">
                {detail.message || "문의 메시지 없음"}
              </div>
              <p className="text-[11px] text-muted-foreground text-right">
                {new Date(detail.created_at).toLocaleString("ko-KR")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`tel:${detail.phone.replace(/[^0-9]/g, "")}`}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm"
                >
                  <Phone className="w-4 h-4" /> 문의자 전화
                </a>
                {detail.user_id ? (
                  <button
                    onClick={() => startChatFromInquiry(detail)}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold text-sm bg-accent text-accent-foreground"
                  >
                    <MessageCircle className="w-4 h-4" /> 회원 채팅 답변
                  </button>
                ) : (
                  <span className="text-[11px] text-muted-foreground text-center self-center leading-relaxed">
                    게스트 문의는 전화로 연락해주세요
                  </span>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 매물 상세 (중개사/관리자 전용 통합 모달) */}
      {peekId && (
        <StaffPropertyDetailModal propertyId={peekId} onClose={() => setPeekId(null)} />
      )}


      <MobileBottomNav />
    </div>
  );
};

export default NotificationsPage;
