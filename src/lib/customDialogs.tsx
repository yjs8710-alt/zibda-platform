import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";

/**
 * origin(jibda.co.kr)이 자동 노출되는 window.confirm / window.prompt / window.alert 대신
 * 사용하는 커스텀 모달.
 */

type DialogProps = {
  type: "confirm" | "prompt" | "alert";
  message: string;
  placeholder?: string;
  defaultValue?: string;
  onClose: (result: string | boolean | null) => void;
};

const Dialog = ({ type, message, placeholder, defaultValue, onClose }: DialogProps) => {
  const [value, setValue] = useState(defaultValue || "");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  const close = (result: string | boolean | null) => {
    setVisible(false);
    setTimeout(() => onClose(result), 150);
  };

  const handleOk = () => {
    if (type === "prompt") close(value);
    else if (type === "confirm") close(true);
    else close(true);
  };
  const handleCancel = () => {
    if (type === "prompt") close(null);
    else if (type === "confirm") close(false);
    else close(true);
  };

  return (
    <div
      className="fixed inset-0 z-[20000] flex items-center justify-center p-6"
      style={{
        background: "rgba(0,0,0,0.5)",
        opacity: visible ? 1 : 0,
        transition: "opacity 150ms ease",
      }}
      onClick={handleCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-background shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {message}
          </p>
          {type === "prompt" && (
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleOk();
                if (e.key === "Escape") handleCancel();
              }}
              placeholder={placeholder}
              className="mt-3 w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          )}
        </div>
        <div className={`grid ${type === "alert" ? "grid-cols-1" : "grid-cols-2"} border-t border-border`}>
          {type !== "alert" && (
            <button
              onClick={handleCancel}
              className="py-3 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              취소
            </button>
          )}
          <button
            onClick={handleOk}
            className={`py-3 text-sm font-semibold text-white transition-colors ${type !== "alert" ? "border-l border-border" : ""}`}
            style={{ background: "linear-gradient(90deg, #ff6ec4 0%, #a78bfa 50%, #60a5fa 100%)" }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

function mount<T>(props: Omit<DialogProps, "onClose">): Promise<T> {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const cleanup = (result: any) => {
      root.unmount();
      container.remove();
      resolve(result as T);
    };
    root.render(<Dialog {...props} onClose={cleanup} />);
  });
}

export const customConfirm = (message: string) =>
  mount<boolean>({ type: "confirm", message });

export const customPrompt = (message: string, defaultValue?: string, placeholder?: string) =>
  mount<string | null>({ type: "prompt", message, defaultValue, placeholder });

export const customAlert = (message: string) =>
  mount<boolean>({ type: "alert", message });
