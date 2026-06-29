import { useEffect, useState, useCallback } from "react";

const FAV_KEY = "jibda:favorites:v1";
const ONLY_KEY = "jibda:favoritesOnly:v1";

type FavId = string | number;

let favCache: Set<string> | null = null;
const favListeners = new Set<() => void>();

function toKey(id: FavId): string {
  return String(id);
}

function loadFavorites(): Set<string> {
  if (favCache) return favCache;
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const arr = raw ? (JSON.parse(raw) as Array<string | number>) : [];
    favCache = new Set(arr.map((v) => String(v)));
  } catch {
    favCache = new Set();
  }
  return favCache;
}

function saveFavorites(next: Set<string>) {
  favCache = new Set(next);
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify([...favCache]));
  } catch {
    /* ignore */
  }
  favListeners.forEach((l) => l());
}

export function useFavorites() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    favListeners.add(l);
    return () => {
      favListeners.delete(l);
    };
  }, []);
  const favoritesSet = loadFavorites();

  const has = useCallback((id: FavId) => favoritesSet.has(toKey(id)), [favoritesSet]);

  const toggleFavorite = useCallback((id: FavId) => {
    const key = toKey(id);
    const next = new Set(loadFavorites());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    saveFavorites(next);
  }, []);

  const clearFavorites = useCallback(() => saveFavorites(new Set()), []);
  const setFavorites = useCallback((next: Set<FavId>) => {
    saveFavorites(new Set([...next].map(toKey)));
  }, []);

  // Backwards-compatible favorites Set with .has accepting string|number
  const favorites = {
    has: (id: FavId) => favoritesSet.has(toKey(id)),
    get size() { return favoritesSet.size; },
    [Symbol.iterator]: () => favoritesSet[Symbol.iterator](),
  } as unknown as Set<string | number>;

  return { favorites, has, toggleFavorite, clearFavorites, setFavorites };
}

let onlyCache: boolean | null = null;
const onlyListeners = new Set<() => void>();

function loadOnly(): boolean {
  if (onlyCache !== null) return onlyCache;
  try {
    onlyCache = localStorage.getItem(ONLY_KEY) === "1";
  } catch {
    onlyCache = false;
  }
  return onlyCache;
}

export function useFavoritesOnly() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    onlyListeners.add(l);
    return () => {
      onlyListeners.delete(l);
    };
  }, []);

  const enabled = loadOnly();
  const toggle = useCallback(() => {
    onlyCache = !loadOnly();
    try {
      localStorage.setItem(ONLY_KEY, onlyCache ? "1" : "0");
    } catch {
      /* ignore */
    }
    onlyListeners.forEach((l) => l());
  }, []);

  return { enabled, toggle };
}
