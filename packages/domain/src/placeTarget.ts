import { haversineM } from '@danbro96/lupira-domain-places/geo';

export interface PlaceTarget {
  key: string;
  label: string;
  latitude: number;
  longitude: number;
  source: 'saved' | 'suggest' | 'address' | 'event';
  detail?: string;
}

interface Located {
  latitude?: number | null;
  longitude?: number | null;
}

const ADDRESS_LABEL_PARTS = 3;

/** The persisted label is the underlying place's name when known, so renaming "Home" never leaves stale labels. */
export function targetFromSaved(
  s: { id: string; label: string; placeId?: string | null } & Located,
  placeName?: string | null,
): PlaceTarget | null {
  if (s.latitude == null || s.longitude == null) return null;
  return { key: `saved:${s.id}`, label: placeName || s.label, latitude: s.latitude, longitude: s.longitude, source: 'saved' };
}

export function targetFromSuggestion(s: { id: string; type: string; name: string; context?: string | null } & Located): PlaceTarget | null {
  if (s.latitude == null || s.longitude == null) return null;
  return {
    key: `suggest:${s.id}`,
    label: s.name,
    latitude: s.latitude,
    longitude: s.longitude,
    source: 'suggest',
    ...(s.context ? { detail: s.context } : {}),
  };
}

export function targetFromGeocode(h: { displayName: string; latitude: number; longitude: number }): PlaceTarget {
  const label = h.displayName.split(',').slice(0, ADDRESS_LABEL_PARTS).map((part) => part.trim()).join(', ');
  return { key: `address:${h.latitude},${h.longitude}`, label, latitude: h.latitude, longitude: h.longitude, source: 'address', detail: h.displayName };
}

/** An event's place, or a plain place when no event title is given. */
export function targetFromPlace(place: { id: string; name: string } & Located, eventTitle?: string | null): PlaceTarget | null {
  if (place.latitude == null || place.longitude == null) return null;
  const base = { label: place.name, latitude: place.latitude, longitude: place.longitude };
  return eventTitle
    ? { key: `event:${place.id}`, ...base, source: 'event', detail: eventTitle }
    : { key: `place:${place.id}`, ...base, source: 'suggest' };
}

/** Keeps the first of any targets within `thresholdM` of each other, so list saved places first. */
export function dedupeTargets(list: readonly PlaceTarget[], thresholdM = 25): PlaceTarget[] {
  const kept: PlaceTarget[] = [];
  for (const target of list) {
    const from = { lat: target.latitude, lon: target.longitude };
    if (!kept.some((k) => haversineM(from, { lat: k.latitude, lon: k.longitude }) <= thresholdM)) kept.push(target);
  }
  return kept;
}
