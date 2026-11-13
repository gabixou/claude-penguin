// BuddyPanel.js - janela "Buddy List" no estilo Club Penguin 2008
// (referencia: gopenguin.lol). Janela azul com 3 botoes no topo que
// trocam a lista: Buddies (amigos) | In Room (pinguins na sala) |
// Blocked (ignorados). Pets NAO ficam aqui — serao adotados no Pet Shop.

const CSS = `
.cp-buddy { position:fixed; z-index:99998; width:330px; max-height:460px;
  background:#eaf2fb; border:3px solid #1c5f9e; border-radius:8px;
  box-shadow:0 6px 24px rgba(0,0,0,.4); font-family:Arial,sans-serif;
  display:flex; flex-direction:column; overflow:hidden; }
.cp-buddy.hidden { display:none; }
.cp-buddy-head { display:flex; align-items:center; justify-content:space-between;
  background:linear-gradient(#5aa7e8,#2b6cb0); color:#fff; padding:6px 10px;
  font-weight:700; font-size:14px; }
.cp-buddy-head .x { cursor:pointer; font-size:15px; padding:0 4px; }
.cp-buddy-tabs { display:flex; gap:4px; padding:6px 8px 0; }
.cp-buddy-tab { flex:1; text-align:center; padding:5px 0; font-size:12px; font-weight:700;
  color:#fff; background:linear-gradient(#7db9ec,#3a7cc4); border:1px solid #1c5f9e;
  border-radius:6px 6px 0 0; cursor:pointer; text-shadow:0 1px 1px rgba(0,0,0,.3); }
.cp-buddy-tab.on { background:linear-gradient(#eaf2fb,#cfe2f5); color:#1c5f9e;
  text-shadow:none; border-bottom-color:#eaf2fb; }
.cp-buddy-body { background:#f6faff; border:1px solid #b8cfe8; margin:0 8px 8px;
  border-radius:0 0 6px 6px; overflow-y:auto; min-height:150px; max-height:380px; }
.cp-buddy-row { display:flex; align-items:center; gap:7px; padding:5px 8px;
  border-bottom:1px solid #e2ecf7; font-size:13px; }
.cp-buddy-row:hover { background:#e8f1fc; }
.cp-buddy-row .name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  color:#12365e; font-weight:600; }
.cp-buddy-dot { width:9px; height:9px; border-radius:50%; flex:none; }
.cp-buddy-dot.on { background:#2fb344; box-shadow:0 0 3px #2fb344; }
.cp-buddy-dot.off { background:#aab6c4; }
.cp-buddy-btn { font-size:11px; font-weight:700; padding:3px 9px; border-radius:5px;
  border:1px solid #1c5f9e; background:linear-gradient(#fff,#dcebfa);
  color:#1c5f9e; cursor:pointer; white-space:nowrap; }
.cp-buddy-btn:hover { background:linear-gradient(#eaf2fb,#cfe2f5); }
.cp-buddy-btn.danger { border-color:#a33; color:#a33; }
.cp-buddy-sec { font-size:10px; font-weight:700; color:#4a7aa8; text-transform:uppercase;
  padding:7px 8px 3px; letter-spacing:.5px; }
.cp-buddy-empty { color:#7d97b5; font-size:12px; text-align:center; padding:18px 0; }
.cp-buddy-note { font-size:10px; color:#7d97b5; padding:5px 8px; border-top:1px solid #e2ecf7; }
`;

export default class BuddyPanel {
    constructor(scene) {
        this.scene = scene;
        this.open_ = false;
        this.tab = 'buddies';
        this._build();
        scene.events.on('social-update', () => { if (this.open_) this.render(); });
        scene.events.on('buddy-request', () => { if (this.open_) this.render(); });
        scene.events.on('player-joined', () => { if (this.open_ && this.tab === 'room') this.render(); });
        scene.events.on('player-left', () => { if (this.open_ && this.tab === 'room') this.render(); });
        scene.events.once('shutdown', () => this.destroy());
    }

