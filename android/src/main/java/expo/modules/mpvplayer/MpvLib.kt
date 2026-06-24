package expo.modules.mpvplayer

import android.content.Context
import android.view.Surface
import dev.jdtech.mpv.MPVLib

/**
 * mpv property formats (ABI ints, stable across libmpv). Passed to
 * [MpvLib.observe] so we don't depend on the AAR's constant nesting.
 */
object MpvFormat {
  const val NONE = 0
  const val FLAG = 3
  const val INT64 = 4
  const val DOUBLE = 5
}

/** mpv event ids we care about (see libmpv `client.h`). */
object MpvEvent {
  const val SHUTDOWN = 1
  const val END_FILE = 7
  const val FILE_LOADED = 8
  const val SEEK = 20
  const val PLAYBACK_RESTART = 21
}

/**
 * Thin wrapper over the libmpv **instance** JNI API (`MPVLib.create(context)`,
 * 1.0.0) that multiplexes the `EventObserver` callbacks to a single [Listener].
 * Keeps the JNI surface in one place; [MPVRenderer] holds the higher-level logic.
 *
 * NOTE: `dev.jdtech.mpv.MPVLib` is the MIT-licensed JNI wrapper class. The linked
 * native libraries come from the **LGPL** AAR built by android/libmpv-build/ —
 * never from the GPL prebuilt Maven artifact (see NOTICE / CONTRIBUTING).
 */
class MpvLib(context: Context) : MPVLib.EventObserver {
  interface Listener {
    fun onEvent(eventId: Int)
    fun onProperty(name: String)
    fun onProperty(name: String, value: Long)
    fun onProperty(name: String, value: Double)
    fun onProperty(name: String, value: Boolean)
    fun onProperty(name: String, value: String)
  }

  var listener: Listener? = null

  private val mpv: MPVLib = MPVLib.create(context) ?: error("MPVLib.create returned null")

  fun setOption(name: String, value: String) = mpv.setOptionString(name, value)

  fun initialize() {
    mpv.init()
    mpv.addObserver(this)
  }

  fun observe(name: String, format: Int) = mpv.observeProperty(name, format)

  fun command(args: Array<String>) = mpv.command(args)

  fun setBoolean(name: String, value: Boolean) = mpv.setPropertyBoolean(name, value)

  fun setDouble(name: String, value: Double) = mpv.setPropertyDouble(name, value)

  fun setString(name: String, value: String) = mpv.setPropertyString(name, value)

  fun getDouble(name: String): Double? = runCatching { mpv.getPropertyDouble(name) }.getOrNull()

  fun getInt(name: String): Int? = runCatching { mpv.getPropertyInt(name) }.getOrNull()

  fun getBoolean(name: String): Boolean? = runCatching { mpv.getPropertyBoolean(name) }.getOrNull()

  fun getString(name: String): String? =
    runCatching { mpv.getPropertyString(name) }.getOrNull()?.ifEmpty { null }

  fun attachSurface(surface: Surface) = mpv.attachSurface(surface)

  fun setSurfaceSize(width: Int, height: Int) =
    mpv.setPropertyString("android-surface-size", "${width}x$height")

  fun detachSurface() = mpv.detachSurface()

  fun destroy() {
    listener = null
    runCatching { mpv.removeObserver(this) }
    runCatching { mpv.destroy() }
  }

  // --- MPVLib.EventObserver -> Listener ---
  override fun eventProperty(property: String) {
    listener?.onProperty(property)
  }

  override fun eventProperty(property: String, value: Long) {
    listener?.onProperty(property, value)
  }

  override fun eventProperty(property: String, value: Double) {
    listener?.onProperty(property, value)
  }

  override fun eventProperty(property: String, value: Boolean) {
    listener?.onProperty(property, value)
  }

  override fun eventProperty(property: String, value: String) {
    listener?.onProperty(property, value)
  }

  override fun event(eventId: Int) {
    listener?.onEvent(eventId)
  }
}
