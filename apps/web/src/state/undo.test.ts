import { describe, expect, it, vi } from 'vitest';
import { undo } from './undo';

describe('undo', () => {
  it('stays quiet when everything was put back', async () => {
    const notify = vi.fn();
    undo(Promise.resolve({ done: 2, failed: 0 }), notify);
    await new Promise((settle) => setTimeout(settle));
    expect(notify).not.toHaveBeenCalled();
  });

  it('reports an undo that failed outright', async () => {
    const notify = vi.fn();
    undo(Promise.resolve({ done: 0, failed: 1 }), notify);
    await vi.waitFor(() => expect(notify).toHaveBeenCalledWith('Could not undo'));
  });

  it('counts the photos a partial undo missed', async () => {
    const notify = vi.fn();
    undo(Promise.resolve({ done: 2, failed: 1 }), notify);
    await vi.waitFor(() => expect(notify).toHaveBeenCalledWith('Undid 2, 1 failed'));
  });

  it('reports a rejected undo the same way', async () => {
    const notify = vi.fn();
    undo(Promise.reject(new Error('offline')), notify);
    await vi.waitFor(() => expect(notify).toHaveBeenCalledWith('Could not undo'));
  });
});
