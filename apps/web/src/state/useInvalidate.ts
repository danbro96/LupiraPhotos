import { useQueryClient } from '@tanstack/react-query';

/**
 * Invalidation helpers over the orval-generated query keys, which are the BFF's own paths — every
 * one carries its route prefix, so `/photo-api/photos` and `/api/items` never collide and a prefix
 * match can't sweep the wrong API's queries.
 *
 * Match on the prefixed path. A bare `/photos` matches nothing.
 */

/** Photo writes: every gallery query plus the photo↔event edge map, which a link or a delete changes. */
export function useInvalidatePhotos() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: (q) => {
        const key = String(q.queryKey[0] ?? '');
        return key.startsWith('/photo-api/photos') || key.startsWith('/api/relations/edges');
      },
    });
}
