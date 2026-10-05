# Photos

Web `/` and the mobile app's root screen.

## Listing and filters

- Day-grouped, cursor-paged grid over `/photo-api/photos`. Sort is `TakenAtDesc`/`TakenAtAsc` (the cursor encodes its direction and the server rejects a mismatch). Filters: kind/located/place/status/event, plus `trashed` for the trash view.
- `GET /photos/stats` feeds the year/month timeline (a pick filters to that span rather than scrolling — an unloaded month would mean paging through everything since) and the failed chip. `POST /photos/lookup` hydrates relation ids in one call.
- The event filter resolves client-side (edges → lookup → `@lupira/photos-domain/photoFilter`), never by paging the list.
- Search is one box (web `PhotoSearch`, mobile `PhotoSearchSheet`): dates from the stats timeline (`matchTimeline`), events from cal `searchItems`, places from `GET /photos/places`; free text filters by place.
- Day headers carry the day's top places and linked events (`topPlaces` / `linkedEventIds`), each a filter.
- Web filters live in URL params (`?sort&kind&located&place&status&event&trashed&from&to`), so a view is linkable; the viewer rides `?photo=`.

## Selection, linking, trash

- Both grids multi-select for bulk link/unlink/trash. One event picker (`LinkEventDialog` / `LinkEventSheet`, window `captureWindow`) serves a single photo and a selection. Links go through `POST /items/{id}/relations/batch[/delete]`, so an Undo is one call.
- **Delete means trash**: `POST /photos/{id}/trash` offers Undo (restore) instead of a confirm. Only "Delete for good" and "Empty trash" confirm, and the server purges after `purgesAt`.
- Web Undo actions are plain fetchers (`usePhotoActions`), not mutation hooks — the snackbar outlives the component that offered it.

## Photo-event links

Photo↔event links are cal-api `Relation`s with `toKind: 'photo'` (`GET /relations/edges?toKind=photo` returns the whole map in one call). Candidates come from items around `takenAt` and are always confirmed, never auto-linked. The window is `@danbro96/lupira-domain-photos/photoWindow`, so every client that suggests links suggests the same set. Event titles come from `GET /items/{id}`.

## Location and saved places

- Photo location is photo-api's: `PUT /photos/{id}/location` and `POST /photos/relocate` (up to 2000 ids) take coordinates plus a label and overwrite measured fixes; `DELETE /photos/{id}/location` clears the override and re-queues the photo, so the original position returns asynchronously. Send a label with every set, or the server reverse-geocodes and may leave it null.
- Targets come from geo-api through the BFF: `GET /places/suggest` and `GET /geocode/forward` (place and address search), `GET /places/{id}` and `POST /places/lookup` (coordinates for a cal event's `placeId`, up to 200 ids), `GET /me/places` (saved places such as "Home", coordinates null when a linked place was deleted). Nothing else of geo-api is reachable.
- Mobile skips geo calls while `useGeoReady` is false (token minted before `lupira-geo-aud` joined the scopes; a sign-out/in fixes it). Geo 401/403/404 hides the geo features on both clients.

## Images and caching

- **Presigned URLs rotate their signature**, so mobile image caches key on the asset id via `source.cacheKey` (`ui/photos/imageCache` — `recyclingKey` only resets recycled views, it is not a cache key). photo-api reuses each signed URL for half its life so the browser cache hits too, and `staleTime` stays well inside the 24 h thumb expiry.
- `originalUrl` is single-asset-only and short-lived, so the viewer fetches it for the page in view alone.
- HEIC originals are served untranscoded — neither client can decode them, both fall back to the thumbnail.

## Duplicates

Detected server-side, twice: a surrogate `(takenAt, sizeBytes, contentType)` match at declare returns `Status: Duplicate` with no upload URL (so a second phone never transfers the bytes), and the worker hashes the original it already streams for the thumbnail and marks late duplicates, deleting their objects. A duplicate owns no bytes, points at the canonical via `duplicateOfId`, is excluded from listings unless `status=Duplicate` is asked for by name, and is deleted along with its canonical — it can never be promoted.

## Cross-app links

Built with `@danbro96/lupira-domain-links` (`webLinks` on the web, `appLinks` + `webLinks` fallback on mobile):

| From | To |
|---|---|
| Viewer "Show on the map" | maps `?at=<lon>,<lat>&layers=photos` (`mapsAtUrl`) |
| Web day header map icon | maps `?from=<day>&to=<day>&layers=photos` (`mapsRangeUrl`) |
| Mobile day header map icon | maps `?at=` of the day's first located photo |
| A linked event | calendar `?item=<id>` (`calItemUrl`) |

- Web hosts come from `config/siblings.ts`: `VITE_CAL_URL` / `VITE_MAPS_URL` / `VITE_PHOTOS_URL`, defaulting to the Vite dev ports (5174/5175/5176) in dev and `https://{cal,maps,photos}.lupira.com` in a build.
- Mobile opens the sibling's scheme and falls back to its https page when no app answers (`ui/openSibling`).
- Inbound: `?photo=`, `?event=` and `?from&to=` (YMD day bounds) on the web; on mobile `lupiraphotos://event/{id}` (or `?event=`) filters the grid to the event, `lupiraphotos://photo/{id}` (or `?photo=`) opens the viewer, `?from&to=` filters to the days.

## Mobile

- **Read cache, not a mirror.** Every hook is an `onlineQuery` (`@danbro96/lupira-expo-query`) over the generated fetchers: paused offline (`onlineManager` fed by NetInfo), refetched on foreground, one retry for transient failures only. Roots: `photos` (pages, single photos, stats, library places, saved places), `cal` (event links, titles, candidates, search), `geo` (suggest, address search, place lookups), `event-photos`. Only `photos` persists to `expo-sqlite/kv-store` (`buster` = app version, `maxAge` 7 days), so a cold start offline still has a grid and a viewer; thumbnails come from the expo-image disk cache. A write invalidates every root.
- **Auth.** `createAuthStore` (`@danbro96/lupira-expo-oidc`) owns the session. Signing in as a different account than the last one, including the first sign-in of an install, clears the query cache and `photo_upload_queue` first, so nothing of the previous account shows or uploads.
- **Upload queue.** Camera-roll backup keeps `photo_upload_queue` in its own SQLite file (`lupira-photos.db`, `@danbro96/lupira-expo-sqlite`); a queue is not a cache. Scan → declare → PUT to the presigned URL → complete, single-flight, Wi-Fi gate, exponential backoff, parking after 8 failures (`sync/photoUploader`). Settings and the per-install device id live in the same file's `meta` table, readable from the sync layer.
- **Triggers.** A pass runs on launch, foreground, reconnect and sign-in (`startPhotoBackup`), and on a best-effort background tick (`sync/backgroundTask`, WorkManager's 15-minute floor, ~30 s budget).
- The viewer's Save goes through `saveOriginalToPhone`, which files the copy as already uploaded in `photo_upload_queue` — it is a new MediaStore asset with a fresh creation time, so the next scan would otherwise upload it again.
- Layers `domain → data → sync → state → ui`; `sync` holds only the uploader, its status store and the background task.
