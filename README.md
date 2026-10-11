# Meu treino

App de treino que funciona direto no navegador, **sem internet e sem instalar nada**: timer de descanso e de intervalos, rotinas com cargas, histórico com recordes e controle de peso e medidas.

É um **PWA** (pode ser instalado na tela inicial do celular), escrito em HTML, CSS e JavaScript puros, **sem nenhuma dependência**. Seus dados ficam só no seu aparelho.

## O que tem

| Aba | Recursos |
| --- | --- |
| **Timer** | Contagem regressiva com anel de progresso, tempos rápidos (30 s a 3 min), modo **intervalado** (trabalho, descanso e rodadas), pausar e retomar, aviso por som, vibração e notificação, tela sempre ligada enquanto roda |
| **Treinos** | Rotinas (Treino A, B...) com séries, repetições e carga; treino em andamento com série a série; **descanso automático** ao concluir cada série; histórico; **recordes de carga** |
| **Peso** | Registro por data, resumo (atual, variação, média de 7 dias), **meta**, **gráfico** (30 dias, 90 dias ou tudo), histórico com "desfazer", medidas corporais (cintura, braço etc.) |
| **Ajustes** | Tema claro/escuro/automático, alertas, **backup e importação (JSON)**, exportação em **CSV** (abre no Excel), instalar o app, apagar dados |

## Como usar

### Opção 1: GitHub Pages (recomendado, é o que dá o link para o celular)

1. Envie **todos os arquivos e pastas** deste projeto para o repositório (arraste a pasta inteira em *Add file > Upload files*).
2. Vá em **Settings > Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`, e salve.
3. Em 1 ou 2 minutos o app fica em `https://SEU-USUARIO.github.io/meu-treino/`.
4. No celular, abra o link e use **Instalar app** (Android/Chrome) ou **Compartilhar > Adicionar à Tela de Início** (iPhone).

### Opção 2: no computador

O app usa módulos ES e service worker, então precisa ser servido por `http://` (abrir o `index.html` com duplo clique não funciona). Use um dos atalhos:

- **Windows:** dê duplo clique em `iniciar.bat`
- **Linux/macOS:** `./iniciar.sh`
- **Manual:** `python3 -m http.server 8080` e abra `http://localhost:8080`

Requer apenas o Python 3 instalado. Para outra porta: `./iniciar.sh 9000`.

## Seus dados

- Tudo é salvo no `localStorage` do navegador, neste aparelho. Nada é enviado para servidor nenhum.
- O navegador pode apagar esses dados se faltar espaço ou se você limpar os dados do site. **Faça backups** em *Ajustes > Exportar backup completo*.
- **Importar** mescla com o que já existe (pesos por data, o resto por identificador): nada é apagado.
- Quem usava a versão 1 não perde nada: os pesos antigos (`pesoCorporal`) são migrados sozinhos na primeira abertura.
- Os CSVs usam `;` como separador e vírgula decimal, o formato que o Excel em português abre direto.

## Limitações conhecidas

- **Timer em segundo plano.** O tempo mostrado fica sempre correto (ele é calculado pelo relógio, não por contagem de ticks), mas navegadores podem suspender a página com a tela bloqueada, e aí o **alarme só soa quando você voltar ao app**. Por isso o app mantém a tela ligada enquanto o timer roda (Wake Lock, nos navegadores que suportam). Não há notificação "push" com o app totalmente fechado.
- **iPhone/iPad:** não existe vibração para páginas web, e notificações só funcionam com o app instalado na tela inicial (iOS 16.4 ou superior).
- O som é gerado pelo próprio navegador (Web Audio). Em alguns aparelhos ele só é liberado depois do primeiro toque na tela, o que acontece ao tocar em Iniciar.
- Foi testado em Chromium (testes automatizados, incluindo modo offline). Não foi testado em aparelhos físicos iOS/Safari ou Firefox.

## Estrutura

```
meu-treino/
├── index.html               página única (as 4 abas são montadas por JavaScript)
├── manifest.json            dados de instalação do PWA (nome, ícones, atalhos)
├── service-worker.js        funcionamento offline e atualização do app
├── css/style.css            estilos (temas claro e escuro)
├── icons/                   ícones do app (PNG e SVG)
├── js/
│   ├── app.js               ponto de entrada: liga tudo
│   ├── modelo.js            formato dos dados, validação e mesclagem
│   ├── store.js             gravação no localStorage (tolerante a falhas)
│   ├── timer.js             motor do cronômetro (sem DOM)
│   ├── relogio.js           liga o timer a som, vibração e tela ligada
│   ├── alertas.js           som (Web Audio), vibração e notificações
│   ├── tela-acesa.js        Wake Lock
│   ├── peso.js, treinos.js  regras de peso e de treino (sem DOM)
│   ├── grafico.js           gráfico de linha em SVG
│   ├── exportacao.js        backup JSON e CSV
│   ├── pwa.js               registro do service worker, atualização, instalação
│   ├── ui.js                helpers de interface (sem innerHTML)
│   ├── util.js              datas, números, formatação
│   └── views/               uma tela por arquivo (timer, treinos, peso, ajustes)
├── tests/                   testes automatizados (Node, sem dependências)
├── tools/gerar-icones.py    regera os ícones PNG (opcional)
├── iniciar.bat / iniciar.sh servidor local de um clique
└── package.json             só para `npm test` (não há dependências)
```

## Testes

Com o Node 20 ou superior:

```
npm test
```

São 42 testes que cobrem o cronômetro (inclusive "dormir" por vários segundos sem ticks), validação de dados, migração da versão 1, dados corrompidos, backup e importação (inclusive arquivos maliciosos), recordes, gráfico e a consistência do cache offline.

## Publicando uma nova versão

O service worker usa a estratégia **rede primeiro**: com internet, o app sempre busca a versão mais recente; sem internet, usa o cache. Para soltar uma versão nova:

1. Aumente `VERSAO_APP` em `js/util.js`, `VERSAO` em `service-worker.js` e `version` em `package.json` (o teste `npm test` avisa se ficarem diferentes).
2. Se criar arquivos novos em `js/`, `css/` ou `icons/`, inclua-os na lista `ARQUIVOS` do `service-worker.js` (o teste também avisa se esquecer).
3. Envie para o GitHub. Quem já usa o app vê o aviso **"Há uma nova versão do app"** com o botão **Atualizar**.

## Mudanças em relação à versão 1

Resumo do que foi corrigido e acrescentado (detalhes em [CHANGELOG.md](CHANGELOG.md)): timer sem drift, com pausa e modo intervalado; áudio local em vez de URL externa; service worker que não deixa o app preso em versão antiga; ícones locais; validação e tolerância a falhas nos dados; datas em formato ISO; acessibilidade (rótulos, foco, contraste AA); e as novidades de treinos, gráfico, metas, medidas, backup, CSV e temas.

## Licença

[MIT](LICENSE).
