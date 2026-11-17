/**
 * daynight.js — ciclo dia/noite/crepusculo server-side.
 *
 * Zonas no relogio de America/Sao_Paulo:
 *   night : 18:30 -> 06:00
 *   dawn  : 06:00 -> 07:00  (transicao noite -> dia, pack twilight)
 *   day   : 07:00 -> 17:30
 *   dusk  : 17:30 -> 18:30  (transicao dia -> noite, pack twilight)
 *
 * O servidor e a autoridade: envia {zone, progress} no join e a cada
 * minuto — o cliente interpola os alphas dos planos pelo relogio.
 */

const TZ = 'America/Sao_Paulo';

// [inicio, fim) em minutos SP; a zona noturna atravessa a meia-noite
// (18:30 -> 06:00 do dia seguinte), representada como from>to
const ZONES = [
    { zone: 'dawn',  from: 6 * 60,       to: 7 * 60 },
    { zone: 'day',   from: 7 * 60,       to: 17 * 60 + 30 },
    { zone: 'dusk',  from: 17 * 60 + 30, to: 18 * 60 + 30 },
    { zone: 'night', from: 18 * 60 + 30, to: 6 * 60 },
];

const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour: 'numeric', minute: 'numeric', hour12: false,
});

function spMinutes(now = Date.now()) {
    const parts = fmt.formatToParts(new Date(now));
    const h = Number(parts.find((p) => p.type === 'hour').value) % 24;
    const m = Number(parts.find((p) => p.type === 'minute').value);
    return h * 60 + m;
}

export function zoneInfo(now = Date.now()) {
    const t = spMinutes(now);
    for (const z of ZONES) {
        const span = z.to > z.from ? z.to - z.from : z.to + 24 * 60 - z.from;
        const inZone = z.to > z.from ? (t >= z.from && t < z.to)
                                      : (t >= z.from || t < z.to);
        if (inZone) {
            const elapsed = z.to > z.from ? t - z.from : (t >= z.from ? t - z.from : t + 24 * 60 - z.from);
            return { zone: z.zone, progress: elapsed / span };
        }
    }
    return { zone: 'night', progress: 0 };
}

// compat: fase binaria derivada da zona (day/dawn -> 'day', dusk/night -> 'night')
export function phase(now = Date.now()) {
    const z = zoneInfo(now).zone;
    return (z === 'day' || z === 'dawn') ? 'day' : 'night';
}

export function msUntilZoneEnd(now = Date.now()) {
    const t = spMinutes(now);
    const info = zoneInfo(now);
    const z = ZONES.find((x) => x.zone === info.zone);
    const span = z.to > z.from ? z.to - z.from : z.to + 24 * 60 - z.from;
    const elapsed = z.to > z.from ? t - z.from : (t >= z.from ? t - z.from : t + 24 * 60 - z.from);
    return Math.max(0, (span - elapsed)) * 60 * 1000;
}

export function spTimeLabel(now = Date.now()) {
    return fmt.format(new Date(now));
}

// Chama onTick(zoneInfo) periodicamente — o cliente usa para interpolar.
export function startDayNightLoop(onTick, intervalMs = 30000) {
    const timer = setInterval(() => onTick(zoneInfo()), intervalMs);
    timer.unref?.();
    return timer;
}
