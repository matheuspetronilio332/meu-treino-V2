// Avisos do timer: som, vibração e notificação.
//
// Os sons são SINTETIZADOS pelo navegador (Web Audio): funcionam offline, não dependem de URL
// externa e não têm problema de direitos autorais. Estilos: 'gongo', 'sino', 'bipe' e 'arquivo'
// (um áudio seu em sounds/alerta.mp3, ver sounds/LEIA-ME.md).

let ctx = null;
let saida = null; // compressor: evita estourar quando várias batidas se sobrepõem
let bufferArquivo = null;
let carregandoArquivo = null;

export const ESTILOS_SOM = ['gongo', 'sino', 'bipe', 'arquivo'];
const NOMES_ARQUIVO = ['alerta.mp3', 'alerta.ogg', 'alerta.wav', 'alerta.m4a'];

/** Deve ser chamado dentro de um clique/toque: navegadores só liberam áudio após um gesto do usuário. */
export function destravar(config) {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    if (config?.somAlerta === 'arquivo') precarregarArquivo();
  } catch {
    /* sem áudio: segue só com vibração/notificação */
  }
}

function obterSaida() {
  if (!saida) {
    saida = ctx.createDynamicsCompressor();
    saida.connect(ctx.destination);
  }
  return saida;
}

// ---------- blocos de síntese ----------

function parcial(c, destino, t0, freq, amp, dur, { glide = 1 } = {}) {
  const osc = c.createOscillator();
  const ganho = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * glide, t0);
  if (glide !== 1) osc.frequency.exponentialRampToValueAtTime(freq, t0 + 0.35); // "bwoong" do impacto
  ganho.gain.setValueAtTime(0.0001, t0);
  ganho.gain.exponentialRampToValueAtTime(amp, t0 + 0.005); // ataque quase instantâneo
  ganho.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); // decaimento longo
  osc.connect(ganho).connect(destino);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** Estalo curto de metal batendo em metal, no começo de cada golpe. */
function estalo(c, destino, t0, amp, freq) {
  const n = Math.floor(c.sampleRate * 0.06);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const fonte = c.createBufferSource();
  fonte.buffer = buf;
  const filtro = c.createBiquadFilter();
  filtro.type = 'bandpass';
  filtro.frequency.value = freq;
  filtro.Q.value = 0.8;
  const ganho = c.createGain();
  ganho.gain.value = amp;
  fonte.connect(filtro).connect(ganho).connect(destino);
  fonte.start(t0);
}

// [razão da frequência, amplitude, fração da duração]. Razões não harmônicas = timbre de metal.
const PARCIAIS_GONGO = [
  [1, 1, 1], [1.007, 0.9, 1], [1.52, 0.7, 0.85], [2.05, 0.6, 0.7], [2.76, 0.5, 0.55],
  [3.41, 0.35, 0.45], [4.17, 0.3, 0.35], [5.4, 0.2, 0.28], [6.9, 0.12, 0.2],
];
const PARCIAIS_SINO = [
  [0.56, 1, 1], [0.92, 0.9, 0.9], [1.19, 1, 0.8], [1.7, 0.8, 0.6], [2, 0.7, 0.55],
  [2.74, 0.6, 0.4], [3, 0.5, 0.35], [3.76, 0.4, 0.3], [4.07, 0.3, 0.25],
];

function golpe(c, destino, t0, { base, parciais, dur, vol, ganho, glide = 1, freqEstalo }) {
  for (const [razao, amp, fracao] of parciais) parcial(c, destino, t0, base * razao, amp * vol * ganho, dur * fracao, { glide });
  estalo(c, destino, t0, vol * 0.3, freqEstalo);
}

// base: nota fundamental em Hz (celulares reproduzem mal abaixo de ~200 Hz); ganho: volume do estilo.
const GONGO = { base: 220, ganho: 0.32, parciais: PARCIAIS_GONGO, glide: 1.03, freqEstalo: 900 };
const SINO = { base: 640, ganho: 0.22, parciais: PARCIAIS_SINO, freqEstalo: 3000 };

/**
 * Agenda o som `estilo` no contexto de áudio `c` (real ou Offline, para testes).
 * tipo: 'fase' (mudou de fase) ou 'fim' (acabou). Retorna a duração aproximada em segundos.
 */
export function agendarSom(c, destino, estilo, tipo, t0 = c.currentTime) {
  const fim = tipo === 'fim';
  if (estilo === 'gongo') {
    golpe(c, destino, t0, { ...GONGO, dur: fim ? 5.5 : 3.6, vol: fim ? 0.95 : 0.75 });
    return fim ? 5.5 : 3.6;
  }
  if (estilo === 'sino') {
    // Fim do round: três batidas seguidas, como o sino do ringue. Troca de fase: uma.
    const batidas = fim ? 3 : 1;
    for (let i = 0; i < batidas; i++) golpe(c, destino, t0 + i * 0.34, { ...SINO, dur: 1.8, vol: 0.8 });
    return (batidas - 1) * 0.34 + 1.8;
  }
  const padrao = fim
    ? [[880, 0, 0.18], [880, 0.26, 0.18], [1320, 0.52, 0.45]]
    : [[880, 0, 0.14], [880, 0.22, 0.14]];
  for (const [freq, inicio, dur] of padrao) parcial(c, destino, t0 + inicio, freq, 0.35, dur);
  return fim ? 1 : 0.4;
}

// ---------- arquivo próprio ----------

export function precarregarArquivo() {
  if (bufferArquivo || carregandoArquivo || !ctx) return carregandoArquivo ?? Promise.resolve(Boolean(bufferArquivo));
  carregandoArquivo = (async () => {
    for (const nome of NOMES_ARQUIVO) {
      try {
        const resposta = await fetch(`sounds/${nome}`);
        if (!resposta.ok) continue;
        bufferArquivo = await ctx.decodeAudioData(await resposta.arrayBuffer());
        return true;
      } catch {
        /* tenta o próximo formato */
      }
    }
    return false;
  })().finally(() => { carregandoArquivo = null; });
  return carregandoArquivo;
}

function tocarArquivo() {
  const fonte = ctx.createBufferSource();
  fonte.buffer = bufferArquivo;
  fonte.connect(obterSaida());
  fonte.start();
  fonte.stop(ctx.currentTime + 8); // limite de segurança: arquivos longos são cortados em 8 s
}

function tocarEstilo(estilo, tipo) {
  if (!ctx) return { usouFallback: false };
  if (ctx.state !== 'running') {
    try { ctx.resume(); } catch { /* ignora */ }
  }
  if (estilo === 'arquivo') {
    if (bufferArquivo) {
      tocarArquivo();
      return { usouFallback: false };
    }
    agendarSom(ctx, obterSaida(), 'gongo', tipo); // arquivo ausente: toca o gongo em vez de ficar mudo
    return { usouFallback: true };
  }
  agendarSom(ctx, obterSaida(), estilo, tipo);
  return { usouFallback: false };
}

/** Botão "Ouvir" dos Ajustes. Chamar a partir de um clique. */
export async function ouvirSom(estilo, tipo = 'fim') {
  destravar();
  if (estilo === 'arquivo') await precarregarArquivo();
  return tocarEstilo(estilo, tipo);
}

// ---------- vibração e notificação ----------

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
  if (config.som) tocarEstilo(config.somAlerta, tipo);
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
