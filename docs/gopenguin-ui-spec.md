# GoPenguin Bottom UI — spec de port para Phaser 3

Fonte autoritativa: `E:\project\gopenguin-3ds-main\source\ui_theme.c` e `main.c` função `bottom()`.
Coordenadas nativas: espaço lógico **320×240** (tela inferior do 3DS). Escalar uniformemente para caber na faixa inferior do canvas 760×480.

## Assets disponíveis
- `/assets/ui-icons.png` — spritesheet 512×64, ícones de 32×32 px (16 ícones, frameWidth=32). Índices usados: 0=chat, 2=account, 3=snowball, 6=zoom/map, 7=help, 8=me, 4=people?, 9=membership, tabIcons={6,8,4,5,7} para tabs Room/Map/Me/People/Help. Carregar com `this.load.spritesheet('ui_icons','/assets/ui-icons.png',{frameWidth:32,frameHeight:32})`.
- Fonte: `'GoPenguin'` (@font-face já configurada, presentation-font.ttf do gopenguin).

## Paleta (valores exatos)
- INK = 0x003366 (texto escuro)
- SHADOW = 0x0b3d6e
- CARD_STROKE = 0x9fd6f5
- BUTTON_TOP=0x086aa6, BUTTON_BOTTOM=0x064679, BUTTON_DOWN_TOP=0x075b94, BUTTON_DOWN_BOTTOM=0x04365d
- Header: gradiente vertical 0x075c99→0x063c68 (y0-27), linha 1px 0x7fd2ff no topo, barra shadow 0x0b3d6e alpha60 acima
- Fundo do painel: gradiente vertical 0xcdeeff→0xf4fbff + 13 flocos de neve brancos (círculos alpha 200) nas posições: (18,46,2),(61,120,1),(97,70,2),(140,160,1),(176,52,1),(214,128,2),(251,84,1),(292,170,2),(38,182,1),(120,196,2),(230,190,1),(300,40,1),(160,98,1),(80,150,1)
- Tab bar: y205-240, gradiente 0x0d4a85→0x062646 + linha 1px 0x4fc0ff alpha180 em y205
- Aba ativa: renderiza como ui_button; inativa: retângulo white alpha40 se touched
- Selecionado texto aba: 0xffdd33, inativo: 0xffffff

## Primitivas (portar de ui_theme.c para Phaser.Graphics)
- `uiRound(x,y,w,h,r,color,alpha)`: rect arredondado; se alpha==255 desenhar rects+círculos nos cantos (como C2D); senão tiras horizontais. Equivalente a fillRoundedRect serve, MAS gradientes precisam de DrawRectangle com 4 cores — usar Graphics.fillGradientStyle ou fatias.
- `uiRoundGradient(x,y,w,h,r,top,bottom)`: gradiente vertical dentro de rounded rect ( canto circles + quads )
- `uiBackground()`: gradiente + flocos
- `uiHeader(title)`: barra shadow, gradiente, linha highlight, círculo branco r=11 em (14,13.5) + círculo 0xdff2f? na verdade 0xdff3ff r=10 + micro logo (pular logo ou desenhar retângulos simples)
- `uiBox(x,y,w,h,fill)`: se fill==0x0085c7 → uiButton; se 0xffffff → shadow+stroke 0x9fd6f5+fill branco (inset 1px); se INK/0x006699 → gradiente escuro; senão fill escurecido 35% + fill
- `uiButton(x,y,w,h,pressed,enabled)`: se disabled → rounded 0xffffff com inner 0xc9dce8 + shadow; senão shadow offset y+2, rounded branco, gradiente BUTTON_TOP→BOTTOM inset 1.5px, gloss branco alpha16 nos 42% superiores
- `button(x,y,w,h,label,ico)`: uiButton + label central (branco 11px) + ícone opcional
- `icon(i,x,y,scale)`: crop do spritesheet ui_icons, frame i, desenhado em x,y com tamanho 32*scale

## Layout `bottom()` tab=0 (Room) — coordenadas 320×240
1. ui_frame + ui_background + header(titulo da sala)
2. Minimap: box(6,33,181,119,branco); minimap image em (9,36) 175×110 — no browser, renderizar a cena da sala num RenderTexture ou usar snapshot; bolinhas dos jogadores (círculos r≈0.5-1.5) na posição escalada (x*175/760, y*110/480)
3. Canto sup-esq ações: text(12,154,10,INK,"L: history  R: write") ou botões igloo
4. Grade de 6 ações em x=193+(i%2)*62, y=34+(i/2)*34, tamanho 59×32:
   - i=0 Wave, i=1 Dance, i=2 Sit: desenhar preview do pinguim (sprite do atlas na pose) + label em y+25
   - i=3 Snowball (ícone 3), i=4 Chat (ícone 0), i=5 Zoom (ícone 6): ui_button + ícone + label
5. Membership: botão desabilitado (193,139,121,26), ícone 9 em (198,140) scale .75, label "Membership" em (270,152) — estilo disabled
6. Barra "Say something": box(7,173,240,28,branco) — dentro: ícone 0 em (10,174) scale .8, text "Say something..." em (41,179) size11 INK; à direita botão "Igloo"(253,173,60,28) (e "Music" se owner — omitir)
7. Tab bar y205: 5 tabs em x=i*64+2, y=208, w=60, h=30; cada tab: ícone tabIcons[i] scale .62 (~20px) + label tabs[i] ("Room","Map","Me","People","Help") size10, cor amarela se ativa
   - tab ativa renderiza ui_button; o grupo ícone+texto centralizado em mid y=223

## Comportamento
- Tab bar clicável: trocar tab ativa (visual por ora; Map pode reutilizar o modal de mapa existente)
- "Say something" clicável → focar o input de chat existente (ou abrir chat)
- Botões de ação Wave/Dance/Sit/Snowball/Chat/Zoom → disparar as mesmas ações do ActionControls atual
- Teclado continua funcionando

## Implementação
- Criar `client/src/ui/GoPenguinHud.js` — classe que recebe a scene e desenha tudo num Container com escala configurável (ex.: scale = panelHeight/240)
- Substituir `createAuthenticHUD` em `RoomScene.js` por este HUD (remover dock/botões emoji atuais)
- Manter o input de chat: pode ser DOM input posicionado sobre a barra "Say something" OU texto Phaser + teclado; Enter envia via NetworkClient existente
- NÃO usar emojis; usar somente ui-icons.png e gráficos vetoriais fiéis às cores acima
- Build deve passar: `cd client && npm run build`
