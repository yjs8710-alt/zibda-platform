import React from "react";
import logoTransparent from "@/assets/logo-zibda-active-20260427-v4.png";

/** 사진 가운데 집다 로고 워터마크 — 흰색, 가로로 길게 */
interface PhotoWatermarkProps {
  size?: "sm" | "md" | "lg";
}

const PhotoWatermark = ({ size = "md" }: PhotoWatermarkProps) => {
  // 가로로 길게: 사진 너비의 큰 비율 차지
  const widthClass =
    size === "sm" ? "w-[75%] max-w-[200px]" :
    size === "lg" ? "w-[80%] max-w-[520px]" :
    "w-[78%] max-w-[340px]";
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none overflow-hidden">
      <img
        src={logoTransparent}
        alt=""
        draggable={false}
        className={`${widthClass} opacity-25 select-none`}
        style={{
          // 로고를 흰색으로 강제 변환 — 흐리게
          filter:
            "brightness(0) invert(1) drop-shadow(0 1px 3px rgba(0,0,0,0.25))",
        }}
      />
    </div>
  );
};

export default PhotoWatermark;
