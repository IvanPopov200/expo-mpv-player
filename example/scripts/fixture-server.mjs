// Deterministic fixture HTTP server for the verification gates (no deps).
//
// Routes:
//   GET /ok        -> 200 + the sample video, ONLY if the Authorization header
//                     exactly equals EXPECTED_AUTH (a value containing a comma).
//                     Otherwise 401. Proves G6 (header passing incl. comma) and
//                     that a missing/wrong header is rejected.
//   GET /unauth    -> always 401. Proves G7 (onError on auth failure).
//   GET /notfound  -> 404. Proves G7 (onError on a 4xx).
//   GET /reset-log -> clears the in-memory request log.
//   GET /log       -> returns the captured request log as JSON (evidence).
//
// Every request's method, path and Authorization header are logged to stdout
// AND kept in memory so a test can assert the exact header the player sent.
//
// Usage:
//   node example/scripts/fixture-server.mjs [--port 8099] [--sample <path>]
//   (sample defaults to verification/assets/sample.mp4 — generate it with the
//    ffmpeg one-liner in verification/README.md)
import { createServer } from "node:http";
import { createReadStream, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const argv = process.argv.slice(2);
const getArg = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};

const PORT = Number(getArg("--port", process.env.PORT || "8099"));
const here = dirname(fileURLToPath(import.meta.url));
const SAMPLE = resolve(
  getArg("--sample", resolve(here, "../../verification/assets/sample.mp4")),
);
// A realistic Jellyfin-style header whose value contains a comma — the exact
// thing the naive comma-join header bug corrupts.
const EXPECTED_AUTH = 'MediaBrowser Client="ExpoMpvPlayer", Token="fixture-token-123"';

const requestLog = [];

function log(entry) {
  requestLog.push({ ...entry, at: new Date().toISOString() });
  // eslint-disable-next-line no-console
  console.log(
    `[fixture] ${entry.method} ${entry.url} auth=${JSON.stringify(entry.authorization ?? null)} -> ${entry.status}`,
  );
}

function serveVideo(req, res) {
  if (!existsSync(SAMPLE)) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end(`sample not found at ${SAMPLE} — see verification/README.md`);
    return 500;
  }
  const { size } = statSync(SAMPLE);
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    const start = m ? Number(m[1]) : 0;
    const end = m && m[2] ? Number(m[2]) : size - 1;
    res.writeHead(206, {
      "content-type": "video/mp4",
      "content-range": `bytes ${start}-${end}/${size}`,
      "accept-ranges": "bytes",
      "content-length": String(end - start + 1),
    });
    createReadStream(SAMPLE, { start, end }).pipe(res);
    return 206;
  }
  res.writeHead(200, {
    "content-type": "video/mp4",
    "content-length": String(size),
    "accept-ranges": "bytes",
  });
  createReadStream(SAMPLE).pipe(res);
  return 200;
}

const server = createServer((req, res) => {
  const url = (req.url || "/").split("?")[0];
  const authorization = req.headers.authorization;

  if (url === "/log") {
    const body = JSON.stringify(requestLog, null, 2);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(body);
    return;
  }
  if (url === "/reset-log") {
    requestLog.length = 0;
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }

  if (url === "/ok") {
    if (authorization !== EXPECTED_AUTH) {
      res.writeHead(401, { "content-type": "text/plain" });
      res.end("missing or wrong Authorization header");
      log({ method: req.method, url, authorization, status: 401 });
      return;
    }
    const status = serveVideo(req, res);
    log({ method: req.method, url, authorization, status });
    return;
  }
  if (url === "/unauth") {
    res.writeHead(401, { "content-type": "text/plain" });
    res.end("unauthorized");
    log({ method: req.method, url, authorization, status: 401 });
    return;
  }
  if (url === "/notfound") {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    log({ method: req.method, url, authorization, status: 404 });
    return;
  }

  res.writeHead(200, { "content-type": "text/plain" });
  res.end(
    [
      "expo-mpv-player fixture server",
      `expected Authorization for /ok: ${EXPECTED_AUTH}`,
      "routes: /ok /unauth /notfound /log /reset-log",
    ].join("\n"),
  );
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[fixture] listening on http://0.0.0.0:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[fixture] sample: ${SAMPLE}`);
  // eslint-disable-next-line no-console
  console.log(`[fixture] expected /ok Authorization: ${EXPECTED_AUTH}`);
});
