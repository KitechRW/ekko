package rw.kitech.ekko.tv

import androidx.activity.compose.BackHandler
import android.os.Handler
import android.os.Looper
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.tv.material3.Button
import androidx.tv.material3.ButtonDefaults
import androidx.tv.material3.Text
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import kotlinx.coroutines.delay
import java.time.LocalTime
import java.time.format.DateTimeFormatter

private val Screen = Color(0xFF080A0D)
private val TextPrimary = Color(0xFFF7F8FA)
private val TextMuted = Color(0xFFB7C0CB)
private val AccentRed = Color(0xFFF04452)
private val Glass = Color(0xCC090C11)
private val TimeFormatter = DateTimeFormatter.ofPattern("h:mm a")

data class LiveBroadcast(
    val churchName: String,
    val programTitle: String,
    val viewerCount: Int? = null,
    val messages: List<LiveChatMessage> = emptyList(),
    val incomingReactions: List<IncomingReaction> = emptyList(),
)

data class LiveChatMessage(val id: String, val author: String, val text: String)
data class IncomingReaction(val id: String, val emoji: String, val count: Int = 1)

private enum class PlaybackStatus {
    WAITING,
    CONNECTING,
    LIVE,
    BUFFERING,
    RECONNECTING,
    OFFLINE,
}

private val PlaybackStatus.label: String
    get() = when (this) {
        PlaybackStatus.WAITING -> "WAITING"
        PlaybackStatus.CONNECTING -> "CONNECTING"
        PlaybackStatus.LIVE -> "LIVE"
        PlaybackStatus.BUFFERING -> "BUFFERING"
        PlaybackStatus.RECONNECTING -> "RECONNECTING"
        PlaybackStatus.OFFLINE -> "OFFLINE"
    }

private data class ReactionOption(val name: String, val emoji: String)

private val reactionOptions = listOf(
    ReactionOption("Love", "❤️"),
    ReactionOption("Amen", "🙏"),
    ReactionOption("Praise", "🙌"),
    ReactionOption("Powerful", "🔥"),
    ReactionOption("Moved", "😭"),
    ReactionOption("Peace", "🕊️"),
)

