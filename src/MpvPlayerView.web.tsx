import { forwardRef, useImperativeHandle } from "react";
import { StyleSheet, Text, View } from "react-native";

import type {
  AudioTrack,
  MpvPlayerViewProps,
  MpvPlayerViewRef,
  SubtitleTrack,
  TechnicalInfo,
} from "./MpvPlayer.types";

const UNSUPPORTED = "expo-mpv-player is not supported on web.";

const reject = (): Promise<never> => Promise.reject(new Error(UNSUPPORTED));

/**
 * Inert web implementation. Renders an "unsupported on web" notice and exposes a
 * ref whose methods reject, so apps that conditionally render the player on web
 * still type-check and bundle.
 */
const MpvPlayerView = forwardRef<MpvPlayerViewRef, MpvPlayerViewProps>(
  (props, ref) => {
    useImperativeHandle(
      ref,
      (): MpvPlayerViewRef => ({
        play: reject,
        pause: reject,
        seekTo: reject,
        seekBy: reject,
        setSpeed: reject,
        getSpeed: reject,
        isPaused: reject,
        getCurrentPosition: reject,
        getDuration: reject,
        getAudioTracks: () => reject() as Promise<AudioTrack[]>,
        setAudioTrack: reject,
        getCurrentAudioTrack: reject,
        getSubtitleTracks: () => reject() as Promise<SubtitleTrack[]>,
        setSubtitleTrack: reject,
        disableSubtitles: reject,
        getCurrentSubtitleTrack: reject,
        addSubtitleFile: reject,
        setZoomedToFill: reject,
        isZoomedToFill: reject,
        setSubtitleScale: reject,
        setSubtitlePosition: reject,
        setSubtitleDelay: reject,
        setAudioDelay: reject,
        getTechnicalInfo: () => reject() as Promise<TechnicalInfo>,
        startPictureInPicture: () => Promise.resolve(),
        stopPictureInPicture: () => Promise.resolve(),
        isPictureInPictureSupported: () => Promise.resolve(false),
        isPictureInPictureActive: () => Promise.resolve(false),
      }),
      [],
    );

    return (
      <View style={[styles.container, props.style]}>
        <Text style={styles.text}>{UNSUPPORTED}</Text>
      </View>
    );
  },
);

MpvPlayerView.displayName = "MpvPlayerView";

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#000",
    justifyContent: "center",
  },
  text: {
    color: "#9aa0a6",
    fontSize: 13,
    padding: 16,
    textAlign: "center",
  },
});

export default MpvPlayerView;
