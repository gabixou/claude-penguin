// Marcos de desempenho do carregamento (performance.mark): custo ~zero e
// visiveis no painel Performance do DevTools. Para um resumo no console:
//   window.__perfMarks()  ->  [{ name, ms }] desde o inicio da navegacao
export function mark(name) {
    try { performance.mark(`cp:${name}`); } catch { /* sem User Timing */ }
}

if (typeof window !== 'undefined') {
    window.__perfMarks = () => performance.getEntriesByType('mark')
        .filter((m) => m.name.startsWith('cp:'))
        .map((m) => ({ name: m.name.slice(3), ms: Math.round(m.startTime) }));
}
