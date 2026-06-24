/**
 * Web is unsupported: libmpv has no web backend. Export an inert module so apps
 * that import the package still bundle on web. Any call rejects clearly rather
 * than crashing the bundle.
 */
const unsupported = (name: string) => () =>
  Promise.reject(
    new Error(`expo-mpv-player: "${name}" is not supported on web.`),
  );

export default {
  __unsupportedPlatform: "web",
  play: unsupported("play"),
  pause: unsupported("pause"),
};
