import ExpoModulesCore

// Registers the native module/view, the six view events, the `source` prop, and
// one view-scoped AsyncFunction per imperative ref method (§5.4). Each function
// forwards to the view, which owns the renderer.
public class MpvPlayerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MpvPlayer")

    View(MpvPlayerView.self) {
      Events(
        "onLoad",
        "onPlaybackStateChange",
        "onProgress",
        "onError",
        "onTracksReady",
        "onPictureInPictureChange"
      )

      Prop("source") { (view: MpvPlayerView, source: [String: Any]?) in
        view.setSource(source)
      }

      // Transport
      AsyncFunction("play") { (view: MpvPlayerView) in view.play() }
      AsyncFunction("pause") { (view: MpvPlayerView) in view.pause() }
      AsyncFunction("seekTo") { (view: MpvPlayerView, seconds: Double) in view.seek(to: seconds) }
      AsyncFunction("seekBy") { (view: MpvPlayerView, seconds: Double) in view.seekBy(seconds) }
      AsyncFunction("setSpeed") { (view: MpvPlayerView, rate: Double) in view.setSpeed(rate) }
      AsyncFunction("getSpeed") { (view: MpvPlayerView) -> Double in view.getSpeed() }
      AsyncFunction("isPaused") { (view: MpvPlayerView) -> Bool in view.isPaused() }
      AsyncFunction("getCurrentPosition") { (view: MpvPlayerView) -> Double in
        view.getCurrentPosition()
      }
      AsyncFunction("getDuration") { (view: MpvPlayerView) -> Double in view.getDuration() }

      // Audio tracks
      AsyncFunction("getAudioTracks") { (view: MpvPlayerView) -> [[String: Any]] in
        view.getAudioTracks()
      }
      AsyncFunction("setAudioTrack") { (view: MpvPlayerView, id: Int) in view.setAudioTrack(id) }
      AsyncFunction("getCurrentAudioTrack") { (view: MpvPlayerView) -> Int? in
        view.getCurrentAudioTrack()
      }

      // Subtitle tracks
      AsyncFunction("getSubtitleTracks") { (view: MpvPlayerView) -> [[String: Any]] in
        view.getSubtitleTracks()
      }
      AsyncFunction("setSubtitleTrack") { (view: MpvPlayerView, id: Int) in
        view.setSubtitleTrack(id)
      }
      AsyncFunction("disableSubtitles") { (view: MpvPlayerView) in view.disableSubtitles() }
      AsyncFunction("getCurrentSubtitleTrack") { (view: MpvPlayerView) -> Int? in
        view.getCurrentSubtitleTrack()
      }
      AsyncFunction("addSubtitleFile") { (view: MpvPlayerView, url: String, select: Bool?) in
        view.addSubtitleFile(url, select: select ?? false)
      }

      // Video scaling
      AsyncFunction("setZoomedToFill") { (view: MpvPlayerView, zoom: Bool) in
        view.setZoomedToFill(zoom)
      }
      AsyncFunction("isZoomedToFill") { (view: MpvPlayerView) -> Bool in view.isZoomedToFill() }

      // Diagnostics
      AsyncFunction("getTechnicalInfo") { (view: MpvPlayerView) -> [String: Any] in
        view.getTechnicalInfo()
      }

      // Reserved — PiP (out of scope for v1; no-ops returning safe defaults)
      AsyncFunction("startPictureInPicture") { (_: MpvPlayerView) in }
      AsyncFunction("stopPictureInPicture") { (_: MpvPlayerView) in }
      AsyncFunction("isPictureInPictureSupported") { (_: MpvPlayerView) -> Bool in false }
      AsyncFunction("isPictureInPictureActive") { (_: MpvPlayerView) -> Bool in false }
    }
  }
}
