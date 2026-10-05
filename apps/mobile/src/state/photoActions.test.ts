import { onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocationState } from '@lupira/photos-domain/photoLocation';

vi.mock('@lupira/photos-api/fetch/photo', () => ({
  clearPhotoLocation: vi.fn(),
  deletePhoto: vi.fn(),
  emptyPhotoTrash: vi.fn(),
  relocatePhotos: vi.fn(),
  restorePhoto: vi.fn(),
  trashPhoto: vi.fn(),
}));
vi.mock('./queryClient', () => ({ invalidatePhotos: vi.fn() }));
vi.mock('@danbro96/lupira-expo-feedback/toast', () => ({ toast: vi.fn(), toastError: vi.fn() }));

import { clearPhotoLocation, relocatePhotos } from '@lupira/photos-api/fetch/photo';
import { toast, toastError } from '@danbro96/lupira-expo-feedback/toast';
import { invalidatePhotos } from './queryClient';
import { relocate } from './photoActions';

const relocateMock = vi.mocked(relocatePhotos);
const clearMock = vi.mocked(clearPhotoLocation);
const target = { latitude: 60.1, longitude: 13.2, label: 'Cabin' };

const photos = (n: number, extra: Partial<LocationState> = {}): LocationState[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, geotagSource: 'None', ...extra }));

const ok = (ids: string[]) => ({ status: 200, data: { count: ids.length, ids } }) as never;
const status = (code: number) => ({ status: code, data: {} }) as never;
const echo = () => relocateMock.mockImplementation((req) => Promise.resolve(ok(req.ids ?? [])));
const undoOf = () => (vi.mocked(toast).mock.calls[0]![1]!.action!.onPress);

beforeEach(() => {
  vi.clearAllMocks();
  onlineManager.setOnline(true);
});

afterEach(() => {
  vi.useRealTimers();
  onlineManager.setOnline(true);
});

describe('relocate', () => {
  it('sends 2001 photos as two chunks, always with the label', async () => {
    echo();
    await expect(relocate(photos(2001), target)).resolves.toBe(true);

    const sent = relocateMock.mock.calls.map(([req]) => req);
    expect(sent.map((r) => r.ids?.length)).toEqual([2000, 1]);
    expect(sent.every((r) => r.label === 'Cabin' && r.latitude === 60.1 && r.longitude === 13.2)).toBe(true);
    expect(toast).toHaveBeenCalledWith('Set location on 2001 photos', expect.objectContaining({ action: expect.anything() }));
    expect(invalidatePhotos).toHaveBeenCalledTimes(1);
  });

  it('reports N of M when the server accepts fewer ids', async () => {
    relocateMock.mockResolvedValue(ok(['p0', 'p2']));
    await relocate(photos(3), target);
    expect(toast).toHaveBeenCalledWith('Set location on 2 of 3 photos', expect.anything());
  });

  it('skips a chunk answered 409 and keeps the ids of the others', async () => {
    relocateMock.mockResolvedValueOnce(ok(Array.from({ length: 2000 }, (_, i) => `p${i}`))).mockResolvedValueOnce(status(409));
    await relocate(photos(2001), target);
    expect(relocateMock).toHaveBeenCalledTimes(2);
    expect(toast).toHaveBeenCalledWith('Set location on 2000 of 2001 photos', expect.anything());
  });

  it('treats a thrown request like a failed chunk', async () => {
    relocateMock.mockRejectedValue(new Error('offline'));
    await relocate(photos(2), target);
    expect(toastError).toHaveBeenCalledWith('Could not set the location.');
    expect(toast).not.toHaveBeenCalled();
  });

  it('does nothing offline but says why', async () => {
    onlineManager.setOnline(false);
    await expect(relocate(photos(2), target)).resolves.toBe(false);
    expect(relocateMock).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith('Setting a location needs a connection.');
  });

  describe('Undo', () => {
    const previous: LocationState[] = [
      { id: 'a', geotagSource: 'ExifGps', latitude: 1, longitude: 2, placeLabel: 'Photo GPS' },
      { id: 'b', geotagSource: 'Manual', latitude: 3, longitude: 4, placeLabel: 'Home' },
      { id: 'c', geotagSource: 'Manual', latitude: 3, longitude: 4, placeLabel: 'Home' },
      { id: 'd', geotagSource: 'None' },
    ];

    it('clears the photos that were not hand-placed and puts the others back by group', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      echo();
      clearMock.mockResolvedValue(ok([]));
      await relocate(previous, target);
      vi.mocked(invalidatePhotos).mockClear();
      relocateMock.mockClear();

      undoOf()();
      await vi.waitFor(() => expect(invalidatePhotos).toHaveBeenCalledTimes(1));

      expect(toast).toHaveBeenCalledWith('Restoring…');
      expect(clearMock.mock.calls.map(([id]) => id).sort()).toEqual(['a', 'd']);
      expect(relocateMock.mock.calls.map(([req]) => req)).toEqual([
        { ids: ['b', 'c'], latitude: 3, longitude: 4, label: 'Home' },
      ]);

      await vi.advanceTimersByTimeAsync(3_000);
      expect(invalidatePhotos).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(5_000);
      expect(invalidatePhotos).toHaveBeenCalledTimes(3);
    });

    it('restores only the photos that were applied', async () => {
      relocateMock.mockResolvedValueOnce(ok(['b']));
      clearMock.mockResolvedValue(ok([]));
      await relocate(previous, target);
      relocateMock.mockClear();
      relocateMock.mockResolvedValue(ok(['b']));

      undoOf()();
      await vi.waitFor(() => expect(relocateMock).toHaveBeenCalledTimes(1));

      expect(relocateMock.mock.calls[0]![0].ids).toEqual(['b']);
      expect(clearMock).not.toHaveBeenCalled();
    });

    it('reports photos it could not restore', async () => {
      relocateMock.mockResolvedValueOnce(ok(['a', 'd']));
      clearMock.mockResolvedValueOnce(ok([])).mockResolvedValueOnce(status(500));
      await relocate(previous, target);

      undoOf()();
      await vi.waitFor(() => expect(toastError).toHaveBeenCalledWith('Could not restore 1 photo.'));
    });
  });
});
