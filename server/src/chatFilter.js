// chatFilter.js - filtro server-side de chat/username (fase 1 moderacao).
// Pipeline: lowercase -> sem acentos -> leetspeak->letras -> colapsa
// repeticoes -> word-boundary match. O termo casado NUNCA volta ao cliente.
import { BADWORDS } from './data/badwords.js';
import crypto from 'crypto';

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '|': 'l', '+': 't' };

// lista unica, ordenada por tamanho (frases primeiro p/ "kill yourself")
const TERMS = [...new Set(BADWORDS.map((w) => w.trim().toLowerCase()).filter(Boolean))]
    .sort((a, b) => b.length - a.length);

function normalize(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[0134578@$!|+]/g, (c) => LEET[c] || c)
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/(.)\1{2,}/g, '$1$1') // colapsa 3+ repeticoes (ex.: fuuuck -> fuuck -> ainda casa? nao — word boundary precisa exato; colapsamos so 3+)
        .replace(/\s+/g, ' ')
        .trim();
}

// regex por termo com fronteiras — "ass" nao casa dentro de "class"
const TERM_RES = TERMS.map((t) => ({
    term: t,
    re: new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[^a-z0-9]+')}(?=[^a-z0-9]|$)`, 'i'),
}));

// Retorna {blocked:true} se contiver termo proibido.
export function checkText(text) {
    const norm = normalize(text);
    if (!norm) return { blocked: false };
    for (const { re } of TERM_RES) {
        if (re.test(norm)) return { blocked: true };
    }
    return { blocked: false };
}

// Log hasheado — nunca grava o termo nem a mensagem completa.
export function hashTerm(text) {
    return crypto.createHash('sha256').update(String(text || '')).digest('hex').slice(0, 12);
}

// ---------- Rate limit anti-spam: ~5 msgs / 10s por playerId ----------
const CHAT_WINDOW_MS = 10_000;
const CHAT_MAX = 5;
const chatHits = new Map(); // playerId -> [timestamps]

export function allowChat(playerId) {
    const now = Date.now();
    let arr = chatHits.get(playerId);
    if (!arr) { arr = []; chatHits.set(playerId, arr); }
    while (arr.length && now - arr[0] > CHAT_WINDOW_MS) arr.shift();
    if (arr.length >= CHAT_MAX) return false;
    arr.push(now);
    return true;
}

export function resetChatRate(playerId) {
    chatHits.delete(playerId);
}
