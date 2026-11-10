# Visual Review — town — 2026-11-07 (run 2)

Fonte: `tools/shots/review-town-raw.txt` (clone `clone-town.png` vs ref `ref-town.png`). Modelo usado: `gemini-3.1-flash-lite` (fallback após quota 429 do modelo default).

---

Esta análise compara o seu clone em Phaser 3 (Imagem 1) com a referência original (Imagem 2).

## 1. Estado das cenas
Ambas mostram a mesma sala: **Town (Centro)**. A cena é comparável, embora a densidade de jogadores seja diferente.

## 2. Diferenças visuais encontradas

### Enquadramento/Canvas
*   **Clone: Faixas laterais pretas (letterboxing)** | **Ref: Tela cheia** | **Correção:** Ajustar o `scale mode` no Phaser para `Phaser.Scale.FIT` ou `RESIZE`, garantindo que o canvas preencha a janela do navegador sem barras laterais.

### HUD Inferior (Barra de Ações)
*   **Botão "MAP":**
    *   **Clone:** O ícone do mapa está posicionado dentro da barra azul, com uma borda irregular.
    *   **Ref:** O ícone do mapa fica *fora* e acima da barra, flutuando no canto inferior esquerdo.
    *   **Correção:** Remover o "MAP" da barra de HUD e posicioná-lo como um elemento de UI independente, alinhado ao canto inferior esquerdo.
*   **Iconografia e Alinhamento:**
    *   **Clone:** Os ícones estão levemente descentralizados e a barra possui um brilho/gradiente excessivamente saturado.
    *   **Ref:** A barra possui um azul translúcido mais suave.
    *   **Correção:** Ajustar o *padding* entre os ícones para que correspondam ao espaçamento da referência.
*   **Espaço de Chat:**
    *   **Clone:** A caixa de texto central parece mais curta ou mal delimitada.
    *   **Ref:** A caixa de texto é um elemento contínuo e bem integrado na estrutura da barra.

### Personagens/Penguins
*   **Aura/Seleção:**
    *   **Clone:** O jogador tem um círculo azul de seleção (foco) visível embaixo dos pés.
    *   **Ref:** Os jogadores não possuem esse círculo azul constante ao redor dos pés na vista principal.
    *   **Correção:** Remover a borda/círculo de seleção de personagem (ou torná-lo opcional/invisível).
*   **Nomes e Etiquetas:**
    *   **Clone:** O nome "Penguin_3717" está colado aos pés do sprite.
    *   **Ref:** Os nomes são exibidos em uma fonte *pixel font* específica (tipo VAG Rounded) com contorno branco e sombra suave. O seu clone está usando uma fonte padrão de sistema.
    *   **Correção:** Implementar o arquivo de fonte original (.ttf ou .woff) e adicionar um contorno (stroke) de 2px na cor branca aos textos dos nomes.

### Cenário/Background
*   **Envelope (Mail):**
    *   **Clone:** O ícone de e-mail aparece no topo esquerdo.
    *   **Ref:** O e-mail também aparece, mas o espaçamento em relação à borda da tela parece diferente.
    *   **Correção:** Verificar margens (margins/padding) para alinhar exatamente ao layout da referência.

## 3. O que já está igual
*   **Ativos (Assets) do Cenário:** As artes da Coffee Shop, Nightclub e Gift Shop estão posicionadas corretamente e com as proporções corretas.
*   **Perspectiva:** A profundidade da cena e a escala dos edifícios em relação ao centro estão muito boas.
*   **Barra de Ações:** A estrutura de botões (chat, emojis, etc.) está quase totalmente implementada na barra inferior.

## 4. Prioridades (Impacto Visual)

1.  **Remoção das faixas pretas (Canvas):** É o erro mais gritante; o jogo parece "pequeno" e isolado.
2.  **Fonte dos nomes dos jogadores:** A fonte do sistema quebra completamente a imersão. Substituir pela fonte oficial de Club Penguin é essencial.
3.  **Remoção do círculo azul (Aura):** Esse círculo faz parecer um jogo de estratégia/seleção e não um MMORPG social.
4.  **Posicionamento do botão "MAP":** Mover o botão para fora da barra inferior corrigirá o aspecto de "interface quebrada".
5.  **Ajuste das fontes (CSS/Canvas):** Aplicar o contorno branco nos nomes.

## Correções aplicadas nesta sessão

- **`client/src/main.js`**: aguarda `document.fonts.load('12px GoPenguin')` (com timeout de 1,5s) antes de instanciar o Phaser, para os textos Phaser já nascerem com a fonte correta.
- **`client/src/ui/WebHud.js`**: ícone MAP passou de `(24,444)`/`50x60` para `(36,396)`/`50x50`, preservando a proporção do asset e subindo para fora da barra de ações.
- **`client/src/entities/Penguin.js`**: removido o anel/seleção azul constante sob o pinguim local.

## Não aplicado

- **Letterbox/pillarbox**: o canvas já usa `Phaser.Scale.FIT` + `CENTER_BOTH`; preencher a janela exigiria mudar aspecto/modo de escala ou assets de cenário, fora de uma correção visual conservadora.
- **Envelope/margens e chat**: divergências menores/ambíguas no review do modelo lite; mantidos para evitar regressão.
