import Foundation
import Libmpv

/// Snapshot of low-level playback diagnostics (mirrors the JS `TechnicalInfo`).
struct MPVTechnicalInfo {
  var videoWidth: Int?
  var videoHeight: Int?
  var videoCodec: String?
  var audioCodec: String?
  var fps: Double?
  var videoBitrate: Int?
  var audioBitrate: Int?
  var cacheSeconds: Double?
  var droppedFrames: Int?
  var voDriver: String?
  var hwdec: String?
}

struct MPVTrack {
  var id: Int
  var type: String
  var title: String?
  var lang: String?
  var codec: String?
  var channels: Int?
  var selected: Bool
}

/// Options used to (re)load a single file. Built from the JS `source` prop.
struct MPVLoadConfig {
  var url: String
  var headers: [String: String] = [:]
  var externalSubtitles: [String] = []
  var startPosition: Double?
  var autoplay: Bool = true
  var initialAudioId: Int?
  var initialSubtitleId: Int?
  var cacheEnabled: String?
  var cacheSeconds: Int?
  var maxBytes: Int?
  var maxBackBytes: Int?
  var allowSelfSignedTls: Bool = false
}

protocol MPVRendererDelegate: AnyObject {
  func rendererDidLoad(url: String)
  func rendererDidUpdateProgress(position: Double, duration: Double, cacheSeconds: Double)
  func rendererDidChangePlaybackState(
    isPaused: Bool?, isPlaying: Bool?, isLoading: Bool?, isReadyToSeek: Bool?)
  func rendererTracksReady()
  func rendererDidError(_ message: String)
}

/// Owns the raw libmpv handle and drives the canonical LGPL Metal path
/// (`vo=gpu-next` + `gpu-api=vulkan` + `gpu-context=moltenvk`). All event
/// draining happens on a background queue; the delegate is responsible for
/// hopping to the main thread before touching JS/UIKit.
final class MPVRenderer {
  weak var delegate: MPVRendererDelegate?

  private var mpv: OpaquePointer?
  private let eventQueue = DispatchQueue(label: "expo-mpv-player.events", qos: .userInitiated)

  // ~1/sec throttle for time-pos driven progress; bypassed while seeking.
  private var lastProgressEmit: TimeInterval = 0
  private var isSeeking = false
  private let progressInterval: TimeInterval = 1.0

  init(layer: MPVMetalLayer, isSimulator: Bool) {
    mpv = mpv_create()
    guard let mpv else {
      delegate?.rendererDidError("mpv_create() returned null")
      return
    }

    // Attach the CAMetalLayer as the window id BEFORE initialize.
    var layerPtr = Int64(Int(bitPattern: Unmanaged.passUnretained(layer).toOpaque()))
    mpv_set_option(mpv, "wid", MPV_FORMAT_INT64, &layerPtr)

    setOption("vo", "gpu-next")
    setOption("gpu-api", "vulkan")
    setOption("gpu-context", "moltenvk")
    setOption("hwdec", isSimulator ? "no" : "videotoolbox")
    setOption("hwdec-codecs", "all")
    // tls-verify is set per-source in load() — secure (validating) by default.
    setOption("ytdl", "no")
    setOption("keep-open", "always")
    setOption("cache", "yes")

    mpv_request_log_messages(mpv, "warn")

    let status = mpv_initialize(mpv)
    if status < 0 {
      delegate?.rendererDidError("mpv_initialize failed: \(errorString(status))")
      return
    }

    observeProperties()

    // Drain events off the main thread whenever mpv wakes us.
    mpv_set_wakeup_callback(
      mpv,
      { ctx in
        guard let ctx else { return }
        let renderer = Unmanaged<MPVRenderer>.fromOpaque(ctx).takeUnretainedValue()
        renderer.eventQueue.async { renderer.drainEvents() }
      }, Unmanaged.passUnretained(self).toOpaque())
  }

  private var destroyed = false

  deinit {
    invalidate()
  }

  /// Tears down mpv safely. Serialized on the event queue so it can't race with
  /// drainEvents(), and idempotent so an explicit teardown and MPV_EVENT_SHUTDOWN
  /// can't double-destroy. Call this from the view's teardown rather than relying
  /// on `deinit` timing.
  func invalidate() {
    eventQueue.sync { destroyMpv() }
  }

