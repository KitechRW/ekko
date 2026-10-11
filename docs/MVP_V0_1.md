# EKKO v0.1 — One church, one featured live event

## What the viewer experiences

EKKO is a branded, responsive destination for the church's **one administrator-approved event**. Its public page has three coordinated states:

- **Upcoming:** an event artwork, title, schedule, and a live countdown. If the scheduled time passes but YouTube has not confirmed live status, EKKO does **not** falsely label it live.
- **Live:** a YouTube embedded player. The iframe stays mounted while the same Video ID remains active, so regular status checks do not interrupt playback.
- **Ended:** a polished closing message; replay and multiple events are intentionally outside the scope of v0.1.

When no event is approved, the public page displays a branded EKKO welcome experience. Discovered-but-unapproved videos are never exposed by the public event endpoint. Browsers refresh the EKKO state without a full page reload and run the countdown locally.

## What an administrator experiences

1. Visit /admin to see the branded EKKO Studio login.
2. Configure the church name and **one permanent YouTube Channel ID** (starts with UC) once.
3. EKKO discovers public upcoming and currently live broadcasts from that channel.
4. Review the private queue and **approve one video**. This is the only action that publishes an event to the viewer.
5. EKKO verifies its status automatically. The administrator may withdraw the event or temporarily override its state.

Administrators never need to paste Video IDs, video URLs, schedules, or descriptions. EKKO derives event metadata from YouTube. YouTube playback availability and embedding permissions remain subject to YouTube and the publisher.

## How event discovery works

- EKKO uses YouTube Data API search.list for upcoming/live public videos at most once per hour automatically (two search calls per discovery). Manual scans are rate limited and subject to a daily budget guard.
- Videos.list verifies scheduledStartTime, actualStartTime and actualEndTime for tracked events. Regular verification is triggered every 60 seconds in the single running backend.
- The YouTube WebSub hub sends channel upload/metadata update notifications to /api/webhooks/youtube. EKKO verifies HMAC signatures and channel/video IDs, queues any notifications arriving mid-sync and checks the affected videos.
- WebSub does not guarantee broadcast start and end signals; status synchronization therefore retains lightweight API checks. WebSub subscriptions are renewed in advance of the hub-confirmed lease expiration.
- EKKO has one persisted JSON data file with configuration, discovered events, approval and synchronization metadata. A single server process performs serialized atomic writes. No PostgreSQL is necessary for this scope.

YouTube search may not return unlisted/private broadcasts without additional authorization; v0.1 only supports publicly discoverable broadcasts.

## Production

Run npm start with Node.js >=20 behind an HTTPS reverse proxy. Required variables:

- EKKO_ADMIN_PASSWORD (12+ chars)
- EKKO_SESSION_SECRET (32+ random chars, also used to derive the WebSub signature secret)
- YOUTUBE_API_KEY (YouTube Data API enabled; restricted as appropriate)
- EKKO_PUBLIC_ORIGIN=https://ekko.rw
- EKKO_DATA_FILE=/var/lib/ekko/featured-event.json (recommended persistent path)
- NODE_ENV=production (Secure session cookies)

The webhook must be accessible via HTTPS at https://ekko.rw/api/webhooks/youtube, while admin authentication protects approval and configuration. Use backups and restrict the JSON file to the Node service. Do not deploy multiple independent writable Node instances.

## Acceptance checklist

1. Channel connection works and the queue discovers a genuinely public scheduled YouTube broadcast.
2. The event stays off the public site until approved.
3. Approval immediately displays the Upcoming event and countdown.
4. Start the real upstream broadcast and verify the live transition and player on desktop and mobile.
5. Confirm viewer playback remains uninterrupted through periodic synchronization.
6. End the YouTube stream and confirm the Ended state arrives automatically.
7. Publish a second scheduled broadcast and verify it remains private until separately approved.
8. Check WebSub callback verification, an actual signed notification, and subscription renewals in production.
9. Confirm social image, favicon, HTTPS, persistence on restart, and all GitHub CI checks.

Node.js tests mock the YouTube API, but production integration and live device playback still require hands-on acceptance.

## Browser experience acceptance

- On an iPhone-width screen, verify that the approved stream is prominently visible, actions fit in the safe area, the watch button scrolls to the player and Theater opens/closes without recreating the same live iframe.
- On desktop/large-screen and landscape mobile, test responsive widescreen player, true fullscreen where supported, CSS fallback and keyboard controls.
- Verify the EKKO PWA install prompt on an eligible Android browser and the manual Share → Add to Home Screen flow on iOS. Browser support varies.
- Reload the installed viewer online and offline; when offline the app shell may display, but no stale live status should be represented as a new verified YouTube result.
- Test phone-sized EKKO Studio login and approval cards; Studio is not stored in the offline cache.

## Channel selection

EKKO Studio has one input for a channel name, @handle or YouTube URL. For handles, EKKO uses channels.list(forHandle); for names it uses search.list(type=channel) and channels.list to verify profiles. The admin confirms one match. EKKO stores its permanent Channel ID, name and profile picture, with no separate organization-name field.

At any time, **Replace channel** opens the same search. Confirmation clears the old approved video and discoveries, so no cross-channel content is served. If an approved live broadcast is playing, Studio warns that replacing the channel interrupts the viewers. Cancelling preserves the old channel. YouTube searches require authentication and are quota-limited.

## Sharing and Studio controls

The approved Upcoming or Live event shows one share icon in the right side of the event bar. The popup offers WhatsApp, X, Facebook and Copy, with no generic system share sheet or external YouTube viewing button. WhatsApp/X carry the event title and channel-derived church name alongside the EKKO link; Facebook relies on the event-specific Open Graph metadata; Copy saves title, church and link. No share affordance appears before approval or after Ended. Keyboard Escape and outside taps dismiss the popup, which is rendered outside the video card to avoid clipping on phones.

Studio's channel finder uses an icon inside its one input. Discovered event cards use icon-only Preview and Approve controls with titles and screen-reader labels.
