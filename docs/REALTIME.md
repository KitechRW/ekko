# EKKO Realtime Protocol

This document defines the initial semantic contract. Transport details may evolve.

## Room

A client joins one active live-session room:

```text
org:{organizationId}:live:{liveSessionId}
```

## Presence events

### viewer.join

Sent by a client after the live session is established.

### viewer.heartbeat

Keeps anonymous or authenticated presence active.

### viewer.count

Server broadcast:

```json
{
  "count": 842
}
```

## Reaction events

Allowed initial types:

```text
love
amen
praise
fire
moved
peace
```

### reaction.send

Client -> server:

```json
{
  "type": "amen",
  "count": 3
}
```

`count` supports batching repeated reactions and must be bounded server-side.

### reaction.activity

Server -> clients:

```json
{
  "type": "amen",
  "intensity": 3
}
```

This is a visual activity signal. It does not have to mirror every submitted reaction one-for-one.

### reaction.stats

Server -> clients:

```json
{
  "total": 16234,
  "byType": {
    "love": 8400,
    "amen": 3100,
    "praise": 2600,
    "fire": 1200,
    "moved": 640,
    "peace": 294
  }
}
```

## Chat events

### chat.send

Web/mobile -> server:

```json
{
  "message": "Amen 🙏"
}
```

TV clients must not expose this capability in their UI.

### chat.message

Server -> all clients:

```json
{
  "id": "msg_123",
  "displayName": "Jean",
  "message": "Amen 🙏",
  "createdAt": "2026-09-27T16:32:00+02:00"
}
```

## Program events

### program.updated

Server -> clients when metadata changes without restarting playback:

```json
{
  "title": "Sunday Celebration",
  "speaker": "Pastor Example",
  "description": "Live service"
}
```

## Stream state

### stream.status

Possible values:

```text
live
offline
reconnecting
ended
```

This event describes logical stream availability. Each client still owns its local playback state and retry behavior.

## Delivery expectations

Chat messages should be delivered reliably within a live session under normal connectivity.

Reaction animation events may be sampled under high load; aggregate reaction totals are authoritative.

Viewer count is an operational presence estimate and may update on a short interval rather than after every socket transition.
