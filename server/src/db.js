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
