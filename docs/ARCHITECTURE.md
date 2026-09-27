# EKKO Architecture

## Design goals

1. Stable live playback.
2. Provider-neutral HLS input.
3. Independent realtime participation.
4. Multi-tenant isolation.
5. Open-source self-hosting.
6. Clients that share contracts without forcing identical UI stacks.

## High-level architecture

```text
Church broadcast infrastructure
          |
          | HLS playlist
          v
  +------------------+
  | Client player    |
  | TV/Mobile/Web    |
  +------------------+

          EKKO API
             |
      +------+------+
      |             |
   Database       Redis
      |             |
      +------v------+
         Realtime
      WebSocket layer
          |
   +------+------+------+
   |             |      |
presence        chat  reactions
```

Video delivery does not traverse the EKKO realtime server.

## Suggested initial stack

- API: Node.js + TypeScript
- HTTP framework: Fastify or NestJS
- Realtime: Socket.IO or standards-based WebSocket
- Persistent data: PostgreSQL
- Ephemeral presence/counters/pub-sub: Redis
- Web/admin: React/Next.js
- Mobile: React Native
- Android TV/Google TV: Kotlin + AndroidX Media3
- Web HLS: native HLS where available, hls.js elsewhere
- iOS playback: AVPlayer through the selected mobile implementation

These are starting choices, not protocol requirements.

## Tenancy

Every organization-owned persistent record must carry an organization identifier.

Authorization checks are performed server-side. A request containing `organizationId` does not prove membership in that organization.

Realtime rooms should include both organization and live-session scope.

Example:

```text
org:{organizationId}:live:{liveSessionId}
```

## Live-session lifecycle

```text
scheduled -> live -> ended
               |
             offline
               |
              live
```

"offline" may represent a temporary unavailable playlist while the logical live session remains active.

## Playback state

```text
initializing
   |
connecting
   |
playing <------ buffering
   |               |
   +---------------+
   |
reconnecting ------+
   |
offline
```

There is no user-facing paused state for live playback.

## Presence

Presence is ephemeral.

A viewer is active while its socket/heartbeat remains valid. Abrupt disconnects are removed after a timeout.

Metrics may include:
- concurrent connected viewers;
- peak concurrent viewers;
- total viewing sessions.

## Reactions

Repeated reactions are valid.

Clients may batch rapid taps:

```json
{
  "type": "amen",
  "count": 5
}
```

The backend validates allowed reaction types and reasonable rate limits, increments aggregates, and broadcasts a sampled visual signal plus authoritative aggregate totals.

## Scaling realtime

A first deployment can run API + realtime together.

At larger scale:
- Redis provides shared presence/counters;
- pub/sub fans events across realtime instances;
- reaction animations are sampled/aggregated;
- authoritative counts are emitted periodically;
- database writes may be buffered for high-frequency reaction totals.

## Failure independence

If realtime disconnects:
- video continues;
- the client reconnects realtime separately.

If HLS buffers:
- chat/reactions may continue;
- the player retries independently.

This separation is a core architectural invariant.