@Composable
fun LivePlayerScreen(
    youtubeVideoId: String,
    broadcast: LiveBroadcast,
    onReactionSent: (String) -> Unit = {},
) {
    var playbackStatus by remember(youtubeVideoId) {
        mutableStateOf(if (youtubeVideoId.isBlank()) PlaybackStatus.WAITING else PlaybackStatus.CONNECTING)
    }
    var reactionsVisible by remember { mutableStateOf(false) }
    var interactionVersion by remember { mutableIntStateOf(0) }
    var sentReaction by remember { mutableStateOf<String?>(null) }
    var currentClock by remember { mutableStateOf(LocalTime.now()) }

    LaunchedEffect(Unit) {
        while (true) {
            currentClock = LocalTime.now()
            delay(30_000)
        }
    }

    val reactionFocusRequester = remember { FocusRequester() }
    val rootFocusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        withFrameNanos { }
        runCatching { rootFocusRequester.requestFocus() }
    }

    LaunchedEffect(reactionsVisible) {
        if (reactionsVisible) {
            withFrameNanos { }
            runCatching { reactionFocusRequester.requestFocus() }
        }
    }

    LaunchedEffect(reactionsVisible, interactionVersion) {
        if (reactionsVisible) {
            delay(8_000)
            reactionsVisible = false
        }
    }

    LaunchedEffect(sentReaction) {
        if (sentReaction != null) {
            delay(1_700)
            sentReaction = null
        }
    }

    BackHandler(enabled = reactionsVisible) {
        reactionsVisible = false
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Screen)
            .onPreviewKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) {
                    return@onPreviewKeyEvent false
                }

                if (reactionsVisible) {
                    interactionVersion += 1
                    return@onPreviewKeyEvent false
                }

                when (event.key) {
                    Key.DirectionCenter,
                    Key.Enter,
                    Key.DirectionLeft,
                    Key.DirectionRight -> {
                        reactionsVisible = true
                        interactionVersion += 1
                        true
                    }
                    else -> false
                }
            }
            .focusRequester(rootFocusRequester)
            .focusable(),
    ) {
        if (youtubeVideoId.isNotBlank()) {
            YouTubePlayer(
                videoId = youtubeVideoId,
                modifier = Modifier.fillMaxSize(),
                onPlaybackState = { state ->
                    playbackStatus = when (state) {
                        1 -> PlaybackStatus.LIVE
                        3 -> PlaybackStatus.BUFFERING
                        0 -> PlaybackStatus.OFFLINE
                        else -> PlaybackStatus.CONNECTING
                    }
                },
                onPlaybackError = {
                    playbackStatus = PlaybackStatus.OFFLINE
                },
            )
        }

        Box(
            modifier = Modifier
                .align(Alignment.TopStart)
                .fillMaxWidth()
                .height(220.dp)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color(0xDD05070A), Color(0x0005070A)),
                    ),
                ),
        )
        Box(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .fillMaxWidth()
                .height(350.dp)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, Color(0xCC05070A)),
                    ),
                ),
        )

        TopStatus(
            broadcast = broadcast,
            status = playbackStatus,
            clock = TimeFormatter.format(currentClock),
            modifier = Modifier
                .align(Alignment.TopStart)
                .fillMaxWidth()
                .padding(horizontal = 64.dp, vertical = 42.dp),
        )

        if (playbackStatus != PlaybackStatus.LIVE) {
            ConnectionMessage(
                status = playbackStatus,
                modifier = Modifier.align(Alignment.Center),
            )
        }

        if (broadcast.messages.isNotEmpty()) {
            ChatPreview(
                messages = broadcast.messages.takeLast(3),
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(start = 64.dp, bottom = 46.dp)
                    .fillMaxWidth(0.43f),
            )
        }

        IncomingReactionStack(
            reactions = broadcast.incomingReactions.takeLast(3),
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 64.dp, bottom = 46.dp),
        )

        AnimatedVisibility(
            visible = reactionsVisible,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 64.dp, bottom = 46.dp),
        ) {
            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                sentReaction?.let { reaction ->
                    Text(
                        text = "$reaction sent",
                        color = TextPrimary,
                        fontSize = 18.sp,
                        modifier = Modifier
                            .clip(RoundedCornerShape(18.dp))
                            .background(Glass)
                            .padding(horizontal = 18.dp, vertical = 10.dp),
                    )
                }
                Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    reactionOptions.forEachIndexed { index, reaction ->
                        Button(
                            onClick = {
                                onReactionSent(reaction.name.lowercase())
                                sentReaction = reaction.emoji
                                interactionVersion += 1
                            },
                            modifier = Modifier
                                .then(
                                    if (index == 0) {
                                        Modifier.focusRequester(reactionFocusRequester)
                                    } else {
                                        Modifier
                                    },
                                )
                                .onFocusChanged {
                                    if (it.isFocused) interactionVersion += 1
                                }
                                .border(
                                    width = 1.dp,
                                    color = Color(0x44FFFFFF),
                                    shape = CircleShape,
                                ),
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                            colors = ButtonDefaults.colors(
                                containerColor = Color(0xEE171C23),
                                contentColor = TextPrimary,
                            ),
                        ) {
                            Text(text = reaction.emoji, fontSize = 24.sp)
                        }
                    }
                }
            }
        }

        Text(
            text = "OK  React",
            color = TextMuted,
            fontSize = 15.sp,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 68.dp, bottom = 26.dp),
        )
    }
}

@Composable
private fun YouTubePlayer(
    videoId: String,
    modifier: Modifier = Modifier,
    onPlaybackState: (Int) -> Unit,
    onPlaybackError: () -> Unit,
) {
    val lifecycleOwner = LocalLifecycleOwner.current
    var webView by remember(videoId) { mutableStateOf<WebView?>(null) }

    AndroidView(
        modifier = modifier,
        factory = { viewContext ->
            WebView(viewContext).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.mediaPlaybackRequiresUserGesture = false
                webViewClient = WebViewClient()
                webChromeClient = WebChromeClient()
                CookieManager.getInstance().setAcceptCookie(true)
                CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
                addJavascriptInterface(
                    YouTubePlaybackBridge(onPlaybackState, onPlaybackError),
                    "AndroidBridge",
                )
                isFocusable = false
                isFocusableInTouchMode = false
                loadDataWithBaseURL(
                    "https://rw.kitech.ekko/",
                    youtubePlayerHtml(videoId),
                    "text/html",
                    "UTF-8",
                    null,
                )
                webView = this
            }
        },
        update = { view -> webView = view },
    )

    DisposableEffect(videoId, lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> webView?.onResume()
                Lifecycle.Event.ON_STOP -> webView?.onPause()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        if (lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) {
            webView?.onResume()
        }

        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            webView?.apply {
                removeJavascriptInterface("AndroidBridge")
                stopLoading()
                onPause()
                destroy()
            }
        }
    }
}

