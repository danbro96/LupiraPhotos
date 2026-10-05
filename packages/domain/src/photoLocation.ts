import { formatCoords, chunk } from '@danbro96/lupira-domain-places/places';

export { chunk };

/** The server's cap on ids per relocate call. */
export const RELOCATE_MAX_IDS = 2000;

export interface LocationState {
  id: string;
  latitude?: number | null;
  longitude?: number | null;
  placeLabel?: string | null;
  geotagSource: 'None' | 'ExifGps' | 'LocationHistory' | 'Folder' | 'Manual' | (string & {});
}

export interface RelocateTarget {
  latitude: number;
  longitude: number;
  label: string;
}

const isMeasured = (item: LocationState) => item.geotagSource === 'ExifGps' || item.geotagSource === 'LocationHistory';

export function measuredCount(items: readonly LocationState[]): number {
  return items.filter(isMeasured).length;
}

/** Relocating overwrites a measured fix, so the caller asks first. */
export function needsOverwriteConfirm(items: readonly LocationState[]): boolean {
  return items.some(isMeasured);
}

/**
 * Undo of a relocate: a photo that was not manually placed is cleared (the server re-derives its position), one that
 * was is put back exactly, grouped so each distinct previous placement is one relocate call.
 */
export function planUndo(
  previous: readonly LocationState[],
  applied: ReadonlySet<string> | readonly string[],
): { clear: string[]; restore: { target: RelocateTarget; ids: string[] }[] } {
  const appliedIds = applied instanceof Set ? applied : new Set<string>(applied);
  const clear: string[] = [];
  const groups = new Map<string, { target: RelocateTarget; ids: string[] }>();
  for (const item of previous) {
    if (!appliedIds.has(item.id)) continue;
    const { latitude, longitude } = item;
    if (item.geotagSource !== 'Manual' || latitude == null || longitude == null) {
      clear.push(item.id);
      continue;
    }
    const label = item.placeLabel || formatCoords(latitude, longitude) || '';
    const key = `${latitude}|${longitude}|${label}`;
    const group = groups.get(key);
    if (group) group.ids.push(item.id);
    else groups.set(key, { target: { latitude, longitude, label }, ids: [item.id] });
  }
  return { clear, restore: [...groups.values()] };
}
