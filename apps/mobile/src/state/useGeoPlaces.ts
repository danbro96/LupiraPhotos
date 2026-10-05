import { useQuery } from '@tanstack/react-query';
import { forwardGeocode, listSavedPlaces, lookupPlaces, suggestPlaces } from '@lupira/photos-api/fetch/geo';
import type { SavedPlaceDto } from '@lupira/photos-api/models';
import { targetFromSaved, type PlaceTarget } from '@lupira/photos-domain/placeTarget';
import { ApiError } from '@danbro96/lupira-http/apiError';
import { ADDRESS_SEARCH_LIMIT, MIN_PLACE_QUERY, PLACE_SEARCH_DEBOUNCE_MS, PLACE_SUGGEST_LIMIT } from '@danbro96/lupira-domain-places/placeCandidates';
import { useGeoReady } from './auth-store';
import { useDebouncedValue } from './useDebouncedValue';
import { useOnline } from './useOnline';

/** Geo reads are keyed under the photos root so a write's invalidation sweeps them too; only the saved
 *  places persist (state/queryClient), which is what lets friendly names render offline. */

const DENIED = new Set([401, 403, 404]);

export const isGeoDenied = (error: unknown): boolean => error instanceof ApiError && DENIED.has(error.status);

function useGeoEnabled(): boolean {
  const online = useOnline();
  const ready = useGeoReady();
  return online && ready;
}

export function useSavedPlaces() {
  const enabled = useGeoEnabled();
  return useQuery({
    queryKey: ['photos', 'saved-places'],
    enabled,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const r = await listSavedPlaces();
      if (r.status !== 200) throw new ApiError(r.status, `saved places ${r.status}`);
      return r.data;
    },
  });
}

/** Place suggestions for a typed term, once typing has settled. */
export function useGeoSuggestions(query: string) {
  const enabled = useGeoEnabled();
  const term = useDebouncedValue(query.trim(), PLACE_SEARCH_DEBOUNCE_MS);
  return useQuery({
    queryKey: ['photos', 'place-suggest', term],
    enabled: enabled && term.length >= MIN_PLACE_QUERY,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const r = await suggestPlaces({ q: term, limit: PLACE_SUGGEST_LIMIT });
      if (r.status !== 200) throw new ApiError(r.status, `place suggest ${r.status}`);
      return r.data;
    },
  });
}

/** Pass the term only on an explicit "Search addresses" press; the geocoder is rate-limited. */
export function useAddressSearch(term: string) {
  const enabled = useGeoEnabled();
  return useQuery({
    queryKey: ['photos', 'address-search', term],
    enabled: enabled && term.length >= MIN_PLACE_QUERY,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const r = await forwardGeocode({ q: term, limit: ADDRESS_SEARCH_LIMIT });
      if (r.status !== 200) throw new ApiError(r.status, `address search ${r.status}`);
      return r.data;
    },
  });
}

/** The geo place behind a calendar event, for its coordinates. */
export function useEventPlace(placeId: string | null | undefined) {
  const enabled = useGeoEnabled();
  return useQuery({
    queryKey: ['photos', 'event-place', placeId],
    enabled: enabled && !!placeId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const r = await lookupPlaces({ ids: [placeId!] });
      if (r.status !== 200) throw new ApiError(r.status, `place lookup ${r.status}`);
      return r.data[0]?.place ?? null;
    },
  });
}

const LOOKUP_MAX_IDS = 200;

/** Saved places as targets, labelled by the underlying place's name so a rename of "Home" never leaves stale
 *  labels on photos; `settled` is false while those names are still being fetched. */
export function useSavedTargets(saved: readonly SavedPlaceDto[]): { targets: PlaceTarget[]; settled: boolean } {
  const enabled = useGeoEnabled();
  const placeIds = [...new Set(saved.flatMap((s) => (s.placeId ? [s.placeId] : [])))].slice(0, LOOKUP_MAX_IDS);
  const names = useQuery({
    queryKey: ['photos', 'saved-place-names', placeIds],
    enabled: enabled && placeIds.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const r = await lookupPlaces({ ids: placeIds });
      if (r.status !== 200) throw new ApiError(r.status, `place lookup ${r.status}`);
      return new Map(r.data.flatMap((i) => (i.place ? [[i.requestedId, i.place.name] as const] : [])));
    },
  });
  const targets = saved.flatMap((s) => targetFromSaved(s, s.placeId ? names.data?.get(s.placeId) : null) ?? []);
  return { targets, settled: !names.isLoading };
}
