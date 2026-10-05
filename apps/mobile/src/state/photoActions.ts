import { onlineManager } from '@tanstack/react-query';
import { clearPhotoLocation, deletePhoto, emptyPhotoTrash, relocatePhotos, restorePhoto, trashPhoto } from '@lupira/photos-api/fetch/photo';
import { chunk, planUndo, RELOCATE_MAX_IDS, type LocationState, type RelocateTarget } from '@lupira/photos-domain/photoLocation';
import { toast, toastError } from '@danbro96/lupira-expo-feedback/toast';
import { relocatedMessage } from '../domain/geoPlaces';
import { invalidatePhotos } from './queryClient';

export type Outcome = { done: number; failed: number };

const succeeds = (call: Promise<unknown>): Promise<boolean> => call.then(() => true, () => false);

/** One call per photo — the photo API has no batch form — and one gallery refresh when all settle. */
async function each(ids: readonly string[], call: (id: string) => Promise<unknown>): Promise<Outcome> {
  let failed = 0;
  for (const id of ids) {
    if (!(await succeeds(call(id)))) failed++;
  }
  invalidatePhotos();
  return { done: ids.length - failed, failed };
}

export const trashPhotos = (ids: readonly string[]) => each(ids, trashPhoto);
export const restorePhotos = (ids: readonly string[]) => each(ids, restorePhoto);
export const purgePhotos = (ids: readonly string[]) => each(ids, deletePhoto);

export async function emptyTrash(): Promise<boolean> {
  const ok = await succeeds(emptyPhotoTrash());
  invalidatePhotos();
  return ok;
}

const CLEAR_CONCURRENCY = 6;
const REDERIVE_REFRESH_MS = [3_000, 8_000];

async function pooled<T>(items: readonly T[], limit: number, run: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await run(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/** The ids the server accepted; a chunk that fails, or answers 409/404, contributes none and the rest still go. */
async function sendRelocate(ids: readonly string[], target: RelocateTarget): Promise<string[]> {
  const applied: string[] = [];
  for (const group of chunk(ids, RELOCATE_MAX_IDS)) {
    const r = await relocatePhotos({ ids: group, latitude: target.latitude, longitude: target.longitude, label: target.label })
      .catch(() => null);
    if (r) applied.push(...r.ids);
  }
  return applied;
}

/** Clearing re-queues the photo and the worker re-derives its position later, so the list is refreshed again after a delay. */
async function sendClear(ids: readonly string[]): Promise<Outcome> {
  let failed = 0;
  await pooled(ids, CLEAR_CONCURRENCY, async (id) => {
    if (!(await succeeds(clearPhotoLocation(id)))) failed++;
  });
  return { done: ids.length - failed, failed };
}

function refreshAfterRederive(): void {
  invalidatePhotos();
  for (const ms of REDERIVE_REFRESH_MS) setTimeout(invalidatePhotos, ms);
}

export async function clearLocation(ids: readonly string[]): Promise<Outcome> {
  const outcome = await sendClear(ids);
  refreshAfterRederive();
  return outcome;
}

async function undoRelocate(previous: readonly LocationState[], applied: readonly string[]): Promise<void> {
  const plan = planUndo(previous, applied);
  toast('Restoring…');
  let failed = (await sendClear(plan.clear)).failed;
  for (const group of plan.restore) {
    failed += group.ids.length - (await sendRelocate(group.ids, group.target)).length;
  }
  refreshAfterRederive();
  if (failed > 0) toastError(`Could not restore ${failed} ${failed === 1 ? 'photo' : 'photos'}.`);
}

/** Sets one place on every photo, then offers an Undo that puts back what each photo had. False when offline, so the caller keeps its sheet open. */
export async function relocate(items: readonly LocationState[], target: RelocateTarget): Promise<boolean> {
  if (!onlineManager.isOnline()) {
    toastError('Setting a location needs a connection.');
    return false;
  }
  const previous = items.map(({ id, latitude, longitude, placeLabel, geotagSource }): LocationState => (
    { id, latitude, longitude, placeLabel, geotagSource }
  ));
  const applied = await sendRelocate(previous.map((p) => p.id), target);
  invalidatePhotos();
  if (applied.length === 0) toastError('Could not set the location.');
  else toast(relocatedMessage(applied.length, previous.length), { action: { label: 'Undo', onPress: () => void undoRelocate(previous, applied) } });
  return true;
}
