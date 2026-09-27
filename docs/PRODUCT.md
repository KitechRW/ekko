# EKKO Product Specification

## Purpose

EKKO is an open-source live broadcasting and participation platform for churches.

Any church should be able to create an organization, configure its branding, add a stream source, schedule broadcasts, and make the live experience available across TV, mobile, and web.

EKKO does not provide the upstream broadcast signal in its core architecture. A church supplies a compatible HLS playlist URL; ingest, transcoding, and CDN infrastructure may be self-hosted or provided by another service.

## Core live experience

A viewer joins a broadcast already in progress.

The live player does not expose:

- play/pause;
- seek;
- rewind or fast-forward;
- playback speed;
- previous/next media;
- a VOD-style progress bar.

On interruption, the client should reconnect automatically and return to the current live edge.

The interface may show:

- LIVE status;
- current program and church;
- current clock time;
- concurrent viewer count;
- aggregate and incoming reactions;
- realtime chat.

## Participation

### Viewer presence

Viewer count represents active connected viewing sessions, not reaction count. Presence should expire after disconnect/heartbeat timeout.

### Reactions

Initial reaction vocabulary:

- ❤️ love / touched
- 🙏 amen / prayer / agreement
- 🙌 praise / worship / celebration
- 🔥 powerful moment
- 😭 deeply moved
- 🕊️ peace / reflection

People may send the same reaction repeatedly. Reactions are responses to the current moment, not one-time votes.

High-frequency taps may be batched over the network while preserving the intended count.

### Chat

TV:
- reads realtime chat;
- does not expose chat text input;
- can send reactions.

Web and mobile:
- read realtime chat;
- send chat;
- send repeated reactions.

## Multi-church model

Core entities are organization-scoped:

- Organization
- Membership / moderator roles
- StreamSource
- Program
- BroadcastSchedule
- LiveSession
- ChatMessage
- ReactionAggregate
- ModerationAction

A church should be able to configure its own identity without modifying EKKO source code.

## Organization configuration

Expected configurable fields include:

- name and slug;
- logo / artwork;
- colors and visual identity;
- timezone;
- stream playlist URL;
- schedule;
- program metadata;
- enabled reaction types;
- chat availability;
- moderation settings.

## Platform roles

### TV

Optimized for a remote and distance viewing:
- continuous live video;
- viewer count;
- chat display;
- reactions received;
- reactions sent with remote controls;
- current program details;
- minimal overlays.

### Mobile

Optimized for participation:
- live video;
- portrait and landscape experiences;
- chat input;
- repeated reactions;
- fullscreen;
- picture-in-picture where supported.

### Web

Optimized for desktop and mobile browsers:
- custom HLS player;
- live details;
- side-by-side or overlay chat;
- repeated reactions;
- fullscreen.

### Admin

Church operators manage:
- organization settings;
- stream source;
- program schedule;
- live-session metadata;
- chat/moderation settings;
- moderators;
- basic live analytics.

## Out of initial scope

The first MVP does not require:

- VOD/replay;
- donations/payments;
- subscriptions;
- multiple simultaneous channels per organization;
- Apple TV, Samsung Tizen, or LG webOS;
- advanced recommendation/discovery systems;
- exact reaction-to-video-frame synchronization.

These may be added later without changing the core live-session model.
