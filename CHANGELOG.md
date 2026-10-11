# Histórico de mudanças

## 2.0.0

Reescrita da versão 1 (um único `index.html` com timer e registro de peso). A migração dos pesos antigos é automática.

### Correções

**Timer**
- O tempo agora é calculado pelo **horário final** (relógio do sistema) e não por `setInterval` decrementando 1 s. Antes ele atrasava e parava com a tela bloqueada.
- O display atualiza assim que você toca em Iniciar (antes só depois de 1 s).
- Tempo zero não dispara mais o alarme na hora: o app avisa que é preciso definir um tempo.
- Segundos acima de 59 são normalizados (75 s viram 1 min 15 s) e valores negativos são impedidos.
- Pausar e retomar (antes, Iniciar sempre recomeçava).
- O alarme é **gerado localmente** (Web Audio). Antes usava um `.ogg` hospedado no Google, que falhava sem internet e era bloqueado fora de um clique. Agora o áudio é liberado no toque em Iniciar, e há também vibração e notificação.

**Peso**
- Valores de 20 a 400 kg, datas válidas e não futuras. Antes aceitava 0, negativos e absurdos.
- Datas guardadas em ISO (`2026-10-11`), o que permite ordenar e fazer gráficos. A lista mostra o mais recente primeiro.
- Um registro por dia (registrar de novo atualiza).
- Apagar registros, com **Desfazer**.
- `JSON.parse` protegido: dados corrompidos viram backup e o app abre normalmente.

**PWA**
- Service worker com estratégia rede primeiro, cache versionado e limpeza de caches antigos (só os deste app, sem mexer em outros apps do mesmo domínio). Antes era cache-first sem limpeza e o app ficava preso na versão antiga.
- Aviso "Há uma nova versão" com botão Atualizar.
- A raiz `./` também é guardada, então abrir o link sem `/index.html` funciona offline.
- Ícones locais (192, 512, *maskable* e Apple touch) no lugar do PNG hospedado no Flaticon.
- Manifest completo (`lang`, `scope`, `description`, `orientation`, `categories`, atalhos) e metas para iOS.

**Interface e acessibilidade**
- Todos os campos têm `label`; foco de teclado visível (antes `outline: none`); contraste AA (o botão branco sobre `#00b894` tinha 2,5:1, agora 4,9:1).
- Sem largura fixa de 320 px: o layout se adapta e foi verificado em 320 px sem rolagem horizontal.
- `100dvh` no lugar de `100vh`; campos numéricos com teclado numérico; respeito a `prefers-reduced-motion`.
- Leitores de tela são avisados das mudanças de fase e do fim do timer (sem anunciar cada segundo).

**Código e repositório**
- Código separado em módulos pequenos (lógica sem DOM é testável no Node), sem `innerHTML`.
- README completo, licença, `.gitignore`, `.gitattributes` (fim de linha consistente) e 42 testes automatizados.

### Novidades

- Modo **intervalado** (trabalho, descanso, rodadas) e tempos rápidos.
- **Treinos**: rotinas, treino em andamento, descanso automático, histórico e recordes de carga.
- **Peso**: resumo, média de 7 dias, meta, gráfico e medidas corporais.
- **Dados**: backup e importação em JSON, exportação em CSV, pedido de armazenamento persistente.
- Tela sempre ligada durante o timer, mini-barra do timer em todas as abas, instalação do app e tema claro/escuro/automático.
