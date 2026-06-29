import { useEffect, useState } from "react";
import { X, Building2, MapPin, Phone, User2, FileText, NotebookPen, Home as HomeIcon, Loader2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadCheongjuContact } from "@/lib/cheongjuContacts";

interface Props {
  propertyId: string;
  onClose: () => void;
}

type PropFull = {
  id: string;
  reg_no: string | null;
  address: string | null;
  dong: string | null;
  lot_number: string | null;
  unit_number: string | null;
  building_name: string | null;
  type: string | null;
  room_type: string | null;
  floor: string | null;
  area: string | null;
  deposit: string | null;
  monthly: string | null;
  manage_fee: string | null;
  parking: string | null;
  elevator: string | null | boolean;
  available_from: string | null;
  note: string | null;
  description: string | null;
  building_memo: string | null;
  room_memo: string | null;
  agent_name: string | null;
  images: string[] | null;
};

const replaceOwnerTerm = (s: string | null | undefined) =>
  (s ?? "").replace(/건물주/g, "소유주");

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5 min-w-0">
    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{label}</span>
    <span className="text-sm font-semibold text-foreground break-words">{value || "-"}</span>
  </div>
);

const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
  <section className="rounded-xl border border-border bg-card">
    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/40">
      <Icon className="w-3.5 h-3.5 text-primary" />
      <h3 className="text-xs font-extrabold text-foreground">{title}</h3>
    </div>
    <div className="p-3">{children}</div>
  </section>
);

const StaffPropertyDetailModal = ({ propertyId, onClose }: Props) => {
  const [data, setData] = useState<PropFull | null>(null);
  const [ownerPhone, setOwnerPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: p } = await (supabase as any)
        .from("properties")
        .select(
          "id, reg_no, address, dong, lot_number, unit_number, building_name, type, room_type, floor, area, deposit, monthly, manage_fee, parking, elevator, available_from, note, description, building_memo, room_memo, agent_name, images"
        )
        .eq("id", propertyId)
        .maybeSingle();
      if (cancelled) return;
      setData((p as PropFull | null) ?? null);
      if (p?.dong && p?.lot_number) {
        try {
          const c = await loadCheongjuContact({ dong: p.dong, lotNumber: p.lot_number, unitNumber: p.unit_number ?? undefined });
          if (!cancelled) setOwnerPhone(c?.contactOwner || null);
        } catch {}
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [propertyId]);

  return (
    <div
      className="fixed inset-0 z-[10300] flex items-end md:items-center justify-center p-0 md:p-6"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      <div
        className="bg-background w-full max-w-2xl max-h-[92vh] md:max-h-[88vh] flex flex-col rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ background: "hsl(var(--header-bg))" }}>
          <div className="flex items-center gap-2 text-white min-w-0">
            <Building2 className="w-4 h-4 shrink-0" />
            <span className="text-sm font-bold truncate">매물 상세보기</span>
            {data?.reg_no && (
              <span className="text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-white/20 text-white shrink-0">
                NO.{data.reg_no}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1 -mr-1" aria-label="닫기">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 bg-muted/20">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : !data ? (
            <p className="text-center text-sm text-muted-foreground py-12">매물 정보를 불러올 수 없습니다.</p>
          ) : (
            <>
              {/* 기본 정보 */}
              <Section icon={HomeIcon} title="기본 정보">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Row label="유형" value={(() => {
                    const parts = Array.from(new Set([data.type, data.room_type].filter(Boolean).map((s) => String(s).trim())));
                    // room_type이 type을 포함(또는 동일)하면 type 한 번만
                    const deduped = parts.filter((p, i) => !parts.some((q, j) => j !== i && q !== p && q.includes(p)));
                    return deduped.join(" · ");
                  })()} />
                  <Row label="건물명" value={data.building_name} />
                  <Row label="층" value={data.floor} />
                </div>
              </Section>

              {/* 주소 */}
              <Section icon={MapPin} title="주소">
                <div className="space-y-2">
                  <Row label="전체주소" value={data.address || [data.dong, data.lot_number].filter(Boolean).join(" ")} />
                  <div className="grid grid-cols-3 gap-3">
                    <Row label="동" value={data.dong} />
                    <Row label="지번" value={data.lot_number} />
                    <Row label="호수" value={data.unit_number ? `${data.unit_number}호` : "-"} />
                  </div>
                </div>
              </Section>

              {/* 거래조건 */}
              <Section icon={FileText} title="거래·임대 조건">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Row label="보증/매매" value={data.deposit} />
                  <Row label="월세" value={data.monthly} />
                  <Row label="관리비" value={data.manage_fee} />
                  <Row label="면적" value={data.area} />
                  <Row label="주차" value={data.parking} />
                  <Row label="엘리베이터" value={typeof data.elevator === "boolean" ? (data.elevator ? "있음" : "없음") : data.elevator} />
                  <Row label="입주가능" value={data.available_from} />
                </div>
              </Section>

              {/* 특이사항 (매물등록·수정의 description 우선) */}
              {(data.description || data.note) && (
                <Section icon={NotebookPen} title="특이사항">
                  {data.description && (
                    <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">
                      {replaceOwnerTerm(data.description)}
                    </p>
                  )}
                  {data.note && (
                    <p className="text-xs whitespace-pre-wrap text-muted-foreground leading-relaxed mt-2 pt-2 border-t border-border">
                      {replaceOwnerTerm(data.note)}
                    </p>
                  )}
                </Section>
              )}

              {/* 사진 */}
              {Array.isArray(data.images) && data.images.length > 0 && (
                <Section icon={ImageIcon} title={`사진 (${data.images.length})`}>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {data.images.map((src, i) => (
                      <a key={i} href={src} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-md border border-border bg-muted">
                        <img src={src} alt={`매물 사진 ${i + 1}`} loading="lazy" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                      </a>
                    ))}
                  </div>
                </Section>
              )}

              {/* 메모 */}
              {(data.building_memo || data.room_memo) && (
                <Section icon={NotebookPen} title="내부 메모">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.building_memo && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">건물 메모</span>
                        <p className="text-xs whitespace-pre-wrap text-foreground rounded-md border border-border bg-muted/30 p-2">{data.building_memo}</p>
                      </div>
                    )}
                    {data.room_memo && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">방 메모</span>
                        <p className="text-xs whitespace-pre-wrap text-foreground rounded-md border border-border bg-muted/30 p-2">{data.room_memo}</p>
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {/* 담당자 / 소유주 */}
              <Section icon={User2} title="담당자 / 소유주">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Row label="담당 중개사" value={data.agent_name} />
                  <Row label="소유주 연락처" value={ownerPhone ? (
                    <a href={`tel:${ownerPhone.replace(/[^0-9+]/g, "")}`} className="text-emerald-600 inline-flex items-center gap-1 font-bold">
                      <Phone className="w-3 h-3" />{ownerPhone}
                    </a>
                  ) : "미등록"} />
                </div>
              </Section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-card">
          <button
            onClick={onClose}
            className="w-full h-10 rounded-lg text-sm font-bold text-white"
            style={{ background: "linear-gradient(90deg, #22d3ee 0%, #a855f7 50%, #ec4899 100%)" }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffPropertyDetailModal;
