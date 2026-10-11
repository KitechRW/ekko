# EKKO Roadmap

## v0.1 — First YouTube Live web broadcast

- [x] Repository and overall product architecture
- [x] Public responsive event viewer
- [x] YouTube Live URL validation and embedded playback
- [x] Upcoming / Live / Ended presentation
- [x] Single-administrator event editor and signed sessions
- [x] Persistent single-event JSON storage
- [x] Automated event validation and API tests
- [ ] Deployment to a persistent HTTPS hosting environment
- [ ] Live YouTube playback acceptance on desktop and mobile browsers

v0.1 is an intentionally single-organization **bootstrap**, not a claim of multi-church implementation. See [implementation notes](MVP_V0_1.md).

## Milestone 1 — Native/provider-neutral live player

- [ ] Configurable HLS source
- [ ] Automatic start at live edge
- [ ] No play/pause/seek UI for HLS
- [ ] Buffering, offline and reconnect states
- [ ] Program details and current clock time

## Milestone 2 — Organization + scheduling

- [ ] Organization model, profiles and branding
- [ ] Stream sources, programs and schedules
- [ ] Automatic live-session resolution
- [ ] Tenant-scoped admin authorization and roles
- [ ] Database-backed persistence

## Milestone 3 — Presence

- [ ] Realtime connection and viewer identity
- [ ] Join/leave and heartbeat expiry
- [ ] Concurrent and peak viewer counts

## Milestone 4 — Reactions

- [ ] ❤️ Love, 🙏 Amen, 🙌 Praise, 🔥 Powerful, 😭 Moved, 🕊️ Peace
- [ ] Repeated reactions and network batching
- [ ] Authoritative aggregates and animations
- [ ] TV remote reactions and high-load sampling

## Milestone 5 — Chat

- [ ] Persistence, moderation and rate limits
- [ ] Web/mobile chat input and TV read-only chat
- [ ] Per-session controls

## Milestone 6 — Client polish

- [ ] TV D-pad focus
- [ ] Native mobile clients
- [ ] Responsive, accessible web refinements
- [ ] Picture-in-picture and connection-health UX

## Later

- VOD/replays and additional smart TV platforms
- Analytics, multi-channel organizations
- Optional EKKO-managed streaming infrastructure
