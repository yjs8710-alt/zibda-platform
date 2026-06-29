// Supabase Storage 이미지 썸네일 변환 유틸
// 원본 public URL을 render(image transform) 엔드포인트로 변환하여
// 원하는 너비로 리사이즈된 작은 이미지를 받아온다.
// 변환 기능을 사용할 수 없는 경우 원본 URL로 안전하게 폴백한다.

const OBJECT = "/storage/v1/object/public/";
const RENDER = "/storage/v1/render/image/public/";

/**
 * Supabase Storage public URL을 썸네일 URL로 변환.
 * 매물 카드/사이드바 썸네일에서 수 MB 원본 이미지를 다운로드하지 않도록 한다.
 */
export function thumbUrl(url: string | undefined, width: number, quality = 85): string {
  if (!url) return "";
  if (!url.includes(OBJECT)) return url;
  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const w = Math.max(64, Math.round(width * dpr));
  return url.replace(OBJECT, RENDER) + `?width=${w}&quality=${quality}&resize=contain`;
}

/** 썸네일 변환에 실패했을 때 원본 URL로 되돌린다. */
export function originalFromThumb(url: string): string {
  if (!url.includes(RENDER)) return url;
  return url.replace(RENDER, OBJECT).split("?")[0];
}
