// 매물 사진 업로드 유틸
// - 클라이언트에서 큰 이미지를 1920px / JPEG q0.82 로 리사이즈하여 업로드 용량을 대폭 축소
// - 여러 장은 병렬 업로드 (동시 4개)로 처리해 체감 속도 개선
import { supabase } from "@/integrations/supabase/client";

const MAX_DIM = 1920;
const JPEG_QUALITY = 0.82;
const CONCURRENCY = 4;

async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  // GIF/SVG는 그대로 사용
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
  // 1MB 미만이면 굳이 재인코딩하지 않음
  if (file.size < 1024 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return file;
    const { width, height } = bitmap;
    const scale = Math.min(1, MAX_DIM / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const canvas = typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement("canvas"), { width: w, height: h });
    const ctx = (canvas as any).getContext("2d");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob: Blob | null = "convertToBlob" in canvas
      ? await (canvas as OffscreenCanvas).convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY })
      : await new Promise((res) => (canvas as HTMLCanvasElement).toBlob(res, "image/jpeg", JPEG_QUALITY));
    if (!blob) return file;
    // 압축본이 원본보다 크면 원본 유지
    return blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

async function uploadOne(file: File, prefix: string): Promise<string | null> {
  const blob = await compressImage(file);
  const isJpeg = blob.type === "image/jpeg";
  const ext = isJpeg ? "jpg" : (file.name.split(".").pop() || "jpg");
  const path = `${prefix}${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from("property-images")
    .upload(path, blob, { upsert: false, contentType: blob.type || "image/jpeg", cacheControl: "31536000" });
  if (error) { console.error("업로드 실패:", error.message); return null; }
  const { data: urlData } = supabase.storage.from("property-images").getPublicUrl(path);
  return urlData?.publicUrl ?? null;
}

/**
 * 여러 파일을 압축 후 병렬 업로드. 입력 순서를 그대로 보존한다.
 * @param prefix 스토리지 경로 prefix (예: "properties/" 또는 `${dbId}/`)
 */
export async function uploadPropertyImages(files: FileList | File[] | null, prefix = "properties/"): Promise<string[]> {
  if (!files) return [];
  const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
  if (arr.length === 0) return [];

  const results: (string | null)[] = new Array(arr.length).fill(null);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, arr.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= arr.length) return;
      results[i] = await uploadOne(arr[i], prefix);
    }
  });
  await Promise.all(workers);
  return results.filter((u): u is string => !!u);
}
