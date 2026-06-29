// Haversine 거리 계산 (미터 단위)
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // 지구 반지름 (m)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface RadiusCircle {
  lat: number;
  lng: number;
  radius: number; // meters
}

export function isInsideRadius(
  pLat: number,
  pLng: number,
  circle: RadiusCircle
): boolean {
  return haversineMeters(circle.lat, circle.lng, pLat, pLng) <= circle.radius;
}

export function formatRadius(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2)}km`;
  return `${Math.round(m)}m`;
}
