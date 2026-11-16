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

// Estado do fade para uma zona+progresso — crossfade classico em 2
// etapas por janela (sem "fantasma": nunca dois planos translucidos
// sobre fundo vazio):
//   1a metade da janela: plano "de" fica OPACO embaixo, twilight
//     sobe por cima com alpha 0 -> 1
//   2a metade: twilight fica opaco embaixo, plano "para" sobe por cima
//   No ponto medio o twilight esta puro (alpha 1, sozinho)
// Retorna alpha por plano + quem e bottom/top (RoomScene usa isso
// pra dar um leve viés de depth e garantir a ordem de composicao).
export function zoneWeights(zone, progress = 0) {
    const p = Math.min(1, Math.max(0, progress));
    const w = { day: 0, twilight: 0, night: 0, bottom: null, top: null };
    const fade = (b, t, a) => { w[b] = 1; w[t] = a; w.bottom = b; w.top = t; };
    if (zone === 'dawn') {
        // 06:00-06:30 noite->crepusculo | 06:30-07:00 crepusculo->dia
        if (p < 0.5) fade('night', 'twilight', 2 * p);
        else fade('twilight', 'day', 2 * p - 1);
        return w;
    }
    if (zone === 'dusk') {
        // 17:30-18:00 dia->crepusculo | 18:00-18:30 crepusculo->noite
        if (p < 0.5) fade('day', 'twilight', 2 * p);
        else fade('twilight', 'night', 2 * p - 1);
        return w;
    }
    w[zone] = 1;
    w.bottom = zone;
    return w;
}
