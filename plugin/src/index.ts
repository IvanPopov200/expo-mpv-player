import {
  AndroidConfig,
  type ConfigPlugin,
  WarningAggregator,
  withAndroidManifest,
  withGradleProperties,
  withXcodeProject,
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

// MPVKit, the LGPL product (NOT the GPL product). Pin upToNextMajorVersion.
const MPVKIT_REPO = "https://github.com/mpvkit/MPVKit.git";
const MPVKIT_MIN_VERSION = "0.41.0";
const MPVKIT_PRODUCT = "MPVKit";
const DEFAULT_ABIS = ["arm64-v8a", "x86_64"];
const VO_DRIVER_META = "expo.modules.mpvplayer.DEFAULT_VO_DRIVER";

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
    return cfg;
  });

  return config;
};

// ---------------------------------------------------------------------------
// iOS mods: add the MPVKit (LGPL) SPM package + assert static frameworks
// ---------------------------------------------------------------------------

/**
 * Adds the MPVKit (LGPL) remote Swift Package to the app's Xcode project. Done
 * by writing the pbxproj objects directly (the `xcode` lib has no first-class
 * SPM helper). Idempotent; best-effort — on failure it warns to add the package
 * manually rather than breaking prebuild. See docs/ios-integration.md.
 */
export function addMpvKitSwiftPackage(project: any): any {
  const objects = project.hash.project.objects;
  objects.XCRemoteSwiftPackageReference =
    objects.XCRemoteSwiftPackageReference ?? {};
  objects.XCSwiftPackageProductDependency =
    objects.XCSwiftPackageProductDependency ?? {};

  const alreadyAdded = Object.values(
    objects.XCRemoteSwiftPackageReference,
  ).some(
    (v: any) =>
      typeof v === "object" && String(v.repositoryURL ?? "").includes("MPVKit"),
  );
  if (alreadyAdded) return project;

  const pkgRefUuid = project.generateUuid();
  const productDepUuid = project.generateUuid();

  objects.XCRemoteSwiftPackageReference[pkgRefUuid] = {
    isa: "XCRemoteSwiftPackageReference",
    repositoryURL: `"${MPVKIT_REPO}"`,
    requirement: {
      kind: "upToNextMajorVersion",
      minimumVersion: MPVKIT_MIN_VERSION,
    },
  };
  objects.XCRemoteSwiftPackageReference[`${pkgRefUuid}_comment`] =
    `XCRemoteSwiftPackageReference "${MPVKIT_PRODUCT}"`;

  objects.XCSwiftPackageProductDependency[productDepUuid] = {
    isa: "XCSwiftPackageProductDependency",
    package: pkgRefUuid,
    productName: MPVKIT_PRODUCT,
  };
  objects.XCSwiftPackageProductDependency[`${productDepUuid}_comment`] =
    MPVKIT_PRODUCT;

  const { firstProject } = project.getFirstProject();
  firstProject.packageReferences = firstProject.packageReferences ?? [];
  firstProject.packageReferences.push({
    value: pkgRefUuid,
    comment: `XCRemoteSwiftPackageReference "${MPVKIT_PRODUCT}"`,
  });

  const { firstTarget } = project.getFirstTarget();
  firstTarget.packageProductDependencies =
    firstTarget.packageProductDependencies ?? [];
  firstTarget.packageProductDependencies.push({
    value: productDepUuid,
    comment: MPVKIT_PRODUCT,
  });

  return project;
}

const withMpvPlayerIos: ConfigPlugin<MpvPlayerPluginProps> = (config) => {
  assertStaticFrameworks(config);
  config = withXcodeProject(config, (cfg) => {
    try {
      cfg.modResults = addMpvKitSwiftPackage(cfg.modResults);
    } catch (e) {
      WarningAggregator.addWarningIOS(
        "expo-mpv-player",
        `Could not auto-add the MPVKit Swift Package (${String(
          e,
        )}). Add it manually in Xcode: File → Add Package Dependencies → ${MPVKIT_REPO} (product "${MPVKIT_PRODUCT}").`,
      );
    }
    return cfg;
  });
  return config;
};

/** Warn if the consumer hasn't enabled static frameworks (required on iOS). */
export function assertStaticFrameworks(config: {
  plugins?: unknown[] | null;
}): boolean {
  const plugins = config.plugins ?? [];
  const buildProps = plugins.find(
    (p) => (Array.isArray(p) ? p[0] : p) === "expo-build-properties",
  ) as [string, { ios?: { useFrameworks?: string } }] | undefined;
  const isStatic =
    Array.isArray(buildProps) && buildProps[1]?.ios?.useFrameworks === "static";
  if (!isStatic) {
    WarningAggregator.addWarningIOS(
      "expo-mpv-player",
      'iOS requires static frameworks. Add ["expo-build-properties", { "ios": { "useFrameworks": "static" } }] to your config.',
    );
  }
  return isStatic;
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
