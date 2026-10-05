import { useQuery } from '@tanstack/react-query';
import { forwardGeocode, listSavedPlaces, lookupPlaces, suggestPlaces } from '@lupira/photos-api/fetch/geo';
import type { SavedPlaceDto } from '@lupira/photos-api/models';
import { targetFromSaved, type PlaceTarget } from '@lupira/photos-domain/placeTarget';
import { ApiError } from '@danbro96/lupira-http/apiError';
import { onlineQuery } from '@danbro96/lupira-expo-query/onlineQuery';
import { ADDRESS_SEARCH_LIMIT, MIN_PLACE_QUERY, PLACE_SEARCH_DEBOUNCE_MS, PLACE_SUGGEST_LIMIT } from '@danbro96/lupira-domain-places/placeCandidates';
import { useGeoReady } from './auth-store';
import { useDebouncedValue } from './useDebouncedValue';

/** Only the saved places persist (state/queryClient), which is what lets friendly names render offline. */

const DENIED = new Set([401, 403, 404]);

export const isGeoDenied = (error: unknown): boolean => error instanceof ApiError && DENIED.has(error.status);

export function useSavedPlaces() {
  const ready = useGeoReady();
  return useQuery({ ...onlineQuery(['photos', 'saved-places'], () => listSavedPlaces()), enabled: ready, staleTime: 10 * 60_000 });
}

/** Place suggestions for a typed term, once typing has settled. */
export function useGeoSuggestions(query: string) {
  const ready = useGeoReady();
  const term = useDebouncedValue(query.trim(), PLACE_SEARCH_DEBOUNCE_MS);
  return useQuery({
    ...onlineQuery(['geo', 'suggest', term], () => suggestPlaces({ q: term, limit: PLACE_SUGGEST_LIMIT })),
    enabled: ready && term.length >= MIN_PLACE_QUERY,
  });
}

/** Pass the term only on an explicit "Search addresses" press; the geocoder is rate-limited. */
export function useAddressSearch(term: string) {
  const ready = useGeoReady();
  return useQuery({
    ...onlineQuery(['geo', 'address', term], () => forwardGeocode({ q: term, limit: ADDRESS_SEARCH_LIMIT })),
    enabled: ready && term.length >= MIN_PLACE_QUERY,
  });
}

/** The geo place behind a calendar event, for its coordinates. */
export function useEventPlace(placeId: string | null | undefined) {
  const ready = useGeoReady();
  return useQuery({
    ...onlineQuery(['geo', 'place', placeId], async () => (await lookupPlaces({ ids: [placeId!] }))[0]?.place ?? null),
    enabled: ready && !!placeId,
    staleTime: 10 * 60_000,
  });
}

const LOOKUP_MAX_IDS = 200;

/** Saved places as targets, labelled by the underlying place's name so a rename of "Home" never leaves stale
 *  labels on photos; `settled` is false while those names are still being fetched. */
export function useSavedTargets(saved: readonly SavedPlaceDto[]): { targets: PlaceTarget[]; settled: boolean } {
  const ready = useGeoReady();
  const placeIds = [...new Set(saved.flatMap((s) => (s.placeId ? [s.placeId] : [])))].slice(0, LOOKUP_MAX_IDS);
  const names = useQuery({
    ...onlineQuery(['geo', 'place-names', placeIds], async () =>
      new Map((await lookupPlaces({ ids: placeIds })).flatMap((i) => (i.place ? [[i.requestedId, i.place.name] as const] : [])))),
    enabled: ready && placeIds.length > 0,
    staleTime: 10 * 60_000,
  });
  const targets = saved.flatMap((s) => targetFromSaved(s, s.placeId ? names.data?.get(s.placeId) : null) ?? []);
  return { targets, settled: !names.isLoading };
}
