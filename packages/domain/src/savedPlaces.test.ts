import { describe, expect, it } from 'vitest';
import { friendlyPlace, NEAR_FILTER_RADIUS_M, NEAR_RADIUS_M, nearestSavedPlace, savedPlaceBbox, type SavedPlaceLike } from './savedPlaces';

const M_PER_DEG_LAT = 111_320;
const saved = (id: string, label: string, latitude: number | null, longitude: number | null, isFavorite = false): SavedPlaceLike => ({ id, label, latitude, longitude, isFavorite });
const northOf = (lat: number, meters: number) => lat + meters / M_PER_DEG_LAT;

describe('nearestSavedPlace', () => {
  const home = saved('h', 'Home', 59, 13);
  const point = (meters: number) => ({ latitude: northOf(59, meters), longitude: 13 });

  it('matches just inside the radius and not just outside', () => {
    expect(NEAR_RADIUS_M).toBe(150);
    expect(nearestSavedPlace(point(NEAR_RADIUS_M - 5), [home])?.id).toBe('h');
    expect(nearestSavedPlace(point(NEAR_RADIUS_M + 5), [home])).toBeNull();
  });

  it('honours a custom radius', () => {
    expect(nearestSavedPlace(point(250), [home], 300)?.id).toBe('h');
  });

  it('picks the nearer of two candidates', () => {
    const work = saved('w', 'Work', northOf(59, 60), 13);
    expect(nearestSavedPlace(point(50), [home, work])?.id).toBe('w');
  });

  it('breaks an equal-distance tie by favourite, then label', () => {
    const a = saved('a', 'Aunt', northOf(59, 10), 13);
    const b = saved('b', 'Barn', northOf(59, -10), 13, true);
    expect(nearestSavedPlace({ latitude: 59, longitude: 13 }, [a, b])?.id).toBe('b');
    const c = saved('c', 'Cabin', northOf(59, -10), 13);
    expect(nearestSavedPlace({ latitude: 59, longitude: 13 }, [c, a])?.id).toBe('a');
  });

  it('skips unlocated saved places', () => {
    expect(nearestSavedPlace({ latitude: 59, longitude: 13 }, [saved('x', 'Gone', null, null), home])?.id).toBe('h');
    expect(nearestSavedPlace({ latitude: 59, longitude: 13 }, [saved('x', 'Gone', null, null)])).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(nearestSavedPlace({ latitude: 59, longitude: 13 }, [])).toBeNull();
  });
});

describe('friendlyPlace', () => {
  const list = [saved('h', 'Home', 59, 13)];

  it('names a photo taken at a saved place', () => {
    expect(friendlyPlace({ latitude: 59.0001, longitude: 13 }, list)).toBe('Home');
  });

  it('is null for an unlocated or distant photo', () => {
    expect(friendlyPlace({ latitude: null, longitude: null }, list)).toBeNull();
    expect(friendlyPlace({}, list)).toBeNull();
    expect(friendlyPlace({ latitude: 60, longitude: 13 }, list)).toBeNull();
  });
});

describe('savedPlaceBbox', () => {
  it('pads the point by the radius in degrees', () => {
    expect(NEAR_FILTER_RADIUS_M).toBe(300);
    const [minLon, minLat, maxLon, maxLat] = savedPlaceBbox(saved('h', 'Home', 60, 13))!.split(',').map(Number);
    expect(maxLat - minLat).toBeCloseTo((2 * 300) / M_PER_DEG_LAT, 5);
    expect(maxLon - minLon).toBeCloseTo((2 * 300) / (M_PER_DEG_LAT * Math.cos((60 * Math.PI) / 180)), 5);
    expect((minLat + maxLat) / 2).toBeCloseTo(60, 5);
    expect((minLon + maxLon) / 2).toBeCloseTo(13, 5);
  });

  it('honours a custom radius', () => {
    const [, minLat, , maxLat] = savedPlaceBbox(saved('h', 'Home', 0, 0), 1000)!.split(',').map(Number);
    expect(maxLat - minLat).toBeCloseTo(2000 / M_PER_DEG_LAT, 5);
  });

  it('is null when the box would cross the antimeridian', () => {
    expect(savedPlaceBbox(saved('h', 'Fiji', -17, 179.999))).toBeNull();
    expect(savedPlaceBbox(saved('h', 'Fiji', -17, -179.999))).toBeNull();
  });

  it('is null when the box would pass a pole', () => {
    expect(savedPlaceBbox(saved('h', 'Pole', 89.999, 0))).toBeNull();
    expect(savedPlaceBbox(saved('h', 'Pole', -90, 0))).toBeNull();
  });

  it('is null without coordinates', () => {
    expect(savedPlaceBbox(saved('h', 'Gone', null, null))).toBeNull();
    expect(savedPlaceBbox({ latitude: 59 })).toBeNull();
  });
});
