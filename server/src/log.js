/**
 * log.js - Logs estruturados (JSON lines) para eventos operacionais.
 * Cada linha: {"ts":"ISO","level":"info","event":"...", ...campos}
 * Erros vão para stderr; o resto para stdout. Em produção um coletor
 * (ex.: Vector/Promtail) pode ingerir stdout direto.
 */

function emit(level, event, fields = {}) {
    const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
    if (level === 'error' || level === 'warn') console.error(line);
    else console.log(line);
}

export const log = {
    info: (event, fields) => emit('info', event, fields),
    warn: (event, fields) => emit('warn', event, fields),
    error: (event, fields) => emit('error', event, fields),
};

export default log;
