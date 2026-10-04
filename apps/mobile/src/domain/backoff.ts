/** Queue-level backoff for the upload queue (distinct from the mutator's in-request retries): a transiently
 *  failing upload earns a next_attempt_at instead of hot-looping on every trigger, and parks after enough
 *  consecutive failures so the queue never wedges on a persistent-but-transient-looking error. */

export const PARK_AFTER_ATTEMPTS = 8;

const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 30 * 60_000;

/** Exponential with ±20% jitter: ~5s, 10s, 20s … capped at 30 min. */
export function nextAttemptDelayMs(attempts: number, rand: () => number = Math.random): number {
  const base = Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1), MAX_DELAY_MS);
  const jitter = base * 0.2 * (rand() * 2 - 1);
  return Math.round(base + jitter);
}
