import type {
  AudioTrack,
  MpvPlayerViewRef,
  SubtitleTrack,
  TechnicalInfo,
} from "./MpvPlayer.types";

/**
 * The shape of the native view ref. Expo Modules exposes each view-scoped
 * `AsyncFunction` directly on the native view ref; this mirrors §5.4 of the spec.
 */
export interface NativeMpvViewRef {
  play(): Promise<void>;
  pause(): Promise<void>;
  seekTo(seconds: number): Promise<void>;
  seekBy(seconds: number): Promise<void>;
  setSpeed(rate: number): Promise<void>;
  getSpeed(): Promise<number>;
  isPaused(): Promise<boolean>;
  getCurrentPosition(): Promise<number>;
  getDuration(): Promise<number>;
  getAudioTracks(): Promise<AudioTrack[]>;
  setAudioTrack(id: number): Promise<void>;
  getCurrentAudioTrack(): Promise<number | null>;
  getSubtitleTracks(): Promise<SubtitleTrack[]>;
  setSubtitleTrack(id: number): Promise<void>;
  disableSubtitles(): Promise<void>;
  getCurrentSubtitleTrack(): Promise<number | null>;
  addSubtitleFile(url: string, select?: boolean): Promise<void>;
  setZoomedToFill(zoom: boolean): Promise<void>;
  isZoomedToFill(): Promise<boolean>;
  setSubtitleScale(scale: number): Promise<void>;
  setSubtitlePosition(position: number): Promise<void>;
  setSubtitleDelay(seconds: number): Promise<void>;
  setAudioDelay(seconds: number): Promise<void>;
  getTechnicalInfo(): Promise<TechnicalInfo>;
  startPictureInPicture(): Promise<void>;
  stopPictureInPicture(): Promise<void>;
  isPictureInPictureSupported(): Promise<boolean>;
  isPictureInPictureActive(): Promise<boolean>;
}

/**
 * Builds the imperative ref that {@link MpvPlayerView} exposes, delegating every
 * call to the live native view ref returned by `getNative`. Extracted as a pure
 * function so the delegation contract is unit-testable without rendering.
 *
 * Transport/query methods reject if called before the native view mounts; the
 * reserved PiP methods resolve to a safe default instead (PiP is a no-op in v1).
 */
export function createImperativeHandle(
  getNative: () => NativeMpvViewRef | null,
): MpvPlayerViewRef {
  const call = <T>(
    method: string,
    run: (native: NativeMpvViewRef) => Promise<T>,
  ): Promise<T> => {
    const native = getNative();
    if (!native) {
      return Promise.reject(
        new Error(
          `MpvPlayerView.${method}() called before the native view mounted.`,
        ),
      );
    }
    return run(native);
  };

  return {
    // transport
    play: () => call("play", (n) => n.play()),
    pause: () => call("pause", (n) => n.pause()),
    seekTo: (seconds) => call("seekTo", (n) => n.seekTo(seconds)),
    seekBy: (seconds) => call("seekBy", (n) => n.seekBy(seconds)),
    setSpeed: (rate) => call("setSpeed", (n) => n.setSpeed(rate)),
    getSpeed: () => call("getSpeed", (n) => n.getSpeed()),
    isPaused: () => call("isPaused", (n) => n.isPaused()),
    getCurrentPosition: () =>
      call("getCurrentPosition", (n) => n.getCurrentPosition()),
    getDuration: () => call("getDuration", (n) => n.getDuration()),
    // audio tracks
    getAudioTracks: () => call("getAudioTracks", (n) => n.getAudioTracks()),
    setAudioTrack: (id) => call("setAudioTrack", (n) => n.setAudioTrack(id)),
    getCurrentAudioTrack: () =>
      call("getCurrentAudioTrack", (n) => n.getCurrentAudioTrack()),
    // subtitle tracks
    getSubtitleTracks: () =>
      call("getSubtitleTracks", (n) => n.getSubtitleTracks()),
    setSubtitleTrack: (id) =>
      call("setSubtitleTrack", (n) => n.setSubtitleTrack(id)),
    disableSubtitles: () =>
      call("disableSubtitles", (n) => n.disableSubtitles()),
    getCurrentSubtitleTrack: () =>
      call("getCurrentSubtitleTrack", (n) => n.getCurrentSubtitleTrack()),
    addSubtitleFile: (url, select) =>
      call("addSubtitleFile", (n) => n.addSubtitleFile(url, select)),
    // video scaling
    setZoomedToFill: (zoom) =>
      call("setZoomedToFill", (n) => n.setZoomedToFill(zoom)),
    isZoomedToFill: () => call("isZoomedToFill", (n) => n.isZoomedToFill()),
    // subtitle styling & a/v sync
    setSubtitleScale: (scale) =>
      call("setSubtitleScale", (n) => n.setSubtitleScale(scale)),
    setSubtitlePosition: (position) =>
      call("setSubtitlePosition", (n) => n.setSubtitlePosition(position)),
    setSubtitleDelay: (seconds) =>
      call("setSubtitleDelay", (n) => n.setSubtitleDelay(seconds)),
    setAudioDelay: (seconds) =>
      call("setAudioDelay", (n) => n.setAudioDelay(seconds)),
    // diagnostics
    getTechnicalInfo: () =>
      call("getTechnicalInfo", (n) => n.getTechnicalInfo()),
    // reserved — PiP no-ops resolve to safe defaults even before mount (v1)
    startPictureInPicture: () =>
      getNative()?.startPictureInPicture() ?? Promise.resolve(),
    stopPictureInPicture: () =>
      getNative()?.stopPictureInPicture() ?? Promise.resolve(),
    isPictureInPictureSupported: () =>
      getNative()?.isPictureInPictureSupported() ?? Promise.resolve(false),
    isPictureInPictureActive: () =>
      getNative()?.isPictureInPictureActive() ?? Promise.resolve(false),
  };
}
