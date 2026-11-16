/**
 * daynight.js — ciclo dia/noite server-side (relógio de America/Sao_Paulo).
 *
 * Fase 'day' entre DAY_START e NIGHT_START (hora local SP), 'night' no
 * restante. O servidor e a autoridade: envia a fase no join e faz
 * broadcast quando ela vira — os clientes fazem o crossfade.
 */

const TZ = 'America/Sao_Paulo';
const DAY_START = 6;    // 06:00 SP
const NIGHT_START = 18; // 18:00 SP

const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour: 'numeric', minute: 'numeric', hour12: false,
});

function spMinutes(now = Date.now()) {
    const parts = fmt.formatToParts(new Date(now));
    const h = Number(parts.find((p) => p.type === 'hour').value) % 24;
    const m = Number(parts.find((p) => p.type === 'minute').value);
    return h * 60 + m;
}

export function phase(now = Date.now()) {
    const t = spMinutes(now);
    return (t >= DAY_START * 60 && t < NIGHT_START * 60) ? 'day' : 'night';
}

// ms ate a proxima virada de fase (para o cliente agendar o fade)
export function msUntilFlip(now = Date.now()) {
    const t = spMinutes(now);
    const isDay = phase(now) === 'day';
    const boundary = isDay ? NIGHT_START * 60 : (DAY_START * 60 + 24 * 60);
    let delta = boundary - t;
    if (delta <= 0) delta += 24 * 60;
    return delta * 60 * 1000;
}

export function spTimeLabel(now = Date.now()) {
    return fmt.format(new Date(now));
}

// Verifica a fase periodicamente e chama onFlip(phase) nas viradas.
export function startDayNightLoop(onFlip, intervalMs = 15000) {
    let cur = phase();
    const timer = setInterval(() => {
        const p = phase();
        if (p !== cur) { cur = p; onFlip(p); }
    }, intervalMs);
    timer.unref?.();
    return timer;
}
