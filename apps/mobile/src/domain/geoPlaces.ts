import type { GeocodeResultDto, PlaceSuggestionDto } from '@lupira/photos-api/models';
import { photoCount, topPlacesBy } from '@lupira/photos-domain/photoFormat';
import { dedupeTargets, targetFromGeocode, targetFromSuggestion, type PlaceTarget } from '@lupira/photos-domain/placeTarget';
import { friendlyPlace, nearestSavedPlace, savedPlaceBbox, type SavedPlaceLike } from '@lupira/photos-domain/savedPlaces';

export const AROUND_CHIP_MAX = 6;
export const PLACE_BROWSE_LIMIT = 50;

type Located = { latitude?: number | null; longitude?: number | null; placeLabel?: string | null };

/** Search hits split into the two picker groups; anything within 25 m of a saved place or an earlier hit is dropped. */
export function groupTargets(
  saved: readonly PlaceTarget[],
  suggestions: readonly PlaceSuggestionDto[],
  addresses: readonly GeocodeResultDto[],
): { places: PlaceTarget[]; addresses: PlaceTarget[] } {
  const hits = [
    ...saved,
    ...suggestions.flatMap((s) => targetFromSuggestion(s) ?? []),
    ...addresses.map(targetFromGeocode),
  ];
  const kept = dedupeTargets(hits);
  return {
    places: kept.filter((t) => t.source === 'suggest'),
    addresses: kept.filter((t) => t.source === 'address'),
  };
}

/** Saved places that can drive an "Around …" filter chip: favourites first, only those with a usable bbox. */
export function aroundPlaces<T extends SavedPlaceLike>(saved: readonly T[], max = AROUND_CHIP_MAX): T[] {
  return saved
    .filter((s) => savedPlaceBbox(s) !== null)
    .sort((a, b) => Number(!!b.isFavorite) - Number(!!a.isFavorite) || a.label.localeCompare(b.label))
    .slice(0, max);
}

export function nearBbox(near: string, saved: readonly SavedPlaceLike[]): string | null {
  const place = saved.find((s) => s.id === near);
  return place ? savedPlaceBbox(place) : null;
}

/** A day's most photographed places by their friendly name; `near` is set where the name is a saved place,
 *  since that name is not a substring of any stored label. */
export function dayPlaces(items: readonly Located[], saved: readonly SavedPlaceLike[], max: number): { label: string; near?: string }[] {
  const nearByLabel = new Map<string, string>();
  const labels = topPlacesBy(items, (item) => {
    const place = item.latitude != null && item.longitude != null
      ? nearestSavedPlace({ latitude: item.latitude, longitude: item.longitude }, saved)
      : null;
    if (place) nearByLabel.set(place.label, place.id);
    return place?.label ?? item.placeLabel;
  }, max);
  return labels.map((label) => ({ label, near: nearByLabel.get(label) }));
}

/** The viewer's heading: a saved place's name with the stored address under it. */
export function placeHeading(photo: Located, saved: readonly SavedPlaceLike[]): { title: string; address: string | null } {
  const friendly = friendlyPlace(photo, saved);
  const label = photo.placeLabel || null;
  return {
    title: friendly ?? label ?? 'Unknown place',
    address: friendly && label && label !== friendly ? label : null,
  };
}

export function relocatedMessage(applied: number, total: number): string {
  return applied === total ? `Set location on ${photoCount(applied)}` : `Set location on ${applied} of ${photoCount(total)}`;
}

export function overwriteWarning(measured: number): string {
  return `${photoCount(measured)} ${measured === 1 ? 'has' : 'have'} a GPS or location-history position that will be replaced. You can undo this.`;
}
