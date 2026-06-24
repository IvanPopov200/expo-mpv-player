import webModule from "../MpvPlayerModule.web";

describe("MpvPlayerModule (web stub)", () => {
  it("identifies itself as the unsupported web platform", () => {
    expect(webModule.__unsupportedPlatform).toBe("web");
  });

  it("rejects calls with a clear web-unsupported message", async () => {
    await expect(webModule.play()).rejects.toThrow(/not supported on web/i);
    await expect(webModule.pause()).rejects.toThrow(/not supported on web/i);
  });
});
