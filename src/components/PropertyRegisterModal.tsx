import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatPhone } from "@/lib/utils";
import { X, Building2, Phone, MapPin, ChevronDown, ImagePlus, Loader2, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { prefetchPropertySummary } from "@/lib/prefetchPropertySummary";
import { loadCheongjuContact, saveCheongjuContact } from "@/lib/cheongjuContacts";
import cctvIcon from "@/assets/cctv_icon-v2-20260427.png";
import remodelingIcon from "@/assets/remodeling-icon-v2-20260427.png";
import tvIcon from "@/assets/tv_icon-v2-20260427.png";
import waterIcon from "@/assets/water_icon-v2-20260427.png";
import elevatorIcon from "@/assets/elevator_icon-v2-20260427.png";
import internetIcon from "@/assets/internet_icon-v2-20260427.png";
import petIcon from "@/assets/pet_icon-v2-20260427.png";
import memoIcon from "@/assets/memo_icon_new-v2-20260427.png";
import femaleOnlyIcon from "@/assets/female_only_icon-v2-20260427.png";
import { uploadPropertyImages } from "@/lib/uploadPropertyImages";
import { customAlert } from "@/lib/customDialogs";

/* ─── Address Data ─── */
const CHEONGJU_SIGUNGU = [
  "청주시 상당구","청주시 서원구","청주시 흥덕구","청주시 청원구",
];

const DONG_MAP: Record<string, string[]> = {
  "청주시 상당구": ["가덕면","금천동","남문로1가","남문로2가","남일면","남주동","낭성면","대성동","명암동","문의면","문화동","미원면","방서동","북문로1가","북문로2가","북문로3가","산성동","서문동","석교동","수동","영동","영운동","용담동","용암동","용정동","운동동","월오동","중앙동","지북동","탑동","평촌동"],
  "청주시 서원구": ["개신동","남이면","모충동","미평동","분평동","사직동","사창동","산남동","성화동","수곡동","장성동","장암동","죽림동","현도면"],
  "청주시 흥덕구": ["가경동","강내면","강서동","남촌동","내곡동","동막동","문암동","복대동","봉명동","비하동","상신동","서촌동","석곡동","석소동","송절동","송정동","수의동","신대동","신봉동","신성동","신전동","신촌동","오송읍","옥산면","외북동","운천동","원평동","정봉동","지동동","평동","향정동","현암동","화계동","휴암동"],
  "청주시 청원구": ["내덕동","내수읍","북이면","사천동","오근장동","오동동","오창읍","외남동","외평동","외하동","우암동","율량동","정북동","정상동","정하동","주성동","주중동"],
};

/* ─── Constants ─── */
const BROKER_TYPES = ["일반중개","공동중개"] as const;
const TRADE_TYPES = ["임대","매매"] as const;
const BUILDING_TYPES = ["단독건물","집합건물","토지"] as const;

// 집합건물로 취급할 세부 유형 (호수별 연락처 저장/조회)
const COLLECTIVE_DETAIL_TYPES = ["아파트","오피스텔","빌라","연립","다세대","주상복합"] as const;
// 집합건물 선택 후 추가로 중복 선택 가능한 주거 형태
const ROOM_SUBTYPES = ["원룸","투베이","투룸","쓰리룸","포룸"] as const;
const PROPERTY_TYPE_GROUPS_REG = [
  { group: "주거형", types: ["원룸","투베이","투룸","쓰리룸","포룸","주인세대","고시원","다가구","단독주택","아파트","오피스텔","도시형","연립","다세대","주상복합"] },
  { group: "상가", types: ["상가","사무실","공장·창고","지식산업","기타임대"] },
  { group: "매매", types: ["단독매매","다가구매매","다중매매","상가주택매매","상가건물매매","구분상가매매","창고/공장매매","지식산업매매"] },
  { group: "토지", types: ["토지"] },
];
// 전체 세부종류 flat 목록 (타입 추론용)
const ALL_DETAIL_TYPES = PROPERTY_TYPE_GROUPS_REG.flatMap((g) => g.types);

const BUILDING_SALE_TYPES = ["일반건물","집합건물","토지"] as const;
type BuildingSaleType = typeof BUILDING_SALE_TYPES[number];
const ROOM_OPTIONS = [
  "냉장고","세탁기","드럼세탁기","건조기","스타일러","TV",
  "에어컨","가스레인지","인덕션","전자레인지","침대","책상",
  "옷장","신발장","복층","옥탑","테라스","주차","베란다",
] as const;

type PetType = "가능" | "불가" | "";
const LH_TYPES = ["관계없음","LH가능","LH불가"] as const;
const VACANCY_TYPES = ["공실","세입자 거주중"] as const;
const FLOOR_OPTIONS = [
  "지하5층","지하4층","지하3층","지하2층","지하1층","0층",
  ...Array.from({ length: 50 }, (_, i) => `${i + 1}층`),
  "50층이상",
];
const DIRECTION_OPTIONS = ["동","서","남","북","동남","남서","북동","북서"];

type BrokerType = typeof BROKER_TYPES[number];
type TradeType = typeof TRADE_TYPES[number];
type BuildingType = typeof BUILDING_TYPES[number];
type DetailType = typeof ALL_DETAIL_TYPES[number] | "";
type VacancyType = typeof VACANCY_TYPES[number];
type LhType = typeof LH_TYPES[number];

// 임대 방식 (복수 선택 가능)
const RENT_MODES = ["월세", "반전세", "전세"] as const;
type RentMode = typeof RENT_MODES[number];

type OneRoomLayout = "오픈형" | "분리형" | "";

interface FormState {
  brokerType: BrokerType;
  tradeType: TradeType;
  buildingType: BuildingType;
  detailType: DetailType;
  oneRoomLayout: OneRoomLayout;
  sido: string;
  sigungu: string;
  dong: string;
  lotNumber: string;
  buildingName: string;
  floor: string;
  unitNo: string;
  area: string;
  landArea: string;      // 매매: 대지(평)
  buildingArea: string;  // 매매: 건평
  totalFloors: string;   // 매매: 전체 층수
  buildYear: string;     // 매매: 건축년도
  buildingSaleType: BuildingSaleType; // 건물매매: 일반건물/집합건물/토지
  options: string[];
  facilities: string[];
  pet: PetType;
  buildingPassword: string;
  roomPassword: string;
  direction: string;
  vacancy: VacancyType;
  // 임대 방식 복수 선택
  rentModes: RentMode[];
  // 월세
  deposit: string;
  monthlyRent: string;
  // 반전세
  halfDeposit: string;
  halfMonthly: string;
  // 전세
  jeonseDeposit: string;
  managementFee: string;
  salePrice: string;
  keyMoney: string;
  lhType: LhType;
  exitCleanFee: string;
  brokerFee: string;
  myMemo: string;
  description: string;
  contactBroker: string;
  contactOwner: string;
  contactOwner2: string;
  extraOwners: string[]; // 소유주 3,4,5... 추가 소유주들
  contactTenant: string;
  contactManager: string;
  roadAddress: string;
  tenantOccupied: boolean;      // 아파트매매: 세입자 거주여부
  tenantDeposit: string;        // 아파트매매: 세입자 전세/보증금
  tenantMonthly: string;        // 아파트매매: 세입자 월세
  vacateDate: string;           // 퇴거 예정일 (임대/매매 공통)
  earlyExit: boolean;           // 세입자 중도퇴거 여부 (임대 전용)
  expose: boolean;
  allowAddressView: boolean;
  images: string[];
  elevator: boolean;
  isNew: boolean;
  isHot: boolean;
  buildingMemo: string;
  buildingDong: string; // 집합건물 동(棟)
  extraRoomTypes: string[]; // 집합건물(아파트/오피스텔 등) 선택 시 추가 주거형태 다중 선택
}

const INITIAL: FormState = {
  brokerType: "일반중개", tradeType: "임대", buildingType: "단독건물",
  detailType: "",
  oneRoomLayout: "",
  sido: "충북", sigungu: "", dong: "", lotNumber: "",
  buildingName: "", floor: "", unitNo: "", area: "",
  landArea: "", buildingArea: "", buildingSaleType: "일반건물",
  totalFloors: "", buildYear: "",
  options: [], facilities: [], pet: "",
  buildingPassword: "", roomPassword: "", direction: "",
  vacancy: "공실",
  rentModes: ["월세"],
  deposit: "", monthlyRent: "",
  halfDeposit: "", halfMonthly: "",
  jeonseDeposit: "",
  managementFee: "",
  salePrice: "", keyMoney: "",
  lhType: "관계없음", exitCleanFee: "", brokerFee: "",
  myMemo: "",
  description: "",
  contactBroker: "", contactOwner: "", contactOwner2: "", extraOwners: [], contactTenant: "", contactManager: "",
  roadAddress: "",
  tenantOccupied: false, tenantDeposit: "", tenantMonthly: "", vacateDate: "",
  earlyExit: false,
  expose: true, allowAddressView: false,
  images: [],
  elevator: false, isNew: false, isHot: false, buildingMemo: "",
  buildingDong: "",
  extraRoomTypes: [],
};

const STEP_LABELS = ["기본 설정 및 주소", "옵션 및 조건", "연락처 및 사진"];

interface Props {
  onClose: () => void;
  /** 종료된 매물 등 기존 매물 정보를 그대로 가져와서 새 매물로 재등록할 때 사용 */
  prefill?: Record<string, unknown>;
}

/** DB row → FormState 매핑 (재등록용) */
function dbRowToFormState(row: Record<string, unknown>): Partial<FormState> {
  const get = (k: string) => (row[k] == null ? "" : String(row[k]));
  const note = get("note");
  const parseNote = (key: string): string => {
    const pattern = key === "건물주"
      ? /건물주(?!2)[:\s]+([^\n|]+)/
      : new RegExp(`${key}[:\\s]+([^\\n|]+)`);
    const m = note.match(pattern);
    return m ? m[1].trim() : "";
  };
  const roadAddr = parseNote("도로명");
  const districtVal = get("district");
  const sigunguVal = districtVal ? `청주시 ${districtVal}` : "";
  const detailType = get("type");
  const roomType = get("room_type");
  // room_type 콤마 분리 — 추가 주거형태(원룸/투룸/쓰리룸 등) 다중 저장 지원
  const roomTypeParts = roomType.split(",").map((s) => s.trim()).filter(Boolean);
  const extraRoomTypesFromDb = roomTypeParts.filter((rt) => (ROOM_SUBTYPES as readonly string[]).includes(rt));
  const allOptions = Array.isArray(row.options) ? (row.options as string[]) : [];
  const petOpt = allOptions.find((o) => o.startsWith("반려동물_"));
  const facilityNames = ["엘리베이터","수도","인터넷","TV","CCTV","리모델링"];
  const facilities = allOptions.filter((o) => facilityNames.includes(o));
  const options = allOptions.filter((o) => !facilityNames.includes(o) && !o.startsWith("반려동물_"));
  const buildingSaleType: BuildingSaleType =
    (BUILDING_SALE_TYPES as readonly string[]).includes(roomType) ? (roomType as BuildingSaleType) : "일반건물";
  const isBuildingSaleRow = detailType.includes("매매");
  const isLand = detailType === "토지";
  const buildingType: BuildingType = isLand
    ? "토지"
    : (COLLECTIVE_DETAIL_TYPES as readonly string[]).includes(detailType)
      ? "집합건물"
      : "단독건물";
  const tradeType: TradeType = isBuildingSaleRow ? "매매" : "임대";
  // 면적에서 대지/건평 분리 (매매)
  let landArea = "", buildingArea = "", area = get("area");
  if (isBuildingSaleRow && area.includes("/")) {
    const lm = area.match(/대지\s*([0-9.]+)/);
    const bm = area.match(/건평\s*([0-9.]+)/);
    if (lm) landArea = lm[1];
    if (bm) buildingArea = bm[1];
    area = "";
  }
  // rentModes 추출 (note의 "월세:", "반전세:", "전세:" 패턴)
  const rentModes: RentMode[] = [];
  if (/월세[:\s]/.test(note) && !/반전세/.test(note.match(/월세[:\s][^\n]*/)?.[0] ?? "")) rentModes.push("월세");
  if (/반전세[:\s]/.test(note)) rentModes.push("반전세");
  if (/(?<!반)전세[:\s]/.test(note)) rentModes.push("전세");
  if (rentModes.length === 0 && tradeType === "임대") rentModes.push("월세");

  const wolseM = note.match(/월세:\s*보증금\s*([0-9]+).*?월세\s*([0-9]+)/);
  const halfM = note.match(/반전세:\s*보증금\s*([0-9]+).*?월세\s*([0-9]+)/);
  const jeonseM = note.match(/(?<!반)전세:\s*보증금\s*([0-9]+)/);
  const directionM = note.match(/방향:\s*([^\n|]+)/);
  const lhM = note.match(/LH:\s*([^\n|]+)/);
  const cleanM = note.match(/청소비:\s*([^\n|]+)/);
  const brokerFeeM = note.match(/중개보수:\s*([^\n|]+)/);
  const keyMoneyM = note.match(/권리금:\s*([^\n|]+)/);
  const buildingDongM = note.match(/동\(棟\):\s*([^\n|]+)/);
  const tenantDepositM = note.match(/세입자전세금:\s*([^\n|]+)/);
  const tenantMonthlyM = note.match(/세입자월세:\s*([^\n|]+)/);

  return {
    brokerType: "일반중개",
    tradeType,
    buildingType,
    detailType: detailType as DetailType,
    oneRoomLayout: detailType === "원룸" && (roomType === "오픈형" || roomType === "분리형") ? (roomType as OneRoomLayout) : "",
    sido: "충북",
    sigungu: sigunguVal,
    dong: get("dong"),
    lotNumber: get("lot_number"),
    buildingName: get("building_name"),
    floor: get("floor"),
    unitNo: get("unit_number"),
    area,
    landArea,
    buildingArea,
    totalFloors: get("total_floors"),
    buildYear: get("build_year"),
    buildingSaleType,
    options,
    facilities,
    pet: (petOpt ? petOpt.replace("반려동물_", "") : "") as PetType,
    buildingPassword: get("building_password"),
    roomPassword: get("room_password"),
    direction: directionM ? directionM[1].trim() : "",
    vacancy: (get("available_from") === "세입자 거주중" ? "세입자 거주중" : "공실") as VacancyType,
    rentModes,
    deposit: wolseM ? wolseM[1] : (tradeType === "임대" && !isBuildingSaleRow ? get("deposit") : ""),
    monthlyRent: wolseM ? wolseM[2] : (tradeType === "임대" && !isBuildingSaleRow ? get("monthly") : ""),
    halfDeposit: halfM ? halfM[1] : "",
    halfMonthly: halfM ? halfM[2] : "",
    jeonseDeposit: jeonseM ? jeonseM[1] : "",
    managementFee: get("manage_fee"),
    salePrice: (isBuildingSaleRow || tradeType === "매매") ? get("deposit") : "",
    keyMoney: keyMoneyM ? keyMoneyM[1].trim() : "",
    lhType: (lhM && (LH_TYPES as readonly string[]).includes(lhM[1].trim()) ? lhM[1].trim() : "관계없음") as LhType,
    exitCleanFee: cleanM ? cleanM[1].trim() : "",
    brokerFee: brokerFeeM ? brokerFeeM[1].trim() : "",
    myMemo: get("room_memo"),
    description: get("description"),
    contactBroker: parseNote("부동산"),
    contactOwner: parseNote("건물주"),
    contactOwner2: parseNote("건물주2"),
    extraOwners: (() => {
      const arr: string[] = [];
      for (let i = 3; i <= 20; i++) {
        const m = note.match(new RegExp(`건물주${i}[:\\s]+([^\\n|]+)`));
        if (m) arr.push(m[1].trim());
      }
      return arr;
    })(),
    contactTenant: parseNote("세입자"),
    contactManager: parseNote("관리인"),
    roadAddress: roadAddr,
    tenantOccupied: /세입자거주:\s*예/.test(note),
    tenantDeposit: tenantDepositM ? tenantDepositM[1].trim() : "",
    tenantMonthly: tenantMonthlyM ? tenantMonthlyM[1].trim() : "",
    vacateDate: "",
    earlyExit: /중도퇴거/.test(note),
    expose: true,
    allowAddressView: false,
    images: Array.isArray(row.images) ? (row.images as string[]) : [],
    elevator: Boolean(row.elevator),
    isNew: false,
    isHot: false,
    buildingMemo: get("building_memo").startsWith("__PROPOSAL_JSON__") ? "" : get("building_memo"),
    buildingDong: buildingDongM ? buildingDongM[1].trim() : "",
    extraRoomTypes: extraRoomTypesFromDb,
  };
}

export default function PropertyRegisterModal({ onClose, prefill }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<FormState>(() =>
    prefill ? { ...INITIAL, ...dbRowToFormState(prefill) } : INITIAL
  );
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [myAgentName, setMyAgentName] = useState("");

  // 로그인 사용자 프로필 이름 자동 로드
  useEffect(() => {
    if (!user?.userId) return;
    supabase
      .from("agent_profiles")
      .select("name")
      .eq("user_id", user.userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.name) setMyAgentName(data.name);
      });
  }, [user?.userId]);

  // 집합건물 여부 판단: 건물유형이 집합건물이거나 세부유형이 아파트/오피스텔/빌라/연립 등
  const isCollectiveBuilding = form.buildingType === "집합건물" || COLLECTIVE_DETAIL_TYPES.some((t) => t === form.detailType);

  // ── 주소(동+번지) 변경 시: ──
  //   1) 단독건물에 한해 연락처 자동 로드 (정확한 동+번지 일치만)
  //   2) 건물 비밀번호는 건물유형과 무관하게 같은 건물(동+번지)에서 최신값 자동 로드
  useEffect(() => {
    if (!form.dong || !form.lotNumber) return;
    const run = async () => {
      // (1) 연락처 — 단독건물에서만, 동+번지 정확 일치 + 호수 없는 row
      if (!isCollectiveBuilding) {
        const contacts = await loadCheongjuContact({ dong: form.dong, lotNumber: form.lotNumber });
        if (contacts) {
          setForm((prev) => ({
            ...prev,
            contactOwner: prev.contactOwner || contacts.contactOwner,
            contactOwner2: prev.contactOwner2 || contacts.contactOwner2,
            extraOwners: prev.extraOwners.length > 0 ? prev.extraOwners : contacts.extraOwners,
            contactManager: prev.contactManager || contacts.contactManager,
            contactBroker: prev.contactBroker || contacts.contactBroker,
          }));
        }
      }

      // (2) 건물 비밀번호 + 건물명 — 같은 건물(동+번지)의 최신 매물에서 호수와 무관하게 로드
      const { data: propData } = await supabase
        .from("properties")
        .select("building_password,building_name")
        .eq("dong", form.dong)
        .eq("lot_number", form.lotNumber)
        .order("registered_date", { ascending: false })
        .limit(5);
      const pwRow = (propData ?? []).find((r: any) => r.building_password && r.building_password.trim() !== "");
      const nameRow = (propData ?? []).find((r: any) => r.building_name && r.building_name.trim() !== "");
      if (pwRow || nameRow) {
        setForm((prev) => ({
          ...prev,
          buildingPassword: prev.buildingPassword || pwRow?.building_password || "",
          buildingName: prev.buildingName || nameRow?.building_name || "",
        }));
      }
    };
    run();
  }, [form.dong, form.lotNumber, isCollectiveBuilding]);

  // 자동 채워진 연락처 값을 추적 — 호수가 바뀌어 매칭 안 되면 이전 자동값만 제거
  const autoFilledContactsRef = useRef<{
    contactOwner?: string;
    contactOwner2?: string;
    extraOwners?: string[];
    contactManager?: string;
    contactBroker?: string;
  }>({});

  // ── 집합건물/아파트/오피스텔/빌라 등: 동+번지+호수 정확 일치 시 소유주 연락처 + 이전 사진 자동 로드 ──
  useEffect(() => {
    if (!isCollectiveBuilding) return;
    // 동/번지/호수 중 하나라도 비면 이전에 자동 채워졌던 연락처 제거
    if (!form.dong || !form.lotNumber || !form.unitNo) {
      const prevAuto = autoFilledContactsRef.current;
      if (prevAuto.contactOwner || prevAuto.contactOwner2 || (prevAuto.extraOwners?.length ?? 0) > 0 || prevAuto.contactManager || prevAuto.contactBroker) {
        setForm((prev) => ({
          ...prev,
          contactOwner:   prev.contactOwner   === prevAuto.contactOwner   ? "" : prev.contactOwner,
          contactOwner2:  prev.contactOwner2  === prevAuto.contactOwner2  ? "" : prev.contactOwner2,
          extraOwners:    JSON.stringify(prev.extraOwners) === JSON.stringify(prevAuto.extraOwners) ? [] : prev.extraOwners,
          contactManager: prev.contactManager === prevAuto.contactManager ? "" : prev.contactManager,
          contactBroker:  prev.contactBroker  === prevAuto.contactBroker  ? "" : prev.contactBroker,
        }));
        autoFilledContactsRef.current = {};
      }
      return;
    }
    const run = async () => {
      // 1) cheongju_contacts에서 동+번지+호수 정확 일치 조회 (호수 일치 필수, 폴백 없음)
      const contacts = await loadCheongjuContact({
        dong: form.dong, lotNumber: form.lotNumber, unitNumber: form.unitNo,
        fallbackFromProperties: false,
      });
      const prevAuto = autoFilledContactsRef.current;
      if (contacts) {
        setForm((prev) => ({
          ...prev,
          // 이전 자동값이거나 비어있으면 새 값으로 교체, 사용자가 직접 입력한 값은 보존
          contactOwner:   (!prev.contactOwner   || prev.contactOwner   === prevAuto.contactOwner)   ? (contacts.contactOwner   || "") : prev.contactOwner,
          contactOwner2:  (!prev.contactOwner2  || prev.contactOwner2  === prevAuto.contactOwner2)  ? (contacts.contactOwner2  || "") : prev.contactOwner2,
          extraOwners:    (prev.extraOwners.length === 0 || JSON.stringify(prev.extraOwners) === JSON.stringify(prevAuto.extraOwners)) ? contacts.extraOwners : prev.extraOwners,
          contactManager: (!prev.contactManager || prev.contactManager === prevAuto.contactManager) ? (contacts.contactManager || "") : prev.contactManager,
          contactBroker:  (!prev.contactBroker  || prev.contactBroker  === prevAuto.contactBroker)  ? (contacts.contactBroker  || "") : prev.contactBroker,
        }));
        autoFilledContactsRef.current = { ...contacts };
      } else {
        // 매칭 결과 없음 — 이전에 자동 채운 값 제거 (사용자 입력값은 보존)
        if (prevAuto.contactOwner || prevAuto.contactOwner2 || (prevAuto.extraOwners?.length ?? 0) > 0 || prevAuto.contactManager || prevAuto.contactBroker) {
          setForm((prev) => ({
            ...prev,
            contactOwner:   prev.contactOwner   === prevAuto.contactOwner   ? "" : prev.contactOwner,
            contactOwner2:  prev.contactOwner2  === prevAuto.contactOwner2  ? "" : prev.contactOwner2,
            extraOwners:    JSON.stringify(prev.extraOwners) === JSON.stringify(prevAuto.extraOwners) ? [] : prev.extraOwners,
            contactManager: prev.contactManager === prevAuto.contactManager ? "" : prev.contactManager,
            contactBroker:  prev.contactBroker  === prevAuto.contactBroker  ? "" : prev.contactBroker,
          }));
        }
        autoFilledContactsRef.current = {};
      }

      // 2) 같은 동+번지+호수의 이전 매물 사진이 있으면 자동 첨부 (현재 사진이 없을 때만)
      try {
        const { data: prevProp } = await supabase
          .from("properties")
          .select("images")
          .eq("dong", form.dong)
          .eq("lot_number", form.lotNumber)
          .eq("unit_number", form.unitNo)
          .not("images", "is", null)
          .order("registered_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        const prevImages = Array.isArray(prevProp?.images) ? (prevProp!.images as string[]).filter(Boolean) : [];
        if (prevImages.length > 0) {
          setForm((prev) => prev.images.length > 0 ? prev : ({ ...prev, images: prevImages }));
        }
      } catch {}
    };
    run();
  }, [form.dong, form.unitNo, form.buildingType, form.detailType, form.lotNumber, isCollectiveBuilding]);

  // ── 단독건물: 주소(동+번지) 입력 시 건물 비밀번호만 자동 로드 ──────
  useEffect(() => {
    if (!form.dong || !form.lotNumber || isCollectiveBuilding) return;
    const run = async () => {
      const { data } = await supabase
        .from("properties")
        .select("building_password")
        .eq("dong", form.dong)
        .eq("lot_number", form.lotNumber)
        .not("building_password", "is", null)
        .neq("building_password", "")
        .order("registered_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data?.building_password) return;
      setForm((prev) => ({
        ...prev,
        buildingPassword: prev.buildingPassword || data.building_password || "",
      }));
    };
    run();
  }, [form.dong, form.lotNumber, form.buildingType, form.detailType, isCollectiveBuilding]);

  // ── 집합건물: 동+번지+호수 입력 시 건축물대장(전유부)에서 해당 호실 면적 자동 기입 ──
  const autoFilledAreaRef = useRef<string>("");
  useEffect(() => {
    if (!isCollectiveBuilding) return;
    if (!form.dong || !form.lotNumber || !form.unitNo) return;
    // 사용자가 직접 입력한 면적은 보존 (이전 자동값이거나 비어있을 때만 채움)
    const currentArea = form.area?.trim() ?? "";
    if (currentArea && currentArea !== autoFilledAreaRef.current) return;

    const sigunguClean = (form.sigungu || "").replace(/^청주시\s*/, "");
    const address = ["충북 청주시", sigunguClean, form.dong, form.lotNumber].filter(Boolean).join(" ").trim();
    const unitDigits = form.unitNo.replace(/[^0-9]/g, "");
    if (!address || !unitDigits) return;

    let cancelled = false;
    const run = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("property-summary", {
          body: { address },
        });
        if (cancelled || error || !data) return;
        const raws: any[] = Array.isArray(data?.building_summary?._raw) ? data.building_summary._raw : [];
        const dongFilter = (form.buildingDong || "").replace(/동$/, "").trim();
        // 모든 _raw 항목의 exposFloors를 평탄화 후 hoNm 일치 검색
        const candidates: any[] = [];
        for (const r of raws) {
          if (dongFilter && r.bldNm && !String(r.bldNm).includes(dongFilter)) continue;
          if (Array.isArray(r.exposFloors)) candidates.push(...r.exposFloors);
        }
        // 전유부만 (공용부 제외), hoNm 숫자 일치
        const match = candidates.find((e) => {
          const ho = (e?.hoNm ?? "").toString().replace(/[^0-9]/g, "");
          const gb = (e?.exposPubuseGbCdNm ?? "").toString();
          const isExpos = !gb || gb.includes("전유");
          return isExpos && ho && ho === unitDigits && e?.area;
        });
        if (!match || cancelled) return;
        const areaStr = String(match.area).trim();
        autoFilledAreaRef.current = areaStr;
        setForm((prev) => {
          const cur = prev.area?.trim() ?? "";
          if (cur && cur !== autoFilledAreaRef.current) return prev;
          return { ...prev, area: areaStr };
        });
      } catch {}
    };
    const t = setTimeout(run, 600);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.dong, form.lotNumber, form.unitNo, form.buildingDong, form.sigungu, isCollectiveBuilding]);


  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((p) => ({ ...p, [key]: val }));
    setErrors((p) => { const n = { ...p }; delete n[key]; return n; });
  };

  const toggleOption = (opt: string) =>
    set("options", form.options.includes(opt)
      ? form.options.filter((o) => o !== opt)
      : [...form.options, opt]);

  /* ─── 이미지 업로드 (압축 + 병렬) ─── */
  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newUrls = await uploadPropertyImages(files, "properties/");
      if (newUrls.length > 0) setForm((f) => ({ ...f, images: [...f.images, ...newUrls] }));
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (url: string) =>
    setForm((f) => ({ ...f, images: f.images.filter((u) => u !== url) }));

  const setMainImage = (url: string) =>
    setForm((f) => ({ ...f, images: [url, ...f.images.filter((u) => u !== url)] }));

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!form.sigungu) e.sigungu = "시/군/구를 선택해주세요";
    if (!form.dong) e.dong = "동을 선택해주세요";
    if (form.buildingType !== "토지" && !form.detailType) e.detailType = "세부 종류를 선택해주세요";
    if (form.detailType === "원룸" && !form.oneRoomLayout) e.oneRoomLayout = "원룸 형태(오픈형/분리형)를 선택해주세요";
    const isBuildingSale = ["건물매매","단독매매","창고/공장매매","구분상가매매","상가주택매매","상가건물매매","다가구매매","다중매매"].includes(form.detailType);
    const isLand = form.detailType === "토지" || form.buildingType === "토지";
    if (!isBuildingSale && !isLand) {
      if (!form.floor) e.floor = "층수를 선택해주세요";
      if (!form.unitNo.trim()) e.unitNo = "호수를 입력해주세요";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e: Record<string, string> = {};
    const isSale = form.detailType === "건물매매" || form.tradeType === "매매";
    const isLand = form.detailType === "토지" || form.buildingType === "토지";
    const isCommercial = ["상가","사무실","공장·창고","지식산업"].includes(form.detailType);
    if (isSale) {
      if (!form.salePrice.trim()) e.amount = "매매가를 입력해주세요";
    } else if (!isLand && !isCommercial) {
      const hasJeonse = form.rentModes.includes("전세") && form.jeonseDeposit.trim();
      const hasHalf = form.rentModes.includes("반전세") && (form.halfDeposit.trim() || form.halfMonthly.trim());
      const hasWolse = form.rentModes.includes("월세") && (form.deposit.trim() || form.monthlyRent.trim());
      if (!hasJeonse && !hasHalf && !hasWolse && !form.deposit.trim() && !form.monthlyRent.trim()) {
        e.amount = "보증금 또는 월세를 입력해주세요";
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep3 = () => {
    setErrors({});
    return true;
  };

  const handleSubmit = async () => {
    if (!form.contactOwner.trim() && !form.contactManager.trim()) {
      await customAlert("소유주 또는 관리인 연락처 중 하나는 입력해주세요.");
      return;
    }
    setSaving(true);
    setSaveError("");

    let address = ["충북", form.sigungu, form.dong, form.lotNumber].filter(Boolean).join(" ");
    const districtVal = form.sigungu ? form.sigungu.replace("청주시 ", "") : null;
    let finalDong = form.dong;
    let finalLotNumber = form.lotNumber;

    // ── Geocoding: 주소 → 좌표 + 도로명 ─────────────────────────────────
    let lat = 0;
    let lng = 0;
    let finalRoadAddress = form.roadAddress || "";
    try {
      const geoAddress = ["충북 청주시", form.sigungu.replace("청주시 ", ""), form.dong, form.lotNumber].filter(Boolean).join(" ");
      const { data: geoData, error: geoErr } = await supabase.functions.invoke("geocode", {
        body: { address: geoAddress },
      });
      if (!geoErr && geoData?.success) {
        lat = geoData.lat;
        lng = geoData.lng;
        // 도로명주소 저장
        if (geoData.roadAddress && !finalRoadAddress) {
          finalRoadAddress = geoData.roadAddress as string;
        }
        // 도로명 입력 시 지번 주소로 자동 변환
        if (geoData.jibunAddress) {
          const jibunMatch = (geoData.jibunAddress as string).match(/([가-힣]+[동리읍면])\s+([\d-]+)$/);
          if (jibunMatch) {
            finalDong = jibunMatch[1];
            finalLotNumber = jibunMatch[2];
            address = ["충북", form.sigungu, finalDong, finalLotNumber].filter(Boolean).join(" ");
          }
        }
      } else {
        console.warn("[geocode] 좌표 변환 실패:", geoErr?.message ?? geoData?.error);
      }
    } catch (e) {
      console.warn("[geocode] 예외:", e);
    }

    const contactParts = [
      form.contactOwner && `건물주:${form.contactOwner}`,
      form.contactOwner2 && `건물주2:${form.contactOwner2}`,
      ...form.extraOwners.map((o, i) => o && `건물주${i + 3}:${o}`).filter(Boolean),
      form.contactBroker && `부동산:${form.contactBroker}`,
      form.contactTenant && `세입자:${form.contactTenant}`,
      form.contactManager && `관리인:${form.contactManager}`,
    ].filter(Boolean).join("|");

    const isBuildingSale = ["건물매매","단독매매","창고/공장매매","구분상가매매","상가주택매매","상가건물매매","다가구매매","다중매매"].includes(form.detailType);
    const isCommercialLease = ["상가","사무실","공장·창고","지식산업"].includes(form.detailType);

    // 임대 방식별 금액 정리 (월세/반전세/전세 복수 가능)
    const hasWolse = form.rentModes.includes("월세");
    const hasHalf = form.rentModes.includes("반전세");
    const hasJeonse = form.rentModes.includes("전세");

    // deposit: 대표 보증금 (월세 우선, 없으면 반전세, 없으면 전세)
    const mainDeposit = (isBuildingSale || form.tradeType === "매매")
      ? form.salePrice
      : hasWolse ? form.deposit : hasHalf ? form.halfDeposit : hasJeonse ? form.jeonseDeposit : form.deposit;
    const mainMonthly = (isBuildingSale || form.tradeType === "매매")
      ? ""
      : hasWolse ? form.monthlyRent : hasHalf ? form.halfMonthly : "";

    // note에 임대 방식별 상세 금액 저장
    const rentNotes: string[] = [];
    if (form.tradeType === "임대" && !isBuildingSale) {
      if (hasWolse && (form.deposit || form.monthlyRent)) rentNotes.push(`월세: 보증금 ${form.deposit || "0"}만원 / 월세 ${form.monthlyRent || "0"}만원`);
      if (hasHalf && (form.halfDeposit || form.halfMonthly)) rentNotes.push(`반전세: 보증금 ${form.halfDeposit || "0"}만원 / 월세 ${form.halfMonthly || "0"}만원`);
      if (hasJeonse && form.jeonseDeposit) rentNotes.push(`전세: 보증금 ${form.jeonseDeposit}만원`);
    }

    const payload = {
      title: isBuildingSale
        ? `${form.dong} ${form.detailType} (${form.buildingSaleType})`
        : `${form.dong} ${form.detailType}${form.floor ? ` ${form.floor}` : ""}`,
      building_name: form.buildingName || null,
      address,
      dong: finalDong,
      lot_number: finalLotNumber,
      district: districtVal,
      type: (form.detailType === "토지" || form.buildingType === "토지")
        ? "토지"
        : form.detailType || (form.brokerType === "공동중개" ? "공동중개" : form.tradeType),
      room_type: isBuildingSale
        ? form.buildingSaleType
        : (() => {
            const base = form.detailType === "원룸" && form.oneRoomLayout ? form.oneRoomLayout : form.detailType;
            if (!base) return null;
            const isCollectivePrimary = (COLLECTIVE_DETAIL_TYPES as readonly string[]).includes(form.detailType);
            if (isCollectivePrimary && form.extraRoomTypes.length > 0) {
              return [base, ...form.extraRoomTypes].join(",");
            }
            return base;
          })(),
      unit_number: form.unitNo || null,
      area: isBuildingSale
        ? [form.landArea && `대지 ${form.landArea}`, form.buildingArea && `건평 ${form.buildingArea}`].filter(Boolean).join(" / ")
        : (form.area && !form.area.includes("평") ? (() => { const n = parseFloat(form.area.replace(/[^0-9.]/g, "")); return !isNaN(n) && n > 0 ? `${(n / 3.3058).toFixed(1)}평` : form.area; })() : form.area),
      floor: form.floor,
      deposit: mainDeposit,
      monthly: mainMonthly,
      manage_fee: form.managementFee,
      parking: "",
      available_from: form.vacancy || "",
      total_floors: form.totalFloors || "",
      build_year: form.buildYear || "",
      description: form.description,
      room_memo: null,
      building_memo: null,
      building_password: form.buildingPassword || null,
      room_password: form.roomPassword || null,
      options: [
        ...form.options,
        ...form.facilities,
        ...(form.pet ? [`반려동물_${form.pet}`] : []),
      ],
      images: form.images,
      views: 0,
      lat,
      lng,
      is_new: false,
      is_hot: false,
      elevator: form.options.includes("엘리베이터"),
      status: "active" as const,
      registered_date: new Date().toISOString().split("T")[0],
      agent_name: myAgentName || contactParts,
      registered_by: user?.userId ?? null,
      note: [
        form.contactOwner && `건물주: ${form.contactOwner}`,
        form.contactOwner2 && `건물주2: ${form.contactOwner2}`,
        ...form.extraOwners.map((o, i) => o && `건물주${i + 3}: ${o}`).filter(Boolean),
        form.contactBroker && `부동산: ${form.contactBroker}`,
        form.contactTenant && `세입자: ${form.contactTenant}`,
        form.contactManager && `관리인: ${form.contactManager}`,
        form.keyMoney && `권리금: ${form.keyMoney}`,
        (form.tradeType === "매매" || isBuildingSale) && form.salePrice && `매매가: ${form.salePrice}만원`,
        isBuildingSale && form.landArea && `대지: ${form.landArea}`,
        isBuildingSale && form.buildingArea && `건평: ${form.buildingArea}`,
        form.tenantOccupied && `세입자거주: 예`,
        form.tenantOccupied && form.tenantDeposit && `세입자전세금: ${form.tenantDeposit}`,
        form.tenantOccupied && form.tenantMonthly && `세입자월세: ${form.tenantMonthly}`,
        form.vacateDate && `퇴거일: ${form.vacateDate}`,
        form.earlyExit && `중도퇴거: 세입자중도퇴거`,
        isCollectiveBuilding && form.buildingDong && `동(棟): ${form.buildingDong}`,
        ...rentNotes,
        form.direction && `방향: ${form.direction}`,
        form.lhType && form.lhType !== "관계없음" && `LH: ${form.lhType}`,
        form.exitCleanFee && `청소비: ${form.exitCleanFee}`,
        form.brokerFee && `중개보수: ${form.brokerFee}`,
        (finalRoadAddress || form.roadAddress) && `도로명: ${finalRoadAddress || form.roadAddress}`,
      ].filter(Boolean).join("\n") || null,
      vacate_date: form.vacateDate || null,
    };

    // ── 중복 등록 방지: 같은 주소(동+번지) + 같은 호수 → 등록 차단 ──
    try {
      let dupQuery = supabase
        .from("properties")
        .select("id, unit_number")
        .eq("dong", finalDong)
        .eq("lot_number", finalLotNumber)
        .eq("status", "active");
      if (form.unitNo) {
        dupQuery = dupQuery.eq("unit_number", form.unitNo);
      } else {
        dupQuery = dupQuery.is("unit_number", null);
      }
      const { data: dupRows } = await dupQuery.limit(1);
      if (dupRows && dupRows.length > 0) {
        setSaving(false);
        await customAlert(
          form.unitNo
            ? `이미 등록된 매물입니다.\n같은 주소 · 같은 호수(${form.unitNo})로 등록할 수 없습니다.`
            : "이미 등록된 매물입니다.\n같은 주소로 중복 등록할 수 없습니다."
        );
        return;
      }
    } catch (e) {
      // 조회 실패 시 진행 (네트워크 등)
      console.warn("[duplicate-check] 실패:", e);
    }

    const { data: insertedRow, error } = await supabase.from("properties").insert(payload).select("id").single();
    setSaving(false);

    if (!error && form.dong) {
      // ── cheongju_contacts 동기화 (소유주/관리인 등 연락처는 필히 저장) ──
      const contactDistrict = districtVal ?? "";
      const hasContact = !!(form.contactOwner || form.contactOwner2 || form.extraOwners.some(Boolean) || form.contactManager || form.contactBroker);
      const isCollective = form.buildingType === "집합건물" || COLLECTIVE_DETAIL_TYPES.some((t) => t === form.detailType);
      const unitVal = form.unitNo || null;

      // 집합건물은 호수별로 저장되도록 호수 필수
      const canSaveContact = hasContact && (!isCollective || !!unitVal);
      if (canSaveContact) {
        const extraList = [form.contactOwner2, ...form.extraOwners].filter(Boolean);
        const extraMemo = extraList.length > 0 ? `EXTRA_OWNERS:[${extraList.join(",")}]` : null;
        const upsertPayload: Record<string, unknown> = {
          district: contactDistrict,
          dong: finalDong,
          lot_number: finalLotNumber || "",
          unit_number: isCollective ? unitVal : null,
          phone: form.contactOwner || form.contactManager || "",
          contact_owner: form.contactOwner || null,
          contact_manager: form.contactManager || null,
          contact_broker: form.contactBroker || null,
          memo: extraMemo,
          is_visible: true,
        };
        if (form.buildingName && form.buildingName.trim()) {
          upsertPayload.building_name = form.buildingName.trim();
        }
        const { error: contactErr } = await saveCheongjuContact(upsertPayload as never);
        if (contactErr) console.error("[청주연락처] upsert 오류:", contactErr.message);
      }
    }


    if (error) {
      setSaveError("저장 중 오류가 발생했습니다: " + error.message);
      return;
    }

    // ── 건축물대장·토지대장 백그라운드 자동 조회 (캐싱) ──
    if (insertedRow?.id) {
      const address = ["충북", form.sigungu, form.dong, form.lotNumber].filter(Boolean).join(" ");
      prefetchPropertySummary(address, insertedRow.id).catch(() => {});
    }

    setSubmitted(true);
  };

  const scrollRef = useRef<HTMLDivElement>(null);

  const goNext = () => {
    if (step === 1 && validateStep1()) { setStep(2); scrollRef.current?.scrollTo(0, 0); }
    else if (step === 2 && validateStep2()) { setStep(3); scrollRef.current?.scrollTo(0, 0); }
    else if (step === 3 && validateStep3()) handleSubmit();
  };

  const goPrev = () => {
    if (step > 1) { setStep((s) => (s - 1) as 1 | 2 | 3); scrollRef.current?.scrollTo(0, 0); }
  };

  return (
    <div className="fixed inset-0 z-[10200] flex items-center justify-center p-4"
      style={{ background: "rgba(10,20,50,0.55)", backdropFilter: "blur(4px)" }}>
      <div className="bg-card w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden"
        style={{ boxShadow: "0 24px 64px rgba(10,45,110,0.25)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0"
          style={{ background: "hsl(var(--header-bg))" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">매물 등록</h2>
              <p className="text-xs text-white/50">빠르고 간편하게 공실을 등록하세요</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors rounded-lg p-1.5 hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        {!submitted && (
          <div className="px-6 pt-4 pb-2 flex-shrink-0">
            <div className="flex gap-1.5 mb-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-300 ${s <= step ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{step}/3 {STEP_LABELS[step - 1]}</p>
          </div>
        )}

        {/* Body */}
        {submitted ? <SuccessView onClose={onClose} /> : (
          <div ref={scrollRef} className="overflow-y-auto flex-1 px-6 py-4">
            {step === 1 && <Step1 form={form} set={set} errors={errors} />}
            {step === 2 && <Step2 form={form} set={set} toggleOption={toggleOption} errors={errors} />}
            {step === 3 && (
              <Step3
                form={form}
                set={set}
                errors={errors}
                uploading={uploading}
                fileInputRef={fileInputRef}
                onImageUpload={handleImageUpload}
                onImageRemove={removeImage}
                onImageSetMain={setMainImage}
                onImageReorder={(arr) => setForm((f) => ({ ...f, images: arr }))}
              />
            )}

            {saveError && (
              <p className="text-xs text-destructive text-center mt-2">{saveError}</p>
            )}

            {/* 숨김 파일 input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleImageUpload(e.target.files)}
            />

            <div className="flex gap-3 pt-4 pb-2 sticky bottom-0 bg-card">
              <button type="button" onClick={step === 1 ? onClose : goPrev}
                disabled={saving || uploading}
                className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50">
                {step === 1 ? "취소" : "이전"}
              </button>
              <button type="button" onClick={goNext}
                disabled={saving || uploading}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-extrabold hover:bg-primary/90 transition-colors disabled:opacity-70"
                style={{ boxShadow: "0 4px 16px hsl(var(--primary)/0.3)" }}>
                {saving ? "등록 중..." : uploading ? "사진 업로드 중..." : step === 3 ? "매물 등록" : "다음"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Step 1 ─── */
function Step1({ form, set, errors }: { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void; errors: Record<string, string> }) {
  const [addressVerified, setAddressVerified] = useState<null | "success" | "fail">(null);
  const [verifying, setVerifying] = useState(false);
  const [oneRoomModalOpen, setOneRoomModalOpen] = useState(false);
  const sigunguList = CHEONGJU_SIGUNGU;
  const dongList = DONG_MAP[form.sigungu] ?? [];

  const handleAddressVerify = async () => {
    const addr = form.lotNumber?.match(/[가-힣].*(로|길)\s/)
      ? form.lotNumber
      : ["충북", form.sigungu, form.dong, form.lotNumber].filter(Boolean).join(" ");
    if (!addr.trim()) return;
    setVerifying(true);
    setAddressVerified(null);
    try {
      const { data, error } = await supabase.functions.invoke("geocode", { body: { address: addr } });
      if (!error && data?.success) {
        setAddressVerified("success");
        // 도로명 입력 시 지번으로 자동 변환
        if (data.jibunAddress) {
          const jibunMatch = (data.jibunAddress as string).match(/([가-힣]+[동리읍면])\s+([\d-]+)$/);
          if (jibunMatch) {
            set("dong", jibunMatch[1]);
            set("lotNumber", jibunMatch[2]);
          }
        }
      } else {
        setAddressVerified("fail");
      }
    } catch {
      setAddressVerified("fail");
    } finally {
      setVerifying(false);
    }

    // 기존 등록된 건물명 자동 가져오기
    if (!form.buildingName && form.dong && form.lotNumber) {
      try {
        const { data: existing } = await supabase
          .from("properties")
          .select("building_name")
          .eq("dong", form.dong)
          .eq("lot_number", form.lotNumber)
          .not("building_name", "is", null)
          .order("registered_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existing?.building_name) {
          set("buildingName", existing.building_name);
        }
      } catch {}
    }
  };
  const isBuildingSale = ["건물매매","단독매매","창고/공장매매","구분상가매매","상가주택매매","상가건물매매","다가구매매","다중매매"].includes(form.detailType);

  return (
    <div className="flex flex-col gap-5">
      {/* 거래 방식 */}
      <Section label="거래 방식">
        <div className="flex gap-5">
          {BROKER_TYPES.map((t) => <Radio key={t} checked={form.brokerType === t} onClick={() => set("brokerType", t)}>{t}</Radio>)}
        </div>
      </Section>

      {/* 거래 종류 */}
      <Section label="거래 종류">
        <div className="flex gap-5">
          {TRADE_TYPES.map((t) => <Radio key={t} checked={form.tradeType === t} onClick={() => set("tradeType", t)}>{t}</Radio>)}
        </div>
      </Section>

      {/* 매물 종류 */}
      <Section label="매물 종류">
        <div className="flex gap-5">
          {BUILDING_TYPES.map((t) => <Radio key={t} checked={form.buildingType === t} onClick={() => set("buildingType", t)}>{t}</Radio>)}
        </div>
      </Section>


      {/* 세부 종류 - 매물종류 토지 선택 시 숨김 */}
      {form.buildingType !== "토지" && (
        <Section label="세부 종류" error={errors.detailType || errors.oneRoomLayout}>
          {PROPERTY_TYPE_GROUPS_REG.filter(({ group }) => !(["단독건물","집합건물"].includes(form.buildingType) && group === "토지")).map(({ group, types }) => (
            <div key={group} className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                {group}
                {group === "주거형" && (
                  <span className="ml-1.5 text-[10px] font-semibold normal-case tracking-normal" style={{ color: "hsl(var(--primary))" }}>
                    (중복가능)
                  </span>
                )}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {types.map((t) => {
                  const isPrimary = form.detailType === t;
                  const primaryIsCollective = (COLLECTIVE_DETAIL_TYPES as readonly string[]).includes(form.detailType) || form.detailType === "도시형";
                  const isSubType = (ROOM_SUBTYPES as readonly string[]).includes(t);
                  // 집합건물(아파트/오피스텔 등) 또는 도시형 1차 선택 후, 원룸/투룸/쓰리룸 등은 추가 다중 선택 가능
                  const canMultiSelect = primaryIsCollective && isSubType && !isPrimary;
                  const isExtra = form.extraRoomTypes.includes(t);
                  const isSelected = isPrimary || isExtra;
                  return (
                    <button key={t} type="button" onClick={() => {
                      if (canMultiSelect) {
                        set("extraRoomTypes", isExtra ? form.extraRoomTypes.filter((x) => x !== t) : [...form.extraRoomTypes, t]);
                        return;
                      }
                      // 동일 1차 카테고리 재클릭 — 해제
                      if (isPrimary) {
                        set("detailType", "");
                        set("extraRoomTypes", []);
                        set("oneRoomLayout", "");
                        return;
                      }
                      // 1차 카테고리 변경 — 기존 extraRoomTypes 초기화 (단, 새 타입도 집합건물이면 유지)
                      const newPrimaryCollective = (COLLECTIVE_DETAIL_TYPES as readonly string[]).includes(t) || t === "도시형";
                      if (!newPrimaryCollective) set("extraRoomTypes", []);
                      set("detailType", t);
                      if (t !== "원룸") {
                        set("oneRoomLayout", "");
                      } else {
                        setOneRoomModalOpen(true);
                      }
                    }}
                      className="px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                      style={isSelected
                        ? { background: isPrimary ? "hsl(var(--primary))" : "hsl(var(--primary)/0.75)", color: "#fff", borderColor: "hsl(var(--primary))" }
                        : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
                      {t}{t === "원룸" && form.oneRoomLayout ? ` (${form.oneRoomLayout})` : ""}
                      {isExtra && !isPrimary ? " +" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* 원룸 형태 선택 모달 */}
      {oneRoomModalOpen && (
        <div
          className="fixed inset-0 z-[10300] flex items-center justify-center bg-black/50"
          onClick={() => setOneRoomModalOpen(false)}
        >
          <div
            className="bg-background rounded-2xl shadow-2xl w-[90%] max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-foreground">원룸 형태 선택</h3>
              <button
                type="button"
                onClick={() => setOneRoomModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">원룸의 구조 형태를 선택해주세요.</p>
            <div className="grid grid-cols-2 gap-3">
              {(["오픈형", "분리형"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    set("oneRoomLayout", opt);
                    setOneRoomModalOpen(false);
                  }}
                  className="flex flex-col items-center justify-center gap-1 py-4 rounded-xl border-2 transition-all"
                  style={form.oneRoomLayout === opt
                    ? { background: "hsl(var(--primary))", color: "#fff", borderColor: "hsl(var(--primary))" }
                    : { borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
                >
                  <span className="text-base font-bold">{opt}</span>
                  <span className="text-[10px] opacity-80">
                    {opt === "오픈형" ? "방·주방 일체형" : "방·주방 분리형"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}


      {/* 주소 입력 */}
      <Section label="주소 입력">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/30 bg-primary/5">
          <span className="text-xs text-muted-foreground">시/도</span>
          <span className="text-sm font-bold text-primary">충청북도 (충북)</span>
          <span className="ml-auto text-[10px] text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-full">고정</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            {errors.sigungu && <p className="text-xs text-destructive">{errors.sigungu}</p>}
            <Select value={form.sigungu} onChange={(v) => { set("sigungu", v); set("dong", ""); }} placeholder="시/군/구 선택" options={sigunguList} />
          </div>
          <div className="flex flex-col gap-1">
            {errors.dong && <p className="text-xs text-destructive">{errors.dong}</p>}
            <Select value={form.dong} onChange={(v) => set("dong", v)} placeholder="동/읍/면 선택" options={dongList} disabled={!form.sigungu} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="번지 또는 도로명주소 입력 (예: 123-4 또는 대농로 17)" value={form.lotNumber} onChange={(e) => set("lotNumber", e.target.value)} className={ic(false) + " pl-9"} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground/60 -mt-1">번지주소 또는 도로명주소 입력 가능</p>
        {/* 주소확인 버튼 */}
        <button type="button" onClick={handleAddressVerify} disabled={verifying || !form.lotNumber}
          className="w-full py-2 rounded-xl text-xs font-bold border transition-all disabled:opacity-40"
          style={{ borderColor: "hsl(var(--primary))", color: "hsl(var(--primary))", background: "hsl(var(--primary) / 0.05)" }}>
          {verifying ? "확인 중..." : "📍 주소확인"}
        </button>
        {addressVerified === "success" && (
          <p className="text-[11px] text-green-600 font-semibold">✅ 주소가 확인되었습니다</p>
        )}
        {addressVerified === "fail" && (
          <p className="text-[11px] text-destructive font-semibold">❌ 주소를 찾을 수 없습니다. 다시 확인해주세요</p>
        )}
      </Section>

      {/* 건물이름 - 토지/건물매매/단독매매/창고/공장매매/다가구매매 등 매매 제외 */}
      {!isBuildingSale && form.detailType !== "토지" && form.buildingType !== "토지" && (
        <Section label="건물이름">
          <input type="text" placeholder="건물 이름 (선택)" value={form.buildingName} onChange={(e) => set("buildingName", e.target.value)} className={ic(false)} />
        </Section>
      )}

      {/* 층수 / 호수 / 평수 — 매매 타입은 대지·건평·총층·건축년도 표시 */}
      {isBuildingSale ? (
        <>
          {/* 모든 매매 타입: 대지·건평·총층·건축년도 */}
          <div className="rounded-xl border-2 border-primary/30 bg-primary/4 p-3 flex flex-col gap-3">
            <p className="text-xs font-extrabold text-primary">🏢 건물 기본 정보</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground/70">대지 (평)</label>
                <input type="text" placeholder="예) 100" value={form.landArea} onChange={(e) => set("landArea", e.target.value)} className={ic(false)} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground/70">건평</label>
                <input type="text" placeholder="예) 80" value={form.buildingArea} onChange={(e) => set("buildingArea", e.target.value)} className={ic(false)} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground/70">총 층수</label>
                <input type="text" placeholder="예) 5층" value={form.totalFloors} onChange={(e) => set("totalFloors", e.target.value)} className={ic(false)} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-foreground/70">건축년도</label>
                <input type="text" placeholder="예) 2010" value={form.buildYear} onChange={(e) => set("buildYear", e.target.value)} className={ic(false)} />
              </div>
            </div>
          </div>
        </>
      ) : (form.detailType === "토지" || form.buildingType === "토지") ? (
        /* 토지: 면적만 표시 (층수/호수 숨김) */
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-foreground/70">면적 (평)</label>
          <input type="text" placeholder="예) 200평" value={form.area} onChange={(e) => set("area", e.target.value)} className={ic(false)} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* 집합건물 동(棟) 입력 */}
          {(form.buildingType === "집합건물" || COLLECTIVE_DETAIL_TYPES.some((t) => t === form.detailType)) && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-foreground/70">집합건물 동(棟) <span className="text-muted-foreground font-normal">(선택)</span></label>
              <input
                type="text"
                placeholder="예) 101동, A동"
                value={form.buildingDong}
                onChange={(e) => set("buildingDong", e.target.value)}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && !/동$/.test(v)) set("buildingDong", `${v}동`);
                }}
                className={ic(false)}
              />
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-foreground/70">층수</label>
              <Select value={form.floor} onChange={(v) => set("floor", v)} placeholder="선택" options={FLOOR_OPTIONS} />
              {errors.floor && <p className="text-xs text-destructive">{errors.floor}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-foreground/70">
                호수
                {(form.buildingType === "집합건물" || COLLECTIVE_DETAIL_TYPES.some((t) => t === form.detailType)) && (
                  <span className="ml-1 text-[10px] text-primary font-normal">호수별 소유주 자동로드</span>
                )}
              </label>
              <input type="text" placeholder="직접입력" value={form.unitNo} onChange={(e) => set("unitNo", e.target.value)} className={ic(!!errors.unitNo)} />
              {errors.unitNo && <p className="text-xs text-destructive">{errors.unitNo}</p>}
              {form.unitNo && (form.buildingType === "집합건물" || COLLECTIVE_DETAIL_TYPES.some((t) => t === form.detailType)) && (
                <p className="text-[10px] text-primary/70">🏠 이 호수의 소유주 연락처를 자동으로 불러옵니다</p>
              )}
              {form.unitNo && !(form.buildingType === "집합건물" || COLLECTIVE_DETAIL_TYPES.some((t) => t === form.detailType)) && (
                <p className="text-[10px] text-primary/70">✨ 이전 매물 정보 자동 불러오기 가능</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-foreground/70">
                면적
                {(form.buildingType === "집합건물" || COLLECTIVE_DETAIL_TYPES.some((t) => t === form.detailType)) && (
                  <span className="ml-1 text-[10px] text-primary font-normal">건축물대장 자동 기입</span>
                )}
              </label>
              <input type="text" placeholder="예) 59.94㎡ 또는 18평" value={form.area} onChange={(e) => set("area", e.target.value)} className={ic(false)} />
              {form.area && !form.area.includes("평") && (() => { const n = parseFloat(form.area.replace(/[^0-9.]/g, "")); return !isNaN(n) && n > 0 ? <p className="text-[10px] text-primary/70">→ 약 {(n / 3.3058).toFixed(1)}평</p> : null; })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Step 2 ─── */
function Step2({
  form, set, toggleOption, errors,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  toggleOption: (opt: string) => void;
  errors: Record<string, string>;
}) {
  const isLand = form.detailType === "토지" || form.buildingType === "토지";
  const isBuildingSale = ["건물매매","단독매매","창고/공장매매","구분상가매매","상가주택매매","상가건물매매","다가구매매","다중매매"].includes(form.detailType);
  const isCommercial = ["상가","사무실","공장·창고","지식산업"].includes(form.detailType);
  const isCollective = form.buildingType === "집합건물" || COLLECTIVE_DETAIL_TYPES.some((t) => t === form.detailType);

  // 매매 타입 목록 (수정폼과 동일)
  const SALE_TYPES = ["매매","단독매매","건물매매","다가구매매","다중매매","상가주택매매","상가건물매매","구분상가매매","창고/공장매매"];
  const isWarehouseSale = SALE_TYPES.includes(form.detailType);

  // 부가 시설 옵션 (아이콘 뱃지로 표시) — 수정폼과 동일
  const EXTRA_FACILITY_OPTIONS: { key: string; label: string; icon: React.ReactNode; bg: string; color: string; border: string }[] = [
    { key: "엘리베이터", label: "엘리베이터", icon: <img src={elevatorIcon} alt="엘리베이터" className="w-5 h-5 object-contain" style={{ imageRendering: '-webkit-optimize-contrast' as any }} />, bg: "#e0f2fe", color: "#0369a1", border: "#7dd3fc" },
    { key: "수도",   label: "수도",   icon: <img src={waterIcon} alt="수도" className="w-5 h-5 object-contain" style={{ imageRendering: '-webkit-optimize-contrast' as any }} />, bg: "#eff6ff", color: "#1d4ed8", border: "#93c5fd" },
    { key: "유선TV", label: "유선TV", icon: <img src={tvIcon} alt="유선TV" className="w-5 h-5 object-contain" style={{ imageRendering: '-webkit-optimize-contrast' as any }} />, bg: "#faf5ff", color: "#7e22ce", border: "#d8b4fe" },
    { key: "인터넷", label: "인터넷", icon: <img src={internetIcon} alt="인터넷" className="w-5 h-5 object-contain" style={{ imageRendering: '-webkit-optimize-contrast' as any }} />, bg: "#f0fdf4", color: "#15803d", border: "#86efac" },
    { key: "CCTV",  label: "CCTV",  icon: <img src={cctvIcon} alt="CCTV" className="w-5 h-5 object-contain" style={{ imageRendering: '-webkit-optimize-contrast' as any }} />, bg: "#f8fafc", color: "#475569", border: "#cbd5e1" },
    { key: "리모델링", label: "리모델링", icon: <img src={remodelingIcon} alt="리모델링" className="w-5 h-5 object-contain" style={{ imageRendering: '-webkit-optimize-contrast' as any }} />, bg: "#fff7ed", color: "#c2410c", border: "#fdba74" },
    { key: "여성전용", label: "여성전용", icon: <img src={femaleOnlyIcon} alt="여성전용" className="w-5 h-5 object-contain" style={{ imageRendering: '-webkit-optimize-contrast' as any }} />, bg: "#fdf2f8", color: "#be185d", border: "#f9a8d4" },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* 요약 칩 */}
      <div className="flex gap-1.5 flex-wrap">
        {[form.brokerType, form.tradeType, form.buildingType, form.detailType].filter(Boolean).map((v) => (
          <span key={v} className="text-xs bg-primary/10 text-primary font-semibold px-2.5 py-1 rounded-full">{v}</span>
        ))}
      </div>

      {/* 부가 시설 — 매매/상가임대류/토지 제외 */}
      {!isWarehouseSale && !isCommercial && !isLand && (
        <Section label="부가 시설">
          <div className="flex flex-wrap gap-2">
            {EXTRA_FACILITY_OPTIONS.map(({ key, label, icon, bg, color, border }) => {
              const isActive = form.options.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    const cur = form.options;
                    set("options", isActive ? cur.filter((o) => o !== key) : [...cur, key]);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all select-none"
                  style={isActive
                    ? { background: color, color: "#fff", borderColor: color }
                    : { background: bg, color, borderColor: border }
                  }
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* 옵션 — 매매/상가임대류/토지 제외 */}
      {!isWarehouseSale && !isCommercial && !isLand && (
        <Section label="옵션">
          {/* 풀옵션 버튼 */}
          <div className="mb-2">
            <button
              type="button"
              onClick={() => {
                const FULL_OPTIONS = ["냉장고","세탁기","에어컨","TV","전자레인지","인터넷","가스레인지","수도"];
                const current = new Set(form.options);
                const allSelected = FULL_OPTIONS.every(o => current.has(o));
                if (allSelected) {
                  FULL_OPTIONS.forEach(o => current.delete(o));
                } else {
                  FULL_OPTIONS.forEach(o => current.add(o));
                }
                set("options", Array.from(current));
              }}
              className="px-4 py-1.5 rounded-xl text-xs font-extrabold border-2 transition-all"
              style={
                ["냉장고","세탁기","에어컨","TV","전자레인지","인터넷","가스레인지","수도"].every(o => form.options.includes(o))
                  ? { background: "hsl(var(--primary))", color: "#fff", borderColor: "hsl(var(--primary))" }
                  : { background: "transparent", color: "hsl(var(--primary))", borderColor: "hsl(var(--primary))" }
              }
            >
              ✨ 풀옵션
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {ROOM_OPTIONS.map((opt) => (
              <button key={opt} type="button" onClick={() => toggleOption(opt)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  form.options.includes(opt)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:border-primary/50"
                }`}>{opt}</button>
            ))}
          </div>
        </Section>
      )}

      {/* 방 비번 / 건물 비번 — 매매/토지 제외 (상가임대류 포함) */}
      {!isWarehouseSale && !isLand && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-foreground/70">호실 비번</label>
            <input type="text" placeholder="방 비밀번호" value={form.roomPassword} onChange={(e) => set("roomPassword", e.target.value)} className={ic(false)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-foreground/70">건물 비번</label>
            <input type="text" placeholder="건물 비밀번호" value={form.buildingPassword} onChange={(e) => set("buildingPassword", e.target.value)} className={ic(false)} />
          </div>
        </div>
      )}

      {/* 방향 — 매매/상가임대류/토지 제외 */}
      {!isWarehouseSale && !isCommercial && !isLand && (
        <Section label="방향">
          <div className="flex flex-wrap gap-2">
            {DIRECTION_OPTIONS.map((d) => (
              <button key={d} type="button" onClick={() => set("direction", form.direction === d ? "" : d)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  form.direction === d
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:border-primary/50"
                }`}>{d}</button>
            ))}
          </div>
        </Section>
      )}

      {/* 공실 여부 — 매매 타입이더라도 집합건물이면 표시 */}
      {(form.tradeType !== "매매" || isCollective) && !isLand && !isBuildingSale && (
        <Section label="공실여부">
          <div className="flex gap-3">
            {VACANCY_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => set("vacancy", form.vacancy === t ? "공실" : t)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                  form.vacancy === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:border-primary/50"
                }`}>{t === "세입자 거주중" ? "거주중" : t}</button>
            ))}
          </div>

          {/* 단기가능 체크박스 */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl border transition-all"
            style={{
              background: form.options.includes("단기가능") ? "hsl(217 91% 97%)" : "hsl(var(--muted)/0.3)",
              borderColor: form.options.includes("단기가능") ? "hsl(217 91% 65%)" : "hsl(var(--border))",
            }}>
            <label className="flex items-center gap-2 text-sm cursor-pointer w-full"
              style={{ color: form.options.includes("단기가능") ? "hsl(217 91% 40%)" : undefined }}>
              <input type="checkbox"
                checked={form.options.includes("단기가능")}
                onChange={(e) => {
                  const cur = form.options;
                  set("options", e.target.checked ? [...cur, "단기가능"] : cur.filter((o) => o !== "단기가능"));
                }}
                className="w-4 h-4 accent-primary" />
              <span className="font-semibold">단기 가능</span>
              {form.options.includes("단기가능") && (
                <span className="ml-auto text-[10px] font-extrabold px-1.5 py-0.5 rounded"
                  style={{ background: "hsl(217 91% 93%)", color: "hsl(217 91% 35%)", border: "1px solid hsl(217 91% 65%)" }}>
                  단기가능
                </span>
              )}
            </label>
          </div>

          {/* 반려동물 가능 여부 */}
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-foreground/70 flex items-center gap-1"><img src={petIcon} alt="반려동물" className="w-4 h-4 inline" /> 반려동물</p>
            <div className="flex gap-2">
              {(["가능", "불가"] as PetType[]).map((v) => {
                const label = v === "가능" ? "가능" : "불가";
                const isActive = form.pet === v;
                return (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => set("pet", form.pet === v ? "" : v)}
                    className="flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all"
                    style={
                      isActive
                        ? v === "가능"
                          ? { background: "hsl(142 71% 45%)", color: "#fff", borderColor: "hsl(142 71% 45%)" }
                          : v === "불가"
                          ? { background: "hsl(0 85% 55%)", color: "#fff", borderColor: "hsl(0 85% 55%)" }
                          : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }
                        : { background: "hsl(var(--background))", color: "hsl(var(--foreground))", borderColor: "hsl(var(--border))" }
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 세입자 중도퇴거 체크박스 */}
          <div className="flex items-center gap-3 mt-2 px-3 py-2 rounded-xl border transition-all"
            style={{
              background: form.earlyExit ? "hsl(0 85% 97%)" : "hsl(var(--muted)/0.3)",
              borderColor: form.earlyExit ? "hsl(0 85% 70%)" : "hsl(var(--border))",
            }}>
            <label className="flex items-center gap-2 text-sm cursor-pointer w-full" style={{ color: form.earlyExit ? "hsl(0 85% 45%)" : undefined }}>
              <input type="checkbox" checked={form.earlyExit}
                onChange={(e) => set("earlyExit", e.target.checked)} className="w-4 h-4 accent-destructive" />
              <span className={`font-semibold ${form.earlyExit ? "text-[hsl(0_85%_45%)]" : ""}`}>중도퇴거</span>
              {form.earlyExit && (
                <span className="ml-auto text-[10px] font-extrabold px-1.5 py-0.5 rounded"
                  style={{ background: "hsl(0 85% 93%)", color: "hsl(0 85% 45%)", border: "1px solid hsl(0 85% 70%)" }}>
                  중도퇴거
                </span>
              )}
            </label>
          </div>

          {/* 퇴거 예정일 */}
          <div className="flex flex-col gap-1 mt-1">
            <label className="text-xs font-semibold text-muted-foreground">
              퇴거 예정일
              <span className="ml-1 text-[10px] font-normal text-muted-foreground/70">(예: 2025.03.15)</span>
            </label>
            <input
              type="text"
              placeholder="예) 2025-03-15"
              value={form.vacateDate}
              maxLength={10}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, "").slice(0, 8);
                let formatted = raw;
                if (raw.length > 4) formatted = raw.slice(0, 4) + "-" + raw.slice(4);
                if (raw.length > 6) formatted = raw.slice(0, 4) + "-" + raw.slice(4, 6) + "-" + raw.slice(6);
                set("vacateDate", formatted);
              }}
              className={ic(false)}
              style={form.vacateDate ? { borderColor: "hsl(0 85% 60%)", background: "hsl(0 85% 98%)" } : {}}
            />
            {form.vacateDate && (
              <p className="text-[11px] font-semibold" style={{ color: "hsl(0 85% 45%)" }}>
                🚪 퇴거 예정: {form.vacateDate}
              </p>
            )}
          </div>
        </Section>
      )}

      {/* 금액 입력 */}
      <Section label="금액 입력" error={errors.amount}>
        <p className="text-[11px] text-muted-foreground/70 -mt-1">단위: 만원</p>
        {form.tradeType === "매매" || isBuildingSale ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <AmountInput label="매매가액 *" value={form.salePrice} onChange={(v) => set("salePrice", v)} placeholder="예) 15,000" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* 임대 방식 다중 선택 */}
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-bold text-foreground/70">임대 방식 (중복 선택 가능)</p>
              <div className="flex gap-2">
                {(["월세", "반전세", "전세"] as const).map((mode) => {
                  const isOn = form.rentModes.includes(mode);
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        const cur = form.rentModes;
                        const next = isOn ? cur.filter(m => m !== mode) : [...cur, mode];
                        set("rentModes", next.length === 0 ? ["월세"] : next);
                      }}
                      className="flex-1 py-2 rounded-xl text-xs font-bold border transition-all"
                      style={isOn
                        ? { background: "hsl(var(--primary))", color: "#fff", borderColor: "hsl(var(--primary))" }
                        : { background: "transparent", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }
                      }
                    >
                      {mode}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 월세 금액 */}
            {(form.rentModes.includes("월세") || form.rentModes.length === 0) && (
              <div className="rounded-xl border border-border bg-muted/20 p-3 flex flex-col gap-2">
                <p className="text-[11px] font-extrabold text-primary">💰 월세</p>
                <div className="grid grid-cols-2 gap-2">
                  <AmountInput label="보증금" value={form.deposit} onChange={(v) => set("deposit", v)} />
                  <AmountInput label="월세" value={form.monthlyRent} onChange={(v) => set("monthlyRent", v)} />
                </div>
              </div>
            )}
            {/* 반전세 금액 */}
            {form.rentModes.includes("반전세") && (
              <div className="rounded-xl border border-border bg-muted/20 p-3 flex flex-col gap-2">
                <p className="text-[11px] font-extrabold text-primary">🏠 반전세</p>
                <div className="grid grid-cols-2 gap-2">
                  <AmountInput label="보증금" value={form.halfDeposit} onChange={(v) => set("halfDeposit", v)} />
                  <AmountInput label="월세" value={form.halfMonthly} onChange={(v) => set("halfMonthly", v)} />
                </div>
              </div>
            )}
            {/* 전세 금액 */}
            {form.rentModes.includes("전세") && (
              <div className="rounded-xl border border-border bg-muted/20 p-3 flex flex-col gap-2">
                <p className="text-[11px] font-extrabold text-primary">🏡 전세</p>
                <AmountInput label="보증금" value={form.jeonseDeposit} onChange={(v) => set("jeonseDeposit", v)} />
              </div>
            )}
          </div>
        )}
        {/* 관리비 + 청소비 + 중개보수 — 창고/공장매매 제외 */}
        {!isWarehouseSale && (
          <div className="grid grid-cols-2 gap-3 mt-1">
            {["상가","식당·카페","사무실","공장·창고","병원·학원","지식산업","기타임대","상가주택매매","상가건물매매","구분상가매매","지식산업매매"].includes(form.detailType) && (
              <div className="col-span-2">
                <AmountInput label="권리금" value={form.keyMoney} onChange={(v) => set("keyMoney", v)} placeholder="없으면 0 또는 비워두기" />
              </div>
            )}
            <AmountInput label="관리비" value={form.managementFee} onChange={(v) => set("managementFee", v)} />
            <AmountInput label="퇴실 청소비" value={form.exitCleanFee} onChange={(v) => set("exitCleanFee", v)} />
            <div className="col-span-2">
              <AmountInput label="중개보수" value={form.brokerFee} onChange={(v) => set("brokerFee", v)} placeholder="예) 협의" noUnit />
            </div>
          </div>
        )}
        {/* 창고/공장매매: 중개보수만 표시 */}
        {isWarehouseSale && (
          <div className="grid grid-cols-1 gap-3 mt-1">
            <AmountInput label="중개보수" value={form.brokerFee} onChange={(v) => set("brokerFee", v)} placeholder="예) 협의" noUnit />
          </div>
        )}
      </Section>

      {/* LH 전세대출 — '전세' 임대방식 선택 시에만 표시 */}
      {!isWarehouseSale && form.tradeType !== "매매" && !isLand && form.rentModes.includes("전세") && (
        <Section label="LH (전세대출)">
          <div className="flex gap-5">
            {LH_TYPES.map((t) => (
              <Radio key={t} checked={form.lhType === t} onClick={() => set("lhType", t)}>{t}</Radio>
            ))}
          </div>
        </Section>
      )}

      {/* 매물 소개 */}
      <Section label="매물 소개">
        <textarea
          placeholder="매물의 특징, 특이사항 등을 적어주세요."
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          maxLength={300} rows={3}
          className={ic(false) + " resize-none"}
        />
        <p className="text-right text-[11px] text-muted-foreground mt-0.5">{form.description.length} / 300</p>
      </Section>
    </div>
  );
}

/* ─── Step 3 ─── */
function Step3({
  form, set, errors, uploading, fileInputRef, onImageUpload, onImageRemove, onImageSetMain, onImageReorder,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  errors: Record<string, string>;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onImageUpload: (files: FileList | null) => Promise<void>;
  onImageRemove: (url: string) => void;
  onImageSetMain: (url: string) => void;
  onImageReorder?: (arr: string[]) => void;
}) {
  const [showOwner2, setShowOwner2] = useState(!!form.contactOwner2);
  const contacts: { key: keyof FormState; label: string; placeholder: string; required?: boolean }[] = [
    { key: "contactOwner", label: "소유주 연락처", placeholder: "예) 010-1234-5678" },
    { key: "contactBroker", label: "부동산 연락처", placeholder: "예) 043-123-4567" },
    { key: "contactTenant", label: "세입자 연락처", placeholder: "예) 010-9876-5432" },
    { key: "contactManager", label: "관리인 연락처", placeholder: "예) 010-5555-6666" },
  ];

  return (
    <div className="flex flex-col gap-5">

      {/* 매물 사진 */}
      <Section label="매물 사진">
        {form.images.length > 0 && (
          <ImagePreviewCarousel images={form.images} onRemove={onImageRemove} onSetMain={onImageSetMain} onReorder={onImageReorder} />
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed transition-all hover:border-primary hover:bg-primary/5 disabled:opacity-50"
          style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
        >
          {uploading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">업로드 중...</span></>
          ) : (
            <><ImagePlus className="w-4 h-4" /><span className="text-sm font-medium">사진 추가 {form.images.length > 0 ? `(${form.images.length}장)` : "(여러 장 가능)"}</span></>
          )}
        </button>
        <p className="text-[11px] text-muted-foreground/60 -mt-1">첫 번째 사진이 대표 이미지로 설정됩니다</p>
      </Section>

      {/* 연락처 */}
      <Section label="연락처">
        <div className="flex flex-col gap-3">
          {/* 소유주 연락처 1 + 추가 버튼 */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-foreground/70">소유주 연락처</label>
              <button type="button" onClick={() => {
                if (!form.contactOwner2) { setShowOwner2(true); }
                else { set("extraOwners", [...form.extraOwners, ""]); }
              }}
                className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-0.5">
                <span className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-black">+</span>
                소유주 추가
              </button>
            </div>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="tel" placeholder="예) 010-1234-5678"
                value={form.contactOwner as string}
                onChange={(e) => set("contactOwner", formatPhone(e.target.value))}
                className={ic(!!(errors.contactOwner)) + " pl-9"} />
            </div>
          </div>
          {/* 소유주 연락처 2 */}
          {showOwner2 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-foreground/70">소유주 연락처 2</label>
                <button type="button" onClick={() => { setShowOwner2(false); set("contactOwner2", ""); }}
                  className="text-[10px] font-bold text-destructive hover:text-destructive/80 transition-colors">삭제</button>
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="tel" placeholder="예) 010-5678-1234"
                  value={form.contactOwner2 as string}
                  onChange={(e) => set("contactOwner2", formatPhone(e.target.value))}
                  className={ic(false) + " pl-9"} />
              </div>
            </div>
          )}
          {/* 추가 소유주들 (3, 4, 5...) */}
          {form.extraOwners.map((owner, idx) => (
            <div key={idx} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-foreground/70">소유주 연락처 {idx + 3}</label>
                <button type="button"
                  onClick={() => set("extraOwners", form.extraOwners.filter((_, i) => i !== idx))}
                  className="text-[10px] font-bold text-destructive hover:text-destructive/80 transition-colors">삭제</button>
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="tel" placeholder={`예) 010-0000-0000`}
                  value={owner}
                  onChange={(e) => {
                    const next = [...form.extraOwners];
                    next[idx] = formatPhone(e.target.value);
                    set("extraOwners", next);
                  }}
                  className={ic(false) + " pl-9"} />
              </div>
            </div>
          ))}
          {/* 나머지 연락처 */}
          {contacts.filter(c => c.key !== "contactOwner").map(({ key, label, placeholder, required }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-foreground/70">
                {label} {required && <span className="text-destructive">*</span>}
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="tel" placeholder={placeholder}
                  value={form[key] as string}
                  onChange={(e) => set(key, formatPhone(e.target.value))}
                  className={ic(!!(errors[key])) + " pl-9"}
                />
              </div>
              {errors[key] && <p className="text-xs text-destructive">{errors[key]}</p>}
            </div>
          ))}
        </div>
      </Section>

      {/* 노출 설정 */}
      <Section label="노출 설정">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
            <div>
              <p className="text-sm font-semibold text-foreground">매물 노출</p>
              <p className="text-xs text-muted-foreground">플랫폼에 매물을 공개합니다</p>
            </div>
            <OnOffToggle checked={form.expose} onClick={() => set("expose", !form.expose)} />
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ─── Image Preview Carousel (드래그/터치로 순서 변경) ─── */
function ImagePreviewCarousel({
  images,
  onRemove,
  onSetMain,
  onReorder,
}: {
  images: string[];
  onRemove: (url: string) => void;
  onSetMain?: (url: string) => void;
  onReorder?: (reordered: string[]) => void;
}) {
  const [idx, setIdx] = useState(0);
  const safeIdx = Math.min(idx, images.length - 1);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  // 클릭/드래그 구분용
  const pressRef = useRef<{ x: number; y: number; idx: number; moved: boolean } | null>(null);
  const DRAG_THRESHOLD = 5; // px

  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);

  const handleRemove = (url: string) => {
    const newLen = images.length - 1;
    if (safeIdx >= newLen && newLen > 0) setIdx(newLen - 1);
    onRemove(url);
  };

  const moveItem = (from: number, to: number) => {
    if (from === to) return;
    const arr = [...images];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    onReorder?.(arr);
    setIdx(to);
  };

  // 통합 포인터 기반 DnD (마우스 + 터치 동일 처리)
  const onPointerDown = (e: React.PointerEvent, i: number) => {
    pressRef.current = { x: e.clientX, y: e.clientY, idx: i, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = pressRef.current;
    if (!p) return;
    if (!p.moved) {
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;
      p.moved = true;
      setDragIdx(p.idx);
    }
    if (dragIdx === null && p.moved) setDragIdx(p.idx);
    const curDrag = dragIdx ?? p.idx;
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const target = el?.closest<HTMLElement>("[data-thumb-idx]");
    if (target) {
      const i = parseInt(target.dataset.thumbIdx ?? "-1", 10);
      if (!isNaN(i) && i !== curDrag) {
        setOverIdx(i);
        moveItem(curDrag, i);
        setDragIdx(i);
        pressRef.current = { ...p, idx: i, moved: true };
      }
      return;
    }
    // 메인 프리뷰 위에 드롭하면 대표(인덱스 0)로 이동
    const mainTarget = el?.closest<HTMLElement>("[data-main-drop]");
    if (mainTarget && curDrag !== 0) {
      setOverIdx(0);
      moveItem(curDrag, 0);
      setDragIdx(0);
      pressRef.current = { ...p, idx: 0, moved: true };
    }
  };
  const onPointerUp = (e: React.PointerEvent, i: number) => {
    const p = pressRef.current;
    pressRef.current = null;
    setDragIdx(null);
    setOverIdx(null);
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    // 이동 없으면 클릭으로 처리 → 메인 이미지 선택
    if (p && !p.moved) setIdx(i);
  };
  const onPointerCancel = () => {
    pressRef.current = null;
    setDragIdx(null); setOverIdx(null);
  };

  const isMain = safeIdx === 0;

  // 메인 프리뷰 스와이프
  const swipeRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const onMainTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onMainTouchEnd = (e: React.TouchEvent) => {
    const s = swipeRef.current;
    swipeRef.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next(); else prev();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        data-main-drop
        className="relative w-full rounded-xl overflow-hidden bg-muted border border-border"
        style={{ height: 280, touchAction: "pan-y" }}
        onTouchStart={onMainTouchStart}
        onTouchEnd={onMainTouchEnd}
      >
        <div
          className="flex h-full w-full transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${safeIdx * 100}%)` }}
        >
          {images.map((src, i) => (
            <div key={src} className="h-full w-full flex-shrink-0 relative">
              <img src={src} alt={`사진 ${i + 1}`} loading="eager" decoding="async" draggable={false} className="w-full h-full object-cover pointer-events-none select-none" />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
        <button type="button" onClick={() => handleRemove(images[safeIdx])} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-destructive flex items-center justify-center transition-colors">
          <X className="w-3.5 h-3.5 text-white" />
        </button>
        {isMain ? (
          <span className="absolute top-2 left-2 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">⭐ 대표</span>
        ) : (
          onSetMain && (
            <button type="button" onClick={() => { onSetMain(images[safeIdx]); setIdx(0); }} className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors" style={{ background: "rgba(0,0,0,0.55)", color: "#fff", border: "1px solid rgba(255,255,255,0.4)" }}>
              대표로 설정
            </button>
          )
        )}
        {images.length > 1 && (
          <>
            <button type="button" onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center backdrop-blur-sm transition-colors">
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            <button type="button" onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center backdrop-blur-sm transition-colors">
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
            <div className="absolute bottom-2 right-3 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
              {safeIdx + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {/* 썸네일 그리드 — 사진 전체를 누른 채로 끌어 순서 변경, 탭하면 대표 미리보기로 선택 */}
      {images.length > 1 && (
        <>
          <p className="text-[11px] text-muted-foreground -mb-1">사진을 길게 눌러 끌면 순서를 바꿀 수 있어요</p>
          <div className="flex flex-wrap gap-2">
            {images.map((src, i) => (
              <div
                key={src}
                data-thumb-idx={i}
                onPointerDown={(e) => onPointerDown(e, i)}
                onPointerMove={onPointerMove}
                onPointerUp={(e) => onPointerUp(e, i)}
                onPointerCancel={onPointerCancel}
                className="relative w-[calc((100%-1.5rem)/4)] sm:w-24 aspect-square rounded-lg overflow-hidden border-2 select-none bg-muted cursor-grab active:cursor-grabbing"
                style={{
                  touchAction: "none",
                  borderColor: i === safeIdx ? "hsl(var(--primary))" : overIdx === i ? "hsl(var(--accent))" : "transparent",
                  opacity: dragIdx === i ? 0.5 : 1,
                  transform: dragIdx === i ? "scale(1.05)" : "scale(1)",
                  boxShadow: dragIdx === i ? "0 6px 16px rgba(0,0,0,0.25)" : "none",
                  transition: "transform 180ms ease, opacity 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
                  willChange: "transform",
                }}
              >
                <img src={src} alt={`사진 ${i + 1}`} className="w-full h-full object-cover pointer-events-none" draggable={false} />
                <div className="absolute top-0 left-0 right-0 h-5 bg-gradient-to-b from-black/55 to-transparent pointer-events-none flex items-center justify-center">
                  <GripVertical className="w-3.5 h-3.5 text-white/90" />
                  <GripVertical className="w-3.5 h-3.5 text-white/90 -ml-2" />
                </div>
                {i === 0 && (
                  <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] font-bold bg-primary/85 text-white leading-4 pointer-events-none">대표</span>
                )}
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); handleRemove(src); }}
                  className="absolute top-0 right-0 w-5 h-5 rounded-bl-md bg-black/70 hover:bg-destructive flex items-center justify-center z-10"
                  title="사진 삭제"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Success ─── */
function SuccessView({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 gap-4">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
        <span className="text-3xl">🎉</span>
      </div>
      <h3 className="text-lg font-extrabold text-foreground">등록 완료!</h3>
      <p className="text-sm text-muted-foreground text-center">
        매물이 즉시 등록되었습니다.<br />매물 목록에서 확인하세요.
      </p>
      <button onClick={onClose} className="mt-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors">
        확인
      </button>
    </div>
  );
}

/* ─── Shared UI Helpers ─── */
const ic = (hasError: boolean) =>
  `w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all bg-background text-foreground placeholder:text-muted-foreground ${
    hasError
      ? "border-destructive focus:ring-2 focus:ring-destructive/20"
      : "border-border focus:border-primary focus:ring-2 focus:ring-primary/20"
  }`;

function Section({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {label && <p className="text-sm font-bold text-foreground">{label}</p>}
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Radio({ checked, onClick, children }: { checked: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer select-none" onClick={onClick}>
      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked ? "border-primary" : "border-muted-foreground/40"}`}>
        {checked && <span className="w-2 h-2 rounded-full bg-primary" />}
      </span>
      <span className={`text-sm ${checked ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{children}</span>
    </label>
  );
}

function OnOffToggle({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all flex-shrink-0 ${
        checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      }`}>
      {checked ? "ON" : "OFF"}
    </button>
  );
}

function Select({
  value, onChange, placeholder, options, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[];
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2.5 text-sm rounded-xl border outline-none transition-all appearance-none bg-background text-foreground border-border focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-40 disabled:cursor-not-allowed pr-8"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
    </div>
  );
}

function AmountInput({
  label, value, onChange, placeholder = "만원", noUnit = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  noUnit?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-foreground/70">{label}</label>
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={ic(false) + (noUnit ? "" : " pr-10")}
        />
        {!noUnit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">만원</span>
        )}
      </div>
    </div>
  );
}

