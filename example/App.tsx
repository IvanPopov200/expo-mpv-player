import {
  type AudioTrack,
  MpvPlayerView,
  type MpvPlayerViewRef,
  type OnProgressPayload,
  type SubtitleTrack,
  type TechnicalInfo,
  type VideoSource,
} from "expo-mpv-player";
import { StatusBar } from "expo-status-bar";
import { useCallback, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

// A "hard" test file demonstrates direct play of containers the platform
// players reject. Replace with your own server URL + Authorization header.
const DEFAULT_URL = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

export default function App() {
  const ref = useRef<MpvPlayerViewRef>(null);
  const [url, setUrl] = useState(DEFAULT_URL);
  const [authHeader, setAuthHeader] = useState("");
  const [source, setSource] = useState<VideoSource | null>(null);
  const [progress, setProgress] = useState<OnProgressPayload | null>(null);
  const [status, setStatus] = useState("idle");
  const [tech, setTech] = useState<TechnicalInfo | null>(null);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [subScale, setSubScale] = useState(1);

  const load = () => {
    setStatus("loading");
    setSource({
      url: url.trim(),
      headers: authHeader.trim() ? { Authorization: authHeader.trim() } : undefined,
      autoplay: true,
    });
  };

  const refreshTech = useCallback(async () => {
    try {
      setTech((await ref.current?.getTechnicalInfo()) ?? null);
    } catch (e) {
      setStatus(`tech error: ${String(e)}`);
    }
  }, []);

  const refreshTracks = useCallback(async () => {
    try {
      setAudioTracks((await ref.current?.getAudioTracks()) ?? []);
      setSubtitleTracks((await ref.current?.getSubtitleTracks()) ?? []);
    } catch (e) {
      setStatus(`tracks error: ${String(e)}`);
    }
  }, []);

  const onTracksReady = useCallback(() => {
    void refreshTech();
    void refreshTracks();
  }, [refreshTech, refreshTracks]);

  const changeSubScale = (delta: number) => {
    const next = Math.max(0.2, Math.round((subScale + delta) * 10) / 10);
    setSubScale(next);
    void ref.current?.setSubtitleScale(next);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.playerWrap}>
        {source ? (
          <MpvPlayerView
            ref={ref}
            style={styles.player}
            source={source}
            onLoad={(e) => setStatus(`loaded: ${e.nativeEvent.url}`)}
            onPlaybackStateChange={(e) =>
              setStatus(`state: ${JSON.stringify(e.nativeEvent)}`)
            }
            onProgress={(e) => setProgress(e.nativeEvent)}
            onError={(e) => setStatus(`error: ${e.nativeEvent.error}`)}
            onTracksReady={onTracksReady}
          />
        ) : (
          <Text style={styles.placeholder}>No source loaded</Text>
        )}
      </View>

      <ScrollView style={styles.controls} contentContainerStyle={styles.controlsInner}>
        <Text style={styles.label}>Stream URL</Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://…"
          placeholderTextColor="#666"
        />
        <Text style={styles.label}>Authorization header (optional)</Text>
        <TextInput
          style={styles.input}
          value={authHeader}
          onChangeText={setAuthHeader}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder='MediaBrowser Token="…"'
          placeholderTextColor="#666"
        />

        <View style={styles.row}>
          <Btn label="Load" onPress={load} />
          <Btn label="Play" onPress={() => ref.current?.play()} />
          <Btn label="Pause" onPress={() => ref.current?.pause()} />
        </View>
        <View style={styles.row}>
          <Btn label="-30s" onPress={() => ref.current?.seekBy(-30)} />
          <Btn label="+30s" onPress={() => ref.current?.seekBy(30)} />
          <Btn label="Tracks" onPress={refreshTracks} />
        </View>

        {audioTracks.length > 0 ? (
          <Section title="Audio">
            {audioTracks.map((t) => (
              <Chip
                key={`a${t.id}`}
                label={trackLabel(t)}
                active={!!t.selected}
                onPress={() => ref.current?.setAudioTrack(t.id)}
              />
            ))}
          </Section>
        ) : null}

        {subtitleTracks.length > 0 ? (
          <Section title="Subtitles">
            <Chip label="Off" active={false} onPress={() => ref.current?.disableSubtitles()} />
            {subtitleTracks.map((t) => (
              <Chip
                key={`s${t.id}`}
                label={trackLabel(t)}
                active={!!t.selected}
                onPress={() => ref.current?.setSubtitleTrack(t.id)}
              />
            ))}
          </Section>
        ) : null}

        <View style={styles.row}>
          <Btn label={`Sub − (${subScale.toFixed(1)})`} onPress={() => changeSubScale(-0.1)} />
          <Btn label="Sub +" onPress={() => changeSubScale(0.1)} />
          <Btn label="Fill" onPress={() => ref.current?.setZoomedToFill(true)} />
        </View>

        <Text style={styles.status}>{status}</Text>
        {progress ? (
          <Text style={styles.mono}>
            {progress.position.toFixed(1)}s / {progress.duration.toFixed(1)}s · cache{" "}
            {progress.cacheSeconds.toFixed(1)}s
          </Text>
        ) : null}
        {tech ? <Text style={styles.mono}>{JSON.stringify(tech, null, 2)}</Text> : null}
      </ScrollView>
    </View>
  );
}

function trackLabel(t: AudioTrack | SubtitleTrack): string {
  const parts = [t.title, t.lang].filter(Boolean);
  return parts.length ? parts.join(" · ") : `#${t.id}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
      onPress={onPress}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && styles.btnPressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0b0d" },
  playerWrap: {
    aspectRatio: 16 / 9,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  player: { flex: 1, alignSelf: "stretch" },
  placeholder: { color: "#5f6368" },
  controls: { flex: 1 },
  controlsInner: { padding: 16, gap: 8 },
  label: { color: "#9aa0a6", fontSize: 12, marginTop: 8 },
  input: {
    backgroundColor: "#17181c",
    color: "#e8eaed",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  row: { flexDirection: "row", gap: 8, marginTop: 12 },
  btn: {
    flex: 1,
    backgroundColor: "#2b6cf0",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnPressed: { opacity: 0.7 },
  btnText: { color: "#fff", fontWeight: "600" },
  section: { marginTop: 16 },
  sectionTitle: { color: "#9aa0a6", fontSize: 12, marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "#17181c",
    borderColor: "#2a2c33",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: "#2b6cf0", borderColor: "#2b6cf0" },
  chipText: { color: "#c4c7ce", fontSize: 13 },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  status: { color: "#fbbc04", marginTop: 16, fontSize: 13 },
  mono: { color: "#9aa0a6", fontFamily: "Courier", fontSize: 12, marginTop: 8 },
});
