import { useState, type Dispatch, type SetStateAction } from 'react';
import { createItemRelationsBatch, deleteItemRelationsBatch } from '@lupira/photos-api/query/cal';
import { clearPhotoLocation, deletePhoto, emptyPhotoTrash, relocatePhotos, restorePhoto, trashPhoto } from '@lupira/photos-api/query/photo';
import { PHOTO_LINK } from '@danbro96/lupira-domain-photos/photoLinks';
import type { LocationState, RelocateTarget } from '@lupira/photos-domain/photoLocation';
import { clearInParallel, REDERIVE_DELAYS_MS, relocateInChunks, undoRelocate } from './locationCalls';
import { useInvalidatePhotos } from './useInvalidate';

export type Outcome = { done: number; failed: number };

/** `previous` is each photo's position before the edit and `applied` the ids the server changed: what Undo needs. */
export type RelocateResult = Outcome & { applied: string[]; previous: LocationState[] };

/** Photo writes over one or many photos, each refreshing the gallery once when it settles. Plain
 *  fetchers, not mutation hooks: an Undo fires from a snackbar after the component that offered it
 *  has unmounted. Trash and restore are one call per photo; links go in one call per event. */
export function usePhotoActions() {
  const invalidate = useInvalidatePhotos();
  const [pending, setPending] = useState(0);

  const track = <T extends Outcome>(run: () => Promise<T>): Promise<T> => trackPending(run, setPending, invalidate);

  const rederiveLater = <T>(result: T): T => {
    for (const delay of REDERIVE_DELAYS_MS) setTimeout(() => void invalidate(), delay);
    return result;
  };

  const each = (ids: readonly string[], call: (id: string) => Promise<unknown>) => track(() => settleEach(ids, call));

  const once = (call: () => Promise<unknown>, count: number) => track(() =>
    call().then(() => ({ done: count, failed: 0 }), () => ({ done: 0, failed: count })));

  return {
    trash: (ids: readonly string[]) => each(ids, (id) => trashPhoto(id)),
    restore: (ids: readonly string[]) => each(ids, (id) => restorePhoto(id)),
    purge: (ids: readonly string[]) => each(ids, (id) => deletePhoto(id)),
    emptyTrash: () => once(() => emptyPhotoTrash(), 1),
    link: (itemId: string, photoIds: readonly string[]) =>
      once(() => createItemRelationsBatch(itemId, { ...PHOTO_LINK, toRefs: [...photoIds] }), photoIds.length),
    unlink: (itemId: string, photoIds: readonly string[]) =>
      once(() => deleteItemRelationsBatch(itemId, { ...PHOTO_LINK, toRefs: [...photoIds] }), photoIds.length),
    relocate: (items: readonly LocationState[], target: RelocateTarget): Promise<RelocateResult> => {
      const previous = items.map(({ id, latitude, longitude, placeLabel, geotagSource }) => ({ id, latitude, longitude, placeLabel, geotagSource }));
      return track(async () => {
        const applied = await relocateInChunks(relocatePhotos, items.map((i) => i.id), target);
        return { done: applied.length, failed: items.length - applied.length, applied, previous };
      });
    },
    clearLocation: (ids: readonly string[]) => track(async () => {
      const cleared = await clearInParallel(clearPhotoLocation, ids);
      return { done: cleared.length, failed: ids.length - cleared.length };
    }).then(rederiveLater),
    undoRelocate: (previous: readonly LocationState[], applied: readonly string[]) =>
      track(() => undoRelocate(previous, applied, { relocate: relocatePhotos, clear: clearPhotoLocation })).then(rederiveLater),
    busy: pending > 0,
  };
}

async function trackPending<T extends Outcome>(
  run: () => Promise<T>,
  setPending: Dispatch<SetStateAction<number>>,
  invalidate: () => Promise<void>,
): Promise<T> {
  setPending((n) => n + 1);
  try {
    return await run();
  } finally {
    setPending((n) => n - 1);
    void invalidate();
  }
}

async function settleEach(ids: readonly string[], call: (id: string) => Promise<unknown>): Promise<Outcome> {
  let failed = 0;
  for (const id of ids) await call(id).catch(() => { failed++; });
  return { done: ids.length - failed, failed };
}
