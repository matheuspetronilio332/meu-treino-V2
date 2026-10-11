// Aba "Timer": anel de progresso, presets, modo simples e modo intervalado.

import { el, svgEl } from '../ui.js';
import { formatarTempo } from '../timer.js';

const RAIO = 90;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;
const PRESETS = [
  [30, '30 s', '30 segundos'],
  [45, '45 s', '45 segundos'],
  [60, '1 min', '1 minuto'],
  [90, '1 min 30', '1 minuto e 30 segundos'],
  [120, '2 min', '2 minutos'],
  [180, '3 min', '3 minutos'],
];

const inteiroSeguro = (valor, min, max) => {
  const n = Math.floor(Number(valor));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};

export function montarTimer({ painel, store, relogio, toast }) {
  const cfg = () => store.obter().config;
  const persistir = () => store.salvar();

  // ----- anel e leitura do tempo -----
  const progresso = svgEl('circle', {
    class: 'anel-progresso', cx: 100, cy: 100, r: RAIO, fill: 'none', 'stroke-width': 12,
    'stroke-dasharray': CIRCUNFERENCIA.toFixed(2), 'stroke-dashoffset': 0,
  });
  const anel = svgEl('svg', { viewBox: '0 0 200 200', class: 'anel-svg', 'aria-hidden': 'true' });
  anel.append(svgEl('circle', { class: 'anel-trilho', cx: 100, cy: 100, r: RAIO, fill: 'none', 'stroke-width': 12 }), progresso);

  const tempo = el('div', { class: 'tempo', role: 'timer', 'aria-live': 'off' }, '01:00');
  const rotuloFase = el('div', { class: 'fase-rotulo' }, 'Pronto');
  const rodada = el('div', { class: 'rodada' }, '');
  const hero = el('div', { class: 'timer-hero fase-ocioso' }, anel, el('div', { class: 'anel-centro' }, tempo, rotuloFase, rodada));

  // ----- botões principais -----
  const botaoPrincipal = el('button', { type: 'button', class: 'botao botao-grande', onClick: aoClicarPrincipal }, 'Iniciar');
  const botaoZerar = el('button', { type: 'button', class: 'botao botao-sec botao-grande', onClick: () => relogio.zerar() }, 'Zerar');
  const controles = el('div', { class: 'controles' }, botaoPrincipal, botaoZerar);

  // ----- configuração -----
  const chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Tempos rápidos' },
    PRESETS.map(([seg, rotulo, leitura]) =>
      el('button', { type: 'button', class: 'chip', 'aria-label': `Iniciar ${leitura}`, onClick: () => iniciarPreset(seg) }, rotulo)));

  const botaoSimples = el('button', { type: 'button', class: 'segmento', onClick: () => mudarModo('simples') }, 'Simples');
  const botaoIntervalo = el('button', { type: 'button', class: 'segmento', onClick: () => mudarModo('intervalado') }, 'Intervalado');
  const modos = el('div', { class: 'segmentos', role: 'group', 'aria-label': 'Modo do timer' }, botaoSimples, botaoIntervalo);

  const campo = (id, rotulo, atributos) => {
    const input = el('input', { id, type: 'number', inputmode: 'numeric', ...atributos });
    return { input, no: el('div', { class: 'campo' }, el('label', { for: id }, rotulo), input) };
  };
  const cMin = campo('t-min', 'Minutos', { min: 0, max: 999, step: 1 });
  const cSeg = campo('t-seg', 'Segundos', { min: 0, max: 59, step: 1 });
  const cTrab = campo('t-trabalho', 'Trabalho (s)', { min: 1, max: 3600, step: 1 });
  const cDesc = campo('t-descanso', 'Descanso (s)', { min: 0, max: 3600, step: 1 });
  const cRounds = campo('t-rounds', 'Rodadas', { min: 1, max: 99, step: 1 });

  const gridSimples = el('div', { class: 'grade-2' }, cMin.no, cSeg.no);
  const gridIntervalo = el('div', { class: 'grade-3' }, cTrab.no, cDesc.no, cRounds.no);
  const configuracao = el('fieldset', { class: 'configuracao' },
    el('legend', { class: 'so-leitor' }, 'Configuração do timer'), modos, gridSimples, gridIntervalo);

  const status = el('p', { class: 'dica' }, '');

  painel.replaceChildren(
    el('h2', { tabindex: '-1' }, 'Timer'),
    hero,
    controles,
    el('div', { class: 'bloco' },
      el('h3', {}, 'Tempos rápidos'), chips,
      el('p', { class: 'dica' }, 'Toque em um tempo para iniciar na hora.')),
    el('div', { class: 'bloco' }, el('h3', {}, 'Personalizar'), configuracao, status),
  );

  // ----- ações -----
  function lerSimples() {
    const total = Math.min(inteiroSeguro(cMin.input.value, 0, 999) * 60 + inteiroSeguro(cSeg.input.value, 0, 5999), 999 * 60 + 59);
    cfg().timer.min = Math.floor(total / 60); // 75 s viram 1 min 15 s
    cfg().timer.seg = total % 60;
    cMin.input.value = cfg().timer.min;
    cSeg.input.value = cfg().timer.seg;
  }
  function lerIntervalo() {
    cfg().timer.trabalho = inteiroSeguro(cTrab.input.value, 1, 3600);
    cfg().timer.descanso = inteiroSeguro(cDesc.input.value, 0, 3600);
    cfg().timer.rounds = inteiroSeguro(cRounds.input.value, 1, 99);
    cTrab.input.value = cfg().timer.trabalho;
    cDesc.input.value = cfg().timer.descanso;
    cRounds.input.value = cfg().timer.rounds;
  }
  const aoEditar = () => {
    if (cfg().timer.modo === 'simples') lerSimples();
    else lerIntervalo();
    persistir();
    desenhar(relogio.snapshot());
  };
  [cMin, cSeg, cTrab, cDesc, cRounds].forEach((c) => c.input.addEventListener('change', aoEditar));

  function mudarModo(modo) {
    cfg().timer.modo = modo;
    persistir();
    sincronizar();
    desenhar(relogio.snapshot());
  }

  function iniciarPreset(segundos) {
    cfg().timer.modo = 'simples';
    cfg().timer.min = Math.floor(segundos / 60);
    cfg().timer.seg = segundos % 60;
    persistir();
    sincronizar();
    relogio.iniciarSimples(segundos, 'Tempo');
  }

  function iniciarAtual() {
    aoEditar();
    const c = cfg().timer;
    if (c.modo === 'simples') {
      const total = c.min * 60 + c.seg;
      if (total <= 0) {
        toast('Defina um tempo maior que zero.');
        cMin.input.focus();
        return;
      }
      relogio.iniciarSimples(total, 'Tempo');
    } else {
      relogio.iniciarIntervalado({ trabalho: c.trabalho, descanso: c.descanso, rounds: c.rounds });
    }
  }

  function aoClicarPrincipal() {
    const { status: s } = relogio.snapshot();
    if (s === 'rodando') relogio.pausar();
    else if (s === 'pausado') relogio.retomar();
    else iniciarAtual();
  }

  function duracaoConfiguradaMs() {
    const c = cfg().timer;
    return (c.modo === 'simples' ? c.min * 60 + c.seg : c.trabalho) * 1000;
  }

  // ----- desenho -----
  function desenhar(s) {
    let texto = '';
    let rotulo = '';
    let rod = '';
    let fracao = 1;
    let classe = 'ocioso';

    if (s.status === 'ocioso') {
      texto = formatarTempo(duracaoConfiguradaMs());
      rotulo = 'Pronto';
    } else if (s.status === 'finalizado') {
      texto = '00:00';
      rotulo = 'Concluído';
      fracao = 0;
      classe = 'fim';
    } else {
      texto = formatarTempo(s.restanteMs);
      rotulo = s.status === 'pausado' ? `${s.fase.rotulo}, pausado` : s.fase.rotulo;
      fracao = s.fracao;
      classe = s.fase.tipo;
      if (s.fase.rounds > 1) rod = `Rodada ${s.fase.round} de ${s.fase.rounds}`;
    }

    tempo.textContent = texto;
    rotuloFase.textContent = rotulo;
    rodada.textContent = rod;
    hero.className = `timer-hero fase-${classe}`;
    progresso.setAttribute('stroke-dashoffset', (CIRCUNFERENCIA * (1 - fracao)).toFixed(2));

    const emAndamento = s.status === 'rodando' || s.status === 'pausado';
    botaoPrincipal.textContent = s.status === 'rodando' ? 'Pausar' : s.status === 'pausado' ? 'Retomar' : 'Iniciar';
    botaoZerar.disabled = s.status === 'ocioso';
    configuracao.disabled = emAndamento;

    status.textContent = emAndamento
      ? 'Zere o timer para alterar a configuração.'
      : cfg().timer.modo === 'intervalado'
        ? 'Trabalho e descanso se alternam pelo número de rodadas definido. O último trabalho não tem descanso depois.'
        : 'Defina minutos e segundos e toque em Iniciar.';
  }

  function sincronizar() {
    const c = cfg().timer;
    cMin.input.value = c.min;
    cSeg.input.value = c.seg;
    cTrab.input.value = c.trabalho;
    cDesc.input.value = c.descanso;
    cRounds.input.value = c.rounds;
    const simples = c.modo === 'simples';
    botaoSimples.setAttribute('aria-pressed', String(simples));
    botaoIntervalo.setAttribute('aria-pressed', String(!simples));
    gridSimples.hidden = !simples;
    gridIntervalo.hidden = simples;
  }

  relogio.assinar(desenhar);
  sincronizar();
  desenhar(relogio.snapshot());

  return { renderizar: () => { sincronizar(); desenhar(relogio.snapshot()); } };
}
