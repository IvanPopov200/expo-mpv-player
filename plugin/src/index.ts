import {
  AndroidConfig,
  type ConfigPlugin,
  WarningAggregator,
  withAndroidManifest,
  withDangerousMod,
  withGradleProperties,
  createRunOncePlugin,
} from "expo/config-plugins";
import { promises as fs } from "fs";
import path from "path";

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

// MPVKit, the LGPL product (NOT the GPL product). Pin upToNextMajorVersion.
const MPVKIT_REPO = "https://github.com/mpvkit/MPVKit.git";
const MPVKIT_MIN_VERSION = "0.41.0";
const MPVKIT_PRODUCT = "MPVKit";
const DEFAULT_ABIS = ["arm64-v8a", "x86_64"];
const VO_DRIVER_META = "expo.modules.mpvplayer.DEFAULT_VO_DRIVER";
// libmpv's prebuilt .so's require API 26. The Expo root-project gradle plugin
// reads `android.minSdkVersion` from gradle.properties (default 24), so we raise
// it here for every consumer app — never lower an already-higher value.
const MIN_SDK_VERSION = 26;

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
// iOS mods: link the MPVKit (LGPL) SPM package + assert static frameworks
// ---------------------------------------------------------------------------

// Marker so the Podfile hook is inserted exactly once.
const POD_HOOK_MARKER = "expo-mpv-player: link the MPVKit";

// The LGPL framework closure MPVKit 0.41.0 resolves. SPM's product autolinking
// does not propagate these binary frameworks through CocoaPods, so the app must
// link them explicitly (verified empirically). Update this list when bumping the
// pinned MPVKit version.
const MPVKIT_FRAMEWORKS = [
  "gmp",
  "gnutls",
  "hogweed",
  "lcms2",
  "Libass",
  "Libavcodec",
  "Libavdevice",
  "Libavfilter",
  "Libavformat",
  "Libavutil",
  "Libbluray",
  "Libcrypto",
  "Libdav1d",
  "Libdovi",
  "Libfreetype",
  "Libfribidi",
  "Libharfbuzz",
  "Libmpv",
  "Libplacebo",
  "Libshaderc_combined",
  "Libssl",
  "Libswresample",
  "Libswscale",
  "Libuavs3d",
  "Libuchardet",
  "Libunibreak",
  "nettle",
];

// Ruby injected into the Expo Podfile's `post_install` block. It:
//  1. registers the MPVKit (LGPL) Swift Package on the Pods project and links the
//     `MPVKit` product to the module pod target (`ExpoMpvPlayer`) so `import
//     Libmpv` compiles;
//  2. registers the package on the app (user) project so Xcode resolves it; and
//  3. force-links MPVKit's framework closure on the app target via OTHER_LDFLAGS,
//     because SPM's product autolinking does not propagate binary frameworks
//     through CocoaPods.
// Requires dynamic frameworks (static double-embeds → duplicate symbols).
const POD_HOOK = `
    # ${POD_HOOK_MARKER} (LGPL) Swift Package
    mpv_frameworks = %w[${MPVKIT_FRAMEWORKS.join(" ")}]
    mpv_proj = installer.pods_project
    unless mpv_proj.root_object.package_references.any? { |r| r.respond_to?(:repositoryURL) && r.repositoryURL.to_s.include?('MPVKit') }
      mpv_pkg = mpv_proj.new(Xcodeproj::Project::Object::XCRemoteSwiftPackageReference)
      mpv_pkg.repositoryURL = '${MPVKIT_REPO}'
      mpv_pkg.requirement = { 'kind' => 'upToNextMajorVersion', 'minimumVersion' => '${MPVKIT_MIN_VERSION}' }
      mpv_proj.root_object.package_references << mpv_pkg
      mpv_target = mpv_proj.targets.find { |t| t.name == 'ExpoMpvPlayer' }
      if mpv_target
        mpv_dep = mpv_proj.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
        mpv_dep.package = mpv_pkg
        mpv_dep.product_name = '${MPVKIT_PRODUCT}'
        mpv_target.package_product_dependencies << mpv_dep
      end
      mpv_proj.save
    end
    installer.aggregate_targets.each do |agg|
      up = agg.user_project
      next unless up
      unless up.root_object.package_references.any? { |r| r.respond_to?(:repositoryURL) && r.repositoryURL.to_s.include?('MPVKit') }
        up_pkg = up.new(Xcodeproj::Project::Object::XCRemoteSwiftPackageReference)
        up_pkg.repositoryURL = '${MPVKIT_REPO}'
        up_pkg.requirement = { 'kind' => 'upToNextMajorVersion', 'minimumVersion' => '${MPVKIT_MIN_VERSION}' }
        up.root_object.package_references << up_pkg
      end
      agg.user_targets.each do |ut|
        ut.build_configurations.each do |c|
          flags = c.build_settings['OTHER_LDFLAGS'] || ['$(inherited)']
          flags = [flags] unless flags.is_a?(Array)
          mpv_frameworks.each do |fw|
            next if flags.include?(fw)
            flags += ['-framework', fw]
          end
          c.build_settings['OTHER_LDFLAGS'] = flags
        end
      end
      up.save
    end
`;

