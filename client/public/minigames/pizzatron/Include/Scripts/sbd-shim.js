// Shim do extinto "sbd.js" (SwitchBru SDK, CDN morto) — implementa so o
// que o Bean Counters usa: include(), app (state + mainLoop), device,
// input (stub: browser usa mouse) e expoe jQuery como $.
(function () {
    var $ = window.jQuery;

    // Carregamento sincrono de scripts relativos (o jogo chama include()
    // no top-level esperando os globals prontos em seguida).
    window.include = function (path) {
        var x = new XMLHttpRequest();
        x.open('GET', path + '.js', false);
        x.send(null);
        if (x.status >= 200 && x.status < 300) (0, eval)(x.responseText);
    };

    // app: maquina de estados + loop principal
    var state = 'Loading';
    var loops = [];
    window.app = {
        onLoad: function (fn) {
            if (document.readyState === 'complete') fn();
            else window.addEventListener('load', fn);
        },
        setState: function (s) { state = s; },
        currentState: function () { return state; },
        mainLoop: function (fn, opt) {
            var fps = (opt && opt.fps) || 30;
            loops.push(setInterval(fn, 1000 / fps));
        }
    };

    // device: browser nunca e Switch
    window.device = {
        isSwitch: false,
        // randomNum(1) -> 0|1 ; randomNum(a,b) -> int em [a,b]
        randomNum: function (a, b) {
            if (b === undefined) return Math.floor(Math.random() * (a + 1));
            return a + Math.floor(Math.random() * (b - a + 1));
        }
    };

    // input: stub — getPressed/Released retornam -1 (nunca casa com os
    // botoes); constantes existem para o handleInput() nao quebrar.
    var NONE = -1;
    window.input = {
        getHeld: function () { return NONE; },
        getPressed: function () { return NONE; },
        getReleased: function () { return NONE; },
        LStickLeft: 1, LStickRight: 2, LStickUp: 3, LStickDown: 4,
        DPadLeft: 5, DPadRight: 6, DPadUp: 7, DPadDown: 8,
        A: 9, B: 10, X: 11, Y: 12, L: 13, R: 14, Start: 15, Select: 16
    };

    window.$ = $;
})();
