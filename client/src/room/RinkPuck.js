// RinkPuck.js — "room ball" do Hockey Rink (Stadium 2008).
// Port do HockeyGame/BallGroup AS3 decompilado do rink.swf do wand:
//   - puck compartilhado: cada cliente simula a mesma fisica localmente
//   - jogador "chuta" o disco ao andar sobre ele (hitPuck -> PUCK_HIT via WS)
//   - estado inicial vem do servidor (PUCK_GET -> PUCK_STATE, como o gz original)
//   - gol/out-of-bounds -> resetPuck() = disco volta ao centro (0,0)
// Coordenadas da fisica sao LOCAIS ao game_mc (origem = centro do gelo);
// o servidor e os outros clientes veem os mesmos valores.

const PUCK_RADIUS = 8;
const FRICTION = 0.1;
const PUCK_TIMEOUT = 1000;          // frames @24fps parado ate resetar
const MAX_ANGLE_FROM_HORIZONTAL = 50;
const MAX_VERTICAL_FROM_NET_CENTER = 30;
const STEP_MS = 1000 / 24;          // frameRate do SWF original

// ---------- helpers de matriz/linha (Vector.as / Line.as) ----------

const matIdent = [1, 0, 0, 1, 0, 0];

// [a,b,c,d,tx,ty] no formato canvas: x' = a*x + c*y + tx, y' = b*x + d*y + ty
function matMul(p, c) {
    return [
        p[0] * c[0] + p[2] * c[1],
        p[1] * c[0] + p[3] * c[1],
        p[0] * c[2] + p[2] * c[3],
        p[1] * c[2] + p[3] * c[3],
        p[0] * c[4] + p[2] * c[5] + p[4],
        p[1] * c[4] + p[3] * c[5] + p[5],
    ];
}
function matPoint(m, x, y) {
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

// Bounds AABB de um retangulo local transformado pela matriz.
function matBounds(m, x0, y0, x1, y1) {
    const pts = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => matPoint(m, x, y));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

// Line.as: x1,y1,x2,y2 + slope/b/angleRadians/getVector()
class RinkLine {
    constructor(x1, y1, x2, y2) {
        this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2;
    }
    get slope() { return (this.y2 - this.y1) / (this.x2 - this.x1); }
    get b() { return this.y1 - this.slope * this.x1; }
    get angleRadians() { return Math.atan2(this.y2 - this.y1, this.x2 - this.x1); }
    getVector() { return { x: this.x2 - this.x1, y: this.y2 - this.y1 }; }
}

// getBallLineCollisionTime() do BallGroup.as — port literal.
// Retorna o "tempo" (fração do percurso do frame) ate a colisao, ou Infinity.
function ballLineCollisionTime(line, ball) {
    let m = ball.vel.y / ball.vel.x;
    if (m === Infinity) m = 1000000;
    else if (m === -Infinity) m = -1000000;
    else if (Number.isNaN(m)) return Infinity;
    const bInt = ball.pos.y - m * ball.pos.x;
    const xInt = (bInt - line.b) / (line.slope - m);
    const yInt = line.slope * xInt + line.b;
    const velAng = Math.atan2(ball.vel.y, ball.vel.x);
    let rel = velAng - line.angleRadians;
    const sinRel = Math.sin(rel);
    const back = ball.r / sinRel;
    const cx = xInt - back * Math.cos(velAng);
    const cy = yInt - back * Math.sin(velAng);
    const dx = cx - ball.pos.x, dy = cy - ball.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = ball.speed;
    const t = dist / speed;
    const invSlope = -1 / line.slope;
    const b2 = cy - invSlope * cx;
    const xCross = (line.b - b2) / (invSlope - line.slope);
    const yCross = invSlope * xCross + b2;
    const inX = (xCross > line.x1 && xCross < line.x2) || (xCross < line.x1 && xCross > line.x2);
    const inY = (yCross > line.y1 && yCross < line.y2) || (yCross < line.y1 && yCross > line.y2);
    if (inX || inY) return t;
    return Infinity;
}

export default class RinkPuck {
    // scene = RoomScene; movie = MovieRoom do pack rink ja carregado
    constructor(scene, movie) {
        this.scene = scene;
        this.movie = movie;
        this.pos = { x: 0, y: 0 };   // game_mc-local
        this.vel = { x: 0, y: 0 };
        this.puckTimeoutCounter = 0;
        this._acc = 0;
        this._geo = this._extractGeometry();
        this._buildSprite();
    }

    // ---------- geometria (lida do timelines.json do pack) ----------

    _extractGeometry() {
        const tl = this.movie;
        const frame = tl._mainTl.frames[0] || [];
        const gameEntry = frame.find((e) => e.name === 'game_mc');
        if (!gameEntry) return null;
        const origin = [gameEntry.matrix?.[4] ?? 0, gameEntry.matrix?.[5] ?? 0];
        const gameSprite = tl.sprites[String(gameEntry.id)];
        const gframe = gameSprite?.frames?.[0] || [];
        const byName = new Map(gframe.map((e) => [e.name, e]));

        // vertices da quadra: p0..p11 (marcadores 9px — _x,_y = centro)
        const pts = [];
        for (let i = 0; i < 12; i++) {
            const e = byName.get(`p${i}`);
            if (e) pts.push([e.matrix?.[4] ?? 0, e.matrix?.[5] ?? 0]);
        }
        // makeLines(): p0-p1, p1-p2, ..., p10-p11, p11-p0
        const lines = [];
        for (let i = 0; i < pts.length; i++) {
            const [x1, y1] = pts[i];
            const [x2, y2] = pts[(i + 1) % pts.length];
            lines.push(new RinkLine(x1, y1, x2, y2));
        }

        // bounds de uma entry (sprite ou shape) em coords game_mc-local.
        // matrixWorld = matrix da entry dentro do game_mc composta com as dos pais.
        const entryBounds = (entry, parentMat) => {
            const m = matMul(parentMat, entry.matrix || matIdent);
            const sp = tl.sprites[String(entry.id)];
            if (sp) {
                let bb = null;
                for (const sub of sp.frames?.[0] || []) {
                    const sb = entryBounds(sub, m);
                    if (sb) bb = bb ? [Math.min(bb[0], sb[0]), Math.min(bb[1], sb[1]), Math.max(bb[2], sb[2]), Math.max(bb[3], sb[3])] : sb;
                }
                return bb;
            }
            const ch = tl.characters[String(entry.id)];
            if (!ch?.size) return null;
            const [w, h] = ch.size, [ox, oy] = ch.origin || [0, 0];
            return matBounds(m, -ox, -oy, w - ox, h - oy);
        };

        const boxEntry = byName.get('boundingBox_mc');
        const box = boxEntry ? entryBounds(boxEntry, matIdent) : null;
        // HockeyGame: xMin=bb._x, xMax=bb._x+bb._width — _x/_width do Flash
        // equivalem ao bounds do conteudo a partir da origem do sprite.
        // entryBounds ja devolve o AABB absoluto; mas _x e a ORIGEM do
        // boundingBox_mc, nao o min do conteudo — o conteudo comeca em ~0.
        // Usamos o AABB direto (equivalente aqui: conteudo inicia em 0,0).
        const geo = {
            origin,
            lines,
            xMin: box ? box[0] : -400,
            yMin: box ? box[1] : -200,
            xMax: box ? box[2] : 400,
            yMax: box ? box[3] : 200,
            nets: {},
        };

        for (const side of ['Left', 'Right']) {
            const e = byName.get(`netBlock${side}_mc`);
            if (!e) continue;
            geo.nets[side] = entryBounds(e, matIdent);
            // netLeft_mc._y usado no goal-check do original = translate y
            if (side === 'Left') geo.netOriginY = e.matrix?.[5] ?? 0;
        }
        geo.netOriginY ??= geo.nets.Left ? (geo.nets.Left[1] + geo.nets.Left[3]) / 2 : 0;
        return geo;
    }

    // ---------- sprite do puck ----------

    async _buildSprite() {
        const geo = this._geo;
        if (!geo) return;
        // puck_mc -> sprite -> shape 90.svg (18x17, disco de hockey)
        const frame = this.movie._mainTl.frames[0] || [];
        const gameEntry = frame.find((e) => e.name === 'game_mc');
        const gframe = this.movie.sprites[String(gameEntry?.id)]?.frames?.[0] || [];
        const puckEntry = gframe.find((e) => e.name === 'puck_mc');
        const sp = this.movie.sprites[String(puckEntry?.id)];
        const sub = sp?.frames?.[0]?.[0];
        const ch = this.movie.characters[String(sub?.id)];
        const svg = ch?.file ? this.movie._svgText(ch.file) : null;
        if (!svg || !ch) return;
        try {
            const img = new Image();
            await new Promise((res, rej) => {
                img.onload = res; img.onerror = rej;
                img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
            });
            const [w, h] = ch.size || [img.width, img.height];
            const ss = 2;
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(w * ss); canvas.height = Math.ceil(h * ss);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const key = 'rink_puck';
            if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
            this.scene.textures.addCanvas(key, canvas);
            // depth = mesma formula do _depthOf p/ sprites (floor(x)+1000*floor(y))
            const depth = Math.floor(geo.origin[0]) + 1000 * Math.floor(geo.origin[1]);
            this.img = this.scene.add.image(0, 0, key)
                .setDisplaySize(w, h)
                .setDepth(depth);
            this._draw();
        } catch (e) {
            console.warn('[rink] puck sprite', e);
        }
    }

    _draw() {
        if (!this.img || !this._geo) return;
        this.img.setPosition(this._geo.origin[0] + this.pos.x, this._geo.origin[1] + this.pos.y);
    }

    // ---------- protocolo (z/gz, z/m do original) ----------

    requestState() {
        this.scene?.network?.sendPuckGet?.();
    }

    // hitPuck() do original — pos/vel em coords game_mc-local.
    hitPuck(x, y, vx, vy) {
        this.pos.x = x; this.pos.y = y;
        this.vel.x = vx; this.vel.y = vy;
        this.puckTimeoutCounter = 0;
        this._draw();
    }

    sendHit(x, y, vx, vy) {
        this.hitPuck(x, y, vx, vy);
        this.scene?.network?.sendPuckHit?.(
            Math.round(x * 100) / 100, Math.round(y * 100) / 100,
            Math.round(vx * 100) / 100, Math.round(vy * 100) / 100,
        );
    }

    // ---------- update (RoomScene.update) ----------

    update(deltaMs) {
        if (!this._geo) return;
        // chute do jogador local: movePlayer() do StadiumIceRink —
        // enquanto anda, se o pinguim encosta no disco e o alvo esta
        // longe o suficiente, "chuta" na direcao do movimento.
        this._tryPlayerHit();
        this._acc += Math.min(deltaMs, 100);
        while (this._acc >= STEP_MS) {
            this._acc -= STEP_MS;
            this._step();
        }
    }

    _tryPlayerHit() {
        const lp = this.scene?.localPlayer;
        if (!lp) return;
        // desarma apos o chute — rearma a cada novo destino de caminhada
        // (original: onEnterFrame apagado apos sendGameMove; cada PLAYER_MOVE
        // de um novo clique rearma)
        if (!lp.isMoving || !lp.moveTarget || !this.scene.network) return;
        if (lp._puckHitTarget === lp.moveTarget) return;
        const [ox, oy] = this._geo.origin;
        const px = lp.x - ox, py = lp.y - oy;
        // hitTest(puck_mc, player._x, player._y) — aprox. por distancia
        if (Math.hypot(px - this.pos.x, py - this.pos.y) > PUCK_RADIUS + 10) return;
        const tx = lp.moveTarget.x - ox, ty = lp.moveTarget.y - oy;
        if (Math.hypot(tx - this.pos.x, ty - this.pos.y) <= 20) return;
        const vx = Math.floor((tx - this.pos.x) / 6);
        const vy = Math.floor((ty - this.pos.y) / 6);
        if (vx === 0 && vy === 0) return;
        lp._puckHitTarget = lp.moveTarget;
        this.sendHit(this.pos.x, this.pos.y, vx, vy);
    }

    // ---------- fisica (BallGroup.onEnterFrame @24fps) ----------

    _velLen() { return Math.hypot(this.vel.x, this.vel.y); }
    _setVelLen(len) {
        const cur = this._velLen();
        if (cur) { this.vel.x *= len / cur; this.vel.y *= len / cur; }
        else this.vel.x = len;
    }

    _step() {
        // doFriction
        let len = this._velLen() - FRICTION;
        if (len <= 0) {
            len = 0;
            this._setVelLen(0);
            // puckDone() + timeout -> resetPuck()
            if (++this.puckTimeoutCounter > PUCK_TIMEOUT) this._resetPuck();
        } else {
            this.puckTimeoutCounter = 0;
            this._setVelLen(len);
        }
        // addVelocity
        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;
        this._collideWithNets();
        this._collideWithWalls();
        this._draw();
    }

    _resetPuck() {
        // resetPuck(): pos(0,0) = centro do gelo, vel(0,0)
        this.pos.x = 0; this.pos.y = 0;
        this.vel.x = 0; this.vel.y = 0;
        this.puckTimeoutCounter = 0;
    }

    _collideWithNets() {
        const g = this._geo;
        const hitRect = (rect) => {
            if (!rect) return false;
            // hitTest aproximado: circulo do puck vs AABB da rede
            const cx = (rect[0] + rect[2]) / 2, cy = (rect[1] + rect[3]) / 2;
            const hw = (rect[2] - rect[0]) / 2 + PUCK_RADIUS;
            const hh = (rect[3] - rect[1]) / 2 + PUCK_RADIUS;
            return Math.abs(this.pos.x - cx) <= hw && Math.abs(this.pos.y - cy) <= hh;
        };
        let hit = false;
        if (hitRect(g.nets.Left)) {
            hit = true;
            const dy = this.pos.y - g.netOriginY;
            if (dy > -MAX_VERTICAL_FROM_NET_CENTER && dy < MAX_VERTICAL_FROM_NET_CENTER) {
                let a = (Math.atan2(this.vel.y, this.vel.x) * 180) / Math.PI;
                if (a < 0) a += 360;
                a -= 180;
                if (a > -MAX_ANGLE_FROM_HORIZONTAL && a < MAX_ANGLE_FROM_HORIZONTAL) {
                    this._goalScored('team2');
                    return;
                }
            }
        } else if (hitRect(g.nets.Right)) {
            hit = true;
            const dy = this.pos.y - g.netOriginY;
            if (dy > -MAX_VERTICAL_FROM_NET_CENTER && dy < MAX_VERTICAL_FROM_NET_CENTER) {
                let a = (Math.atan2(this.vel.y, this.vel.x) * 180) / Math.PI;
                if (a < 0) a += 360;
                if (a > -MAX_ANGLE_FROM_HORIZONTAL && a < MAX_ANGLE_FROM_HORIZONTAL) {
                    this._goalScored('team1');
                    return;
                }
            }
        }
        if (hit) {
            // quicar na trave: negate + 2x pos + 0.8 vel (como o original)
            this.vel.x = -this.vel.x; this.vel.y = -this.vel.y;
            this.pos.x += this.vel.x; this.pos.y += this.vel.y;
            this.pos.x += this.vel.x; this.pos.y += this.vel.y;
            this.vel.x *= 0.8; this.vel.y *= 0.8;
        }
    }

    _goalScored() {
        // goalScoredTeam1/2 do original sao vazios — sem placar nesta versao.
        // O efeito visivel e o resetPuck() (disco volta ao centro).
        this._resetPuck();
        this._draw();
    }

    _collideWithWalls() {
        const g = this._geo;
        const ball = { pos: this.pos, vel: this.vel, r: PUCK_RADIUS, speed: this._velLen() };
        for (const line of g.lines) {
            const t = ballLineCollisionTime(line, ball);
            if (t !== Infinity && 0 < t && t <= 1) {
                // vel.reflectOff(line.getVector()): rotate(-ang), y=-y, rotate(ang)
                const v = line.getVector();
                const ang = (Math.atan2(v.y, v.x) * 180) / Math.PI;
                const rotate = (vx, vy, deg) => {
                    const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
                    return [vx * c - vy * s, vx * s + vy * c];
                };
                let [vx, vy] = rotate(this.vel.x, this.vel.y, -ang);
                vy = -vy;
                [vx, vy] = rotate(vx, vy, ang);
                this.vel.x = vx * 0.8; this.vel.y = vy * 0.8;
                this.pos.x += this.vel.x;
                this.pos.y += this.vel.y;
                return; // uma colisao por frame, como o original
            }
        }
        // fora do boundingBox -> resetPuck()
        if (this.pos.x - PUCK_RADIUS < g.xMin || this.pos.x + PUCK_RADIUS > g.xMax
            || this.pos.y - PUCK_RADIUS < g.yMin || this.pos.y + PUCK_RADIUS > g.yMax) {
            this._resetPuck();
        }
    }

    destroy() {
        this.img?.destroy();
        this.img = null;
    }
}
