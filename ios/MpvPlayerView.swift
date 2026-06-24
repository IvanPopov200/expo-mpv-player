import ExpoModulesCore

// M0 scaffold: an empty (black) ExpoView with the event dispatchers wired. M1
// adds the CAMetalLayer, the MPVRenderer, the AVAudioSession handling, and turns
// `setSource` into a real libmpv load.
public final class MpvPlayerView: ExpoView {
  let onLoad = EventDispatcher()
  let onPlaybackStateChange = EventDispatcher()
  let onProgress = EventDispatcher()
  let onError = EventDispatcher()
  let onTracksReady = EventDispatcher()
  let onPictureInPictureChange = EventDispatcher()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .black
  }

  func setSource(_ source: [String: Any]?) {
    // M1 wires the renderer; M0 renders an empty view.
  }
}
