package rw.kitech.ekko.tv

import android.view.KeyEvent as AndroidKeyEvent
import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
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
import androidx.compose.ui.input.key.nativeKeyEvent
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import androidx.tv.material3.Button
import androidx.tv.material3.ButtonDefaults
import androidx.tv.material3.Text
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
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
    streamUrl: String,
    broadcast: LiveBroadcast,
    onReactionSent: (String) -> Unit = {},
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val appContext = remember(context) { context.applicationContext }

    var playbackStatus by remember(streamUrl) {
        mutableStateOf(if (streamUrl.isBlank()) PlaybackStatus.WAITING else PlaybackStatus.CONNECTING)
    }
    var retryRequest by remember { mutableIntStateOf(0) }
    var reactionsVisible by remember { mutableStateOf(false) }
    var interactionVersion by remember { mutableIntStateOf(0) }
    var sentReaction by remember { mutableStateOf<String?>(null) }
    var currentClock by remember { mutableStateOf(LocalTime.now()) }

    val latestStatus by rememberUpdatedState(playbackStatus)
    val player = remember(streamUrl) {
        streamUrl.takeIf(String::isNotBlank)?.let { url ->
            ExoPlayer.Builder(appContext).build().apply {
                val liveItem = MediaItem.Builder()
                    .setUri(url)
                    .setLiveConfiguration(
                        MediaItem.LiveConfiguration.Builder()
                            .setTargetOffsetMs(5_000)
                            .build(),
                    )
                    .build()
                setMediaItem(liveItem)
            }
        }
    }

    val listener = remember(player) {
        object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (latestStatus == PlaybackStatus.RECONNECTING) return
                playbackStatus = when (playbackState) {
                    Player.STATE_BUFFERING -> PlaybackStatus.BUFFERING
                    Player.STATE_READY -> if (player?.isPlaying == true) PlaybackStatus.LIVE else PlaybackStatus.BUFFERING
                    Player.STATE_ENDED -> PlaybackStatus.OFFLINE
                    else -> PlaybackStatus.CONNECTING
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (isPlaying) {
                    playbackStatus = PlaybackStatus.LIVE
                } else if (player?.playbackState == Player.STATE_BUFFERING) {
                    playbackStatus = PlaybackStatus.BUFFERING
                }
            }

            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                playbackStatus = PlaybackStatus.RECONNECTING
                retryRequest += 1
            }
        }
    }

    DisposableEffect(player, lifecycleOwner) {
        player?.addListener(listener)
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> player?.play()
                Lifecycle.Event.ON_STOP -> player?.pause()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)

        if (lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) {
            player?.prepare()
            player?.play()
        }

        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            player?.removeListener(listener)
            player?.release()
        }
    }

    LaunchedEffect(player, retryRequest) {
        if (player != null && retryRequest > 0) {
            delay(3_000)
            playbackStatus = PlaybackStatus.CONNECTING
            player.seekToDefaultPosition()
            player.prepare()
            player.play()
        }
    }

    LaunchedEffect(Unit) {
        while (true) {
            currentClock = LocalTime.now()
            delay(30_000)
        }
    }

    val reactionFocusRequester = remember { FocusRequester() }
    val scope = rememberCoroutineScope()

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
                if (event.type != KeyEventType.KeyDown || event.nativeKeyEvent.repeatCount > 0) {
                    return@onPreviewKeyEvent false
                }

                if (reactionsVisible) {
                    interactionVersion += 1
                    return@onPreviewKeyEvent false
                }

                when (event.nativeKeyEvent.keyCode) {
                    AndroidKeyEvent.KEYCODE_DPAD_CENTER,
                    AndroidKeyEvent.KEYCODE_ENTER,
                    AndroidKeyEvent.KEYCODE_NUMPAD_ENTER,
                    AndroidKeyEvent.KEYCODE_DPAD_LEFT,
                    AndroidKeyEvent.KEYCODE_DPAD_RIGHT -> {
                        reactionsVisible = true
                        interactionVersion += 1
                        true
                    }
                    else -> false
                }
            }
            .focusable(),
    ) {
        if (player != null) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { viewContext ->
                    PlayerView(viewContext).apply {
                        useController = false
                        resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                        player = this@LivePlayerScreen.player
                        keepScreenOn = true
                        setShowBuffering(PlayerView.SHOW_BUFFERING_NEVER)
                        setShutterBackgroundColor(android.graphics.Color.BLACK)
                    }
                },
                update = { view -> view.player = player },
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
                    .background(AccentRed)
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
                    text = if (status == PlaybackStatus.LIVE) "LIVE" else "LIVE",
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
            text = if (status == PlaybackStatus.RECONNECTING) "RECONNECTING" else "LIVE",
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
