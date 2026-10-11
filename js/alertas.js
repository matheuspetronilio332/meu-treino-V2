// Avisos do timer: som (gerado pelo navegador, sem arquivo de áudio), vibração e notificação.
// O som é sintetizado com Web Audio, então funciona offline e não depende de URL externa
// (a versão 1 usava um .ogg do Google que quebrava sem internet).

let ctx = null;

/** Deve ser chamado dentro de um clique/toque: navegadores só liberam áudio após um gesto do usuário. */
export function destravar() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    /* sem áudio: segue só com vibração/notificação */
  }
}

const PADROES = {
  fase: [[880, 0, 0.14], [880, 0.22, 0.14]],
  fim: [[880, 0, 0.18], [880, 0.26, 0.18], [1320, 0.52, 0.45]],
};

function tocar(padrao) {
  if (!ctx) return;
  if (ctx.state !== 'running') {
    try {
      ctx.resume();
    } catch {
      /* ignora */
    }
  }
  const t0 = ctx.currentTime;
  for (const [freq, inicio, duracao] of padrao) {
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    ganho.gain.setValueAtTime(0.0001, t0 + inicio);
    ganho.gain.exponentialRampToValueAtTime(0.35, t0 + inicio + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t0 + inicio + duracao);
    osc.connect(ganho).connect(ctx.destination);
    osc.start(t0 + inicio);
    osc.stop(t0 + inicio + duracao + 0.05);
  }
}

async function notificar(titulo, corpo) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const opcoes = { body: corpo, icon: 'icons/icon-192.png', tag: 'meu-treino-timer', renotify: true };
    if (reg) await reg.showNotification(titulo, opcoes);
    else new Notification(titulo, opcoes);
  } catch {
    /* ignora */
  }
}

/** tipo: 'fase' (mudou de fase) ou 'fim' (acabou). */
export function avisar(tipo, { config, titulo, corpo }) {
  if (config.som) tocar(PADROES[tipo] ?? PADROES.fase);
  if (config.vibracao && navigator.vibrate) {
    navigator.vibrate(tipo === 'fim' ? [250, 120, 250, 120, 400] : [200, 100, 200]);
  }
  if (config.notificacao && document.hidden) notificar(titulo, corpo);
}

/** Retorna 'granted', 'denied', 'default' ou 'indisponivel'. Chamar a partir de um clique. */
export async function pedirPermissaoNotificacao() {
  if (!('Notification' in window)) return 'indisponivel';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}
