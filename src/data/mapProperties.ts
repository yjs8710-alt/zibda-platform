export interface MapProperty {
  id: number;
  dbId?: string;       // 실제 DB UUID (property_reports 등 연동용)
  regNo?: string;      // 매물 등록번호 (6자리)
  title: string;
  buildingName?: string;
  address: string;
  type: string;
  roomType?: string; // 원룸, 투베이, 투룸, 쓰리룸 등
  unitNumber?: string; // 호수
  area: string;
  floor: string;
  deposit: string;
  monthly: string;
  isNew?: boolean;
  isHot?: boolean;
  views: number;
  lat: number;
  lng: number;
  image: string;
  description: string;
 buildingMemo?: string; // 건물 메모
 buildingMemoRaw?: string; // 건물 메모 원문 (PROPOSAL_JSON 포함)
  roomMemo?: string;     // 방 메모
  memo?: string;         // 레거시 호환
  registeredDate?: string; // 등록일
  checkedDate?: string;    // 확인일
  options?: string[];      // 옵션 아이콘
  note?: string;           // 특이사항
  vacateDate?: string;     // 퇴거일
  buildingPassword?: string; // 건물 비번
  password?: string;         // 레거시 호환 (현관 비번)
  roomPassword?: string;     // 방 비번
  images?: string[];       // 여러장 사진
  contact: string;
  contactOwner?: string;
  contactOwner2?: string;
  contactManager?: string;
  contactTenant?: string;
  agentName: string;
  manageFee: string;
  parking: string;
  elevator: boolean;
  availableFrom: string;
  totalFloors: string;
  buildYear: string;
  roadAddress?: string;
  registeredBy?: string;   // 등록한 회원 user_id (본인 매물 수정 권한 판단용)
}

export const MAP_PROPERTIES: MapProperty[] = [];
