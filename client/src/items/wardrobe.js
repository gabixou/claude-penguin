/**
 * wardrobe.js - Paperdoll com sprites GPA2 reais do gopenguin
 * Cada item de roupa é um .gpa com poses por action/clock.
 * Ordem de desenho (fundo -> frente): feet, body, neck, face, hand, head
 */

import { loadGpa2, textureToCanvas } from './gpa2.js';

// Ordem de desenho (fundo -> frente) fiel ao gopenguin: feet, body, neck, hand, face, head
export const OUTFIT_SLOTS = ['feet', 'body', 'neck', 'hand', 'face', 'head'];

// Frames GPA registrados como Frame nomeado na textura da página
// (setCrop não serve para atlas: o Phaser usa crop.x/y como offset de render)
const registeredGpaFrames = new Set(); // 'texKey|frameIndex'

function ensureGpaFrame(scene, texKey, index, rect) {
    const key = `${texKey}|${index}`;
    if (registeredGpaFrames.has(key)) return 'f' + index;
    const tex = scene.textures.get(texKey);
    if (tex && !tex.has('f' + index)) {
        tex.add('f' + index, 0, rect.x, rect.y, rect.w, rect.h);
    }
    registeredGpaFrames.add(key);
    return 'f' + index;
}

export default class Wardrobe {
    constructor(scene) {
        this.scene = scene;
        this.sprites = new Map();   // itemId -> sprite parseado
        this.loading = new Map();   // itemId -> Promise
    }

    // Garante que o sprite está carregado; retorna sprite ou null (sync se já em cache)
    ensure(itemId) {
        if (this.sprites.has(itemId)) return this.sprites.get(itemId);
        if (!this.loading.has(itemId)) {
            this.loading.set(itemId, loadGpa2(`/assets/outfits/${itemId}.gpa`)
                .then(async (sprite) => {
                    for (let i = 0; i < sprite.pages; i++) {
                        const key = `gpa_${itemId}_p${i}`;
                        if (!this.scene.textures.exists(key)) {
                            this.scene.textures.addCanvas(key, textureToCanvas(sprite, i));
                        }
                    }
                    this.sprites.set(itemId, sprite);
                    return sprite;
                })
                .catch((err) => {
                    console.warn('[Wardrobe] falha ao carregar', itemId, err);
                    return null;
                })
                .finally(() => this.loading.delete(itemId)));
        }
        return null; // ainda carregando
    }

    equip(itemId) { this.ensure(itemId); }

    // Pose atual de um sprite para action/clock (mesma lógica do cliente C)
    poseFor(sprite, action, clock) {
        let seq = sprite.sequences.find(s => s.rotation === action && s.variation === 1)
               || sprite.sequences.find(s => s.rotation === action);
        if (!seq) return null;
        const tick = Math.floor(clock * sprite.fps / 24);
        let idx;
        if (tick < seq.count) idx = seq.start + tick;
        else if (seq.count > seq.loop) idx = seq.start + seq.loop + ((tick - seq.loop) % (seq.count - seq.loop));
        else idx = seq.start + seq.count - 1;
        const frame = sprite.frames[idx];
        return frame ? { frame, page: seq.page, index: idx } : null;
    }

    // Atualiza as layers de UM pinguim. layers[slot] = Phaser.Image (origin 0,0)
    syncLayers(layers, outfitMap, action, clock) {
        for (const slot of OUTFIT_SLOTS) {
            const layer = layers[slot];
            const itemId = outfitMap[slot];
            const sprite = itemId ? this.sprites.get(itemId) : null;
            if (!layer) continue;
            if (!sprite) {
                layer.setVisible(false);
                if (itemId) this.ensure(itemId); // dispara preload para o próximo frame
                continue;
            }
            const pose = this.poseFor(sprite, action, clock);
            if (!pose) { layer.setVisible(false); continue; }
            const texKey = `gpa_${itemId}_p${pose.page}`;
            layer.setTexture(texKey);
            layer.setFrame(ensureGpaFrame(this.scene, texKey, pose.index, pose.frame));
            layer.setScale(sprite.scale);
            layer.setPosition(pose.frame.left * sprite.scale, pose.frame.top * sprite.scale);
            layer.setOrigin(0, 0);
            layer.setVisible(true);
        }
    }
}

// Pré-carrega uma lista de ids (ex.: guarda-roupa do jogador)
export async function preloadOutfits(scene, ids) {
    const w = new Wardrobe(scene);
    await Promise.all(ids.filter(Boolean).map(id => w.ensure(id) || new Promise(r => {
        // ensure retorna null enquanto carrega; espera a promise interna
        const t = setInterval(() => { const s = w.sprites.get(id); if (s || !w.loading.has(id)) { clearInterval(t); r(s); } }, 50);
    })));
    return w;
}
