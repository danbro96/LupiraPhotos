import { describe, expect, it } from 'vitest';
import type { RelocatePhotosRequest } from '@lupira/photos-api/models';
import { clearInParallel, overwriteWarning, relocateInChunks, relocateMessage, undoRelocate } from './locationCalls';

const TARGET = { latitude: 59.1, longitude: 13.2, label: 'Home' };
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

const echo = async (request: RelocatePhotosRequest) => ({ count: request.ids!.length, ids: request.ids! });

describe('relocateInChunks', () => {
  it('sends one call for up to 2000 ids and always sets the label', async () => {
    const calls: RelocatePhotosRequest[] = [];
    const applied = await relocateInChunks(async (r) => { calls.push(r); return echo(r); }, ids(2000), TARGET);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ latitude: 59.1, longitude: 13.2, label: 'Home' });
    expect(calls[0].ids).toHaveLength(2000);
    expect(applied).toHaveLength(2000);
  });

  it('splits 2001 ids into two sequential calls', async () => {
    const sizes: number[] = [];
    const applied = await relocateInChunks(async (r) => { sizes.push(r.ids!.length); return echo(r); }, ids(2001), TARGET);
    expect(sizes).toEqual([2000, 1]);
    expect(applied).toHaveLength(2001);
  });

  it('accumulates the ids the server reports, not the ids sent', async () => {
    const applied = await relocateInChunks(async (r) => ({ count: 1, ids: [r.ids![0]] }), ids(3), TARGET);
    expect(applied).toEqual(['p0']);
  });

  it('keeps earlier chunks and stops after a failed chunk', async () => {
    let calls = 0;
    const applied = await relocateInChunks(async (r) => {
      calls++;
      if (calls === 2) throw new Error('boom');
      return echo(r);
    }, ids(4500), TARGET);
    expect(calls).toBe(2);
    expect(applied).toHaveLength(2000);
  });

  it('makes no call for no ids', async () => {
    let calls = 0;
    expect(await relocateInChunks(async (r) => { calls++; return echo(r); }, [], TARGET)).toEqual([]);
    expect(calls).toBe(0);
  });
});

describe('clearInParallel', () => {
  it('never runs more than the limit at once and returns the ids that cleared', async () => {
    let running = 0;
    let peak = 0;
    const cleared = await clearInParallel(async (id) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running--;
      if (id === 'p3') throw new Error('gone');
    }, ids(20), 6);
    expect(peak).toBe(6);
    expect(cleared).toHaveLength(19);
    expect(cleared).not.toContain('p3');
  });
});

describe('undoRelocate', () => {
  const previous = [
    { id: 'a', geotagSource: 'ExifGps', latitude: 1, longitude: 2, placeLabel: 'Exif' },
    { id: 'b', geotagSource: 'None' },
    { id: 'c', geotagSource: 'Manual', latitude: 5, longitude: 6, placeLabel: 'Cabin' },
    { id: 'd', geotagSource: 'Manual', latitude: 5, longitude: 6, placeLabel: 'Cabin' },
    { id: 'e', geotagSource: 'ExifGps', latitude: 1, longitude: 2 },
  ];

  it('clears the unplaced and restores previous manual placements in groups, only for applied ids', async () => {
    const cleared: string[] = [];
    const relocated: RelocatePhotosRequest[] = [];
    const outcome = await undoRelocate(previous, ['a', 'b', 'c', 'd'], {
      clear: async (id) => { cleared.push(id); },
      relocate: async (r) => { relocated.push(r); return echo(r); },
    });
    expect(cleared.sort()).toEqual(['a', 'b']);
    expect(relocated).toEqual([{ ids: ['c', 'd'], latitude: 5, longitude: 6, label: 'Cabin' }]);
    expect(outcome).toEqual({ done: 4, failed: 0 });
  });

  it('counts failed clears and restores', async () => {
    const outcome = await undoRelocate(previous, ['a', 'b', 'c'], {
      clear: async (id) => { if (id === 'a') throw new Error('x'); },
      relocate: async () => { throw new Error('x'); },
    });
    expect(outcome).toEqual({ done: 1, failed: 2 });
  });
});

describe('messages', () => {
  it('reports N, N of M, and a single photo', () => {
    expect(relocateMessage(3, 3)).toBe('Set location on 3 photos');
    expect(relocateMessage(1, 1)).toBe('Set location on 1 photo');
    expect(relocateMessage(2, 5)).toBe('Set location on 2 of 5 photos');
  });

  it('words the overwrite warning for one and many', () => {
    expect(overwriteWarning(1)).toBe('1 photo has a GPS or history position that will be replaced; undoable');
    expect(overwriteWarning(4)).toBe('4 photos have a GPS or history position that will be replaced; undoable');
  });
});
