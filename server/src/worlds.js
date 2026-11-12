/**
 * worlds.js - Multi-mundo: lista de servidores, lotação e presença.
 *
 * Cada processo do servidor se registra na tabela `worlds` (banco
 * compartilhado entre mundos). O campo `online` é atualizado por
 * heartbeat a cada HEARTBEAT_MS com a contagem real de conexões
 * autenticadas deste processo.
 */

import db from './db.js';

export const WORLD_ID = process.env.WORLD_ID || 'world1';
export const WORLD_NAME = process.env.WORLD_NAME || 'Mundo 1';
export const WORLD_REGION = process.env.WORLD_REGION || null;
export const WORLD_URL = process.env.WORLD_URL || null; // ws(s):// público
export const WORLD_CAPACITY = Math.max(1, Number(process.env.WORLD_CAPACITY) || 500);
const HEARTBEAT_MS = 15 * 1000;

let heartbeatTimer = null;

// Registra/atualiza a linha deste mundo no banco compartilhado.
export function ensureWorld() {
    db.prepare(`
        INSERT INTO worlds (id, name, region, ws_url, capacity, online, sort_order, created_at)
        VALUES (?, ?, ?, ?, ?, 0, 0, ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            region = excluded.region,
            ws_url = excluded.ws_url,
            capacity = excluded.capacity
    `).run(WORLD_ID, WORLD_NAME, WORLD_REGION, WORLD_URL, WORLD_CAPACITY, Date.now());
}

export function setOnline(count) {
    db.prepare('UPDATE worlds SET online = ? WHERE id = ?').run(count, WORLD_ID);
}

export function listWorlds() {
    return db.prepare('SELECT * FROM worlds ORDER BY sort_order, name').all();
}

// Inicia o heartbeat que mantém worlds.online atualizado.
// `countFn` retorna o número de jogadores autenticados conectados.
export function startHeartbeat(countFn) {
    ensureWorld();
    const beat = () => {
        try { setOnline(countFn()); } catch { /* banco ocupado */ }
    };
    beat();
    heartbeatTimer = setInterval(beat, HEARTBEAT_MS);
    heartbeatTimer.unref?.();
}

export function stopHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
}
