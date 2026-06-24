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

  # The LGPL `MPVKit` Swift package (import Libmpv) is added to the app's Xcode
  # project via SPM by the config plugin (see plugin/src). The app must build iOS
  # with static frameworks (expo-build-properties -> ios.useFrameworks: "static").

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
