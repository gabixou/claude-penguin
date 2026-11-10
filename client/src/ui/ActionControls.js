/**
 * ActionControls.js - Controles de ação clássicos do Club Penguin (somente teclado)
 * X=dance, Y=wave, B=sit/stand, C/V=throw(snowball), M=mapa
 * Sem botões visuais: gopenguin usa apenas hotkeys + dock inferior.
 */

import Phaser from 'phaser';

export default class ActionControls {
    constructor(scene, callbacks) {
        this.scene = scene;
        this.callbacks = callbacks || {};
        this.sitting = false;

        this._keyHandler = (event) => {
            if (event.repeat) return;
            switch ((event.key || '').toUpperCase()) {
                case 'X': this.emit('dance'); break;
                case 'Y': this.emit('wave'); break;
                case 'B': this.toggleSit(); break;
                case 'C':
                case 'V': this.emit('throw'); break;
                case 'M': this.emit('map'); break;
                case 'I': this.emit('clothes'); break;
            }
        };
        scene.input.keyboard.on('keydown', this._keyHandler);
    }

    emit(name) {
        if (this.callbacks.onAction) this.callbacks.onAction(name);
    }

    toggleSit() {
        this.sitting = !this.sitting;
        this.emit(this.sitting ? 'sit' : 'stand');
    }

    setSitting(bool) {
        this.sitting = !!bool;
    }

    destroy() {
        this.scene.input.keyboard.off('keydown', this._keyHandler);
    }
}
