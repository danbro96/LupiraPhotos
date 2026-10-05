import { describe, expect, it } from 'vitest';
import { aroundPlaces, dayPlaces, groupTargets, nearBbox, overwriteWarning, placeHeading, relocatedMessage } from './geoPlaces';

const saved = (id: string, label: string, latitude: number | null, longitude: number | null, isFavorite = false) =>
  ({ id, label, latitude, longitude, isFavorite });

describe('aroundPlaces', () => {
  it('lists favourites first, then by label, and skips places without a usable box', () => {
    const list = [
      saved('a', 'Cabin', 60, 13),
      saved('b', 'Work', 60.1, 13.1, true),
      saved('c', 'Gone', null, null),
      saved('d', 'Antimeridian', 10, 179.9999),
      saved('e', 'Home', 60.2, 13.2, true),
    ];
    expect(aroundPlaces(list).map((s) => s.id)).toEqual(['e', 'b', 'a']);
  });

  it('caps the list', () => {
    const list = Array.from({ length: 10 }, (_, i) => saved(`p${i}`, `Place ${i}`, 60 + i / 100, 13));
    expect(aroundPlaces(list)).toHaveLength(6);
    expect(aroundPlaces(list, 3)).toHaveLength(3);
  });
});

describe('nearBbox', () => {
  const list = [saved('a', 'Cabin', 60, 13)];

  it('is the saved place box, or null when the place is unknown', () => {
    expect(nearBbox('a', list)).toMatch(/^[\d.,-]+$/);
    expect(nearBbox('missing', list)).toBeNull();
  });
});

describe('placeHeading', () => {
  const home = [saved('h', 'Home', 60, 13)];

  it('puts the saved name over the address', () => {
    expect(placeHeading({ latitude: 60, longitude: 13, placeLabel: 'Storgatan 4' }, home)).toEqual({ title: 'Home', address: 'Storgatan 4' });
  });

  it('falls back to the stored label, then to unknown', () => {
    expect(placeHeading({ latitude: 61, longitude: 14, placeLabel: 'Visby' }, home)).toEqual({ title: 'Visby', address: null });
    expect(placeHeading({}, home)).toEqual({ title: 'Unknown place', address: null });
  });

  it('does not repeat an address equal to the name', () => {
    expect(placeHeading({ latitude: 60, longitude: 13, placeLabel: 'Home' }, home).address).toBeNull();
  });
});

describe('dayPlaces', () => {
  const home = [saved('h', 'Home', 60, 13)];

  it('counts saved-place photos under their friendly name and marks them for a near filter', () => {
    const items = [
      { latitude: 60, longitude: 13, placeLabel: 'Storgatan 4' },
      { latitude: 60.0001, longitude: 13, placeLabel: 'Storgatan 6' },
      { latitude: 61, longitude: 14, placeLabel: 'Visby' },
    ];
    expect(dayPlaces(items, home, 2)).toEqual([{ label: 'Home', near: 'h' }, { label: 'Visby', near: undefined }]);
  });
});

describe('groupTargets', () => {
  const saved1 = { key: 'saved:h', label: 'Storgatan 4', latitude: 60, longitude: 13, source: 'saved' as const };

  it('splits places from addresses and drops hits on top of a saved place', () => {
    const suggestions = [
      { id: 's1', type: 'Place' as const, name: 'Next door', latitude: 60.0001, longitude: 13 },
      { id: 's2', type: 'Place' as const, name: 'Elsewhere', latitude: 61, longitude: 14 },
      { id: 's3', type: 'Locality' as const, name: 'No coordinates' },
    ];
    const addresses = [{ displayName: 'Kungsgatan 1, Visby, Gotland', latitude: 57.6, longitude: 18.3, category: 'Other' as never }];
    const grouped = groupTargets([saved1], suggestions, addresses);
    expect(grouped.places.map((t) => t.label)).toEqual(['Elsewhere']);
    expect(grouped.addresses.map((t) => t.label)).toEqual(['Kungsgatan 1, Visby, Gotland']);
  });
});

describe('relocatedMessage', () => {
  it('says N of M for a partial result', () => {
    expect(relocatedMessage(3, 3)).toBe('Set location on 3 photos');
    expect(relocatedMessage(1, 1)).toBe('Set location on 1 photo');
    expect(relocatedMessage(2, 5)).toBe('Set location on 2 of 5 photos');
  });
});

describe('overwriteWarning', () => {
  it('agrees with the count', () => {
    expect(overwriteWarning(1)).toBe('1 photo has a GPS or location-history position that will be replaced. You can undo this.');
    expect(overwriteWarning(3)).toMatch(/^3 photos have /);
  });
});
