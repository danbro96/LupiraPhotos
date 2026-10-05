import { describe, expect, it } from 'vitest';
import type { SavedPlaceDto } from '@lupira/photos-api/models';
import { aroundChips, dayPlaces } from './photoPlaces';

const saved = (id: string, label: string, latitude: number | null, longitude: number | null, isFavorite = false): SavedPlaceDto =>
  ({ id, label, latitude, longitude, isFavorite });

const HOME = saved('s1', 'Home', 59.0, 13.0, true);
const photo = (latitude: number | null, longitude: number | null, placeLabel: string | null) => ({ latitude, longitude, placeLabel });

describe('dayPlaces', () => {
  it('names photos near a saved place by it and carries its id', () => {
    const items = [photo(59.0001, 13.0001, 'Storgatan 1'), photo(59.0001, 13.0001, 'Storgatan 1'), photo(60, 14, 'Torsby')];
    expect(dayPlaces(items, [HOME], 2)).toEqual([
      { label: 'Home', savedPlaceId: 's1' },
      { label: 'Torsby', savedPlaceId: null },
    ]);
  });

  it('falls back to the place label for unlocated photos and skips unlabelled ones', () => {
    expect(dayPlaces([photo(null, null, 'Torsby'), photo(null, null, null)], [HOME], 2)).toEqual([{ label: 'Torsby', savedPlaceId: null }]);
  });

  it('ignores saved places without coordinates', () => {
    expect(dayPlaces([photo(59.0, 13.0, 'Torsby')], [saved('s2', 'Gone', null, null)], 2)).toEqual([{ label: 'Torsby', savedPlaceId: null }]);
  });
});

describe('aroundChips', () => {
  it('lists favourites first, drops places without a bbox, and caps the list', () => {
    const list = [
      saved('a', 'Zed', 59, 13), saved('b', 'Abe', 59, 13), HOME, saved('c', 'Gone', null, null), saved('d', 'Pole', 89.999, 0),
    ];
    expect(aroundChips(list, 3).map((s) => s.label)).toEqual(['Home', 'Abe', 'Zed']);
  });
});
