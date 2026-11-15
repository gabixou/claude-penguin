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

    // Relogio de passo fixo: o jogo foi feito para frames de duracao
    // constante; setTimeout/setInterval auto-agendados disparam em
    // intervalos variaveis conforme a carga da maquina, o que deixava o
    // jogo "as vezes acelerado". Um rAF acumula o tempo real decorrido e
    // dispara cada stepper na sua grade exata (ms), com catch-up limitado.
    var _fxSteps = new Map(), _fxId = 1, _fxLast = 0, _fxRaf = 0;
    function _fxTick(ts) {
        _fxRaf = 0;
        if (!_fxSteps.size) return;
        if (!_fxLast) _fxLast = ts;
        var dt = Math.min(ts - _fxLast, 250); // aba em bg: nao simula segundos
        _fxLast = ts;
        _fxSteps.forEach(function (s) {
            s.acc += dt;
            var n = Math.floor(s.acc / s.ms);
            if (n > 4) n = 4; // catch-up limitado: sem rajada ao voltar do bg
            if (n > 0) {
                s.acc -= n * s.ms;
                if (s.acc > s.ms) s.acc = s.ms; // descarta atraso acumulado
                for (var i = 0; i < n; i++) s.fn();
            }
        });
        _fxRaf = requestAnimationFrame(_fxTick);
    }
    function _fxEnsure() {
        if (!_fxRaf) _fxRaf = requestAnimationFrame(_fxTick);
    }

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
        // passo fixo deterministico — equivalente ao mainLoop do sbd.js
        // original (rAF + gate de tempo decorrido), so que sem jitter.
        fixedInterval: function (fn, ms) {
            var id = _fxId++;
            _fxSteps.set(id, { fn: fn, ms: ms, acc: 0 });
            _fxEnsure();
            return id;
        },
        clearFixedInterval: function (id) {
            _fxSteps.delete(id);
            if (!_fxSteps.size && _fxRaf) { cancelAnimationFrame(_fxRaf); _fxRaf = 0; }
        },
        mainLoop: function (fn, opt) {
            var fps = (opt && opt.fps) || 30;
            loops.push(app.fixedInterval(fn, 1000 / fps));
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
