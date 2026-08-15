/**
 * Khoang cach Haversine (met) giua 2 toa do GPS - dung de gan co "on-site"/"off-site" cho
 * cham cong (xem attendance.service.ts computeIsOnSite()). Ham thuan, khong phu thuoc DB/HTTP,
 * cung mau voi task-status.util.ts (project-task-service) - de unit test doc lap.
 */
const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}
