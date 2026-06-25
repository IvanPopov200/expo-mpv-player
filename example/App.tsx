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
// A community (non-Expo) native module, present so the example links like a real
// app: under the old app-wide dynamic-frameworks requirement, modules like this
// failed to link React core. The vendored-static engine keeps the app static.
import { SafeAreaProvider } from "react-native-safe-area-context";

// A "hard" test file demonstrates direct play of containers the platform
// players reject. Replace with your own server URL + Authorization header.
const DEFAULT_URL = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

// Fixture server (example/scripts/fixture-server.mjs) for the G6/G7 gates.
// On a simulator, localhost reaches the host Mac. On a physical device, set this
// to the Mac's LAN IP (e.g. http://192.168.1.x:8099).
const FIXTURE_BASE = "http://localhost:8099";
const FIXTURE_AUTH =
  'MediaBrowser Client="ExpoMpvPlayer", Token="fixture-token-123"';

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
  const [lastError, setLastError] = useState<string | null>(null);

  const load = () => {
    setStatus("loading");
    setLastError(null);
    setSource({
      url: url.trim(),
      headers: authHeader.trim()
        ? { Authorization: authHeader.trim() }
        : undefined,
      autoplay: true,
    });
  };

  // Load a fixture-server route (G6/G7 evidence). `withAuth` sends the exact
  // comma-bearing Authorization header the header-encoding fix must preserve.
  const loadFixture = (route: string, withAuth: boolean) => {
    setStatus(`loading ${route}`);
    setLastError(null);
    setSource({
      url: `${FIXTURE_BASE}${route}`,
      headers: withAuth ? { Authorization: FIXTURE_AUTH } : undefined,
      autoplay: true,
    });
  };

  // Dump diagnostics to the console with a grep-able prefix (G4–G7 evidence).
  const copyTechInfo = useCallback(async () => {
    let info: TechnicalInfo | null = null;
    try {
      info = (await ref.current?.getTechnicalInfo()) ?? null;
    } catch {
      info = null;
    }
    // eslint-disable-next-line no-console
    console.log(
      `[MPV-EVIDENCE] ${JSON.stringify({
        status,
        tech: info,
        progress,
        lastError,
      })}`
    );
    setStatus("tech info dumped to console");
  }, [status, progress, lastError]);

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
    <SafeAreaProvider>
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
              onError={(e) => {
                setLastError(e.nativeEvent.error);
                setStatus(`error: ${e.nativeEvent.error}`);
                // eslint-disable-next-line no-console
                console.log(
                  `[MPV-EVIDENCE] onError ${JSON.stringify(e.nativeEvent)}`
                );
              }}
              onTracksReady={onTracksReady}
            />
          ) : (
            <Text style={styles.placeholder}>No source loaded</Text>
          )}
        </View>

        <ScrollView
          style={styles.controls}
          contentContainerStyle={styles.controlsInner}
        >
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

          <Text style={styles.label}>Fixture server (G6/G7 evidence)</Text>
          <View style={styles.row}>
            <Btn label="/ok +auth" onPress={() => loadFixture("/ok", true)} />
            <Btn
              label="/ok no-auth"
              onPress={() => loadFixture("/ok", false)}
            />
          </View>
          <View style={styles.row}>
            <Btn
              label="/unauth (401)"
              onPress={() => loadFixture("/unauth", true)}
            />
            <Btn
              label="/notfound"
              onPress={() => loadFixture("/notfound", true)}
            />
            <Btn label="Copy tech info" onPress={copyTechInfo} />
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
              <Chip
                label="Off"
                active={false}
                onPress={() => ref.current?.disableSubtitles()}
              />
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
            <Btn
              label={`Sub − (${subScale.toFixed(1)})`}
              onPress={() => changeSubScale(-0.1)}
            />
            <Btn label="Sub +" onPress={() => changeSubScale(0.1)} />
            <Btn
              label="Fill"
              onPress={() => ref.current?.setZoomedToFill(true)}
            />
          </View>

          <Text style={styles.status}>{status}</Text>
          {progress ? (
            <Text style={styles.mono}>
              {progress.position.toFixed(1)}s / {progress.duration.toFixed(1)}s
              · cache {progress.cacheSeconds.toFixed(1)}s
            </Text>
          ) : null}
          {tech ? (
            <Text style={styles.mono}>{JSON.stringify(tech, null, 2)}</Text>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaProvider>
  );
}

function trackLabel(t: AudioTrack | SubtitleTrack): string {
  const parts = [t.title, t.lang].filter(Boolean);
  return parts.length ? parts.join(" · ") : `#${t.id}`;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
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
