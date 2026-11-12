// Cap global de requestAnimationFrame em ~30fps para os minigames.
// Os jogos foram feitos para 30fps: em PCs rapidos o loop a 60fps deixa
// o jogo ~2x mais veloz e o render mais pesado. Este shim atrasa o
// dispatch dos callbacks para no maximo um frame a cada 1000/30 ms.
// Deve ser o PRIMEIRO script da pagina (antes de jquery/phaser/etc).
(function () {
    var TARGET_MS = 1000 / 30;
    var realRAF = window.requestAnimationFrame.bind(window);
    var pending = new Map();
    var nextId = 1, last = 0, scheduled = false;

    window.requestAnimationFrame = function (cb) {
        var id = nextId++;
        pending.set(id, cb);
        if (!scheduled) {
            scheduled = true;
            realRAF(function tick(ts) {
                scheduled = false;
                if (ts - last < TARGET_MS - 0.5 && pending.size) {
                    scheduled = true;
                    realRAF(tick);
                    return;
                }
                last = ts;
                var cbs = [];
                pending.forEach(function (fn) { cbs.push(fn); });
                pending.clear();
                for (var i = 0; i < cbs.length; i++) {
                    try { cbs[i](ts); } catch (e) { setTimeout(function () { throw e; }); }
                }
            });
        }
        return id;
    };

    window.cancelAnimationFrame = function (id) {
        pending.delete(id);
    };
})();
