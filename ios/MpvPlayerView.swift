import AVFoundation
import ExpoModulesCore

// M1: a real libmpv-backed player. Owns the CAMetalLayer render target, the
// MPVRenderer (raw libmpv via `import Libmpv`), and the AVAudioSession. Renderer
// callbacks are marshalled to the main thread before reaching JS.
public final class MpvPlayerView: ExpoView, MPVRendererDelegate {
  let onLoad = EventDispatcher()
  let onPlaybackStateChange = EventDispatcher()
  let onProgress = EventDispatcher()
  let onError = EventDispatcher()
  let onTracksReady = EventDispatcher()
  let onPictureInPictureChange = EventDispatcher()

  private let metalLayer = MPVMetalLayer()
  private var renderer: MPVRenderer?
  private var audioSessionActive = false

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .black
    layer.addSublayer(metalLayer)

    #if targetEnvironment(simulator)
      let isSimulator = true
    #else
      let isSimulator = false
    #endif
    let renderer = MPVRenderer(layer: metalLayer, isSimulator: isSimulator)
    renderer.delegate = self
    self.renderer = renderer

    NotificationCenter.default.addObserver(
      self, selector: #selector(handleInterruption(_:)),
      name: AVAudioSession.interruptionNotification, object: nil)
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
    renderer?.invalidate()
    deactivateAudioSession()
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    metalLayer.frame = bounds
    let scale = metalLayer.contentsScale
    metalLayer.drawableSize = CGSize(width: bounds.width * scale, height: bounds.height * scale)
    CATransaction.commit()
  }

  // MARK: - Source

  func setSource(_ source: [String: Any]?) {
    guard let source, let url = source["url"] as? String, !url.isEmpty else { return }
    activateAudioSession()
    renderer?.load(parse(source, url: url))
  }

  private func parse(_ source: [String: Any], url: String) -> MPVLoadConfig {
    var config = MPVLoadConfig(url: url)
    if let headers = source["headers"] as? [String: String] { config.headers = headers }
    if let subs = source["externalSubtitles"] as? [String] { config.externalSubtitles = subs }
    if let start = numberToDouble(source["startPosition"]) { config.startPosition = start }
    if let autoplay = source["autoplay"] as? Bool { config.autoplay = autoplay }
    if let aid = numberToInt(source["initialAudioId"]) { config.initialAudioId = aid }
    if let sid = numberToInt(source["initialSubtitleId"]) { config.initialSubtitleId = sid }
    if let cache = source["cacheConfig"] as? [String: Any] {
      config.cacheEnabled = cache["enabled"] as? String
      config.cacheSeconds = numberToInt(cache["cacheSeconds"])
      config.maxBytes = numberToInt(cache["maxBytes"])
      config.maxBackBytes = numberToInt(cache["maxBackBytes"])
    }
    return config
  }

  // MARK: - Transport (called by the module's AsyncFunctions)

  func play() {
    activateAudioSession()
    renderer?.play()
  }
  func pause() { renderer?.pause() }
  func seek(to seconds: Double) { renderer?.seek(to: seconds) }
  func seekBy(_ seconds: Double) { renderer?.seekBy(seconds) }
  func setSpeed(_ rate: Double) { renderer?.setSpeed(rate) }
  func getSpeed() -> Double { renderer?.getSpeed() ?? 1.0 }
  func isPaused() -> Bool { renderer?.isPaused() ?? true }
  func getCurrentPosition() -> Double { renderer?.getCurrentPosition() ?? 0 }
  func getDuration() -> Double { renderer?.getDuration() ?? 0 }

  // MARK: - Tracks

  func getAudioTracks() -> [[String: Any]] {
    (renderer?.tracks(ofType: "audio") ?? []).map(audioTrackDict)
  }
  func getSubtitleTracks() -> [[String: Any]] {
    (renderer?.tracks(ofType: "sub") ?? []).map(subtitleTrackDict)
  }
  func setAudioTrack(_ id: Int) { renderer?.setAudioTrack(id) }
  func setSubtitleTrack(_ id: Int) { renderer?.setSubtitleTrack(id) }
  func disableSubtitles() { renderer?.disableSubtitles() }
  func getCurrentAudioTrack() -> Int? { renderer?.currentTrackId("aid") }
  func getCurrentSubtitleTrack() -> Int? { renderer?.currentTrackId("sid") }
  func addSubtitleFile(_ url: String, select: Bool) { renderer?.addSubtitleFile(url, select: select) }

  // MARK: - Video scaling

  func setZoomedToFill(_ zoom: Bool) { renderer?.setZoomedToFill(zoom) }
  func isZoomedToFill() -> Bool { renderer?.isZoomedToFill() ?? false }

  // MARK: - Subtitle styling & A/V sync

  func setSubtitleScale(_ scale: Double) { renderer?.setSubtitleScale(scale) }
  func setSubtitlePosition(_ position: Double) { renderer?.setSubtitlePosition(position) }
  func setSubtitleDelay(_ seconds: Double) { renderer?.setSubtitleDelay(seconds) }
  func setAudioDelay(_ seconds: Double) { renderer?.setAudioDelay(seconds) }

  // MARK: - Diagnostics

  func getTechnicalInfo() -> [String: Any] {
    guard let info = renderer?.technicalInfo() else { return [:] }
    var dict: [String: Any] = [:]
    if let v = info.videoWidth { dict["videoWidth"] = v }
    if let v = info.videoHeight { dict["videoHeight"] = v }
    if let v = info.videoCodec { dict["videoCodec"] = v }
    if let v = info.audioCodec { dict["audioCodec"] = v }
    if let v = info.fps { dict["fps"] = v }
    if let v = info.videoBitrate { dict["videoBitrate"] = v }
    if let v = info.audioBitrate { dict["audioBitrate"] = v }
    if let v = info.cacheSeconds { dict["cacheSeconds"] = v }
    if let v = info.droppedFrames { dict["droppedFrames"] = v }
    if let v = info.voDriver { dict["voDriver"] = v }
    if let v = info.hwdec { dict["hwdec"] = v }
    return dict
  }

  // MARK: - MPVRendererDelegate (background thread -> main thread)

  func rendererDidLoad(url: String) {
    onMain { self.onLoad(["url": url]) }
  }

  func rendererDidUpdateProgress(position: Double, duration: Double, cacheSeconds: Double) {
    let progress = duration > 0 ? position / duration : 0
    onMain {
      self.onProgress([
        "position": position,
        "duration": duration,
        "progress": progress,
        "cacheSeconds": cacheSeconds,
      ])
    }
  }

  func rendererDidChangePlaybackState(
    isPaused: Bool?, isPlaying: Bool?, isLoading: Bool?, isReadyToSeek: Bool?
  ) {
    var payload: [String: Any] = [:]
    if let v = isPaused { payload["isPaused"] = v }
    if let v = isPlaying { payload["isPlaying"] = v }
    if let v = isLoading { payload["isLoading"] = v }
    if let v = isReadyToSeek { payload["isReadyToSeek"] = v }
    guard !payload.isEmpty else { return }
    onMain { self.onPlaybackStateChange(payload) }
  }

  func rendererTracksReady() {
    onMain { self.onTracksReady([:]) }
  }

  func rendererDidError(_ message: String) {
    onMain { self.onError(["error": message]) }
  }

  // MARK: - Audio session

  private func activateAudioSession() {
    guard !audioSessionActive else { return }
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playback, mode: .moviePlayback)
      try session.setActive(true)
      audioSessionActive = true
    } catch {
      MpvLog.warn("AVAudioSession activation failed: \(error.localizedDescription)")
    }
  }

  private func deactivateAudioSession() {
    guard audioSessionActive else { return }
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    audioSessionActive = false
  }

  @objc private func handleInterruption(_ note: Notification) {
    guard
      let info = note.userInfo,
      let raw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
      let type = AVAudioSession.InterruptionType(rawValue: raw)
    else { return }
    if type == .began { renderer?.pause() }
  }

  // MARK: - Helpers

  private func onMain(_ block: @escaping () -> Void) {
    if Thread.isMainThread {
      block()
    } else {
      DispatchQueue.main.async(execute: block)
    }
  }

  private func audioTrackDict(_ t: MPVTrack) -> [String: Any] {
    var dict: [String: Any] = ["id": t.id, "selected": t.selected]
    if let v = t.title { dict["title"] = v }
    if let v = t.lang { dict["lang"] = v }
    if let v = t.codec { dict["codec"] = v }
    if let v = t.channels { dict["channels"] = v }
    return dict
  }

  private func subtitleTrackDict(_ t: MPVTrack) -> [String: Any] {
    var dict: [String: Any] = ["id": t.id, "selected": t.selected]
    if let v = t.title { dict["title"] = v }
    if let v = t.lang { dict["lang"] = v }
    return dict
  }

  private func numberToDouble(_ value: Any?) -> Double? {
    if let d = value as? Double { return d }
    if let i = value as? Int { return Double(i) }
    if let n = value as? NSNumber { return n.doubleValue }
    return nil
  }

  private func numberToInt(_ value: Any?) -> Int? {
    if let i = value as? Int { return i }
    if let d = value as? Double { return Int(d) }
    if let n = value as? NSNumber { return n.intValue }
    return nil
  }
}
