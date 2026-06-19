/**
 * A loaded image usable as a CanvasImageSource by both the browser canvas and
 * the node `canvas` package. We only require width/height; the value is passed
 * straight to ctx.drawImage.
 */
export interface LoadedImage {
  width: number;
  height: number;
  /** The underlying drawable (HTMLImageElement, ImageBitmap or node Image). */
  source: CanvasImageSource;
}

/** Loads images by URL/data-URL. Implementations differ per environment. */
export interface ImageLoader {
  load(url: string): Promise<LoadedImage | undefined>;
}

/**
 * Browser image loader using the DOM Image element. Returns undefined on load
 * error (e.g. a missing texture) so the renderer can fall back gracefully.
 */
export function browserImageLoader(): ImageLoader {
  return {
    load(url) {
      return new Promise<LoadedImage | undefined>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () =>
          resolve({
            width: img.naturalWidth,
            height: img.naturalHeight,
            source: img,
          });
        img.onerror = () => resolve(undefined);
        img.src = url;
      });
    },
  };
}

/** A simple in-memory cache wrapper around any ImageLoader. */
export function cachedLoader(inner: ImageLoader): ImageLoader {
  const cache = new Map<string, Promise<LoadedImage | undefined>>();
  return {
    load(url) {
      const hit = cache.get(url);
      if (hit) return hit;
      const p = inner.load(url);
      cache.set(url, p);
      return p;
    },
  };
}
