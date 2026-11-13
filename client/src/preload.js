// Carregamento otimista: dispara TUDO o que o primeiro frame jogavel precisa
// assim que o bundle e avaliado — antes de esperar o evento load, as fontes
// e o boot do Phaser (antes tudo isso so comecava ~1.3s depois, dentro da
// RoomScene). Cada loader deduplica, entao quem pedir depois so reaproveita:
//   - MovieRoom.load(base)  -> cache _sharedAssets por base
//   - PenguinLibrary        -> promise reusada pela BootScene
//   - WebSocket             -> adotado pelo NetworkClient (ja autenticado)
// Importado PRIMEIRO pelo main.js.
import { MovieRoom } from './movie/movie.js';
import { PenguinLibrary } from './entities/PenguinArt.js';
import NetworkClient from './network/NetworkClient.js';
import { initialRoom, movieBaseFor } from './room/rooms.js';
import { mark } from './perf.js';

mark('preload');

// Logo da tela de boot: PRIMEIRO pedido de rede. Em HTTP/1.1 (dev/preview
// local) o navegador abre so 6 conexoes por host — com os ~35 pedidos de
// packs abaixo na frente, o logo esperava ~1.3s na fila e segurava a
// BootScene (e com ela a RoomScene).
export const logoImage = new Image();
logoImage.decoding = 'async';
logoImage.src = '/assets/ui/logo.svg';

// login/sessao em paralelo com o resto do boot
NetworkClient.preconnect();

// ordem = prioridade de rede: sala inicial (o que aparece primeiro),
// HUD (interface) e por fim o pack do pinguim (o maior, ~4.8MB).
// Festa ativa so e conhecida apos o login — se a sala inicial tiver
// substituicao, este warm e descartado sem custo de correcao.
const roomBase = movieBaseFor(initialRoom());
if (roomBase) MovieRoom.load(roomBase).catch(() => {});
MovieRoom.load('/assets/movies/interface').catch(() => {});

export const earlyPenguinLibrary = PenguinLibrary.load();
earlyPenguinLibrary.catch(() => {});
