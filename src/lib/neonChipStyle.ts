import type { CSSProperties } from "react";

// Neon pill chip style: cyan → magenta gradient when active, white text always.
export const neonChipStyle = (isActive: boolean): CSSProperties =>
  isActive
    ? {
        background: "linear-gradient(90deg, #22d3ee 0%, #a855f7 50%, #ec4899 100%)",
        color: "#fff",
        borderColor: "rgba(255,255,255,0.85)",
        boxShadow:
          "0 0 0 2px rgba(168,85,247,0.35), 0 0 14px rgba(236,72,153,0.55), 0 0 22px rgba(34,211,238,0.45)",
        textShadow: "0 0 6px rgba(255,255,255,0.6)",
      }
    : {
        background: "transparent",
        color: "#ffffff",
        borderColor: "rgba(255,255,255,0.35)",
      };
