# Usar um som seu no alerta do timer

O app já traz sons prontos (**Gongo de luta**, **Sino de boxe** e **Bipe**), gerados pelo próprio navegador. Se você preferir uma gravação real de gongo, siga os passos abaixo.

## Passo a passo

1. Escolha um arquivo de áudio **curto** (até uns 8 segundos; o que passar disso é cortado).
2. Renomeie para **`alerta.mp3`** e coloque **nesta pasta** (`sounds/`).
   Também funcionam `alerta.ogg`, `alerta.wav` e `alerta.m4a`. Se houver mais de um, o app usa o primeiro que achar, nessa ordem: mp3, ogg, wav, m4a.
3. Envie a pasta para o GitHub (junto com o resto do projeto).
4. No app, vá em **Ajustes > Som do alerta**, escolha **Meu arquivo** e toque em **Ouvir**.

Se o arquivo não for encontrado, o app toca o gongo em vez de ficar mudo e avisa na tela.

## Direitos autorais

Use um áudio que **você mesmo gravou** ou que tenha licença livre para uso (por exemplo, domínio público ou Creative Commons que permita uso pessoal e redistribuição). Confira a licença de cada arquivo antes de publicar o repositório, porque o arquivo ficará visível para quem abrir o seu link.

## Para funcionar offline desde a primeira instalação

O app guarda o arquivo para uso offline na **primeira vez** em que ele é tocado com internet. Se quiser garantir desde a instalação:

1. Abra `service-worker.js` e acrescente `'sounds/alerta.mp3',` (com o nome e a extensão do seu arquivo) na lista `ARQUIVOS`.
2. Aumente o número da versão (`VERSAO` no `service-worker.js` e `VERSAO_APP` em `js/util.js`), para os aparelhos que já usam o app receberem a atualização.

Atenção: se o nome estiver na lista `ARQUIVOS` mas o arquivo **não existir**, a instalação offline falha. Só faça isso depois de colocar o arquivo na pasta.

## Dicas

- Prefira arquivos com volume já bem alto e **sem silêncio no começo**, para o gongo bater assim que o tempo acabar.
- Arquivos de poucos KB (mp3 de 1 a 3 segundos) carregam rápido e ocupam pouco espaço no aparelho.
