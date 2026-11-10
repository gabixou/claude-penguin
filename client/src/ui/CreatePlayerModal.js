// CreatePlayerModal.js — modal de criação de conta guest
// Abre quando o servidor retorna NEED_CREATE (novo jogador por IP)
import Phaser from 'phaser';
import { WORLD_W, WORLD_H } from '../display.js';
import { PENGUIN_COLORS, DEFAULT_COLOR_ITEM_ID, DEFAULT_COLOR_RGB } from '../items/colors.js';

const DEPTH = 30000000;

export default class CreatePlayerModal {
    constructor(scene) {
        this.scene = scene;
        this.container = null;
        this.dim = null;
        this.username = '';
        this.selectedColor = DEFAULT_COLOR_ITEM_ID;
        this.colorZones = [];
        this.usernameInput = null;
        this.errorText = null;
    }

    get isOpen() { return !!this.container; }

    open() {
        if (this.isOpen) this.close();
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
        const w = 320, h = 280;

        // Fundo escurecido
        this.dim = scene.add.rectangle(cx, cy, WORLD_W, WORLD_H, 0x000000, 0.6)
            .setOrigin(0.5).setDepth(DEPTH - 1).setInteractive();

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
        cont.add(scene.add.text(cx, cy - h / 2 + 20, 'Create Your Penguin', {
            fontFamily: 'GoPenguin, Arial, sans-serif',
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#0072ce',
        }).setOrigin(0.5));

        // Subtítulo
        cont.add(scene.add.text(cx, cy - h / 2 + 42, 'Choose a name and color', {
            fontFamily: 'GoPenguin, Arial, sans-serif',
            fontSize: '11px',
            color: '#666666',
        }).setOrigin(0.5));

        // Input de username (DOM)
        this.usernameInput = document.createElement('input');
        this.usernameInput.type = 'text';
        this.usernameInput.placeholder = 'Username (3-16 chars)';
        this.usernameInput.maxLength = 16;
        Object.assign(this.usernameInput.style, {
            position: 'fixed',
            left: (cx - 120) + 'px',
            top: (cy - 20) + 'px',
            width: '240px',
            height: '32px',
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
        });
        document.body.appendChild(this.usernameInput);

        // Preview do pinguim (cor selecionada)
        const previewY = cy + 40;
        const preview = scene.add.graphics();
        this._drawPenguinPreview(preview, previewY);
        cont.add(preview);

        // Seleção de cor
        const colorY = cy + 80;
        const colorSize = 24;
        const colorsPerRow = 6;
        const spacing = 8;
        const startX = cx - ((colorsPerRow - 1) * (colorSize + spacing)) / 2;

        this.colorZones = [];
        PENGUIN_COLORS.forEach((c, i) => {
            const col = i % colorsPerRow;
            const row = Math.floor(i / colorsPerRow);
            const x = startX + col * (colorSize + spacing);
            const y = colorY + row * (colorSize + spacing);

            const zone = scene.add.zone(x + colorSize / 2, y + colorSize / 2, colorSize, colorSize)
                .setInteractive({ useHandCursor: true });
            zone.on('pointerdown', () => {
                this.selectedColor = c.id;
                this._refreshColors();
                this._drawPenguinPreview(preview, previewY);
            });

            const g = scene.add.graphics();
            g.fillStyle(0xffffff, 1);
            g.fillRoundedRect(x, y, colorSize, colorSize, 4);
            g.lineStyle(2, this.selectedColor === c.id ? 0x2fb344 : 0x999999, 1);
            g.strokeRoundedRect(x, y, colorSize, colorSize, 4);
            g.fillStyle(c.color, 1);
            g.fillCircle(x + colorSize / 2, y + colorSize / 2, colorSize / 2 - 3);
            g.lineStyle(1, 0xffffff, 0.6);
            g.strokeCircle(x + colorSize / 2, y + colorSize / 2, colorSize / 2 - 3);

            cont.add([g, zone]);
            zone._colorId = c.id;
            zone._gfx = g;
            this.colorZones.push(zone);
        });

        // Botão criar
        const btnY = cy + h / 2 - 40;
        const btn = scene.add.container(cx, btnY);
        const btnBg = scene.add.graphics();
        btnBg.fillStyle(0x0072ce, 1);
        btnBg.fillRoundedRect(-60, -15, 120, 30, 6);
        btnBg.lineStyle(2, 0xffffff, 0.8);
        btnBg.strokeRoundedRect(-60, -15, 120, 30, 6);
        const btnText = scene.add.text(0, 0, 'Create', {
            fontFamily: 'GoPenguin, Arial, sans-serif',
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#ffffff',
        }).setOrigin(0.5);
        btn.add([btnBg, btnText]);
        btn.setSize(120, 30);
        btn.setInteractive(new Phaser.Geom.Rectangle(-60, -15, 120, 30), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        btn.on('pointerdown', () => this._submit());
        cont.add(btn);
        this._createBtn = btn;
        this._createBtnText = btnText;
        this._createBtnBg = btnBg;

        // Texto de erro
        this.errorText = scene.add.text(cx, cy + h / 2 - 15, '', {
            fontFamily: 'GoPenguin, Arial, sans-serif',
            fontSize: '10px',
            color: '#ff4444',
            align: 'center',
        }).setOrigin(0.5);
        cont.add(this.errorText);

        this._refreshColors();
        this._validate();
        this.usernameInput.focus();
    }

    _drawPenguinPreview(g, y) {
        g.clear();
        const color = PENGUIN_COLORS.find(c => c.id === this.selectedColor)?.color || DEFAULT_COLOR_RGB;
        // Desenha um pinguim simplificado
        g.fillStyle(color, 1);
        g.fillEllipse(0, y, 40, 50); // corpo
        g.fillStyle(0xffffff, 0.9);
        g.fillEllipse(0, y - 15, 30, 20); // barriga
        g.fillStyle(0x000000, 1);
        g.fillCircle(-8, y - 20, 3); // olho esquerdo
        g.fillCircle(8, y - 20, 3);  // olho direito
        g.fillStyle(0xff8800, 1);
        g.fillTriangle(-5, y - 18, 5, y - 18, 0, y - 10); // bico
    }

    _refreshColors() {
        for (const zone of this.colorZones) {
            const isSel = zone._colorId === this.selectedColor;
            zone._gfx.clear();
            zone._gfx.fillStyle(0xffffff, 1);
            zone._gfx.fillRoundedRect(0, 0, 24, 24, 4);
            zone._gfx.lineStyle(2, isSel ? 0x2fb344 : 0x999999, 1);
            zone._gfx.strokeRoundedRect(0, 0, 24, 24, 4);
            const color = PENGUIN_COLORS.find(c => c.id === zone._colorId)?.color || DEFAULT_COLOR_RGB;
            zone._gfx.fillStyle(color, 1);
            zone._gfx.fillCircle(12, 12, 9);
            zone._gfx.lineStyle(1, 0xffffff, 0.6);
            zone._gfx.strokeCircle(12, 12, 9);
        }
    }

    _validate() {
        const valid = this.username && this.username.trim().length >= 3 && this.username.trim().length <= 16;
        this._createBtn.setAlpha(valid ? 1 : 0.5);
        this._createBtn.setInteractive(valid ? { useHandCursor: true } : {});
        return valid;
    }

    _submit() {
        if (!this._validate()) {
            this.errorText.setText('Username must be 3-16 characters');
            return;
        }

        const username = this.username.trim();
        
        // Mostra loading state
        this._setLoading(true);
        this.errorText.setText('');
        
        // Envia para o servidor
        this.scene.network?.createPlayer(username, this.selectedColor);
        
        // Timeout de segurança (10s)
        this._submitTimeout = setTimeout(() => {
            this._setLoading(false);
            this.errorText.setText('Connection timeout. Please try again.');
        }, 10000);
    }

    _setLoading(loading) {
        if (!this._createBtn) return;
        this._createBtn.setAlpha(loading ? 0.7 : 1);
        if (this._createBtnText) {
            this._createBtnText.setText(loading ? 'Creating...' : 'Create');
        }
        if (this._createBtnBg) {
            this._createBtnBg.clear();
            this._createBtnBg.fillStyle(loading ? 0x666666 : 0x0072ce, 1);
            this._createBtnBg.fillRoundedRect(-60, -15, 120, 30, 6);
            this._createBtnBg.lineStyle(2, 0xffffff, 0.8);
            this._createBtnBg.strokeRoundedRect(-60, -15, 120, 30, 6);
        }
    }

    // Chamado quando o servidor responde (sucesso ou erro)
    onServerResponse(success, message = '') {
        if (this._submitTimeout) {
            clearTimeout(this._submitTimeout);
            this._submitTimeout = null;
        }
        this._setLoading(false);
        if (!success && message) {
            this.errorText.setText(message);
        }
    }
}
