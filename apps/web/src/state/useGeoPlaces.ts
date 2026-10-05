import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@danbro96/lupira-http/apiError';
import { lookupPlaces, useForwardGeocode, useListSavedPlaces, useSuggestPlaces } from '@lupira/photos-api/query/geo';
import type { PlaceDto, SavedPlaceDto } from '@lupira/photos-api/models';
import { targetFromGeocode, targetFromPlace, targetFromSaved, targetFromSuggestion, type PlaceTarget } from '@lupira/photos-domain/placeTarget';
import { ADDRESS_SEARCH_LIMIT, MIN_PLACE_QUERY, PLACE_SEARCH_DEBOUNCE_MS, PLACE_SUGGEST_LIMIT } from '@danbro96/lupira-domain-places/placeCandidates';
import { chunk, distinctPlaceIds, PLACE_LOOKUP_MAX, toLocatedPlaces } from '@danbro96/lupira-domain-places/places';
import { useDebounced } from './useDebounced';

const SAVED_PLACES_STALE_MS = 10 * 60_000;
const SEARCH_STALE_MS = 5 * 60_000;
const DENIED_STATUSES = [401, 403, 404];
const NONE: never[] = [];
const NO_SAVED: SavedPlaceDto[] = [];

/** The session lacks the geo audience (or the BFF doesn't expose it): hide geo features, don't fail. */
export function isGeoDenied(error: unknown): boolean {
  return error instanceof ApiError && DENIED_STATUSES.includes(error.status);
}

export function useSavedPlaces() {
  const query = useListSavedPlaces({ query: { staleTime: SAVED_PLACES_STALE_MS } });
  return { places: query.data ?? NO_SAVED, isLoading: query.isLoading, denied: isGeoDenied(query.error) };
}

function usePlaceLookup(ids: readonly string[]) {
  return useQuery({
    queryKey: ['/geo-api/places/lookup', ids],
    queryFn: async ({ signal }) =>
      (await Promise.all(chunk(ids, PLACE_LOOKUP_MAX).map((part) => lookupPlaces({ ids: part }, { signal })))).flat(),
    enabled: ids.length > 0,
    staleTime: SAVED_PLACES_STALE_MS,
  });
}

export type SavedTarget = { id: string; name: string; target: PlaceTarget };

/** Saved places as relocate targets, labelled by their underlying place so a rename of "Home" never
 *  leaves stale labels. Not `ready` until the names resolve, so a pick never persists the nickname. */
export function useSavedTargets() {
  const saved = useSavedPlaces();
  const lookup = usePlaceLookup(distinctPlaceIds(saved.places.map((s) => s.placeId)));
  const places = toLocatedPlaces<PlaceDto>(lookup.data ?? []);
  const targets: SavedTarget[] = saved.places.flatMap((s) => {
    const target = targetFromSaved(s, s.placeId ? places.get(s.placeId)?.name : null);
    return target ? [{ id: s.id, name: s.label, target }] : [];
  });
  return { targets, ready: !saved.isLoading && !lookup.isLoading, denied: saved.denied };
}

export function usePlaceSuggestions(text: string) {
  const q = useDebounced(text.trim(), PLACE_SEARCH_DEBOUNCE_MS);
  const query = useSuggestPlaces(
    { q, limit: PLACE_SUGGEST_LIMIT },
    { query: { enabled: q.length >= MIN_PLACE_QUERY, staleTime: SEARCH_STALE_MS } },
  );
  const targets = (query.data ?? []).flatMap((s) => targetFromSuggestion(s) ?? []);
  return { targets, isLoading: query.isFetching, denied: isGeoDenied(query.error) };
}

/** Runs only for a term the person asked to search as an address, as geocoding is rate-limited. */
export function useAddressSearch(q: string, enabled: boolean) {
  const query = useForwardGeocode(
    { q, limit: ADDRESS_SEARCH_LIMIT },
    { query: { enabled: enabled && q.length >= MIN_PLACE_QUERY, staleTime: SEARCH_STALE_MS } },
  );
  const targets = (query.data ?? []).map(targetFromGeocode);
  return { targets, isLoading: query.isFetching, denied: isGeoDenied(query.error) };
}

export function useEventPlace(placeId: string | null, eventTitle?: string | null) {
  const lookup = usePlaceLookup(placeId ? [placeId] : NONE);
  const place = placeId ? toLocatedPlaces<PlaceDto>(lookup.data ?? []).get(placeId) : undefined;
  return {
    target: place ? targetFromPlace(place, eventTitle) : null,
    isLoading: lookup.isLoading,
    denied: isGeoDenied(lookup.error),
  };
}
