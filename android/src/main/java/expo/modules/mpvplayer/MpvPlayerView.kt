package expo.modules.mpvplayer

import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Color
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.ViewGroup
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/**
 * M2: a real libmpv-backed player for Android. Hosts a [SurfaceView], owns the
 * [MPVRenderer], parses the `source` prop, and forwards renderer callbacks to JS
 * as view events. The renderer already posts callbacks on the main thread.
 */
class MpvPlayerView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext), MpvRendererDelegate, SurfaceHolder.Callback {
  val onLoad by EventDispatcher()
  val onPlaybackStateChange by EventDispatcher()
  val onProgress by EventDispatcher()
  val onError by EventDispatcher()
  val onTracksReady by EventDispatcher()
  val onPictureInPictureChange by EventDispatcher()

  private val surfaceView = SurfaceView(context)
  private val renderer = MPVRenderer(context, this)

  private var initialized = false
  private var pendingSurface: SurfaceHolder? = null

  // App-level default VO driver, set by the config plugin as manifest meta-data.
  private val defaultVoDriver: String by lazy {
    runCatching {
      @Suppress("DEPRECATION")
      val info =
        context.packageManager.getApplicationInfo(
          context.packageName,
          PackageManager.GET_META_DATA,
        )
      info.metaData?.getString("expo.modules.mpvplayer.DEFAULT_VO_DRIVER")
    }.getOrNull() ?: "gpu-next"
  }

