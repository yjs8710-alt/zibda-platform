import { useState, useEffect, useRef, memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { uploadPropertyImages } from "@/lib/uploadPropertyImages";
import {
  Building2, Pencil, Trash2, Eye, EyeOff, Plus,
  Search, RefreshCw, ChevronDown, ChevronUp,
  ImagePlus, Loader2, X, Save, Phone, MapPin,
  Store, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import PropertyRegisterModal from "@/components/PropertyRegisterModal";
import AdminPropertyFormModal from "@/components/AdminPropertyFormModal";
import btnRegisterNew from "@/assets/btn-register-new.png";
import JibunInlineAddress from "@/components/JibunInlineAddress";

// ─── Types ──────────────────────────────────────────────────────────────────
type DBProperty = {
  id: string;
  title: string;
  building_name?: string;
  address: string;
  dong: string;
  lot_number: string;
  district?: string;
  type: string;
  room_type?: string;
  unit_number?: string;
  area: string;
  floor: string;
  deposit: string;
  monthly: string;
  manage_fee: string;
  parking: string;
  elevator: boolean;
  available_from: string;
  total_floors: string;
  build_year: string;
  description: string;
  building_memo?: string;
  room_memo?: string;
  note?: string;
  vacate_date?: string;
  building_password?: string;
  room_password?: string;
  options: string[];
  images: string[];
  views: number;
  lat: number;
  lng: number;
  is_new: boolean;
  is_hot: boolean;
  status: "active" | "hidden" | "ended";
  registered_date: string;
  checked_date?: string;
  agent_name: string;
  registered_by?: string | null;
  created_at: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const CHEONGJU_SIGUNGU = [
  "청주시 상당구","청주시 서원구","청주시 흥덕구","청주시 청원구",
];
const DONG_MAP: Record<string, string[]> = {
  "청주시 상당구": ["북문로1가","북문로2가","북문로3가","남문로1가","남문로2가","남문로3가","서문동","문화동","수동","영동","석교동","용담동","명암동","산성동","금천동","용암동","용정동","남주동","방서동","영운동","탑동","중앙동","대성동","오동동"],
  "청주시 서원구": ["사직동","사창동","모충동","수곡동","성화동","죽림동","개신동","분평동","산남동"],
  "청주시 흥덕구": ["운천동","신봉동","복대동","가경동","봉명동","송정동","송절동","강서1동","강서2동","강서동","오송읍","옥산면","비하동","서운동","사운동","신전동"],
  "청주시 청원구": ["우암동","내덕동","율량동","사천동","오근장동","주성동","주중동","정상동","외남동","외평동","외하동","정하동","내수읍","북이면","오창읍","율봉동"],
};
const ROOM_OPTIONS = [
  "냉장고","세탁기","드럼세탁기","건조기","스타일러","TV",
  "에어컨","가스레인지","인덕션","전자레인지","침대","책상",
  "옷장","전자키","복층","옥탑","테라스","주차",
];
const ALL_TYPES = [
  "원룸","투베이","투룸","쓰리룸","주인세대","아파트","오피스텔","빌라","고시원",
  "상가","식당·카페","사무실","공장·창고","병원·학원","지식산업","토지","건물매매",
  "상가임대","기타임대","단독매매","상가주택매매","상가건물매매","구분상가매매","창고/공장매매","다가구매매","다중매매","지식산업매매",
];
const FLOOR_OPTIONS = ["지하5층","지하4층","지하3층","지하2층","지하1층","0층","1층","2층","3층","4층","5층","6층","7층","8층","9층","10층","10층이상"];
const EMPTY_PROPERTY: Omit<DBProperty, "id" | "created_at"> = {
  title:"", building_name:"", address:"", dong:"", lot_number:"", district:"", type:"원룸",
  room_type:"", unit_number:"", area:"", floor:"", deposit:"", monthly:"",
  manage_fee:"", parking:"", elevator:false, available_from:"", total_floors:"",
  build_year:"", description:"", building_memo:"", room_memo:"", note:"",
  vacate_date:"", building_password:"", room_password:"", options:[], images:[],
  views:0, lat:0, lng:0, is_new:false, is_hot:false, status:"active",
  registered_date: new Date().toISOString().slice(0,10), checked_date:"", agent_name:"",
};

// ─── Edit Modal ───────────────────────────────────────────────────────────────
const EditModal = ({
  initial,
  onClose,
  onSave,
}: {
  initial: DBProperty;
  onClose: () => void;
  onSave: (data: Omit<DBProperty, "id" | "created_at">) => Promise<void>;
}) => {
  const [form, setForm] = useState<Omit<DBProperty, "id" | "created_at">>({ ...EMPTY_PROPERTY, ...initial });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const [sigungu, setSigungu] = useState(form.district ? `청주시 ${form.district}` : "");
  const [dong, setDong] = useState(form.dong ?? "");
  const dongList = DONG_MAP[sigungu] ?? [];

  const updateAddress = (sg: string, d: string, lot: string) => {
    const parts = ["충북", sg, d, lot].filter(Boolean);
    set("address", parts.join(" "));
    if (sg.includes("청주시 ")) set("district", sg.replace("청주시 ", ""));
    set("dong", d);
    set("lot_number", lot);
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newUrls = await uploadPropertyImages(files, "properties/");
      if (newUrls.length > 0) setForm(f => ({ ...f, images: [...(f.images ?? []), ...newUrls] }));
    } finally {
      setUploading(false);
    }
  };

  const toggleOption = (opt: string) =>
    setForm(f => ({ ...f, options: f.options.includes(opt) ? f.options.filter(o => o !== opt) : [...f.options, opt] }));

  const handleSave = async () => {
    if (!form.type) { alert("유형을 선택해주세요."); return; }
    if (!form.address.trim()) { alert("주소를 입력해주세요."); return; }
    setSaving(true);
    try { await onSave(form); } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const ic = "w-full px-3 py-2 text-sm rounded-lg border border-border outline-none transition-all bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" /> 매물 수정
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 pb-24 md:pb-5">
          {/* 기본 정보 */}
          <section>
            <h3 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">기본 정보</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">제목 *</label>
                <input className={ic} value={form.title} onChange={e => set("title", e.target.value)} placeholder="매물 제목" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">유형 *</label>
                <select className={ic} value={form.type} onChange={e => set("type", e.target.value)}>
                  {ALL_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">건물명</label>
                <input className={ic} value={form.building_name ?? ""} onChange={e => set("building_name", e.target.value)} placeholder="건물명" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">구</label>
                <select className={ic} value={sigungu} onChange={e => { setSigungu(e.target.value); setDong(""); updateAddress(e.target.value, "", form.lot_number ?? ""); }}>
                  <option value="">구 선택</option>
                  {CHEONGJU_SIGUNGU.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">동</label>
                <select className={ic} value={dong} onChange={e => { setDong(e.target.value); updateAddress(sigungu, e.target.value, form.lot_number ?? ""); }}>
                  <option value="">동 선택</option>
                  {dongList.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">지번</label>
                <input className={ic} value={form.lot_number ?? ""} onChange={e => { set("lot_number", e.target.value); updateAddress(sigungu, dong, e.target.value); }} placeholder="123-4" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">호수</label>
                <input className={ic} value={form.unit_number ?? ""} onChange={e => set("unit_number", e.target.value)} placeholder="101호" />
              </div>
            </div>
          </section>

          {/* 면적/층 */}
          <section>
            <h3 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">면적 및 층</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">면적</label>
                <input className={ic} value={form.area} onChange={e => set("area", e.target.value)} placeholder="33㎡" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">층</label>
                <select className={ic} value={form.floor} onChange={e => set("floor", e.target.value)}>
                  <option value="">선택</option>
                  {FLOOR_OPTIONS.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">총 층수</label>
                <input className={ic} value={form.total_floors} onChange={e => set("total_floors", e.target.value)} placeholder="5층" />
              </div>
            </div>
          </section>

          {/* 가격 */}
          <section>
            <h3 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">가격 정보</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">보증금</label>
                <input className={ic} value={form.deposit} onChange={e => set("deposit", e.target.value)} placeholder="1000만원" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">월세</label>
                <input className={ic} value={form.monthly} onChange={e => set("monthly", e.target.value)} placeholder="50만원" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">관리비</label>
                <input className={ic} value={form.manage_fee} onChange={e => set("manage_fee", e.target.value)} placeholder="5만원" />
              </div>
            </div>
          </section>

          {/* 상세 */}
          <section>
            <h3 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">상세 정보</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">주차</label>
                <input className={ic} value={form.parking} onChange={e => set("parking", e.target.value)} placeholder="1대" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">준공연도</label>
                <input className={ic} value={form.build_year} onChange={e => set("build_year", e.target.value)} placeholder="2020년" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">입주 가능일</label>
                <input className={ic} value={form.available_from} onChange={e => set("available_from", e.target.value)} placeholder="즉시" />
              </div>
              <div className="flex items-center gap-3 pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.elevator} onChange={e => set("elevator", e.target.checked)} className="w-4 h-4 rounded accent-primary" />
                  <span className="text-sm text-foreground">엘리베이터</span>
                </label>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">설명</label>
                <textarea className={`${ic} resize-none`} rows={3} value={form.description} onChange={e => set("description", e.target.value)} placeholder="매물 설명" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">건물 메모</label>
                <textarea className={`${ic} resize-none`} rows={2} value={form.building_memo ?? ""} onChange={e => set("building_memo", e.target.value)} placeholder="건물 특이사항" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">방 메모</label>
                <textarea className={`${ic} resize-none`} rows={2} value={form.room_memo ?? ""} onChange={e => set("room_memo", e.target.value)} placeholder="방 특이사항" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">건물 비밀번호</label>
                <input className={ic} value={form.building_password ?? ""} onChange={e => set("building_password", e.target.value)} placeholder="1234#" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">방 비밀번호</label>
                <input className={ic} value={form.room_password ?? ""} onChange={e => set("room_password", e.target.value)} placeholder="5678*" />
              </div>
            </div>
          </section>

          {/* 옵션 */}
          <section>
            <h3 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">옵션</h3>
            <div className="flex flex-wrap gap-2">
              {ROOM_OPTIONS.map(opt => (
                <button key={opt} type="button" onClick={() => toggleOption(opt)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                  style={form.options.includes(opt)
                    ? { background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", borderColor: "hsl(var(--primary))" }
                    : { background: "transparent", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }
                  }>
                  {opt}
                </button>
              ))}
            </div>
          </section>

          {/* 이미지 */}
          <section>
            <h3 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">사진</h3>
            <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={e => handleImageUpload(e.target.files)} />
            <div className="flex flex-wrap gap-2">
              {(form.images ?? []).map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setForm(f => ({ ...f, images: f.images.filter(u => u !== url) }))}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                disabled={uploading}>
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ImagePlus className="w-5 h-5" /><span className="text-[10px]">추가</span></>}
              </button>
            </div>
          </section>

          {/* 상태 */}
          <section>
            <h3 className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">노출 상태</h3>
            <div className="flex gap-3">
              {(["active", "ended"] as const).map(s => (
                <button key={s} type="button" onClick={() => set("status", s)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all"
                  style={form.status === s
                    ? { background: s === "active" ? "hsl(var(--chart-2) / 0.15)" : "hsl(var(--destructive) / 0.15)", borderColor: s === "active" ? "hsl(var(--chart-2))" : "hsl(var(--destructive))", color: s === "active" ? "hsl(var(--chart-2))" : "hsl(var(--destructive))" }
                    : { background: "transparent", borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                  }>
                  {s === "active" ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {s === "active" ? "광고중" : "종료"}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted/40 transition-colors">취소</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-lg transition-all disabled:opacity-60"
            style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
const DeleteConfirmModal = ({ title, onConfirm, onCancel, isAdmin }: { title: string; onConfirm: () => void; onCancel: () => void; isAdmin?: boolean }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
    <div className="w-full max-w-sm rounded-2xl shadow-2xl p-6 flex flex-col gap-4" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: isAdmin ? "hsl(var(--destructive) / 0.12)" : "hsl(var(--warning) / 0.12)" }}>
          {isAdmin ? <Trash2 className="w-5 h-5" style={{ color: "hsl(var(--destructive))" }} /> : <EyeOff className="w-5 h-5" style={{ color: "hsl(var(--warning, 40 90% 50%))" }} />}
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">{isAdmin ? "매물 삭제" : "매물 종료"}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{isAdmin ? "이 작업은 되돌릴 수 없습니다." : "종료된 매물은 목록에서 숨겨집니다."}</p>
        </div>
      </div>
      <p className="text-sm text-foreground">
        <span className="font-semibold">"{title}"</span> 매물을 {isAdmin ? "삭제" : "종료"}하시겠습니까?
      </p>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted/40 transition-colors">취소</button>
        <button onClick={onConfirm} className="flex-1 py-2 text-sm font-bold rounded-lg transition-colors"
          style={{ background: isAdmin ? "hsl(var(--destructive))" : "hsl(var(--primary))", color: "white" }}>{isAdmin ? "삭제" : "종료"}</button>
      </div>
    </div>
  </div>
);

// ─── Property Row ─────────────────────────────────────────────────────────────
const PropertyRow = memo(({
  prop,
  onEdit,
  onDelete,
  onToggleStatus,
  isAdmin,
  registrantInfo,
  matchedBy,
}: {
  prop: DBProperty;
  onEdit: (p: DBProperty) => void;
  onDelete: (p: DBProperty) => void;
  onToggleStatus: (p: DBProperty) => void;
  isAdmin?: boolean;
  registrantInfo?: { name: string; agency_name?: string } | null;
  matchedBy?: "registered_by" | "agent_name" | null;
}) => {
  const [expanded, setExpanded] = useState(false);

  // 관리자 뷰에서 등록자 표시: registrantInfo(프로필 기반) > agent_name 순으로
  const displayRegistrant = registrantInfo?.name || prop.agent_name || null;
  const isStrictMatch = matchedBy === "registered_by";
  const isFallbackMatch = matchedBy === "agent_name";
  const isUnknown = isAdmin && !displayRegistrant;

  return (
    <div className="border border-border rounded-xl overflow-hidden" style={{ background: "hsl(var(--card))" }}>
      {/* 관리자 전용: 등록자 정보 바 */}
      {isAdmin && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border/60 text-xs"
          style={{
            background: isUnknown
              ? "hsl(var(--muted) / 0.5)"
              : isStrictMatch
                ? "hsl(var(--primary) / 0.08)"
                : "hsl(var(--accent) / 0.06)",
          }}
        >
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {registrantInfo?.agency_name ? (
              <span
                className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md"
                style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}
              >
                <Store className="w-3.5 h-3.5" /> {registrantInfo.agency_name}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-muted-foreground"
                style={{ background: "hsl(var(--muted))" }}>
                <Store className="w-3.5 h-3.5" /> 사무소 미상
              </span>
            )}
            <span className="text-muted-foreground">|</span>
            {displayRegistrant ? (
              <span
                className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md"
                style={{
                  background: isStrictMatch ? "hsl(var(--primary) / 0.15)" : "hsl(var(--accent) / 0.15)",
                  color: isStrictMatch ? "hsl(var(--primary))" : "hsl(var(--accent))",
                }}
                title={isStrictMatch ? "계정(registered_by) 기준 매칭" : "이름(agent_name) 기준 매칭"}
              >
                👤 {displayRegistrant}
                {isFallbackMatch && (
                  <span className="text-[9px] font-normal opacity-70">(이름매칭)</span>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md"
                style={{ background: "hsl(var(--destructive) / 0.12)", color: "hsl(var(--destructive))" }}>
                ⚠ 등록자 미상
                {prop.agent_name && (
                  <span className="text-[9px] font-normal opacity-80">(원본: {prop.agent_name})</span>
                )}
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-muted-foreground flex-shrink-0 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5" />
            {prop.checked_date ? `${prop.checked_date} 확인` : `${prop.registered_date} 등록`}
          </span>
        </div>
      )}

      {/* 요약 행 */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpanded(e => !e)}>
        {/* 상태 dot */}
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: prop.status === "active" ? "hsl(var(--chart-2))" : "hsl(var(--destructive))" }} />

        {/* 썸네일 */}
        <div className="relative flex-shrink-0">
          {prop.images?.[0] ? (
            <img src={prop.images[0]} alt="" loading="lazy" decoding="async" className="w-12 h-10 rounded-lg object-cover border border-border" />
          ) : (
            <div className="w-12 h-10 rounded-lg border border-border flex items-center justify-center" style={{ background: "hsl(var(--muted))" }}>
              <Building2 className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground truncate">{prop.building_name?.trim() || prop.title}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: "hsl(var(--accent) / 0.12)", color: "hsl(var(--accent))" }}>
              {prop.type}
            </span>
            {prop.status !== "active" && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{ background: "hsl(var(--destructive) / 0.15)", color: "hsl(var(--destructive))" }}>
                종료
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <JibunInlineAddress
              address={prop.address}
              dong={prop.dong}
              lotNumber={prop.lot_number}
              district={prop.district}
              className="truncate"
            />
            {prop.unit_number && <span className="flex-shrink-0">· {prop.unit_number}</span>}
          </div>
          {/* 등록자 정보는 카드 상단 정보 바에서 노출 */}
        </div>

        <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0 text-xs text-right w-[140px] tabular-nums">
          <span className="font-semibold text-foreground truncate w-full">{prop.deposit}/{prop.monthly || "—"}</span>
          <span className="text-muted-foreground truncate w-full">
            {prop.manage_fee && prop.manage_fee !== "0" && prop.manage_fee !== "-" ? `관${prop.manage_fee} · ` : ""}
            {prop.area}
          </span>
        </div>

        <div className="hidden sm:grid grid-cols-[52px_44px_44px_20px] items-center gap-1 flex-shrink-0 ml-1 text-center">
          <button onClick={e => { e.stopPropagation(); onToggleStatus(prop); }}
            className="w-full px-1 py-1 rounded-lg transition-colors hover:bg-muted/60 text-[10px] font-bold whitespace-nowrap"
            title={prop.status === "active" ? "종료 처리" : "재등록"}
            style={{ color: prop.status === "active" ? "hsl(var(--destructive))" : "hsl(var(--chart-2))" }}>
            {prop.status === "active" ? "종료" : "재등록"}
          </button>
          <button onClick={e => { e.stopPropagation(); onEdit(prop); }}
            className="w-full px-1 py-1 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground text-[10px] font-bold whitespace-nowrap">
            수정
          </button>
          {prop.status === "active" ? (
            <button onClick={e => { e.stopPropagation(); onDelete(prop); }}
              className="w-full px-1 py-1 rounded-lg hover:bg-red-50 transition-colors text-[10px] font-bold whitespace-nowrap"
              style={{ color: isAdmin ? "hsl(var(--destructive))" : "hsl(var(--warning, 40 90% 50%))" }}
              title={isAdmin ? "삭제" : "종료"}>
              {isAdmin ? "삭제" : "종료"}
            </button>
          ) : isAdmin ? (
            <button onClick={e => { e.stopPropagation(); onDelete(prop); }}
              className="w-full px-1 py-1 rounded-lg hover:bg-red-50 transition-colors text-[10px] font-bold whitespace-nowrap"
              style={{ color: "hsl(var(--destructive))" }}
              title="삭제">
              삭제
            </button>
          ) : <span />}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground mx-auto" /> : <ChevronDown className="w-4 h-4 text-muted-foreground mx-auto" />}
        </div>
        {/* 모바일: 액션 버튼 */}
        <div className="flex sm:hidden items-center gap-1 flex-shrink-0 ml-1">
          <button onClick={e => { e.stopPropagation(); onToggleStatus(prop); }}
            className="px-1.5 py-1 rounded-lg transition-colors hover:bg-muted/60 text-[10px] font-bold whitespace-nowrap"
            title={prop.status === "active" ? "종료 처리" : "재등록"}
            style={{ color: prop.status === "active" ? "hsl(var(--destructive))" : "hsl(var(--chart-2))" }}>
            {prop.status === "active" ? "종료" : "재등록"}
          </button>
          <button onClick={e => { e.stopPropagation(); onEdit(prop); }}
            className="px-1.5 py-1 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground text-[10px] font-bold whitespace-nowrap">
            수정
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>


      </div>

      {/* 상세 확장 */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border/50 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs">
          {[
            ["보증금", prop.deposit], ["월세", prop.monthly], ["관리비", prop.manage_fee],
            ["면적", prop.area], ["층", prop.floor], ["총층수", prop.total_floors],
            ["주차", prop.parking], ["준공연도", prop.build_year], ["엘리베이터", prop.elevator ? "있음" : "없음"],
            ["입주가능일", prop.available_from], ["등록일", prop.registered_date], ["조회수", String(prop.views)],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={k}>
              <span className="text-muted-foreground">{k}: </span>
              <span className="font-medium text-foreground">{v}</span>
            </div>
          ))}
          {prop.building_password && (
            <div><span className="text-muted-foreground">건물PW: </span><span className="font-medium text-foreground">{prop.building_password}</span></div>
          )}
          {prop.room_password && (
            <div><span className="text-muted-foreground">방PW: </span><span className="font-medium text-foreground">{prop.room_password}</span></div>
          )}
          {prop.options?.length > 0 && (
            <div className="col-span-2 sm:col-span-3">
              <span className="text-muted-foreground">옵션: </span>
              <span className="font-medium text-foreground">{prop.options.join(", ")}</span>
            </div>
          )}
          {prop.description && (
            <div className="col-span-2 sm:col-span-3">
              <span className="text-muted-foreground">설명: </span>
              <span className="text-foreground">{prop.description}</span>
            </div>
          )}
          {prop.note && (
            <div className="col-span-2 sm:col-span-3">
              <span className="text-muted-foreground">메모: </span>
              <span className="text-foreground">{prop.note}</span>
            </div>
          )}
          {(prop.images?.length ?? 0) > 0 && (
            <div className="col-span-2 sm:col-span-3 flex gap-2 flex-wrap mt-1">
              {prop.images.map((url, i) => (
                <img key={i} src={url} alt="" loading="lazy" decoding="async" className="w-16 h-14 rounded-lg object-cover border border-border" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
PropertyRow.displayName = "PropertyRow";

// ─── Main Page ────────────────────────────────────────────────────────────────
const MyProperties = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [properties, setProperties] = useState<DBProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "ended">("all");
  const [agentTab, setAgentTab] = useState<string>("전체");
  const [agencyTab, setAgencyTab] = useState<string>("전체");
  const [editTarget, setEditTarget] = useState<DBProperty | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DBProperty | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [reregisterPrefill, setReregisterPrefill] = useState<Record<string, unknown> | null>(null);
  const [visibleCount, setVisibleCount] = useState(30);
  const [agentName, setAgentName] = useState("");
  // 관리자 전용: user_id → {name, email} 맵
  const [registrantMap, setRegistrantMap] = useState<Record<string, { name: string; agency_name?: string }>>({});

  // 프로필 및 매물 로드
  useEffect(() => {
    if (authLoading) return;
    if (!user?.userId) { navigate("/login"); return; }

    const load = async () => {
      setLoading(true);

      // 관리자 여부 확인
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.userId)
        .eq("role", "admin")
        .maybeSingle();

      const isAdmin = !!roleData;

      if (isAdmin) {
        // 관리자: 전체 매물 + agent_profiles 매핑 조회
        setAgentName("관리자");
        const [{ data: props }, { data: profiles }] = await Promise.all([
          supabase.from("properties").select("*").order("registered_date", { ascending: false }),
          supabase.from("agent_profiles").select("user_id, name, agency_name"),
        ]);
        if (props) setProperties(props as DBProperty[]);
        if (profiles) {
          const map: Record<string, { name: string; agency_name?: string }> = {};
          profiles.forEach(p => { map[p.user_id] = { name: p.name, agency_name: p.agency_name }; });

          // registered_by가 없는 매물도 agent_name으로 프로필 매칭
          if (props) {
            const nameToProfile = new Map<string, { name: string; agency_name?: string }>();
            profiles.forEach(p => { nameToProfile.set(p.name, { name: p.name, agency_name: p.agency_name }); });
            props.forEach(p => {
              const row = p as DBProperty;
              if (!row.registered_by && row.agent_name) {
                const matched = nameToProfile.get(row.agent_name);
                if (matched) {
                  // agent_name을 키로 사용하여 fallback 매핑
                  map[`agent_name:${row.agent_name}`] = matched;
                }
              }
            });
          }

          setRegistrantMap(map);
        }
        setLoading(false);
        return;
      }

      // 일반 사용자: 본인 + 부모/형제/하위 에이전트 매물까지 모두 조회
      const { data: myProfile } = await supabase
        .from("agent_profiles")
        .select("name, user_id, parent_user_id")
        .eq("user_id", user.userId)
        .maybeSingle();

      const name = myProfile?.name ?? "";
      setAgentName(name);

      const relatedIds = new Set<string>([user.userId]);
      const relatedNames = new Set<string>();
      if (name) relatedNames.add(name);
      if (myProfile?.parent_user_id) relatedIds.add(myProfile.parent_user_id);

      const rootId = myProfile?.parent_user_id ?? user.userId;
      const { data: family } = await supabase
        .from("agent_profiles")
        .select("user_id, name")
        .or(`user_id.eq.${rootId},parent_user_id.eq.${rootId}`);
      (family ?? []).forEach((f: { user_id: string; name: string }) => {
        if (f.user_id) relatedIds.add(f.user_id);
        if (f.name) relatedNames.add(f.name);
      });

      const idList = Array.from(relatedIds);
      const nameList = Array.from(relatedNames).filter(Boolean);
      const orParts: string[] = [];
      if (idList.length) orParts.push(`registered_by.in.(${idList.join(",")})`);
      if (nameList.length) orParts.push(`agent_name.in.(${nameList.map(n => `"${n}"`).join(",")})`);

      if (orParts.length === 0) { setLoading(false); return; }

      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .or(orParts.join(","))
        .order("registered_date", { ascending: false });

      if (!error && data) setProperties(data as DBProperty[]);
      setLoading(false);
    };

    load();
  }, [user, authLoading, navigate]);

  // Realtime 구독
  useEffect(() => {
    if (!agentName) return;
    const channel = supabase
      .channel("my-properties-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "properties" }, async () => {
        const isAdmin = agentName === "관리자";
        let q = supabase.from("properties").select("*").order("registered_date", { ascending: false });
        if (!isAdmin) q = (q as unknown as { eq: (c: string, v: string) => typeof q }).eq("agent_name", agentName);
        const { data } = await q;
        if (data) setProperties(data as DBProperty[]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [agentName]);

  const handleEdit = async (data: Omit<DBProperty, "id" | "created_at">) => {
    if (!editTarget) return;
    const { error } = await supabase.from("properties").update(data).eq("id", editTarget.id);
    if (error) { alert("수정 오류: " + error.message); return; }
    setProperties(prev => prev.map(p => p.id === editTarget.id ? { ...p, ...data } : p));
    setEditTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const isAdminUser = agentName === "관리자";
    if (isAdminUser) {
      // 관리자: 실제 삭제
      const { error } = await supabase.from("properties").delete().eq("id", deleteTarget.id);
      if (error) { alert("삭제 오류: " + error.message); return; }
      setProperties(prev => prev.filter(p => p.id !== deleteTarget.id));
    } else {
      // 일반회원: 종료 (status → ended)
      const { error } = await supabase.from("properties").update({ status: "ended" }).eq("id", deleteTarget.id);
      if (error) { alert("종료 오류: " + error.message); return; }
      setProperties(prev => prev.map(p => p.id === deleteTarget.id ? { ...p, status: "ended" as const } : p));
    }
    setDeleteTarget(null);
  };

  const handleToggleStatus = async (prop: DBProperty) => {
    const newStatus = prop.status === "active" ? "ended" : "active";
    const { error } = await supabase.from("properties").update({ status: newStatus }).eq("id", prop.id);
    if (error) { alert("상태 변경 오류: " + error.message); return; }
    setProperties(prev => prev.map(p => p.id === prop.id ? { ...p, status: newStatus } : p));
  };

  const isAdminView = agentName === "관리자";

  // 매물의 표시용 등록자 이름: agent_name → registered_by 프로필 → "(이름없음)"
  const getDisplayAgent = (p: DBProperty): string => {
    if (p.agent_name && p.agent_name.trim()) return p.agent_name;
    if (p.registered_by && registrantMap[p.registered_by]) return registrantMap[p.registered_by].name;
    return "(이름없음)";
  };

  // 등록자(개인)별 탭 — 매물 수 많은 순, '봄날부동산'/'관리자'는 항상 최상단
  const agentList = useMemo(() => {
    if (!isAdminView) return [];
    // 담당자 이름으로만 표시: 숫자/하이픈/공백만으로 된 값(전화번호 등) 제외
    const isValidName = (n: string) => !!n && n !== "(이름없음)" && !/^[\d\s\-+()]+$/.test(n);
    const counts = new Map<string, number>();
    properties.forEach(p => {
      const n = getDisplayAgent(p);
      if (!isValidName(n)) return;
      counts.set(n, (counts.get(n) ?? 0) + 1);
    });
    const PRIORITY = ["봄날부동산", "관리자"];
    const names = Array.from(counts.keys());
    const priority = PRIORITY.filter(n => counts.has(n));
    const rest = names
      .filter(n => !PRIORITY.includes(n))
      .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b, "ko"));
    return ["전체", ...priority, ...rest];
  }, [properties, isAdminView, registrantMap]);

  const filtered = useMemo(() => {
    const list = properties.filter(p => {
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      const matchSearch = !search || p.title.includes(search) || p.address.includes(search) || p.type.includes(search);
      const matchAgent = !isAdminView || agentTab === "전체" || getDisplayAgent(p) === agentTab;
      return matchStatus && matchSearch && matchAgent;
    });
    // '전체' 탭: 담당자별로 묶어서 정렬 (담당자 우선순위 → 그 안에서 등록일 내림차순)
    if (isAdminView && agentTab === "전체") {
      const order = new Map(agentList.map((n, i) => [n, i] as const));
      list.sort((a, b) => {
        const oa = order.get(getDisplayAgent(a)) ?? 9999;
        const ob = order.get(getDisplayAgent(b)) ?? 9999;
        if (oa !== ob) return oa - ob;
        const da = a.registered_date ?? "";
        const db = b.registered_date ?? "";
        return da > db ? -1 : da < db ? 1 : 0;
      });
    }
    return list;
  }, [properties, statusFilter, search, isAdminView, agentTab, registrantMap, agentList]);

  useEffect(() => { setVisibleCount(30); }, [statusFilter, search, agentTab]);
  const visibleList = filtered.slice(0, visibleCount);

  const activeCount = properties.filter(p => p.status === "active").length;
  const endedCount = properties.filter(p => p.status === "ended" || p.status === "hidden").length;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "hsl(var(--background))" }}>
      <Header onRegisterChange={setShowRegister} />
      {showRegister && (
        <PropertyRegisterModal
          onClose={() => { setShowRegister(false); setReregisterPrefill(null); }}
          prefill={reregisterPrefill ?? undefined}
        />
      )}
      {editTarget && (
        <AdminPropertyFormModal
          initial={editTarget as unknown as Record<string, unknown>}
          onClose={() => setEditTarget(null)}
          onSaved={async () => {
            // 저장 후 매물 새로고침
            const isAdmin = agentName === "관리자";
            let q = supabase.from("properties").select("*").order("registered_date", { ascending: false });
            if (!isAdmin && user?.userId) {
              q = (q as unknown as { or: (s: string) => typeof q }).or(`registered_by.eq.${user.userId}${agentName ? `,agent_name.eq.${agentName}` : ""}`);
            }
            const { data } = await q;
            if (data) setProperties(data as DBProperty[]);
            setEditTarget(null);
          }}
        />
      )}
      {deleteTarget && <DeleteConfirmModal title={deleteTarget.title} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} isAdmin={isAdminView} />}

      <div className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 pb-56 md:pb-12">
        {/* 헤더 */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {agentName === "관리자" ? "전체 매물 관리" : "내 매물 관리"}
            </h1>
            {agentName && (
              <p className="text-sm text-muted-foreground mt-1">
                {agentName === "관리자"
                  ? "모든 담당자의 매물을 조회·관리합니다"
                  : <><span className="font-semibold text-foreground">{agentName}</span> 담당 매물 관리</>
                }
              </p>
            )}
          </div>
          <button
            onClick={() => setShowRegister(true)}
            className="flex items-center transition-transform hover:scale-[1.02] active:scale-95"
            aria-label="매물 등록"
          >
            <img src={btnRegisterNew} alt="매물 등록" className="h-10 w-auto object-contain" />
          </button>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "전체 매물", value: properties.length, color: "hsl(var(--primary))" },
            { label: "광고중", value: activeCount, color: "hsl(var(--chart-2))" },
            { label: "종료", value: endedCount, color: "hsl(var(--destructive))" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-border p-4 text-center" style={{ background: "hsl(var(--card))" }}>
              <p className="text-2xl font-extrabold" style={{ color }}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* 관리자 전용: 개인별 필터 */}
        {isAdminView && agentList.length > 1 && (
          <div className="mb-4">
            <p className="text-[10px] font-bold text-muted-foreground mb-1.5 px-1">👤 회원별</p>
            <div className="grid gap-1.5 grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {agentList.map(agent => {
                const count = agent === "전체"
                  ? properties.length
                  : properties.filter(p => getDisplayAgent(p) === agent).length;
                const isActive = agentTab === agent;
                return (
                  <button
                    key={agent}
                    onClick={() => setAgentTab(agent)}
                    title={agent}
                    className="flex items-center justify-between gap-1 px-2 h-8 rounded-lg text-[11px] font-semibold border transition-all whitespace-nowrap overflow-hidden"
                    style={isActive
                      ? { background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", borderColor: "hsl(var(--primary))" }
                      : { background: "hsl(var(--card))", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }
                    }
                  >
                    <span className="truncate">
                      {agent === "전체" ? "👥" : "👤"} {agent}
                    </span>
                    <span
                      className="text-[10px] font-bold px-1 py-0.5 rounded-full min-w-[20px] text-center flex-shrink-0"
                      style={isActive
                        ? { background: "rgba(255,255,255,0.25)", color: "inherit" }
                        : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
                      }
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 검색 & 필터 */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9 h-9 text-sm" placeholder="제목, 주소, 유형 검색" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1.5">
            {(["all", "active", "ended"] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                style={statusFilter === s
                  ? { background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", borderColor: "hsl(var(--primary))" }
                  : { background: "transparent", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }
                }>
                {s === "all" ? "전체" : s === "active" ? "광고중" : "종료"}
              </button>
            ))}
          </div>
          <button onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 300); }}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted/40 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* 매물 목록 */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">불러오는 중...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Building2 className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {properties.length === 0 ? "등록된 매물이 없습니다." : "검색 결과가 없습니다."}
            </p>
            {properties.length === 0 && (
              <Button onClick={() => setShowRegister(true)} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-1" /> 첫 매물 등록하기
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {visibleList.map(prop => (
              <PropertyRow
                key={prop.id}
                prop={prop}
                onEdit={setEditTarget}
                onDelete={setDeleteTarget}
                onToggleStatus={handleToggleStatus}
                
                isAdmin={agentName === "관리자"}
                registrantInfo={agentName === "관리자" ? (
                  prop.registered_by
                    ? registrantMap[prop.registered_by] ?? (prop.agent_name ? registrantMap[`agent_name:${prop.agent_name}`] ?? null : null)
                    : (prop.agent_name ? registrantMap[`agent_name:${prop.agent_name}`] ?? null : null)
                ) : null}
                matchedBy={agentName === "관리자" ? (
                  prop.registered_by && registrantMap[prop.registered_by]
                    ? "registered_by"
                    : prop.agent_name && registrantMap[`agent_name:${prop.agent_name}`]
                      ? "agent_name"
                      : null
                ) : null}
              />
            ))}
            {visibleCount < filtered.length && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => setVisibleCount(c => c + 30)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:bg-muted/40 transition-colors"
                >
                  더보기 ({filtered.length - visibleCount}개 남음)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyProperties;
