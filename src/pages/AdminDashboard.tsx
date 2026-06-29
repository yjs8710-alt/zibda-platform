import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { formatPhone, formatLicenseNumber } from "@/lib/utils";
import { customConfirm, customAlert } from "@/lib/customDialogs";
import AdminPropertyFormModal from "@/components/AdminPropertyFormModal";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  LayoutDashboard, Users, Building2, MessageSquare,
  LogOut, Home, CheckCircle2, XCircle, Clock,
  Eye, Trash2, Pin, ShieldCheck, TrendingUp,
  ChevronDown, ChevronUp, Search, RefreshCw, AlertCircle,
  Plus, Pencil, EyeOff, Phone, MapPin, X, Save, Copy,
  ImagePlus, Loader2, ShieldAlert, UserMinus, UserCheck, Ban, Unlock,
  KeyRound, EyeOff as EyeOffIcon, Eye as EyeIcon, Menu,
  Gem, BadgeCheck, UserCog, Monitor, Smartphone, Globe, MessageCircle,
} from "lucide-react";
import logoImg from "@/assets/logo-zibda-active-20260427-v3.png";
import JibunAddressBadge from "@/components/JibunAddressBadge";
import JibunInlineAddress from "@/components/JibunInlineAddress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAP_PROPERTIES } from "@/data/mapProperties";
import { supabase } from "@/integrations/supabase/client";
import { useHiddenMockIds } from "@/hooks/useHiddenMockIds";
import AdminChatPanel from "@/components/AdminChatPanel";
import AdminGuestInquiriesPanel from "@/components/AdminGuestInquiriesPanel";
import VisitorStatsWidget from "@/components/VisitorStatsWidget";

// ─── Types ───────────────────────────────────────────────────────────────────
type MemberType = "대표중개사" | "소속중개사" | "중개보조원" | "일반회원";

type AgentProfile = {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  agency_name: string;
  agency_phone?: string;
  representative_name?: string;
  license_number: string;
  business_number: string;
  agency_address: string;
  agree_marketing: boolean;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  email?: string;
  last_sign_in_at?: string | null;
  role?: "admin" | "user";        // user_roles에서 조회
  member_type?: MemberType;       // 대표중개사 / 소속중개사 / 중개보조원 / 일반회원
  parent_user_id?: string | null; // 대표중개사 user_id
  is_active?: boolean;            // 사이트 접속 가능 여부
  allowed_pc_ip?: string | null;  // PC 접속 허용 IP (1개, 비어있으면 제한 없음)
  tempPassword?: string;          // 관리자가 설정한 임시 비번 (로컬 상태)
};

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
  images: string[];   // ← 추가
  views: number;
  lat: number;
  lng: number;
  is_new: boolean;
  is_hot: boolean;
  status: "active" | "hidden" | "ended";
  registered_date: string;
  checked_date?: string;
  agent_name: string;
  created_at: string;
};

type CheongJuContact = {
  id: string;
  district: string;
  dong: string;
  lot_number?: string;
  building_name?: string | null; // 건물명 (예: OO빌딩)
  building_dong?: string | null; // 집합건물 동(棟) 번호
  unit_number?: string | null;
  phone: string;
  contact_owner?: string;
  contact_manager?: string;
  contact_broker?: string;
  memo?: string;
  is_visible?: boolean;
};

const normalizePhoneNumber = (value: string | null | undefined) => (value ?? "").replace(/[^0-9]/g, "");

const getUniquePhones = (...values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const phones: string[] = [];

  values.forEach((value) => {
    const raw = value ?? "";
    const matches = raw.match(/0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}/g) ?? raw.split(/[,/;|\n]+/);
    matches.forEach((candidate) => {
      const normalized = normalizePhoneNumber(candidate);
      if (normalized.length < 7 || seen.has(normalized)) return;
      seen.add(normalized);
      phones.push(formatPhone(normalized));
    });
  });

  return phones;
};

const normalizeContactSearchText = (value: string | null | undefined) =>
  (value ?? "").toLowerCase().replace(/\s+/g, "").replace(/번지|호/g, "");

const contactMatchesSearch = (contact: CheongJuContact, query: string) => {
  const tokens = query.replace(/번지/g, " ").split(/\s+/).map(normalizeContactSearchText).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = normalizeContactSearchText([
    contact.district,
    contact.dong,
    contact.lot_number,
    contact.building_dong,
    contact.unit_number,
    contact.building_name,
    contact.phone,
    contact.contact_owner,
    contact.contact_manager,
    contact.contact_broker,
    contact.memo,
  ].filter(Boolean).join(" "));
  return tokens.every((token) => haystack.includes(token));
};

type PropertyReport = {
  id: string;
  property_id: string;
  property_title: string;
  property_address: string;
  report_type: "error_report" | "deal_complete" | "rental_proposal";
  status: "pending" | "reviewed" | "resolved" | "rejected";
  error_content?: string;
  deal_date?: string;
  deal_memo?: string;
  proposer_name?: string;
  proposer_phone?: string;
  proposer_company?: string;
  proposal_deposit?: string;
  proposal_monthly?: string;
  proposal_period?: string;
  proposal_content?: string;
  admin_memo?: string;
  submitted_by?: string | null;
  created_at: string;
  building_name?: string;
};

const EMPTY_PROPERTY: Omit<DBProperty, "id" | "created_at"> = {
  title: "", building_name: "", address: "", dong: "", lot_number: "", district: "", type: "원룸",
  room_type: "", unit_number: "", area: "", floor: "", deposit: "", monthly: "",
  manage_fee: "", parking: "", elevator: false, available_from: "", total_floors: "",
  build_year: "", description: "", building_memo: "", room_memo: "", note: "",
  vacate_date: "", building_password: "", room_password: "", options: [], images: [],
  views: 0, lat: 0, lng: 0, is_new: false, is_hot: false, status: "active",
  registered_date: new Date().toISOString().slice(0, 10), checked_date: "",
  agent_name: "",
};

const MOCK_POSTS = [
  { id: 1, category: "notice", categoryLabel: "공지사항", title: "집다 플랫폼 서비스 오픈 안내", author: "관리자", date: "2026-03-01", views: 1240, reported: false, pinned: true },
  { id: 2, category: "info", categoryLabel: "정보공유", title: "2025년 상가 임대 시장 동향 분석", author: "김중개사", date: "2026-02-28", views: 532, reported: false, pinned: false },
  { id: 3, category: "qna", categoryLabel: "Q&A", title: "공동중개 수수료 정산 기준이 궁금합니다", author: "이공인", date: "2026-02-27", views: 311, reported: true, pinned: false },
  { id: 4, category: "free", categoryLabel: "자유게시판", title: "처음 가입했습니다. 잘 부탁드립니다!", author: "박부동산", date: "2026-02-26", views: 198, reported: false, pinned: false },
  { id: 5, category: "info", categoryLabel: "정보공유", title: "LH 전세대출 조건 변경 내용 정리", author: "최공인", date: "2026-02-24", views: 688, reported: false, pinned: false },
  { id: 6, category: "free", categoryLabel: "자유게시판", title: "허위 매물 신고합니다", author: "정중개", date: "2026-02-23", views: 421, reported: true, pinned: false },
];

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: "대기중", color: "hsl(var(--chart-4))", bg: "hsl(var(--chart-4) / 0.12)" },
  approved: { label: "승인됨", color: "hsl(0 0% 0%)", bg: "hsl(0 0% 0% / 0.12)" },
  rejected: { label: "거절됨", color: "hsl(var(--destructive))", bg: "hsl(var(--destructive) / 0.10)" },
};

const NAV = [
  { key: "dashboard",  label: "대시보드",    icon: LayoutDashboard },
  { key: "members",    label: "회원 관리",    icon: Users },
  { key: "properties", label: "매물 관리",    icon: Building2 },
  { key: "contacts",   label: "청주 연락처",  icon: Phone },
  { key: "reports",    label: "신고/제안",    icon: AlertCircle },
  { key: "inquiries",  label: "게스트 문의",  icon: MessageCircle },
  { key: "community",  label: "커뮤니티 관리", icon: MessageSquare },
  { key: "chat",       label: "채팅 문의",    icon: MessageCircle },
];

const PROPERTY_TYPE_GROUPS: { group: string; types: string[] }[] = [
  {
    group: "주거형",
    types: ["원룸", "투베이", "투룸", "쓰리룸", "주인세대", "아파트", "오피스텔", "빌라", "고시원"],
  },
  {
    group: "상가",
    types: ["상가", "식당·카페", "사무실", "공장·창고", "병원·학원", "지식산업"],
  },
  {
    group: "주거형 외 임대·매매",
    types: ["상가임대", "기타임대", "단독매매", "다가구매매", "다중매매", "상가주택매매", "상가건물매매", "구분상가매매", "창고/공장매매"],
  },
  {
    group: "토지",
    types: ["토지"],
  },
];
const ALL_PROPERTY_TYPES = PROPERTY_TYPE_GROUPS.flatMap((g) => g.types);
const CHEONGJU_DISTRICTS = ["상당구", "서원구", "흥덕구", "청원구"];

// ─── Address Data (청주시 4개 구 고정) ──────────────────────────────────────
const FIXED_SIDO = "충북";
// 청주시 4개 구만 표시 (순서: 상당구 → 서원구 → 흥덕구 → 청원구)
const CHEONGJU_SIGUNGU = [
  "청주시 상당구", "청주시 서원구", "청주시 흥덕구", "청주시 청원구",
];
const DONG_MAP: Record<string, string[]> = {
  "청주시 상당구": [
    "북문로1가","북문로2가","북문로3가",
    "남문로1가","남문로2가","남문로3가",
    "서문동","문화동","수동","영동","석교동",
    "용담동","명암동","산성동","금천동","용암동","용정동",
    "남주동","방서동","영운동","탑동","중앙동","대성동","오동동",
  ],
  "청주시 서원구": [
    "사직동","사창동","모충동","수곡동",
    "성화동","죽림동","개신동","분평동","산남동",
  ],
  "청주시 흥덕구": [
    "운천동","신봉동","복대동","가경동",
    "봉명동","송정동","송절동","강서1동","강서2동","강서동",
    "오송읍","옥산면","비하동","서운동","사운동","신전동",
  ],
  "청주시 청원구": [
    "우암동","내덕동","율량동","사천동","오근장동",
    "주성동","주중동","정상동","외남동","외평동","외하동","정하동",
    "내수읍","북이면","오창읍","율봉동",
  ],
};
// 매물관리 동 선택 표시용 (4개 구 표기명)
const DISTRICT_FILTER_TABS = ["전체", "상당구", "서원구", "흥덕구", "청원구"] as const;
const FLOOR_OPTIONS_ADMIN = [
  "지하5층","지하4층","지하3층","지하2층","지하1층","0층",
  "1층","2층","3층","4층","5층","6층","7층","8층","9층","10층","10층이상",
];
const DIRECTION_OPTIONS_ADMIN = ["동","서","남","북","동남","남서","북동","북서"];
const ROOM_OPTIONS_ADMIN = [
  "냉장고","세탁기","드럼세탁기","건조기","스타일러","TV",
  "에어컨","가스레인지","인덕션","전자레인지","침대","책상",
  "옷장","전자키","복층","옥탑","테라스","주차",
];

