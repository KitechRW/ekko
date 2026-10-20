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

## Build and upload an APK

The automatic **Android TV CI** workflow checks PRs and pushes to `main`. To upload a build, open **Actions → Android TV APK → Run workflow** and choose the branch. The manual workflow builds a debug APK, creates a SHA-256 checksum, then uploads a versioned copy and an `Ekko-TV-latest.apk` copy with their checksum files to the shared Google Drive APK folder.

The Ekko repository needs the `GDRIVE_RCLONE_CONFIG` secret, or the fallback `KITECHTV_RCLONE_CONFIG`, containing the same rclone Google Drive configuration used by Deepen. Configure it in **Settings → Secrets and variables → Actions**. The workflow fails with a clear error if neither secret is available. The APK is a debug build for testing/sideloading and is not signed as a Play Store release.
