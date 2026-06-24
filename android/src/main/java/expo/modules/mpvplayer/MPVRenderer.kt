package expo.modules.mpvplayer

import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.Surface
import java.io.File

data class MpvLoadConfig(
  val url: String,
  val headers: Map<String, String> = emptyMap(),
  val externalSubtitles: List<String> = emptyList(),
  val startPosition: Double? = null,
  val autoplay: Boolean = true,
  val initialAudioId: Int? = null,
  val initialSubtitleId: Int? = null,
  val cacheEnabled: String? = null,
  val cacheSeconds: Int? = null,
  val maxBytes: Int? = null,
  val maxBackBytes: Int? = null,
  val voDriver: String = "gpu-next",
)

data class MpvTrack(
  val id: Int,
  val type: String,
  val title: String?,
  val lang: String?,
  val codec: String?,
  val channels: Int?,
  val selected: Boolean,
)

data class MpvTechnicalInfo(
  val videoWidth: Int?,
  val videoHeight: Int?,
  val videoCodec: String?,
  val audioCodec: String?,
  val fps: Double?,
  val videoBitrate: Int?,
  val audioBitrate: Int?,
  val cacheSeconds: Double?,
  val droppedFrames: Int?,
  val voDriver: String?,
  val hwdec: String?,
)

interface MpvRendererDelegate {
  fun onLoad(url: String)
  fun onProgress(position: Double, duration: Double, cacheSeconds: Double)
  fun onPlaybackState(
    isPaused: Boolean?,
    isPlaying: Boolean?,
    isLoading: Boolean?,
    isReadyToSeek: Boolean?,
  )

  fun onTracksReady()
  fun onError(message: String)
}

/**
 * High-level libmpv driver for Android. Configures the VO for the LGPL Android
 * GL path, loads with HTTP headers, observes properties, throttles `time-pos`
 * to ~1/sec (bypassed while seeking), enumerates tracks, and surfaces
 * diagnostics. All delegate callbacks are posted to the main thread.
 */
class MPVRenderer(context: Context, delegate: MpvRendererDelegate) : MpvLib.Listener {
  private val mpv = MpvLib(context)
  private val main = Handler(Looper.getMainLooper())
  private var delegate: MpvRendererDelegate? = delegate

  private var pendingConfig: MpvLoadConfig? = null
  private var lastProgressEmit = 0L
  private var seeking = false

  private companion object {
    const val PROGRESS_INTERVAL_MS = 1000L
    const val SUBFONT_ASSET = "subfont.ttf"
  }

  init {
    mpv.listener = this
    val configDir = prepareConfigDir(context)
    mpv.setOption("config", "yes")
    mpv.setOption("config-dir", configDir)
    mpv.setOption("gpu-context", "android")
    mpv.setOption("opengl-es", "yes")
    mpv.setOption("hwdec", if (isEmulator()) "no" else "mediacodec-copy")
    mpv.setOption("hwdec-codecs", "h264,hevc,mpeg4,mpeg2video,vp8,vp9,av1")
    mpv.setOption("tls-verify", "no")
    mpv.setOption("cache", "yes")
    mpv.setOption("demuxer-max-bytes", "64MiB")
    mpv.setOption("force-window", "no")
    mpv.setOption("keep-open", "always")
    mpv.setOption("ytdl", "no")
  }

  fun initialize(voDriver: String) {
    mpv.setOption("vo", voDriver)
    mpv.initialize()
    observeProperties()
  }

  private fun observeProperties() {
    mpv.observe("time-pos", MpvFormat.DOUBLE)
    mpv.observe("duration", MpvFormat.DOUBLE)
    mpv.observe("pause", MpvFormat.FLAG)
    mpv.observe("paused-for-cache", MpvFormat.FLAG)
    mpv.observe("demuxer-cache-duration", MpvFormat.DOUBLE)
    mpv.observe("track-list/count", MpvFormat.INT64)
    mpv.observe("eof-reached", MpvFormat.FLAG)
  }

  // MARK: - Surface

