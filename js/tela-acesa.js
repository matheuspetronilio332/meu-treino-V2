// Mantém a tela ligada enquanto o timer roda (Screen Wake Lock API), quando o navegador suporta.
// Sem isso, a tela apaga no meio do descanso e o alarme pode não tocar.

let sentinela = null;
let desejado = false;

async function pedir() {
  if (!('wakeLock' in navigator) || sentinela || document.visibilityState !== 'visible') return;
  try {
    sentinela = await navigator.wakeLock.request('screen');
    sentinela.addEventListener('release', () => {
      sentinela = null;
    });
  } catch {
    sentinela = null; // negado (ex.: economia de bateria): segue sem
  }
}

function liberar() {
  const s = sentinela;
  sentinela = null;
  s?.release().catch(() => {});
}

export function manter(ativo) {
  desejado = ativo;
  if (ativo) pedir();
  else liberar();
}

// O navegador libera o wake lock ao esconder a página; pedimos de novo ao voltar.
document.addEventListener('visibilitychange', () => {
  if (desejado && document.visibilityState === 'visible') pedir();
});
