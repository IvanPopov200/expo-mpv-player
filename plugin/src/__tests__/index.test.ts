import withMpvPlayer, {
  ensureInternetPermission,
  ensureMinSdkVersion,
  ensurePictureInPictureFeature,
  setDefaultVoDriverMetaData,
  setReactNativeArchitectures,
  setUsesCleartextTraffic,
} from "../index";

const baseConfig = () => ({ name: "example", slug: "example" });

const emptyManifest = () => ({
  manifest: {
    $: { "xmlns:android": "http://schemas.android.com/apk/res/android" },
    application: [{ $: { "android:name": ".MainApplication" } }],
  },
});

describe("withMpvPlayer config plugin", () => {
  it("is a run-once function returning the config", () => {
    expect(typeof withMpvPlayer).toBe("function");
    const result = withMpvPlayer(baseConfig() as any);
    expect(result.name).toBe("example");
  });

  it("is idempotent — applying twice does not throw", () => {
    const once = withMpvPlayer(baseConfig() as any, {
      enableCleartextTraffic: true,
    });
    const twice = withMpvPlayer(once);
    expect(twice.name).toBe("example");
  });
});

describe("Android manifest helpers", () => {
  it("adds INTERNET permission only once", () => {
    const m = ensureInternetPermission(emptyManifest() as any);
    ensureInternetPermission(m);
    const perms = (m.manifest["uses-permission"] ?? []).filter(
      (p: any) => p.$["android:name"] === "android.permission.INTERNET",
    );
    expect(perms).toHaveLength(1);
  });

  it("adds the PiP uses-feature as not-required, once", () => {
    const m = ensurePictureInPictureFeature(emptyManifest() as any);
    ensurePictureInPictureFeature(m);
    const features = (m.manifest["uses-feature"] ?? []).filter(
      (f: any) => f.$["android:name"] === "android.software.picture_in_picture",
    );
    expect(features).toHaveLength(1);
    expect(features[0].$["android:required"]).toBe("false");
  });

  it("toggles usesCleartextTraffic on the application", () => {
    const on = setUsesCleartextTraffic(emptyManifest() as any, true);
    expect(on.manifest.application[0].$["android:usesCleartextTraffic"]).toBe(
      "true",
    );
    const off = setUsesCleartextTraffic(emptyManifest() as any, false);
    expect(off.manifest.application[0].$["android:usesCleartextTraffic"]).toBe(
      "false",
    );
  });

  it("writes the default vo-driver as application meta-data", () => {
    const m = setDefaultVoDriverMetaData(emptyManifest() as any, "gpu");
    const meta = m.manifest.application[0]["meta-data"] ?? [];
    const entry = meta.find(
      (x: any) =>
        x.$["android:name"] === "expo.modules.mpvplayer.DEFAULT_VO_DRIVER",
    );
    expect(entry?.$["android:value"]).toBe("gpu");
  });
});

describe("setReactNativeArchitectures", () => {
  it("adds the property when absent", () => {
    const props = setReactNativeArchitectures([], ["arm64-v8a", "x86_64"]);
    const entry = props.find(
      (p) => p.type === "property" && p.key === "reactNativeArchitectures",
    );
    expect((entry as any).value).toBe("arm64-v8a,x86_64");
  });

  it("overrides an existing value", () => {
    const props = setReactNativeArchitectures(
      [
        {
          type: "property",
          key: "reactNativeArchitectures",
          value: "armeabi-v7a",
        },
      ],
      ["arm64-v8a"],
    );
    const entries = props.filter(
      (p) => p.type === "property" && p.key === "reactNativeArchitectures",
    );
    expect(entries).toHaveLength(1);
    expect((entries[0] as any).value).toBe("arm64-v8a");
  });
});

describe("ensureMinSdkVersion", () => {
  it("adds android.minSdkVersion when absent", () => {
    const props = ensureMinSdkVersion([], 26);
    const entry = props.find(
      (p) => p.type === "property" && p.key === "android.minSdkVersion",
    );
    expect((entry as any).value).toBe("26");
  });

  it("raises a lower existing value", () => {
    const props = ensureMinSdkVersion(
      [{ type: "property", key: "android.minSdkVersion", value: "24" }],
      26,
    );
    const entries = props.filter(
      (p) => p.type === "property" && p.key === "android.minSdkVersion",
    );
    expect(entries).toHaveLength(1);
    expect((entries[0] as any).value).toBe("26");
  });

  it("does not lower an already-higher value", () => {
    const props = ensureMinSdkVersion(
      [{ type: "property", key: "android.minSdkVersion", value: "31" }],
      26,
    );
    const entry = props.find(
      (p) => p.type === "property" && p.key === "android.minSdkVersion",
    );
    expect((entry as any).value).toBe("31");
  });
});

describe("iOS: no config-plugin requirements", () => {
  // The LGPL MPVKit xcframeworks are vendored by the podspec, so the plugin must
  // NOT touch the Podfile or require dynamic frameworks. Applying it without any
  // expo-build-properties / useFrameworks config must succeed.
  it("applies with no iOS frameworks config and returns the config", () => {
    const result = withMpvPlayer(baseConfig() as any);
    expect(result.name).toBe("example");
  });

  it("no longer exports the removed SPM/dynamic-frameworks helpers", () => {
    const mod: Record<string, unknown> = require("../index");
    expect(mod.addMpvKitPodfileHook).toBeUndefined();
    expect(mod.assertDynamicFrameworks).toBeUndefined();
  });
});
