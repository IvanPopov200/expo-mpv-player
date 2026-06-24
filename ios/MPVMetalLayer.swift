import QuartzCore
import UIKit

/// `CAMetalLayer` subclass used as mpv's render target (`vo=gpu-next` +
/// `gpu-context=moltenvk`). Adapted from the MPVKit Demo.
///
/// Two known MoltenVK caveats are handled here:
///  - `drawableSize` is clamped away from 1×1 (a 0/1-sized drawable triggers a
///    MoltenVK flicker/validation bug).
///  - `framebufferOnly = true` and `presentsWithTransaction = false` keep the
///    present path cheap.
final class MPVMetalLayer: CAMetalLayer {
  override init() {
    super.init()
    commonInit()
  }

  override init(layer: Any) {
    super.init(layer: layer)
    commonInit()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    commonInit()
  }

  private func commonInit() {
    device = MTLCreateSystemDefaultDevice()
    pixelFormat = .bgra8Unorm
    framebufferOnly = true
    presentsWithTransaction = false
    contentsScale = UIScreen.main.nativeScale
    // Backpressure: let mpv drive the present cadence.
    if #available(iOS 16.0, tvOS 16.0, *) {
      // No-op placeholder for future EDR/maximumDrawableCount tuning.
    }
  }

  override var drawableSize: CGSize {
    get { super.drawableSize }
    set {
      // Clamp away from degenerate sizes to dodge the MoltenVK 1×1 flicker bug.
      let clamped = CGSize(
        width: max(newValue.width, 2),
        height: max(newValue.height, 2)
      )
      super.drawableSize = clamped
    }
  }
}
