package expo.modules.mpvplayer

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Registers the native module/view, the six view events, the `source` prop, and
// one view-scoped AsyncFunction per imperative ref method (§5.4). Each forwards
// to the view, which owns the renderer.
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
        "onPictureInPictureChange",
      )

      Prop("source") { view: MpvPlayerView, source: Map<String, Any?>? ->
        view.setSource(source)
      }

      OnViewDestroys { view: MpvPlayerView -> view.release() }

      // Transport
      AsyncFunction("play") { view: MpvPlayerView -> view.play() }
      AsyncFunction("pause") { view: MpvPlayerView -> view.pause() }
      AsyncFunction("seekTo") { view: MpvPlayerView, seconds: Double -> view.seekTo(seconds) }
      AsyncFunction("seekBy") { view: MpvPlayerView, seconds: Double -> view.seekBy(seconds) }
      AsyncFunction("setSpeed") { view: MpvPlayerView, rate: Double -> view.setSpeed(rate) }
      AsyncFunction("getSpeed") { view: MpvPlayerView -> view.getSpeed() }
      AsyncFunction("isPaused") { view: MpvPlayerView -> view.isPaused() }
      AsyncFunction("getCurrentPosition") { view: MpvPlayerView -> view.getCurrentPosition() }
      AsyncFunction("getDuration") { view: MpvPlayerView -> view.getDuration() }

      // Audio tracks
      AsyncFunction("getAudioTracks") { view: MpvPlayerView -> view.getAudioTracks() }
      AsyncFunction("setAudioTrack") { view: MpvPlayerView, id: Int -> view.setAudioTrack(id) }
      AsyncFunction("getCurrentAudioTrack") { view: MpvPlayerView -> view.getCurrentAudioTrack() }

      // Subtitle tracks
      AsyncFunction("getSubtitleTracks") { view: MpvPlayerView -> view.getSubtitleTracks() }
      AsyncFunction("setSubtitleTrack") { view: MpvPlayerView, id: Int -> view.setSubtitleTrack(id) }
      AsyncFunction("disableSubtitles") { view: MpvPlayerView -> view.disableSubtitles() }
      AsyncFunction("getCurrentSubtitleTrack") { view: MpvPlayerView ->
        view.getCurrentSubtitleTrack()
      }
      AsyncFunction("addSubtitleFile") { view: MpvPlayerView, url: String, select: Boolean? ->
        view.addSubtitleFile(url, select ?: false)
      }

      // Video scaling
      AsyncFunction("setZoomedToFill") { view: MpvPlayerView, zoom: Boolean ->
        view.setZoomedToFill(zoom)
      }
      AsyncFunction("isZoomedToFill") { view: MpvPlayerView -> view.isZoomedToFill() }

      // Subtitle styling & A/V sync
      AsyncFunction("setSubtitleScale") { view: MpvPlayerView, scale: Double ->
        view.setSubtitleScale(scale)
      }
      AsyncFunction("setSubtitlePosition") { view: MpvPlayerView, position: Double ->
        view.setSubtitlePosition(position)
      }
      AsyncFunction("setSubtitleDelay") { view: MpvPlayerView, seconds: Double ->
        view.setSubtitleDelay(seconds)
      }
      AsyncFunction("setAudioDelay") { view: MpvPlayerView, seconds: Double ->
        view.setAudioDelay(seconds)
      }

      // Diagnostics
      AsyncFunction("getTechnicalInfo") { view: MpvPlayerView -> view.getTechnicalInfo() }

      // Reserved — PiP (out of scope for v1; no-ops returning safe defaults)
      AsyncFunction("startPictureInPicture") { _: MpvPlayerView -> }
      AsyncFunction("stopPictureInPicture") { _: MpvPlayerView -> }
      AsyncFunction("isPictureInPictureSupported") { _: MpvPlayerView -> false }
      AsyncFunction("isPictureInPictureActive") { _: MpvPlayerView -> false }
    }
  }
}
