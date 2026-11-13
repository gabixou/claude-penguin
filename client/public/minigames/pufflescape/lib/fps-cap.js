// Pufflescape: logica e fisica em passo FIXO de 60Hz, renderizacao a 30fps.
//
// O jogo aplica forca na bolinha a cada update() (applyForce por frame), e
// o Matter usa o delta real: rodar o laco inteiro a 30fps mudaria a
// jogabilidade (metade dos impulsos, passos de fisica de 33ms) — e sem
// limite, em monitor de 144Hz a bolinha ja ficava mais rapida que em 60Hz.
// Aqui o RAF continua no ritmo do monitor, mas:
//   - a simulacao (input, cenas, Matter, tweens, timers) avanca em passos
//     de exatamente 1000/60 ms, quantos couberem no tempo real decorrido
//     -> jogabilidade identica em 60, 120 ou 144Hz;
//   - o render (a parte cara: WebGL 1520x960) roda no maximo a 30fps.
// Carregado depois do phaser e antes do main.js (Phaser 3.55).
(function () {
    if (!window.Phaser || !Phaser.Game) return;
    var LOGIC_MS = 1000 / 60;
    var RENDER_MS = 1000 / 30;
    var MAX_STEPS = 4; // aba voltou do background: nao simula segundos de uma vez
    var Events = Phaser.Core.Events;

    Phaser.Game.prototype.step = function (time, delta) {
        if (this.pendingDestroy) return this.runDestroy();

        if (this.__acc === undefined) {
            this.__acc = LOGIC_MS;          // 1o frame: simula 1 passo ja
            this.__sim = time - LOGIC_MS;
            this.__lastRender = -Infinity;
        }
        this.__acc += Math.min(delta, 250);

        var ev = this.events, steps = 0;
        while (this.__acc >= LOGIC_MS && steps < MAX_STEPS) {
            this.__sim += LOGIC_MS;
            ev.emit(Events.PRE_STEP, this.__sim, LOGIC_MS);
            ev.emit(Events.STEP, this.__sim, LOGIC_MS);
            this.scene.update(this.__sim, LOGIC_MS);
            ev.emit(Events.POST_STEP, this.__sim, LOGIC_MS);
            this.__acc -= LOGIC_MS;
            steps++;
        }
        if (steps === MAX_STEPS) this.__acc = 0;

        // nada mudou desde o ultimo render, ou ainda nao deu 1/30s
        if (!steps || time - this.__lastRender < RENDER_MS - 4) return;
        this.__lastRender = time;

        var renderer = this.renderer;
        renderer.preRender();
        ev.emit(Events.PRE_RENDER, renderer, time, delta);
        this.scene.render(renderer);
        renderer.postRender();
        ev.emit(Events.POST_RENDER, renderer, time, delta);
    };
})();
