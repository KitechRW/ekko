# EKKO TV Live Player Design

This document adapts the full-screen, low-distraction Android TV presentation in [Deepen TV](https://github.com/KitechRW/deepen-tv) to EKKO's live broadcast experience. It defines the first EKKO TV player screen; it does not change EKKO's live-only playback rules.

## Design intent

Keep the live broadcast as the main event. Use Deepen's strong video-first composition, dark translucent overlays, clear typography, and remote-friendly focus treatment. Keep EKKO's church identity and participation visible without turning the player into a VOD control surface.

## Screen composition

- **Video surface:** edge-to-edge 16:9 HLS video, black while connecting or offline. Keep the display awake during an active session.
- **Top left:** a compact red LIVE badge and the church/program identity. Show the program title as the strongest text and the church name as secondary text.
- **Top right:** current local clock time and a compact connected-viewer count.
- **Bottom left:** a restrained, translucent chat preview with the newest few messages. Fade its lower edge into the video; do not show a text-entry field on TV.
- **Bottom right:** brief incoming reaction animations, sampled so bursts do not cover the program.
- **Connection feedback:** show a small, legible connecting/reconnecting or stream-offline state over a subtle dark scrim. Keep the program identity visible when video is unavailable.
- **Background and overlays:** near-black surfaces, white primary text, muted secondary text, and EKKO accent colors. Use soft gradients behind text for contrast instead of permanent opaque panels.

## TV remote behavior

- **OK / Select while watching:** reveal the lightweight participation overlay and focus the reaction row. It must not pause playback.
- **Directional keys:** move focus among the enabled reaction buttons. The selected reaction has a clear scale, border, and contrast change.
- **OK / Select on a reaction:** send that reaction. The same reaction can be sent repeatedly; briefly acknowledge the send and keep focus on the selected reaction.
- **Back:** close the reaction row or other transient overlay first. When no overlay is open, follow the app's navigation flow; never map Back to pause or seek.
- **Idle:** fade transient reaction controls after a short idle period while keeping LIVE status, program identity, clock, and essential connection feedback visible.
- **Focus recovery:** after reconnect or an overlay refresh, return focus to the last selected reaction, or to the first enabled reaction if the previous one is no longer available.

Chat remains read-only on TV. Do not require a keyboard, mouse, or touch input.

## Playback invariants

The TV player is for continuous live viewing:

- Never render play/pause, seek, rewind, fast-forward, playback speed, previous/next, or a VOD-style timeline.
- Start playback automatically when a valid live session and HLS source are available.
- On interruption, reconnect the player independently from chat and reactions, then resume at the current live edge.
- A realtime failure must not stop video. An HLS failure must not remove realtime participation.
- Do not imply that the stream can be rewound or resumed from an earlier point.

## Motion and accessibility

- Keep transitions short and low-motion; avoid animating the video surface itself.
- Maintain readable contrast over bright footage with gradients or scrims.
- Use TV-scale type and touch-independent focus indicators with a visible selected state.
- Announce LIVE, connection changes, viewer count updates, and reaction-send confirmation accessibly without speaking every chat message.
- Limit reaction bursts to a small visible number and coalesce overflow into a count.

## Suggested implementation shape

Use the existing Kotlin + AndroidX Media3 direction from `apps/tv/README.md`. Keep the Media3 player surface behind a Compose overlay layer. Model player connection state separately from realtime chat, presence, and reaction state. The overlay observes these states and must not own or interrupt playback.

## Acceptance checklist

- Video occupies the full screen and remains the visual focus.
- LIVE status and program identity remain legible during playback and connection errors.
- Viewer count, read-only chat, and incoming reactions fit around the video without obscuring its center.
- A TV remote can reveal the reaction row, navigate it, send repeated reactions, and dismiss it.
- No remote action or visible affordance pauses, seeks, or leaves the live edge.
- Player reconnect and realtime reconnect can succeed or fail independently.