  private func destroyMpv() {
    guard !destroyed, let mpv else { return }
    destroyed = true
    mpv_set_wakeup_callback(mpv, nil, nil)
    mpv_terminate_destroy(mpv)
    self.mpv = nil
  }

  // MARK: - Load & transport

  func load(_ config: MPVLoadConfig) {
    guard let mpv else { return }

    // HTTP auth headers: set BEFORE loadfile via `change-list … append` so each
    // header is a single list item. A value containing a comma (e.g. a Jellyfin
    // `MediaBrowser Client="x", Token="y"`) is NOT split into bogus headers the
    // way a naive comma-join would. Clear first so a reload doesn't accumulate.
    command(["change-list", "http-header-fields", "clr", ""])
    for (key, value) in config.headers {
      command(["change-list", "http-header-fields", "append", "\(key): \(value)"])
    }

    // After mpv_initialize, options must be set via the property API (not
    // mpv_set_option_string, which is for pre-init configuration).
    if let enabled = config.cacheEnabled { setPropertyString("cache", value: enabled) }
    if let secs = config.cacheSeconds { setPropertyString("cache-secs", value: String(secs)) }
    if let bytes = config.maxBytes { setPropertyString("demuxer-max-bytes", value: String(bytes)) }
    if let back = config.maxBackBytes {
      setPropertyString("demuxer-max-back-bytes", value: String(back))
    }

    // Resume position (applied on the next load).
    if let start = config.startPosition, start > 0 {
      setPropertyString("start", value: String(start))
    }

    // TLS: validate certs by default; only disable for an opted-in source.
    setPropertyString("tls-verify", value: config.allowSelfSignedTls ? "no" : "yes")

    // Honour autoplay: start paused if not autoplaying.
    setPropertyFlag("pause", value: !config.autoplay)

    pendingConfig = config
    delegate?.rendererDidChangePlaybackState(
      isPaused: nil, isPlaying: nil, isLoading: true, isReadyToSeek: false)
    command(["loadfile", config.url, "replace"])
  }

  private var pendingConfig: MPVLoadConfig?

  func play() { setPropertyFlag("pause", value: false) }
  func pause() { setPropertyFlag("pause", value: true) }

  func seek(to seconds: Double) {
    isSeeking = true
    command(["seek", String(seconds), "absolute"])
  }

  func seekBy(_ seconds: Double) {
    isSeeking = true
    command(["seek", String(seconds), "relative"])
  }

  func setSpeed(_ rate: Double) {
    var value = rate
    if let mpv { mpv_set_property(mpv, "speed", MPV_FORMAT_DOUBLE, &value) }
  }

  // MARK: - Queries

  func getSpeed() -> Double { getDouble("speed") ?? 1.0 }
  func isPaused() -> Bool { getFlag("pause") ?? true }
  func getCurrentPosition() -> Double { getDouble("time-pos") ?? 0 }
  func getDuration() -> Double { getDouble("duration") ?? 0 }

  // MARK: - Tracks

  func tracks(ofType type: String) -> [MPVTrack] {
    guard let count = getInt("track-list/count") else { return [] }
    var result: [MPVTrack] = []
    for i in 0..<count {
      guard getString("track-list/\(i)/type") == type else { continue }
      guard let id = getInt("track-list/\(i)/id") else { continue }
      result.append(
        MPVTrack(
          id: id,
          type: type,
          title: getString("track-list/\(i)/title"),
          lang: getString("track-list/\(i)/lang"),
          codec: getString("track-list/\(i)/codec"),
          channels: getInt("track-list/\(i)/audio-channels"),
          selected: getFlag("track-list/\(i)/selected") ?? false
        ))
    }
    return result
  }

  func setAudioTrack(_ id: Int) { setPropertyString("aid", value: String(id)) }
  func setSubtitleTrack(_ id: Int) { setPropertyString("sid", value: String(id)) }
  func disableSubtitles() { setPropertyString("sid", value: "no") }

  func currentTrackId(_ property: String) -> Int? {
    // mpv returns "no" (string) when disabled.
    if getString(property) == "no" { return nil }
    return getInt(property)
  }

  func addSubtitleFile(_ url: String, select: Bool) {
    command(["sub-add", url, select ? "select" : "auto"])
  }

