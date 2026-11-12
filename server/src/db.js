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
    },
    {
        version: 3,
        name: 'contas: senha/recuperacao, sessions, username_key, meta',
        up: (d) => {
            // Colunas de conta em players
            const cols = d.prepare('PRAGMA table_info(players)').all().map((c) => c.name);
            for (const [col, ddl] of [
                ['password_hash', 'ALTER TABLE players ADD COLUMN password_hash TEXT'],
                ['recovery_hash', 'ALTER TABLE players ADD COLUMN recovery_hash TEXT'],
                ['recovery_label', 'ALTER TABLE players ADD COLUMN recovery_label TEXT'],
                ['username_key', 'ALTER TABLE players ADD COLUMN username_key TEXT'],
            ]) {
                if (!cols.includes(col)) d.exec(ddl);
            }
            // Backfill da chave case-insensitive
            d.exec('UPDATE players SET username_key = lower(username) WHERE username_key IS NULL');
            try {
                d.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_players_username_key ON players(username_key)');
            } catch {
                // Nomes legados duplicados ignorando caixa: cai para indice
                // comum — a unicidade continua garantida no codigo.
                d.exec('CREATE INDEX IF NOT EXISTS idx_players_username_key ON players(username_key)');
                console.warn('[db] usernames duplicados ignorando caixa — indice nao-unico');
            }

            // Sessoes: guarda-se apenas o hash do token (vazamento do banco
            // nao entrega sessoes utilizaveis)
            d.exec(`
                CREATE TABLE IF NOT EXISTS sessions (
                    token_hash TEXT PRIMARY KEY,
                    player_id TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    expires_at INTEGER NOT NULL,
                    last_used_at INTEGER NOT NULL,
                    ip TEXT,
                    user_agent TEXT,
                    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_sessions_player ON sessions(player_id);
                CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
            `);

            // Meta chave-valor (prazos de migracao, flags globais)
            d.exec(`
                CREATE TABLE IF NOT EXISTS meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
            `);
            // Prazo para contas antigas definirem senha: 30 dias a partir da
            // primeira migracao que rodou este schema.
            const deadline = Date.now() + 30 * 24 * 60 * 60 * 1000;
            d.exec(
                `INSERT OR IGNORE INTO meta (key, value) VALUES ('legacy_token_deadline', '${deadline}')`
            );
        }
    },
    {
        version: 4,
        name: 'moderacao: role, ban, warning, report, chat_filter, login_history, audit_log',
        up: (d) => {
            const cols = d.prepare('PRAGMA table_info(players)').all().map((c) => c.name);
            if (!cols.includes('role')) {
                d.exec("ALTER TABLE players ADD COLUMN role TEXT NOT NULL DEFAULT 'player'");
            }
            if (!cols.includes('muted_until')) {
                d.exec('ALTER TABLE players ADD COLUMN muted_until INTEGER');
            }
            d.exec(`
                CREATE TABLE IF NOT EXISTS ban (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_id TEXT NOT NULL,
                    reason TEXT,
                    moderator_id TEXT,
                    created_at INTEGER NOT NULL,
                    expires_at INTEGER,
                    revoked_at INTEGER,
                    revoked_by TEXT,
                    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_ban_player ON ban(player_id);
                CREATE INDEX IF NOT EXISTS idx_ban_active ON ban(player_id, revoked_at, expires_at);

                CREATE TABLE IF NOT EXISTS warning (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_id TEXT NOT NULL,
                    moderator_id TEXT,
                    reason TEXT,
                    created_at INTEGER NOT NULL,
                    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_warning_player ON warning(player_id);

                CREATE TABLE IF NOT EXISTS report (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    reporter_id TEXT NOT NULL,
                    target_player_id TEXT,
                    target_message TEXT,
                    reason TEXT,
                    status TEXT NOT NULL DEFAULT 'open',
                    created_at INTEGER NOT NULL,
                    resolved_by TEXT,
                    resolved_at INTEGER,
                    resolution TEXT,
                    FOREIGN KEY (reporter_id) REFERENCES players(player_id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_report_status ON report(status);

                CREATE TABLE IF NOT EXISTS chat_filter_rule (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pattern TEXT NOT NULL,
                    action TEXT NOT NULL DEFAULT 'mask',
                    created_by TEXT,
                    created_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS login_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_id TEXT,
                    username TEXT,
                    ip TEXT,
                    user_agent TEXT,
                    success INTEGER NOT NULL,
                    created_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_login_history_player ON login_history(player_id);

                CREATE TABLE IF NOT EXISTS audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    actor_id TEXT,
                    action TEXT NOT NULL,
                    target_id TEXT,
                    details TEXT,
                    created_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
            `);
        }
    },
    {
        version: 5,
        name: 'operacao: worlds (multi-mundo), world_id em sessions',
        up: (d) => {
            d.exec(`
                CREATE TABLE IF NOT EXISTS worlds (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    region TEXT,
                    ws_url TEXT,
                    capacity INTEGER NOT NULL DEFAULT 500,
                    online INTEGER NOT NULL DEFAULT 0,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL
                );
            `);
            const cols = d.prepare('PRAGMA table_info(sessions)').all().map((c) => c.name);
            if (!cols.includes('world_id')) {
                d.exec("ALTER TABLE sessions ADD COLUMN world_id TEXT NOT NULL DEFAULT 'world1'");
            }
        }
    },
    {
        version: 6,
        name: 'sistemas de jogo: amigos, iglu, puffles, correio, selos, jogos, epf, codigos, config',
        up: (d) => {
            d.exec(`
                -- Amigos / ignorados
                CREATE TABLE IF NOT EXISTS friends (
                    player_id TEXT NOT NULL,
                    friend_id TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    PRIMARY KEY (player_id, friend_id),
                    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
                    FOREIGN KEY (friend_id) REFERENCES players(player_id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS ignores (
                    player_id TEXT NOT NULL,
                    ignored_id TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    PRIMARY KEY (player_id, ignored_id),
                    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
                    FOREIGN KEY (ignored_id) REFERENCES players(player_id) ON DELETE CASCADE
                );

                -- Iglu
                CREATE TABLE IF NOT EXISTS igloos (
                    player_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL DEFAULT 'Meu Iglu',
                    theme TEXT,
                    floor_item_id INTEGER,
                    updated_at INTEGER NOT NULL,
                    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS igloo_furniture (
                    player_id TEXT NOT NULL,
                    slot INTEGER NOT NULL,
                    item_id INTEGER NOT NULL,
                    PRIMARY KEY (player_id, slot),
                    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
                );

                -- Puffles
                CREATE TABLE IF NOT EXISTS puffles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_id TEXT NOT NULL,
                    species TEXT NOT NULL,
                    name TEXT NOT NULL,
                    hunger INTEGER NOT NULL DEFAULT 50,
                    happiness INTEGER NOT NULL DEFAULT 50,
                    energy INTEGER NOT NULL DEFAULT 50,
                    sleep INTEGER NOT NULL DEFAULT 50,
                    clean INTEGER NOT NULL DEFAULT 50,
                    last_tick INTEGER NOT NULL,
                    adopted_at INTEGER NOT NULL,
                    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_puffles_player ON puffles(player_id);
                CREATE TABLE IF NOT EXISTS puffle_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    puffle_id INTEGER NOT NULL,
                    item_id INTEGER NOT NULL,
                    slot TEXT,
                    FOREIGN KEY (puffle_id) REFERENCES puffles(id) ON DELETE CASCADE
                );

                -- Correio / cartões-postais
                CREATE TABLE IF NOT EXISTS mail (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sender_id TEXT NOT NULL,
                    recipient_id TEXT NOT NULL,
                    subject TEXT,
                    body TEXT NOT NULL,
                    item_id INTEGER,
                    coins INTEGER,
                    created_at INTEGER NOT NULL,
                    read_at INTEGER,
                    deleted_at INTEGER,
                    FOREIGN KEY (sender_id) REFERENCES players(player_id) ON DELETE CASCADE,
                    FOREIGN KEY (recipient_id) REFERENCES players(player_id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_mail_recipient ON mail(recipient_id, deleted_at);

                -- Selos
                CREATE TABLE IF NOT EXISTS stamps (
                    player_id TEXT NOT NULL,
                    stamp_id INTEGER NOT NULL,
                    obtained_at INTEGER NOT NULL,
                    PRIMARY KEY (player_id, stamp_id),
                    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
                );

                -- Jogos de mesa (sessões/filas)
                CREATE TABLE IF NOT EXISTS game_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    game TEXT NOT NULL,
                    player_a TEXT NOT NULL,
                    player_b TEXT,
                    state TEXT,
                    status TEXT NOT NULL DEFAULT 'waiting',
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_game_status ON game_sessions(game, status);

                -- Card-Jitsu / progressão ninja
                CREATE TABLE IF NOT EXISTS cardjitsu (
                    player_id TEXT PRIMARY KEY,
                    xp INTEGER NOT NULL DEFAULT 0,
                    level INTEGER NOT NULL DEFAULT 1,
                    wins INTEGER NOT NULL DEFAULT 0,
                    losses INTEGER NOT NULL DEFAULT 0,
                    deck TEXT,
                    progress TEXT,
                    updated_at INTEGER NOT NULL,
                    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
                );

                -- EPF / missões
                CREATE TABLE IF NOT EXISTS player_missions (
                    player_id TEXT NOT NULL,
                    mission_id TEXT NOT NULL,
                    progress INTEGER NOT NULL DEFAULT 0,
                    target INTEGER NOT NULL,
                    claimed INTEGER NOT NULL DEFAULT 0,
                    updated_at INTEGER NOT NULL,
                    PRIMARY KEY (player_id, mission_id),
                    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS player_epf (
                    player_id TEXT PRIMARY KEY,
                    level INTEGER NOT NULL DEFAULT 1,
                    xp INTEGER NOT NULL DEFAULT 0,
                    badges TEXT,
                    updated_at INTEGER NOT NULL,
                    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
                );

                -- Códigos de resgate
                CREATE TABLE IF NOT EXISTS redeem_codes (
                    code TEXT PRIMARY KEY,
                    reward_type TEXT NOT NULL,
                    reward_id INTEGER,
                    quantity INTEGER NOT NULL DEFAULT 1,
                    max_uses INTEGER,
                    uses INTEGER NOT NULL DEFAULT 0,
                    expires_at INTEGER,
                    created_at INTEGER NOT NULL,
                    created_by TEXT
                );
                CREATE TABLE IF NOT EXISTS redeem_uses (
                    code TEXT NOT NULL,
                    player_id TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    PRIMARY KEY (code, player_id)
                );

                -- Configurações do jogador / jornal
                CREATE TABLE IF NOT EXISTS player_settings (
                    player_id TEXT PRIMARY KEY,
                    settings TEXT NOT NULL DEFAULT '{}',
                    updated_at INTEGER NOT NULL,
                    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS newspaper (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    body TEXT NOT NULL,
                    published_at INTEGER NOT NULL
                );
            `);
        }
    },
    {
        version: 7,
        name: 'festas: parties, party_substitutions, player_party',
        up: (d) => {
            d.exec(`
                CREATE TABLE IF NOT EXISTS parties (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    start_at INTEGER NOT NULL,
                    end_at INTEGER NOT NULL,
                    timezone TEXT,
                    status TEXT NOT NULL DEFAULT 'scheduled',
                    created_by TEXT,
                    created_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_parties_window ON parties(start_at, end_at, status);

                CREATE TABLE IF NOT EXISTS party_substitutions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    party_id INTEGER NOT NULL,
                    room_id TEXT,
                    kind TEXT NOT NULL,
                    value TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    UNIQUE (party_id, room_id, kind),
                    FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_party_subs ON party_substitutions(party_id);

                CREATE TABLE IF NOT EXISTS player_party (
                    player_id TEXT NOT NULL,
                    party_id INTEGER NOT NULL,
                    tasks TEXT NOT NULL DEFAULT '{}',
                    messages_seen TEXT NOT NULL DEFAULT '[]',
                    updated_at INTEGER NOT NULL,
                    PRIMARY KEY (player_id, party_id),
                    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
                    FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE
                );
            `);
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
