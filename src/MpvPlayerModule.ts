import { requireNativeModule } from "expo";

/**
 * The native `MpvPlayer` module. All player control is exposed as view-scoped
 * functions (called through the component ref in {@link MpvPlayerView}), so this
 * object is intentionally thin — requiring it asserts the native module is
 * registered and provides a home for any future module-level functions.
 */
export default requireNativeModule("MpvPlayer");