private class YouTubePlaybackBridge(
    private val onPlaybackState: (Int) -> Unit,
    private val onPlaybackError: () -> Unit,
) {
    private val mainHandler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun onStateChanged(state: Int) {
        mainHandler.post { onPlaybackState(state) }
    }

    @JavascriptInterface
    fun onError(@Suppress("UNUSED_PARAMETER") code: Int) {
        mainHandler.post { onPlaybackError() }
    }
}

private fun youtubePlayerHtml(videoId: String): String = """
    <!doctype html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        html, body, #player { width:100%; height:100%; margin:0; padding:0; overflow:hidden; background:#000; }
      </style>
    </head>
    <body>
      <div id="player"></div>
      <script src="https://www.youtube.com/iframe_api"></script>
      <script>
        function onYouTubeIframeAPIReady() {
          new YT.Player('player', {
            width: '100%',
            height: '100%',
            videoId: '$videoId',
            playerVars: {
              autoplay: 1,
              controls: 0,
              rel: 0,
              playsinline: 1,
              disablekb: 1,
              enablejsapi: 1,
              origin: 'https://rw.kitech.ekko',
              widget_referrer: 'https://rw.kitech.ekko'
            },
            events: {
              onStateChange: function(event) {
                AndroidBridge.onStateChanged(event.data);
              },
              onError: function(event) {
                AndroidBridge.onError(event.data);
              }
            }
          });
        }
      </script>
    </body>
    </html>
""".trimIndent()

@Composable
private fun TopStatus(
    broadcast: LiveBroadcast,
    status: PlaybackStatus,
    clock: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top,
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(18.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(7.dp))
                    .background(if (status == PlaybackStatus.LIVE) AccentRed else Color(0xCC30363F))
                    .padding(horizontal = 12.dp, vertical = 7.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(Color.White),
                )
                Text(
                    text = status.label,
                    color = Color.White,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(
                    text = broadcast.programTitle,
                    color = TextPrimary,
                    fontSize = 25.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = broadcast.churchName,
                    color = TextMuted,
                    fontSize = 17.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }

        Row(
            horizontalArrangement = Arrangement.spacedBy(24.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            broadcast.viewerCount?.let { count ->
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(9.dp)
                            .clip(CircleShape)
                            .background(TextMuted),
                    )
                    Text(
                        text = count.toString(),
                        color = TextPrimary,
                        fontSize = 18.sp,
                    )
                }
            }
            Text(
                text = clock,
                color = TextPrimary,
                fontSize = 19.sp,
                fontWeight = FontWeight.Medium,
            )
        }
    }
}

@Composable
private fun ConnectionMessage(status: PlaybackStatus, modifier: Modifier = Modifier) {
    val message = when (status) {
        PlaybackStatus.WAITING -> "Waiting for the live broadcast"
        PlaybackStatus.CONNECTING -> "Connecting to the live broadcast"
        PlaybackStatus.BUFFERING -> "Buffering live video"
        PlaybackStatus.RECONNECTING -> "Reconnecting to the live edge"
        PlaybackStatus.OFFLINE -> "The broadcast is currently unavailable"
        PlaybackStatus.LIVE -> return
    }

    Column(
        modifier = modifier
            .clip(RoundedCornerShape(18.dp))
            .background(Glass)
            .padding(horizontal = 30.dp, vertical = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text = status.label,
            color = if (status == PlaybackStatus.OFFLINE) AccentRed else TextPrimary,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
        )
        Text(text = message, color = TextPrimary, fontSize = 20.sp)
    }
}

@Composable
private fun ChatPreview(messages: List<LiveChatMessage>, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Glass)
            .padding(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        messages.forEach { message ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = message.author,
                    color = Color(0xFFFFD98A),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                )
                Text(
                    text = message.text,
                    color = TextPrimary,
                    fontSize = 16.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun IncomingReactionStack(
    reactions: List<IncomingReaction>,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.End,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        reactions.forEach { reaction ->
            Row(
                modifier = Modifier
                    .clip(CircleShape)
                    .background(Glass)
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(text = reaction.emoji, fontSize = 22.sp)
                if (reaction.count > 1) {
                    Text(text = reaction.count.toString(), color = TextPrimary, fontSize = 16.sp)
                }
            }
        }
    }
}