  init {
    setBackgroundColor(Color.BLACK)
    surfaceView.layoutParams =
      ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT,
      )
    addView(surfaceView)
    surfaceView.holder.addCallback(this)
  }

  // MARK: - Source

  fun setSource(source: Map<String, Any?>?) {
    val url = source?.get("url") as? String ?: return
    if (url.isEmpty()) return
    val config = parse(source, url)
    if (!initialized) {
      renderer.initialize(config.voDriver)
      initialized = true
      pendingSurface?.let { holder ->
        renderer.attachSurface(holder.surface)
      }
    }
    renderer.load(config)
  }

  private fun parse(source: Map<String, Any?>, url: String): MpvLoadConfig {
    @Suppress("UNCHECKED_CAST")
    val headers = (source["headers"] as? Map<String, String>) ?: emptyMap()

    @Suppress("UNCHECKED_CAST")
    val subs = (source["externalSubtitles"] as? List<String>) ?: emptyList()
    val cache = source["cacheConfig"] as? Map<*, *>
    return MpvLoadConfig(
      url = url,
      headers = headers,
      externalSubtitles = subs,
      startPosition = toDouble(source["startPosition"]),
      autoplay = source["autoplay"] as? Boolean ?: true,
      initialAudioId = toInt(source["initialAudioId"]),
      initialSubtitleId = toInt(source["initialSubtitleId"]),
      cacheEnabled = cache?.get("enabled") as? String,
      cacheSeconds = toInt(cache?.get("cacheSeconds")),
      maxBytes = toInt(cache?.get("maxBytes")),
      maxBackBytes = toInt(cache?.get("maxBackBytes")),
      voDriver = source["voDriver"] as? String ?: defaultVoDriver,
      allowSelfSignedTls = source["allowSelfSignedTls"] as? Boolean ?: false,
    )
  }

  // MARK: - Transport (called by the module's AsyncFunctions)

  fun play() = renderer.play()

  fun pause() = renderer.pause()

  fun seekTo(seconds: Double) = renderer.seekTo(seconds)

  fun seekBy(seconds: Double) = renderer.seekBy(seconds)

  fun setSpeed(rate: Double) = renderer.setSpeed(rate)

  fun getSpeed(): Double = renderer.getSpeed()

  fun isPaused(): Boolean = renderer.isPaused()

  fun getCurrentPosition(): Double = renderer.getCurrentPosition()

  fun getDuration(): Double = renderer.getDuration()

  // MARK: - Tracks

  fun getAudioTracks(): List<Map<String, Any?>> = renderer.tracks("audio").map(::audioTrackMap)

  fun getSubtitleTracks(): List<Map<String, Any?>> = renderer.tracks("sub").map(::subtitleTrackMap)

  fun setAudioTrack(id: Int) = renderer.setAudioTrack(id)

  fun setSubtitleTrack(id: Int) = renderer.setSubtitleTrack(id)

  fun disableSubtitles() = renderer.disableSubtitles()

  fun getCurrentAudioTrack(): Int? = renderer.currentTrackId("aid")

  fun getCurrentSubtitleTrack(): Int? = renderer.currentTrackId("sid")

  fun addSubtitleFile(url: String, select: Boolean) = renderer.addSubtitleFile(url, select)

  // MARK: - Video scaling

  fun setZoomedToFill(zoom: Boolean) = renderer.setZoomedToFill(zoom)

  fun isZoomedToFill(): Boolean = renderer.isZoomedToFill()

  // MARK: - Subtitle styling & A/V sync

  fun setSubtitleScale(scale: Double) = renderer.setSubtitleScale(scale)

  fun setSubtitlePosition(position: Double) = renderer.setSubtitlePosition(position)

  fun setSubtitleDelay(seconds: Double) = renderer.setSubtitleDelay(seconds)

  fun setAudioDelay(seconds: Double) = renderer.setAudioDelay(seconds)

  // MARK: - Diagnostics

  fun getTechnicalInfo(): Map<String, Any?> {
    val info = renderer.technicalInfo()
    return buildMap {
      info.videoWidth?.let { put("videoWidth", it) }
      info.videoHeight?.let { put("videoHeight", it) }
      info.videoCodec?.let { put("videoCodec", it) }
      info.audioCodec?.let { put("audioCodec", it) }
      info.fps?.let { put("fps", it) }
      info.videoBitrate?.let { put("videoBitrate", it) }
      info.audioBitrate?.let { put("audioBitrate", it) }
      info.cacheSeconds?.let { put("cacheSeconds", it) }
      info.droppedFrames?.let { put("droppedFrames", it) }
      info.voDriver?.let { put("voDriver", it) }
      info.hwdec?.let { put("hwdec", it) }
    }
  }

  // MARK: - SurfaceHolder.Callback

  override fun surfaceCreated(holder: SurfaceHolder) {
    if (initialized) {
      renderer.attachSurface(holder.surface)
    } else {
      pendingSurface = holder
    }
  }

  override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
    if (initialized) renderer.setSurfaceSize(width, height)
  }

  override fun surfaceDestroyed(holder: SurfaceHolder) {
    pendingSurface = null
    if (initialized) renderer.detachSurface()
  }

  // MARK: - MpvRendererDelegate

  override fun onLoad(url: String) {
    onLoad(mapOf("url" to url))
  }

  override fun onProgress(position: Double, duration: Double, cacheSeconds: Double) {
    val progress = if (duration > 0) position / duration else 0.0
    onProgress(
      mapOf(
        "position" to position,
        "duration" to duration,
        "progress" to progress,
        "cacheSeconds" to cacheSeconds,
      )
    )
  }

  override fun onPlaybackState(
    isPaused: Boolean?,
    isPlaying: Boolean?,
    isLoading: Boolean?,
    isReadyToSeek: Boolean?,
  ) {
    val payload = buildMap {
      isPaused?.let { put("isPaused", it) }
      isPlaying?.let { put("isPlaying", it) }
      isLoading?.let { put("isLoading", it) }
      isReadyToSeek?.let { put("isReadyToSeek", it) }
    }
    if (payload.isNotEmpty()) onPlaybackStateChange(payload)
  }

  override fun onTracksReady() {
    onTracksReady(mapOf())
  }

  override fun onError(message: String) {
    onError(mapOf("error" to message))
  }

  // MARK: - Lifecycle

  fun release() {
    renderer.destroy()
  }

  // MARK: - Helpers

  private fun audioTrackMap(t: MpvTrack): Map<String, Any?> =
    buildMap {
      put("id", t.id)
      put("selected", t.selected)
      t.title?.let { put("title", it) }
      t.lang?.let { put("lang", it) }
      t.codec?.let { put("codec", it) }
      t.channels?.let { put("channels", it) }
    }

  private fun subtitleTrackMap(t: MpvTrack): Map<String, Any?> =
    buildMap {
      put("id", t.id)
      put("selected", t.selected)
      t.title?.let { put("title", it) }
      t.lang?.let { put("lang", it) }
    }

  private fun toDouble(value: Any?): Double? =
    when (value) {
      is Double -> value
      is Int -> value.toDouble()
      is Number -> value.toDouble()
      else -> null
    }

  private fun toInt(value: Any?): Int? =
    when (value) {
      is Int -> value
      is Double -> value.toInt()
      is Number -> value.toInt()
      else -> null
    }
}
