// Registro do service worker, aviso de atualização e instalação do app.

let eventoInstalacao = null;
const ouvintesInstalacao = new Set();

export const ehIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const jaInstalado = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

export const podeInstalar = () => eventoInstalacao !== null;

export function aoMudarInstalacao(f) {
  ouvintesInstalacao.add(f);
  return () => ouvintesInstalacao.delete(f);
}

export async function instalar() {
  if (!eventoInstalacao) return 'indisponivel';
  eventoInstalacao.prompt();
  const { outcome } = await eventoInstalacao.userChoice;
  eventoInstalacao = null;
  ouvintesInstalacao.forEach((f) => f());
  return outcome; // 'accepted' | 'dismissed'
}

/** Pede ao navegador para não apagar os dados do app em caso de falta de espaço. */
export async function pedirArmazenamentoPersistente() {
  try {
    if (!navigator.storage?.persist) return 'indisponivel';
    if (await navigator.storage.persisted()) return 'sim';
    return (await navigator.storage.persist()) ? 'sim' : 'nao';
  } catch {
    return 'indisponivel';
  }
}

export async function armazenamentoPersistente() {
  try {
    if (!navigator.storage?.persisted) return 'indisponivel';
    return (await navigator.storage.persisted()) ? 'sim' : 'nao';
  } catch {
    return 'indisponivel';
  }
}

export function iniciarPWA({ aoHaAtualizacao }) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    eventoInstalacao = e;
    ouvintesInstalacao.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    eventoInstalacao = null;
    ouvintesInstalacao.forEach((f) => f());
  });

  if (!('serviceWorker' in navigator)) return;

  // Só recarrega quando uma versão NOVA assume o lugar de uma anterior. Na primeira visita, o
  // primeiro controllerchange é só o service worker assumindo a página pela 1ª vez: ignora esse
  // e passa a reagir aos seguintes (assim "Atualizar" também funciona sem ter recarregado antes).
  let controlada = Boolean(navigator.serviceWorker.controller);
  let recarregando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlada) {
      controlada = true;
      return;
    }
    if (recarregando) return;
    recarregando = true;
    location.reload();
  });

  navigator.serviceWorker
    .register('service-worker.js')
    .then((reg) => {
      const oferecer = (worker) =>
        aoHaAtualizacao(() => worker.postMessage({ tipo: 'PULAR_ESPERA' }));
      if (reg.waiting && navigator.serviceWorker.controller) oferecer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const novo = reg.installing;
        novo?.addEventListener('statechange', () => {
          if (novo.state === 'installed' && navigator.serviceWorker.controller) oferecer(novo);
        });
      });
      // Procura versão nova ao abrir e a cada hora com o app aberto.
      reg.update().catch(() => {});
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    })
    .catch((erro) => console.warn('Service worker não registrado:', erro));
}
