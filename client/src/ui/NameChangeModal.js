// NameChangeModal.js — modal para renomear o pinguim (uma única vez)
import Phaser from 'phaser';
import { WORLD_W, WORLD_H } from '../display.js';

const DEPTH = 30000000;

export default class NameChangeModal {
    constructor(scene) {
        this.scene = scene;
        this.container = null;
        this.dim = null;
        this.username = '';
        this.usernameInput = null;
        this.errorText = null;
    }

    get isOpen() { return !!this.container; }

    open() {
        if (this.isOpen) this.close();
        this.username = this.scene.network?.username || '';
        this._build();
    }

    close() {
        if (this.dim) { this.dim.destroy(); this.dim = null; }
        if (this.container) { this.container.destroy(true); this.container = null; }
        this.usernameInput?.remove();
        this.usernameInput = null;
    }

    _build() {
        const scene = this.scene;
        const cx = WORLD_W / 2, cy = WORLD_H / 2;
        const w = 300, h = 200;

        // Fundo escurecido
        this.dim = scene.add.rectangle(cx, cy, WORLD_W, WORLD_H, 0x000000, 0.6)
            .setOrigin(0.5).setDepth(DEPTH - 1).setInteractive();
        this.dim.on('pointerdown', () => this.close());

        // Container principal
        const cont = scene.add.container(0, 0).setDepth(DEPTH);
        this.container = cont;

        // Fundo do modal
        const bg = scene.add.graphics();
        bg.fillStyle(0xf8f8f8, 1);
        bg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 12);
        bg.lineStyle(2, 0x0072ce, 0.8);
        bg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 12);
        cont.add(bg);

        // Título
        cont.add(scene.add.text(cx, cy - h / 2 + 20, 'Rename Penguin', {
            fontFamily: 'GoPenguin, Arial, sans-serif',
            fontSize: '16px',
            fontStyle: 'bold',
            color: '#0072ce',
        }).setOrigin(0.5));

        // Aviso de uso único
        cont.add(scene.add.text(cx, cy - h / 2 + 42, 'You can only change your name once!', {
            fontFamily: 'GoPenguin, Arial, sans-serif',
            fontSize: '10px',
            color: '#ff6600',
            align: 'center',
        }).setOrigin(0.5));

        // Input de username (DOM)
        this.usernameInput = document.createElement('input');
        this.usernameInput.type = 'text';
        this.usernameInput.value = this.username;
        this.usernameInput.placeholder = 'New username';
        this.usernameInput.maxLength = 16;
        Object.assign(this.usernameInput.style, {
            position: 'fixed',
            left: (cx - 110) + 'px',
            top: (cy - 10) + 'px',
            width: '220px',
            height: '30px',
            fontSize: '14px',
            fontFamily: 'GoPenguin, Arial, sans-serif',
            padding: '4px 8px',
            border: '2px solid #0072ce',
            borderRadius: '6px',
            outline: 'none',
            zIndex: '100000',
            boxSizing: 'border-box',
        });
        this.usernameInput.addEventListener('input', (e) => {
            this.username = e.target.value;
            this._validate();
        });
        this.usernameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._submit();
            if (e.key === 'Escape') this.close();
        });
        document.body.appendChild(this.usernameInput);

        // Botões — mesmo padrão do CreatePlayerModal (azul #0072ce + stroke
        // branco, cantos 6) para manter a identidade visual do jogo
        const btnY = cy + h / 2 - 38;
        const mkBtn = (x, label, color, cb) => {
            const btn = scene.add.container(x, btnY);
            const bg = scene.add.graphics();
            bg.fillStyle(color, 1);
            bg.fillRoundedRect(-55, -14, 110, 28, 6);
            bg.lineStyle(2, 0xffffff, 0.8);
            bg.strokeRoundedRect(-55, -14, 110, 28, 6);
            const txt = scene.add.text(0, 0, label, {
                fontFamily: 'GoPenguin, Arial, sans-serif',
                fontSize: '13px',
                fontStyle: 'bold',
                color: '#ffffff',
            }).setOrigin(0.5);
            btn.add([bg, txt]);
            btn.setSize(110, 28);
            btn.setInteractive(new Phaser.Geom.Rectangle(-55, -14, 110, 28), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
            btn.on('pointerdown', cb);
            cont.add(btn);
            return { btn, bg, txt };
        };
        const confirm = mkBtn(cx - 62, 'Save', 0x0072ce, () => this._submit());
        this._confirmBtn = confirm.btn;
        this._confirmBtnBg = confirm.bg;
        this._confirmBtnText = confirm.txt;
        mkBtn(cx + 62, 'Cancel', 0x999999, () => this.close());

        // Texto de erro
        this.errorText = scene.add.text(cx, cy + h / 2 - 10, '', {
            fontFamily: 'GoPenguin, Arial, sans-serif',
            fontSize: '10px',
            color: '#ff4444',
            align: 'center',
        }).setOrigin(0.5);
        cont.add(this.errorText);

        this._validate();
        this.usernameInput.focus();
        this.usernameInput.select();
    }

    _validate() {
        const trimmed = this.username?.trim() || '';
        const valid = trimmed.length >= 3 && trimmed.length <= 16 && trimmed !== this.scene.network?.username;
        this._confirmBtn.setAlpha(valid ? 1 : 0.5);
        return valid;
    }

    _submit() {
        if (this._submitting) return;
        if (!this._validate()) {
            this.errorText.setText('Invalid username or same as current');
            return;
        }

        const username = this.username.trim();
        
        // Loading state
        this._submitting = true;
        this._setLoading(true);
        this.errorText.setText('');
        
        this.scene.network?.renamePlayer(username);
        
        // Timeout de segurança
        this._submitTimeout = setTimeout(() => {
            this._submitting = false;
            this._setLoading(false);
            this.errorText.setText('Connection timeout. Please try again.');
        }, 10000);
    }

    _setLoading(loading) {
        if (this._confirmBtn) {
            this._confirmBtn.setAlpha(loading ? 0.7 : 1);
        }
        if (this._confirmBtnText) {
            this._confirmBtnText.setText(loading ? 'Saving...' : 'Save');
        }
        if (this._confirmBtnBg) {
            this._confirmBtnBg.clear();
            this._confirmBtnBg.fillStyle(loading ? 0x666666 : 0x0072ce, 1);
            this._confirmBtnBg.fillRoundedRect(-55, -14, 110, 28, 6);
            this._confirmBtnBg.lineStyle(2, 0xffffff, 0.8);
            this._confirmBtnBg.strokeRoundedRect(-55, -14, 110, 28, 6);
        }
    }

    onServerResponse(success, message = '') {
        this._submitting = false;
        if (this._submitTimeout) {
            clearTimeout(this._submitTimeout);
            this._submitTimeout = null;
        }
        this._setLoading(false);
        if (success) {
            this.close();
        } else if (message) {
            this.errorText.setText(message);
        }
    }
}
