import type { PhotoListItemDto, SavedPlaceDto } from '@lupira/photos-api/models';
import { topPlacesBy } from '@lupira/photos-domain/photoFormat';
import { nearestSavedPlace, savedPlaceBbox } from '@lupira/photos-domain/savedPlaces';

export const AROUND_CHIP_LIMIT = 6;

type Located = Pick<PhotoListItemDto, 'latitude' | 'longitude' | 'placeLabel'>;

const filterable = (saved: readonly SavedPlaceDto[]) => saved.filter((s) => savedPlaceBbox(s) !== null);

/** A day's most photographed places by friendly name; `savedPlaceId` is set where the name is a saved
 *  place, since that name is not a label the server's place filter can match. */
export function dayPlaces(
  items: readonly Located[],
  saved: readonly SavedPlaceDto[],
  max: number,
): { label: string; savedPlaceId: string | null }[] {
  const candidates = filterable(saved);
  const idByLabel = new Map<string, string>();
  const friendly = (item: Located) => {
    if (item.latitude == null || item.longitude == null) return item.placeLabel;
    const place = nearestSavedPlace({ latitude: item.latitude, longitude: item.longitude }, candidates);
    if (!place) return item.placeLabel;
    idByLabel.set(place.label, place.id);
    return place.label;
  };
  return topPlacesBy(items, friendly, max).map((label) => ({ label, savedPlaceId: idByLabel.get(label) ?? null }));
}

/** Saved places offered as "Around …" filters: favourites first, only those with a usable bbox. */
export function aroundChips(saved: readonly SavedPlaceDto[], max = AROUND_CHIP_LIMIT): SavedPlaceDto[] {
  return filterable(saved)
    .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || a.label.localeCompare(b.label))
    .slice(0, max);
}
