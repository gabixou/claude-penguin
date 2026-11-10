// Musica de fundo por sala — dados e faixas do cliente web original
// (gopenguin.lol /data/room-music.json + /data/music.json + /swf/music/<id>/).
// Semantica identica ao gp_audio.c: cada programa tem clips e uma ordem
// (random | sequence | path | single) que decide a proxima faixa ao fim.
import MUSIC from './music.json';
import ROOM_MUSIC from './room-music.json';

class MusicPlayer {
    constructor() {
        this.audio = null;
        this.programId = null;
        this.step = 0;
        this._unlocked = false;
        const unlock = () => {
            this._unlocked = true;
            if (this.audio && this.audio.paused) this.audio.play().catch(() => {});
        };
        window.addEventListener('pointerdown', unlock);
        window.addEventListener('keydown', unlock);
    }

    // mesma logica de pick() do gp_audio.c
    _pickClip(prog) {
        const count = prog.clips.length;
        if (!count) return null;
        const order = prog.order || 'single';
        let index = 0;
        if (order === 'random') {
            index = this.step ? Math.floor(Math.random() * count) : 0;
        } else if (order === 'sequence') {
            index = this.step % count;
        } else if (order === 'path') {
            const path = prog.path || [];
            const restart = prog.restart || 0;
            if (!path.length) return null;
            const pos = this.step < path.length
                ? this.step
                : restart + (this.step - path.length) % (path.length - restart);
            const clip = path[pos];
            if (typeof clip !== 'number' || clip < 0 || clip >= count) return null;
            index = clip;
        }
        return prog.clips[index] || null;
    }

    play(roomKey) {
        const id = ROOM_MUSIC[roomKey] || null;
        const prog = id ? MUSIC[id] : null;
        if (!prog) { this.stop(); return; }
        if (String(id) === this.programId) return;
        this.programId = String(id);
        this.step = 0;
        this._startClip(prog);
    }

    _startClip(prog) {
        const clip = this._pickClip(prog);
        if (!clip) { this.stop(); return; }
        if (!this.audio) this.audio = new Audio();
        this.audio.volume = prog.volume ?? 0.5;
        this.audio.onended = () => {
            if (this.programId == null) return;
            this.step++;
            const p = MUSIC[this.programId];
            if (p) this._startClip(p);
        };
        this.audio.src = `/assets/music/${this.programId}/${clip}`;
        this.audio.play().catch(() => {});
    }

    stop() {
        this.programId = null;
        if (this.audio) {
            this.audio.onended = null;
            this.audio.pause();
            this.audio.removeAttribute('src');
            this.audio.load();
        }
    }
}

export const musicPlayer = new MusicPlayer();
if (typeof window !== 'undefined') window.__musicPlayer = musicPlayer; // debug/probes
