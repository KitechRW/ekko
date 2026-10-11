# EKKO

**EKKO is an open-source live broadcasting and participation platform for churches across TV, mobile, and web.**

## v0.1 — First YouTube Live broadcast

The first runnable milestone is a **single featured YouTube Live broadcast on the web**. A church administrator signs in, adds an event and YouTube link, and switches the event between Upcoming, Live and Ended. Viewers open the public EKKO page without signing in to watch the embedded video.

This is a small stepping stone toward provider-neutral HLS playback, realtime participation and multi-church support. The YouTube embed is controlled by YouTube: EKKO cannot enforce the future no-pause/no-seek principle on that embed. The Live state is set manually and **does not verify or start** the upstream YouTube broadcast.

### Run locally

Requires Node.js 20 or newer. No dependencies or database server are needed for v0.1.

1. Export EKKO_ADMIN_PASSWORD (at least 12 characters) and EKKO_SESSION_SECRET (at least 32 random characters) in the Node process environment. See .env.example. The app does not automatically load .env files.
2. Start the app with **npm start**.
3. Open http://localhost:3000/admin to manage your broadcast and http://localhost:3000 to watch it.
4. Run **npm run check** and **npm test** to validate the implementation.

Set PORT to change the port. The event is stored in data/featured-event.json by default; override with EKKO_DATA_FILE pointing to a persistent, writable location.

### Production

Deploy as a **single Node.js process** behind HTTPS termination (for example, Nginx on KITECH managed hosting).

- Set NODE_ENV=production so the admin session cookie uses Secure.
- Set strong, unique EKKO_ADMIN_PASSWORD and EKKO_SESSION_SECRET values through your secrets manager.
- Set EKKO_PUBLIC_ORIGIN to the public HTTPS origin to validate browser mutation requests.
- Store event JSON on a persistent writable volume with restricted access; back it up.
- Use a process supervisor. Do not run multiple writable instances using this JSON file; migrate to a transactional database before scaling.
- Confirm the YouTube Live video is publicly available and allows embedding. The publisher remains responsible for starting and stopping the actual YouTube broadcast.
- Protect /admin with additional edge controls if available. The built-in password and per-process rate limit suit the initial one-admin MVP.

EKKO does not proxy the video. YouTube delivers playback directly.

### MVP endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| GET | /api/health | Health status |
| GET | /api/event | Public featured event |
| GET | /api/admin/session | Authentication status |
| POST | /api/admin/login | Password sign-in |
| POST | /api/admin/logout | Clear session cookie |
| PUT | /api/admin/event | Authenticated event publishing |

See [v0.1 implementation notes](docs/MVP_V0_1.md).

## Long-term principles

- **Live means live.** Native live playback will avoid pause, seek, rewind and playback-speed controls.
- **Bring your own stream.** Future HLS support is provider-neutral; YouTube is an additional initial source.
- **Participation is first-class.** Repeated worship-oriented reactions, realtime presence and chat are planned.
- **TV stays simple.** TV viewers read chat and send reactions; chat input stays on web/mobile.
- **Multi-church architecture.** Organization-scoped data and authorization are required before expansion beyond the single featured event.
- **Open and self-hostable.** Churches can deploy and extend the core platform.

## Workspace

- apps/api — Node.js v0.1 HTTP service; future realtime backend.
- apps/web — v0.1 responsive viewer.
- apps/admin — v0.1 administrator control room.
- apps/mobile and apps/tv — future clients.
- packages/contracts — shared future-ready domain types.
- docs — product specification, architecture and roadmap.

## License

Apache License 2.0. See [LICENSE](LICENSE).
