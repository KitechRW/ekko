# EKKO v0.1 — YouTube Live MVP

## Scope

One publicly viewable featured event; one password-protected administrator; a single web service; a YouTube Live URL embedded in the public page.

This is an implementation checkpoint and **not** the full multi-tenant HLS/realtime platform specified elsewhere in the repository.

## How it works

1. An admin opens /admin, signs in using the server-configured password, and enters the church, event, HTTPS YouTube Live link, optional description/start time, and manual status.
2. The server validates an allowlist of YouTube hosts and extracts an eleven-character video ID before persisting the event atomically to a JSON file.
3. Public users visit / to view the event, including an embedded YouTube video when the status is Live.
4. Viewers poll for event updates every 20 seconds; broadcast changes do not require a page reload.

Statuses:
- **Upcoming:** event information and schedule; no video loaded.
- **Live:** YouTube embed and an Open on YouTube fallback link.
- **Ended:** closing message; no automatic replay in v0.1.

Changing the EKKO status does not control or verify the YouTube broadcast. Embedding may fail if the upstream stream is restricted, unavailable, or embedding is disabled. The YouTube player may expose pause/seek controls, unlike the planned native HLS experience.

## Security and deployment

- Credentials remain server-side via environment variables.
- Password and signature comparisons use timing-safe operations.
- Sessions are signed with HMAC and carried in HttpOnly, SameSite=Strict cookies; in production the cookie is Secure.
- Mutations check request origin. EKKO's default public origin/canonical URL is https://ekko.rw; explicitly configure EKKO_PUBLIC_ORIGIN=https://ekko.rw in production. This origin is also used for Open Graph/Twitter sharing URLs.
- A basic per-IP login attempt limit exists for a single Node.js process.
- Browser code assigns event data as text rather than untrusted HTML.
- CSP and browser security headers are applied.
- JSON persistence uses atomic renames and a serialized write queue.
- Production needs one Node.js worker, a persistent data volume, HTTPS proxy, supervisor and backups; scale-out requires a real database.

## Deferred

- Church self-registration, tenant isolation and roles.
- HLS live-edge player with strict no-seek behavior.
- YouTube stream-state automation and OAuth/API integration.
- Viewer count, reactions and realtime chat.
- Native TV/mobile apps, replay, payments, subscriptions and analytics.

## Verification

Run **npm run check** and **npm test**.

Manual browser acceptance:
1. Publish a public, embeddable YouTube Live video as Upcoming.
2. Confirm event title and schedule on desktop and mobile.
3. Set Live, confirm the video plays when the viewer presses Play.
4. Open in a second browser without logging in.
5. Set Ended and confirm the viewer updates within 20 seconds.
6. Restart the app and confirm event data survives.
7. Confirm unauthenticated writes and malformed YouTube URLs fail.

Automated tests do not validate real YouTube playback or production HTTPS; these require browser and deployment checks.
