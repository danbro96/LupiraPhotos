import { bboxToParam, haversineM } from '@danbro96/lupira-domain-places/geo';

export const NEAR_RADIUS_M = 150;
export const NEAR_FILTER_RADIUS_M = 300;

export interface SavedPlaceLike {
  id: string;
  label: string;
  latitude?: number | null;
  longitude?: number | null;
  isFavorite?: boolean;
  icon?: string | null;
}

const METERS_PER_DEGREE_LAT = 111_320;
const TIE_M = 1;

export function nearestSavedPlace<T extends SavedPlaceLike>(
  point: { latitude: number; longitude: number },
  saved: readonly T[],
  radiusM = NEAR_RADIUS_M,
): T | null {
  const from = { lat: point.latitude, lon: point.longitude };
  const within: { place: T; distance: number }[] = [];
  for (const place of saved) {
    if (place.latitude == null || place.longitude == null) continue;
    const distance = haversineM(from, { lat: place.latitude, lon: place.longitude });
    if (distance <= radiusM) within.push({ place, distance });
  }
  if (within.length === 0) return null;
  const nearest = Math.min(...within.map((w) => w.distance));
  const tied = within.filter((w) => w.distance <= nearest + TIE_M).map((w) => w.place);
  tied.sort((a, b) => Number(!!b.isFavorite) - Number(!!a.isFavorite) || a.label.localeCompare(b.label));
  return tied[0];
}

export function friendlyPlace(photo: { latitude?: number | null; longitude?: number | null }, saved: readonly SavedPlaceLike[]): string | null {
  if (photo.latitude == null || photo.longitude == null) return null;
  return nearestSavedPlace({ latitude: photo.latitude, longitude: photo.longitude }, saved)?.label ?? null;
}

/** A square around the saved place for the photo list's `bbox` filter; null where it would wrap a pole or the antimeridian. */
export function savedPlaceBbox(
  place: { latitude?: number | null; longitude?: number | null },
  radiusM = NEAR_FILTER_RADIUS_M,
): string | null {
  const { latitude, longitude } = place;
  if (latitude == null || longitude == null) return null;
  const latPad = radiusM / METERS_PER_DEGREE_LAT;
  const lonPad = radiusM / (METERS_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180));
  const minLat = latitude - latPad;
  const maxLat = latitude + latPad;
  const minLon = longitude - lonPad;
  const maxLon = longitude + lonPad;
  if (!Number.isFinite(lonPad) || minLat < -90 || maxLat > 90 || minLon < -180 || maxLon > 180) return null;
  return bboxToParam([minLon, minLat, maxLon, maxLat]).join(',');
}
