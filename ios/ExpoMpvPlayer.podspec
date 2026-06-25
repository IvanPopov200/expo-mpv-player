require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoMpvPlayer'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = 'expo-mpv-player contributors'
  s.homepage       = package['homepage']
  s.platforms      = {
    :ios => '14.0',
    :tvos => '14.0'
  }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/IvanPopov200/expo-mpv-player.git', tag: "v#{s.version}" }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # The libmpv engine ships as the **LGPL** MPVKit prebuilt xcframeworks, vendored
  # by THIS pod (not added to the app's Xcode project as an SPM package). They are
  # static xcframeworks, so under the app's default (static) pod linkage they link
  # into the app exactly once — no duplicate-symbol double-embed, and the consumer
  # does NOT need `useFrameworks: "dynamic"`. The binaries are large and not in
  # git; fetch them into ios/Frameworks/ first (scripts/fetch-mpvkit-xcframeworks.sh,
  # also run automatically by prepare_command below). LGPL artifacts only.
  s.prepare_command = <<-CMD
    if [ -z "$(ls -A Frameworks/*.xcframework 2>/dev/null)" ]; then
      bash "#{__dir__}/../scripts/fetch-mpvkit-xcframeworks.sh" || true
    fi
  CMD
  s.vendored_frameworks = 'Frameworks/*.xcframework'

  # System frameworks/libraries the static MPVKit closure needs at link time
  # (mirrors MPVKit's SPM linkerSettings; static libs don't carry these implicitly).
  s.frameworks = 'AVFoundation', 'CoreAudio', 'AudioToolbox', 'CoreVideo',
                 'CoreFoundation', 'CoreMedia', 'Metal', 'VideoToolbox'
  s.libraries = 'bz2', 'iconv', 'expat', 'resolv', 'xml2', 'z', 'c++'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "*.{h,m,mm,swift,hpp,cpp}"
end
