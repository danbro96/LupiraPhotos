import { describe, expect, it } from 'vitest';
import { dedupeTargets, targetFromGeocode, targetFromPlace, targetFromSaved, targetFromSuggestion, type PlaceTarget } from './placeTarget';

describe('targetFromSaved', () => {
  it('uses the saved label without a place name', () => {
    expect(targetFromSaved({ id: 's1', placeId: 'p1', label: 'Home', latitude: 59.1, longitude: 13.2 })).toEqual({
      key: 'saved:s1', label: 'Home', latitude: 59.1, longitude: 13.2, source: 'saved',
    });
  });

  it('prefers the underlying place name so a rename of the saved label never goes stale', () => {
    expect(targetFromSaved({ id: 's1', placeId: 'p1', label: 'Home', latitude: 59.1, longitude: 13.2 }, 'Storgatan 1')?.label).toBe('Storgatan 1');
    expect(targetFromSaved({ id: 's1', label: 'Home', latitude: 59.1, longitude: 13.2 }, '')?.label).toBe('Home');
  });

  it('skips a saved place whose linked place was deleted', () => {
    expect(targetFromSaved({ id: 's1', label: 'Home', latitude: null, longitude: null })).toBeNull();
    expect(targetFromSaved({ id: 's1', label: 'Home', latitude: 59.1 })).toBeNull();
  });
});

describe('targetFromSuggestion', () => {
  it('carries the context as detail', () => {
    expect(targetFromSuggestion({ id: 'g1', type: 'Place', name: 'Torsby', context: 'Värmland', latitude: 60.1, longitude: 13.0 })).toEqual({
      key: 'suggest:g1', label: 'Torsby', latitude: 60.1, longitude: 13.0, source: 'suggest', detail: 'Värmland',
    });
  });

  it('omits detail without a context and skips unlocated suggestions', () => {
    expect(targetFromSuggestion({ id: 'g1', type: 'Place', name: 'Torsby', latitude: 60.1, longitude: 13.0 })).not.toHaveProperty('detail');
    expect(targetFromSuggestion({ id: 'g2', type: 'Locality', name: 'Torsby', latitude: null, longitude: null })).toBeNull();
    expect(targetFromSuggestion({ id: 'g3', type: 'Locality', name: 'Torsby' })).toBeNull();
  });
});

describe('targetFromGeocode', () => {
  it('shortens the display name to three parts and keeps the full text as detail', () => {
    const hit = { displayName: 'Storgatan 1, Torsby, Torsby kommun, Värmlands län, 685 31, Sverige', latitude: 60.13, longitude: 13.0 };
    expect(targetFromGeocode(hit)).toEqual({
      key: 'address:60.13,13', label: 'Storgatan 1, Torsby, Torsby kommun', latitude: 60.13, longitude: 13.0, source: 'address', detail: hit.displayName,
    });
  });

  it('keeps a short name whole', () => {
    expect(targetFromGeocode({ displayName: 'Torsby', latitude: 60.13, longitude: 13.0 }).label).toBe('Torsby');
  });
});

describe('targetFromPlace', () => {
  it('is an event target when the event title is given', () => {
    expect(targetFromPlace({ id: 'p1', name: 'Cabin', latitude: 60.5, longitude: 12.9 }, 'Midsummer')).toEqual({
      key: 'event:p1', label: 'Cabin', latitude: 60.5, longitude: 12.9, source: 'event', detail: 'Midsummer',
    });
  });

  it('is a plain place target without one', () => {
    expect(targetFromPlace({ id: 'p1', name: 'Cabin', latitude: 60.5, longitude: 12.9 })).toEqual({
      key: 'place:p1', label: 'Cabin', latitude: 60.5, longitude: 12.9, source: 'suggest',
    });
  });

  it('skips an unlocated place', () => {
    expect(targetFromPlace({ id: 'p1', name: 'Cabin', latitude: null, longitude: null }, 'Midsummer')).toBeNull();
    expect(targetFromPlace({ id: 'p1', name: 'Cabin' })).toBeNull();
  });
});

describe('dedupeTargets', () => {
  const at = (key: string, source: PlaceTarget['source'], latitude: number, longitude: number): PlaceTarget => ({ key, label: key, latitude, longitude, source });

  it('keeps the first of targets within the threshold, so saved wins when listed first', () => {
    const list = [at('home', 'saved', 59.1, 13.2), at('near', 'suggest', 59.10005, 13.2), at('far', 'suggest', 59.2, 13.2)];
    expect(dedupeTargets(list).map((t) => t.key)).toEqual(['home', 'far']);
  });

  it('honours the threshold argument', () => {
    const list = [at('a', 'saved', 59.1, 13.2), at('b', 'suggest', 59.1005, 13.2)];
    expect(dedupeTargets(list).map((t) => t.key)).toEqual(['a', 'b']);
    expect(dedupeTargets(list, 100).map((t) => t.key)).toEqual(['a']);
  });

  it('handles an empty list', () => {
    expect(dedupeTargets([])).toEqual([]);
  });
});
