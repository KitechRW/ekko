# EKKO

**Faith Through Hearing.** An open-source live broadcasting platform for churches.

## v0.1 — one church, one approved live event

EKKO v0.1 is a responsive branded web viewer and a private **EKKO Studio** dashboard. The administrator signs in and searches using **one channel-name or @handle field**; EKKO resolves the selected channel ID and EKKO discovers public upcoming and live broadcasts. **Discovered videos are never published automatically.** The administrator approves the desired video, and only that featured event appears on the public page.

After approval, the event transitions **Upcoming → Live → Ended** from verified YouTube video metadata. The viewer uses a countdown for upcoming broadcasts, an embedded live player for active broadcasts, and a gentle ended state. A manual status override is available to the administrator as a fallback.

### Deployment

Requires Node.js >=20, a single writable server process, persistent filesystem storage and HTTPS (for example via Nginx on KITECH managed infrastructure).

1. Configure EKKO_ADMIN_PASSWORD (12+ characters), EKKO_SESSION_SECRET (32+ random characters), YOUTUBE_API_KEY and EKKO_PUBLIC_ORIGIN=https://ekko.rw in the process environment (see .env.example).
2. Optionally set EKKO_DATA_FILE to a persistent path such as /var/lib/ekko/featured-event.json. This single JSON file stores the channel configuration, discovered video metadata, approvals and event status. No separate database is required.
3. Run npm start. Visit /admin for the Studio sign-in and / for the public viewer.
4. Run npm run check and npm test. Test live playback, channel notifications and production reverse-proxy/HTTPS behavior before launch.

**No Video ID, Channel ID, or organization name entry is necessary.** Search by name or @handle, then confirm the matching YouTube channel. The administrator can replace it at any time; the previous approved broadcast and discoveries are cleared before the new channel is monitored. The configured channel must have public upcoming/live events discoverable with the YouTube Data API. Unlisted or private live events may not appear in unauthenticated public discovery. YouTube must permit embedding.

### How automatic synchronization works

- Every hour, EKKO uses YouTube search.list for upcoming and active public videos. **Search calls have a separate quota bucket**; the app reserves two searches per scan, caps automated scans and limits manual rescans.
- It periodically checks tracked videos via videos.list to verify actual broadcast start/end data.
- YouTube WebSub push notifications for uploads/metadata updates trigger checks of the specific video when notifications arrive; subscription renewal is automated. **WebSub does not guarantee live-start/live-end notifications**, hence the lightweight checks.
- The admin approves one verified candidate. New discoveries stay private, even if they are live; they cannot interrupt the viewer without a new approval.
- The public viewer requests EKKO's own /api/event endpoint; it does **not** call the YouTube Data API. Its iframe stays mounted while the same live video remains featured.

### Security and scale

Studio uses a password-protected HttpOnly session, origin protection and login throttling. WebSub notifications require a valid HMAC signature derived from the configured session secret; only notifications for the connected channel are processed. No keys are exposed to browsers. Admin approval and status controls require authentication.

This is a **one-church, one-instance, one-event** release. No PostgreSQL, multi-tenant onboarding, TV/mobile apps, chat, reaction system or HLS hosting are included. Do not run multiple processes against the same writable JSON file.

### Routes

| Route | Purpose |
| --- | --- |
| GET / | Public viewing experience |
| GET /admin | Branded EKKO Studio sign-in/dashboard |
| GET /api/event | Approved public broadcast only |
| GET /api/admin/dashboard | Private connected channel, discoveries and approval |
| GET /api/admin/channel/search?q= | Search verified channels by name, @handle, or URL |
| PUT /api/admin/channel | Connect or replace selected channel after server-side verification |
| POST /api/admin/scan | Quota-aware manual discovery |
| POST /api/admin/approve | Publish a verified discovered video |
| POST /api/admin/withdraw | Remove featured event from public page |
| PUT /api/admin/status | Auto or manual status override |
| GET/POST /api/webhooks/youtube | WebSub challenge / signed notifications |

Brand assets include responsive SVG logos, a favicon and icon set, and /assets/social-card.png (1200x630), with https://ekko.rw as the canonical URL.

## License

Apache License 2.0. See [LICENSE](LICENSE).

## Adaptive browser experience (mobile and desktop)

- **Phone:** compact watch-first layout, safe-area spacing for display cutouts, large touch targets and a fixed quick-action dock for Watch, Theater and Install (where supported).
- **Desktop / large screens:** widescreen broadcast area and distraction-free Theater view. The same control also attempts real browser fullscreen after a user gesture; the in-page theater view is the fallback. Press **F** for Theater and **Esc** to exit when the page has keyboard focus.
- **Installability:** EKKO includes a PWA manifest, 192px/512px icons, a public viewer service worker, and an iOS Add to Home Screen hint. Availability depends on the browser and HTTPS deployment.
- **Offline behavior:** only the public app shell is cached as a fallback. Live state requests, the administrator interface, WebSub callbacks and YouTube video delivery are **never cached**. Streaming still needs connectivity.
- **Playback continuity:** switching layout and refreshing verified event metadata do not replace the iframe when the approved live Video ID stays unchanged. Browsers may require the viewer to tap Play for audio; autoplay cannot be guaranteed.

These are browser enhancements, not separate native iOS/Android/TV applications. Real device and browser acceptance testing remains required.

### In-page event sharing

The public viewer keeps visitors on EKKO. There is no outgoing **Watch on YouTube** button. For the approved Upcoming or Live broadcast, a single icon sits on the right side of the event information and opens **WhatsApp, X, Facebook or Copy**. WhatsApp and X include the event title, church name and EKKO link; Copy saves all three together to the clipboard. Facebook shares EKKO's URL and reads the server-rendered event-and-church link preview (Facebook does not support arbitrary prefilled post text). The redundant Share button in the mobile dock is removed. EKKO also renders event-and-church Open Graph / Twitter title and description dynamically for server-served event links; the GitHub Pages UI demo remains a static simulation.

The share menu is accessible by keyboard, closes on Escape/outside click and is positioned independently of the player to prevent clipping on narrow screens. Studio uses a magnifier icon inside the single YouTube search field and icon-only Preview/Approve actions, each with accessible labels.
