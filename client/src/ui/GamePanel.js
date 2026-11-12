// GamePanel.js — painel DOM dos sistemas de jogo (Fase 6):
// amigos, ignorados, correio, selos, iglu, puffles, jogos de mesa,
// card-jitsu/EPF, códigos de resgate, configurações e jornal.
// Fala com o servidor via ops dedicadas (FRIEND_*, MAIL_*, etc.).

const CSS = `
.cp-game{position:fixed;inset:0;z-index:90000;display:flex;align-items:center;justify-content:center;background:rgba(10,20,40,.6);font-family:Arial,sans-serif;}
.cp-game .box{width:720px;max-width:94vw;max-height:86vh;background:#f4f7fb;border:3px solid #0072ce;border-radius:14px;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.45);}
.cp-game .head{display:flex;align-items:center;padding:10px 14px;border-bottom:2px solid #d5e2f0;}
.cp-game .head h2{margin:0;font-size:15px;color:#0072ce;flex:1;}
.cp-game .head button{background:#0072ce;color:#fff;border:0;border-radius:7px;padding:5px 12px;font-weight:700;cursor:pointer;}
.cp-game .tabs{display:flex;flex-wrap:wrap;gap:4px;padding:8px 12px 0;}
.cp-game .tabs button{padding:6px 10px;font-size:11px;font-weight:700;color:#445;border:1px solid #c4d2e4;border-radius:8px 8px 0 0;background:#e3ebf5;cursor:pointer;}
.cp-game .tabs button.on{background:#fff;color:#0072ce;border-bottom-color:#fff;}
.cp-game .body{flex:1;overflow:auto;padding:12px 14px;background:#fff;border-top:1px solid #d5e2f0;min-height:280px;}
.cp-game table{width:100%;border-collapse:collapse;font-size:12px;}
.cp-game th,.cp-game td{text-align:left;padding:5px 7px;border-bottom:1px solid #e4ecf5;}
.cp-game th{color:#667;font-size:10px;text-transform:uppercase;}
.cp-game input,.cp-game select,.cp-game textarea{padding:6px 8px;font-size:12px;border:1px solid #9db8d2;border-radius:6px;margin:2px 4px 2px 0;}
.cp-game button.act{padding:5px 10px;font-size:11px;font-weight:700;border:1px solid #9db8d2;border-radius:7px;background:#eef4fb;cursor:pointer;color:#234;}
.cp-game button.act:hover{background:#dbe9f7;}
.cp-game button.danger{background:#fdeaea;color:#a02c2c;border-color:#f0c0c0;}
.cp-game .row{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-bottom:8px;}
.cp-game .msg{font-size:11px;color:#c0392b;min-height:14px;}
.cp-game .ok{color:#2e8b57;font-size:11px;}
.cp-game .card{border:1px solid #d5e2f0;border-radius:9px;padding:9px 11px;margin-bottom:8px;background:#fbfdff;}
.cp-game .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:6px;}
.cp-game .stamp{border:1px solid #c4d2e4;border-radius:8px;padding:8px;text-align:center;font-size:11px;background:#fff;}
.cp-game .stamp.have{background:#e8f6ec;border-color:#7cc493;}
.cp-game .bar{height:8px;background:#e4ecf5;border-radius:4px;overflow:hidden;margin-top:3px;}
.cp-game .bar i{display:block;height:100%;background:#4a9eff;}
.cp-game pre{white-space:pre-wrap;font-size:12px;background:#f4f7fb;padding:8px;border-radius:7px;}
`;

const TABS = [
    ['friends', 'Amigos'], ['ignore', 'Ignorados'], ['mail', 'Correio'],
    ['stamps', 'Selos'], ['igloo', 'Iglu'], ['puffles', 'Puffles'],
    ['games', 'Jogos'], ['epf', 'EPF'], ['party', 'Festa'], ['redeem', 'Resgatar'],
    ['settings', 'Ajustes'], ['news', 'Jornal'],
];

