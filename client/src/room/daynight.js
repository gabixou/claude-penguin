// Relogio do ciclo dia/noite no cliente — mesma tabela do servidor
// (server/src/daynight.js), fuso America/Sao_Paulo, horas locais de SP.
// O servidor continua autoridade; aqui o cliente interpola a cada tick
// pra transicao ser continua (fade durante toda a janela).
//
// Zonas (horas locais SP):
//   06:00-07:00 dawn   (noite -> crepusculo -> dia)
//   07:00-17:30 day
//   17:30-18:30 dusk   (dia -> crepusculo -> noite)
//   18:30-06:00 night

const ZONES = [
    { from: 360, to: 420, zone: 'dawn' },
    { from: 420, to: 1050, zone: 'day' },
    { from: 1050, to: 1110, zone: 'dusk' },
    { from: 1110, to: 360 + 1440, zone: 'night' },
];

const spFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
});

export function spMinutes(now = Date.now()) {
    const [hh, mm] = spFmt.format(now).split(':').map(Number);
    return (hh % 24) * 60 + mm;
}

export function zoneInfo(now = Date.now()) {
    const t = spMinutes(now);
    for (const z of ZONES) {
        const span = z.to > z.from ? z.to - z.from : z.to + 1440 - z.from;
        const inZone = z.to > z.from ? (t >= z.from && t < z.to)
                                      : (t >= z.from || t < z.to);
        if (inZone) {
            const elapsed = z.to > z.from ? t - z.from
                                          : (t >= z.from ? t - z.from : t + 1440 - z.from);
            return { zone: z.zone, progress: elapsed / span };
        }
    }
    return { zone: 'day', progress: 0 };
}

// Progresso dentro de uma zona especifica no horario atual — usado
// quando ?daynight= forca uma zona diferente da atual. Fora da janela
// real, o progresso cicla dentro do span dela (util p/ QA do fade).
export function zoneProgressFor(zone, now = Date.now()) {
    const t = spMinutes(now);
    for (const z of ZONES) {
        if (z.zone !== zone) continue;
        const span = z.to > z.from ? z.to - z.from : z.to + 1440 - z.from;
        const e = (((t - z.from) % span) + span) % span;
        return e / span;
    }
    return 0;
}

// Pesos dos 3 planos (alpha) para uma zona+progresso.
// Janelas de transicao: primeira metade = pack "de" sai enquanto
// twilight entra; segunda metade = twilight sai enquanto "para" entra.
// Pico de twilight = 1 no meio da janela; fora delas um plano = 1.
export function zoneWeights(zone, progress = 0) {
    const p = Math.min(1, Math.max(0, progress));
    const tri = 1 - Math.abs(2 * p - 1);
    if (zone === 'dawn') {
        return {
            night: Math.max(0, 1 - 2 * p),
            twilight: tri,
            day: Math.max(0, 2 * p - 1),
        };
    }
    if (zone === 'dusk') {
        return {
            day: Math.max(0, 1 - 2 * p),
            twilight: tri,
            night: Math.max(0, 2 * p - 1),
        };
    }
    const w = { day: 0, twilight: 0, night: 0 };
    w[zone] = 1;
    return w;
}
