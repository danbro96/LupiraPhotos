import type { RelocatePhotosRequest, RelocatePhotosResponse } from '@lupira/photos-api/models';
import { photoCount } from '@lupira/photos-domain/photoFormat';
import { chunk, planUndo, RELOCATE_MAX_IDS, type LocationState, type RelocateTarget } from '@lupira/photos-domain/photoLocation';

export type RelocateCall = (request: RelocatePhotosRequest) => Promise<RelocatePhotosResponse>;
export type ClearCall = (id: string) => Promise<unknown>;

export const CLEAR_CONCURRENCY = 6;

/** The server re-derives a cleared photo's position asynchronously; refetch while it settles. */
export const REDERIVE_DELAYS_MS = [3000, 8000] as const;

/** Stops at the first failed chunk, so the result is exactly what the server changed. */
export async function relocateInChunks(call: RelocateCall, ids: readonly string[], target: RelocateTarget): Promise<string[]> {
  const applied: string[] = [];
  for (const batch of chunk(ids, RELOCATE_MAX_IDS)) {
    const response = await call({ ids: batch, latitude: target.latitude, longitude: target.longitude, label: target.label })
      .catch(() => null);
    if (!response) break;
    applied.push(...response.ids);
  }
  return applied;
}

export async function clearInParallel(call: ClearCall, ids: readonly string[], limit = CLEAR_CONCURRENCY): Promise<string[]> {
  const cleared: string[] = [];
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const id = ids[next++];
      await call(id).then(() => { cleared.push(id); }, () => undefined);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, ids.length) }, worker));
  return cleared;
}

export async function undoRelocate(
  previous: readonly LocationState[],
  applied: readonly string[],
  calls: { relocate: RelocateCall; clear: ClearCall },
): Promise<{ done: number; failed: number }> {
  const plan = planUndo(previous, applied);
  const total = plan.clear.length + plan.restore.reduce((n, group) => n + group.ids.length, 0);
  let done = (await clearInParallel(calls.clear, plan.clear)).length;
  for (const group of plan.restore) done += (await relocateInChunks(calls.relocate, group.ids, group.target)).length;
  return { done, failed: total - done };
}

export function relocateMessage(done: number, requested: number): string {
  return done === requested ? `Set location on ${photoCount(done)}` : `Set location on ${done} of ${photoCount(requested)}`;
}

export function overwriteWarning(measured: number): string {
  return `${photoCount(measured)} ${measured === 1 ? 'has' : 'have'} a GPS or history position that will be replaced; undoable`;
}
