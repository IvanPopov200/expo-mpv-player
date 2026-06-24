import {
  MpvPlayerView,
  type MpvPlayerViewRef,
  type OnProgressPayload,
  type TechnicalInfo,
  type VideoSource,
} from "expo-mpv-player";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

// A small set of "hard" test files demonstrates direct play of containers the
// platform players reject. Replace with your own server URL + header.
const DEFAULT_URL =
  "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

export default function App() {
  const ref = useRef<MpvPlayerViewRef>(null);
  const [url, setUrl] = useState(DEFAULT_URL);
  const [authHeader, setAuthHeader] = useState("");
  const [source, setSource] = useState<VideoSource | null>(null);
  const [progress, setProgress] = useState<OnProgressPayload | null>(null);
  const [status, setStatus] = useState("idle");
  const [tech, setTech] = useState<TechnicalInfo | null>(null);

  const load = () => {
    setStatus("loading");
    setSource({
      url: url.trim(),
      headers: authHeader.trim() ? { Authorization: authHeader.trim() } : undefined,
      autoplay: true,
    });
  };

  const refreshTech = async () => {
    try {
      setTech((await ref.current?.getTechnicalInfo()) ?? null);
    } catch (e) {
      setStatus(`tech error: ${String(e)}`);
    }
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
            onTracksReady={refreshTech}
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
          <Btn label="Tech info" onPress={refreshTech} />
        </View>

        <Text style={styles.status}>{status}</Text>
        {progress ? (
          <Text style={styles.mono}>
            {progress.position.toFixed(1)}s / {progress.duration.toFixed(1)}s ·
            cache {progress.cacheSeconds.toFixed(1)}s
          </Text>
        ) : null}
        {tech ? <Text style={styles.mono}>{JSON.stringify(tech, null, 2)}</Text> : null}
      </ScrollView>
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
  status: { color: "#fbbc04", marginTop: 16, fontSize: 13 },
  mono: {
    color: "#9aa0a6",
    fontFamily: "Courier",
    fontSize: 12,
    marginTop: 8,
  },
});
