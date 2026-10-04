/** Append-only migration ladder keyed on PRAGMA user_version. Each entry runs once, in order, inside an
 *  exclusive transaction. The upload queue is never dropped — un-uploaded rows must survive any upgrade.
 *  New schema work = push another migration; never edit a shipped entry. */
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE photo_upload_queue (
    media_store_id TEXT PRIMARY KEY,
    asset_id TEXT,
    state TEXT NOT NULL DEFAULT 'pending',
    content_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    taken_at TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    width INTEGER,
    height INTEGER,
    duration_seconds REAL,
    local_uri TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT,
    error TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_photo_queue_state ON photo_upload_queue (state, next_attempt_at);
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `,
];