  // MARK: - Video scaling

  func setZoomedToFill(_ zoom: Bool) {
    // panscan: 0.0 fit (letterbox), 1.0 fill (crop).
    setPropertyString("panscan", value: zoom ? "1.0" : "0.0")
  }

  func isZoomedToFill() -> Bool { (getDouble("panscan") ?? 0) > 0.5 }

  // MARK: - Subtitle styling & A/V sync

  func setSubtitleScale(_ scale: Double) { setPropertyDouble("sub-scale", scale) }
  func setSubtitlePosition(_ position: Double) { setPropertyDouble("sub-pos", position) }
  func setSubtitleDelay(_ seconds: Double) { setPropertyDouble("sub-delay", seconds) }
  func setAudioDelay(_ seconds: Double) { setPropertyDouble("audio-delay", seconds) }

  // MARK: - Diagnostics

  func technicalInfo() -> MPVTechnicalInfo {
    MPVTechnicalInfo(
      videoWidth: getInt("width"),
      videoHeight: getInt("height"),
      videoCodec: getString("video-codec"),
      audioCodec: getString("audio-codec"),
      fps: getDouble("container-fps") ?? getDouble("estimated-vf-fps"),
      videoBitrate: getInt("video-bitrate"),
      audioBitrate: getInt("audio-bitrate"),
      cacheSeconds: getDouble("demuxer-cache-duration"),
      droppedFrames: getInt("frame-drop-count"),
      voDriver: getString("current-vo"),
      hwdec: getString("hwdec-current")
    )
  }

  // MARK: - Property observation

  private func observeProperties() {
    guard let mpv else { return }
    mpv_observe_property(mpv, 0, "time-pos", MPV_FORMAT_DOUBLE)
    mpv_observe_property(mpv, 0, "duration", MPV_FORMAT_DOUBLE)
    mpv_observe_property(mpv, 0, "pause", MPV_FORMAT_FLAG)
    mpv_observe_property(mpv, 0, "paused-for-cache", MPV_FORMAT_FLAG)
    mpv_observe_property(mpv, 0, "demuxer-cache-duration", MPV_FORMAT_DOUBLE)
    mpv_observe_property(mpv, 0, "eof-reached", MPV_FORMAT_FLAG)
  }

  // MARK: - Event loop

  private func drainEvents() {
    guard let mpv else { return }
    while true {
      guard let eventPtr = mpv_wait_event(mpv, 0) else { break }
      let event = eventPtr.pointee
      if event.event_id == MPV_EVENT_NONE { break }
      handle(event)
    }
  }

  private func handle(_ event: mpv_event) {
    switch event.event_id {
    case MPV_EVENT_FILE_LOADED:
      applyPendingSelections()
      if let url = pendingConfig?.url { delegate?.rendererDidLoad(url: url) }
      delegate?.rendererDidChangePlaybackState(
        isPaused: nil, isPlaying: nil, isLoading: false, isReadyToSeek: true)
      delegate?.rendererTracksReady()

    case MPV_EVENT_PLAYBACK_RESTART:
      isSeeking = false
      delegate?.rendererDidChangePlaybackState(
        isPaused: nil, isPlaying: nil, isLoading: false, isReadyToSeek: true)

    case MPV_EVENT_END_FILE:
      // Surface load/decode failures (401, bad URL, unsupported, …) as onError.
      // A clean EOF/stop has a non-ERROR reason and must not fire onError.
      if let endFile = event.data?.assumingMemoryBound(to: mpv_event_end_file.self).pointee,
        endFile.reason == MPV_END_FILE_REASON_ERROR
      {
        delegate?.rendererDidError(String(cString: mpv_error_string(endFile.error)))
      }
      delegate?.rendererDidChangePlaybackState(
        isPaused: nil, isPlaying: false, isLoading: false, isReadyToSeek: false)

    case MPV_EVENT_PROPERTY_CHANGE:
      handlePropertyChange(event)

    case MPV_EVENT_SHUTDOWN:
      destroyMpv()

    case MPV_EVENT_LOG_MESSAGE:
      if let data = event.data?.assumingMemoryBound(to: mpv_event_log_message.self).pointee,
        let text = data.text
      {
        MpvLog.warn(String(cString: text).trimmingCharacters(in: .whitespacesAndNewlines))
      }

    default:
      break
    }
  }

