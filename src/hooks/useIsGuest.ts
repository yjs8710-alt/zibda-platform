import { useAuth } from "./useAuth";

/**
 * 게스트(비로그인) 여부.
 * 로그인 인증되지 않은 사용자 + 일반회원은 게스트와 동일하게 취급한다.
 * (민감정보: 연락처/호수/비밀번호/로드뷰/도로명/메모/특이사항/건물명 미노출, 동까지만 노출)
 */
export function useIsGuest(): boolean {
  const { isAuthorized, isLoading, user } = useAuth();
  if (isLoading) return true;
  if (!isAuthorized) return true;
  if (user?.memberType === "일반회원") return true;
  return false;
}

/** 동/읍/면까지만 노출 (예: "충북 청주시 상당구 용암동 123-4" → "용암동") */
export function addressToDong(addr?: string | null): string {
  if (!addr) return "";
  const m = addr.match(/[가-힣]+(동|읍|면|리)/);
  return m ? m[0] : addr;
}
