let overlayCount = 0;

export const pushOverlay = () => {
  overlayCount++;
};

export const popOverlay = () => {
  overlayCount = Math.max(0, overlayCount - 1);
};

export const hasOpenOverlay = () => overlayCount > 0;

/** 현재 열려있는 오버레이 수 (PropertyDetailPanel + 그 위 채팅 등 중첩 판별용) */
export const getOverlayCount = () => overlayCount;