  private func handlePropertyChange(_ event: mpv_event) {
    guard let data = event.data?.assumingMemoryBound(to: mpv_event_property.self).pointee,
      let namePtr = data.name
    else { return }
    let name = String(cString: namePtr)

    switch name {
    case "time-pos":
      emitProgressIfDue()
    case "pause":
      if data.format == MPV_FORMAT_FLAG, let flag = data.data?.assumingMemoryBound(to: Int32.self).pointee {
        let paused = flag != 0
        delegate?.rendererDidChangePlaybackState(
          isPaused: paused, isPlaying: !paused, isLoading: nil, isReadyToSeek: nil)
      }
    case "paused-for-cache":
      if data.format == MPV_FORMAT_FLAG, let flag = data.data?.assumingMemoryBound(to: Int32.self).pointee {
        delegate?.rendererDidChangePlaybackState(
          isPaused: nil, isPlaying: nil, isLoading: flag != 0, isReadyToSeek: nil)
      }
    default:
      break
    }
  }

  private func emitProgressIfDue() {
    let now = Date().timeIntervalSince1970
    if !isSeeking && now - lastProgressEmit < progressInterval { return }
    lastProgressEmit = now
    let position = getDouble("time-pos") ?? 0
    let duration = getDouble("duration") ?? 0
    let cache = getDouble("demuxer-cache-duration") ?? 0
    delegate?.rendererDidUpdateProgress(
      position: position, duration: duration, cacheSeconds: cache)
  }

  private func applyPendingSelections() {
    guard let config = pendingConfig else { return }
    if let aid = config.initialAudioId { setAudioTrack(aid) }
    if let sid = config.initialSubtitleId { setSubtitleTrack(sid) }
    for sub in config.externalSubtitles {
      command(["sub-add", sub, "auto"])
    }
  }

  // MARK: - libmpv helpers

  private func setOption(_ name: String, _ value: String) {
    guard let mpv else { return }
    mpv_set_option_string(mpv, name, value)
  }

  private func setPropertyString(_ name: String, value: String) {
    guard let mpv else { return }
    mpv_set_property_string(mpv, name, value)
  }

  private func setPropertyFlag(_ name: String, value: Bool) {
    guard let mpv else { return }
    var flag: Int32 = value ? 1 : 0
    mpv_set_property(mpv, name, MPV_FORMAT_FLAG, &flag)
  }

  private func setPropertyDouble(_ name: String, _ value: Double) {
    guard let mpv else { return }
    var v = value
    mpv_set_property(mpv, name, MPV_FORMAT_DOUBLE, &v)
  }

  private func getDouble(_ name: String) -> Double? {
    guard let mpv else { return nil }
    var out: Double = 0
    return mpv_get_property(mpv, name, MPV_FORMAT_DOUBLE, &out) >= 0 ? out : nil
  }

  private func getInt(_ name: String) -> Int? {
    guard let mpv else { return nil }
    var out: Int64 = 0
    return mpv_get_property(mpv, name, MPV_FORMAT_INT64, &out) >= 0 ? Int(out) : nil
  }

  private func getFlag(_ name: String) -> Bool? {
    guard let mpv else { return nil }
    var out: Int32 = 0
    return mpv_get_property(mpv, name, MPV_FORMAT_FLAG, &out) >= 0 ? out != 0 : nil
  }

  private func getString(_ name: String) -> String? {
    guard let mpv else { return nil }
    guard let cstr = mpv_get_property_string(mpv, name) else { return nil }
    defer { mpv_free(cstr) }
    let value = String(cString: cstr)
    return value.isEmpty ? nil : value
  }

  private func command(_ args: [String]) {
    guard let mpv else { return }
    // mpv_command wants a NULL-terminated `const char *[]`.
    var cargs: [UnsafePointer<CChar>?] = args.map { UnsafePointer(strdup($0)) }
    cargs.append(nil)
    defer {
      for ptr in cargs where ptr != nil {
        free(UnsafeMutablePointer(mutating: ptr))
      }
    }
    cargs.withUnsafeMutableBufferPointer { buf in
      _ = mpv_command(mpv, buf.baseAddress)
    }
  }

  private func errorString(_ status: Int32) -> String {
    String(cString: mpv_error_string(status))
  }
}
