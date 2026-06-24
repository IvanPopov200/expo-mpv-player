import { ConfigPlugin, createRunOncePlugin } from "expo/config-plugins";

const pkg = require("../../package.json") as { name: string; version: string };

/**
 * Options accepted by the `expo-mpv-player` config plugin. Hardened in M4; this
 * scaffold establishes the shape and a run-once wrapper so the package is
 * installable and the example app can register the plugin.
 */
export interface MpvPlayerPluginProps {
  /** Native ABIs to bundle on Android. Fewer = smaller app. */
  androidAbiFilters?: string[];
  /** Allow plain-HTTP (cleartext) traffic on Android. Opt in deliberately. */
  enableCleartextTraffic?: boolean;
  /** Default Android video output driver. */
  defaultVoDriver?: "gpu-next" | "gpu";
}

const withMpvPlayer: ConfigPlugin<MpvPlayerPluginProps | void> = (config) => {
  // The Expo Modules autolinking handles native module registration. The
  // platform-specific mods (iOS static-frameworks assertion + MPVKit SPM,
  // Android manifest/cleartext/ABI filters) are added in M4.
  return config;
};

export default createRunOncePlugin(withMpvPlayer, pkg.name, pkg.version);