/**
 * Inserts the MPVKit Podfile hook into an Expo Podfile (idempotent). Anchors on
 * the `post_install do |installer|` line that every Expo Podfile generates.
 * Exported for unit testing.
 */
export function addMpvKitPodfileHook(contents: string): string {
  if (contents.includes(POD_HOOK_MARKER)) return contents;
  const anchor = /post_install do \|installer\|\n/;
  if (!anchor.test(contents)) return contents;
  return contents.replace(anchor, (match) => match + POD_HOOK);
}

const withMpvPlayerIos: ConfigPlugin<MpvPlayerPluginProps> = (config) => {
  assertDynamicFrameworks(config);
  config = withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      try {
        const original = await fs.readFile(podfile, "utf8");
        const patched = addMpvKitPodfileHook(original);
        if (patched === original && !original.includes(POD_HOOK_MARKER)) {
          WarningAggregator.addWarningIOS(
            "expo-mpv-player",
            `Could not find the Podfile post_install hook to inject MPVKit. Add the MPVKit (LGPL) Swift Package (${MPVKIT_REPO}, product "${MPVKIT_PRODUCT}") to the ExpoMpvPlayer pod target manually.`,
          );
        } else {
          await fs.writeFile(podfile, patched);
        }
      } catch (e) {
        WarningAggregator.addWarningIOS(
          "expo-mpv-player",
          `Failed to patch the Podfile for MPVKit (${String(e)}). Add the package manually.`,
        );
      }
      return cfg;
    },
  ]);
  return config;
};

/**
 * Warn unless the consumer has enabled **dynamic** frameworks. MPVKit ships
 * binary xcframeworks; with static linkage they get double-embedded (pod + app)
 * and the build fails with duplicate MoltenVK/FFmpeg symbols. Dynamic linkage
 * links each framework once. Verified empirically against MPVKit 0.41.0.
 */
export function assertDynamicFrameworks(config: {
  plugins?: unknown[] | null;
}): boolean {
  const plugins = config.plugins ?? [];
  const buildProps = plugins.find(
    (p) => (Array.isArray(p) ? p[0] : p) === "expo-build-properties",
  ) as [string, { ios?: { useFrameworks?: string } }] | undefined;
  const isDynamic =
    Array.isArray(buildProps) &&
    buildProps[1]?.ios?.useFrameworks === "dynamic";
  if (!isDynamic) {
    WarningAggregator.addWarningIOS(
      "expo-mpv-player",
      'iOS requires dynamic frameworks. Add ["expo-build-properties", { "ios": { "useFrameworks": "dynamic" } }] to your config.',
    );
  }
  return isDynamic;
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

const withMpvPlayer: ConfigPlugin<MpvPlayerPluginProps | void> = (
  config,
  props,
) => {
  const resolved: MpvPlayerPluginProps = props || {};
  config = withMpvPlayerAndroid(config, resolved);
  config = withMpvPlayerIos(config, resolved);
  return config;
};

export default createRunOncePlugin(withMpvPlayer, pkg.name, pkg.version);
