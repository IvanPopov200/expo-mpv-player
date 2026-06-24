import OSLog

/// Thin wrapper over `os.Logger` so the renderer doesn't sprinkle `print()`.
enum MpvLog {
  private static let logger = Logger(subsystem: "expo-mpv-player", category: "mpv")

  static func debug(_ message: @autoclosure () -> String) {
    #if DEBUG
      let text = message()
      logger.debug("\(text, privacy: .public)")
    #endif
  }

  static func info(_ message: @autoclosure () -> String) {
    let text = message()
    logger.info("\(text, privacy: .public)")
  }

  static func warn(_ message: @autoclosure () -> String) {
    let text = message()
    logger.warning("\(text, privacy: .public)")
  }

  static func error(_ message: @autoclosure () -> String) {
    let text = message()
    logger.error("\(text, privacy: .public)")
  }
}
