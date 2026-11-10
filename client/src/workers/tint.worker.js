// Worker de tint por pixel: recebe um ImageBitmap (transferido), aplica o
// colorTransform do Flash (mult+add por canal, clamp 0-255 — mesmo math de
// clip.js _pixelTint / movie.js tintedCanvas) e devolve um ImageBitmap.
// Tira o loop getImageData/putImageData da main thread — era CPU-bound.
self.onmessage = async (e) => {
    const { bitmap, mult, add } = e.data;
    try {
        const c = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(bitmap, 0, 0);
        const img = ctx.getImageData(0, 0, c.width, c.height);
        const d = img.data;
        const m = mult, a = add;
        for (let i = 0; i < d.length; i += 4) {
            d[i] = Math.min(255, Math.max(0, d[i] * m[0] + a[0]));
            d[i + 1] = Math.min(255, Math.max(0, d[i + 1] * m[1] + a[1]));
            d[i + 2] = Math.min(255, Math.max(0, d[i + 2] * m[2] + a[2]));
            d[i + 3] = Math.min(255, Math.max(0, d[i + 3] * m[3] + a[3]));
        }
        ctx.putImageData(img, 0, 0);
        const out = c.transferToImageBitmap();
        self.postMessage({ bitmap: out }, [out]);
        bitmap.close?.();
    } catch (err) {
        self.postMessage({ error: String(err) });
    }
};
