// IP real do cliente atras de proxies locais (Caddy/cloudflared).
// remoteAddress e sempre loopback em producao — o IP verdadeiro vem em
// X-Forwarded-For, que o Caddy define explicitamente (header_up), entao
// nao pode ser spoofado pelo cliente.
const LOOPBACK = new Set(['::1', '127.0.0.1', '::ffff:127.0.0.1']);

export function isLoopbackIp(ip) {
    return LOOPBACK.has(ip || '');
}

export function clientIp(req) {
    const ra = req.socket.remoteAddress || '';
    if (isLoopbackIp(ra)) {
        const xff = req.headers?.['x-forwarded-for'];
        if (xff) return String(xff).split(',')[0].trim();
    }
    return ra;
}
