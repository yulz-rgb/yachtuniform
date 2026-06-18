/** Remove flat white/near-white backgrounds from product shots for model overlay. */

const KEYED_CACHE = new Map();
const KEY_THRESHOLD = 240;

function keyAlpha(r, g, b, a) {
  if (a <= 12) return 0;
  const min = Math.min(r, g, b);
  if (min >= KEY_THRESHOLD) return 0;
  if (min >= KEY_THRESHOLD - 12) {
    return Math.round(a * (KEY_THRESHOLD - min) / 12);
  }
  return a;
}

export function keyProductImage(src) {
  if (!src || typeof window === 'undefined') return Promise.resolve(src);
  if (KEYED_CACHE.has(src)) return KEYED_CACHE.get(src);

  const promise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < data.length; i += 4) {
          data[i + 3] = keyAlpha(data[i], data[i + 1], data[i + 2], data[i + 3]);
        }
        ctx.putImageData(new ImageData(data, canvas.width, canvas.height), 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });

  KEYED_CACHE.set(src, promise);
  return promise;
}

export function clearKeyedImageCache() {
  KEYED_CACHE.clear();
}
