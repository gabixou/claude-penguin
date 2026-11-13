// test-tables.mjs — testa as regras dos jogos de mesa (server/src/tables.js)
// sem rede: partidas computador x computador + casos de regra conhecidos.
// Uso: node test-tables.mjs
import { _engines as E } from './src/tables.js';

let failures = 0;
const check = (name, cond, extra = '') => {
    if (cond) console.log(`  PASS ${name}`);
    else { failures++; console.log(`  FAIL ${name} ${extra}`); }
};

// ---------- partidas CPU x CPU ----------
function selfPlay(game, n) {
    const eng = E[game];
    let draws = 0, wins = [0, 0], maxPlies = 0, bad = 0, invariant = true;
    for (let g = 0; g < n; g++) {
        const st = eng.create();
        let res = null, plies = 0;
        while (!res && plies < 500) {
            const movers = game === 'card' ? [0, 1] : [st.turn];
            for (const s of movers) {
                const mv = eng.cpu(st, s);
                const err = eng.apply(st, s, mv);
                if (err) { bad++; break; }
            }
            plies++;
            if (game === 'mancala' && st.pits.reduce((a, b) => a + b, 0) !== 48) invariant = false;
            res = eng.result(st);
        }
        maxPlies = Math.max(maxPlies, plies);
        if (!res) { bad++; continue; }
        if (res.winner === null) draws++; else wins[res.winner]++;
    }
    return { draws, wins, maxPlies, bad, invariant };
}

console.log('Find Four');
{
    const r = selfPlay('four', 400);
    check('400 partidas terminam com jogadas válidas', r.bad === 0, JSON.stringify(r));
    const st = E.four.create();
    // vertical: seat 0 joga coluna 0 quatro vezes, seat 1 coluna 1
    for (let i = 0; i < 3; i++) { E.four.apply(st, 0, { col: 0 }); E.four.apply(st, 1, { col: 1 }); }
    check('fora da vez é recusado', E.four.apply(st, 1, { col: 2 }) === 'Não é sua vez');
    E.four.apply(st, 0, { col: 0 });
    check('4 na vertical vence', E.four.result(st)?.winner === 0);
    const st2 = E.four.create();
    for (let i = 0; i < 6; i++) E.four.apply(st2, st2.turn, { col: 3 });
    check('coluna cheia é recusada', E.four.apply(st2, st2.turn, { col: 3 }) === 'Coluna cheia');
    // CPU bloqueia: seat 0 tem 3 na horizontal (0,1,2) na base
    const st3 = E.four.create();
    E.four.apply(st3, 0, { col: 0 }); E.four.apply(st3, 1, { col: 6 });
    E.four.apply(st3, 0, { col: 1 }); E.four.apply(st3, 1, { col: 6 });
    E.four.apply(st3, 0, { col: 2 });
    check('CPU bloqueia a vitória do oponente', E.four.cpu(st3, 1).col === 3);
}

console.log('Mancala');
{
    const r = selfPlay('mancala', 400);
    check('400 partidas terminam com jogadas válidas', r.bad === 0, JSON.stringify(r));
    check('48 pedras sempre conservadas', r.invariant);
    const st = E.mancala.create();
    // casa 2 do lado 0 tem 4 pedras: 3,4,5 e a ultima cai na loja (6) -> jogada extra
    E.mancala.apply(st, 0, { pit: 2 });
    check('última pedra na própria loja dá jogada extra', st.turn === 0 && st.pits[6] === 1);
    check('casa vazia é recusada', E.mancala.apply(st, 0, { pit: 2 }) === 'Casa vazia');
    // captura: monta tabuleiro onde a ultima pedra cai na propria casa vazia
    const cap = E.mancala.create();
    cap.pits = [1, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 0];
    // casa 0 -> pedra cai na casa 1 (vazia, propria); oposta 12-1 = 11 tem 4
    cap.pits[0] = 1; cap.pits[11] = 4;
    E.mancala.apply(cap, 0, { pit: 0 });
    check('captura leva casa oposta + pedra para a loja', cap.pits[6] === 5 && cap.pits[1] === 0 && cap.pits[11] === 0, JSON.stringify(cap.pits));
}

console.log('Treasure Hunt');
{
    const r = selfPlay('treasure', 300);
    check('300 partidas terminam com jogadas válidas', r.bad === 0, JSON.stringify(r));
    const st = E.treasure.create();
    const [cell] = Object.keys(st.treasures).map(Number);
    const row = Math.floor(cell / 10), col = cell % 10;
    E.treasure.apply(st, 0, { line: 'row', index: row });
    const foundAfterRow = st.found.some((f) => f.cell === cell);
    E.treasure.apply(st, 1, { line: 'col', index: col });
    check('tesouro só aparece com linha E coluna cavadas', !foundAfterRow && st.found.some((f) => f.cell === cell));
    check('linha já cavada é recusada', E.treasure.apply(st, 0, { line: 'row', index: row }) === 'Já cavado');
    check('tesouros escondidos não vão ao cliente', !('treasures' in E.treasure.view(st)));
    const done = E.treasure.create();
    for (let i = 0; i < 12; i++) E.treasure.apply(done, done.turn, E.treasure.cpu(done));
    check('12 escavações encerram (cooperativo)', E.treasure.result(done)?.coop === true);
}

console.log('Card-Jitsu');
{
    const r = selfPlay('card', 400);
    check('400 partidas terminam com jogadas válidas', r.bad === 0, JSON.stringify(r));
    const st = E.card.create();
    st.seats[0].hand[0] = { element: 'fire', value: 3, color: 'red' };
    st.seats[1].hand[0] = { element: 'snow', value: 12, color: 'blue' };
    E.card.apply(st, 0, { card: 0 });
    check('jogada simultânea espera o outro', st.round === 0 && st.seats[0].picked === 0);
    check('não troca a carta depois de escolher', E.card.apply(st, 0, { card: 1 }) === 'Carta já escolhida');
    E.card.apply(st, 1, { card: 0 });
    check('fogo derrete neve (valor não importa)', st.last.winner === 0 && st.seats[0].bank.length === 1);
    const v = E.card.view(st, 0);
    check('mão do oponente fica escondida', v.seats[1].hand.every((c) => c === null) && v.seats[0].hand.every(Boolean));
    const bank = [
        { element: 'water', value: 2, color: 'red' },
        { element: 'water', value: 5, color: 'red' },
        { element: 'water', value: 7, color: 'blue' },
    ];
    check('mesmo elemento com cor repetida não vence', !E.card._wins(bank));
    bank.push({ element: 'water', value: 9, color: 'green' });
    check('3 do mesmo elemento com cores diferentes vence', !!E.card._wins(bank));
    check('um de cada elemento com cores diferentes vence', !!E.card._wins([
        { element: 'fire', value: 2, color: 'red' }, { element: 'water', value: 2, color: 'blue' },
        { element: 'snow', value: 2, color: 'green' }]));
}

console.log(failures ? `\n${failures} falha(s)` : '\nTudo certo');
process.exit(failures ? 1 : 0);
