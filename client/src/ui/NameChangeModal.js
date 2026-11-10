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

        // Botões
        const btnY = cy + h / 2 - 35;
        
        // Botão confirmar
        const confirmBtn = scene.add.container(cx - 60, btnY);
        const confirmBg = scene.add.graphics();
        confirmBg.fillStyle(0x2fb344, 1);
        confirmBg.fillRoundedRect(-50, -12, 100, 24, 4);
        const confirmText = scene.add.text(0, 0, 'Confirm', {
            fontFamily: 'GoPenguin, Arial, sans-serif',
            fontSize: '12px',
            fontStyle: 'bold',
            color: '#ffffff',
        }).setOrigin(0.5);
        confirmBtn.add([confirmBg, confirmText]);
        confirmBtn.setSize(100, 24);
        confirmBtn.setInteractive(new Phaser.Geom.Rectangle(-50, -12, 100, 24), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        confirmBtn.on('pointerdown', () => this._submit());
        cont.add(confirmBtn);
        this._confirmBtn = confirmBtn;

        // Botão cancelar
        const cancelBtn = scene.add.container(cx + 60, btnY);
        const cancelBg = scene.add.graphics();
        cancelBg.fillStyle(0x999999, 1);
        cancelBg.fillRoundedRect(-50, -12, 100, 24, 4);
        const cancelText = scene.add.text(0, 0, 'Cancel', {
            fontFamily: 'GoPenguin, Arial, sans-serif',
            fontSize: '12px',
            fontStyle: 'bold',
            color: '#ffffff',
        }).setOrigin(0.5);
        cancelBtn.add([cancelBg, cancelText]);
        cancelBtn.setSize(100, 24);
        cancelBtn.setInteractive(new Phaser.Geom.Rectangle(-50, -12, 100, 24), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        cancelBtn.on('pointerdown', () => this.close());
        cont.add(cancelBtn);

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
