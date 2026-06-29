import { createRoot } from "react-dom/client";

/**
 * jibda.co.kr 등 origin이 노출되는 alert 대신 사용하는 도로명 주소 모달.
 * 클릭 한 번으로 띄우고 닫을 수 있도록 호출 함수 형태로 제공.
 */
export function showRoadAddressModal(roadAddress: string) {
  if (typeof document === "undefined") return;

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const close = () => {
    try { root.unmount(); } catch {}
    if (container.parentNode) container.parentNode.removeChild(container);
  };

  root.render(
    <div
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 20000,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-2xl bg-background shadow-xl overflow-hidden"
      >
        <div className="px-5 pt-5 pb-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2">도로명 주소</p>
          <p className="text-sm font-bold text-foreground break-keep leading-relaxed">
            {roadAddress}
          </p>
        </div>
        <button
          onClick={close}
          className="w-full py-3 text-sm font-semibold text-white border-t border-border"
          style={{ background: "hsl(var(--primary))" }}
        >
          확인
        </button>
      </div>
    </div>
  );
}
