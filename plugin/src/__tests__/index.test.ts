import withMpvPlayer, {
  addMpvKitSwiftPackage,
  assertStaticFrameworks,
  ensureInternetPermission,
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

describe("assertStaticFrameworks", () => {
  it("passes when expo-build-properties sets static frameworks", () => {
    const ok = assertStaticFrameworks({
      plugins: [
        ["expo-build-properties", { ios: { useFrameworks: "static" } }],
      ],
    });
    expect(ok).toBe(true);
  });

  it("fails (warns) when static frameworks are not configured", () => {
    expect(assertStaticFrameworks({ plugins: [] })).toBe(false);
    expect(assertStaticFrameworks({ plugins: ["expo-build-properties"] })).toBe(
      false,
    );
  });
});

describe("addMpvKitSwiftPackage", () => {
  const makeProject = () => {
    const firstProject: any = {};
    const firstTarget: any = {};
    let n = 0;
    return {
      hash: { project: { objects: {} as Record<string, any> } },
      generateUuid: () => `UUID_${n++}`,
      getFirstProject: () => ({ firstProject }),
      getFirstTarget: () => ({ firstTarget }),
      _firstProject: firstProject,
      _firstTarget: firstTarget,
    };
  };

  it("adds the LGPL MPVKit remote package and product dependency", () => {
    const project = makeProject();
    addMpvKitSwiftPackage(project);
    const objects = project.hash.project.objects;
    const refs = Object.values(objects.XCRemoteSwiftPackageReference).filter(
      (v: any) => typeof v === "object",
    );
    const deps = Object.values(objects.XCSwiftPackageProductDependency).filter(
      (v: any) => typeof v === "object",
    );
    expect(refs).toHaveLength(1);
    expect((refs[0] as any).repositoryURL).toContain("MPVKit");
    expect((deps[0] as any).productName).toBe("MPVKit");
    expect(project._firstProject.packageReferences).toHaveLength(1);
    expect(project._firstTarget.packageProductDependencies).toHaveLength(1);
  });

  it("uses only the LGPL product (no GPL product variant)", () => {
    const project = makeProject();
    addMpvKitSwiftPackage(project);
    const deps = Object.values(
      project.hash.project.objects.XCSwiftPackageProductDependency,
    );
    const names = deps
      .filter((v: any) => typeof v === "object")
      .map((v: any) => v.productName);
    // The LGPL product is named exactly "MPVKit"; the GPL variant has a suffix.
    expect(names).toEqual(["MPVKit"]);
    expect(names.every((n: string) => !n.includes("-"))).toBe(true);
  });

  it("is idempotent", () => {
    const project = makeProject();
    addMpvKitSwiftPackage(project);
    addMpvKitSwiftPackage(project);
    expect(project._firstProject.packageReferences).toHaveLength(1);
  });
});
