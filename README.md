# EKKO

**EKKO is an open-source live broadcasting and participation platform for churches across TV, mobile, and web.**

Churches can schedule broadcasts, connect their own HLS stream source, and let people participate in the moment through realtime presence, chat, and expressive reactions.

## Principles

- **Live means live.** No pause, seek, rewind, or playback-speed controls in the live experience.
- **Bring your own stream.** EKKO is provider-neutral; a church supplies an HLS playlist URL.
- **Participation is first-class.** Viewers can react repeatedly with worship-oriented reactions such as ❤️ 🙏 🙌 🔥 😭 🕊️.
- **TV stays simple.** TV viewers can read chat and send reactions; chat input is reserved for web and mobile.
- **Multi-church from day one.** Organizations, broadcasts, schedules, moderators, chat, reactions, and stream sources are tenant-scoped.
- **Open and self-hostable.** The core platform is designed to be deployed and extended by churches and contributors.

## Planned workspace

```text
apps/
  api/        HTTP + realtime backend
  web/        Web viewer
  mobile/     iOS + Android viewer
  tv/         Android TV / Google TV viewer
  admin/      Church administration

packages/
  contracts/  Shared domain + realtime contracts
  sdk/        Client SDK
  config/     Shared configuration

docs/
  ARCHITECTURE.md
  PRODUCT.md
  REALTIME.md
  ROADMAP.md
```

## Live experience

```text
HLS playlist ─────────────────────────► Video player
                                             │
Realtime connection ─────────────────────────┼── viewer presence
                                             ├── chat
                                             ├── reactions
                                             └── program/session updates
```

Video and realtime interaction are intentionally independent. A temporary realtime failure should not stop video, and temporary video buffering should not destroy the social session.

## Status

EKKO is in its initial architecture and MVP stage. The first milestone is a stable continuous live player plus realtime participation.

See [the roadmap](docs/ROADMAP.md).

## License

Apache License 2.0. See [LICENSE](LICENSE).
