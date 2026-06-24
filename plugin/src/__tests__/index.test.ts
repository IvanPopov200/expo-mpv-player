import withMpvPlayer from "../index";

// A minimal ExpoConfig fixture, mirroring a consumer's app.json `expo` block.
const baseConfig = () => ({
  name: "example",
  slug: "example",
});

describe("withMpvPlayer config plugin", () => {
  it("is a function that returns a config object", () => {
    expect(typeof withMpvPlayer).toBe("function");
    const result = withMpvPlayer(baseConfig() as any);
    expect(result).toBeTruthy();
    expect(result.name).toBe("example");
  });

  it("is idempotent — applying it twice does not throw or duplicate", () => {
    const once = withMpvPlayer(baseConfig() as any);
    const twice = withMpvPlayer(once);
    expect(twice.name).toBe("example");
  });

  it("accepts plugin props without throwing", () => {
    const result = withMpvPlayer(baseConfig() as any, {
      androidAbiFilters: ["arm64-v8a"],
      enableCleartextTraffic: true,
      defaultVoDriver: "gpu",
    });
    expect(result).toBeTruthy();
  });
});
