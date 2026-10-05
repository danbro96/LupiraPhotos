import { describe, expect, it } from 'vitest';
import { chunk, measuredCount, needsOverwriteConfirm, planUndo, RELOCATE_MAX_IDS, type LocationState } from './photoLocation';

const state = (id: string, geotagSource: string, extra: Partial<LocationState> = {}): LocationState => ({ id, geotagSource, ...extra });
const manual = (id: string, latitude: number, longitude: number, placeLabel: string | null = 'Home') =>
  state(id, 'Manual', { latitude, longitude, placeLabel });

describe('chunk', () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => String(i));

  it('splits at the relocate cap', () => {
    expect(RELOCATE_MAX_IDS).toBe(2000);
    expect(chunk([], RELOCATE_MAX_IDS)).toEqual([]);
    expect(chunk(ids(1), RELOCATE_MAX_IDS).map((c) => c.length)).toEqual([1]);
    expect(chunk(ids(2000), RELOCATE_MAX_IDS).map((c) => c.length)).toEqual([2000]);
    expect(chunk(ids(2001), RELOCATE_MAX_IDS).map((c) => c.length)).toEqual([2000, 1]);
    expect(chunk(ids(4500), RELOCATE_MAX_IDS).map((c) => c.length)).toEqual([2000, 2000, 500]);
  });

  it('keeps order', () => {
    expect(chunk([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
  });
});

describe('needsOverwriteConfirm', () => {
  it('is true when any fix was measured', () => {
    expect(needsOverwriteConfirm([state('a', 'None'), state('b', 'ExifGps')])).toBe(true);
    expect(needsOverwriteConfirm([state('a', 'Manual'), state('b', 'LocationHistory')])).toBe(true);
    expect(needsOverwriteConfirm([state('a', 'ExifGps')])).toBe(true);
  });

  it('is false for unmeasured sources and an empty list', () => {
    expect(needsOverwriteConfirm([state('a', 'Manual'), state('b', 'Manual')])).toBe(false);
    expect(needsOverwriteConfirm([state('a', 'None'), state('b', 'Folder')])).toBe(false);
    expect(needsOverwriteConfirm([])).toBe(false);
  });
});

describe('measuredCount', () => {
  it('counts ExifGps and LocationHistory only', () => {
    const items = [state('a', 'ExifGps'), state('b', 'LocationHistory'), state('c', 'Manual'), state('d', 'None'), state('e', 'Folder')];
    expect(measuredCount(items)).toBe(2);
    expect(measuredCount([])).toBe(0);
  });
});

describe('planUndo', () => {
  const home = { latitude: 59.1, longitude: 13.2, label: 'Home' };
  const cabin = { latitude: 60.5, longitude: 12.9, label: 'Cabin' };

  it('clears everything that was not a manual placement', () => {
    const previous = [state('a', 'ExifGps', { latitude: 1, longitude: 2 }), state('b', 'LocationHistory'), state('c', 'Folder'), state('d', 'None')];
    expect(planUndo(previous, new Set(['a', 'b', 'c', 'd']))).toEqual({ clear: ['a', 'b', 'c', 'd'], restore: [] });
  });

  it('restores photos that shared a previous manual placement as one group', () => {
    const plan = planUndo([manual('a', 59.1, 13.2), manual('b', 59.1, 13.2)], new Set(['a', 'b']));
    expect(plan).toEqual({ clear: [], restore: [{ target: home, ids: ['a', 'b'] }] });
  });

  it('keeps distinct previous placements apart in first-appearance order', () => {
    const previous = [manual('a', 60.5, 12.9, 'Cabin'), manual('b', 59.1, 13.2), manual('c', 60.5, 12.9, 'Cabin'), manual('d', 59.1, 13.2, 'Elsewhere')];
    const plan = planUndo(previous, ['a', 'b', 'c', 'd']);
    expect(plan.restore).toEqual([
      { target: cabin, ids: ['a', 'c'] },
      { target: home, ids: ['b'] },
      { target: { latitude: 59.1, longitude: 13.2, label: 'Elsewhere' }, ids: ['d'] },
    ]);
  });

  it('falls back to the coordinates when the previous label is missing', () => {
    const plan = planUndo([manual('a', 59.1, 13.2, null), manual('b', 59.1, 13.2, '')], new Set(['a', 'b']));
    expect(plan.restore).toEqual([{ target: { latitude: 59.1, longitude: 13.2, label: '59.10000, 13.20000' }, ids: ['a', 'b'] }]);
  });

  it('ignores ids that were not applied', () => {
    const previous = [manual('a', 59.1, 13.2), manual('b', 59.1, 13.2), state('c', 'ExifGps')];
    const plan = planUndo(previous, new Set(['b']));
    expect(plan).toEqual({ clear: [], restore: [{ target: home, ids: ['b'] }] });
    expect(planUndo(previous, new Set())).toEqual({ clear: [], restore: [] });
  });

  it('clears a manual photo that has no coordinates to restore', () => {
    const plan = planUndo([state('a', 'Manual'), state('b', 'Manual', { latitude: 1, longitude: null })], new Set(['a', 'b']));
    expect(plan).toEqual({ clear: ['a', 'b'], restore: [] });
  });

  it('splits a mixed selection', () => {
    const plan = planUndo([manual('a', 59.1, 13.2), state('b', 'ExifGps'), state('c', 'None')], new Set(['a', 'b', 'c']));
    expect(plan).toEqual({ clear: ['b', 'c'], restore: [{ target: home, ids: ['a'] }] });
  });
});
