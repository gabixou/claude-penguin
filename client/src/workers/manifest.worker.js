// Extrai o manifesto de packs de um timelines.json — o parse do JSON
// (dance = ~8.6MB) roda fora da main thread para nao causar long task.
self.onmessage = async ({ data: base }) => {
    try {
        const tl = await fetch(`${base}/timelines.json`).then((r) => r.json());
        const urls = [];
        let charsUrl = null;
        if (tl.pack?.file) {
            charsUrl = `${base}/chars/${tl.pack.file}`;
            urls.push(charsUrl);
        }
        for (const f of tl.chunks?.files ?? []) urls.push(`${base}/chars/${f}`);
        self.postMessage({ base, urls, charsUrl, source: tl.source || '' });
    } catch (e) {
        self.postMessage({ base, urls: [], error: String(e) });
    }
};
