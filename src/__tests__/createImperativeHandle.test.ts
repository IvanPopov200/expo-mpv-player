import {
  createImperativeHandle,
  type NativeMpvViewRef,
} from "../createImperativeHandle";

const makeNative = (): jest.Mocked<NativeMpvViewRef> => ({
  play: jest.fn(() => Promise.resolve()),
  pause: jest.fn(() => Promise.resolve()),
  seekTo: jest.fn(() => Promise.resolve()),
  seekBy: jest.fn(() => Promise.resolve()),
  setSpeed: jest.fn(() => Promise.resolve()),
  getSpeed: jest.fn(() => Promise.resolve(1.5)),
  isPaused: jest.fn(() => Promise.resolve(true)),
  getCurrentPosition: jest.fn(() => Promise.resolve(42)),
  getDuration: jest.fn(() => Promise.resolve(120)),
  getAudioTracks: jest.fn(() => Promise.resolve([{ id: 1 }])),
  setAudioTrack: jest.fn(() => Promise.resolve()),
  getCurrentAudioTrack: jest.fn(() => Promise.resolve(1)),
  getSubtitleTracks: jest.fn(() => Promise.resolve([{ id: 2 }])),
  setSubtitleTrack: jest.fn(() => Promise.resolve()),
  disableSubtitles: jest.fn(() => Promise.resolve()),
  getCurrentSubtitleTrack: jest.fn(() => Promise.resolve(null)),
  addSubtitleFile: jest.fn(() => Promise.resolve()),
  setZoomedToFill: jest.fn(() => Promise.resolve()),
  isZoomedToFill: jest.fn(() => Promise.resolve(false)),
  getTechnicalInfo: jest.fn(() => Promise.resolve({ hwdec: "videotoolbox" })),
  startPictureInPicture: jest.fn(() => Promise.resolve()),
  stopPictureInPicture: jest.fn(() => Promise.resolve()),
  isPictureInPictureSupported: jest.fn(() => Promise.resolve(false)),
  isPictureInPictureActive: jest.fn(() => Promise.resolve(false)),
});

describe("createImperativeHandle", () => {
  describe("when the native view is mounted", () => {
    it("delegates parameterless transport calls", async () => {
      const native = makeNative();
      const handle = createImperativeHandle(() => native);
      await handle.play();
      await handle.pause();
      expect(native.play).toHaveBeenCalledTimes(1);
      expect(native.pause).toHaveBeenCalledTimes(1);
    });

    it("forwards arguments to seek/speed/track setters", async () => {
      const native = makeNative();
      const handle = createImperativeHandle(() => native);
      await handle.seekTo(30);
      await handle.seekBy(-10);
      await handle.setSpeed(2);
      await handle.setAudioTrack(3);
      await handle.setSubtitleTrack(4);
      await handle.addSubtitleFile("https://example.com/s.srt", true);
      expect(native.seekTo).toHaveBeenCalledWith(30);
      expect(native.seekBy).toHaveBeenCalledWith(-10);
      expect(native.setSpeed).toHaveBeenCalledWith(2);
      expect(native.setAudioTrack).toHaveBeenCalledWith(3);
      expect(native.setSubtitleTrack).toHaveBeenCalledWith(4);
      expect(native.addSubtitleFile).toHaveBeenCalledWith(
        "https://example.com/s.srt",
        true,
      );
    });

    it("returns values from query/diagnostic getters", async () => {
      const native = makeNative();
      const handle = createImperativeHandle(() => native);
      await expect(handle.getSpeed()).resolves.toBe(1.5);
      await expect(handle.getDuration()).resolves.toBe(120);
      await expect(handle.getCurrentPosition()).resolves.toBe(42);
      await expect(handle.isPaused()).resolves.toBe(true);
      await expect(handle.getAudioTracks()).resolves.toEqual([{ id: 1 }]);
      await expect(handle.getSubtitleTracks()).resolves.toEqual([{ id: 2 }]);
      await expect(handle.getCurrentSubtitleTrack()).resolves.toBeNull();
      await expect(handle.getTechnicalInfo()).resolves.toEqual({
        hwdec: "videotoolbox",
      });
    });

    it("reads the live native ref on every call", async () => {
      let native: NativeMpvViewRef | null = null;
      const handle = createImperativeHandle(() => native);
      await expect(handle.play()).rejects.toThrow(
        /before the native view mounted/,
      );
      native = makeNative();
      await handle.play();
      expect(
        (native as jest.Mocked<NativeMpvViewRef>).play,
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe("when the native view is not mounted", () => {
    const handle = createImperativeHandle(() => null);

    it("rejects transport/query calls with a clear message", async () => {
      await expect(handle.play()).rejects.toThrow(
        "MpvPlayerView.play() called before the native view mounted.",
      );
      await expect(handle.getDuration()).rejects.toThrow(
        /before the native view mounted/,
      );
      await expect(handle.getAudioTracks()).rejects.toThrow(
        /before the native view mounted/,
      );
    });

    it("resolves reserved PiP methods to safe defaults", async () => {
      await expect(handle.startPictureInPicture()).resolves.toBeUndefined();
      await expect(handle.stopPictureInPicture()).resolves.toBeUndefined();
      await expect(handle.isPictureInPictureSupported()).resolves.toBe(false);
      await expect(handle.isPictureInPictureActive()).resolves.toBe(false);
    });
  });
});