  fun attachSurface(surface: Surface) {
    mpv.attachSurface(surface)
    mpv.setOption("force-window", "yes")
  }

  fun setSurfaceSize(width: Int, height: Int) = mpv.setSurfaceSize(width, height)

  fun detachSurface() {
    // Keep the VO alive (do NOT set vo=null) so re-attach doesn't black-screen.
    mpv.detachSurface()
  }

  // MARK: - Load & transport

  fun load(config: MpvLoadConfig) {
    if (config.headers.isNotEmpty()) {
      val joined = config.headers.entries.joinToString(",") { "${it.key}: ${it.value}" }
      mpv.setOption("http-header-fields", joined)
    }
    config.cacheEnabled?.let { mpv.setOption("cache", it) }
    config.cacheSeconds?.let { mpv.setOption("cache-secs", it.toString()) }
    config.maxBytes?.let { mpv.setOption("demuxer-max-bytes", it.toString()) }
    config.maxBackBytes?.let { mpv.setOption("demuxer-max-back-bytes", it.toString()) }
    config.startPosition?.takeIf { it > 0 }?.let { mpv.setOption("start", it.toString()) }

    mpv.setBoolean("pause", !config.autoplay)
    pendingConfig = config
    delegate?.let { d -> main.post { d.onPlaybackState(null, null, true, false) } }
    mpv.command(arrayOf("loadfile", config.url, "replace"))
  }

  fun play() = mpv.setBoolean("pause", false)

  fun pause() = mpv.setBoolean("pause", true)

  fun seekTo(seconds: Double) {
    seeking = true
    mpv.command(arrayOf("seek", seconds.toString(), "absolute"))
  }

  fun seekBy(seconds: Double) {
    seeking = true
    mpv.command(arrayOf("seek", seconds.toString(), "relative"))
  }

  fun setSpeed(rate: Double) = mpv.setDouble("speed", rate)

  fun getSpeed(): Double = mpv.getDouble("speed") ?: 1.0

  fun isPaused(): Boolean = mpv.getBoolean("pause") ?: true

  fun getCurrentPosition(): Double = mpv.getDouble("time-pos") ?: 0.0

  fun getDuration(): Double = mpv.getDouble("duration") ?: 0.0

  // MARK: - Tracks

  fun tracks(type: String): List<MpvTrack> {
    val count = mpv.getInt("track-list/count") ?: return emptyList()
    val result = mutableListOf<MpvTrack>()
    for (i in 0 until count) {
      if (mpv.getString("track-list/$i/type") != type) continue
      val id = mpv.getInt("track-list/$i/id") ?: continue
      result.add(
        MpvTrack(
          id = id,
          type = type,
          title = mpv.getString("track-list/$i/title"),
          lang = mpv.getString("track-list/$i/lang"),
          codec = mpv.getString("track-list/$i/codec"),
          channels = mpv.getInt("track-list/$i/audio-channels"),
          selected = mpv.getBoolean("track-list/$i/selected") ?: false,
        )
      )
    }
    return result
  }

  fun setAudioTrack(id: Int) = mpv.setString("aid", id.toString())

  fun setSubtitleTrack(id: Int) = mpv.setString("sid", id.toString())

  fun disableSubtitles() = mpv.setString("sid", "no")

  fun currentTrackId(property: String): Int? {
    if (mpv.getString(property) == "no") return null
    return mpv.getInt(property)
  }

  fun addSubtitleFile(url: String, select: Boolean) {
    mpv.command(arrayOf("sub-add", url, if (select) "select" else "auto"))
  }

  // MARK: - Video scaling

  fun setZoomedToFill(zoom: Boolean) = mpv.setString("panscan", if (zoom) "1.0" else "0.0")

  fun isZoomedToFill(): Boolean = (mpv.getDouble("panscan") ?: 0.0) > 0.5

  // MARK: - Subtitle styling & A/V sync

  fun setSubtitleScale(scale: Double) = mpv.setDouble("sub-scale", scale)

  fun setSubtitlePosition(position: Double) = mpv.setDouble("sub-pos", position)

  fun setSubtitleDelay(seconds: Double) = mpv.setDouble("sub-delay", seconds)

