/**
 * db.js - Conexão SQLite, migrações versionadas e backup do Club Penguin Browser
 * Usa node:sqlite built-in (Node 22+) - sem dependências nativas.
 */

import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data');
// PENGUIN_DB permite apontar para um banco alternativo (testes)
const DB_PATH = process.env.PENGUIN_DB || join(DATA_DIR, 'penguin.db');
const BACKUP_DIR = join(dirname(DB_PATH), 'backups');
const BACKUP_KEEP = 20;

// Garante que o diretório de dados existe
if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// Configurações de performance e segurança
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ---------- Backup automático ----------

// Snapshot consistente via VACUUM INTO (seguro com WAL aberto).
// Roda uma vez no boot, antes das migrações, e mantém os últimos
// BACKUP_KEEP arquivos em server/data/backups/.
function backupDatabase() {
    try {
        if (!existsSync(DB_PATH)) return;
        // Banco recem-criado (0 tabelas) não precisa de backup
        const hasTables = db.prepare(
            "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).get().n > 0;
        if (!hasTables) return;

        if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const target = join(BACKUP_DIR, `penguin-${stamp}.db`).replace(/\\/g, '/');
        db.exec(`VACUUM INTO '${target}'`);

        // Rotação: remove os backups mais antigos além do limite
        const files = readdirSync(BACKUP_DIR)
            .filter((f) => f.startsWith('penguin-') && f.endsWith('.db'))
            .sort();
        while (files.length > BACKUP_KEEP) {
            unlinkSync(join(BACKUP_DIR, files.shift()));
        }
        console.log(`[db] Backup criado: ${target}`);
    } catch (err) {
        // Backup é best-effort: nunca impede o boot do servidor
        console.warn('[db] Falha ao criar backup:', err.message);
    }
}

// ---------- Migrações versionadas ----------

const MIGRATIONS = [
    {
        version: 1,
        name: 'schema inicial (players, inventory, equipped)',
        up: (d) => {
            d.exec(`
                CREATE TABLE IF NOT EXISTS players (
                    player_id TEXT PRIMARY KEY,
                    ip TEXT NOT NULL,
                    session_token TEXT UNIQUE,
                    username TEXT NOT NULL UNIQUE,
                    color_item_id INTEGER NOT NULL DEFAULT 1,
                    coins INTEGER NOT NULL DEFAULT 1000,
                    last_daily_bonus TEXT,
                    name_changed_at INTEGER,
                    all_items INTEGER NOT NULL DEFAULT 0,
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
            `);
            // Bancos criados antes da coluna all_items
            const cols = d.prepare('PRAGMA table_info(players)').all().map((c) => c.name);
            if (!cols.includes('all_items')) {
                d.exec('ALTER TABLE players ADD COLUMN all_items INTEGER NOT NULL DEFAULT 0');
            }
        }
    },
    {
        version: 2,
        name: 'invalida tokens de sessao legados (auth por senha entra na fase 2)',
        up: (d) => {
            d.exec('UPDATE players SET session_token = NULL WHERE session_token IS NOT NULL');
        }
    }
];

function runMigrations() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at INTEGER NOT NULL
        )
    `);

    const applied = new Set(
        db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version)
    );

    const insert = db.prepare(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
    );

    for (const m of MIGRATIONS) {
        if (applied.has(m.version)) continue;
        db.exec('BEGIN');
        try {
            m.up(db);
            insert.run(m.version, m.name, Date.now());
            db.exec('COMMIT');
            console.log(`[db] Migração ${m.version} aplicada: ${m.name}`);
        } catch (err) {
            db.exec('ROLLBACK');
            throw new Error(`Falha na migração ${m.version} (${m.name}): ${err.message}`);
        }
    }
}

// Backup antes de migrar: se uma migração corromper algo, há snapshot.
backupDatabase();
runMigrations();

export default db;
export { MIGRATIONS, runMigrations, backupDatabase, DATA_DIR, DB_PATH };
