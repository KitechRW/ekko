# EKKO TV

Android TV / Google TV viewer for the currently approved EKKO broadcast.

## Playback and Studio integration

The EKKO Studio remains the source of truth for the approved YouTube video. The app polls the public `/api/event` endpoint every 15 seconds while active, and embeds the video only when the event is approved, has a valid YouTube video ID, and its status is `live`. A withdrawn or ended event stops playback; changing the approved video switches the player.

The default API origin is `https://ekko.rw`. For a local or staging build, override it with `EKKO_API_BASE_URL`:

```sh
gradle --project-dir apps/tv -PEKKO_API_BASE_URL=https://ekko.rw :app:assembleDebug
```

The video ID is read at runtime and is not baked into the APK. YouTube Data API credentials remain on the Ekko backend; the TV app does not need a YouTube API key.

## TV experience

- Full-screen YouTube playback with remote-friendly controls and no VOD seek bar.
- EKKO LIVE, program, church, and local clock overlays sourced from the approved event.
- Waiting, connecting, buffering, offline, and reconnecting states.
- D-pad reaction row and overlay slots for chat, viewer count, and incoming reactions.

Chat, viewer counts, and reactions are currently presentation hooks; they are not yet connected to the EKKO realtime service.

The Android module uses Gradle 8.13, JDK 17, and Android SDK 36. Install the generated `apps/tv/app/build/outputs/apk/debug/app-debug.apk` on an Android TV device or emulator.

## Build and upload an APK

The automatic **Android TV CI** workflow checks PRs and pushes to `main`. To publish a build, open **Actions → Android TV APK → Run workflow** and choose the branch. The manual workflow builds the app, creates a SHA-256 checksum, then uploads a versioned APK and an `Ekko-TV-latest.apk` copy with their checksum files to the shared Google Drive APK folder. The installed APK follows whichever broadcast is approved in EKKO Studio.

The Ekko repository needs the `GDRIVE_RCLONE_CONFIG` secret, or the fallback `KITECHTV_RCLONE_CONFIG`, containing the same rclone Google Drive configuration used by Deepen. Configure it in **Settings → Secrets and variables → Actions**. The workflow fails with a clear error if neither secret is available. The APK is a debug build for testing/sideloading and is not signed as a Play Store release.

## Diagnostic APK: audio plays but the TV stays black

Build with `gradle --project-dir apps/tv -PEKKO_TV_DIAGNOSTICS=true :app:assembleDebug`.
The **Android TV Playback Diagnostics** GitHub Actions workflow on the
`fix/tv-playback-diagnostics` branch also builds this APK as a downloadable
GitHub Actions artifact, without replacing `Ekko-TV-latest.apk` on Google Drive.

When an approved broadcast is live, the diagnostic APK removes all Compose
gradients, labels, and reaction overlays, leaving only the WebView player.
It reports the installed WebView provider, app origin, JavaScript console,
YouTube readiness/state/error codes, autoplay blocks, and renderer exits via Logcat.

On the Mi Box, start an approved live broadcast and test whether video appears.
Press **OK** to recreate the diagnostic player. Capture logs with
`adb logcat -d -s EkkoTV:D`. Compare with the official YouTube TV app.
If the diagnostic APK still plays audio without video, WebView/device playback
is more likely than EKKO's Compose overlay. This is a diagnostic build, not a
confirmed fix for TV video rendering.
