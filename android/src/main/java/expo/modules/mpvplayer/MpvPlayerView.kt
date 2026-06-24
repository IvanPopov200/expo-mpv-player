package expo.modules.mpvplayer

import android.content.Context
import android.graphics.Color
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

// M0 scaffold: an empty (black) ExpoView with the event dispatchers wired. M2
// adds the SurfaceView, the MPVRenderer over libmpv's instance JNI API, and
// turns `setSource` into a real load.
class MpvPlayerView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext) {
  val onLoad by EventDispatcher()
  val onPlaybackStateChange by EventDispatcher()
  val onProgress by EventDispatcher()
  val onError by EventDispatcher()
  val onTracksReady by EventDispatcher()
  val onPictureInPictureChange by EventDispatcher()

  init {
    setBackgroundColor(Color.BLACK)
  }

  fun setSource(source: Map<String, Any?>?) {
    // M2 wires the renderer; M0 renders an empty view.
  }
}
