import { useInfiniteQuery, useIsRestoring, useQuery } from '@tanstack/react-query';
import { getPhoto, getPhotoStats, listPhotoPlaces, listPhotos } from '@lupira/photos-api/fetch/photo';
import type { AssetKind, AssetStatus, ListPhotosParams, PhotoListItemDto, PhotoSort } from '@lupira/photos-api/models';
import { filterPhotos } from '@lupira/photos-domain/photoFilter';
import { groupByDay as groupDays, photoDayLabel, THUMB_SAFE_STALE_MS, type DayGroup } from '@lupira/photos-domain/photoFormat';
import { dayEndIso, dayStartIso } from '@danbro96/lupira-domain-core/time';
import { PHOTO_SEARCH } from '@lupira/photos-domain/photoTimeline';
import { nearBbox, PLACE_BROWSE_LIMIT } from '../domain/geoPlaces';
import { useSavedPlaces } from './useGeoPlaces';
import { useEventPhotoQuery } from './usePhotoEventLinks';
import { useOnline } from './useOnline';

/** The gallery's read model. Every hook gates on connectivity, and keys live under one ['photos'] root
 *  that a write invalidates whole; the list, detail, stats and places keys are what the query cache
 *  persists for offline viewing (state/queryClient). */

export const PHOTO_PAGE_SIZE = 90;

export type PhotoQueryFilters = {
  sort: PhotoSort;
  kind?: AssetKind;
  status?: AssetStatus;
  located?: boolean;
  place?: string;
  /** A saved place id — photos within a short distance of it, sent as a bounding box. */
  near?: string;
  /** Local day bounds, 'yyyy-MM-dd'. */
  from?: string;
  to?: string;
  /** A calendar item id — its linked photos, which the photo API itself knows nothing about. */
  event?: string;
  /** The trash instead of the library. */
  trashed?: boolean;
};

export const DEFAULT_PHOTO_FILTERS: PhotoQueryFilters = { sort: 'TakenAtDesc' };

/** The day bounds are local calendar days; the endpoint takes instants. */
function listParams({ from, to, event: _event, near: _near, ...rest }: PhotoQueryFilters, bbox?: string | null): ListPhotosParams {
  return {
    ...rest,
    bbox: bbox ?? undefined,
    from: from ? dayStartIso(from) : undefined,
    to: to ? dayEndIso(to) : undefined,
  };
}

export function usePhotoLibrary(filters: PhotoQueryFilters) {
  const online = useOnline();
  const restoring = useIsRestoring();
  const savedPlaces = useSavedPlaces();
  const bbox = filters.near ? nearBbox(filters.near, savedPlaces.data ?? []) : null;
  const resolvingNear = !!filters.near && bbox === null && savedPlaces.isLoading;

  const query = useInfiniteQuery({
    queryKey: ['photos', 'list', filters],
    enabled: online && !filters.event && (!filters.near || bbox !== null),
    staleTime: THUMB_SAFE_STALE_MS,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const r = await listPhotos({ ...listParams(filters, bbox), limit: PHOTO_PAGE_SIZE, cursor: pageParam });
      if (r.status !== 200) throw new Error(`photos ${r.status}`);
      return r.data;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const offline = !online || query.isError;

  const event = useEventPhotoQuery(filters.event ?? '');
  const { from, to } = listParams(filters);
  const eventItems = filterPhotos(event.data ?? [], { ...filters, fromIso: from, toIso: to });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  if (filters.event) {
    return {
      items: eventItems,
      offline: !online,
      isLoading: event.isLoading || restoring,
      isRefetching: event.isRefetching,
      error: event.error,
      hasNextPage: false,
      fetchNextPage: query.fetchNextPage,
      isFetchingNextPage: false,
      refetch: event.refetch,
    };
  }

  return {
    items,
    offline,
    isLoading: query.isLoading || restoring || resolvingNear,
    isRefetching: query.isRefetching,
    error: query.error,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    refetch: query.refetch,
  };
}

export function usePhoto(photoId: string) {
  const online = useOnline();
  return useQuery({
    queryKey: ['photos', 'detail', photoId],
    enabled: online,
    staleTime: THUMB_SAFE_STALE_MS,
    queryFn: async () => {
      const r = await getPhoto(photoId);
      if (r.status !== 200) throw new Error(`photo ${r.status}`);
      return r.data;
    },
  });
}

/** Library totals — powers the upload-health chip without paging the whole library to count. */
export function usePhotoStats() {
  const online = useOnline();
  return useQuery({
    queryKey: ['photos', 'stats'],
    enabled: online,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const r = await getPhotoStats();
      if (r.status !== 200) throw new Error(`photo stats ${r.status}`);
      return r.data;
    },
  });
}

export type PhotoDay = DayGroup<PhotoListItemDto>;

export function groupByDay(items: PhotoListItemDto[]): PhotoDay[] {
  return groupDays(items, photoDayLabel);
}

/** The most photographed places, narrowed by a search — the endpoint returns at most `PLACE_BROWSE_LIMIT`. */
export function usePhotoPlaces(query: string) {
  const online = useOnline();
  const term = query.trim();
  return useQuery({
    queryKey: ['photos', 'places', 'top', term],
    enabled: online,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const r = await listPhotoPlaces({ q: term || undefined, limit: PLACE_BROWSE_LIMIT });
      if (r.status !== 200) throw new Error(`photo places ${r.status}`);
      return r.data;
    },
  });
}

/** Place names in the library matching a search, most photographed first. */
export function usePlaceSuggestions(query: string) {
  const online = useOnline();
  const term = query.trim();
  return useQuery({
    queryKey: ['photos', 'places', term],
    enabled: online && term.length >= PHOTO_SEARCH.minQuery,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const r = await listPhotoPlaces({ q: term, limit: PHOTO_SEARCH.places });
      if (r.status !== 200) throw new Error(`photo places ${r.status}`);
      return r.data;
    },
  });
}
