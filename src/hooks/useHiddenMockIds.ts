/**
 * localStorage 기반으로 임의 등록 매물(MAP_PROPERTIES) 숨김 ID 관리
 * - 삭제 시 해당 ID를 localStorage에 저장 → 지도/목록에서 필터링
 */
const STORAGE_KEY = "hidden_mock_property_ids";

function loadHiddenIds(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function saveHiddenIds(ids: Set<number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

import { useState, useCallback } from "react";

export function useHiddenMockIds() {
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(() => loadHiddenIds());

  const hideMockId = useCallback((id: number) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveHiddenIds(next);
      return next;
    });
  }, []);

  const restoreAll = useCallback(() => {
    setHiddenIds(new Set());
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { hiddenIds, hideMockId, restoreAll };
}

/** 전역 읽기 전용 헬퍼 (훅 없이 필터링할 때 사용) */
export function getHiddenMockIds(): Set<number> {
  return loadHiddenIds();
}
