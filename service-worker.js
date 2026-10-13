/* Service worker do Meu treino.
 *
 * Estratégia: REDE PRIMEIRO, com cache de reserva.
 *  - Online: sempre busca a versão mais recente (revalidando com o servidor) e atualiza o cache.
 *  - Offline ou rede lenta (> 4 s): usa o que está no cache.
 * Assim o app nunca fica "preso" numa versão antiga (problema da versão 1, que usava cache-first
 * sem nunca limpar) e continua funcionando na academia sem sinal.
 *
 * Ao publicar uma versão nova, aumente VERSAO (e VERSAO_APP em js/util.js): isso faz o navegador
 * instalar o novo service worker, limpar caches antigos e mostrar o aviso "Atualizar".
 */
const VERSAO = 'meu-treino-v2.1.0';
const PREFIXOS_DESTE_APP = ['meu-treino-', 'treino-timer-']; // não mexe em caches de outros apps do mesmo domínio
const TEMPO_LIMITE_REDE_MS = 4000;

const ARQUIVOS = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/app.js',
  'js/alertas.js',
  'js/exportacao.js',
  'js/grafico.js',
  'js/modelo.js',
  'js/peso.js',
  'js/pwa.js',
  'js/relogio.js',
  'js/store.js',
  'js/tela-acesa.js',
  'js/timer.js',
  'js/treinos.js',
  'js/ui.js',
  'js/util.js',
  'js/views/ajustes.js',
  'js/views/peso.js',
  'js/views/timer.js',
  'js/views/treinos.js',
  'icons/favicon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSAO).then((cache) => cache.addAll(ARQUIVOS)));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes
          .filter((n) => n !== VERSAO && PREFIXOS_DESTE_APP.some((p) => n.startsWith(p)))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

// A página pede para ativar a versão nova quando o usuário toca em "Atualizar".
self.addEventListener('message', (evento) => {
  if (evento.data && evento.data.tipo === 'PULAR_ESPERA') self.skipWaiting();
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  if (new URL(pedido.url).origin !== self.location.origin) return;
  evento.respondWith(redePrimeiro(pedido));
});

async function redePrimeiro(pedido) {
  const cache = await caches.open(VERSAO);

  const busca = fetch(pedido, { cache: 'no-cache' }).then((resposta) => {
    if (resposta && resposta.ok && resposta.type === 'basic') cache.put(pedido, resposta.clone());
    return resposta;
  });
  busca.catch(() => {}); // evita erro "não tratado" se a rede falhar depois do tempo limite

  const limite = new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error('tempo esgotado')), TEMPO_LIMITE_REDE_MS));

  try {
    return await Promise.race([busca, limite]);
  } catch (_) {
    const guardado = await cache.match(pedido, { ignoreSearch: true });
    if (guardado) return guardado;
    if (pedido.mode === 'navigate') {
      const inicio = await cache.match('index.html');
      if (inicio) return inicio;
    }
    return Response.error();
  }
}