// ─── PropertyFormModal ───────────────────────────────────────────────────────
const PropertyFormModal = ({
  initial,
  onClose,
  onSave,
}: {
  initial: Partial<DBProperty> | null;
  onClose: () => void;
  onSave: (data: Omit<DBProperty, "id" | "created_at">) => Promise<void>;
}) => {
  const [form, setForm] = useState<Omit<DBProperty, "id" | "created_at">>({
    ...EMPTY_PROPERTY,
    ...(initial ?? {}),
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2 | 3>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  // 충북 고정 — 청주시 4개 구만 표시
  const [sigungu, setSigungu] = useState(form.district ? `청주시 ${form.district}` : "");
  const [dong, setDong] = useState(form.dong ?? "");
  const sigunguList = CHEONGJU_SIGUNGU;
  const dongList = DONG_MAP[sigungu] ?? [];

  // 주소 자동 조합 (충북 고정)
  const updateAddress = (sg: string, d: string, lot: string) => {
    const parts = [FIXED_SIDO, sg, d, lot].filter(Boolean);
    set("address", parts.join(" "));
    if (sg.includes("청주시 ")) set("district", sg.replace("청주시 ", ""));
    set("dong", d);
    set("lot_number", lot);
  };

  // ── 이미지 업로드 ──────────────────────────────────────────────────────────
  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `properties/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from("property-images")
        .upload(path, file, { upsert: false });
      if (error) { alert("이미지 업로드 실패: " + error.message); continue; }
      const { data: urlData } = supabase.storage
        .from("property-images")
        .getPublicUrl(path);
      if (urlData?.publicUrl) newUrls.push(urlData.publicUrl);
    }
    if (newUrls.length > 0) setForm((f) => ({ ...f, images: [...(f.images ?? []), ...newUrls] }));
    setUploading(false);
  };

  const removeImage = (url: string) => {
    setForm((f) => ({ ...f, images: (f.images ?? []).filter((u) => u !== url) }));
  };

  const toggleOption = (opt: string) => {
    setForm((f) => ({
      ...f,
      options: f.options.includes(opt) ? f.options.filter((o) => o !== opt) : [...f.options, opt],
    }));
  };

  const handleSave = async () => {
    if (!form.type) { alert("유형을 선택해주세요."); return; }
    if (!form.address.trim()) { alert("주소를 입력해주세요."); return; }
    setSaving(true);
    try { await onSave(form); } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const STEP_LABELS_ADMIN = ["기본 설정 및 주소", "옵션 및 조건", "사진 및 기타"];

  const icA = (hasError = false) =>
    `w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all bg-background text-foreground placeholder:text-muted-foreground ${
      hasError ? "border-destructive" : "border-border focus:border-primary focus:ring-1 focus:ring-primary/20"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl"
        style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0"
          style={{ background: "hsl(var(--header-bg))" }}>
          <div>
            <h3 className="text-base font-bold text-white">
              {initial?.id ? "매물 수정" : "매물 등록"}
            </h3>
            {!initial?.id && initial?.address && (
              <p className="text-xs mt-0.5 text-white/60">
                🏢 {initial.building_name || initial.address} · 호수 추가
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-4 pb-2 flex-shrink-0">
          <div className="flex gap-1.5 mb-1.5">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= formStep ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{formStep}/3 {STEP_LABELS_ADMIN[formStep - 1]}</p>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4">

          {/* ── STEP 1 ── */}
          {formStep === 1 && (
            <div className="flex flex-col gap-5">
              {/* 유형 */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-foreground">유형 *</label>
                {PROPERTY_TYPE_GROUPS.map(({ group, types }) => (
                  <div key={group} className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{group}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {types.map((t) => (
                        <button key={t} type="button" onClick={() => set("type", t)}
                          className="px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                          style={form.type === t
                            ? { background: "hsl(var(--primary))", color: "#fff", borderColor: "hsl(var(--primary))" }
                            : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                          }>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* 주소 */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-foreground">주소 입력</label>
                {/* 시/도 고정 배지 */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5">
                  <span className="text-xs text-muted-foreground">시/도</span>
                  <span className="text-sm font-bold text-primary">충청북도 (충북)</span>
                  <span className="ml-auto text-[10px] text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-full">고정</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <AdminSelect value={sigungu} onChange={(v) => { setSigungu(v); setDong(""); updateAddress(v, "", form.lot_number); }} placeholder="시/군/구 선택" options={sigunguList} />
                  <AdminSelect value={dong} onChange={(v) => { setDong(v); updateAddress(sigungu, v, form.lot_number); }} placeholder="동/읍/면 선택" options={dongList} disabled={!sigungu} />
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="번지 입력 (예: 123-4)" value={form.lot_number}
                    onChange={(e) => { set("lot_number", e.target.value); updateAddress(sigungu, dong, e.target.value); }}
                    className={icA() + " flex-1"} />
                  <span className="self-center text-xs text-muted-foreground whitespace-nowrap">번지</span>
                </div>
                <p className="text-[11px] text-muted-foreground/60">도로명주소 불가 / 번지주소만 가능</p>
                {form.address && (
                  <p className="text-xs text-primary font-medium bg-primary/8 px-3 py-1.5 rounded-lg">📍 {form.address}</p>
                )}
              </div>

              {/* 건물명 / 매물명 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">건물이름</label>
                  <input type="text" placeholder="건물명 (선택)" value={form.building_name ?? ""}
                    onChange={(e) => set("building_name", e.target.value)} className={icA()} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">매물명 *</label>
                  <input type="text" placeholder="예) 흥덕구 원룸" value={form.title}
                    onChange={(e) => set("title", e.target.value)} className={icA()} />
                </div>
              </div>

              {/* 층수 / 호수 / 평수 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">층수</label>
                  <AdminSelect value={form.floor} onChange={(v) => set("floor", v)} placeholder="선택" options={FLOOR_OPTIONS_ADMIN} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">호수</label>
                  <input type="text" placeholder="직접입력" value={form.unit_number ?? ""}
                    onChange={(e) => set("unit_number", e.target.value)} className={icA()} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">면적</label>
                  <input type="text" placeholder="예) 59.94㎡ 또는 18평" value={form.area}
                    onChange={(e) => set("area", e.target.value)} className={icA()} />
                  {form.area && !form.area.includes("평") && (() => { const n = parseFloat(form.area.replace(/[^0-9.]/g, "")); return !isNaN(n) && n > 0 ? <p className="text-[10px] text-primary/70">→ 약 {(n / 3.3058).toFixed(1)}평</p> : null; })()}
                </div>
              </div>

              {/* 전체층수 / 건축연도 / 중개사 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">전체 층수</label>
                  <input type="text" placeholder="예) 5층" value={form.total_floors}
                    onChange={(e) => set("total_floors", e.target.value)} className={icA()} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">건축연도</label>
                  <input type="text" placeholder="예) 2010" value={form.build_year}
                    onChange={(e) => set("build_year", e.target.value)} className={icA()} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">중개사</label>
                  <input type="text" placeholder="담당자명" value={form.agent_name}
                    onChange={(e) => set("agent_name", e.target.value)} className={icA()} />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {formStep === 2 && (
            <div className="flex flex-col gap-5">
              {/* 요약 칩 */}
              <div className="flex gap-1.5 flex-wrap">
                {[form.type, form.address].filter(Boolean).map((v) => (
                  <span key={v} className="text-xs bg-primary/10 text-primary font-semibold px-2.5 py-1 rounded-full truncate max-w-[200px]">{v}</span>
                ))}
              </div>

              {/* 방 옵션 */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-foreground">방 옵션</label>
                <div className="flex flex-wrap gap-2">
                  {ROOM_OPTIONS_ADMIN.map((opt) => (
                    <button key={opt} type="button" onClick={() => toggleOption(opt)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        form.options.includes(opt)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-border hover:border-primary/50"
                      }`}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* 방 비번 / 건물 비번 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">방 비번</label>
                  <input type="text" placeholder="방 비밀번호" value={form.room_password ?? ""}
                    onChange={(e) => set("room_password", e.target.value)} className={icA()} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">건물 비번</label>
                  <input type="text" placeholder="건물 비밀번호" value={form.building_password ?? ""}
                    onChange={(e) => set("building_password", e.target.value)} className={icA()} />
                </div>
              </div>

              {/* 방향 */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-foreground">방향</label>
                <div className="flex flex-wrap gap-2">
                  {DIRECTION_OPTIONS_ADMIN.map((d) => (
                    <button key={d} type="button"
                      onClick={() => set("parking", form.parking === d ? "" : d)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        form.parking === d
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-border hover:border-primary/50"
                      }`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* 공실 여부 */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-foreground">현재 빈방 여부</label>
                <div className="flex gap-3">
                  {["공실", "세입자 거주중"].map((t) => (
                    <button key={t} type="button" onClick={() => set("available_from", t)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                        form.available_from === t
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-border hover:border-primary/50"
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* 금액 - 단위: 만원 */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-foreground">금액 입력</label>
                <p className="text-[11px] text-muted-foreground/70 -mt-1">단위: 만원</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "deposit", label: "보증금" },
                    { key: "monthly", label: "월세" },
                    { key: "manage_fee", label: "관리비" },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
                      <div className="relative">
                        <input type="text" placeholder="만원"
                          value={form[key as keyof typeof form] as string}
                          onChange={(e) => set(key, e.target.value)}
                          className={icA() + " pr-10"} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">만원</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground">퇴거일</label>
                    <input type="text" placeholder="예) 2026-05-01"
                      value={form.vacate_date ?? ""}
                      onChange={(e) => set("vacate_date", e.target.value)}
                      className={icA()} />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground">중개보수</label>
                    <input type="text" placeholder="예) 협의"
                      value={form.note ?? ""}
                      onChange={(e) => set("note", e.target.value)}
                      className={icA()} />
                  </div>
                </div>
              </div>

              {/* 체크박스 */}
              <div className="flex gap-6 flex-wrap">
                {[
                  { key: "elevator", label: "엘리베이터" },
                  { key: "is_new", label: "신규 매물" },
                  { key: "is_hot", label: "인기 매물" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input type="checkbox"
                      checked={form[key as keyof typeof form] as boolean}
                      onChange={(e) => set(key, e.target.checked)}
                      className="w-4 h-4 accent-primary" />
                    {label}
                  </label>
                ))}
              </div>

              {/* 메모 */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-foreground">메모</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground">건물 메모</label>
                    <textarea rows={2} value={form.building_memo ?? ""}
                      onChange={(e) => set("building_memo", e.target.value)}
                      className={icA() + " resize-none"} placeholder="건물 관련 메모" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground">방 메모</label>
                    <textarea rows={2} value={form.room_memo ?? ""}
                      onChange={(e) => set("room_memo", e.target.value)}
                      className={icA() + " resize-none"} placeholder="방 관련 메모" />
                  </div>
                </div>
              </div>

              {/* 매물 소개 */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-foreground">매물 소개</label>
                <textarea rows={3} value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  className={icA() + " resize-none"} placeholder="매물의 특징, 특이사항 등" />
              </div>
            </div>
          )}

          {/* ── STEP 3 ── */}
          {formStep === 3 && (
            <div className="flex flex-col gap-5">
              {/* 연락처 */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-foreground">연락처</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "agent_name", label: "부동산 연락처", placeholder: "043-123-4567" },
                    { key: "building_name", label: "소유주 연락처", placeholder: "010-1234-5678" },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key + label} className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
                      <div className="relative">
                        <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input type="tel" placeholder={placeholder}
                          value={form[key as keyof typeof form] as string ?? ""}
                          onChange={(e) => set(key, e.target.value)}
                          className={icA() + " pl-8"} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>


              {/* 노출 상태 */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-foreground">노출 설정</label>
                <div className="flex gap-2">
                  {(["active", "hidden"] as const).map((s) => (
                    <button key={s} type="button" onClick={() => set("status", s)}
                      className="px-4 py-2 rounded-full text-xs font-semibold border transition-all"
                      style={form.status === s
                        ? { background: s === "active" ? "hsl(0 0% 0%)" : "hsl(var(--destructive))", color: "#fff", borderColor: "transparent" }
                        : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                      }>
                      {s === "active" ? "노출중" : "노출종료"}
                    </button>
                  ))}
                </div>
              </div>

              {/* 날짜 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">등록일</label>
                  <input type="date" value={form.registered_date}
                    onChange={(e) => set("registered_date", e.target.value)} className={icA()} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">물건확인일</label>
                  <input type="date" value={form.checked_date ?? ""}
                    onChange={(e) => set("checked_date", e.target.value)} className={icA()} />
                </div>
              </div>

              {/* 사진 업로드 */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-foreground">매물 사진</label>
                {(form.images ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(form.images ?? []).map((url, i) => (
                      <div key={url} className="relative w-24 h-24 rounded-lg overflow-hidden border border-border">
                        <img src={url} alt={`사진 ${i + 1}`} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removeImage(url)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center hover:bg-destructive">
                          <X className="w-3 h-3 text-white" />
                        </button>
                        {i === 0 && <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full">대표</span>}
                      </div>
                    ))}
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => handleImageUpload(e.target.files)} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed transition-all hover:border-primary"
                  style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
                  {uploading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">업로드 중...</span></>
                    : <><ImagePlus className="w-4 h-4" /><span className="text-xs font-medium">사진 추가 (여러 장 선택 가능)</span></>
                  }
                </button>
              </div>
            </div>
          )}

          {/* Step Navigation */}
          <div className="flex gap-3 pt-4 pb-2 sticky bottom-0 bg-card">
            <button type="button" onClick={formStep === 1 ? onClose : () => setFormStep((s) => (s - 1) as 1 | 2 | 3)}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors">
              {formStep === 1 ? "취소" : "이전"}
            </button>
            {formStep < 3 ? (
              <button type="button" onClick={() => setFormStep((s) => (s + 1) as 1 | 2 | 3)}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-extrabold hover:bg-primary/90 transition-colors">
                다음
              </button>
            ) : (
              <button type="button" onClick={handleSave} disabled={saving || uploading}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-extrabold hover:bg-primary/90 transition-colors disabled:opacity-50">
                {saving ? "저장 중..." : <span className="flex items-center justify-center gap-1"><Save className="w-3.5 h-3.5" />저장</span>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── AdminSelect helper ────────────────────────────────────────────────────────
const AdminSelect = ({ value, onChange, placeholder, options, disabled }: {
  value: string; onChange: (v: string) => void; placeholder: string; options: string[]; disabled?: boolean;
}) => (
  <div className="relative">
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
      className="w-full px-3 py-2 text-sm rounded-lg border outline-none appearance-none bg-background text-foreground border-border focus:border-primary focus:ring-1 focus:ring-primary/20 disabled:opacity-40 disabled:cursor-not-allowed pr-7">
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
  </div>
);

// ─── BuildingGroup ────────────────────────────────────────────────────────────
// 동·번지 행 클릭 시 하단 호수 아코디언 표시
const BuildingGroup = ({
  rep,
  units,
  repImage,
  togglingId,
  onEdit,
  onAddUnit,
  onToggleStatus,
  onDelete,
}: {
  rep: DBProperty;
  units: DBProperty[];
  repImage?: string;
  hasImages: boolean;
  togglingId: string | null;
  onEdit: (p: DBProperty) => void;
  onAddUnit: (p: DBProperty) => void;
  onToggleStatus: (p: DBProperty) => void;
  onDelete: (p: DBProperty) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const activeCount = units.filter(u => u.status === "active").length;
  const totalViews = units.reduce((s, u) => s + (u.views || 0), 0);
  const repDate = rep.registered_date ? rep.registered_date.slice(0, 10) : "";

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* 동·번지 헤더 행 — 클릭 시 호수 아코디언 토글 */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors select-none"
        style={{ background: "hsl(var(--muted) / 0.35)" }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* 대표 이미지 썸네일 */}
        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-border bg-muted flex items-center justify-center">
          {repImage ? (
            <img src={repImage} alt="대표" className="w-full h-full object-cover" />
          ) : (
            <Building2 className="w-5 h-5 text-muted-foreground/40" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {rep.building_name && (
              <span className="text-sm font-extrabold text-foreground">{rep.building_name}</span>
            )}
            <span className="text-xs font-semibold text-foreground truncate">
              {rep.dong} {rep.lot_number && <span className="text-muted-foreground">{rep.lot_number}번지</span>}
            </span>
            <span className="text-xs text-muted-foreground truncate hidden sm:block">{rep.address}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "hsl(var(--accent) / 0.12)", color: "hsl(var(--accent))" }}>
              {rep.type}
            </span>
            <span className="text-[11px] text-muted-foreground">
              총 {units.length}호 · 노출 {activeCount}호
            </span>
            {repDate && (
              <span className="text-[11px] text-muted-foreground">
                📅 {repDate}
              </span>
            )}
            {units.some(u => (u.images ?? []).length > 0) && (
              <span className="text-[11px] font-medium" style={{ color: "hsl(0 0% 0%)" }}>
                📷 사진 {units.reduce((s, u) => s + (u.images ?? []).length, 0)}장
              </span>
            )}
            <span className="text-[11px] font-medium flex items-center gap-0.5" style={{ color: "hsl(var(--primary))" }}>
              <Eye className="w-3 h-3" />조회 {totalViews.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddUnit(rep); }}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-semibold transition-colors"
            style={{ background: "hsl(0 0% 0% / 0.13)", color: "hsl(0 0% 0%)" }}
            title="같은 건물에 호수 추가"
          >
            <Plus className="w-3.5 h-3.5" />호수 추가
          </button>
          {expanded
            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground" />
          }
        </div>
      </div>

      {/* 호수 목록 — 동·번지 클릭 시 하단 펼침 */}
      {expanded && (
        <div>
          {/* 컬럼 헤더 */}
          <div className="hidden md:grid grid-cols-[60px_80px_1fr_110px_90px_70px_80px_80px_170px] text-xs font-semibold text-muted-foreground bg-muted/20 px-4 py-2 border-t border-border">
            <span className="text-center">📷</span>
            <span className="text-center">호수</span>
            <span>매물명</span>
            <span className="text-center">보증금/월세</span>
            <span className="text-center">층/면적</span>
            <span className="text-center">조회수</span>
            <span className="text-center">등록일</span>
            <span className="text-center">상태</span>
            <span className="text-center">액션</span>
          </div>
          {units.map((u, idx) => {
            const unitImages = u.images ?? [];
            const thumb = unitImages[0];
            const regDate = u.registered_date ? u.registered_date.slice(0, 10) : "";
            return (
              <div
                key={u.id}
                onClick={() => onEdit(u)}
                className={`grid md:grid-cols-[60px_80px_1fr_110px_90px_70px_80px_80px_170px] items-center px-4 py-3 border-t border-border transition-colors cursor-pointer ${u.status === "hidden" ? "opacity-50 bg-muted/10 hover:bg-muted/20" : "hover:bg-primary/5"}`}
              >
                {/* 사진 썸네일 */}
                <div className="flex justify-center">
                  <div className="w-10 h-10 rounded-md overflow-hidden border border-border bg-muted flex items-center justify-center relative">
                    {thumb ? (
                      <>
                        <img src={thumb} alt="사진" className="w-full h-full object-cover" />
                        {unitImages.length > 1 && (
                          <span className="absolute bottom-0 right-0 text-[9px] font-bold bg-black/60 text-white px-1">+{unitImages.length - 1}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/40">없음</span>
                    )}
                  </div>
                </div>

                {/* 호수 */}
                <div className="flex justify-center">
                  {u.unit_number ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "hsl(var(--primary) / 0.10)", color: "hsl(var(--primary))" }}>
                      {u.unit_number}호
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>

                {/* 매물명 */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground truncate">{u.title}</span>
                    {u.status === "hidden" && <EyeOff className="w-3 h-3 shrink-0 text-muted-foreground" />}
                    {idx === 0 && units.length > 1 && (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: "hsl(var(--chart-4) / 0.12)", color: "hsl(var(--chart-4))" }}>대표</span>
                    )}
                  </div>
                  {u.room_password && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">🔑 {u.room_password}</div>
                  )}
                </div>

                {/* 보증금/월세 */}
                <div className="hidden md:block text-center">
                  <div className="text-xs font-medium text-foreground">{u.deposit || "—"}</div>
                  <div className="text-[10px] text-muted-foreground">{u.monthly || "—"}/월</div>
                </div>

                {/* 층/면적 */}
                <div className="hidden md:block text-center">
                  <div className="text-xs text-foreground">{u.floor ? `${u.floor}` : "—"}</div>
                  <div className="text-[10px] text-muted-foreground">{u.area || "—"}</div>
                </div>

                {/* 조회수 */}
                <div className="hidden md:flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <Eye className="w-3 h-3" />{u.views.toLocaleString()}
                </div>

                {/* 등록일 */}
                <div className="hidden md:flex items-center justify-center">
                  <span className="text-[10px] text-muted-foreground">{regDate || "—"}</span>
                </div>

                {/* 상태 */}
                <div className="hidden md:flex justify-center">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={u.status === "active"
                      ? { background: "hsl(0 0% 0% / 0.12)", color: "hsl(0 0% 0%)" }
                      : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
                    }>
                    {u.status === "active" ? "노출" : "종료"}
                  </span>
                </div>

                {/* 액션 */}
                <div className="hidden md:flex items-center justify-center gap-1.5 flex-wrap">
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(u); }}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full font-semibold"
                    style={{ background: "hsl(var(--primary) / 0.10)", color: "hsl(var(--primary))" }}
                    title="수정"
                  >
                    <Pencil className="w-3 h-3" />수정
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleStatus(u); }}
                    disabled={togglingId === u.id}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full font-semibold"
                    style={u.status === "active"
                      ? { background: "hsl(var(--destructive) / 0.10)", color: "hsl(var(--destructive))" }
                      : { background: "hsl(0 0% 0% / 0.12)", color: "hsl(0 0% 0%)" }
                    }
                    title={u.status === "active" ? "노출종료" : "노출재개"}
                  >
                    {u.status === "active" ? <><EyeOff className="w-3 h-3" />종료</> : <><Eye className="w-3 h-3" />재개</>}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(u); }}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full font-semibold"
                    style={{ background: "hsl(var(--destructive) / 0.15)", color: "hsl(var(--destructive))" }}
                    title="매물 삭제"
                  >
                    <Trash2 className="w-3 h-3" />삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── ContactEditModal ────────────────────────────────────────────────────────
// 구 단축명 → DONG_MAP 풀네임 매핑
const DISTRICT_SHORT_TO_FULL: Record<string, string> = {
  "상당구": "청주시 상당구",
  "서원구": "청주시 서원구",
  "흥덕구": "청주시 흥덕구",
  "청원구": "청주시 청원구",
};

const ContactEditModal = ({
  contact,
  onClose,
  onSave,
}: {
  contact: CheongJuContact | null;
  onClose: () => void;
  onSave: (updated: CheongJuContact) => Promise<void>;
}) => {
  const [form, setForm] = useState<CheongJuContact>(
    contact ?? { id: "", district: "", dong: "", lot_number: "", building_name: null, building_dong: null, unit_number: null, phone: "", contact_owner: "", contact_manager: "", contact_broker: "", memo: "" }
  );
  const [isCollective, setIsCollective] = useState<boolean>(!!(contact?.building_dong || contact?.unit_number));
  // 관리인 연락처: 줄바꿈으로 여러개 저장 → 배열로 편집
  const initialManagers = (contact?.contact_manager ?? "").split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const [managers, setManagers] = useState<string[]>(initialManagers.length > 0 ? initialManagers : [""]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const mergedManager = managers.map((m) => m.trim()).filter(Boolean).join("\n");
    const payload: CheongJuContact = {
      ...form,
      building_dong: isCollective ? (form.building_dong ?? null) : null,
      unit_number: isCollective ? (form.unit_number ?? null) : null,
      contact_manager: mergedManager,
    };
    await onSave(payload);
    setSaving(false);
  };

  // 구 선택 시 가용 동 목록
  const availableDongs = form.district
    ? (DONG_MAP[DISTRICT_SHORT_TO_FULL[form.district]] ?? [])
    : [];

  // 같은 주소(구+동+번지)에 이미 등록된 건물명을 자동 로드
  // 사용자가 직접 입력 중이면 덮어쓰지 않음
  useEffect(() => {
    if (contact?.id) return; // 수정 모드는 스킵
    if (!form.district || !form.dong || !form.lot_number) return;
    if (form.building_name) return; // 이미 입력된 경우 유지
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("cheongju_contacts")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select("building_name" as any)
        .eq("district", form.district)
        .eq("dong", form.dong)
        .eq("lot_number", form.lot_number)
        .not("building_name", "is", null)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const found = (data as any)?.building_name as string | null | undefined;
      if (found) setForm((f) => (f.building_name ? f : { ...f, building_name: found }));
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [contact?.id, form.district, form.dong, form.lot_number, form.building_name]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl"
        style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-base font-bold text-foreground">
            {form.district} {form.dong} {form.building_dong ? `${form.building_dong} ` : ""}{form.unit_number ? `${form.unit_number}호` : ""} 연락처 {contact?.id ? "수정" : "등록"}
          </h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">구 *</label>
              <select
                value={form.district}
                onChange={(e) => setForm((f) => ({ ...f, district: e.target.value, dong: "" }))}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none"
              >
                <option value="">구 선택</option>
                {[...CHEONGJU_DISTRICTS].sort((a, b) => a.localeCompare(b, 'ko-KR')).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">동/읍/면 *</label>
              <select
                value={form.dong}
                onChange={(e) => setForm((f) => ({ ...f, dong: e.target.value }))}
                disabled={availableDongs.length === 0}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none disabled:opacity-50"
              >
                <option value="">{form.district ? "동 선택" : "구 먼저 선택"}</option>
                {[...availableDongs].sort((a, b) => a.localeCompare(b, 'ko-KR')).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          {/* 번지수 */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">번지수 (지번)</label>
            <Input
              value={form.lot_number ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, lot_number: e.target.value }))}
              placeholder="예: 123-45"
              className="h-9 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">건물명</label>
            <Input
              value={form.building_name ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, building_name: e.target.value || null }))}
              placeholder="예: 집다빌딩 (같은 주소면 자동 로드)"
              className="h-9 text-sm"
            />
          </div>

          {/* 집합건물 체크박스 */}
          <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isCollective}
              onChange={(e) => {
                const next = e.target.checked;
                setIsCollective(next);
                if (!next) setForm((f) => ({ ...f, building_dong: null, unit_number: null }));
              }}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            집합건물 (아파트·빌라 등 동/호수 입력)
          </label>

          {isCollective && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">동(棟)</label>
                <Input
                  value={form.building_dong ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, building_dong: e.target.value || null }))}
                  placeholder="예: 101동"
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">호수</label>
                <Input
                  value={form.unit_number ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, unit_number: e.target.value || null }))}
                  placeholder="예: 301호"
                  className="h-9 text-sm"
                />
              </div>
            </div>
          )}

          {[
            { key: "phone", label: "소유주 전화번호 (대표)", placeholder: "010-XXXX-XXXX", isPhone: true },
            { key: "contact_owner", label: "소유주 전화번호 (추가)", placeholder: "010-XXXX-XXXX", isPhone: true },
          ].map(({ key, label, placeholder, isPhone }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">{label}</label>
              <Input
                value={(form as Record<string, unknown>)[key] as string ?? ""}
                onChange={(e) => {
                  const v = isPhone ? formatPhone(e.target.value) : e.target.value;
                  setForm((f) => ({ ...f, [key]: v }));
                }}
                placeholder={placeholder}
                className="h-9 text-sm"
              />
            </div>
          ))}

          {/* 관리인 전화번호 — 다중 추가 가능 */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground">관리인 전화번호</label>
              <button
                type="button"
                onClick={() => setManagers((m) => [...m, ""])}
                className="text-[11px] font-bold text-primary hover:underline"
              >
                + 관리인 추가
              </button>
            </div>
            {managers.map((mgr, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={mgr}
                  onChange={(e) => {
                    const v = formatPhone(e.target.value);
                    setManagers((arr) => arr.map((x, i) => (i === idx ? v : x)));
                  }}
                  placeholder="010-XXXX-XXXX"
                  className="h-9 text-sm flex-1"
                />
                {managers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setManagers((arr) => arr.filter((_, i) => i !== idx))}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="삭제"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {[
            { key: "contact_broker", label: "부동산 전화번호", placeholder: "043-XXXX-XXXX", isPhone: true },
            { key: "memo", label: "메모", placeholder: "비고", isPhone: false },
          ].map(({ key, label, placeholder, isPhone }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">{label}</label>
              <Input
                value={(form as Record<string, unknown>)[key] as string ?? ""}
                onChange={(e) => {
                  const v = isPhone ? formatPhone(e.target.value) : e.target.value;
                  setForm((f) => ({ ...f, [key]: v }));
                }}
                placeholder={placeholder}
                className="h-9 text-sm"
              />
            </div>
          ))}
        </div>


        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "저장 중..." : <><Save className="w-3.5 h-3.5 mr-1" />저장</>}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => searchParams.get("tab") ?? "dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string>("");
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setAdminUserId(session.user.id);
    });
  }, []);
  const [members, setMembers] = useState<AgentProfile[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState("");
  const [activeSessions, setActiveSessions] = useState<Record<string, Array<{ device_type: string; device_id: string; ip_address: string | null; user_agent: string | null; last_seen_at: string }>>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [posts, setPosts] = useState(MOCK_POSTS);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState("all");
  const [memberGroupByAgency, setMemberGroupByAgency] = useState(false);
  const [collapsedAgencies, setCollapsedAgencies] = useState<Record<string, boolean>>({});
  const [propertySearch, setPropertySearch] = useState("");
  // 비밀번호 관리 상태
  const [pwInputs, setPwInputs] = useState<Record<string, string>>({});
  const [pwVisible, setPwVisible] = useState<Record<string, boolean>>({});
  const [pwSaving, setPwSaving] = useState<string | null>(null);
  const [postSearch, setPostSearch] = useState("");
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  // 매물 관리 state
  const [dbProperties, setDbProperties] = useState<DBProperty[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [propertyModal, setPropertyModal] = useState<{ mode: "add" | "edit"; data: Partial<DBProperty> | null } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [propertyDistrictFilter, setPropertyDistrictFilter] = useState("전체");
  const { hiddenIds: hiddenMockIds, hideMockId, restoreAll: restoreAllMocks } = useHiddenMockIds();

  // 청주 연락처 state
  const [contacts, setContacts] = useState<CheongJuContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactModal, setContactModal] = useState<CheongJuContact | null | "new">(null);
  const [contactSearch, setContactSearch] = useState("");
  const [appliedContactSearch, setAppliedContactSearch] = useState("");
  const [contactDistrictFilter, setContactDistrictFilter] = useState("전체");
  const [contactDisplayCount, setContactDisplayCount] = useState(200);

  // 신고/제안 state
  const [reports, setReports] = useState<PropertyReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportFilter, setReportFilter] = useState<"all" | "error_report" | "deal_complete" | "rental_proposal">("all");
  const [reportStatusFilter, setReportStatusFilter] = useState<"all" | "pending" | "reviewed" | "resolved" | "rejected">("all");
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [reportMemoInputs, setReportMemoInputs] = useState<Record<string, string>>({});

  // ─── 세션 기반 관리자 인증 가드 ──────────────────────────────────────────
  useEffect(() => {
    const checkAdminAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/admin/login"); return; }
      const { data: roleData } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", session.user.id).eq("role", "admin").maybeSingle();
      if (!roleData) { await supabase.auth.signOut(); navigate("/admin/login"); }
    };
    checkAdminAuth();
  }, [navigate]);

  // ─── 회원 불러오기 ───────────────────────────────────────────────────────
  const fetchMembers = useCallback(async () => {
    setMembersLoading(true); setMembersError("");
    const { data, error } = await supabase.from("agent_profiles").select("*").order("created_at", { ascending: false });
    if (error) { setMembersError("데이터 로드 오류: " + error.message); setMembersLoading(false); return; }

    // user_roles에서 각 회원의 등급 조회
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userIds = (data ?? []).map((m: any) => m.user_id as string);
    let roleMap: Record<string, "admin" | "user"> = {};
    if (userIds.length > 0) {
      const { data: rolesData } = await supabase.from("user_roles").select("user_id, role").in("user_id", userIds);
      if (rolesData) {
        roleMap = Object.fromEntries(rolesData.map((r: { user_id: string; role: "admin" | "user" }) => [r.user_id, r.role]));
      }
    }

    // Edge Function으로 이메일(아이디) 조회
    let emailMap: Record<string, string> = {};
    let lastSignInMap: Record<string, string | null> = {};
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const res = await supabase.functions.invoke("admin-get-users", {
          body: {},
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.data?.users) {
          emailMap = Object.fromEntries(res.data.users.map((u: { user_id: string; email: string }) => [u.user_id, u.email]));
          lastSignInMap = Object.fromEntries(res.data.users.map((u: { user_id: string; last_sign_in_at?: string | null }) => [u.user_id, u.last_sign_in_at ?? null]));
        }
      }
    } catch (_) { /* 이메일 조회 실패시 무시 */ }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setMembers((data ?? []).map((m: any) => ({
      ...m,
      role: roleMap[m.user_id] ?? "user",
      email: emailMap[m.user_id] ?? m.email ?? "",
      last_sign_in_at: lastSignInMap[m.user_id] ?? null,
    } as AgentProfile)));

    // 활성 디바이스 세션(IP) 로드
    try {
      const { data: sess } = await supabase
        .from("user_active_sessions")
        .select("user_id, device_type, device_id, ip_address, user_agent, last_seen_at")
        .order("last_seen_at", { ascending: false });
      const byUser: Record<string, Array<{ device_type: string; device_id: string; ip_address: string | null; user_agent: string | null; last_seen_at: string }>> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sess ?? []).forEach((s: any) => {
        (byUser[s.user_id] ??= []).push({
          device_type: s.device_type,
          device_id: s.device_id,
          ip_address: s.ip_address ?? null,
          user_agent: s.user_agent ?? null,
          last_seen_at: s.last_seen_at,
        });
      });
      setActiveSessions(byUser);
    } catch { /* ignore */ }

    setMembersLoading(false);
  }, []);

  // ─── 매물(DB) 불러오기 ───────────────────────────────────────────────────
  const fetchProperties = useCallback(async () => {
    setPropertiesLoading(true);
    const { data, error } = await supabase.from("properties").select("*").order("created_at", { ascending: false });
    if (!error && data) setDbProperties(data as DBProperty[]);
    setPropertiesLoading(false);
  }, []);

  // ─── 청주 연락처 불러오기 (1000행 제한 우회: 페이지네이션) ────────────
  const fetchContacts = useCallback(async () => {
    setContactsLoading(true);
    const PAGE = 1000;
    let from = 0;
    const all: CheongJuContact[] = [];
    // count: exact 로 총 개수 확보 후, 페이지 단위로 모두 로드
    while (true) {
      const { data, error } = await supabase
        .from("cheongju_contacts")
        .select("*")
        .order("district").order("dong")
        .range(from, from + PAGE - 1);
      if (error || !data) break;
      all.push(...(data as CheongJuContact[]));
      if (data.length < PAGE) break;
      from += PAGE;
    }
    setContacts(all);
    setContactsLoading(false);
  }, []);

  // ─── 신고/제안 불러오기 ──────────────────────────────────────────────────
  const fetchReports = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setReportsLoading(true);
    const { data, error } = await supabase
      .from("property_reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      // property_id로 건물명 매핑
      const propIds = [...new Set(data.map((r: any) => r.property_id))];
      const { data: props } = await supabase
        .from("properties")
        .select("id, building_name")
        .in("id", propIds);
      const nameMap = new Map((props || []).map((p: any) => [p.id, p.building_name]));
      setReports(data.map((r: any) => ({ ...r, building_name: nameMap.get(r.property_id) || "" })) as PropertyReport[]);
    }
    if (!silent) setReportsLoading(false);
  }, []);

  useEffect(() => {
    void fetchMembers();
    void fetchProperties();
    void fetchContacts();
    void fetchReports();
  }, [fetchMembers, fetchProperties, fetchContacts, fetchReports]);

  useEffect(() => {
    if (tab !== "reports") return;

    void fetchReports({ silent: true });

    const intervalId = window.setInterval(() => {
      void fetchReports({ silent: true });
    }, 5000);

    const handleFocus = () => {
      void fetchReports({ silent: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchReports({ silent: true });
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [tab, fetchReports]);

  // Realtime 구독: 매물 변경 즉시 반영
  useEffect(() => {
    const channel = supabase
      .channel("admin-properties-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "properties" }, () => {
        void fetchProperties();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchProperties]);

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/admin/login"); };

  // ─── 승인/거절 ───────────────────────────────────────────────────────────
  const updateMemberStatus = async (id: string, status: "approved" | "rejected") => {
    setUpdatingId(id);
    const { error } = await supabase.from("agent_profiles").update({ status }).eq("id", id);
    setUpdatingId(null);
    if (error) { alert("상태 변경 오류: " + error.message); return; }
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, status } : m));
  };

  // ─── 등급(member_type) 변경 ──────────────────────────────────────────────
  const updateMemberType = async (id: string, member_type: MemberType) => {
    const target = members.find((x) => x.id === id);
    const current = target?.member_type ?? "대표중개사";
    if (current === member_type) return;

    // 일반회원으로 변경 시: 확인 모달 + 중개사 관련 필드 초기화
    if (member_type === "일반회원") {
      const ok = await customConfirm(
        `[일반회원으로 변경]\n\n` +
        `${target?.name ?? "해당 회원"} 님을 '일반회원'으로 변경합니다.\n\n` +
        `• 중개사 권한(매물 등록/관리)이 회수됩니다.\n` +
        `• 등록번호 및 상위(대표) 부동산 연결이 해제됩니다.\n` +
        `• 즉시 적용되며 되돌리려면 다시 등급을 변경해야 합니다.\n\n계속하시겠습니까?`
      );
      if (!ok) return;

      const { error } = await supabase
        .from("agent_profiles")
        .update({ member_type, license_number: null, parent_user_id: null, status: "approved", is_active: true })
        .eq("id", id);
      if (error) { alert("등급 변경 오류: " + error.message); return; }
      setMembers((prev) => prev.map((m) => m.id === id
        ? { ...m, member_type, license_number: null, parent_user_id: null, status: "approved", is_active: true }
        : m));
      await customAlert("일반회원으로 변경되었습니다.");
      return;
    }

    // 일반회원 → 중개사 유형으로 변경 시에도 확인
    if (current === "일반회원") {
      const ok = await customConfirm(
        `[${member_type}(으)로 변경]\n\n` +
        `${target?.name ?? "해당 회원"} 님을 '${member_type}'(으)로 변경합니다.\n중개사 권한이 부여됩니다. 계속하시겠습니까?`
      );
      if (!ok) return;
    }


    const { error } = await supabase.from("agent_profiles").update({ member_type }).eq("id", id);
    if (error) { alert("등급 변경 오류: " + error.message); return; }
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, member_type } : m));
  };


  // ─── 역할(role) 변경: 관리자 부여/해제 ──────────────────────────────────
  const [roleChangingId, setRoleChangingId] = useState<string | null>(null);
  const updateMemberRole = async (m: AgentProfile, newRole: "admin" | "user") => {
    setRoleChangingId(m.id);
    try {
      if (newRole === "admin") {
        // 관리자 권한 부여
        const { error } = await supabase.from("user_roles").insert({ user_id: m.user_id, role: "admin" });
        if (error && !error.message.includes("duplicate")) { alert("역할 변경 오류: " + error.message); return; }
      } else {
        // 관리자 권한 해제
        const { error } = await supabase.from("user_roles").delete().eq("user_id", m.user_id).eq("role", "admin");
        if (error) { alert("역할 변경 오류: " + error.message); return; }
      }
      setMembers((prev) => prev.map((p) => p.id === m.id ? { ...p, role: newRole } : p));
    } finally {
      setRoleChangingId(null);
    }
  };

  // ─── 상위 부동산(parent) 변경 ────────────────────────────────────────────
  const updateParent = async (id: string, parent_user_id: string | null) => {
    const { error } = await supabase.from("agent_profiles").update({ parent_user_id }).eq("id", id);
    if (error) { alert("상위 부동산 변경 오류: " + error.message); return; }
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, parent_user_id } : m));
  };

  // ─── 접속 차단/허용 토글 ────────────────────────────────────────────────
  const toggleIsActive = async (m: AgentProfile) => {
    const newActive = !m.is_active;
    const { error } = await supabase.from("agent_profiles").update({ is_active: newActive }).eq("id", m.id);
    if (error) { alert("접속 상태 변경 오류: " + error.message); return; }
    setMembers((prev) => prev.map((p) => p.id === m.id ? { ...p, is_active: newActive } : p));

  // ─── PC 허용 IP 변경 ─────────────────────────────────────────────────────
  };

  const updateAllowedPcIp = async (m: AgentProfile, raw: string) => {
    const next = raw.trim();
    // 간단한 IPv4 검증 (빈 값은 허용 — 제한 해제)
    if (next && !/^(\d{1,3}\.){3}\d{1,3}$/.test(next)) {
      alert("올바른 IPv4 형식이 아닙니다. 예: 211.234.56.78");
      return;
    }
    const value = next === "" ? null : next;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("agent_profiles").update({ allowed_pc_ip: value } as any).eq("id", m.id);
    if (error) { alert("PC 허용 IP 변경 오류: " + error.message); return; }
    setMembers((prev) => prev.map((p) => p.id === m.id ? { ...p, allowed_pc_ip: value } : p));
  };

  // ─── 회원 정보 수정 ──────────────────────────────────────────────────────
  const [memberEditData, setMemberEditData] = useState<Record<string, Partial<AgentProfile>>>({});
  const [memberSaving, setMemberSaving] = useState<string | null>(null);

  const getMemberEditValue = (m: AgentProfile, field: keyof AgentProfile) => {
    return memberEditData[m.id]?.[field] ?? m[field] ?? "";
  };

  const setMemberEditField = (id: string, field: keyof AgentProfile, value: string) => {
    setMemberEditData(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? {}), [field]: value },
    }));
  };

  const saveMemberProfile = async (m: AgentProfile) => {
    const edits = memberEditData[m.id];
    if (!edits || Object.keys(edits).length === 0) return;
    setMemberSaving(m.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("agent_profiles").update(edits as any).eq("id", m.id);
    setMemberSaving(null);
    if (error) { alert("수정 오류: " + error.message); return; }
    setMembers(prev => prev.map(p => p.id === m.id ? { ...p, ...edits } : p));
    setMemberEditData(prev => { const n = { ...prev }; delete n[m.id]; return n; });
  };

  // ─── 회원 삭제 ──────────────────────────────────────────────────────────
  const deleteMember = async (m: AgentProfile) => {
    if (!window.confirm(`'${m.name}' 회원을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    const { error } = await supabase.from("agent_profiles").delete().eq("id", m.id);
    if (error) { alert("삭제 오류: " + error.message); return; }
    setMembers((prev) => prev.filter((p) => p.id !== m.id));
  };

  // ─── 비밀번호 변경 (관리자용) ────────────────────────────────────────────
  const setMemberPassword = async (m: AgentProfile) => {
    const pw = pwInputs[m.id] ?? "";
    if (pw.length < 6) { alert("비밀번호는 6자 이상이어야 합니다."); return; }
    setPwSaving(m.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { alert("세션이 만료되었습니다."); return; }
      const res = await supabase.functions.invoke("admin-get-users", {
        body: { action: "set_password", user_id: m.user_id, password: pw },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.data?.success) {
        alert(`✅ ${m.name} 님의 비밀번호가 변경되었습니다.`);
        setPwInputs((prev) => ({ ...prev, [m.id]: "" }));
      } else {
        alert("비밀번호 변경 오류: " + (res.data?.error ?? "알 수 없는 오류"));
      }
    } finally {
      setPwSaving(null);
    }
  };


  const togglePropertyStatus = async (prop: DBProperty) => {
    setTogglingId(prop.id);
    const newStatus = prop.status === "active" ? "hidden" : "active";
    // 재등록(active 복구) 시 확인일 초기화 + 거래완료 제보 반려 처리
    if (newStatus === "active") {
      await supabase
        .from("property_reports")
        .update({ status: "rejected" })
        .eq("property_id", prop.id)
        .eq("report_type", "deal_complete")
        .neq("status", "rejected");
    }
    const { error } = await supabase
      .from("properties")
      .update(newStatus === "active"
        ? { status: newStatus, checked_date: null }
        : { status: newStatus }
      )
      .eq("id", prop.id);
    if (!error) setDbProperties((prev) => prev.map((p) => p.id === prop.id ? { ...p, status: newStatus, checked_date: newStatus === "active" ? undefined : p.checked_date } : p));
    else alert("상태 변경 오류: " + error.message);
    setTogglingId(null);
  };

  // ─── 매물 삭제 ────────────────────────────────────────────────────────────
  const deleteProperty = async (prop: DBProperty) => {
    if (!window.confirm(`'${prop.title}' 매물을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    const { error } = await supabase.from("properties").delete().eq("id", prop.id);
    if (error) { alert("삭제 오류: " + error.message); return; }
    setDbProperties((prev) => prev.filter((p) => p.id !== prop.id));
  };

  // ─── 임의 매물(MAP_PROPERTIES) 숨김 처리 ─────────────────────────────────
  const deleteMockProperty = (numId: number, title: string) => {
    if (!window.confirm(`'${title}' 매물을 숨기겠습니까?\n(임의 등록 매물은 목록에서 제거되며 복구하려면 관리자에게 문의하세요.)`)) return;
    hideMockId(numId);
  };


  // ─── 매물 저장 (등록/수정) ────────────────────────────────────────────────
  const saveProperty = async (data: Omit<DBProperty, "id" | "created_at">) => {
    // 세션 확인 (RLS 통과를 위해 필수)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert("세션이 만료되었습니다. 다시 로그인해주세요.");
      navigate("/admin/login");
      return;
    }

    // DB 컬럼과 정확히 매핑된 페이로드 (undefined/빈문자열 → null 처리)
    const payload = {
      title: data.title || "",
      building_name: data.building_name || null,
      address: data.address || "",
      dong: data.dong ?? "",
      lot_number: data.lot_number ?? "",
      district: data.district || null,
      type: data.type || "",
      room_type: data.room_type || null,
      unit_number: data.unit_number || null,
      area: (data.area && !data.area.includes("평")) ? (() => { const n = parseFloat(data.area.replace(/[^0-9.]/g, "")); return !isNaN(n) && n > 0 ? `${(n / 3.3058).toFixed(1)}평` : data.area; })() : (data.area ?? ""),
      floor: data.floor ?? "",
      deposit: data.deposit ?? "",
      monthly: data.monthly ?? "",
      manage_fee: data.manage_fee ?? "",
      parking: data.parking ?? "",
      elevator: data.elevator ?? false,
      available_from: data.available_from ?? "",
      total_floors: data.total_floors ?? "",
      build_year: data.build_year ?? "",
      description: data.description ?? "",
      building_memo: data.building_memo || null,
      room_memo: data.room_memo || null,
      note: data.note || null,
      vacate_date: data.vacate_date || null,
      building_password: data.building_password || null,
      room_password: data.room_password || null,
      options: Array.isArray(data.options) ? data.options : [],
      images: Array.isArray(data.images) ? data.images : [],
      views: Number(data.views) || 0,
      lat: Number(data.lat) || 0,
      lng: Number(data.lng) || 0,
      is_new: data.is_new ?? false,
      is_hot: data.is_hot ?? false,
      status: data.status ?? "active",
      registered_date: data.registered_date || new Date().toISOString().slice(0, 10),
      checked_date: data.checked_date || null,
      agent_name: data.agent_name ?? "",
    };

    if (propertyModal?.mode === "edit" && propertyModal.data?.id) {
      const { error } = await supabase.from("properties").update(payload).eq("id", propertyModal.data.id);
      if (error) {
        console.error("수정 오류:", error);
        alert("수정 오류: " + error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("properties").insert(payload);
      if (error) {
        console.error("등록 오류:", error);
        alert("등록 오류: " + error.message);
        return;
      }
    }
    setPropertyModal(null);
    fetchProperties();
  };

  // ─── 연락처 저장 ─────────────────────────────────────────────────────────
  const saveContact = async (updated: CheongJuContact) => {
    // building_dong은 DB에 추가된 컬럼이지만 types.ts 자동생성 전이므로 unknown 캐스트
    type ContactRow = Record<string, unknown>;
    const ownerPhones = getUniquePhones(updated.phone, updated.contact_owner);
    const mainPhone = ownerPhones[0] ?? "";
    const extraOwnerPhones = ownerPhones.slice(1).join("\n");

    if (updated.id) {
      const payload: ContactRow = {
        district: updated.district,
        dong: updated.dong,
        lot_number: updated.lot_number ?? "",
        building_name: updated.building_name ?? null,
        building_dong: updated.building_dong ?? null,
        unit_number: updated.unit_number ?? null,
        phone: mainPhone,
        contact_owner: extraOwnerPhones || null,
        contact_manager: updated.contact_manager?.trim() || null,
        contact_broker: updated.contact_broker?.trim() || null,
        memo: updated.memo ?? null,
        is_visible: updated.is_visible ?? true,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("cheongju_contacts").update(payload as any).eq("id", updated.id);
      if (error) { alert("수정 오류: " + error.message); return; }
    } else {
      const payload: ContactRow = {
        district: updated.district,
        dong: updated.dong,
        lot_number: updated.lot_number ?? "",
        building_name: updated.building_name ?? null,
        building_dong: updated.building_dong ?? null,
        unit_number: updated.unit_number ?? null,
        phone: mainPhone,
        contact_owner: extraOwnerPhones || null,
        contact_manager: updated.contact_manager?.trim() || null,
        contact_broker: updated.contact_broker?.trim() || null,
        memo: updated.memo ?? null,
        is_visible: updated.is_visible ?? true,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("cheongju_contacts").insert(payload as any);
      if (error) { alert("등록 오류: " + error.message); return; }
    }
    setContactModal(null);
    fetchContacts();
  };

  // ─── 연락처 노출 토글 ─────────────────────────────────────────────────────
  const [togglingContactId, setTogglingContactId] = useState<string | null>(null);
  const toggleContactVisible = async (c: CheongJuContact) => {
    setTogglingContactId(c.id);
    const newVisible = !c.is_visible;
    const { error } = await supabase.from("cheongju_contacts").update({ is_visible: newVisible }).eq("id", c.id);
    if (!error) setContacts((prev) => prev.map((x) => x.id === c.id ? { ...x, is_visible: newVisible } : x));
    else alert("상태 변경 오류: " + error.message);
    setTogglingContactId(null);
  };

  const deleteContact = async (c: CheongJuContact) => {
    if (!window.confirm(`'${c.dong} ${c.lot_number ?? ""}' 연락처를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    const { error } = await supabase.from("cheongju_contacts").delete().eq("id", c.id);
    if (error) { alert("삭제 오류: " + error.message); return; }
    setContacts((prev) => prev.filter((x) => x.id !== c.id));
  };

  const deletePost = (id: number) => setPosts((prev) => prev.filter((p) => p.id !== id));
  const togglePin = (id: number) => setPosts((prev) => prev.map((p) => p.id === id ? { ...p, pinned: !p.pinned } : p));

  // Stats
  const pendingCount = members.filter((m) => m.status === "pending").length;
  const approvedCount = members.filter((m) => m.status === "approved").length;
  const reportedPosts = posts.filter((p) => p.reported).length;
  // 매물: DB + static 합산
  const allProperties = [
    ...dbProperties,
    ...MAP_PROPERTIES.map((p) => ({ ...p, id: String(p.id), status: "active" as const, manage_fee: p.manageFee, available_from: p.availableFrom, total_floors: p.totalFloors, build_year: p.buildYear, building_name: p.buildingName, room_type: p.roomType, unit_number: p.unitNumber, building_memo: p.buildingMemo, room_memo: p.roomMemo, building_password: p.buildingPassword, room_password: p.roomPassword, vacate_date: p.vacateDate, checked_date: p.checkedDate, registered_date: p.registeredDate ?? "", is_new: p.isNew ?? false, is_hot: p.isHot ?? false, lat: p.lat, lng: p.lng, options: p.options ?? [], agent_name: p.agentName, created_at: "" })),
  ];

  const filteredMembers = members.filter((m) => {
    const mt = m.member_type ?? "대표중개사";
    const matchFilter =
      memberFilter === "all" || memberFilter === "all_status"
        ? true
        : memberFilter === "role_admin"
        ? m.role === "admin"
        : memberFilter === "role_user"
        ? m.role !== "admin"
        : memberFilter === "대표중개사" || memberFilter === "소속중개사" || memberFilter === "중개보조원" || memberFilter === "일반회원"
        ? mt === memberFilter
        : m.status === memberFilter;
    const q = memberSearch.toLowerCase();
    const matchSearch = !q
      || m.name.toLowerCase().includes(q)
      || (m.email ?? "").toLowerCase().includes(q)
      || m.phone.includes(q)
      || m.agency_name.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const filteredDbProperties = dbProperties.filter((p) => {
    // district 컬럼 우선, 없으면 address에서 구 이름 파싱
    const districtVal = p.district ?? "";
    const districtFromAddr = CHEONGJU_DISTRICTS.find(d => p.address.includes(d)) ?? "";
    const effectiveDistrict = districtVal || districtFromAddr;
    const matchDistrict = propertyDistrictFilter === "전체" || effectiveDistrict.includes(propertyDistrictFilter);
    const matchSearch = !propertySearch || p.title.includes(propertySearch) || p.address.includes(propertySearch) || p.agent_name.includes(propertySearch);
    return matchDistrict && matchSearch;
  });

  const filteredPosts = posts.filter((p) =>
    !postSearch || p.title.includes(postSearch) || p.author.includes(postSearch)
  );

  // 구별 카운트 메모이제이션 (1500+ 항목에서 매 렌더 filter 방지)
  const contactCounts = useMemo(() => {
    const m: Record<string, number> = { 전체: contacts.length };
    let visible = 0;
    for (const c of contacts) {
      const d = c.district || "";
      m[d] = (m[d] ?? 0) + 1;
      if (c.is_visible !== false) visible++;
    }
    return { ...m, __visible: visible, __hidden: contacts.length - visible };
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    const q = appliedContactSearch.trim();
    return contacts.filter((c) => {
      const matchDist = contactDistrictFilter === "전체" || c.district === contactDistrictFilter;
      if (!matchDist) return false;
      return contactMatchesSearch(c, q);
    });
  }, [contacts, contactDistrictFilter, appliedContactSearch]);

  useEffect(() => { setContactDisplayCount(200); }, [contactDistrictFilter, appliedContactSearch]);

  // 사이드바 내비 클릭 핸들러 (모바일에서 닫기 포함)
  const handleTabChange = (key: string) => {
    setTab(key);
    setSidebarOpen(false);
  };

  // 사이드바 공통 콘텐츠
  const SidebarContent = () => (
    <>
      <div
        className="px-5 py-4 border-b flex items-center justify-start gap-2 cursor-pointer hover:opacity-80 transition-opacity"
        style={{ borderColor: "hsl(var(--header-border))" }}
        onClick={() => { navigate("/"); setSidebarOpen(false); }}
        title="일반 페이지로 이동"
      >
        <img src={logoImg} alt="집다 로고" className="h-24 object-contain shrink-0" />
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap shrink-0"
          style={{ background: "hsl(var(--accent) / 0.18)", color: "hsl(var(--accent))" }}
        >
          관리자
        </span>
      </div>
      <nav className="flex flex-col gap-0.5 px-3 py-4 flex-1">
        {NAV.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left w-full"
            style={
              tab === key
                ? { background: "hsl(var(--accent) / 0.18)", color: "hsl(var(--accent))" }
                : { color: "rgba(255,255,255,0.65)" }
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
            {key === "members" && pendingCount > 0 && (
              <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: "hsl(var(--destructive))" }}>{pendingCount}</span>
            )}
            {key === "reports" && reports.filter((r) => r.status === "pending").length > 0 && (
              <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: "hsl(var(--destructive))" }}>{reports.filter((r) => r.status === "pending").length}</span>
            )}
            {key === "community" && reportedPosts > 0 && (
              <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: "hsl(var(--destructive))" }}>신고 {reportedPosts}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="px-3 py-4 border-t" style={{ borderColor: "hsl(var(--header-border))" }}>
        <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full transition-colors" style={{ color: "rgba(255,255,255,0.50)" }}>
          <LogOut className="w-4 h-4" />로그아웃
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex" style={{ background: "hsl(var(--background))" }}>
      {/* Modals */}
      {propertyModal && (
        <AdminPropertyFormModal
          initial={propertyModal.data}
          onClose={() => setPropertyModal(null)}
          onSaved={() => { setPropertyModal(null); fetchProperties(); }}
        />
      )}
      {contactModal !== null && (
        <ContactEditModal
          contact={contactModal === "new" ? null : contactModal as CheongJuContact}
          onClose={() => setContactModal(null)}
          onSave={saveContact}
        />
      )}

      {/* ── Mobile Sidebar Overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar (Desktop: sticky, Mobile: drawer) ── */}
      <aside
        className={`
          fixed md:sticky top-0 h-screen z-50 md:z-auto
          w-64 md:w-56 shrink-0 flex flex-col border-r overflow-y-auto
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
        style={{ background: "hsl(var(--header-bg))", borderColor: "hsl(var(--header-border))" }}
      >
        {/* 모바일 닫기 버튼 */}
        <button
          className="md:hidden absolute top-3 right-3 p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-4 h-4" />
        </button>
        <SidebarContent />
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <div className="sticky top-0 z-10 border-b px-4 md:px-6 py-3 flex items-center justify-between" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
          <div className="flex items-center gap-2">
            {/* 모바일 햄버거 버튼 */}
            <button
              className="md:hidden p-1.5 -ml-1 rounded-md hover:bg-muted/50 transition-colors"
              onClick={() => setSidebarOpen(true)}
              style={{ color: "hsl(var(--foreground))" }}
            >
              <Menu className="w-5 h-5" />
            </button>
            <ShieldCheck className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
            <h1 className="text-sm font-bold text-foreground">{NAV.find((n) => n.key === tab)?.label ?? "관리자"}</h1>
          </div>
          <span className="text-xs text-muted-foreground">관리자 계정</span>
        </div>

        <div className="p-6">

          {/* ── 대시보드 ── */}
          {tab === "dashboard" && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-xl font-extrabold text-foreground mb-1">안녕하세요, 관리자님 👋</h2>
                <p className="text-sm text-muted-foreground">집다 플랫폼 현황을 확인하세요.</p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { label: "전체 회원", value: members.length, sub: `승인 대기 ${pendingCount}건`, icon: Users, color: "hsl(var(--primary))" },
                  { label: "승인된 회원", value: approvedCount, sub: "활성 중개사", icon: CheckCircle2, color: "hsl(0 0% 0%)" },
                  { label: "등록 매물(DB)", value: dbProperties.length, sub: `노출종료 ${dbProperties.filter((p) => p.status === "hidden").length}건`, icon: Building2, color: "hsl(var(--accent))" },
                  { label: "매물 총 조회수", value: allProperties.reduce((s, p) => s + (p.views || 0), 0).toLocaleString(), sub: `평균 ${allProperties.length ? Math.round(allProperties.reduce((s, p) => s + (p.views || 0), 0) / allProperties.length).toLocaleString() : 0}회/건`, icon: Eye, color: "hsl(var(--chart-3))" },
                  { label: "커뮤니티 게시글", value: posts.length, sub: `신고 게시글 ${reportedPosts}건`, icon: MessageSquare, color: "hsl(var(--chart-4))" },
                ].map(({ label, value, sub, icon: Icon, color }) => (
                  <div key={label} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">{label}</span>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
                        <Icon className="w-4 h-4" style={{ color }} />
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-extrabold text-foreground">{value}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 실시간 접속수 */}
              <VisitorStatsWidget />



              {/* 승인 대기 */}
              <div className="bg-card border border-border rounded-xl">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" style={{ color: "hsl(var(--chart-4))" }} />승인 대기 회원
                  </h3>
                  <button className="text-xs font-medium" style={{ color: "hsl(var(--primary))" }} onClick={() => setTab("members")}>전체 보기 →</button>
                </div>
                <div className="divide-y divide-border">
                  {members.filter((m) => m.status === "pending").slice(0, 5).map((m) => (
                    <div key={m.id} className="px-5 py-3 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{m.name}</span>
                          <span className="text-xs text-muted-foreground">{m.agency_name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{m.email ?? m.phone} · 가입 {m.created_at.slice(0, 10)}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => updateMemberStatus(m.id, "approved")} disabled={updatingId === m.id} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-semibold" style={{ background: "hsl(0 0% 0% / 0.12)", color: "hsl(0 0% 0%)" }}>
                          <CheckCircle2 className="w-3 h-3" /> 승인
                        </button>
                        <button onClick={() => updateMemberStatus(m.id, "rejected")} disabled={updatingId === m.id} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-semibold" style={{ background: "hsl(var(--destructive) / 0.10)", color: "hsl(var(--destructive))" }}>
                          <XCircle className="w-3 h-3" /> 거절
                        </button>
                      </div>
                    </div>
                  ))}
                  {members.filter((m) => m.status === "pending").length === 0 && (
                    <div className="px-5 py-8 text-center text-sm text-muted-foreground">대기 중인 회원이 없습니다.</div>
                  )}
                </div>
              </div>

              {/* 인기 매물 */}
              <div className="bg-card border border-border rounded-xl">
                <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" style={{ color: "hsl(var(--accent))" }} />
                  <h3 className="text-sm font-bold text-foreground">인기 매물 TOP 5</h3>
                </div>
                <div className="divide-y divide-border">
                  {[...allProperties].sort((a, b) => b.views - a.views).slice(0, 5).map((p, i) => (
                    <div key={p.id} className="px-5 py-3 flex items-center gap-4">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={i === 0 ? { background: "hsl(var(--accent))", color: "#fff" } : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{p.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{p.address}</div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Eye className="w-3 h-3" />{p.views.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 회원 관리 ── */}
          {tab === "members" && (() => {
            const MEMBER_TYPE_LABELS: Record<string, { label: string; color: string; bg: string; emoji: string; Icon: typeof Gem }> = {
              "대표중개사": { label: "대표중개사", color: "hsl(var(--primary))", bg: "hsl(var(--primary) / 0.10)", emoji: "💎", Icon: Gem },
              "소속중개사": { label: "소속중개사", color: "hsl(0 0% 0%)", bg: "hsl(0 0% 0% / 0.12)", emoji: "✅", Icon: BadgeCheck },
              "중개보조원": { label: "중개보조원", color: "hsl(var(--chart-4))", bg: "hsl(var(--chart-4) / 0.12)", emoji: "🧑", Icon: UserCog },
              "일반회원": { label: "일반회원", color: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted))", emoji: "👤", Icon: Users },
            };
            // 대표중개사 목록 (parent 선택용)
            const mainAgents = members.filter(m => (m.member_type ?? "대표중개사") === "대표중개사" && m.role !== "admin");

            return (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-foreground">회원 관리</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    총 {members.length}명 · 관리자 {members.filter(m => m.role === "admin").length}명
                    · 대표 {members.filter(m => (m.member_type ?? "대표중개사") === "대표중개사" && m.role !== "admin").length}명
                    · 소속 {members.filter(m => m.member_type === "소속중개사").length}명
                    · 보조원 {members.filter(m => m.member_type === "중개보조원").length}명
                    · 일반 {members.filter(m => m.member_type === "일반회원").length}명
                    · 승인대기 {pendingCount}명
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* 등급 필터 */}
                  <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/20 p-1">
                    {[
                      { key: "all", label: "전체", Icon: Users },
                      { key: "role_admin", label: "관리자", Icon: ShieldCheck },
                      { key: "대표중개사", label: "대표", Icon: Gem },
                      { key: "소속중개사", label: "소속", Icon: BadgeCheck },
                      { key: "중개보조원", label: "보조원", Icon: UserCog },
                      { key: "일반회원", label: "일반", Icon: Users },
                    ].map((f) => {
                      const active = memberFilter === f.key;
                      const FIcon = f.Icon;
                      return (
                        <button key={f.key} onClick={() => setMemberFilter(f.key)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all inline-flex items-center gap-1"
                          style={active
                            ? { background: "hsl(var(--primary))", color: "#fff" }
                            : { color: "hsl(var(--muted-foreground))" }
                          }>
                          <FIcon className="w-3.5 h-3.5" />
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                  {/* 상태 필터 */}
                  <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/20 p-1">
                    {[
                      { key: "all_status", label: "전체상태" },
                      { key: "pending", label: "대기중" },
                      { key: "approved", label: "승인됨" },
                      { key: "rejected", label: "거절됨" },
                    ].map((f) => (
                      <button key={f.key} onClick={() => setMemberFilter(f.key)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                        style={memberFilter === f.key
                          ? { background: "hsl(var(--primary))", color: "#fff" }
                          : { color: "hsl(var(--muted-foreground))" }
                        }>{f.label}</button>
                    ))}
                  </div>
                  {/* 부동산별 그룹 토글 */}
                  <button
                    onClick={() => setMemberGroupByAgency((v) => !v)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all border inline-flex items-center gap-1"
                    style={memberGroupByAgency
                      ? { background: "hsl(var(--primary))", color: "#fff", borderColor: "hsl(var(--primary))" }
                      : { color: "hsl(var(--primary))", borderColor: "hsl(var(--primary) / 0.4)", background: "hsl(var(--primary) / 0.06)" }
                    }
                    title="부동산(사무소)별로 그룹화"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    부동산별 보기
                  </button>
                   <div className="relative">
                     <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                     <Input placeholder="이름·이메일·전화·사무소 검색" className="pl-7 h-8 text-xs w-52" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} />
                   </div>
                  <button onClick={fetchMembers} disabled={membersLoading} className="p-1.5 rounded-md transition-colors hover:bg-muted/50" style={{ color: "hsl(var(--muted-foreground))" }}>
                    <RefreshCw className={`w-3.5 h-3.5 ${membersLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>
              {membersError && (
                <div className="flex items-center gap-2 rounded-xl p-3.5 text-sm" style={{ background: "hsl(var(--destructive) / 0.08)", color: "hsl(var(--destructive))" }}>
                  <AlertCircle className="w-4 h-4 shrink-0" />{membersError}
                </div>
              )}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="hidden md:grid grid-cols-[1fr_1fr_90px_100px_80px_130px] text-xs font-semibold text-muted-foreground bg-muted/40 px-5 py-3 border-b border-border">
                  <span>이름 / 사무소</span><span>이메일 / 전화</span>
                  <span className="text-center">등급(역할)</span>
                  <span className="text-center">멤버 유형</span>
                  <span className="text-center">상태</span>
                  <span className="text-center">관리</span>
                </div>
                {membersLoading && <div className="py-16 text-center text-sm text-muted-foreground">불러오는 중...</div>}
                {!membersLoading && filteredMembers.length === 0 && <div className="py-16 text-center text-sm text-muted-foreground">해당 조건의 회원이 없습니다.</div>}
                {!membersLoading && (() => {
                  // 부동산별 그룹 보기일 때, 공인중개사 등록번호(license_number) 기준으로 그룹화
                  let displayList: Array<{ kind: "header"; groupKey: string; license: string; agency: string; count: number; rep: AgentProfile | null; approved: number; pending: number; collapsed: boolean } | { kind: "row"; member: AgentProfile }> = [];
                  if (memberGroupByAgency) {
                    const groups = new Map<string, AgentProfile[]>();
                    filteredMembers.forEach((m) => {
                      const raw = (m.license_number || "").trim();
                      const key = raw ? formatLicenseNumber(raw) : "(등록번호 미지정)";
                      if (!groups.has(key)) groups.set(key, []);
                      groups.get(key)!.push(m);
                    });
                    const sortedGroups = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], "ko"));
                    sortedGroups.forEach(([license, list]) => {
                      const sortedList = [...list].sort((a, b) => {
                        const order = (x: AgentProfile) => x.role === "admin" ? 0 : (x.member_type ?? "대표중개사") === "대표중개사" ? 1 : x.member_type === "소속중개사" ? 2 : x.member_type === "중개보조원" ? 3 : 4;
                        return order(a) - order(b);
                      });
                      const collapsed = !!collapsedAgencies[license];
                      const rep = sortedList.find(x => (x.member_type ?? "대표중개사") === "대표중개사") ?? null;
                      const agencyName = (rep?.agency_name || sortedList[0]?.agency_name || "(사무소 미지정)").trim();
                      displayList.push({
                        kind: "header",
                        groupKey: license,
                        license,
                        agency: agencyName,
                        count: sortedList.length,
                        rep,
                        approved: sortedList.filter(x => x.status === "approved").length,
                        pending: sortedList.filter(x => x.status === "pending").length,
                        collapsed,
                      });
                      if (!collapsed) sortedList.forEach((m) => displayList.push({ kind: "row", member: m }));
                    });
                  } else {
                    displayList = filteredMembers.map((m) => ({ kind: "row" as const, member: m }));
                  }

                  return displayList.map((item, idx) => {
                    if (item.kind === "header") {
                      return (
                        <button
                          key={`hdr-${item.groupKey}`}
                          type="button"
                          onClick={() => setCollapsedAgencies((p) => ({ ...p, [item.groupKey]: !p[item.groupKey] }))}
                          className="w-full flex items-center justify-between px-5 py-2.5 border-b border-border hover:bg-muted/30 transition-colors"
                          style={{ background: "hsl(var(--primary) / 0.06)" }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {item.collapsed ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />}
                            <Building2 className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} />
                            <span className="text-sm font-bold text-foreground truncate">{item.agency}</span>
                            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded" style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
                              등록번호 {item.license}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
                              {item.count}명
                            </span>
                            {item.rep && (
                              <span className="text-[10px] text-muted-foreground hidden md:inline">대표: {item.rep.name} · {item.rep.phone}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-medium">
                            <span style={{ color: "hsl(0 0% 0%)" }}>승인 {item.approved}</span>
                            <span style={{ color: "hsl(var(--chart-4))" }}>대기 {item.pending}</span>
                          </div>
                        </button>
                      );
                    }
                    const m = item.member;
                    const mt = (m.member_type ?? "대표중개사") as MemberType;
                    const mtStyle = MEMBER_TYPE_LABELS[mt] ?? MEMBER_TYPE_LABELS["대표중개사"];
                    const parentAgent = m.parent_user_id ? members.find(x => x.user_id === m.parent_user_id) : null;
                    // 이 사람의 하위 회원들
                    const subMembers = members.filter(x => x.parent_user_id === m.user_id);

                  return (
                    <div key={m.id} className={`border-b border-border last:border-0 ${expandedMember === m.id ? "bg-muted/20" : ""} ${!m.is_active ? "opacity-60" : ""}`}>
                      <div className="grid md:grid-cols-[1fr_1fr_90px_100px_80px_130px] items-center px-5 py-3.5 cursor-pointer hover:bg-muted/20 transition-colors"
                        onClick={() => setExpandedMember(expandedMember === m.id ? null : m.id)}>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-foreground">{m.name}</span>
                            {!m.is_active && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "hsl(var(--destructive) / 0.12)", color: "hsl(var(--destructive))" }}>접속차단</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{m.agency_name}</div>
                          {subMembers.length > 0 && (
                            <div className="text-[10px] mt-0.5" style={{ color: "hsl(0 0% 0%)" }}>하위 {subMembers.length}명</div>
                           )}
                           <div className="mt-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                             <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "hsl(var(--accent) / 0.10)", color: "hsl(var(--accent))" }} title="접속 허용 IP (PC/모바일 공통, 1개). 비우면 제한 없음.">
                               <Globe className="w-3 h-3" />
                               허용 IP
                             </span>
                             <Input
                               defaultValue={m.allowed_pc_ip ?? ""}
                               placeholder="예: 211.234.56.78"
                               className="h-6 px-2 py-0 text-[11px] font-mono w-[140px]"
                               onBlur={(e) => {
                                 const v = e.target.value.trim();
                                 if ((m.allowed_pc_ip ?? "") !== v) updateAllowedPcIp(m, v);
                               }}
                               onKeyDown={(e) => {
                                 if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                               }}
                             />
                             {m.allowed_pc_ip && (
                               <button
                                 type="button"
                                 onClick={() => updateAllowedPcIp(m, "")}
                                 className="text-[10px] px-1.5 py-0.5 rounded"
                                 style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
                                 title="IP 제한 해제"
                               >
                                 해제
                               </button>
                             )}
                           </div>
                         </div>
                         <div className="md:block">
                           <div className="text-xs font-medium text-foreground flex items-center gap-1 hidden md:flex">
                             <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>ID</span>
                             {m.email ?? "-"}
                           </div>
                            <div className="text-xs text-muted-foreground hidden md:block">{m.phone}</div>
                            <div className="text-[10px] mt-0.5 inline-flex items-center gap-1 font-semibold" style={{ color: m.last_sign_in_at ? "hsl(0 0% 0%)" : "hsl(var(--muted-foreground))" }}>
                              <Clock className="w-3 h-3" />
                              마지막 접속 일: {m.last_sign_in_at ? new Date(m.last_sign_in_at).toLocaleString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "기록 없음"}
                            </div>
                           {parentAgent && (
                             <div className="text-[10px] mt-0.5 inline-flex items-center gap-1 font-semibold hidden md:inline-flex" style={{ color: "hsl(0 0% 0%)" }}>
                               <Building2 className="w-3 h-3" />
                               상위: {(parentAgent.agency_name || "").trim() || "(사무소 미지정)"} ({(parentAgent.name || "").trim() || "-"})
                             </div>
                           )}
                           {(activeSessions[m.user_id] ?? []).length > 0 ? (
                             <div className="flex flex-wrap gap-1 mt-1">
                               {activeSessions[m.user_id].map((s) => {
                                 const DIcon = s.device_type === "mobile" ? Smartphone : Monitor;
                                 const last = s.last_seen_at ? new Date(s.last_seen_at).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
                                 return (
                                   <span
                                     key={s.device_type}
                                     className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border"
                                     style={{
                                       background: "hsl(var(--primary) / 0.10)",
                                       color: "hsl(var(--primary))",
                                       borderColor: "hsl(var(--primary) / 0.25)",
                                     }}
                                     title={`마지막 접속: ${last}`}
                                   >
                                     <DIcon className="w-3 h-3" />
                                     {s.device_type === "mobile" ? "모바일" : "PC"}
                                     <Globe className="w-2.5 h-2.5 opacity-70" />
                                     <span className="font-mono">{s.ip_address || "IP 미확인"}</span>
                                     {s.ip_address && (
                                       <button
                                         type="button"
                                         onClick={(e) => { e.stopPropagation(); updateAllowedPcIp(m, s.ip_address!); }}
                                         className="ml-1 px-1 rounded text-[9px] font-bold"
                                         style={{ background: "hsl(var(--accent) / 0.15)", color: "hsl(var(--accent))" }}
                                         title="이 IP만 허용으로 등록"
                                       >
                                         허용
                                       </button>
                                     )}
                                     {last && <span className="opacity-60 font-normal">· {last}</span>}
                                   </span>
                                 );
                               })}
                             </div>
                           ) : (
                             <div className="mt-1 text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
                               <Globe className="w-2.5 h-2.5" />
                               미접속(로그인 기록 없음)
                             </div>
                           )}
                         </div>
                        {/* 역할 배지 */}
                        <div className="hidden md:flex justify-center">
                          {m.role === "admin" ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "hsl(var(--accent) / 0.15)", color: "hsl(var(--accent))" }}>🛡관리자</span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "hsl(var(--primary) / 0.10)", color: "hsl(var(--primary))" }}>👤중개사</span>
                          )}
                        </div>
                        {/* 멤버 유형 배지 */}
                        <div className="hidden md:flex justify-center">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: mtStyle.bg, color: mtStyle.color }}>
                            <mtStyle.Icon className="w-3 h-3" />
                            {mtStyle.label}
                          </span>
                        </div>
                        {/* 승인 상태 */}
                        <div className="hidden md:flex justify-center">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: STATUS_LABEL[m.status].bg, color: STATUS_LABEL[m.status].color }}>
                            {STATUS_LABEL[m.status].label}
                          </span>
                        </div>
                        {/* 액션 버튼 (데스크톱) */}
                        <div className="hidden md:flex justify-center items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {m.status !== "approved" && (
                            <button onClick={() => updateMemberStatus(m.id, "approved")} className="p-1.5 rounded-md" title="승인" style={{ color: "hsl(0 0% 0%)" }}>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {m.status !== "rejected" && (
                            <button onClick={() => updateMemberStatus(m.id, "rejected")} className="p-1.5 rounded-md" title="거절" style={{ color: "hsl(var(--destructive))" }}>
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => toggleIsActive(m)} className="p-1.5 rounded-md" title={m.is_active ? "접속 차단" : "접속 허용"} style={{ color: m.is_active ? "hsl(var(--chart-4))" : "hsl(0 0% 0%)" }}>
                            {m.is_active ? <Ban className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => deleteMember(m)} className="p-1.5 rounded-md" title="삭제" style={{ color: "hsl(var(--destructive))" }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {expandedMember === m.id ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                        </div>
                        {/* 모바일 전용 상태/액션 */}
                        <div className="md:hidden mt-2 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: STATUS_LABEL[m.status].bg, color: STATUS_LABEL[m.status].color }}>
                            {STATUS_LABEL[m.status].label}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: mtStyle.bg, color: mtStyle.color }}>
                            <mtStyle.Icon className="w-3 h-3" />{mtStyle.label}
                          </span>
                          {m.role === "admin" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "hsl(var(--accent) / 0.15)", color: "hsl(var(--accent))" }}>🛡관리자</span>
                          )}
                          <div className="ml-auto flex items-center gap-1">
                            {m.status !== "approved" && (
                              <button onClick={() => updateMemberStatus(m.id, "approved")} className="p-1.5 rounded-md bg-muted/30" title="승인" style={{ color: "hsl(0 0% 0%)" }}>
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}
                            {m.status !== "rejected" && (
                              <button onClick={() => updateMemberStatus(m.id, "rejected")} className="p-1.5 rounded-md bg-muted/30" title="거절" style={{ color: "hsl(var(--destructive))" }}>
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={() => toggleIsActive(m)} className="p-1.5 rounded-md bg-muted/30" title={m.is_active ? "접속 차단" : "접속 허용"} style={{ color: m.is_active ? "hsl(var(--chart-4))" : "hsl(0 0% 0%)" }}>
                              {m.is_active ? <Ban className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            </button>
                            <button onClick={() => deleteMember(m)} className="p-1.5 rounded-md bg-muted/30" title="삭제" style={{ color: "hsl(var(--destructive))" }}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 확장 패널 */}
                      {expandedMember === m.id && (
                        <div className="mx-5 mb-4 rounded-xl p-4 flex flex-col gap-4 border" onClick={(e) => e.stopPropagation()} style={{ background: "hsl(var(--muted) / 0.4)", borderColor: "hsl(var(--border))" }}>
                           {/* 기본 정보 (수정 가능) */}
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-foreground flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5" /> 회원 정보 수정</p>
                              {memberEditData[m.id] && Object.keys(memberEditData[m.id]).length > 0 && (
                                <button
                                  onClick={() => saveMemberProfile(m)}
                                  disabled={memberSaving === m.id}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-60"
                                  style={{ background: "hsl(var(--primary))", color: "#fff" }}
                                >
                                  {memberSaving === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                  저장
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                              {([
                                { label: "이름", field: "name" as const },
                                { label: "사무소명", field: "agency_name" as const },
                                { label: "대표자명", field: "representative_name" as const },
                                { label: "공인중개사 등록번호", field: "license_number" as const },
                                { label: "사업자 등록번호", field: "business_number" as const },
                                { label: "사무소 주소", field: "agency_address" as const },
                                { label: "전화번호 (개인)", field: "phone" as const },
                                { label: "사무소 전화번호", field: "agency_phone" as const },
                              ]).map(({ label, field }) => (
                                <div key={field} className="flex flex-col gap-0.5">
                                  <label className="text-[11px] text-muted-foreground font-medium">{label}</label>
                                  <input
                                    type="text"
                                    value={String(getMemberEditValue(m, field))}
                                    onChange={e => {
                                      const raw = e.target.value;
                                      const v = field === "license_number" ? formatLicenseNumber(raw)
                                        : (field === "phone" || field === "agency_phone") ? formatPhone(raw)
                                        : raw;
                                      setMemberEditField(m.id, field, v);
                                    }}
                                    inputMode={field === "license_number" || field === "business_number" ? "numeric" : undefined}
                                    maxLength={field === "license_number" ? 16 : undefined}
                                    className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:border-primary"
                                  />
                                </div>
                              ))}
                              <div className="flex flex-col gap-0.5">
                                <label className="text-[11px] text-muted-foreground font-medium">가입일</label>
                                <div className="h-8 rounded-lg border border-border bg-muted/30 px-2 flex items-center text-xs text-muted-foreground">{m.created_at.slice(0, 10)}</div>
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <label className="text-[11px] text-muted-foreground font-medium">접속 상태</label>
                                <div className="h-8 rounded-lg border border-border bg-muted/30 px-2 flex items-center text-xs text-foreground">{m.is_active !== false ? "✅ 허용" : "🚫 차단"}</div>
                              </div>
                            </div>
                          </div>

                           {/* ── 아이디 / 비밀번호 관리 ── */}
                           <div className="pt-3 border-t border-border flex flex-col gap-3">
                             <p className="text-xs font-bold text-foreground flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> 계정 아이디 / 비밀번호</p>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                               {/* 아이디(이메일) */}
                               <div className="flex flex-col gap-1">
                                 <label className="text-[11px] text-muted-foreground font-medium">아이디 (이메일)</label>
                                 <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                                   style={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}>
                                   <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>ID</span>
                                   <span className="text-foreground select-all">{m.email ?? "-"}</span>
                                   {m.email && (
                                     <button
                                       onClick={() => { navigator.clipboard.writeText(m.email ?? ""); }}
                                       className="ml-auto p-1 rounded hover:bg-muted/50 text-muted-foreground"
                                       title="복사"
                                     >
                                       <Copy className="w-3 h-3" />
                                     </button>
                                   )}
                                 </div>
                               </div>
                               {/* 비밀번호 변경 */}
                               <div className="flex flex-col gap-1">
                                 <label className="text-[11px] text-muted-foreground font-medium">비밀번호 변경 (관리자 설정)</label>
                                 <div className="flex items-center gap-2">
                                   <div className="relative flex-1">
                                     <input
                                       type={pwVisible[m.id] ? "text" : "password"}
                                       placeholder="새 비밀번호 6자 이상"
                                       value={pwInputs[m.id] ?? ""}
                                       onChange={(e) => setPwInputs((p) => ({ ...p, [m.id]: e.target.value }))}
                                       className="w-full h-9 rounded-lg border border-input bg-background px-3 pr-9 text-xs focus:outline-none text-foreground"
                                       onKeyDown={(e) => e.key === "Enter" && setMemberPassword(m)}
                                     />
                                     <button
                                       type="button"
                                       onClick={() => setPwVisible((p) => ({ ...p, [m.id]: !p[m.id] }))}
                                       className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                                     >
                                       {pwVisible[m.id] ? <EyeOffIcon className="w-3.5 h-3.5" /> : <EyeIcon className="w-3.5 h-3.5" />}
                                     </button>
                                   </div>
                                   <button
                                     onClick={() => setMemberPassword(m)}
                                     disabled={pwSaving === m.id || !(pwInputs[m.id]?.length >= 6)}
                                     className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1 disabled:opacity-50 shrink-0"
                                     style={{ background: "hsl(var(--primary))", color: "#fff" }}
                                   >
                                     {pwSaving === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                     변경
                                   </button>
                                 </div>
                               </div>
                             </div>
                           </div>


                          {/* ── 등급 변경 (역할 + 멤버 유형 통합) ── */}
                          <div className="pt-3 border-t border-border flex flex-col gap-3">
                            <p className="text-xs font-bold text-foreground">🎖 등급 변경</p>

                            {/* 역할 변경: 관리자 ↔ 중개사 */}
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[11px] text-muted-foreground font-medium">시스템 역할</span>
                              <div className="flex gap-2">
                                {[
                                  { value: "admin" as const, label: "🛡 관리자", color: "hsl(var(--accent))", bg: "hsl(var(--accent) / 0.15)" },
                                   { value: "user" as const, label: "👤 사용자", color: "hsl(var(--primary))", bg: "hsl(var(--primary) / 0.12)" },
                                ].map((r) => (
                                  <button
                                    key={r.value}
                                    disabled={roleChangingId === m.id}
                                    onClick={() => updateMemberRole(m, r.value)}
                                    className="px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-1 disabled:opacity-60"
                                    style={m.role === r.value
                                      ? { background: r.bg, color: r.color, borderColor: r.color }
                                      : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                                    }
                                  >
                                    {roleChangingId === m.id && m.role !== r.value ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : null}
                                    {r.label}
                                    {m.role === r.value && <span className="text-[9px] opacity-70 ml-0.5">현재</span>}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* 멤버 유형 변경 (관리자가 아닐 때만) */}
                            {m.role !== "admin" && (
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] text-muted-foreground font-medium">회원 유형</span>
                                <div className="flex gap-2 flex-wrap">
                                  {(["대표중개사", "소속중개사", "중개보조원", "일반회원"] as MemberType[]).map((t) => {
                                    const TypeIcon = MEMBER_TYPE_LABELS[t].Icon;
                                    return (
                                      <button key={t}
                                        onClick={() => updateMemberType(m.id, t)}
                                        className="px-3 py-2 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5"
                                        style={mt === t
                                          ? { background: MEMBER_TYPE_LABELS[t].bg, color: MEMBER_TYPE_LABELS[t].color, borderColor: MEMBER_TYPE_LABELS[t].color }
                                          : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                                        }
                                      >
                                        <TypeIcon className="w-3.5 h-3.5" />
                                        {t}
                                        {mt === t && <span className="text-[9px] opacity-70">현재</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 상위 부동산 연결 (소속/보조원만) */}
                          {m.role !== "admin" && (mt === "소속중개사" || mt === "중개보조원") && (
                            <div className="flex flex-col gap-2 pt-3 border-t border-border">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <p className="text-xs font-bold text-foreground">🏢 상위(대표) 부동산 연결</p>
                                <div className="text-[11px] font-semibold inline-flex items-center gap-1 px-2 py-1 rounded-md"
                                  style={{ background: parentAgent ? "hsl(0 0% 0% / 0.12)" : "hsl(var(--muted))", color: parentAgent ? "hsl(0 0% 0%)" : "hsl(var(--muted-foreground))" }}>
                                  <Building2 className="w-3 h-3" />
                                  현재 연결: {parentAgent
                                    ? `${(parentAgent.agency_name || "").trim() || "(사무소 미지정)"} (${(parentAgent.name || "").trim() || "-"})`
                                    : "없음"}
                                </div>
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                <button
                                  onClick={() => updateParent(m.id, null)}
                                  className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                                  style={!m.parent_user_id
                                    ? { background: "hsl(var(--muted-foreground))", color: "#fff", borderColor: "transparent" }
                                    : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                                  }
                                >없음</button>
                                {mainAgents.filter(a => a.id !== m.id).map((a) => {
                                  const agencyLabel = (a.agency_name || "").trim() || "(사무소 미지정)";
                                  const nameLabel = (a.name || "").trim() || "(이름 미지정)";
                                  const isSelected = m.parent_user_id === a.user_id;
                                  return (
                                    <button key={a.id}
                                      onClick={() => updateParent(m.id, a.user_id)}
                                      className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5"
                                      style={isSelected
                                        ? { background: "hsl(0 0% 0%)", color: "#ffffff", borderColor: "hsl(0 0% 0%)" }
                                        : { borderColor: "hsl(var(--primary) / 0.3)", color: "hsl(var(--foreground))", background: "hsl(var(--card))" }
                                      }
                                    >
                                      <Building2 className="w-3.5 h-3.5" style={{ color: isSelected ? "#ffffff" : "hsl(var(--primary))" }} />
                                      <span style={{ color: isSelected ? "#ffffff" : "hsl(var(--foreground))" }}>
                                        {agencyLabel} <span style={{ opacity: 0.7 }}>({nameLabel})</span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* 하위 회원 목록 */}
                          {subMembers.length > 0 && (
                            <div className="flex flex-col gap-2 pt-3 border-t border-border">
                              <p className="text-xs font-bold text-foreground">소속 하위 회원 ({subMembers.length}명)</p>
                              <div className="flex flex-col gap-1">
                                {subMembers.map((s) => {
                                  const sType = s.member_type ?? "소속중개사";
                                  const sStyle = MEMBER_TYPE_LABELS[sType] ?? MEMBER_TYPE_LABELS["소속중개사"];
                                  const SIcon = sStyle.Icon;
                                  return (
                                    <div key={s.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-xs" style={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}>
                                      <div className="flex items-center gap-2">
                                        <SIcon className="w-3.5 h-3.5" style={{ color: sStyle.color }} />
                                        <span className="font-medium text-foreground">{s.name}</span>
                                        <span className="text-muted-foreground">{s.agency_name}</span>
                                        <span style={{ color: sStyle.color }}>{sType}</span>
                                      </div>
                                      <button onClick={() => deleteMember(s)} className="p-1 rounded" title="삭제" style={{ color: "hsl(var(--destructive))" }}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* 액션 버튼 */}
                          <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                            {m.status !== "approved" && (
                              <button onClick={() => updateMemberStatus(m.id, "approved")} className="flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold text-xs" style={{ background: "hsl(0 0% 0% / 0.15)", color: "hsl(0 0% 0%)" }}>
                                <CheckCircle2 className="w-3.5 h-3.5" /> 승인하기
                              </button>
                            )}
                            {m.status !== "rejected" && (
                              <button onClick={() => updateMemberStatus(m.id, "rejected")} className="flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold text-xs" style={{ background: "hsl(var(--destructive) / 0.10)", color: "hsl(var(--destructive))" }}>
                                <XCircle className="w-3.5 h-3.5" /> 거절하기
                              </button>
                            )}
                            <button onClick={() => toggleIsActive(m)} className="flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold text-xs"
                              style={m.is_active !== false
                                ? { background: "hsl(var(--destructive) / 0.10)", color: "hsl(var(--destructive))" }
                                : { background: "hsl(0 0% 0% / 0.15)", color: "hsl(0 0% 0%)" }
                              }>
                              {m.is_active !== false ? <><Ban className="w-3.5 h-3.5" /> 접속 차단</> : <><Unlock className="w-3.5 h-3.5" /> 접속 허용</>}
                            </button>
                            <button onClick={() => deleteMember(m)} className="flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold text-xs ml-auto" style={{ background: "hsl(var(--destructive) / 0.10)", color: "hsl(var(--destructive))" }}>
                              <Trash2 className="w-3.5 h-3.5" /> 계정 삭제
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
                })()}
              </div>
            </div>
            );
          })()}
          {/* ── 매물 관리 ── */}
          {tab === "properties" && (() => {
            // 같은 주소 기준으로 건물 그룹핑
            const buildingGroups = filteredDbProperties.reduce<Record<string, DBProperty[]>>((acc, p) => {
              const key = (p.building_name && p.building_name.trim()) ? `${p.address}__${p.building_name}` : p.address;
              if (!acc[key]) acc[key] = [];
              acc[key].push(p);
              return acc;
            }, {});
            const groupEntries = Object.entries(buildingGroups);

            return (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-foreground">매물 관리</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    건물 {groupEntries.length}개 · 총 {dbProperties.length}호 · 노출종료 {dbProperties.filter((p) => p.status === "hidden").length}호
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                    <Input placeholder="매물명·주소·중개사 검색" className="pl-7 h-8 text-xs w-52" value={propertySearch} onChange={(e) => setPropertySearch(e.target.value)} />
                  </div>
                  <button onClick={fetchProperties} disabled={propertiesLoading} className="p-1.5 rounded-md hover:bg-muted/50" style={{ color: "hsl(var(--muted-foreground))" }}>
                    <RefreshCw className={`w-3.5 h-3.5 ${propertiesLoading ? "animate-spin" : ""}`} />
                  </button>
                  <Button size="sm" onClick={() => setPropertyModal({ mode: "add", data: null })}>
                    <Plus className="w-3.5 h-3.5 mr-1" />매물 등록
                  </Button>
                </div>
              </div>

              {/* 구별 탭 필터 */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {DISTRICT_FILTER_TABS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setPropertyDistrictFilter(d)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                    style={propertyDistrictFilter === d
                      ? { background: "hsl(var(--primary))", color: "#fff", borderColor: "hsl(var(--primary))" }
                      : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                    }
                  >
                    {d}
                    {d !== "전체" && (
                      <span className="ml-1 opacity-70">
                        ({dbProperties.filter(p => {
                          const dv = p.district ?? "";
                          const da = CHEONGJU_DISTRICTS.find(x => p.address.includes(x)) ?? "";
                          return (dv || da).includes(d);
                        }).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {propertiesLoading && <div className="py-16 text-center text-sm text-muted-foreground">불러오는 중...</div>}
              {!propertiesLoading && filteredDbProperties.length === 0 && (
                <div className="bg-card border border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
                  등록된 매물이 없습니다.
                  <div className="mt-3">
                    <Button size="sm" variant="outline" onClick={() => setPropertyModal({ mode: "add", data: null })}>
                      <Plus className="w-3.5 h-3.5 mr-1" />첫 매물 등록하기
                    </Button>
                  </div>
                </div>
              )}

              {/* 건물별 그룹 */}
              {!propertiesLoading && groupEntries.map(([groupKey, units]) => {
                const rep = units[0]; // 대표 매물 (첫 번째)
                const hasImages = units.some(u => (u.images ?? []).length > 0);
                const repImage = units.flatMap(u => u.images ?? []).find(Boolean);

                return (
                  <BuildingGroup
                    key={groupKey}
                    rep={rep}
                    units={units}
                    repImage={repImage}
                    hasImages={hasImages}
                    togglingId={togglingId}
                    onEdit={(p) => setPropertyModal({ mode: "edit", data: p })}
                    onAddUnit={(p) => {
                      const { id: _id, created_at: _ca, ...rest } = p;
                      setPropertyModal({
                        mode: "add",
                        data: {
                          ...rest,
                          unit_number: "",
                          floor: "",
                          deposit: "",
                          monthly: "",
                          room_password: "",
                          room_memo: "",
                          vacate_date: "",
                          note: "",
                          status: "active",
                          registered_date: new Date().toISOString().slice(0, 10),
                          checked_date: "",
                          views: 0,
                        },
                      });
                    }}
                    onToggleStatus={togglePropertyStatus}
                    onDelete={deleteProperty}
                  />
                );
              })}
              {/* ── 임의 등록 매물 섹션 ── */}
              {(() => {
                const visibleMocks = MAP_PROPERTIES.filter(p => !hiddenMockIds.has(p.id));
                if (visibleMocks.length === 0 && hiddenMockIds.size === 0) return null;
                return (
                  <div className="flex flex-col gap-3 mt-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-foreground">임의 등록 매물</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          코드에 포함된 샘플 데이터 · {visibleMocks.length}개 노출 · {hiddenMockIds.size}개 숨김
                        </p>
                      </div>
                      {hiddenMockIds.size > 0 && (
                        <button
                          onClick={() => { if (window.confirm("숨긴 임의 매물을 모두 복원하시겠습니까?")) restoreAllMocks(); }}
                          className="text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors"
                          style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
                        >
                          전체 복원 ({hiddenMockIds.size})
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {visibleMocks.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted/20 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-border bg-muted flex items-center justify-center">
                            {p.image ? (
                              <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
                            ) : (
                              <Building2 className="w-5 h-5 text-muted-foreground/40" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-foreground truncate">{p.title}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
                                샘플
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{p.address} · {p.type} · {p.deposit}/{p.monthly}</div>
                          </div>
                          <button
                            onClick={() => deleteMockProperty(p.id, p.title)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full font-semibold shrink-0"
                            style={{ background: "hsl(var(--destructive) / 0.15)", color: "hsl(var(--destructive))" }}
                            title="숨기기"
                          >
                            <Trash2 className="w-3 h-3" />삭제
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
            );
          })()}

          {/* ── 청주 연락처 관리 ── */}
          {tab === "contacts" && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                 <div>
                  <h2 className="text-lg font-extrabold text-foreground">청주시 지역별 연락처</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    총 {contacts.length}개 · 노출 {contactCounts.__visible}개 · 노출불가 {contactCounts.__hidden}개
                    {" · "}
                    {CHEONGJU_DISTRICTS.map((d, i) => (
                      <span key={d}>
                        {i > 0 && " · "}
                        {d} {contactCounts[d] ?? 0}개
                      </span>
                    ))}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex gap-1 flex-wrap">
                    {["전체", ...CHEONGJU_DISTRICTS].map((d) => {
                      const cnt = d === "전체" ? contacts.length : (contactCounts[d] ?? 0);
                      return (
                        <button key={d} onClick={() => setContactDistrictFilter(d)}
                          className="px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                          style={contactDistrictFilter === d
                            ? { background: "hsl(var(--primary))", color: "#fff", borderColor: "hsl(var(--primary))" }
                            : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                          }>{d} {cnt}</button>
                      );
                    })}
                  </div>
                  <div className="relative flex items-center gap-1">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input
                        placeholder="동·번지수·전화번호 검색"
                        className="pl-7 h-8 text-xs w-52"
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setAppliedContactSearch(contactSearch);
                        }}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs"
                      onClick={() => setAppliedContactSearch(contactSearch)}
                    >
                      검색
                    </Button>
                    {appliedContactSearch && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        onClick={() => { setContactSearch(""); setAppliedContactSearch(""); }}
                      >
                        초기화
                      </Button>
                    )}
                  </div>
                  <button onClick={fetchContacts} disabled={contactsLoading} className="p-1.5 rounded-md hover:bg-muted/50" style={{ color: "hsl(var(--muted-foreground))" }}>
                    <RefreshCw className={`w-3.5 h-3.5 ${contactsLoading ? "animate-spin" : ""}`} />
                  </button>
                  <Button size="sm" onClick={() => setContactModal("new")}>
                    <Plus className="w-3.5 h-3.5 mr-1" />연락처 추가
                  </Button>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl overflow-hidden">
               <div className="hidden md:grid grid-cols-[60px_90px_minmax(160px,1fr)_70px_180px_110px_110px_75px_85px] text-xs font-semibold text-muted-foreground bg-muted/40 px-5 py-3 border-b border-border">
                   <span>구</span>
                   <span>동/읍/면</span>
                   <span>번지수 / 건물명</span>
                   <span>호수</span>
                   <span>소유주</span>
                   <span>관리인</span>
                   <span>부동산</span>
                  <span className="text-center">노출상태</span>
                  <span className="text-center">관리</span>
                </div>
                {contactsLoading && <div className="py-16 text-center text-sm text-muted-foreground">불러오는 중...</div>}
                {!contactsLoading && filteredContacts.length === 0 && (
                  <div className="py-16 text-center text-sm text-muted-foreground">등록된 연락처가 없습니다.</div>
                )}
                {filteredContacts.slice(0, contactDisplayCount).map((c) => {
                  const isVisible = c.is_visible !== false;
                  const ownerPhones = getUniquePhones(c.phone, c.contact_owner);
                  return (
                    <div
                      key={c.id}
                      className={`md:grid md:grid-cols-[60px_90px_minmax(160px,1fr)_70px_180px_110px_110px_75px_85px] md:items-center px-4 md:px-5 py-3 border-b border-border last:border-0 transition-colors ${!isVisible ? "opacity-50 bg-muted/10" : "hover:bg-muted/20"}`}
                    >
                      {/* ── 모바일 레이아웃 ── */}
                      <div className="md:hidden flex flex-col gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground">
                            <MapPin className="w-3 h-3" style={{ color: "hsl(var(--accent))" }} />{c.district}
                          </span>
                          <span className="text-sm font-bold text-foreground">{c.dong}</span>
                          {c.lot_number && c.lot_number.trim() && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                              style={{ background: "hsl(0 0% 0% / 0.15)", color: "hsl(0 0% 0%)" }}>{c.lot_number}</span>
                          )}
                          {(c.building_dong || c.unit_number) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                              style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
                              {c.building_dong && <span>{c.building_dong}</span>}
                              {c.unit_number && <span>{c.unit_number}호</span>}
                            </span>
                          )}
                         </div>
                        {c.building_name && (
                          <div className="text-xs font-medium text-foreground truncate">{c.building_name}</div>
                        )}
                        <div className="grid grid-cols-1 gap-1 text-xs">
                          {ownerPhones.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-muted-foreground">소유주:</span>
                              {ownerPhones.map((p) => (
                                <a key={p} href={`tel:${p}`} className="font-semibold" style={{ color: "hsl(0 0% 0%)" }}>{p}</a>
                              ))}
                            </div>
                          )}
                          {c.contact_manager && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-muted-foreground">관리인:</span>
                              {getUniquePhones(c.contact_manager).map((p) => (
                                <a key={p} href={`tel:${p}`} className="font-semibold" style={{ color: "hsl(var(--chart-4))" }}>{p}</a>
                              ))}
                            </div>
                          )}
                          {c.contact_broker && (
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">부동산:</span>
                              <a href={`tel:${c.contact_broker}`} className="font-semibold" style={{ color: "hsl(var(--chart-3))" }}>{c.contact_broker}</a>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            onClick={() => toggleContactVisible(c)}
                            disabled={togglingContactId === c.id}
                            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold"
                            style={isVisible
                              ? { background: "hsl(0 0% 0% / 0.12)", color: "hsl(0 0% 0%)" }
                              : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
                            }>
                            {togglingContactId === c.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : isVisible
                                ? <><Eye className="w-3 h-3" />노출</>
                                : <><EyeOff className="w-3 h-3" />불가</>}
                          </button>
                          <button
                            onClick={() => setContactModal(c)}
                            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold"
                            style={{ background: "hsl(var(--primary) / 0.10)", color: "hsl(var(--primary))" }}>
                            <Pencil className="w-3 h-3" />수정
                          </button>
                          <button
                            onClick={() => deleteContact(c)}
                            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold"
                            style={{ background: "hsl(var(--destructive) / 0.15)", color: "hsl(var(--destructive))" }}>
                            <Trash2 className="w-3 h-3" />삭제
                          </button>
                        </div>
                      </div>

                      {/* ── 데스크톱 그리드 ── */}
                      <div className="hidden md:flex items-center gap-1 text-xs font-semibold text-foreground">
                        <MapPin className="w-3 h-3 shrink-0" style={{ color: "hsl(var(--accent))" }} />{c.district}
                      </div>
                      <div className="hidden md:block text-sm font-medium text-foreground">{c.dong}</div>
                      <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                        {c.lot_number && c.lot_number.trim() ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold shrink-0"
                            style={{ background: "hsl(0 0% 0% / 0.15)", color: "hsl(0 0% 0%)" }}>{c.lot_number}</span>
                        ) : <span className="text-muted-foreground/50">—</span>}
                        {c.building_name && (
                          <span className="truncate font-medium text-foreground" title={c.building_name}>{c.building_name}</span>
                        )}
                      </div>
                      <div className="hidden md:block text-xs">
                        {c.building_dong || c.unit_number ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
                            {c.building_dong && <span>{c.building_dong}</span>}
                            {c.unit_number && <span>{c.unit_number}호</span>}
                          </span>
                        ) : <span className="text-muted-foreground/50">—</span>}
                      </div>
                      <div className="hidden md:flex flex-col items-start gap-0.5 text-xs">
                        {ownerPhones.length > 0 ? (
                          ownerPhones.map((p) => (
                            <a key={p} href={`tel:${p}`} className="font-medium whitespace-nowrap" style={{ color: "hsl(0 0% 0%)" }}>{p}</a>
                          ))
                        ) : <span className="text-muted-foreground">—</span>}
                      </div>
                      <div className="hidden md:flex md:flex-col text-xs gap-0.5">
                        {c.contact_manager ? (
                          getUniquePhones(c.contact_manager).map((p) => (
                            <a key={p} href={`tel:${p}`} className="font-medium whitespace-nowrap" style={{ color: "hsl(var(--chart-4))" }}>{p}</a>
                          ))
                        ) : <span className="text-muted-foreground">—</span>}
                      </div>
                      <div className="hidden md:block text-xs">
                        {c.contact_broker ? (
                          <a href={`tel:${c.contact_broker}`} className="font-medium" style={{ color: "hsl(var(--chart-3))" }}>{c.contact_broker}</a>
                        ) : <span className="text-muted-foreground">—</span>}
                      </div>
                      <div className="hidden md:flex justify-center">
                        <button
                          onClick={() => toggleContactVisible(c)}
                          disabled={togglingContactId === c.id}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full font-semibold transition-all"
                          style={isVisible
                            ? { background: "hsl(0 0% 0% / 0.12)", color: "hsl(0 0% 0%)" }
                            : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
                          }
                          title={isVisible ? "클릭 시 노출불가" : "클릭 시 노출"}>
                          {togglingContactId === c.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : isVisible
                              ? <><Eye className="w-3 h-3" />노출</>
                              : <><EyeOff className="w-3 h-3" />불가</>}
                        </button>
                      </div>
                      <div className="hidden md:flex justify-center gap-1">
                        <button onClick={() => setContactModal(c)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold"
                          style={{ background: "hsl(var(--primary) / 0.10)", color: "hsl(var(--primary))" }}>
                          <Pencil className="w-3 h-3" />수정
                        </button>
                        <button onClick={() => deleteContact(c)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold"
                          style={{ background: "hsl(var(--destructive) / 0.15)", color: "hsl(var(--destructive))" }} title="삭제">
                          <Trash2 className="w-3 h-3" />삭제
                        </button>
                      </div>
                    </div>
                  );
                })}
                {filteredContacts.length > contactDisplayCount && (
                  <div className="py-4 text-center">
                    <button
                      onClick={() => setContactDisplayCount((n) => n + 200)}
                      className="px-4 py-2 rounded-full text-xs font-semibold border border-border hover:bg-muted/30">
                      더 보기 ({contactDisplayCount} / {filteredContacts.length})
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 신고/제안 관리 ── */}
          {tab === "reports" && (() => {
            const REPORT_TYPE_META = {
              error_report:    { label: "오류제보",  color: "hsl(var(--destructive))", bg: "hsl(var(--destructive) / 0.10)", emoji: "⚠️" },
              deal_complete:   { label: "거래완료",  color: "hsl(0 0% 0%)",     bg: "hsl(0 0% 0% / 0.12)",    emoji: "✅" },
              rental_proposal: { label: "임대현황", color: "hsl(var(--primary))",     bg: "hsl(var(--primary) / 0.10)",    emoji: "📋" },
            };
            const REPORT_STATUS_META = {
              pending:  { label: "미처리", color: "hsl(var(--chart-4))", bg: "hsl(var(--chart-4) / 0.12)" },
              reviewed: { label: "검토중", color: "hsl(var(--primary))", bg: "hsl(var(--primary) / 0.10)" },
              resolved: { label: "처리완료", color: "hsl(0 0% 0%)", bg: "hsl(0 0% 0% / 0.12)" },
              rejected: { label: "반려", color: "hsl(var(--destructive))", bg: "hsl(var(--destructive) / 0.10)" },
            };

            const filteredReports = reports.filter((r) => {
              if (reportFilter !== "all" && r.report_type !== reportFilter) return false;
              if (reportStatusFilter !== "all" && r.status !== reportStatusFilter) return false;
              return true;
            });

            const updateReportStatus = async (id: string, status: "pending" | "reviewed" | "resolved" | "rejected") => {
              const { error } = await supabase.from("property_reports").update({ status }).eq("id", id);
              if (error) {
                alert("처리 상태 변경 오류: " + error.message);
                return;
              }
              // 거래완료 제보를 반려 처리 시 → 매물 상태를 active로 복구
              if (status === "rejected") {
                const report = reports.find((r) => r.id === id);
                if (report && report.report_type === "deal_complete" && report.property_id) {
                  await supabase.from("properties").update({ status: "active", checked_date: null }).eq("id", report.property_id);
                }
              }
              setReports((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
            };

            const saveReportMemo = async (id: string) => {
              const memo = reportMemoInputs[id] ?? "";
              const { error } = await supabase.from("property_reports").update({ admin_memo: memo }).eq("id", id);
              if (!error) {
                setReports((prev) => prev.map((r) => r.id === id ? { ...r, admin_memo: memo } : r));
                alert("메모가 저장되었습니다.");
              }
            };

            const deleteReport = async (id: string) => {
              if (!window.confirm("이 항목을 삭제하시겠습니까?")) return;
              const { error } = await supabase.from("property_reports").delete().eq("id", id);
              if (!error) setReports((prev) => prev.filter((r) => r.id !== id));
            };

            const pendingCount = reports.filter(r => r.status === "pending").length;

            return (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold text-foreground">신고 / 제안 관리</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      총 {reports.length}건 · 미처리 {pendingCount}건
                    </p>
                  </div>
                  <button onClick={() => void fetchReports()} disabled={reportsLoading} className="p-1.5 rounded-md hover:bg-muted/50" style={{ color: "hsl(var(--muted-foreground))" }}>
                    <RefreshCw className={`w-3.5 h-3.5 ${reportsLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>

                {/* 필터 */}
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/20 p-1">
                    {([
                      { key: "all", label: "전체" },
                      { key: "error_report", label: "⚠️ 오류제보" },
                      { key: "deal_complete", label: "✅ 거래완료" },
                      { key: "rental_proposal", label: "📋 임대현황" },
                    ] as const).map((f) => (
                      <button key={f.key} onClick={() => setReportFilter(f.key)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                        style={reportFilter === f.key ? { background: "hsl(var(--primary))", color: "#fff" } : { color: "hsl(var(--muted-foreground))" }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/20 p-1">
                    {([
                      { key: "all", label: "전체상태" },
                      { key: "pending", label: "미처리" },
                      { key: "reviewed", label: "검토중" },
                      { key: "resolved", label: "처리완료" },
                      { key: "rejected", label: "반려" },
                    ] as const).map((f) => (
                      <button key={f.key} onClick={() => setReportStatusFilter(f.key)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                        style={reportStatusFilter === f.key ? { background: "hsl(var(--primary))", color: "#fff" } : { color: "hsl(var(--muted-foreground))" }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 목록 */}
                {reportsLoading && <div className="py-16 text-center text-sm text-muted-foreground">불러오는 중...</div>}
                {!reportsLoading && filteredReports.length === 0 && (
                  <div className="py-16 text-center text-sm text-muted-foreground">해당 조건의 항목이 없습니다.</div>
                )}
                <div className="flex flex-col gap-3">
                  {filteredReports.map((r) => {
                    const tm = REPORT_TYPE_META[r.report_type];
                    const sm = REPORT_STATUS_META[r.status as keyof typeof REPORT_STATUS_META] ?? { label: r.status, color: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted))" };
                    const isExpanded = expandedReport === r.id;
                    // 신청자 정보 조회
                    const submitter = r.submitted_by ? members.find(m => m.user_id === r.submitted_by) : null;
                    return (
                      <div key={r.id} className="bg-card border border-border rounded-xl overflow-hidden">
                        {/* 헤더 행 */}
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                          onClick={() => setExpandedReport(isExpanded ? null : r.id)}
                        >
                          {/* 타입 배지 */}
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap"
                            style={{ background: tm.bg, color: tm.color }}>
                            {tm.emoji} {tm.label}
                          </span>

                          {/* 매물 정보 */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{r.building_name || r.property_title}</p>
                            {(() => {
                              const mp = dbProperties.find(p => p.id === r.property_id);
                              return (
                                <p className="text-xs text-muted-foreground truncate">
                                  <JibunInlineAddress
                                    address={r.property_address}
                                    dong={mp?.dong}
                                    lotNumber={mp?.lot_number}
                                    district={mp?.district}
                                  />
                                </p>
                              );
                            })()}
                            {/* 신청자 표시 */}
                            {submitter && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                👤 <span className="font-semibold" style={{ color: "hsl(var(--primary))" }}>{submitter.name}</span>
                                <span className="ml-1">({submitter.agency_name})</span>
                                {submitter.phone && <span className="ml-1">· {formatPhone(submitter.phone)}</span>}
                              </p>
                            )}
                            {!submitter && r.proposer_name && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                👤 <span className="font-semibold" style={{ color: "hsl(var(--primary))" }}>{r.proposer_name}</span>
                                {r.proposer_company && <span className="ml-1">({r.proposer_company})</span>}
                                {r.proposer_phone && <span className="ml-1">· {formatPhone(r.proposer_phone)}</span>}
                              </p>
                            )}
                            {!submitter && !r.proposer_name && r.submitted_by && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">👤 비회원 제보</p>
                            )}
                            {!r.submitted_by && !r.proposer_name && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">👤 익명 제보</p>
                            )}
                          </div>

                          {/* 상태 배지 */}
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
                            style={{ background: sm.bg, color: sm.color }}>
                            {sm.label}
                          </span>

                          {/* 날짜 */}
                          <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:block">
                            {r.created_at.slice(0, 10)}
                          </span>

                          {isExpanded
                            ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                            : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                          }
                        </div>

                        {/* 상세 펼침 */}
                        {isExpanded && (
                          <div className="border-t border-border px-4 py-4 flex flex-col gap-4">
                            {/* 내용 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {r.report_type === "error_report" && r.error_content && (
                                <div className="md:col-span-2 rounded-xl bg-destructive/5 border border-destructive/20 p-3">
                                  <p className="text-[10px] font-bold text-destructive mb-1">오류 내용</p>
                                  <p className="text-sm text-foreground">{r.error_content}</p>
                                </div>
                              )}
                              {r.report_type === "deal_complete" && (
                                <>
                                  {/* 매물 상세 정보 + 연락처 */}
                                  {(() => {
                                    const matchedProp = dbProperties.find(p => p.id === r.property_id);
                                    return matchedProp ? (
                                      <div className="md:col-span-2 rounded-xl border border-border p-3 space-y-2" style={{ background: "hsl(var(--muted) / 0.3)" }}>
                                        <p className="text-[10px] font-bold text-muted-foreground mb-1">📋 매물 정보</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                                          <div><span className="text-muted-foreground">유형: </span><span className="font-semibold text-foreground">{matchedProp.type}</span></div>
                                          <div><span className="text-muted-foreground">보증금: </span><span className="font-semibold text-foreground">{matchedProp.deposit}</span></div>
                                          <div><span className="text-muted-foreground">월세: </span><span className="font-semibold text-foreground">{matchedProp.monthly}</span></div>
                                          <div><span className="text-muted-foreground">면적: </span><span className="font-semibold text-foreground">{matchedProp.area}</span></div>
                                          <div><span className="text-muted-foreground">층: </span><span className="font-semibold text-foreground">{matchedProp.floor}</span></div>
                                          {matchedProp.unit_number && <div><span className="text-muted-foreground">호수: </span><span className="font-semibold text-foreground">{matchedProp.unit_number}</span></div>}
                                          <div><span className="text-muted-foreground">담당: </span><span className="font-semibold text-foreground">{matchedProp.agent_name || "—"}</span></div>
                                          <div><span className="text-muted-foreground">상태: </span><span className="font-semibold" style={{ color: matchedProp.status === "active" ? "hsl(0 0% 0%)" : "hsl(var(--muted-foreground))" }}>{matchedProp.status === "active" ? "노출중" : matchedProp.status === "hidden" ? "숨김" : "종료"}</span></div>
                                        </div>
                                        {/* 연락처 (note 필드 파싱) */}
                                        {matchedProp.note && (
                                          <div className="flex flex-wrap gap-2 mt-1">
                                            {matchedProp.note.split(/[\n|]/).filter(Boolean).map((line, i) => {
                                              const phoneMatch = line.match(/([0-9\-]+)/);
                                              return (
                                                <a key={i} href={phoneMatch ? `tel:${phoneMatch[1]}` : undefined}
                                                  className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border border-border hover:bg-muted/60 transition-colors"
                                                  style={{ color: "hsl(var(--primary))" }}>
                                                  <Phone className="w-3 h-3" />
                                                  {line.trim()}
                                                </a>
                                              );
                                            })}
                                          </div>
                                        )}
                                        {/* 종료 버튼 */}
                                        {matchedProp.status !== "ended" && (
                                          <button
                                            onClick={async () => {
                                              if (!(await customConfirm(`"${matchedProp.title}" 매물을 종료 처리하시겠습니까?`))) return;
                                              const { error } = await supabase.from("properties").update({ status: "ended" }).eq("id", matchedProp.id);
                                              if (error) { await customAlert("종료 처리 실패: " + error.message); return; }
                                              setDbProperties(prev => prev.map(p => p.id === matchedProp.id ? { ...p, status: "ended" as const } : p));
                                              updateReportStatus(r.id, "resolved");
                                              await customAlert("매물이 종료 처리되었습니다.");
                                            }}
                                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white mt-1 transition-colors hover:opacity-90"
                                            style={{ background: "hsl(var(--destructive))" }}>
                                            <XCircle className="w-3.5 h-3.5" />
                                            매물 종료 처리
                                          </button>
                                        )}
                                        {matchedProp.status === "ended" && (
                                          <p className="text-xs font-bold mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>✅ 이미 종료된 매물입니다</p>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="md:col-span-2 rounded-xl bg-muted/40 border border-border p-3">
                                        <p className="text-xs text-muted-foreground">매물 정보를 찾을 수 없습니다 (ID: {r.property_id})</p>
                                      </div>
                                    );
                                  })()}
                                  {r.deal_date && (
                                    <div className="rounded-xl bg-muted/40 border border-border p-3">
                                      <p className="text-[10px] font-bold text-muted-foreground mb-0.5">거래 완료일</p>
                                      <p className="text-sm font-semibold text-foreground">{r.deal_date}</p>
                                    </div>
                                  )}
                                  {r.deal_memo && (
                                    <div className="rounded-xl bg-muted/40 border border-border p-3">
                                      <p className="text-[10px] font-bold text-muted-foreground mb-0.5">메모</p>
                                      <p className="text-sm text-foreground">{r.deal_memo}</p>
                                    </div>
                                  )}
                                </>
                              )}
                              {r.report_type === "rental_proposal" && (
                                <>
                                  <div className="rounded-xl bg-muted/40 border border-border p-3">
                                    <p className="text-[10px] font-bold text-muted-foreground mb-1">제안자 정보</p>
                                    <p className="text-sm font-semibold text-foreground">{r.proposer_name}</p>
                                    <a href={`tel:${r.proposer_phone}`} className="text-xs font-bold" style={{ color: "hsl(var(--primary))" }}>{r.proposer_phone}</a>
                                    {r.proposer_company && <p className="text-xs text-muted-foreground mt-0.5">{r.proposer_company}</p>}
                                  </div>
                                  <div className="rounded-xl bg-muted/40 border border-border p-3">
                                    <p className="text-[10px] font-bold text-muted-foreground mb-1">제안 조건</p>
                                    {r.proposal_deposit && <p className="text-xs text-foreground">보증금: <strong>{r.proposal_deposit}</strong></p>}
                                    {r.proposal_monthly && <p className="text-xs text-foreground">월세: <strong>{r.proposal_monthly}</strong></p>}
                                    {r.proposal_period && <p className="text-xs text-foreground">기간: <strong>{r.proposal_period}</strong></p>}
                                  </div>
                                  {r.proposal_content && (
                                    <div className="md:col-span-2 rounded-xl bg-primary/5 border border-primary/20 p-3">
                                      <p className="text-[10px] font-bold text-primary mb-1">추가 내용</p>
                                      <p className="text-sm text-foreground">{r.proposal_content}</p>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            {/* 상태 변경 */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-muted-foreground">처리 상태:</span>
                              {(["pending", "reviewed", "resolved", "rejected"] as const).map((s) => (
                                <button key={s} onClick={() => updateReportStatus(r.id, s)}
                                  className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                                  style={r.status === s
                                    ? { background: REPORT_STATUS_META[s].bg, color: REPORT_STATUS_META[s].color, outline: `1.5px solid ${REPORT_STATUS_META[s].color}` }
                                    : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
                                  }>
                                  {REPORT_STATUS_META[s].label}
                                </button>
                              ))}
                              <button onClick={() => deleteReport(r.id)} className="ml-auto flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold" style={{ color: "hsl(var(--destructive))", background: "hsl(var(--destructive) / 0.08)" }}>
                                <Trash2 className="w-3 h-3" />삭제
                              </button>
                            </div>

                            {/* 관리자 메모 */}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="관리자 메모 입력..."
                                value={reportMemoInputs[r.id] ?? (r.admin_memo ?? "")}
                                onChange={(e) => setReportMemoInputs((prev) => ({ ...prev, [r.id]: e.target.value }))}
                                className="flex-1 px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                              />
                              <button onClick={() => saveReportMemo(r.id)}
                                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-white"
                                style={{ background: "hsl(var(--primary))" }}>
                                <Save className="w-3 h-3" />저장
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── 커뮤니티 관리 ── */}
          {tab === "community" && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-foreground">커뮤니티 관리</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">총 {posts.length}개 게시글 · 신고 {posts.filter((p) => p.reported).length}건</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <Input placeholder="제목·작성자 검색" className="pl-7 h-8 text-xs w-48" value={postSearch} onChange={(e) => setPostSearch(e.target.value)} />
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="hidden md:grid grid-cols-[80px_1fr_80px_60px_60px_100px] text-xs font-semibold text-muted-foreground bg-muted/40 px-5 py-3 border-b border-border">
                  <span>분류</span><span>제목</span><span className="text-center">작성자</span>
                  <span className="text-center">조회</span><span className="text-center">신고</span><span className="text-center">관리</span>
                </div>
                {filteredPosts.length === 0 && <div className="py-16 text-center text-sm text-muted-foreground">게시글이 없습니다.</div>}
                {filteredPosts.map((p) => (
                  <div key={p.id} className={`grid md:grid-cols-[80px_1fr_80px_60px_60px_100px] items-center px-5 py-3.5 border-b border-border last:border-0 transition-colors ${p.reported ? "bg-destructive/[0.03]" : "hover:bg-muted/20"}`}>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit"
                      style={{ background: p.category === "notice" ? "hsl(218 88% 22% / 0.12)" : "hsl(var(--muted))", color: p.category === "notice" ? "hsl(218 88% 40%)" : "hsl(var(--muted-foreground))" }}>
                      {p.categoryLabel}
                    </span>
                    <div className="flex items-center gap-2 min-w-0">
                      {p.pinned && <Pin className="w-3 h-3 shrink-0 text-destructive" />}
                      <span className="text-sm font-medium text-foreground truncate">{p.title}</span>
                      {p.reported && <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "hsl(var(--destructive) / 0.12)", color: "hsl(var(--destructive))" }}>신고</span>}
                    </div>
                    <span className="hidden md:block text-xs text-muted-foreground text-center">{p.author}</span>
                    <span className="hidden md:flex items-center justify-center gap-0.5 text-xs text-muted-foreground"><Eye className="w-3 h-3" />{p.views}</span>
                    <div className="hidden md:flex justify-center">
                      {p.reported ? <span className="w-2 h-2 rounded-full" style={{ background: "hsl(var(--destructive))" }} /> : <span className="text-xs text-muted-foreground">-</span>}
                    </div>
                    <div className="hidden md:flex items-center justify-center gap-2">
                      <button onClick={() => togglePin(p.id)} className="p-1.5 rounded transition-colors" title={p.pinned ? "고정 해제" : "공지 고정"} style={{ color: p.pinned ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))" }}>
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deletePost(p.id)} className="p-1.5 rounded transition-colors" title="삭제" style={{ color: "hsl(var(--destructive))" }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 게스트 문의 ── */}
          {tab === "inquiries" && <AdminGuestInquiriesPanel />}

          {/* ── 채팅 문의 ── */}
          {tab === "chat" && adminUserId && (
            <AdminChatPanel adminUserId={adminUserId} />
          )}

        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
