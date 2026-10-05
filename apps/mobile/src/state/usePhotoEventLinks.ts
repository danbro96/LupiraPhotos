import { useQueries, useQuery } from '@tanstack/react-query';
import { createItemRelationsBatch, deleteItemRelationsBatch, getItem, listRelationEdges, searchItems } from '@lupira/photos-api/fetch/cal';
import { lookupPhotos } from '@lupira/photos-api/fetch/photo';
import { photoEventLinks, THUMB_SAFE_STALE_MS, unlinkedPhotoIds } from '@lupira/photos-domain/photoFormat';
import { PHOTO_LINK } from '@danbro96/lupira-domain-photos/photoLinks';
import { captureWindow, EVENT_CANDIDATE_LIMIT } from '@danbro96/lupira-domain-photos/photoWindow';
import { displayTitle } from '@danbro96/lupira-domain-events/itemLabels';
import { onlineQuery } from '@danbro96/lupira-expo-query/onlineQuery';
import { PHOTO_SEARCH } from '@lupira/photos-domain/photoTimeline';
import { invalidatePhotos } from './queryClient';

/** Every photo↔event edge the caller can see, in one call rather than a request per tile. */
function usePhotoEventEdges() {
  return useQuery(onlineQuery(['cal', 'event-links'], () => listRelationEdges({ toKind: PHOTO_LINK.toKind })));
}

/** photoId → linked calendar item ids. */
export function usePhotoEventLinks(): Map<string, string[]> {
  const query = usePhotoEventEdges();
  return photoEventLinks(query.data ?? []);
}

/** The photos linked to one calendar item, hydrated in a single batch lookup. */
export function useEventPhotoQuery(itemId: string) {
  const edges = usePhotoEventEdges();
  const ids = (edges.data ?? []).filter((e) => e.fromId === itemId).map((e) => e.toRef);

  const query = useQuery({
    ...onlineQuery(['event-photos', ids], async () => (await lookupPhotos({ ids })).items),
    enabled: ids.length > 0,
    staleTime: THUMB_SAFE_STALE_MS,
  });

  return {
    data: query.data,
    isLoading: edges.isLoading || query.isLoading,
    isRefetching: edges.isRefetching || query.isRefetching,
    error: edges.error ?? query.error,
    refetch: async () => { await edges.refetch(); await query.refetch(); },
  };
}

export type LinkedEvent = { id: string; title: string };

/** Titles for a photo's linked events, one cached item read each. */
export function useLinkedEvents(itemIds: string[]): LinkedEvent[] {
  const results = useQueries({ queries: itemIds.map((id) => onlineQuery(['cal', 'event', id], () => getItem(id))) });
  return itemIds.map((id, i) => ({ id, title: displayTitle(results[i]?.data?.title) }));
}

/** Events around the photos' capture times — offered as link candidates, never linked automatically: a
 *  photo taken during a 9-to-5 "work" block is not of it. */
export function useLinkCandidates(takenAts: readonly string[], enabled: boolean) {
  const window = captureWindow(takenAts);
  return useQuery({
    ...onlineQuery(['cal', 'link-candidates', window?.fromIso, window?.toIso], () =>
      searchItems({ from: window!.fromIso, to: window!.toIso, take: EVENT_CANDIDATE_LIMIT })),
    enabled: enabled && window !== null,
    staleTime: 60_000,
  });
}

/** Links the photos not already linked to the event, in one call. `linked` is what an Undo unlinks. */
export async function linkPhotosToEvent(
  itemId: string, photoIds: readonly string[], links: ReadonlyMap<string, string[]>,
): Promise<{ linked: string[]; ok: boolean }> {
  const pending = unlinkedPhotoIds(photoIds, links, itemId);
  if (pending.length === 0) return { linked: [], ok: true };
  const ok = await createItemRelationsBatch(itemId, { ...PHOTO_LINK, toRefs: pending }).then(() => true, () => false);
  invalidatePhotos();
  return ok ? { linked: pending, ok } : { linked: [], ok };
}

export async function unlinkPhotosFromEvent(itemId: string, photoIds: readonly string[]): Promise<boolean> {
  const ok = await deleteItemRelationsBatch(itemId, { ...PHOTO_LINK, toRefs: [...photoIds] }).then(() => true, () => false);
  invalidatePhotos();
  return ok;
}

/** Events by name, newest first — a photo search usually means a past event. */
export function useEventSearch(query: string) {
  const term = query.trim();
  return useQuery({
    ...onlineQuery(['cal', 'event-search', term], () => searchItems({ query: term, take: PHOTO_SEARCH.events, desc: true })),
    enabled: term.length >= PHOTO_SEARCH.minQuery,
    staleTime: 60_000,
  });
}
