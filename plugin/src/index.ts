import {
  AndroidConfig,
  type ConfigPlugin,
  withAndroidManifest,
  withGradleProperties,
  createRunOncePlugin,
} from "expo/config-plugins";

const pkg = require("../../package.json") as { name: string; version: string };

/** Options accepted by the `expo-mpv-player` config plugin. */
export interface MpvPlayerPluginProps {
  /** Native ABIs to bundle on Android. Fewer = smaller app. */
  androidAbiFilters?: string[];
  /** Allow plain-HTTP (cleartext) traffic on Android. Opt in deliberately. */
  enableCleartextTraffic?: boolean;
  /** Default Android video output driver. */
  defaultVoDriver?: "gpu-next" | "gpu";
}

const DEFAULT_ABIS = ["arm64-v8a", "x86_64"];
const VO_DRIVER_META = "expo.modules.mpvplayer.DEFAULT_VO_DRIVER";
// libmpv's prebuilt .so's require API 26. The Expo root-project gradle plugin
// reads `android.minSdkVersion` from gradle.properties (default 24), so we raise
// it here for every consumer app — never lower an already-higher value.
const MIN_SDK_VERSION = 26;

// iOS needs NOTHING from the config plugin: the LGPL MPVKit xcframeworks are
// vendored by the pod itself (ios/ExpoMpvPlayer.podspec), so the app links them
// once under its default (static) pod linkage. No SPM injection, no Podfile
// patching, and no `useFrameworks: "dynamic"` requirement.

// ---------------------------------------------------------------------------
// Pure Android-manifest helpers (exported for unit tests)
// ---------------------------------------------------------------------------

type ManifestDocument = AndroidConfig.Manifest.AndroidManifest;

export function ensureInternetPermission(
  manifest: ManifestDocument,
): ManifestDocument {
  const list = manifest.manifest["uses-permission"] ?? [];
  const has = list.some(
    (p) => p.$?.["android:name"] === "android.permission.INTERNET",
  );
  if (!has) {
    list.push({ $: { "android:name": "android.permission.INTERNET" } });
  }
  manifest.manifest["uses-permission"] = list;
  return manifest;
}

export function ensurePictureInPictureFeature(
  manifest: ManifestDocument,
): ManifestDocument {
  const name = "android.software.picture_in_picture";
  const list = manifest.manifest["uses-feature"] ?? [];
  const has = list.some((f) => f.$?.["android:name"] === name);
  if (!has) {
    list.push({ $: { "android:name": name, "android:required": "false" } });
  }
  manifest.manifest["uses-feature"] = list;
  return manifest;
}

export function setUsesCleartextTraffic(
  manifest: ManifestDocument,
  enabled: boolean,
): ManifestDocument {
  const application =
    AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  application.$["android:usesCleartextTraffic"] = enabled ? "true" : "false";
  return manifest;
}

export function setDefaultVoDriverMetaData(
  manifest: ManifestDocument,
  voDriver: string,
): ManifestDocument {
  AndroidConfig.Manifest.addMetaDataItemToMainApplication(
    AndroidConfig.Manifest.getMainApplicationOrThrow(manifest),
    VO_DRIVER_META,
    voDriver,
  );
  return manifest;
}

type GradleProp = AndroidConfig.Properties.PropertiesItem;

export function setReactNativeArchitectures(
  gradleProperties: GradleProp[],
  abis: string[],
): GradleProp[] {
  const value = abis.join(",");
  const existing = gradleProperties.find(
    (p): p is Extract<GradleProp, { type: "property" }> =>
      p.type === "property" && p.key === "reactNativeArchitectures",
  );
  if (existing) {
    existing.value = value;
  } else {
    gradleProperties.push({
      type: "property",
      key: "reactNativeArchitectures",
      value,
    });
  }
  return gradleProperties;
}

export function ensureMinSdkVersion(
  gradleProperties: GradleProp[],
  minSdk: number,
): GradleProp[] {
  const key = "android.minSdkVersion";
  const existing = gradleProperties.find(
    (p): p is Extract<GradleProp, { type: "property" }> =>
      p.type === "property" && p.key === key,
  );
  if (existing) {
    const current = Number.parseInt(existing.value, 10);
    if (!Number.isNaN(current) && current >= minSdk) return gradleProperties;
    existing.value = String(minSdk);
  } else {
    gradleProperties.push({ type: "property", key, value: String(minSdk) });
  }
  return gradleProperties;
}

// ---------------------------------------------------------------------------
// Android mod
// ---------------------------------------------------------------------------

const withMpvPlayerAndroid: ConfigPlugin<MpvPlayerPluginProps> = (
  config,
  props,
) => {
  config = withAndroidManifest(config, (cfg) => {
    cfg.modResults = ensureInternetPermission(cfg.modResults);
    cfg.modResults = ensurePictureInPictureFeature(cfg.modResults);
    if (props.enableCleartextTraffic) {
      cfg.modResults = setUsesCleartextTraffic(cfg.modResults, true);
    }
    cfg.modResults = setDefaultVoDriverMetaData(
      cfg.modResults,
      props.defaultVoDriver ?? "gpu-next",
    );
    return cfg;
  });

  config = withGradleProperties(config, (cfg) => {
    cfg.modResults = setReactNativeArchitectures(
      cfg.modResults,
      props.androidAbiFilters ?? DEFAULT_ABIS,
    );
    cfg.modResults = ensureMinSdkVersion(cfg.modResults, MIN_SDK_VERSION);
    return cfg;
  });

  return config;
};

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

const withMpvPlayer: ConfigPlugin<MpvPlayerPluginProps | void> = (
  config,
  props,
) => {
  const resolved: MpvPlayerPluginProps = props || {};
  // iOS requires no config-plugin mods (vendored xcframeworks in the podspec).
  config = withMpvPlayerAndroid(config, resolved);
  return config;
};

export default createRunOncePlugin(withMpvPlayer, pkg.name, pkg.version);