  fun setAudioDelay(seconds: Double) = mpv.setDouble("audio-delay", seconds)

  // MARK: - Diagnostics

  fun technicalInfo(): MpvTechnicalInfo =
    MpvTechnicalInfo(
      videoWidth = mpv.getInt("width"),
      videoHeight = mpv.getInt("height"),
      videoCodec = mpv.getString("video-codec"),
      audioCodec = mpv.getString("audio-codec"),
      fps = mpv.getDouble("container-fps") ?: mpv.getDouble("estimated-vf-fps"),
      videoBitrate = mpv.getInt("video-bitrate"),
      audioBitrate = mpv.getInt("audio-bitrate"),
      cacheSeconds = mpv.getDouble("demuxer-cache-duration"),
      droppedFrames = mpv.getInt("frame-drop-count"),
      voDriver = mpv.getString("current-vo"),
      hwdec = mpv.getString("hwdec-current"),
    )

  fun destroy() {
    delegate = null
    mpv.destroy()
  }

  // MARK: - MpvLib.Listener (libmpv thread -> main thread)

  override fun onEvent(eventId: Int) {
    when (eventId) {
      MpvEvent.FILE_LOADED -> {
        applyPendingSelections()
        val url = pendingConfig?.url
        main.post {
          url?.let { delegate?.onLoad(it) }
          delegate?.onPlaybackState(null, null, false, true)
          delegate?.onTracksReady()
        }
      }
      MpvEvent.PLAYBACK_RESTART -> {
        seeking = false
        main.post { delegate?.onPlaybackState(null, null, false, true) }
      }
      MpvEvent.END_FILE -> main.post { delegate?.onPlaybackState(null, false, false, false) }
      MpvEvent.SHUTDOWN -> {}
    }
  }

  override fun onProperty(name: String) {}

  override fun onProperty(name: String, value: Long) {}

  override fun onProperty(name: String, value: Double) {
    if (name == "time-pos") emitProgressIfDue()
  }

  override fun onProperty(name: String, value: Boolean) {
    when (name) {
      "pause" -> main.post { delegate?.onPlaybackState(value, !value, null, null) }
      "paused-for-cache" -> main.post { delegate?.onPlaybackState(null, null, value, null) }
    }
  }

  override fun onProperty(name: String, value: String) {}

  private fun emitProgressIfDue() {
    val now = System.currentTimeMillis()
    if (!seeking && now - lastProgressEmit < PROGRESS_INTERVAL_MS) return
    lastProgressEmit = now
    val position = mpv.getDouble("time-pos") ?: 0.0
    val duration = mpv.getDouble("duration") ?: 0.0
    val cache = mpv.getDouble("demuxer-cache-duration") ?: 0.0
    main.post { delegate?.onProgress(position, duration, cache) }
  }

  private fun applyPendingSelections() {
    val config = pendingConfig ?: return
    config.initialAudioId?.let { setAudioTrack(it) }
    config.initialSubtitleId?.let { setSubtitleTrack(it) }
    config.externalSubtitles.forEach { mpv.command(arrayOf("sub-add", it, "auto")) }
  }

  // MARK: - Setup helpers

  /** Copies the bundled subtitle font into mpv's config dir (SRT needs it). */
  private fun prepareConfigDir(context: Context): String {
    val dir = File(context.filesDir, "mpv")
    if (!dir.exists()) dir.mkdirs()
    val font = File(dir, SUBFONT_ASSET)
    if (!font.exists()) {
      runCatching {
        context.assets.open(SUBFONT_ASSET).use { input ->
          font.outputStream().use { output -> input.copyTo(output) }
        }
      }
    }
    return dir.path
  }

  private fun isEmulator(): Boolean {
    val fp = Build.FINGERPRINT
    return fp.startsWith("generic") ||
      fp.contains("emulator", ignoreCase = true) ||
      Build.HARDWARE.contains("ranchu") ||
      Build.HARDWARE.contains("goldfish") ||
      Build.MODEL.contains("sdk", ignoreCase = true)
  }
}