    _build() {
        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);
        this.root = document.createElement('div');
        this.root.className = 'cp-buddy hidden';
        this.root.innerHTML = `
            <div class="cp-buddy-head"><span>Buddy List</span><span class="x">✕</span></div>
            <div class="cp-buddy-tabs">
                <div class="cp-buddy-tab on" data-tab="buddies">Buddies</div>
                <div class="cp-buddy-tab" data-tab="room">In Room</div>
                <div class="cp-buddy-tab" data-tab="blocked">Blocked</div>
            </div>
            <div class="cp-buddy-body"></div>
            <div class="cp-buddy-note">Clique num pinguim para adicionar aos buddies</div>`;
        document.body.appendChild(this.root);
        this.body = this.root.querySelector('.cp-buddy-body');
        this.root.querySelector('.x').onclick = () => this.close();
        this.root.querySelectorAll('.cp-buddy-tab').forEach((t) => {
            t.onclick = () => { this.tab = t.dataset.tab; this._markTab(); this.render(); };
        });
    }

    _markTab() {
        this.root.querySelectorAll('.cp-buddy-tab').forEach((t) => {
            t.classList.toggle('on', t.dataset.tab === this.tab);
        });
    }

    toggle() { this.open_ ? this.close() : this.open(); }
    open() {
        this.open_ = true;
        this.root.classList.remove('hidden');
        this.root.style.left = '10px';
        this.root.style.bottom = '70px';
        this.scene.network?.getSocial();
        this.render();
    }
    close() { this.open_ = false; this.root.classList.add('hidden'); }
    destroy() { this.root?.remove(); }

    render() {
        if (!this.open_) return;
        const s = this.scene.network?.social || {};
        if (this.tab === 'room') this._renderRoom(s);
        else if (this.tab === 'blocked') this._renderBlocked(s);
        else this._renderBuddies(s);
    }

    _row(html) {
        const d = document.createElement('div');
        d.className = 'cp-buddy-row';
        d.innerHTML = html;
        return d;
    }
    _btn(label, cls, fn) {
        const b = document.createElement('button');
        b.className = 'cp-buddy-btn ' + cls;
        b.textContent = label;
        b.onclick = (e) => { e.stopPropagation(); fn(); };
        return b;
    }
    _empty(msg) {
        const d = document.createElement('div');
        d.className = 'cp-buddy-empty';
        d.textContent = msg;
        return d;
    }
    _sec(text) {
        const d = document.createElement('div');
        d.className = 'cp-buddy-sec';
        d.textContent = text;
        return d;
    }

    // ---------- BUDDIES ----------
    _renderBuddies(s) {
        const net = this.scene.network;
        this.body.innerHTML = '';
        const received = (s.requests || []).filter((r) => r.direction === 'received');
        const sent = (s.requests || []).filter((r) => r.direction === 'sent');
        if (received.length) {
            this.body.appendChild(this._sec('Buddy Requests'));
            for (const r of received) {
                const row = this._row(`<span class="name">${esc(r.username)}</span>`);
                row.appendChild(this._btn('Accept', '', () => net.buddyAccept(r.playerId)));
                row.appendChild(this._btn('Decline', 'danger', () => net.buddyDecline(r.playerId)));
                this.body.appendChild(row);
            }
        }
        if (sent.length) {
            this.body.appendChild(this._sec('Pending'));
            for (const r of sent) {
                const row = this._row(`<span class="name">${esc(r.username)}</span>`);
                row.appendChild(this._btn('Cancel', '', () => net.buddyCancel(r.playerId)));
                this.body.appendChild(row);
            }
        }
        this.body.appendChild(this._sec(`Buddies (${(s.buddies || []).length})`));
        if (!(s.buddies || []).length) this.body.appendChild(this._empty('No buddies yet.'));
        for (const b of s.buddies || []) {
            const row = this._row(
                `<span class="cp-buddy-dot ${b.online ? 'on' : 'off'}"></span>` +
                `<span class="name">${esc(b.username)}</span>` +
                `<span style="font-size:10px;color:#7d97b5">${b.online ? 'online' : 'offline'}</span>`
            );
            row.appendChild(this._btn('Remove', 'danger', () => net.buddyRemove(b.playerId)));
            this.body.appendChild(row);
        }
    }

    // ---------- IN ROOM ----------
    _renderRoom(s) {
        this.body.innerHTML = '';
        const scene = this.scene;
        const net = scene.network;
        const players = [];
        if (scene.localPlayer) players.push({ p: scene.localPlayer, self: true });
        for (const p of scene.remotePlayers?.values() || []) players.push({ p, self: false });
        this.body.appendChild(this._sec(`Penguins in this room (${players.length})`));
        if (!players.length) this.body.appendChild(this._empty('Nobody here.'));
        for (const { p, self } of players) {
            const isBuddy = net?.isBuddy?.(p.playerId);
            const isBlocked = net?.isIgnored?.(p.playerId);
            const row = this._row(
                `<span class="cp-buddy-dot on"></span>` +
                `<span class="name">${esc(p.username)}${self ? ' (you)' : ''}</span>`
            );
            if (!self) {
                if (isBlocked) {
                    row.appendChild(this._btn('Unblock', '', () => net.ignoreRemove(p.playerId)));
                } else {
                    if (!isBuddy) row.appendChild(this._btn('Buddy', '', () => net.buddyAdd(p.username)));
                    row.appendChild(this._btn('Block', 'danger', () => net.ignoreAdd(p.playerId)));
                }
            }
            this.body.appendChild(row);
        }
    }

    // ---------- BLOCKED ----------
    _renderBlocked(s) {
        this.body.innerHTML = '';
        const net = this.scene.network;
        this.body.appendChild(this._sec(`Blocked players (${(s.ignores || []).length})`));
        if (!(s.ignores || []).length) this.body.appendChild(this._empty('No blocked players.'));
        for (const i of s.ignores || []) {
            const row = this._row(`<span class="name">${esc(i.username)}</span>`);
            row.appendChild(this._btn('Unblock', '', () => net.ignoreRemove(i.playerId)));
            this.body.appendChild(row);
        }
    }
}

function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
