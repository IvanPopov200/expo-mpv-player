import ExpoModulesCore

// M0 scaffold: registers the native module + view, declares the six view events,
// and parses the single `source` prop. The renderer (CAMetalLayer + libmpv) and
// the imperative AsyncFunctions are added in M1.
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
    }
  }
}
