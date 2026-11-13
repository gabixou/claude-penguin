/**
 * db.js - Conexão SQLite e schema do Club Penguin Browser
 * Usa node:sqlite built-in (Node 22+) - sem dependências nativas.
 */

import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data');
// PENGUIN_DB permite apontar para um banco alternativo (testes)
const DB_PATH = process.env.PENGUIN_DB || join(DATA_DIR, 'penguin.db');

// Garante que o diretório de dados existe
if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// Configurações de performance e segurança
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Schema do banco de dados
const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
    player_id TEXT PRIMARY KEY,
    ip TEXT NOT NULL,
    session_token TEXT UNIQUE,
    username TEXT NOT NULL UNIQUE,
    color_item_id INTEGER NOT NULL DEFAULT 1,
    coins INTEGER NOT NULL DEFAULT 1000,
    last_daily_bonus TEXT,
    name_changed_at INTEGER,
    created_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_players_ip ON players(ip);
CREATE INDEX IF NOT EXISTS idx_players_session ON players(session_token);

CREATE TABLE IF NOT EXISTS inventory (
    player_id TEXT NOT NULL,
    item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (player_id, item_id),
    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inventory_player ON inventory(player_id);

CREATE TABLE IF NOT EXISTS equipped (
    player_id TEXT NOT NULL,
    slot TEXT NOT NULL,
    item_id INTEGER,
    PRIMARY KEY (player_id, slot),
    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_equipped_player ON equipped(player_id);

-- Buddy list: linha por direcao (A->B e B->A quando aceito). status:
-- 'pending' (pedido enviado, aguardando aceite) ou 'accepted'.
CREATE TABLE IF NOT EXISTS buddies (
    player_id TEXT NOT NULL,
    buddy_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    PRIMARY KEY (player_id, buddy_id),
    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
    FOREIGN KEY (buddy_id) REFERENCES players(player_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_buddies_player ON buddies(player_id);
CREATE INDEX IF NOT EXISTS idx_buddies_buddy ON buddies(buddy_id);

-- Ignore list: quem ignora quem (unidirecional).
CREATE TABLE IF NOT EXISTS ignores (
    player_id TEXT NOT NULL,
    ignored_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (player_id, ignored_id),
    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
    FOREIGN KEY (ignored_id) REFERENCES players(player_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ignores_player ON ignores(player_id);

-- Pets adotados (versao "solta" — sem habitat de iglu).
CREATE TABLE IF NOT EXISTS pets (
    pet_row_id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    species TEXT NOT NULL,
    name TEXT NOT NULL,
    hunger INTEGER NOT NULL DEFAULT 100,
    happiness INTEGER NOT NULL DEFAULT 100,
    adopted_at INTEGER NOT NULL,
    last_tick INTEGER NOT NULL,
    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pets_player ON pets(player_id);
`;

// Executa o schema
db.exec(SCHEMA);

// Migracao: flag all_items (pinguim de teste com inventario completo).
// CREATE TABLE IF NOT EXISTS nao altera tabelas existentes.
const playerCols = db.prepare('PRAGMA table_info(players)').all().map((c) => c.name);
if (!playerCols.includes('all_items')) {
    db.exec('ALTER TABLE players ADD COLUMN all_items INTEGER NOT NULL DEFAULT 0');
}

export default db;
