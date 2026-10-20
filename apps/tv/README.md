# EKKO TV

Android TV / Google TV live viewer, built with Kotlin, Jetpack Compose for TV, and AndroidX Media3.

## Current implementation

- Full-screen native HLS playback with Media3 and no playback controller.
- EKKO-style LIVE, program, church, and local clock overlay.
- Connecting, buffering, offline, and reconnecting messages.
- D-pad opens the reaction row; repeated reactions remain selectable without pausing the stream.
- Read-only chat, viewer count, and incoming reactions are renderable from broadcast state.
- Playback and screen-awake behavior follow the Activity lifecycle.

The app currently has no EKKO API or realtime client wired in. Program metadata, chat, viewer count, and incoming reactions are supplied as UI state; reaction sends are exposed through a callback for the realtime integration. The launch screen uses generic EKKO metadata until the session API is connected.

## Configure a stream for local development

Use a reachable HLS playlist URL as a Gradle property. Do not commit private stream URLs.

```sh
gradle --project-dir apps/tv -PEKKO_HLS_URL=https://example.invalid/live.m3u8 :app:assembleDebug
```

If no URL is provided, the app opens in its waiting-for-broadcast state. Install the generated `app/build/outputs/apk/debug/app-debug.apk` on an Android TV device or emulator.

The Android module uses Gradle 8.13, JDK 17, and Android SDK 36.
