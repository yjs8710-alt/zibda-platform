// 이미지 다운로드 + 워터마크 유틸
// 봄날부동산(license_number === BOMNAL_LICENSE) 소속은 워터마크 없이 원본 다운로드

import { supabase } from "@/integrations/supabase/client";
import logoSrc from "@/assets/logo-zibda-active-20260427-v4.png";

export const BOMNAL_LICENSE = "43112-2024-00034";

/** 현재 로그인 사용자가 봄날부동산(워터마크 면제) 소속인지 (세션 캐시) */
let _exemptCache: { uid: string | null; value: boolean; ts: number } | null = null;
const EXEMPT_TTL_MS = 5 * 60 * 1000;
export async function isWatermarkExempt(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id ?? null;
    if (!uid) return false;
    const now = Date.now();
    if (_exemptCache && _exemptCache.uid === uid && now - _exemptCache.ts < EXEMPT_TTL_MS) {
      return _exemptCache.value;
    }
    const { data } = await supabase
      .from("agent_profiles")
      .select("license_number, status")
      .eq("user_id", uid)
      .maybeSingle();
    const value = !!data && data.license_number === BOMNAL_LICENSE && data.status === "approved";
    _exemptCache = { uid, value, ts: now };
    return value;
  } catch {
    return false;
  }
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// 로고는 한 번만 로드해 두고 재사용 (다운로드 속도 개선)
let _logoPromise: Promise<HTMLImageElement> | null = null;
function getLogo(): Promise<HTMLImageElement> {
  if (!_logoPromise) _logoPromise = loadImg(logoSrc);
  return _logoPromise;
}

async function fetchAsBlobUrl(src: string): Promise<string> {
  // Supabase 스토리지 등 CORS 가능한 URL은 fetch로 가져와 blob URL 변환
  const res = await fetch(src, { mode: "cors", cache: "force-cache" });
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 워터마크(집다 로고) 합성 후 다운로드 */
export async function downloadWithJibdaWatermark(src: string, filename = "image.jpg") {
  let workingSrc = src;
  try {
    workingSrc = await fetchAsBlobUrl(src);
  } catch {
    // CORS 실패 시 그대로 시도
  }

  const [img, logo] = await Promise.all([loadImg(workingSrc), getLogo()]);

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  // 우측 하단 로고 워터마크 (이미지의 약 22% 너비)
  const targetW = Math.max(120, Math.round(canvas.width * 0.22));
  const ratio = logo.naturalHeight / logo.naturalWidth;
  const targetH = Math.round(targetW * ratio);
  const margin = Math.round(canvas.width * 0.025);
  const x = canvas.width - targetW - margin;
  const y = canvas.height - targetH - margin;

  // 반투명 어두운 배경 + 로고
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  const padX = Math.round(targetW * 0.08);
  const padY = Math.round(targetH * 0.12);
  const radius = 12;
  const bx = x - padX, by = y - padY, bw = targetW + padX * 2, bh = targetH + padY * 2;
  ctx.beginPath();
  ctx.moveTo(bx + radius, by);
  ctx.arcTo(bx + bw, by, bx + bw, by + bh, radius);
  ctx.arcTo(bx + bw, by + bh, bx, by + bh, radius);
  ctx.arcTo(bx, by + bh, bx, by, radius);
  ctx.arcTo(bx, by, bx + bw, by, radius);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.95;
  ctx.drawImage(logo, x, y, targetW, targetH);
  ctx.globalAlpha = 1;

  await new Promise<void>((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob) triggerDownload(blob, filename);
        resolve();
      },
      "image/jpeg",
      0.92,
    );
  });

  if (workingSrc !== src) URL.revokeObjectURL(workingSrc);
}

/** 원본 그대로 다운로드 (봄날부동산 전용) */
export async function downloadOriginal(src: string, filename = "image.jpg") {
  try {
    const res = await fetch(src, { mode: "cors" });
    const blob = await res.blob();
    triggerDownload(blob, filename);
  } catch {
    // fallback: 새창으로 열기
    window.open(src, "_blank");
  }
}

export async function downloadPropertyImage(src: string, filename?: string) {
  const exempt = await isWatermarkExempt();
  const name = filename ?? `property_${Date.now()}.jpg`;
  if (exempt) {
    await downloadOriginal(src, name);
  } else {
    await downloadWithJibdaWatermark(src, name);
  }
}
