/** The Authentik public client for this app (PKCE, no secret). The token's audience fans out to
 *  lupira-photos + lupira-photo + lupira-cal via the -aud scope mappings, so one bearer satisfies the
 *  BFF and every upstream it proxies. Refresh grants never widen scopes — adding an audience here only
 *  takes effect after a sign-out/in. */
// No trailing slash — expo-auth-session appends `/.well-known/...` verbatim and Authentik 404s the `//`.
export const OIDC_ISSUER = 'https://auth.lupira.com/application/o/lupira-photos-mobile';
export const OIDC_CLIENT_ID = 'lupira-photos-mobile';
export const OIDC_SCOPES = [
  'openid',
  'email',
  'profile',
  'offline_access',
  'lupira-photos-aud',
  'lupira-photo-aud',
  'lupira-cal-aud',
];
export const OIDC_SCHEME = 'lupiraphotos';
/** A non-empty path is load-bearing: a bare `lupiraphotos://` normalizes to `lupiraphotos:` and the
 *  auth-session callback matcher never fires. */
export const OIDC_REDIRECT_PATH = 'oauthredirect';
