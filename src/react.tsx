import * as React from "react";
import type { InventoryInput } from "./types.js";
import { renderToCanvas, type RenderToCanvasOptions } from "./index.js";

export interface InventoryCanvasProps
  extends React.CanvasHTMLAttributes<HTMLCanvasElement> {
  /** The inventory JSON (object or string). */
  input: InventoryInput | string;
  /** Render/asset options. */
  options?: RenderToCanvasOptions;
  /** Called after a successful render with the output dimensions. */
  onRendered?: (size: { width: number; height: number }) => void;
  /** Called if rendering throws. */
  onRenderError?: (error: unknown) => void;
}

/**
 * A thin React wrapper that renders an inventory onto a canvas. Re-renders when
 * `input` or `options` change. The core library is framework-agnostic; this is
 * purely a convenience.
 */
export function InventoryCanvas({
  input,
  options,
  onRendered,
  onRenderError,
  ...canvasProps
}: InventoryCanvasProps): React.ReactElement {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const inputKey = typeof input === "string" ? input : JSON.stringify(input);
  const optionsKey = JSON.stringify(options ?? {});

  React.useEffect(() => {
    let cancelled = false;
    const canvas = ref.current;
    if (!canvas) return;
    renderToCanvas(input, canvas, options)
      .then((size) => {
        if (!cancelled) onRendered?.(size);
      })
      .catch((err) => {
        if (!cancelled) onRenderError?.(err);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey, optionsKey]);

  return <canvas ref={ref} {...canvasProps} />;
}
