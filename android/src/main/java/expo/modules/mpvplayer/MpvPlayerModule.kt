package expo.modules.mpvplayer

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// M0 scaffold: registers the native module + view, declares the six view events,
// and parses the single `source` prop. The renderer (SurfaceView + libmpv) and
// the imperative AsyncFunctions are added in M2.
class MpvPlayerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MpvPlayer")

    View(MpvPlayerView::class) {
      Events(
        "onLoad",
        "onPlaybackStateChange",
        "onProgress",
        "onError",
        "onTracksReady",
        "onPictureInPictureChange"
      )

      Prop("source") { view: MpvPlayerView, source: Map<String, Any?>? ->
        view.setSource(source)
      }
    }
  }
}
