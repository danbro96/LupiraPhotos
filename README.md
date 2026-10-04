# LupiraPhotos

Photo and video library client for the Lupira APIs: gallery, timeline, trash, links to calendar events, and camera-roll backup from the phone.

- **`src/LupiraPhotosBff`** — .NET 10 BFF. Authentik OIDC (`lupira-photos` client, PKCE), tokens in an HttpOnly cookie session (`__Host-lupira-photos`), YARP proxy to photo-, cal- and geo-api over an allowlist (`exposed.json`). Mobile clients call it with a bearer (`aud=lupira-photos`). Serves the SPA from `wwwroot`.
- **`openapi/LupiraPhotosBff.json`** — the BFF's contract, written by every `dotnet build`.
- **`apps/web`** — React + MUI SPA (Vite), built into the BFF's `wwwroot`.
- **`apps/mobile`** — Expo app "Lupira Photos" (Android, `com.lupira.photos`): the gallery plus camera-roll backup.
- **`packages/api`** (`@lupira/photos-api`) — orval client generated from the contract, `query/*` and `fetch/*` flavours.
- **`packages/domain`** (`@lupira/photos-domain`) — pure photo formatting, filtering, timeline and grid rules shared by both apps.
- **`packages/tokens`** (`@lupira/photos-tokens`) — the palette (estate core plus warning/success).

Feature notes: [docs/photos.md](docs/photos.md).

## Develop

Restoring `Lupira.*` and `@danbro96/*` packages needs `PACKAGES_TOKEN` (a PAT with `read:packages`).

```bash
npm ci
dotnet run --project src/LupiraPhotosBff                         # http://localhost:5183
npm run dev                                                      # http://localhost:5176, proxies to the BFF
npm run lint && npm run typecheck && npm test                    # all workspaces
npm run gen:api                                                  # rebuild the contract, regenerate the client
dotnet test LupiraPhotosBff.slnx                                 # unit
dotnet test tests/LupiraPhotosBff.IntegrationTests               # integration
```

Mobile (from `apps/mobile`): `npm run android` (dev client), `npm start`. Settings → Developer switches the backend (LAN `:5183`, emulator `10.0.2.2:5183`).

## Deploy

`docker build --secret id=packages_token,env=PACKAGES_TOKEN -t danbro96/lupira-photos-web .` Runs at `https://photos.lupira.com`; example compose in `deploy/`. CI builds and pushes on `main` (`release.yml`).

## Mobile release

EAS build → Play Console internal testing, as for the other Lupira apps:

- Native: push to `release/android` (`mobile-release.yml`: tests → `eas build --profile production --auto-submit` → tag `android/v<version>+<versionCode>`).
- OTA (JS-only): run `mobile-ota.yml` (branch `production` or `preview`), or `eas update --branch production --message "…"`.
- `expo.version` in `app.json` is the human version; EAS bumps `versionCode` per production build.
