import { requireNativeView } from "expo";
import { forwardRef, useImperativeHandle, useRef } from "react";

import type { MpvPlayerViewProps, MpvPlayerViewRef } from "./MpvPlayer.types";
import {
  createImperativeHandle,
  type NativeMpvViewRef,
} from "./createImperativeHandle";

const NativeView: React.ComponentType<
  MpvPlayerViewProps & { ref?: React.Ref<NativeMpvViewRef> }
> = requireNativeView("MpvPlayer");

const MpvPlayerView = forwardRef<MpvPlayerViewRef, MpvPlayerViewProps>(
  (props, ref) => {
    const nativeRef = useRef<NativeMpvViewRef | null>(null);

    useImperativeHandle(
      ref,
      () => createImperativeHandle(() => nativeRef.current),
      [],
    );

    return <NativeView {...props} ref={nativeRef} />;
  },
);

MpvPlayerView.displayName = "MpvPlayerView";

export default MpvPlayerView;
