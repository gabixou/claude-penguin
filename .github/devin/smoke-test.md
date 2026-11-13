Um push acabou de chegar em master do claude-penguin (o código do jogo em https://claudepenguin.mooo.com). O repo não tem CI e regressões recentes (ReferenceError no _initMovie travando o loading, tela preta no boot) chegaram aos jogadores. Verifique se este push quebrou o jogo e, se quebrou, corrija.

O commit testado está em `$PUSH_AFTER` e o último commit já testado em `$PUSH_BEFORE` (o intervalo pode cobrir vários pushes) (variáveis de ambiente; `$PUSH_BEFORE` pode ser zeros num branch novo). Você está rodando na máquina do dono, num checkout limpo feito pelo GitHub Actions: não mexa em nada fora deste diretório e não pare servidores que já estejam rodando (o jogo local/produção pode estar no ar nas portas 8080/3000).

1. Servidor: `cd server && npm ci`. Suba com banco temporário na porta 8090: `PENGUIN_DB=<arquivo temporário> PORT=8090 node src/index.js` (confira as variáveis em server/src/index.js e nos cabeçalhos dos testes). Rode `node test-tables.mjs`, `node test-e2e.mjs` e `node test-multi.mjs` e anote PASS/FAIL.
2. Cliente: `cd client && npm ci && npm run build` tem que passar. Depois suba o cliente de dev numa porta livre (ex.: `npx vite --port 3100`) apontando para o servidor de teste e abra no navegador headless (Playwright/Chrome). Use o pinguim de teste loopback (`?penguin=Arenovisk`, ver README) para passar do login. Confirme que o jogo sai do loading, renderiza a sala inicial sem tela preta, o pinguim anda e pelo menos uma troca de sala funciona. Capture erros do console JS e requests de asset que falharam (404).
3. Se algo falhar, compare com `$PUSH_BEFORE` para reportar só regressões introduzidas por este push.
4. Ao terminar, encerre todos os processos que você iniciou (servidor de teste, vite, navegador).

Resultado:
- Tudo passou: termine com um parágrafo (intervalo de commits, testes que passaram, sem erros no console). Não abra PR.
- Regressão: ache a causa nos commits do push, crie um branch `devin/smoke-fix-<descrição>`, faça a correção mínima (commits em português, no estilo do repo), dê push e abra um PR contra master com `gh pr create`, incluindo a evidência (saída do teste, erro do console) e o commit que introduziu o problema. Se não conseguir corrigir com confiança, abra uma issue com `gh issue create` titulada 'Regressão em master: <descrição curta>' com a evidência e o commit suspeito.
- Nunca dê push direto em master. Nunca mexa em servidores de produção.
- Se algo falhar, saia com erro (exit code diferente de zero) para o job do Actions ficar vermelho.