let _styleDone = false;
function ensureStyle() {
    if (typeof document === 'undefined' || _styleDone) return;
    _styleDone = true;
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (ts) => ts ? new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

export default class GamePanel {
    constructor(scene) {
        this.scene = scene;
        this.el = null;
        this.tab = 'friends';
        this._pending = null; // {resolve, reject, timer}
        this._mailTo = null;
        // respostas assíncronas (notificações push)
        this._unsubs = [];
    }

    get isOpen() { return !!this.el; }

    open(tab = 'friends', opts = {}) {
        this.close();
        ensureStyle();
        this.tab = tab;
        this._mailTo = opts.mailTo || null;
        this._build();
        this._load();
    }

    close() {
        this.el?.remove();
        this.el = null;
        this._pending?.reject?.(new Error('fechado'));
        this._pending = null;
        this._unsubs.forEach((u) => u());
        this._unsubs = [];
    }

    // ---------- rede ----------

    // Envia op e espera GAME_OK/GAME_ERROR (ou op dedicada).
    call(op, data = {}) {
        const net = this.scene.network;
        if (!net?.isConnected) return Promise.reject(new Error('Sem conexão'));
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this._pending = null;
                reject(new Error('Timeout'));
            }, 8000);
            this._pending = { resolve, reject, timer };
            // um par de listeners por painel (events.on devolve o emissor,
            // nao a funcao: o off antigo nunca removia nada e eles vazavam)
            if (!this._netHooked) {
                const ok = (d) => this._resolvePending(d);
                const err = (d) => this._rejectPending(d);
                this.scene.events.on('packet-GAME_OK', ok);
                this.scene.events.on('packet-GAME_ERROR', err);
                this._netHooked = true;
                this._unsubs.push(() => {
                    this.scene.events.off('packet-GAME_OK', ok);
                    this.scene.events.off('packet-GAME_ERROR', err);
                    this._netHooked = false;
                });
            }
            net.send(op, data);
        });
    }

    _resolvePending(data) {
        const p = this._pending; if (!p) return;
        this._pending = null; clearTimeout(p.timer);
        p.resolve(data || {});
    }
    _rejectPending(data) {
        const p = this._pending; if (!p) return;
        this._pending = null; clearTimeout(p.timer);
        p.reject(new Error(data?.error || 'Erro do servidor'));
    }

    // ---------- UI ----------

    _build() {
        this.el = document.createElement('div');
        this.el.className = 'cp-game';
        const box = document.createElement('div');
        box.className = 'box';
        const head = document.createElement('div');
        head.className = 'head';
        head.innerHTML = '<h2>Sistemas</h2>';
        const x = document.createElement('button');
        x.textContent = '✕';
        x.onclick = () => this.close();
        head.appendChild(x);
        box.appendChild(head);
        const tabs = document.createElement('div');
        tabs.className = 'tabs';
        for (const [id, label] of TABS) {
            const b = document.createElement('button');
            b.textContent = label;
            b.className = id === this.tab ? 'on' : '';
            b.onclick = () => { this.tab = id; this._buildTabs(); this._load(); };
            tabs.appendChild(b);
        }
        box.appendChild(tabs);
        this.bodyEl = document.createElement('div');
        this.bodyEl.className = 'body';
        box.appendChild(this.bodyEl);
        this.el.appendChild(box);
        document.body.appendChild(this.el);
        this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
    }

    _buildTabs() {
        this.el?.querySelectorAll('.tabs button').forEach((b, i) => {
            b.classList.toggle('on', TABS[i][0] === this.tab);
        });
    }

    _html(html) { this.bodyEl.innerHTML = html; }
    _msg(t, ok = false) {
        let m = this.bodyEl.querySelector('.msg');
        if (!m) { m = document.createElement('div'); m.className = 'msg'; this.bodyEl.prepend(m); }
        m.textContent = t; m.classList.toggle('ok', ok);
    }

    async _load() {
        this._msg('');
        try {
            const fn = this['_tab_' + this.tab];
            if (fn) await fn.call(this);
        } catch (e) {
            this._msg(e.message || 'Erro', false);
        }
    }

    // ---------- abas ----------

    async _tab_friends() {
        const r = await this.call('FRIEND_LIST');
        const rows = (r.friends || []).map((f) => `<tr>
            <td>${esc(f.username)} ${f.online ? '<span class="ok">● online</span>' : ''}</td>
            <td>${fmt(f.since)}</td>
            <td><button class="act danger" data-unfriend="${esc(f.playerId)}">Remover</button></td></tr>`).join('');
        this._html(`
            <div class="row">
                <input id="gp-f-add" placeholder="username do amigo">
                <button class="act" id="gp-f-btn">Adicionar</button>
            </div>
            <table><thead><tr><th>Amigo</th><th>Desde</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan=3>Nenhum amigo ainda</td></tr>'}</tbody></table>`);
        this.bodyEl.querySelector('#gp-f-btn').onclick = async () => {
            const u = this.bodyEl.querySelector('#gp-f-add').value.trim();
            if (!u) return;
            try { await this.call('FRIEND_ADD', { username: u }); this._msg('Amigo adicionado', true); this._load(); }
            catch (e) { this._msg(e.message); }
        };
        this.bodyEl.querySelectorAll('[data-unfriend]').forEach((b) => b.onclick = async () => {
            await this.call('FRIEND_REMOVE', { playerId: b.dataset.unfriend }); this._load();
        });
    }

    async _tab_ignore() {
        const r = await this.call('IGNORE_LIST');
        const rows = (r.ignores || []).map((f) => `<tr>
            <td>${esc(f.username)}</td><td>${fmt(f.since)}</td>
            <td><button class="act" data-unignore="${esc(f.playerId)}">Remover</button></td></tr>`).join('');
        this._html(`
            <div class="row">
                <input id="gp-i-add" placeholder="username para ignorar">
                <button class="act" id="gp-i-btn">Ignorar</button>
            </div>
            <table><thead><tr><th>Jogador</th><th>Desde</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan=3>Ninguém ignorado</td></tr>'}</tbody></table>`);
        this.bodyEl.querySelector('#gp-i-btn').onclick = async () => {
            const u = this.bodyEl.querySelector('#gp-i-add').value.trim();
            if (!u) return;
            try { await this.call('IGNORE_ADD', { username: u }); this._msg('Jogador ignorado', true); this._load(); }
            catch (e) { this._msg(e.message); }
        };
        this.bodyEl.querySelectorAll('[data-unignore]').forEach((b) => b.onclick = async () => {
            await this.call('IGNORE_REMOVE', { playerId: b.dataset.unignore }); this._load();
        });
    }

    async _tab_mail() {
        const r = await this.call('MAIL_LIST');
        const mails = r.mail || [];
        const to = this._mailTo;
        this._mailTo = null;
        this._html(`
            <div class="row">
                <button class="act" id="gp-m-send">✉ Enviar cartão-postal</button>
                ${r.unread ? `<span class="ok">${r.unread} não lida(s)</span>` : ''}
            </div>
            <div id="gp-mail-compose" class="hidden"></div>
            ${mails.map((m) => `<div class="card">
                <b>${esc(m.subject || '(sem assunto)')}</b> — de ${esc(m.senderName)} ${fmt(m.createdAt)}
                ${m.readAt ? '' : ' <span class="ok">● nova</span>'}
                ${m.coins ? ` · ${m.coins} coins` : ''}${m.itemId ? ` · item #${m.itemId}` : ''}
                <div style="margin-top:4px"><button class="act" data-read="${m.id}">Ler</button>
                <button class="act danger" data-del="${m.id}">Apagar</button></div>
                <div class="gp-mail-body" id="gp-mail-${m.id}" style="display:none"></div>
            </div>`).join('') || '<p>Nenhuma carta.</p>'}`);
        this.bodyEl.querySelector('#gp-m-send').onclick = () => this._mailCompose(to);
        this.bodyEl.querySelectorAll('[data-read]').forEach((b) => b.onclick = async () => {
            const d = await this.call('MAIL_READ', { id: Number(b.dataset.read) });
            const box = this.bodyEl.querySelector(`#gp-mail-${b.dataset.read}`);
            if (box) { box.style.display = 'block'; box.innerHTML = `<pre>${esc(d.mail?.body || '')}</pre>`; }
            this._load();
        });
        this.bodyEl.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
            await this.call('MAIL_DELETE', { id: Number(b.dataset.del) }); this._load();
        });
    }

    _mailCompose(prefillTo) {
        const c = this.bodyEl.querySelector('#gp-mail-compose');
        c.classList.remove('hidden');
        c.innerHTML = `<div class="card">
            <input id="gp-ms-to" placeholder="para (username)" value="${esc(prefillTo || '')}" style="width:200px">
            <input id="gp-ms-subj" placeholder="assunto" style="width:300px">
            <textarea id="gp-ms-body" rows="3" style="width:100%" placeholder="mensagem"></textarea>
            <div class="row">
                <button class="act" id="gp-ms-send">Enviar</button>
                <button class="act" id="gp-ms-cancel">Cancelar</button>
            </div></div>`;
        c.querySelector('#gp-ms-cancel').onclick = () => c.classList.add('hidden');
        c.querySelector('#gp-ms-send').onclick = async () => {
            try {
                await this.call('MAIL_SEND', {
                    to: c.querySelector('#gp-ms-to').value.trim(),
                    subject: c.querySelector('#gp-ms-subj').value,
                    body: c.querySelector('#gp-ms-body').value,
                });
                this._msg('Carta enviada!', true); this._load();
            } catch (e) { this._msg(e.message); }
        };
    }

    async _tab_stamps() {
        const r = await this.call('STAMP_LIST');
        const owned = new Set((r.stamps || []).map((s) => s.stampId));
        const cells = (r.catalog || []).map((id) =>
            `<div class="stamp ${owned.has(id) ? 'have' : ''}">${owned.has(id) ? '★' : '·'} ${id}</div>`).join('');
        this._html(`
            <div class="row">
                <span>${owned.size} selo(s)</span>
                <input id="gp-st-id" placeholder="id do selo" type="number" style="width:90px">
                <button class="act" id="gp-st-btn">Registrar selo</button>
            </div>
            <div class="grid">${cells}</div>`);
        this.bodyEl.querySelector('#gp-st-btn').onclick = async () => {
            try { await this.call('STAMP_EARN', { stampId: Number(this.bodyEl.querySelector('#gp-st-id').value) }); this._msg('Selo registrado', true); this._load(); }
            catch (e) { this._msg(e.message); }
        };
    }

    async _tab_igloo() {
        const r = await this.call('IGLOO_GET');
        const ig = r.igloo || {};
        this._html(`
            <div class="row">
                <input id="gp-ig-name" placeholder="nome do iglu" value="${esc(ig.name || '')}" style="width:180px">
                <input id="gp-ig-theme" placeholder="tema" value="${esc(ig.theme || '')}" style="width:140px">
                <input id="gp-ig-floor" placeholder="floor item id" type="number" value="${ig.floorItemId ?? ''}" style="width:110px">
                <button class="act" id="gp-ig-save">Salvar</button>
            </div>
            <h4 style="margin:8px 0 4px">Mobília (${(ig.furniture || []).length})</h4>
            <table><thead><tr><th>Slot</th><th>Item</th><th></th></tr></thead><tbody>
            ${(ig.furniture || []).map((f) => `<tr><td>${f.slot}</td><td>${f.itemId}</td>
                <td><button class="act danger" data-furn="${f.slot}">Remover</button></td></tr>`).join('') || '<tr><td colspan=3>Vazio</td></tr>'}
            </tbody></table>
            <div class="row" style="margin-top:8px">
                <input id="gp-ig-slot" placeholder="slot" type="number" style="width:80px">
                <input id="gp-ig-item" placeholder="item id" type="number" style="width:110px">
                <button class="act" id="gp-ig-furn">Colocar móvel</button>
            </div>`);
        this.bodyEl.querySelector('#gp-ig-save').onclick = async () => {
            try {
                await this.call('IGLOO_SET', {
                    name: this.bodyEl.querySelector('#gp-ig-name').value,
                    theme: this.bodyEl.querySelector('#gp-ig-theme').value,
                    floorItemId: this.bodyEl.querySelector('#gp-ig-floor').value === '' ? null : Number(this.bodyEl.querySelector('#gp-ig-floor').value),
                });
                this._msg('Iglu salvo', true); this._load();
            } catch (e) { this._msg(e.message); }
        };
        this.bodyEl.querySelectorAll('[data-furn]').forEach((b) => b.onclick = async () => {
            await this.call('IGLOO_FURNITURE_SET', { slot: Number(b.dataset.furn), itemId: null }); this._load();
        });
        this.bodyEl.querySelector('#gp-ig-furn').onclick = async () => {
            try {
                await this.call('IGLOO_FURNITURE_SET', {
                    slot: Number(this.bodyEl.querySelector('#gp-ig-slot').value),
                    itemId: Number(this.bodyEl.querySelector('#gp-ig-item').value),
                });
                this._msg('Móvel colocado', true); this._load();
            } catch (e) { this._msg(e.message); }
        };
    }

    async _tab_puffles() {
        const r = await this.call('PUFFLE_LIST');
        const puffles = r.puffles || [];
        const statBar = (v) => `<div class="bar"><i style="width:${v}%"></i></div>`;
        this._html(`
            <div class="row">
                <select id="gp-pf-sp">${['aurora','cosmic','crimson','lava','mint','orange','patrol','pickle','skull','tundra'].map((s) => `<option>${s}</option>`).join('')}</select>
                <input id="gp-pf-name" placeholder="nome" style="width:120px">
                <button class="act" id="gp-pf-adopt">Adotar puffle</button>
            </div>
            ${puffles.map((p) => `<div class="card">
                <b>${esc(p.name)}</b> <span style="color:#888">(${p.species})</span>
                <div class="grid" style="margin-top:6px">
                    ${['hunger','happiness','energy','sleep','clean'].map((s) => `<div style="font-size:10px">${s}<div class="bar"><i style="width:${p[s]}%"></i></div></div>`).join('')}
                </div>
                <div class="row" style="margin-top:6px">
                    <button class="act" data-care="${p.id}:feed">Alimentar</button>
                    <button class="act" data-care="${p.id}:play">Brincar</button>
                    <button class="act" data-care="${p.id}:clean">Limpar</button>
                    <button class="act" data-care="${p.id}:sleep">Dormir</button>
                    <button class="act danger" data-del="${p.id}">Soltar</button>
                </div></div>`).join('') || '<p>Nenhum puffle. Adote um!</p>'}`);
        this.bodyEl.querySelector('#gp-pf-adopt').onclick = async () => {
            try {
                await this.call('PUFFLE_ADOPT', {
                    species: this.bodyEl.querySelector('#gp-pf-sp').value,
                    name: this.bodyEl.querySelector('#gp-pf-name').value || 'Puffle',
                });
                this._msg('Puffle adotado!', true); this._load();
            } catch (e) { this._msg(e.message); }
        };
        this.bodyEl.querySelectorAll('[data-care]').forEach((b) => b.onclick = async () => {
            const [id, action] = b.dataset.care.split(':');
            try { await this.call('PUFFLE_CARE', { puffleId: Number(id), action }); this._load(); }
            catch (e) { this._msg(e.message); }
        });
        this.bodyEl.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
            await this.call('PUFFLE_DELETE', { puffleId: Number(b.dataset.del) }); this._load();
        });
    }

    // Jogos de mesa: as regras rodam no servidor (tables.js). "Procurar
    // oponente" senta no lobby (o proximo que entrar joga com voce);
    // "Contra o computador" comeca na hora. Nas salas, as mesas da Book Room
    // (Mancala), Lodge/Attic (Find Four) e Dojo (Card-Jitsu) tambem abrem.
    async _tab_games() {
        let ninja = null;
        try { ninja = await this.call('CARDJITSU_STATE'); } catch { /* opcional */ }
        const games = [
            ['four', 'Find Four', 'Ligue 4 fichas em linha antes do oponente.', 'Ski Lodge e Lodge Attic'],
            ['mancala', 'Mancala', 'Semeie as pedras e termine com mais na sua loja.', 'Book Room'],
            ['treasure', 'Treasure Hunt', 'Cooperativo: cavem juntos e dividam o tesouro.', '—'],
            ['card', 'Card-Jitsu', 'Fogo, água e neve — o caminho do ninja.', 'Dojo'],
        ];
        this._html(`<p>Vitória: 25 moedas · empate: 10 · derrota: 5 (metade contra o computador).
            Treasure Hunt paga o que a dupla encontrar.</p>
            ${ninja ? `<div class="card">Card-Jitsu — faixa ${ninja.level} · ${ninja.xp} XP · ${ninja.wins} vitórias / ${ninja.losses} derrotas</div>` : ''}
            ${games.map(([id, name, desc, where]) => `<div class="card">
                <b>${name}</b> <span style="color:#667;font-size:11px">· mesas: ${where}</span>
                <div style="font-size:12px;margin:3px 0 6px">${desc}</div>
                <button class="act" data-play="${id}">Procurar oponente</button>
                <button class="act" data-cpu="${id}">Contra o computador</button></div>`).join('')}
            <p style="font-size:11px;color:#667">Corrida de trenó (Ski Hill): em breve.</p>`);
        const go = (game, cpu) => { this.close(); this.scene.openTableGame?.(game, { cpu }); };
        this.bodyEl.querySelectorAll('[data-play]').forEach((b) => { b.onclick = () => go(b.dataset.play, false); });
        this.bodyEl.querySelectorAll('[data-cpu]').forEach((b) => { b.onclick = () => go(b.dataset.cpu, true); });
    }

    async _tab_epf() {
        const r = await this.call('EPF_STATE');
        const missions = (r.missions || []).map((m) => `<tr>
            <td>${esc(m.title)}</td><td>${m.progress}/${m.target}</td>
            <td>${m.claimed ? 'resgatada' : (m.done ? `<button class="act" data-claim="${m.id}">Resgatar +${m.reward}c</button>` : '')}</td></tr>`).join('');
        this._html(`<p>EPF nível ${r.level} — ${r.xp} XP</p>
            <table><thead><tr><th>Missão</th><th>Progresso</th><th></th></tr></thead><tbody>${missions}</tbody></table>`);
        this.bodyEl.querySelectorAll('[data-claim]').forEach((b) => b.onclick = async () => {
            try { const d = await this.call('EPF_CLAIM', { missionId: b.dataset.claim }); this._msg(`+${d.reward} coins!`, true); this._load(); }
            catch (e) { this._msg(e.message); }
        });
    }

    async _tab_party() {
        const r = await this.call('PARTY_INFO');
        const p = r.party;
        if (!p) { this._html('<p>Nenhuma festa ativa no momento.</p>'); return; }
        const prog = r.progress || {};
        const tasks = Object.entries(prog.tasks || {}).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(JSON.stringify(v))}</td></tr>`).join('');
        this._html(`<div class="card"><b>🎉 ${esc(p.name)}</b>
            <div style="color:#888;font-size:11px">${fmt(p.startAt)} → ${fmt(p.endAt)} ${p.timezone ? `(${esc(p.timezone)})` : ''}</div></div>
            ${Object.keys(prog.tasks || {}).length ? `<h4>Tarefas</h4><table><tbody>${tasks}</tbody></table>` : ''}
            <p style="font-size:11px;color:#888">Mensagens vistas: ${(prog.messagesSeen || []).length}</p>`);
    }

    async _tab_redeem() {
        this._html(`<div class="row">
            <input id="gp-rd-code" placeholder="código de resgate" style="width:220px;text-transform:uppercase">
            <button class="act" id="gp-rd-btn">Resgatar</button></div>
            <p style="font-size:11px;color:#888">Códigos são criados pela administração.</p>`);
        this.bodyEl.querySelector('#gp-rd-btn').onclick = async () => {
            try {
                const d = await this.call('REDEEM', { code: this.bodyEl.querySelector('#gp-rd-code').value });
                this._msg(`Resgatado: ${JSON.stringify(d.reward)}`, true); this._load();
            } catch (e) { this._msg(e.message); }
        };
    }

    async _tab_settings() {
        const r = await this.call('SETTINGS_GET');
        this._html(`<p>Configurações do jogador (JSON):</p>
            <textarea id="gp-set-json" rows="8" style="width:100%">${esc(JSON.stringify(r.settings || {}, null, 2))}</textarea>
            <div class="row"><button class="act" id="gp-set-save">Salvar</button></div>`);
        this.bodyEl.querySelector('#gp-set-save').onclick = async () => {
            try {
                const settings = JSON.parse(this.bodyEl.querySelector('#gp-set-json').value || '{}');
                await this.call('SETTINGS_SET', { settings });
                this._msg('Ajustes salvos', true);
            } catch (e) { this._msg(e.message); }
        };
    }

    async _tab_news() {
        const r = await this.call('NEWSPAPER_GET');
        const news = r.newspaper || [];
        this._html(news.map((n) => `<div class="card"><b>${esc(n.title)}</b>
            <div style="color:#888;font-size:10px">${fmt(n.publishedAt)}</div>
            <div>${esc(n.body)}</div></div>`).join('') || '<p>Jornal vazio.</p>');
    }
}
