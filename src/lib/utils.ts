import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 전화번호 자동 하이픈 포맷
 * 01X-XXXX-XXXX 또는 0XX-XXX-XXXX (지역번호) 형식으로 변환
 */
export function formatPhone(value: string): string {
  // 숫자만 추출
  const digits = value.replace(/\D/g, "");

  if (digits.startsWith("02")) {
    // 서울 02 지역번호
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return digits.slice(0, 2) + "-" + digits.slice(2);
    if (digits.length <= 9) return digits.slice(0, 2) + "-" + digits.slice(2, 5) + "-" + digits.slice(5);
    return digits.slice(0, 2) + "-" + digits.slice(2, 6) + "-" + digits.slice(6, 10);
  } else if (digits.length <= 3) {
    return digits;
  } else if (digits.length <= 6) {
    return digits.slice(0, 3) + "-" + digits.slice(3);
  } else if (digits.length <= 10) {
    return digits.slice(0, 3) + "-" + digits.slice(3, 6) + "-" + digits.slice(6);
  } else {
    // 11자리: 010-XXXX-XXXX
    return digits.slice(0, 3) + "-" + digits.slice(3, 7) + "-" + digits.slice(7, 11);
  }
}

/**
 * 공인중개사 등록번호 자동 하이픈 포맷
 * 형식: XXXXX-YYYY-NNNNN (예: 43112-2024-00034)
 * - 앞 5자리(시군구 코드) - 4자리(연도) - 5자리(일련번호)
 */
export function formatLicenseNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 5) return digits;
  if (digits.length <= 9) return digits.slice(0, 5) + "-" + digits.slice(5);
  return digits.slice(0, 5) + "-" + digits.slice(5, 9) + "-" + digits.slice(9, 14);
}

