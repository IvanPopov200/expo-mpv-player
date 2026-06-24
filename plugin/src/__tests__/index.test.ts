import withMpvPlayer, {
  addMpvKitPodfileHook,
  assertDynamicFrameworks,
  ensureInternetPermission,
  ensurePictureInPictureFeature,
  setDefaultVoDriverMetaData,
  setReactNativeArchitectures,
  setUsesCleartextTraffic,
} from "../index";

const PODFILE = `require 'json'

target 'app' do
  use_react_native!(:path => config[:reactNativePath])

  post_install do |installer|
    react_native_post_install(installer, config[:reactNativePath])
  end
end
`;

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

describe("assertDynamicFrameworks", () => {
  it("passes when expo-build-properties sets dynamic frameworks", () => {
    const ok = assertDynamicFrameworks({
      plugins: [
        ["expo-build-properties", { ios: { useFrameworks: "dynamic" } }],
      ],
    });
    expect(ok).toBe(true);
  });

  it("fails (warns) when dynamic frameworks are not configured", () => {
    expect(assertDynamicFrameworks({ plugins: [] })).toBe(false);
    expect(
      assertDynamicFrameworks({
        plugins: [
          ["expo-build-properties", { ios: { useFrameworks: "static" } }],
        ],
      }),
    ).toBe(false);
  });
});

describe("addMpvKitPodfileHook", () => {
  it("injects the MPVKit hook into the post_install block", () => {
    const out = addMpvKitPodfileHook(PODFILE);
    expect(out).toContain("github.com/mpvkit/MPVKit.git");
    expect(out).toContain("product_name = 'MPVKit'");
    expect(out).toContain("ExpoMpvPlayer");
    // Hook lands inside the post_install block.
    expect(out.indexOf("post_install do |installer|")).toBeLessThan(
      out.indexOf("mpv_proj = installer.pods_project"),
    );
  });

  it("targets only the LGPL product/repo (no GPL variant)", () => {
    const out = addMpvKitPodfileHook(PODFILE);
    expect(out).toContain("product_name = 'MPVKit'");
    // The GPL product/repo carries a "MPVKit-" suffix; assert none appears.
    expect(out).not.toMatch(/MPVKit-/);
  });

  it("is idempotent — does not insert twice", () => {
    const once = addMpvKitPodfileHook(PODFILE);
    const twice = addMpvKitPodfileHook(once);
    const occurrences =
      twice.split("mpv_proj = installer.pods_project").length - 1;
    expect(occurrences).toBe(1);
  });

  it("leaves a Podfile without the anchor unchanged", () => {
    const noAnchor = "target 'app' do\nend\n";
    expect(addMpvKitPodfileHook(noAnchor)).toBe(noAnchor);
  });
});
