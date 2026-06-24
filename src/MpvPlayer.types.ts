import type { StyleProp, ViewStyle } from "react-native";

/**
 * The single prop that carries every load option. One source object drives an
 * atomic (re)load — do not spread these into separate props.
 */
export interface VideoSource {
  /** Absolute URL of the media. Local `file://` paths are also accepted. */
  url: string;
  /**
   * HTTP headers sent with the request, forwarded to mpv's `http-header-fields`.
   * e.g. `{ Authorization: 'MediaBrowser Token="…"' }`.
   */
  headers?: Record<string, string>;
  /** Sidecar subtitle file URLs to add (via `sub-add`) after the file loads. */
  externalSubtitles?: string[];
  /** Resume position in seconds. */
  startPosition?: number;
  /** Begin playback immediately once loaded. Default `true`. */
  autoplay?: boolean;
  /** Pre-select an audio track id once the file is loaded. */
  initialAudioId?: number;
  /** Pre-select a subtitle track id once the file is loaded. */
  initialSubtitleId?: number;
  /** Demuxer cache tuning. */
  cacheConfig?: CacheConfig;
  /** Android-only video output driver. Default `'gpu-next'`. */
  voDriver?: VoDriver;
}

export interface CacheConfig {
  /** mpv `cache` mode. Default `'auto'`. */
  enabled?: "auto" | "yes" | "no";
  /** Target forward cache duration in seconds. */
  cacheSeconds?: number;
  /** `demuxer-max-bytes`. */
  maxBytes?: number;
  /** `demuxer-max-back-bytes`. */
  maxBackBytes?: number;
}

export type VoDriver = "gpu-next" | "gpu";

/** Fired once the file is loaded and demuxed. */
export interface OnLoadPayload {
  url: string;
}

/** ~1×/sec progress tick (suppressed while actively seeking). */
export interface OnProgressPayload {
  /** Current position in seconds. */
  position: number;
  /** Total duration in seconds (`0` if unknown/live). */
  duration: number;
  /** Normalized progress `0..1`. */
  progress: number;
  /** Buffered/forward cache in seconds (`demuxer-cache-duration`). */
  cacheSeconds: number;
}

/**
 * Partial playback-state transition. Each native transition fills only the
 * subset of flags it actually knows about.
 */
export interface OnPlaybackStatePayload {
  isPaused?: boolean;
  isPlaying?: boolean;
  isLoading?: boolean;
  isReadyToSeek?: boolean;
}

export interface OnErrorPayload {
  error: string;
}

/** Signal only — query the actual tracks via the ref once this fires. */
export type OnTracksReadyPayload = Record<string, never>;

export interface OnPiPPayload {
  isActive: boolean;
}

export interface MpvPlayerViewProps {
  source?: VideoSource;
  style?: StyleProp<ViewStyle>;
  /** File loaded and demuxed. */
  onLoad?: (event: { nativeEvent: OnLoadPayload }) => void;
  /** Partial playback-state change (`isPaused`/`isPlaying`/`isLoading`/`isReadyToSeek`). */
  onPlaybackStateChange?: (event: {
    nativeEvent: OnPlaybackStatePayload;
  }) => void;
  /** ~1×/sec progress update. */
  onProgress?: (event: { nativeEvent: OnProgressPayload }) => void;
  /** Playback error. */
  onError?: (event: { nativeEvent: OnErrorPayload }) => void;
  /** Tracks are now enumerable; fetch them via the ref. */
  onTracksReady?: (event: { nativeEvent: OnTracksReadyPayload }) => void;
  /** Reserved — Picture-in-Picture is not implemented yet (no-op until then). */
  onPictureInPictureChange?: (event: { nativeEvent: OnPiPPayload }) => void;
}

export interface AudioTrack {
  id: number;
  title?: string;
  lang?: string;
  codec?: string;
  channels?: number;
  selected?: boolean;
}

export interface SubtitleTrack {
  id: number;
  title?: string;
  lang?: string;
  selected?: boolean;
}

export interface TechnicalInfo {
  videoWidth?: number;
  videoHeight?: number;
  videoCodec?: string;
  audioCodec?: string;
  fps?: number;
  videoBitrate?: number;
  audioBitrate?: number;
  cacheSeconds?: number;
  droppedFrames?: number;
  voDriver?: string;
  hwdec?: string;
}

/**
 * Imperative control surface exposed through the component ref. Every method
 * returns a `Promise`.
 */
export interface MpvPlayerViewRef {
  // transport
  play(): Promise<void>;
  pause(): Promise<void>;
  seekTo(seconds: number): Promise<void>;
  seekBy(seconds: number): Promise<void>;
  setSpeed(rate: number): Promise<void>;
  getSpeed(): Promise<number>;
  isPaused(): Promise<boolean>;
  getCurrentPosition(): Promise<number>;
  getDuration(): Promise<number>;
  // audio tracks
  getAudioTracks(): Promise<AudioTrack[]>;
  setAudioTrack(id: number): Promise<void>;
  getCurrentAudioTrack(): Promise<number | null>;
  // subtitle tracks
  getSubtitleTracks(): Promise<SubtitleTrack[]>;
  setSubtitleTrack(id: number): Promise<void>;
  disableSubtitles(): Promise<void>;
  getCurrentSubtitleTrack(): Promise<number | null>;
  addSubtitleFile(url: string, select?: boolean): Promise<void>;
  // video scaling
  setZoomedToFill(zoom: boolean): Promise<void>;
  isZoomedToFill(): Promise<boolean>;
  // diagnostics
  getTechnicalInfo(): Promise<TechnicalInfo>;
  // reserved for a later milestone (no-ops until PiP lands)
  startPictureInPicture(): Promise<void>;
  stopPictureInPicture(): Promise<void>;
  isPictureInPictureSupported(): Promise<boolean>;
  isPictureInPictureActive(): Promise<boolean>;
}
