import { useInfiniteQuery, useIsRestoring, useQuery } from '@tanstack/react-query';
import { getPhoto, getPhotoStats, listPhotoPlaces, listPhotos } from '@lupira/photos-api/fetch/photo';
import type { AssetKind, AssetStatus, ListPhotosParams, PhotoListItemDto, PhotoSort } from '@lupira/photos-api/models';
import { filterPhotos } from '@lupira/photos-domain/photoFilter';
import { groupByDay as groupDays, photoDayLabel, THUMB_SAFE_STALE_MS, type DayGroup } from '@lupira/photos-domain/photoFormat';
import { dayEndIso, dayStartIso } from '@danbro96/lupira-domain-core/time';
import { PHOTO_SEARCH } from '@lupira/photos-domain/photoTimeline';
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
function listParams({ from, to, event: _event, ...rest }: PhotoQueryFilters): ListPhotosParams {
  return {
    ...rest,
    from: from ? dayStartIso(from) : undefined,
    to: to ? dayEndIso(to) : undefined,
  };
}

export function usePhotoLibrary(filters: PhotoQueryFilters) {
  const online = useOnline();
  const restoring = useIsRestoring();

  const query = useInfiniteQuery({
    queryKey: ['photos', 'list', filters],
    enabled: online && !filters.event,
    staleTime: THUMB_SAFE_STALE_MS,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const r = await listPhotos({ ...listParams(filters), limit: PHOTO_PAGE_SIZE, cursor: pageParam });
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
    isLoading: query.isLoading || restoring,
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
